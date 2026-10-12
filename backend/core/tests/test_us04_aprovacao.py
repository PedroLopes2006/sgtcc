"""US04 — Aprovar ou ajustar tema."""
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from core.models import Orientacao, Perfil, StatusTema, TCC, Tema, TipoEvento, Usuario


class AprovacaoDeTemaTests(APITestCase):
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
        self.client.force_authenticate(self.orientador)

    def test_ca1_aprovacao_muda_status_e_registra_data(self):
        resposta = self.client.post(reverse("aprovar-tema", args=[self.tema.id]))

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.tema.refresh_from_db()
        self.assertEqual(self.tema.status, StatusTema.APROVADO)
        self.assertIsNotNone(self.tema.data_aprovacao)

    def test_ca2_solicitar_ajuste_muda_status_e_guarda_justificativa(self):
        resposta = self.client.post(
            reverse("solicitar-ajuste-tema", args=[self.tema.id]),
            {"justificativa": "O escopo está amplo demais para 2,5 meses."},
            format="json",
        )

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.tema.refresh_from_db()
        self.assertEqual(self.tema.status, StatusTema.AJUSTE_SOLICITADO)
        self.assertIn("amplo demais", self.tema.justificativa_ajuste)

    def test_ca2_justificativa_e_obrigatoria(self):
        """RN07."""
        vazia = self.client.post(
            reverse("solicitar-ajuste-tema", args=[self.tema.id]),
            {"justificativa": "   "},
            format="json",
        )
        ausente = self.client.post(
            reverse("solicitar-ajuste-tema", args=[self.tema.id]), {}, format="json"
        )

        self.assertEqual(vazia.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(ausente.status_code, status.HTTP_400_BAD_REQUEST)
        self.tema.refresh_from_db()
        self.assertEqual(self.tema.status, StatusTema.PROPOSTO)

    def test_ca3_mudanca_de_status_gera_evento_para_notificar_o_aluno(self):
        self.client.post(reverse("aprovar-tema", args=[self.tema.id]))
        self.assertTrue(self.tcc.eventos.filter(tipo=TipoEvento.TEMA_APROVADO).exists())

    def test_ca3_ajuste_tambem_gera_evento(self):
        self.client.post(
            reverse("solicitar-ajuste-tema", args=[self.tema.id]),
            {"justificativa": "Delimite o escopo."},
            format="json",
        )
        self.assertTrue(self.tcc.eventos.filter(tipo=TipoEvento.TEMA_AJUSTE_SOLICITADO).exists())

    def test_tema_ja_aprovado_nao_e_aprovado_de_novo(self):
        self.client.post(reverse("aprovar-tema", args=[self.tema.id]))
        segunda = self.client.post(reverse("aprovar-tema", args=[self.tema.id]))
        self.assertEqual(segunda.status_code, status.HTTP_400_BAD_REQUEST)

    def test_rn05_somente_o_orientador_ativo_decide(self):
        outro_orientador = Usuario.objects.create_user(
            email="outro@prof.edu.br", nome="Outro", senha="senhaForte123",
            perfil=Perfil.ORIENTADOR,
        )
        self.client.force_authenticate(outro_orientador)
        resposta = self.client.post(reverse("aprovar-tema", args=[self.tema.id]))

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)
        self.tema.refresh_from_db()
        self.assertEqual(self.tema.status, StatusTema.PROPOSTO)

    def test_rnf04_aluno_nao_aprova_o_proprio_tema(self):
        self.client.force_authenticate(self.aluno)
        resposta = self.client.post(reverse("aprovar-tema", args=[self.tema.id]))
        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)

    def test_fila_de_temas_pendentes_mostra_apenas_os_proprios_orientandos(self):
        outro_aluno = Usuario.objects.create_user(
            email="ana@aluno.edu.br", nome="Ana", senha="senhaForte123", perfil=Perfil.ALUNO
        )
        outro_orientador = Usuario.objects.create_user(
            email="paula@prof.edu.br", nome="Paula", senha="senhaForte123",
            perfil=Perfil.ORIENTADOR,
        )
        outro_tcc = TCC.objects.create(aluno=outro_aluno)
        Tema.objects.create(
            tcc=outro_tcc, titulo="Outro tema", descricao="...", status=StatusTema.PROPOSTO
        )
        Orientacao.objects.create(tcc=outro_tcc, orientador=outro_orientador)

        resposta = self.client.get(reverse("temas-pendentes"))
        self.assertEqual(len(resposta.data), 1)
        self.assertEqual(resposta.data[0]["titulo"], "Gestão de TCC")


class CicloAjusteReaprovacaoTests(APITestCase):
    """O ciclo completo descrito na US03 CA4 + US04 CA1."""

    def setUp(self):
        self.aluno = Usuario.objects.create_user(
            email="lucas@aluno.edu.br", nome="Lucas", senha="senhaForte123", perfil=Perfil.ALUNO
        )
        self.orientador = Usuario.objects.create_user(
            email="marcos@prof.edu.br", nome="Marcos", senha="senhaForte123",
            perfil=Perfil.ORIENTADOR,
        )

    def test_propor_ajustar_reenviar_aprovar(self):
        self.client.force_authenticate(self.aluno)
        proposta = self.client.post(
            reverse("propor-tema"),
            {"titulo": "Tema v1", "descricao": "Descrição v1", "orientador_id": self.orientador.id},
            format="json",
        )
        tema_id = proposta.data["id"]

        self.client.force_authenticate(self.orientador)
        self.client.post(
            reverse("solicitar-ajuste-tema", args=[tema_id]),
            {"justificativa": "Refaça o recorte."},
            format="json",
        )

        self.client.force_authenticate(self.aluno)
        self.client.post(
            reverse("reenviar-tema", args=[tema_id]),
            {"titulo": "Tema v2", "descricao": "Recorte refeito."},
            format="json",
        )

        self.client.force_authenticate(self.orientador)
        final = self.client.post(reverse("aprovar-tema", args=[tema_id]))

        self.assertEqual(final.status_code, status.HTTP_200_OK)
        tema = Tema.objects.get(id=tema_id)
        self.assertEqual(tema.status, StatusTema.APROVADO)
        self.assertEqual(tema.titulo, "Tema v2")
        # RN10 — cada passo deixou rastro no log.
        self.assertEqual(tema.tcc.eventos.count(), 4)
