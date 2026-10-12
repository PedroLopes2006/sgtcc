"""Criação do superusuário por variáveis de ambiente, durante o build."""
from io import StringIO
from unittest import mock

from django.core.management import call_command
from django.test import TestCase

from core.models import Perfil, Usuario


class CriarAdminTests(TestCase):
    def _rodar(self, **ambiente):
        saida = StringIO()
        with mock.patch.dict("os.environ", ambiente, clear=False):
            call_command("criar_admin", stdout=saida)
        return saida.getvalue()

    def test_cria_o_superusuario_a_partir_do_ambiente(self):
        self._rodar(ADMIN_EMAIL="admin@sgtcc.edu.br", ADMIN_PASSWORD="senhaForte123")

        admin = Usuario.objects.get(email="admin@sgtcc.edu.br")
        self.assertTrue(admin.is_superuser)
        self.assertTrue(admin.is_staff)
        self.assertTrue(admin.check_password("senhaForte123"))

    def test_sem_as_variaveis_nao_faz_nada(self):
        with mock.patch.dict("os.environ", {}, clear=True):
            call_command("criar_admin", stdout=StringIO())
        self.assertEqual(Usuario.objects.count(), 0)

    def test_rodar_de_novo_nao_duplica_nem_quebra(self):
        """Idempotente: o build roda a cada deploy."""
        self._rodar(ADMIN_EMAIL="admin@sgtcc.edu.br", ADMIN_PASSWORD="senhaForte123")
        self._rodar(ADMIN_EMAIL="admin@sgtcc.edu.br", ADMIN_PASSWORD="outraSenha456")

        self.assertEqual(Usuario.objects.filter(email="admin@sgtcc.edu.br").count(), 1)
        admin = Usuario.objects.get(email="admin@sgtcc.edu.br")
        self.assertTrue(admin.check_password("outraSenha456"))

    def test_email_e_normalizado(self):
        self._rodar(ADMIN_EMAIL="  Admin@SGTCC.edu.br  ", ADMIN_PASSWORD="senhaForte123")
        self.assertTrue(Usuario.objects.filter(email="admin@sgtcc.edu.br").exists())


class CreateSuperuserTests(TestCase):
    """O comando nativo do Django também precisa funcionar, para uso local."""

    def test_createsuperuser_noinput_funciona_com_o_modelo_customizado(self):
        call_command(
            "createsuperuser",
            interactive=False,
            email="local@sgtcc.edu.br",
            nome="Admin Local",
            perfil=Perfil.ORIENTADOR,
            stdout=StringIO(),
        )
        admin = Usuario.objects.get(email="local@sgtcc.edu.br")
        self.assertTrue(admin.is_superuser)
        # Sem senha informada: senha inutilizável, nunca em branco.
        self.assertFalse(admin.has_usable_password())

    def test_createsuperuser_aceita_a_senha_pela_variavel_do_django(self):
        with mock.patch.dict("os.environ", {"DJANGO_SUPERUSER_PASSWORD": "senhaForte123"}):
            call_command(
                "createsuperuser",
                interactive=False,
                email="local2@sgtcc.edu.br",
                nome="Admin Local",
                perfil=Perfil.ORIENTADOR,
                stdout=StringIO(),
            )
        admin = Usuario.objects.get(email="local2@sgtcc.edu.br")
        self.assertTrue(admin.check_password("senhaForte123"))
