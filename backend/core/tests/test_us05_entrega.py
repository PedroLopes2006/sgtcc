"""US05 — Criar entrega."""
from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from core.models import (
    Entrega,
    EstadoEntrega,
    Orientacao,
    Perfil,
    StatusTema,
    TCC,
    Tema,
    TipoEvento,
    Usuario,
)


class CriarEntregaTests(APITestCase):
    def setUp(self):
        self.aluno = Usuario.objects.create_user(
            email="lucas@aluno.edu.br", nome="Lucas", senha="senhaForte123", perfil=Perfil.ALUNO
        )
        self.orientador = Usuario.objects.create_user(
            email="marcos@prof.edu.br", nome="Marcos", senha="senhaForte123",
            perfil=Perfil.ORIENTADOR,
        )
        self.tcc = TCC.objects.create(aluno=self.aluno)
        self.tema = Tema.objects.create(
            tcc=self.tcc, titulo="Gestão de TCC", descricao="Sistema web.",
            status=StatusTema.PROPOSTO,
        )
        Orientacao.objects.create(tcc=self.tcc, orientador=self.orientador)
        self.prazo = (timezone.localdate() + timedelta(days=30)).isoformat()
        self.client.force_authenticate(self.aluno)

    def _aprovar_tema(self):
        self.tema.status = StatusTema.APROVADO
        self.tema.data_aprovacao = timezone.now()
        self.tema.save()

    def test_ca1_entrega_nasce_em_rascunho(self):
        self._aprovar_tema()
        resposta = self.client.post(
            reverse("entregas"),
            {"titulo": "Capítulo 1 — Introdução", "prazo": self.prazo},
            format="json",
        )

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resposta.data["estado"], EstadoEntrega.RASCUNHO)
        entrega = Entrega.objects.get(id=resposta.data["id"])
        self.assertEqual(entrega.tcc, self.tcc)
        self.assertEqual(entrega.titulo, "Capítulo 1 — Introdução")

    def test_ca2_sem_tema_aprovado_o_sistema_impede(self):
        """RN02 — tema ainda em 'proposto'."""
        resposta = self.client.post(
            reverse("entregas"),
            {"titulo": "Capítulo 1", "prazo": self.prazo},
            format="json",
        )
        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Entrega.objects.count(), 0)

    def test_ca2_tema_com_ajuste_solicitado_tambem_impede(self):
        self.tema.status = StatusTema.AJUSTE_SOLICITADO
        self.tema.save()
        resposta = self.client.post(
            reverse("entregas"),
            {"titulo": "Capítulo 1", "prazo": self.prazo},
            format="json",
        )
        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test_aluno_sem_tcc_nao_cria_entrega(self):
        sem_tcc = Usuario.objects.create_user(
            email="novo@aluno.edu.br", nome="Novo", senha="senhaForte123", perfil=Perfil.ALUNO
        )
        self.client.force_authenticate(sem_tcc)
        resposta = self.client.post(
            reverse("entregas"), {"titulo": "Capítulo 1", "prazo": self.prazo}, format="json"
        )
        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test_titulo_e_prazo_sao_obrigatorios(self):
        self._aprovar_tema()
        resposta = self.client.post(reverse("entregas"), {}, format="json")
        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("titulo", resposta.data)
        self.assertIn("prazo", resposta.data)

    def test_criacao_registra_evento(self):
        """RN10."""
        self._aprovar_tema()
        self.client.post(
            reverse("entregas"), {"titulo": "Capítulo 1", "prazo": self.prazo}, format="json"
        )
        self.assertTrue(self.tcc.eventos.filter(tipo=TipoEvento.ENTREGA_CRIADA).exists())

    def test_entrega_nao_recebe_arquivo_neste_sprint(self):
        """A US06 ficou fora do Sprint 3: o endpoint ignora qualquer arquivo enviado."""
        self._aprovar_tema()
        resposta = self.client.post(
            reverse("entregas"),
            {"titulo": "Capítulo 1", "prazo": self.prazo, "arquivo": "tcc.pdf"},
            format="json",
        )
        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        self.assertNotIn("arquivo", resposta.data)

    def test_listagem_traz_apenas_as_entregas_do_proprio_aluno(self):
        self._aprovar_tema()
        self.client.post(
            reverse("entregas"), {"titulo": "Capítulo 1", "prazo": self.prazo}, format="json"
        )

        outro = Usuario.objects.create_user(
            email="ana@aluno.edu.br", nome="Ana", senha="senhaForte123", perfil=Perfil.ALUNO
        )
        outro_tcc = TCC.objects.create(aluno=outro)
        Entrega.objects.create(tcc=outro_tcc, titulo="Capítulo da Ana", prazo=self.prazo)

        resposta = self.client.get(reverse("entregas"))
        self.assertEqual(len(resposta.data), 1)
        self.assertEqual(resposta.data[0]["titulo"], "Capítulo 1")

    def test_rnf04_orientador_nao_cria_entrega(self):
        self._aprovar_tema()
        self.client.force_authenticate(self.orientador)
        resposta = self.client.post(
            reverse("entregas"), {"titulo": "Capítulo 1", "prazo": self.prazo}, format="json"
        )
        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)
