"""
EXTRA — fora dos requisitos do documento: o usuário troca o próprio nome e a senha.

E-mail e perfil não mudam (RNF04). A senha é conferida e guardada só como hash (RNF03).
"""
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from core.models import Perfil, Usuario


class PerfilEditavelTests(APITestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create_user(
            email="lucas@aluno.edu.br", nome="Lucas Andrade", senha="senhaForte123",
            perfil=Perfil.ALUNO,
        )
        self.client.force_authenticate(self.usuario)

    def test_troca_o_nome(self):
        resposta = self.client.patch(reverse("eu"), {"nome": "  Lucas A. Silva "}, format="json")

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(resposta.data["nome"], "Lucas A. Silva")
        self.usuario.refresh_from_db()
        self.assertEqual(self.usuario.nome, "Lucas A. Silva")

    def test_nome_vazio_e_recusado(self):
        resposta = self.client.patch(reverse("eu"), {"nome": "   "}, format="json")

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.usuario.refresh_from_db()
        self.assertEqual(self.usuario.nome, "Lucas Andrade")

    def test_e_mail_e_perfil_nao_mudam_por_aqui(self):
        """RNF04."""
        self.client.patch(
            reverse("eu"),
            {"nome": "Outro", "email": "outro@x.com", "perfil": Perfil.ORIENTADOR},
            format="json",
        )

        self.usuario.refresh_from_db()
        self.assertEqual(self.usuario.email, "lucas@aluno.edu.br")
        self.assertEqual(self.usuario.perfil, Perfil.ALUNO)

    def test_troca_a_senha_e_guarda_so_o_hash(self):
        """RNF03."""
        resposta = self.client.post(
            reverse("alterar-senha"),
            {"senha_atual": "senhaForte123", "nova_senha": "OutraSenha456"},
            format="json",
        )

        self.assertEqual(resposta.status_code, status.HTTP_204_NO_CONTENT)
        self.usuario.refresh_from_db()
        self.assertTrue(self.usuario.check_password("OutraSenha456"))
        self.assertNotEqual(self.usuario.password, "OutraSenha456")

    def test_senha_atual_errada_e_recusada(self):
        resposta = self.client.post(
            reverse("alterar-senha"),
            {"senha_atual": "errada", "nova_senha": "OutraSenha456"},
            format="json",
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("senha_atual", resposta.data)
        self.usuario.refresh_from_db()
        self.assertTrue(self.usuario.check_password("senhaForte123"))

    def test_nova_senha_curta_ou_igual_a_atual_e_recusada(self):
        curta = self.client.post(
            reverse("alterar-senha"),
            {"senha_atual": "senhaForte123", "nova_senha": "curta1"},
            format="json",
        )
        igual = self.client.post(
            reverse("alterar-senha"),
            {"senha_atual": "senhaForte123", "nova_senha": "senhaForte123"},
            format="json",
        )

        self.assertEqual(curta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("nova_senha", curta.data)
        self.assertEqual(igual.status_code, status.HTTP_400_BAD_REQUEST)

    def test_exige_estar_logado(self):
        self.client.force_authenticate(None)

        self.assertEqual(
            self.client.patch(reverse("eu"), {"nome": "X"}, format="json").status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
        self.assertEqual(
            self.client.post(reverse("alterar-senha"), {}, format="json").status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
