"""
EXTRA — fora dos requisitos do documento: o usuário troca o próprio e-mail de login.

Pede a senha atual (RNF03), segue as regras do cadastro (minúsculas e sem repetir
o e-mail de outra conta, US01 CA2) e não mexe em perfil nem no TCC (RNF04).
"""
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from core.models import Perfil, TCC, TentativaLogin, Usuario
from core.services import LIMITE_TENTATIVAS_LOGIN


class AlterarEmailTests(APITestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create_user(
            email="lucas@aluno.edu.br", nome="Lucas", senha="senhaForte123", perfil=Perfil.ALUNO
        )
        self.outro = Usuario.objects.create_user(
            email="ana@aluno.edu.br", nome="Ana", senha="senhaForte123", perfil=Perfil.ALUNO
        )
        self.client.force_authenticate(self.usuario)

    def trocar(self, email, senha="senhaForte123"):
        return self.client.post(
            reverse("alterar-email"), {"email": email, "senha_atual": senha}, format="json"
        )

    def test_troca_o_email_e_devolve_a_conta_atualizada(self):
        resposta = self.trocar("  Lucas.Novo@Aluno.edu.br ")

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(resposta.data["email"], "lucas.novo@aluno.edu.br")
        self.usuario.refresh_from_db()
        self.assertEqual(self.usuario.email, "lucas.novo@aluno.edu.br")

    def test_depois_da_troca_o_login_usa_o_novo_email(self):
        self.trocar("novo@aluno.edu.br")
        self.client.force_authenticate(None)

        novo = self.client.post(
            reverse("login"), {"email": "novo@aluno.edu.br", "password": "senhaForte123"}, format="json"
        )
        antigo = self.client.post(
            reverse("login"), {"email": "lucas@aluno.edu.br", "password": "senhaForte123"}, format="json"
        )

        self.assertEqual(novo.status_code, status.HTTP_200_OK)
        self.assertEqual(antigo.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_senha_atual_errada_e_recusada_e_nada_muda(self):
        resposta = self.trocar("novo@aluno.edu.br", senha="errada")

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("senha_atual", resposta.data)
        self.usuario.refresh_from_db()
        self.assertEqual(self.usuario.email, "lucas@aluno.edu.br")

    def test_email_de_outra_conta_e_recusado_sem_diferenciar_maiusculas(self):
        """US01 CA2."""
        resposta = self.trocar("ANA@aluno.edu.br")

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", resposta.data)

    def test_email_invalido_ou_igual_ao_atual_e_recusado(self):
        self.assertEqual(self.trocar("isso-nao-e-email").status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.trocar("").status_code, status.HTTP_400_BAD_REQUEST)
        igual = self.trocar("LUCAS@aluno.edu.br")
        self.assertEqual(igual.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", igual.data)

    def test_perfil_e_tcc_continuam_os_mesmos(self):
        """RNF04."""
        tcc = TCC.objects.create(aluno=self.usuario)

        self.trocar("novo@aluno.edu.br")

        self.usuario.refresh_from_db()
        self.assertEqual(self.usuario.perfil, Perfil.ALUNO)
        tcc.refresh_from_db()
        self.assertEqual(tcc.aluno_id, self.usuario.id)

    def test_errar_a_senha_demais_bloqueia_o_login_da_conta(self):
        """Adivinhar a senha por esta rota conta no mesmo limite do login."""
        for _ in range(LIMITE_TENTATIVAS_LOGIN):
            self.trocar("novo@aluno.edu.br", senha="errada")

        self.assertTrue(TentativaLogin.objects.filter(email="lucas@aluno.edu.br").exists())
        bloqueada = self.trocar("novo@aluno.edu.br")  # até com a senha certa
        self.assertEqual(bloqueada.status_code, status.HTTP_400_BAD_REQUEST)
        self.usuario.refresh_from_db()
        self.assertEqual(self.usuario.email, "lucas@aluno.edu.br")

    def test_exige_estar_logado(self):
        self.client.force_authenticate(None)

        self.assertEqual(self.trocar("novo@aluno.edu.br").status_code, status.HTTP_401_UNAUTHORIZED)
