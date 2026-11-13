"""
EXTRA — fora dos requisitos do documento: limite de 8 tentativas de login.

Dificulta adivinhar senha (RNF03). A resposta não revela se o e-mail existe (US01 CA4).
"""
from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from core.models import Perfil, TentativaLogin, Usuario
from core.services import LIMITE_TENTATIVAS_LOGIN


class LimiteDeTentativasDeLoginTests(APITestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create_user(
            email="lucas@aluno.edu.br", nome="Lucas", senha="senhaForte123", perfil=Perfil.ALUNO
        )

    def entrar(self, senha, email="lucas@aluno.edu.br"):
        return self.client.post(reverse("login"), {"email": email, "password": senha}, format="json")

    def errar(self, vezes, email="lucas@aluno.edu.br"):
        for _ in range(vezes):
            self.assertEqual(self.entrar("errada", email).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_o_limite_e_de_8(self):
        self.assertEqual(LIMITE_TENTATIVAS_LOGIN, 8)

    def test_depois_de_8_erros_o_login_fica_bloqueado_ate_com_a_senha_certa(self):
        self.errar(LIMITE_TENTATIVAS_LOGIN)

        resposta = self.entrar("senhaForte123")

        self.assertEqual(resposta.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn("Muitas tentativas", resposta.data["detail"])

    def test_com_menos_de_8_erros_a_senha_certa_ainda_entra(self):
        self.errar(LIMITE_TENTATIVAS_LOGIN - 1)

        self.assertEqual(self.entrar("senhaForte123").status_code, status.HTTP_200_OK)

    def test_login_certo_zera_a_contagem(self):
        self.errar(LIMITE_TENTATIVAS_LOGIN - 1)
        self.entrar("senhaForte123")
        self.errar(LIMITE_TENTATIVAS_LOGIN - 1)

        self.assertEqual(self.entrar("senhaForte123").status_code, status.HTTP_200_OK)

    def test_passado_o_tempo_o_login_volta(self):
        self.errar(LIMITE_TENTATIVAS_LOGIN)
        TentativaLogin.objects.update(bloqueado_ate=timezone.now() - timedelta(seconds=1))

        self.assertEqual(self.entrar("senhaForte123").status_code, status.HTTP_200_OK)

    def test_e_mail_que_nao_existe_e_bloqueado_do_mesmo_jeito(self):
        """US01 CA4: ninguém descobre quais e-mails estão cadastrados."""
        self.errar(LIMITE_TENTATIVAS_LOGIN, email="ninguem@aluno.edu.br")

        resposta = self.entrar("qualquer", email="ninguem@aluno.edu.br")

        self.assertEqual(resposta.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_o_bloqueio_vale_para_o_e_mail_e_nao_atrapalha_os_outros(self):
        self.errar(LIMITE_TENTATIVAS_LOGIN)
        outro = Usuario.objects.create_user(
            email="ana@aluno.edu.br", nome="Ana", senha="senhaForte123", perfil=Perfil.ALUNO
        )

        self.assertEqual(self.entrar("senhaForte123", email=outro.email).status_code, 200)

    def test_maiusculas_e_espacos_no_e_mail_contam_como_o_mesmo(self):
        self.errar(LIMITE_TENTATIVAS_LOGIN, email="  LUCAS@aluno.edu.br ")

        self.assertEqual(self.entrar("senhaForte123").status_code, status.HTTP_429_TOO_MANY_REQUESTS)
