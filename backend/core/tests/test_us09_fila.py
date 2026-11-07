"""
US09 — Fila de revisão.

Requisitos: RF09 · RN05, RN06 · RNF02, RNF04.

CA1. Dado um orientador autenticado, quando acessa a fila, então vê todas as
     entregas "pronto_para_revisão" de seus orientandos ativos.
CA2. Dada nenhuma pendência, quando acessa a fila, então vê mensagem de fila
     vazia (a API devolve a lista vazia; o texto é da tela).

A fila mostra só a primeira entrega pendente de cada aluno (RN06), a mesma que
o "Iniciar revisão" (US10) aceita, e segue a ordem de chegada: a data do
último Evento ENTREGA_PRONTA de cada entrega.
"""
from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from core import services
from core.models import (
    Entrega,
    EstadoEntrega,
    Evento,
    Orientacao,
    Perfil,
    StatusTema,
    TCC,
    Tema,
    TipoEvento,
    Usuario,
)
from core.tests.base_test import criar_versao


class FilaRevisaoTests(APITestCase):
    def setUp(self):
        self.orientador = Usuario.objects.create_user(
            email="marcos@prof.edu.br", nome="Marcos", senha="senhaForte123",
            perfil=Perfil.ORIENTADOR,
        )
        self.lucas_tcc = self._criar_orientando("lucas@aluno.edu.br", "Lucas")
        self.client.force_authenticate(self.orientador)

    # ---- atalhos

    def _criar_orientando(self, email, nome, orientador=None):
        aluno = Usuario.objects.create_user(
            email=email, nome=nome, senha="senhaForte123", perfil=Perfil.ALUNO
        )
        tcc = TCC.objects.create(aluno=aluno)
        Tema.objects.create(
            tcc=tcc, titulo=f"Tema de {nome}", descricao="Descrição.",
            status=StatusTema.APROVADO, data_aprovacao=timezone.now(),
        )
        Orientacao.objects.create(tcc=tcc, orientador=orientador or self.orientador)
        return tcc

    def _entrega(self, tcc, titulo, dias=30, estado=EstadoEntrega.RASCUNHO):
        return Entrega.objects.create(
            tcc=tcc, titulo=titulo, prazo=timezone.localdate() + timedelta(days=dias),
            estado=estado,
        )

    def _pronta(self, tcc, titulo, dias=30, ha_horas=None):
        """Cria a entrega com uma versão e a sinaliza pelo service, como o aluno faria (US08)."""
        entrega = self._entrega(tcc, titulo, dias)
        criar_versao(entrega)
        entrega = services.sinalizar_pronta(aluno=tcc.aluno, entrega=entrega)
        if ha_horas is not None:
            Evento.objects.filter(entrega=entrega, tipo=TipoEvento.ENTREGA_PRONTA).update(
                data_hora=timezone.now() - timedelta(hours=ha_horas)
            )
        return entrega

    def _fila(self):
        resposta = self.client.get(reverse("fila-revisao"))
        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        return resposta.data

    def _titulos(self):
        return [item["titulo"] for item in self._fila()]

    # ------------------------------------------------------------- CA1

    def test_ca1_mostra_as_entregas_prontas_dos_orientandos_ativos(self):
        """US09 CA1 / RF09 — todas as prontas para revisão, de todos os orientandos ativos."""
        ana_tcc = self._criar_orientando("ana@aluno.edu.br", "Ana")
        self._pronta(self.lucas_tcc, "Introdução")
        self._pronta(ana_tcc, "Metodologia")

        self.assertEqual(set(self._titulos()), {"Introdução", "Metodologia"})

    def test_ca1_so_entra_o_estado_pronto_para_revisao(self):
        """US09 CA1 — rascunho, em revisão, correção, concluída e banca ficam fora."""
        estados_fora = [
            EstadoEntrega.RASCUNHO,
            EstadoEntrega.EM_REVISAO,
            EstadoEntrega.CORRECAO_SOLICITADA,
            EstadoEntrega.CONCLUIDA,
            EstadoEntrega.ENVIADA_A_BANCA,
        ]
        for i, estado in enumerate(estados_fora):
            tcc = self._criar_orientando(f"aluno{i}@aluno.edu.br", f"Aluno {i}")
            self._entrega(tcc, f"Entrega {estado}", estado=estado)

        self.assertEqual(self._fila(), [])

    def test_ca1_cada_item_traz_aluno_entrega_prazo_versao_e_data(self):
        """US09 CA1 — o item tem o que a tela mostra: aluno, entrega, prazo, versão e quando ficou pronta."""
        entrega = self._pronta(self.lucas_tcc, "Introdução", dias=12)

        item = self._fila()[0]
        self.assertEqual(item["id"], entrega.id)
        self.assertEqual(item["aluno"]["nome"], "Lucas")
        self.assertEqual(item["tcc"], self.lucas_tcc.id)
        self.assertEqual(item["tema"], "Tema de Lucas")
        self.assertEqual(item["estado"], EstadoEntrega.PRONTO_PARA_REVISAO)
        self.assertEqual(str(item["prazo"]), entrega.prazo.isoformat())
        self.assertEqual(item["versao_atual"]["numero"], 1)
        self.assertTrue(item["versao_atual"]["arquivo_url"].startswith("http"))
        self.assertIsNotNone(item["pronta_em"])

    # ------------------------------------------------------------- CA2

    def test_ca2_sem_pendencia_a_fila_vem_vazia(self):
        """US09 CA2 — sem nenhuma entrega pronta, a lista é vazia."""
        self._entrega(self.lucas_tcc, "Introdução")
        self.assertEqual(self._fila(), [])

    def test_ca2_orientador_sem_orientandos_recebe_fila_vazia(self):
        """US09 CA2 — orientador novo, sem nenhum orientando."""
        novo = Usuario.objects.create_user(
            email="paula@prof.edu.br", nome="Paula", senha="senhaForte123",
            perfil=Perfil.ORIENTADOR,
        )
        self.client.force_authenticate(novo)
        self.assertEqual(self._fila(), [])

    # ------------------------------------------------------------- RN05

    def test_rn05_entrega_de_outro_orientador_nao_aparece(self):
        """RN05 — a fila é só dos orientandos do orientador logado."""
        outro = Usuario.objects.create_user(
            email="paula@prof.edu.br", nome="Paula", senha="senhaForte123",
            perfil=Perfil.ORIENTADOR,
        )
        ana_tcc = self._criar_orientando("ana@aluno.edu.br", "Ana", orientador=outro)
        self._pronta(ana_tcc, "Metodologia")

        self.assertEqual(self._fila(), [])

    def test_rn05_ex_orientador_nao_ve_a_entrega(self):
        """RN05 / US09 CA1 — depois de uma troca de orientador, só o novo vê a entrega."""
        self._pronta(self.lucas_tcc, "Introdução")
        novo = Usuario.objects.create_user(
            email="paula@prof.edu.br", nome="Paula", senha="senhaForte123",
            perfil=Perfil.ORIENTADOR,
        )
        self.lucas_tcc.orientacao_ativa.encerrar()
        Orientacao.objects.create(tcc=self.lucas_tcc, orientador=novo)

        self.assertEqual(self._fila(), [])
        self.client.force_authenticate(novo)
        self.assertEqual(self._titulos(), ["Introdução"])

    # ------------------------------------------------------------- RN06

    def test_rn06_so_entra_a_primeira_entrega_pendente(self):
        """RN06 — se a primeira pendente ainda é rascunho, a seguinte pronta espera a vez."""
        self._entrega(self.lucas_tcc, "Introdução", dias=10)
        self._pronta(self.lucas_tcc, "Metodologia", dias=20)

        self.assertEqual(self._fila(), [])

    def test_rn06_a_seguinte_entra_quando_a_anterior_e_concluida(self):
        """RN06 — concluída a primeira, a próxima pronta chega à fila."""
        primeira = self._entrega(self.lucas_tcc, "Introdução", dias=10)
        self._pronta(self.lucas_tcc, "Metodologia", dias=20)
        Entrega.objects.filter(pk=primeira.pk).update(estado=EstadoEntrega.CONCLUIDA)

        self.assertEqual(self._titulos(), ["Metodologia"])

    def test_rn06_todo_item_da_fila_aceita_iniciar_revisao(self):
        """RN06 / US10 — o botão "Iniciar revisão" da fila nunca bate na regra de ordem."""
        ana_tcc = self._criar_orientando("ana@aluno.edu.br", "Ana")
        self._pronta(self.lucas_tcc, "Introdução")
        self._entrega(ana_tcc, "Introdução da Ana", dias=5)
        self._pronta(ana_tcc, "Metodologia da Ana", dias=15)

        for item in self._fila():
            resposta = self.client.post(reverse("iniciar-revisao", args=[item["id"]]))
            self.assertEqual(resposta.status_code, status.HTTP_200_OK, item["titulo"])

    def test_iniciar_revisao_tira_a_entrega_da_fila(self):
        """US09 + US10 — a entrega aberta passa a "em revisão" e sai da fila."""
        entrega = self._pronta(self.lucas_tcc, "Introdução")
        self.client.post(reverse("iniciar-revisao", args=[entrega.id]))
        self.assertEqual(self._fila(), [])

    # ------------------------------------------------------------- ordem de chegada

    def test_ordem_de_chegada_da_mais_antiga_para_a_mais_nova(self):
        """US09 — a fila segue a data em que cada entrega ficou pronta."""
        ana_tcc = self._criar_orientando("ana@aluno.edu.br", "Ana")
        bia_tcc = self._criar_orientando("bia@aluno.edu.br", "Bia")
        self._pronta(self.lucas_tcc, "Do Lucas", ha_horas=1)
        self._pronta(ana_tcc, "Da Ana", ha_horas=48)
        self._pronta(bia_tcc, "Da Bia", ha_horas=5)

        self.assertEqual(self._titulos(), ["Da Ana", "Da Bia", "Do Lucas"])

    def test_ordem_usa_a_ultima_sinalizacao_depois_de_uma_correcao(self):
        """US09 / RN06 — sinalizada de novo após a correção, a entrega volta para o fim da fila."""
        ana_tcc = self._criar_orientando("ana@aluno.edu.br", "Ana")
        do_lucas = self._pronta(self.lucas_tcc, "Do Lucas", ha_horas=72)
        self._pronta(ana_tcc, "Da Ana", ha_horas=24)

        # O ciclo da correção: em revisão → correção → nova versão → pronta de novo.
        services.iniciar_revisao_entrega(orientador=self.orientador, entrega=do_lucas)
        do_lucas.refresh_from_db()
        services.solicitar_correcao_entrega(
            orientador=self.orientador, entrega=do_lucas, comentario="Ajustar a introdução."
        )
        do_lucas.refresh_from_db()
        criar_versao(do_lucas, numero=2)
        Entrega.objects.filter(pk=do_lucas.pk).update(estado=EstadoEntrega.RASCUNHO)
        do_lucas.refresh_from_db()
        services.sinalizar_pronta(aluno=self.lucas_tcc.aluno, entrega=do_lucas)

        self.assertEqual(self._titulos(), ["Da Ana", "Do Lucas"])

    def test_entrega_sem_evento_de_pronta_vai_para_o_fim(self):
        """Dados antigos ou criados à mão, sem o Evento, ficam no fim da fila e sem data."""
        ana_tcc = self._criar_orientando("ana@aluno.edu.br", "Ana")
        self._entrega(ana_tcc, "Sem evento", estado=EstadoEntrega.PRONTO_PARA_REVISAO)
        self._pronta(self.lucas_tcc, "Com evento", ha_horas=2)

        fila = self._fila()
        self.assertEqual([i["titulo"] for i in fila], ["Com evento", "Sem evento"])
        self.assertIsNone(fila[1]["pronta_em"])
        self.assertIsNone(fila[1]["versao_atual"])

    # ------------------------------------------------------------- RNF04

    def test_rnf04_aluno_nao_acessa_a_fila(self):
        """RNF04 — a fila é exclusiva de orientadores."""
        self.client.force_authenticate(self.lucas_tcc.aluno)
        resposta = self.client.get(reverse("fila-revisao"))
        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)

    def test_rnf04_sem_login_nao_acessa_a_fila(self):
        """RNF04 — sem autenticação, nada."""
        self.client.force_authenticate(None)
        resposta = self.client.get(reverse("fila-revisao"))
        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)
