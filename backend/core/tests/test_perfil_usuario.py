"""
Dados do usuário logado para a tela de Perfil: `GET /api/auth/eu/`.

A tela mostra nome, e-mail, perfil, "Membro desde" e se o Telegram está
vinculado. A senha nunca sai da API (RNF03). A troca de nome e de senha é um EXTRA
e tem testes próprios (`test_extra_perfil_editavel.py`).
"""
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from core.models import Perfil, Usuario


class PerfilDoUsuarioTests(APITestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create_user(
            email="lucas@aluno.edu.br", nome="Lucas Andrade", senha="senhaForte123",
            perfil=Perfil.ALUNO,
        )

    def test_traz_os_dados_da_conta_incluindo_desde_quando_ela_existe(self):
        self.client.force_authenticate(self.usuario)

        resposta = self.client.get(reverse("eu"))

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(resposta.data["nome"], "Lucas Andrade")
        self.assertEqual(resposta.data["email"], "lucas@aluno.edu.br")
        self.assertEqual(resposta.data["perfil"], Perfil.ALUNO)
        self.assertIsNone(resposta.data["telegram_chat_id"])
        self.assertIn("data_cadastro", resposta.data)

    def test_a_senha_nunca_sai_da_api(self):
        """RNF03."""
        self.client.force_authenticate(self.usuario)

        resposta = self.client.get(reverse("eu"))

        self.assertNotIn("password", resposta.data)
        self.assertNotIn("senha", resposta.data)

    def test_o_login_tambem_devolve_desde_quando_a_conta_existe(self):
        resposta = self.client.post(
            reverse("login"),
            {"email": "lucas@aluno.edu.br", "password": "senhaForte123"},
            format="json",
        )
        self.assertIn("data_cadastro", resposta.data["usuario"])

    def test_sem_login_nao_ha_perfil(self):
        self.assertEqual(self.client.get(reverse("eu")).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_so_o_nome_pode_ser_alterado_nesta_rota(self):
        """O nome ganhou edição (EXTRA); os outros métodos continuam recusados."""
        self.client.force_authenticate(self.usuario)
        for metodo in ("post", "put", "delete"):
            with self.subTest(metodo=metodo):
                resposta = getattr(self.client, metodo)(
                    reverse("eu"), {"nome": "Outro nome"}, format="json"
                )
                self.assertEqual(resposta.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.usuario.refresh_from_db()
        self.assertEqual(self.usuario.nome, "Lucas Andrade")
