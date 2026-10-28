"""US08 — Sinalizar pronta para revisão."""
from django.urls import reverse
from rest_framework import status

from core.models import EstadoEntrega, TipoEvento

from .base_test import BaseEntregaTests, criar_versao


class SinalizarProntaTests(BaseEntregaTests):
    # ---- CA1

    def test_ca1_rascunho_com_versao_vira_pronto_para_revisao(self):
        criar_versao(self.entrega)
        resposta = self.sinalizar()

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(resposta.data["estado"], EstadoEntrega.PRONTO_PARA_REVISAO)
        self.entrega.refresh_from_db()
        self.assertEqual(self.entrega.estado, EstadoEntrega.PRONTO_PARA_REVISAO)

    def test_apos_sinalizar_a_resposta_ja_nao_oferece_nova_sinalizacao(self):
        criar_versao(self.entrega)
        resposta = self.sinalizar()
        self.assertFalse(resposta.data["pode_sinalizar"])

    # ---- CA2

    def test_ca2_sem_nenhuma_versao_o_sistema_impede(self):
        resposta = self.sinalizar()

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("ao menos uma versão", str(resposta.data["detail"]))
        self.entrega.refresh_from_db()
        self.assertEqual(self.entrega.estado, EstadoEntrega.RASCUNHO)
        self.assertEqual(self.tcc.eventos.filter(tipo=TipoEvento.ENTREGA_PRONTA).count(), 0)

    # ---- CA3

    def test_ca3_registra_evento_e_cita_o_orientador_avisado(self):
        criar_versao(self.entrega)
        self.sinalizar()

        evento = self.tcc.eventos.get(tipo=TipoEvento.ENTREGA_PRONTA)
        self.assertEqual(evento.entrega, self.entrega)
        self.assertEqual(evento.usuario_relacionado, self.aluno)
        self.assertIn("Marcos", evento.descricao)
        self.assertIn("versão 1", evento.descricao)

    def test_evento_cita_a_ultima_versao(self):
        criar_versao(self.entrega)
        criar_versao(self.entrega)
        self.sinalizar()
        evento = self.tcc.eventos.get(tipo=TipoEvento.ENTREGA_PRONTA)
        self.assertIn("versão 2", evento.descricao)

    def test_sem_orientador_ativo_nao_ha_quem_avisar(self):
        criar_versao(self.entrega)
        self.orientacao.encerrar()
        resposta = self.sinalizar()

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.entrega.refresh_from_db()
        self.assertEqual(self.entrega.estado, EstadoEntrega.RASCUNHO)

    # ---- RN03 / RN04

    def test_so_sinaliza_a_partir_do_rascunho(self):
        criar_versao(self.entrega)
        for estado in (
            EstadoEntrega.PRONTO_PARA_REVISAO,
            EstadoEntrega.EM_REVISAO,
            EstadoEntrega.CORRECAO_SOLICITADA,
            EstadoEntrega.CONCLUIDA,
            EstadoEntrega.ENVIADA_A_BANCA,
        ):
            with self.subTest(estado=estado):
                self.definir_estado(estado)
                resposta = self.sinalizar()

                self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
                self.entrega.refresh_from_db()
                self.assertEqual(self.entrega.estado, estado)
        self.assertEqual(self.tcc.eventos.filter(tipo=TipoEvento.ENTREGA_PRONTA).count(), 0)

    def test_segundo_clique_nao_duplica_a_sinalizacao(self):
        criar_versao(self.entrega)
        primeira = self.sinalizar()
        segunda = self.sinalizar()

        self.assertEqual(primeira.status_code, status.HTTP_200_OK)
        self.assertEqual(segunda.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.tcc.eventos.filter(tipo=TipoEvento.ENTREGA_PRONTA).count(), 1)

    def test_ciclo_de_correcao_exige_nova_versao_antes_de_sinalizar_de_novo(self):
        """
        rascunho → pronta → (revisão e correção, US10/US11) → correção solicitada
        → novo envio (US06 CA2) volta ao rascunho → só então sinaliza outra vez.

        Aqui o que as US06, US10 e US11 farão é simulado direto no banco.
        """
        criar_versao(self.entrega)
        self.sinalizar()
        self.definir_estado(EstadoEntrega.CORRECAO_SOLICITADA)

        sem_nova_versao = self.sinalizar()
        self.assertEqual(sem_nova_versao.status_code, status.HTTP_400_BAD_REQUEST)

        criar_versao(self.entrega)
        self.definir_estado(EstadoEntrega.RASCUNHO)

        segunda_vez = self.sinalizar()
        self.assertEqual(segunda_vez.status_code, status.HTTP_200_OK)
        self.assertEqual(segunda_vez.data["estado"], EstadoEntrega.PRONTO_PARA_REVISAO)
        self.assertEqual(self.tcc.eventos.filter(tipo=TipoEvento.ENTREGA_PRONTA).count(), 2)

    # ---- o que a tela recebe

    def test_lista_de_entregas_diz_quais_podem_ser_sinalizadas(self):
        sem_versao = self.entrega
        com_versao = self.entrega.tcc.entregas.create(
            titulo="Capítulo 2", prazo=self.entrega.prazo
        )
        criar_versao(com_versao)
        ja_sinalizada = self.entrega.tcc.entregas.create(
            titulo="Capítulo 3", prazo=self.entrega.prazo,
            estado=EstadoEntrega.PRONTO_PARA_REVISAO,
        )
        criar_versao(ja_sinalizada)

        resposta = self.client.get(reverse("entregas"))

        podem = {e["titulo"]: e["pode_sinalizar"] for e in resposta.data}
        self.assertEqual(podem, {"Capítulo 1": False, "Capítulo 2": True, "Capítulo 3": False})
        self.assertEqual(sem_versao.versoes.count(), 0)

    # ---- permissões

    def test_orientador_nao_sinaliza(self):
        criar_versao(self.entrega)
        self.client.force_authenticate(self.orientador)
        self.assertEqual(self.sinalizar().status_code, status.HTTP_403_FORBIDDEN)

    def test_aluno_nao_sinaliza_entrega_de_outro(self):
        criar_versao(self.entrega)
        self.client.force_authenticate(self.outro_aluno())
        resposta = self.sinalizar()
        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)
        self.entrega.refresh_from_db()
        self.assertEqual(self.entrega.estado, EstadoEntrega.RASCUNHO)

    def test_sem_login_nao_sinaliza(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.sinalizar().status_code, status.HTTP_401_UNAUTHORIZED)

    def test_entrega_inexistente(self):
        resposta = self.client.post(reverse("sinalizar-pronta", args=[99999]))
        self.assertEqual(resposta.status_code, status.HTTP_404_NOT_FOUND)
