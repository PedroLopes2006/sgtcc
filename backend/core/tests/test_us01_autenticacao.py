"""US01 — Cadastro e login."""
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from core.models import Perfil, Usuario


class CadastroTests(APITestCase):
    def test_ca1_cadastro_cria_conta_e_permite_login(self):
        resposta = self.client.post(
            reverse("registrar"),
            {
                "nome": "Lucas Andrade",
                "email": "lucas@aluno.edu.br",
                "senha": "senhaForte123",
                "perfil": Perfil.ALUNO,
            },
            format="json",
        )
        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Usuario.objects.filter(email="lucas@aluno.edu.br").exists())

        login = self.client.post(
            reverse("login"),
            {"email": "lucas@aluno.edu.br", "password": "senhaForte123"},
            format="json",
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK)
        self.assertIn("access", login.data)

    def test_ca1_senha_nunca_e_salva_em_texto_plano(self):
        """RNF03."""
        self.client.post(
            reverse("registrar"),
            {
                "nome": "Lucas",
                "email": "lucas2@aluno.edu.br",
                "senha": "senhaForte123",
                "perfil": Perfil.ALUNO,
            },
            format="json",
        )
        usuario = Usuario.objects.get(email="lucas2@aluno.edu.br")
        self.assertNotEqual(usuario.password, "senhaForte123")
        self.assertTrue(usuario.check_password("senhaForte123"))

    def test_ca2_email_duplicado_e_bloqueado(self):
        dados = {
            "nome": "Lucas",
            "email": "repetido@aluno.edu.br",
            "senha": "senhaForte123",
            "perfil": Perfil.ALUNO,
        }
        self.client.post(reverse("registrar"), dados, format="json")
        segunda = self.client.post(reverse("registrar"), dados, format="json")

        self.assertEqual(segunda.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", segunda.data)
        self.assertEqual(Usuario.objects.filter(email="repetido@aluno.edu.br").count(), 1)


class LoginTests(APITestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create_user(
            email="marcos@prof.edu.br",
            nome="Marcos Ribeiro",
            senha="senhaForte123",
            perfil=Perfil.ORIENTADOR,
        )

    def test_ca3_credenciais_corretas_retornam_perfil_para_direcionar_o_painel(self):
        resposta = self.client.post(
            reverse("login"),
            {"email": "marcos@prof.edu.br", "password": "senhaForte123"},
            format="json",
        )
        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(resposta.data["usuario"]["perfil"], Perfil.ORIENTADOR)

    def test_ca4_credenciais_invalidas_exibem_erro_generico(self):
        senha_errada = self.client.post(
            reverse("login"),
            {"email": "marcos@prof.edu.br", "password": "errada123456"},
            format="json",
        )
        email_inexistente = self.client.post(
            reverse("login"),
            {"email": "ninguem@prof.edu.br", "password": "errada123456"},
            format="json",
        )

        self.assertEqual(senha_errada.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(email_inexistente.status_code, status.HTTP_401_UNAUTHORIZED)
        # A mensagem é a mesma nos dois casos: não revela se o e-mail existe.
        self.assertEqual(
            str(senha_errada.data["detail"]), str(email_inexistente.data["detail"])
        )
