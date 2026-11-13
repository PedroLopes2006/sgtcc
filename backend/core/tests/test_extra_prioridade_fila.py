"""
EXTRA — prioridade na Fila de revisão (protótipo do Figma).

Fora dos requisitos do documento: não há RF, RN nem US para ela, e a US09 só
pede a lista e a mensagem de fila vazia. O orientador marca uma entrega da fila
como alta, média ou baixa (ou sem prioridade). A marcação é só dele, o aluno
nunca a vê, e ela não muda a ordem de chegada da fila.

Regras que ela respeita: RN05 (só o orientador ativo), RNF04 (acesso por perfil).
Não é mudança de estado: não gera Evento e ninguém é notificado.
"""
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from core.models import (
    Entrega,
    EstadoEntrega,
    Orientacao,
    Perfil,
    PrioridadeRevisao,
    StatusTema,
    TCC,
    Tema,
    Usuario,
)


class PrioridadeNaFilaTests(APITestCase):
    def setUp(self):
        self.aluno = Usuario.objects.create_user(
            email="lucas@aluno.edu.br", nome="Lucas", senha="senhaForte123", perfil=Perfil.ALUNO
        )
        self.orientador = Usuario.objects.create_user(
            email="marcos@prof.edu.br", nome="Marcos", senha="senhaForte123",
            perfil=Perfil.ORIENTADOR,
        )
        self.tcc = TCC.objects.create(aluno=self.aluno)
        Tema.objects.create(
            tcc=self.tcc, titulo="Gestão de TCC", descricao="Sistema web.",
            status=StatusTema.APROVADO, data_aprovacao=timezone.now(),
        )
        Orientacao.objects.create(tcc=self.tcc, orientador=self.orientador)
        self.entrega = Entrega.objects.create(
            tcc=self.tcc, titulo="Capítulo 1", prazo=timezone.localdate() + timedelta(days=30),
            estado=EstadoEntrega.PRONTO_PARA_REVISAO,
        )
        self.url = reverse("prioridade-entrega", args=[self.entrega.id])
        self.client.force_authenticate(self.orientador)

    def _definir(self, valor):
        return self.client.put(self.url, {"prioridade": valor}, format="json")

    def _prioridade_na_fila(self):
        fila = self.client.get(reverse("fila-revisao")).data
        return fila[0]["prioridade"]

    # ---- marcar, trocar e remover

    def test_marca_alta_media_e_baixa(self):
        for nivel in ("alta", "media", "baixa"):
            with self.subTest(nivel=nivel):
                resposta = self._definir(nivel)

                self.assertEqual(resposta.status_code, status.HTTP_200_OK)
                self.assertEqual(resposta.data, {"prioridade": nivel})
                registro = PrioridadeRevisao.objects.get(
                    orientador=self.orientador, entrega=self.entrega
                )
                self.assertEqual(registro.nivel, nivel)

    def test_trocar_a_prioridade_nao_cria_um_segundo_registro(self):
        self._definir("alta")
        self._definir("baixa")
        self.assertEqual(PrioridadeRevisao.objects.count(), 1)

    def test_sem_prioridade_remove_a_marcacao(self):
        self._definir("alta")

        resposta = self._definir("sem_prioridade")

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(resposta.data, {"prioridade": None})
        self.assertEqual(PrioridadeRevisao.objects.count(), 0)

    def test_valor_invalido_e_recusado(self):
        resposta = self._definir("urgentissima")
        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("prioridade", resposta.data)
        self.assertEqual(PrioridadeRevisao.objects.count(), 0)

    def test_o_banco_nao_aceita_duas_marcacoes_do_mesmo_par(self):
        PrioridadeRevisao.objects.create(
            orientador=self.orientador, entrega=self.entrega, nivel="alta"
        )
        with self.assertRaises(IntegrityError), transaction.atomic():
            PrioridadeRevisao.objects.create(
                orientador=self.orientador, entrega=self.entrega, nivel="baixa"
            )

    def test_entrega_encerrada_nao_recebe_prioridade(self):
        for estado in (EstadoEntrega.CONCLUIDA, EstadoEntrega.ENVIADA_A_BANCA):
            with self.subTest(estado=estado):
                Entrega.objects.filter(pk=self.entrega.pk).update(estado=estado)
                self.assertEqual(self._definir("alta").status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(PrioridadeRevisao.objects.count(), 0)

    # ---- o que a fila mostra

    def test_a_fila_mostra_a_prioridade_marcada(self):
        self.assertIsNone(self._prioridade_na_fila())

        self._definir("media")

        self.assertEqual(self._prioridade_na_fila(), "media")

    def test_a_prioridade_nao_muda_a_ordem_de_chegada(self):
        outro_aluno = Usuario.objects.create_user(
            email="ana@aluno.edu.br", nome="Ana", senha="senhaForte123", perfil=Perfil.ALUNO
        )
        tcc2 = TCC.objects.create(aluno=outro_aluno)
        Tema.objects.create(
            tcc=tcc2, titulo="Outro tema", descricao="...", status=StatusTema.APROVADO
        )
        Orientacao.objects.create(tcc=tcc2, orientador=self.orientador)
        segunda = Entrega.objects.create(
            tcc=tcc2, titulo="Metodologia", prazo=timezone.localdate() + timedelta(days=30),
            estado=EstadoEntrega.PRONTO_PARA_REVISAO,
        )
        ordem_antes = [i["id"] for i in self.client.get(reverse("fila-revisao")).data]

        self.client.put(
            reverse("prioridade-entrega", args=[segunda.id]), {"prioridade": "alta"}, format="json"
        )

        ordem_depois = [i["id"] for i in self.client.get(reverse("fila-revisao")).data]
        self.assertEqual(ordem_antes, ordem_depois)

    # ---- é só do orientador

    def test_a_prioridade_e_de_cada_orientador_e_o_novo_nao_herda_a_do_antigo(self):
        self._definir("alta")
        novo = Usuario.objects.create_user(
            email="paula@prof.edu.br", nome="Paula", senha="senhaForte123",
            perfil=Perfil.ORIENTADOR,
        )
        self.tcc.orientacao_ativa.encerrar()
        Orientacao.objects.create(tcc=self.tcc, orientador=novo)

        self.client.force_authenticate(novo)

        self.assertIsNone(self._prioridade_na_fila())

    def test_o_aluno_nunca_ve_a_prioridade(self):
        self._definir("alta")
        self.client.force_authenticate(self.aluno)

        entregas = self.client.get(reverse("entregas")).data
        meu_tcc = self.client.get(reverse("meu-tcc")).data

        self.assertNotIn("prioridade", entregas[0])
        self.assertNotIn("prioridade", meu_tcc["entregas"][0])

    def test_rnf04_o_aluno_nao_marca_prioridade(self):
        self.client.force_authenticate(self.aluno)
        self.assertEqual(self._definir("alta").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(PrioridadeRevisao.objects.count(), 0)

    def test_rn05_so_o_orientador_ativo_marca_prioridade(self):
        outro = Usuario.objects.create_user(
            email="outro@prof.edu.br", nome="Outro", senha="senhaForte123",
            perfil=Perfil.ORIENTADOR,
        )
        self.client.force_authenticate(outro)
        self.assertEqual(self._definir("alta").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(PrioridadeRevisao.objects.count(), 0)

    def test_entrega_inexistente_retorna_404(self):
        resposta = self.client.put(
            reverse("prioridade-entrega", args=[99999]), {"prioridade": "alta"}, format="json"
        )
        self.assertEqual(resposta.status_code, status.HTTP_404_NOT_FOUND)

    def test_nao_gera_evento_nem_notificacao(self):
        """Não é mudança de estado: o log do TCC não ganha nada."""
        antes = self.tcc.eventos.count()
        self._definir("alta")
        self.assertEqual(self.tcc.eventos.count(), antes)
