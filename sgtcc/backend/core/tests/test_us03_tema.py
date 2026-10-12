"""US03 — Propor tema e indicar orientador."""
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from core.models import Orientacao, Perfil, StatusTema, TCC, Tema, TipoEvento, Usuario


class ProporTemaTests(APITestCase):
    def setUp(self):
        self.aluno = Usuario.objects.create_user(
            email="lucas@aluno.edu.br", nome="Lucas Andrade",
            senha="senhaForte123", perfil=Perfil.ALUNO,
        )
        self.orientador = Usuario.objects.create_user(
            email="marcos@prof.edu.br", nome="Marcos Ribeiro",
            senha="senhaForte123", perfil=Perfil.ORIENTADOR,
        )
        self.client.force_authenticate(self.aluno)

    def test_ca1_cria_tcc_tema_proposto_e_orientacao_ativa(self):
        resposta = self.client.post(
            reverse("propor-tema"),
            {
                "titulo": "Gestão de TCC com Django",
                "descricao": "Sistema web para acompanhar entregas e revisões.",
                "orientador_id": self.orientador.id,
            },
            format="json",
        )

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resposta.data["status"], StatusTema.PROPOSTO)

        tcc = TCC.objects.get(aluno=self.aluno)
        self.assertEqual(tcc.tema.titulo, "Gestão de TCC com Django")

        orientacao = Orientacao.objects.get(tcc=tcc)
        self.assertTrue(orientacao.ativa)
        self.assertEqual(orientacao.orientador, self.orientador)
        self.assertIsNone(orientacao.data_fim)

    def test_ca2_proposta_registra_o_gatilho_de_notificacao_do_orientador(self):
        """A notificação em si é da fase do Telegram; aqui o Evento é gravado (RN10)."""
        self.client.post(
            reverse("propor-tema"),
            {"titulo": "Tema", "descricao": "Descrição", "orientador_id": self.orientador.id},
            format="json",
        )
        tcc = TCC.objects.get(aluno=self.aluno)
        evento = tcc.eventos.get(tipo=TipoEvento.TEMA_PROPOSTO)
        self.assertIn(self.orientador.nome, evento.descricao)

    def test_ca3_sem_orientador_o_sistema_exige_a_escolha(self):
        resposta = self.client.post(
            reverse("propor-tema"),
            {"titulo": "Tema", "descricao": "Descrição"},
            format="json",
        )
        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("orientador_id", resposta.data)
        self.assertFalse(TCC.objects.filter(aluno=self.aluno).exists())

    def test_orientador_inexistente_e_rejeitado(self):
        resposta = self.client.post(
            reverse("propor-tema"),
            {"titulo": "Tema", "descricao": "Descrição", "orientador_id": 9999},
            format="json",
        )
        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test_rn01_aluno_nao_propoe_dois_tccs(self):
        dados = {"titulo": "Tema", "descricao": "Descrição", "orientador_id": self.orientador.id}
        self.client.post(reverse("propor-tema"), dados, format="json")
        segunda = self.client.post(reverse("propor-tema"), dados, format="json")

        self.assertEqual(segunda.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(TCC.objects.filter(aluno=self.aluno).count(), 1)

    def test_rnf04_orientador_nao_propoe_tema(self):
        self.client.force_authenticate(self.orientador)
        resposta = self.client.post(
            reverse("propor-tema"),
            {"titulo": "Tema", "descricao": "Descrição", "orientador_id": self.orientador.id},
            format="json",
        )
        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)


class ReenviarTemaTests(APITestCase):
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
            tcc=self.tcc, titulo="Título original", descricao="Descrição original",
            status=StatusTema.AJUSTE_SOLICITADO, justificativa_ajuste="Delimite melhor o escopo.",
        )
        Orientacao.objects.create(tcc=self.tcc, orientador=self.orientador)
        self.client.force_authenticate(self.aluno)

    def test_ca4_correcao_devolve_o_mesmo_tema_ao_status_proposto(self):
        resposta = self.client.post(
            reverse("reenviar-tema", args=[self.tema.id]),
            {"titulo": "Título corrigido", "descricao": "Escopo delimitado."},
            format="json",
        )

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.tema.refresh_from_db()
        self.assertEqual(self.tema.status, StatusTema.PROPOSTO)
        self.assertEqual(self.tema.titulo, "Título corrigido")
        self.assertEqual(self.tema.justificativa_ajuste, "")
        # É o mesmo Tema, não um novo registro.
        self.assertEqual(Tema.objects.count(), 1)

    def test_ca4_registra_evento_de_reenvio(self):
        self.client.post(
            reverse("reenviar-tema", args=[self.tema.id]),
            {"titulo": "Título corrigido", "descricao": "Escopo delimitado."},
            format="json",
        )
        self.assertTrue(self.tcc.eventos.filter(tipo=TipoEvento.TEMA_REENVIADO).exists())

    def test_tema_proposto_nao_pode_ser_reenviado(self):
        self.tema.status = StatusTema.PROPOSTO
        self.tema.save()
        resposta = self.client.post(
            reverse("reenviar-tema", args=[self.tema.id]),
            {"titulo": "Outro", "descricao": "Outra"},
            format="json",
        )
        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test_aluno_nao_reenvia_tema_de_outro(self):
        outro = Usuario.objects.create_user(
            email="outro@aluno.edu.br", nome="Outro", senha="senhaForte123", perfil=Perfil.ALUNO
        )
        self.client.force_authenticate(outro)
        resposta = self.client.post(
            reverse("reenviar-tema", args=[self.tema.id]),
            {"titulo": "Invasão", "descricao": "Não deve passar."},
            format="json",
        )
        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)
