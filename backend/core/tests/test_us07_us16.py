"""US07 — histórico de versões; US16 — linha do tempo do aluno."""
from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status

from core.models import Evento, Perfil, TipoEvento, Usuario
from .base_test import BaseEntregaTests, criar_versao


class HistoricoVersoesTests(BaseEntregaTests):
    def setUp(self):
        super().setUp()
        self.url = reverse("versoes", args=[self.entrega.pk])

    def test_ca1_lista_todas_as_versoes_em_ordem_cronologica(self):
        mais_recente = criar_versao(self.entrega, numero=2)
        mais_antiga = criar_versao(self.entrega, numero=1)
        agora = timezone.now()
        mais_recente.data_envio = agora
        mais_recente.save(update_fields=["data_envio"])
        mais_antiga.data_envio = agora - timedelta(days=1)
        mais_antiga.save(update_fields=["data_envio"])

        resposta = self.client.get(self.url)

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual([item["numero"] for item in resposta.data], [1, 2])

    def test_ca2_cada_versao_expoe_link_para_o_arquivo(self):
        criar_versao(self.entrega)

        resposta = self.client.get(self.url)

        self.assertTrue(resposta.data[0]["arquivo_url"])
        self.assertEqual(resposta.data[0]["nome_original"], "v1.pdf")

    def test_nao_permite_consultar_versoes_de_entrega_de_outro_aluno(self):
        self.client.force_authenticate(self.outro_aluno())

        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_403_FORBIDDEN)

    def test_rnf04_orientador_e_anonimo_nao_consultam(self):
        self.client.force_authenticate(self.orientador)
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_401_UNAUTHORIZED)


class LinhaDoTempoTests(BaseEntregaTests):
    def setUp(self):
        super().setUp()
        self.url = reverse("eventos")

    def test_ca1_lista_eventos_cronologicamente_com_campos_necessarios(self):
        agora = timezone.now()
        Evento.objects.create(
            tcc=self.tcc,
            tipo=TipoEvento.TEMA_PROPOSTO,
            descricao="Tema enviado para avaliação.",
            data_hora=agora - timedelta(days=1),
        )
        Evento.objects.create(
            tcc=self.tcc,
            tipo=TipoEvento.UPLOAD,
            descricao="Versão 1 enviada.",
            data_hora=agora,
        )

        resposta = self.client.get(self.url)

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual([item["tipo"] for item in resposta.data], ["tema_proposto", "upload"])
        self.assertEqual(resposta.data[0]["descricao"], "Tema enviado para avaliação.")
        self.assertIn("data_hora", resposta.data[0])

    def test_eventos_de_outro_tcc_nao_sao_expostos(self):
        outra = Usuario.objects.create_user(
            email="ana@aluno.edu.br", nome="Ana", senha="senhaForte123", perfil=Perfil.ALUNO
        )
        Evento.objects.create(tcc=self.tcc, tipo=TipoEvento.UPLOAD, descricao="Meu evento")
        self.client.force_authenticate(outra)

        resposta = self.client.get(self.url)

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(resposta.data, [])

    def test_rnf04_orientador_e_anonimo_nao_consultam(self):
        self.client.force_authenticate(self.orientador)
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_401_UNAUTHORIZED)
