"""
Admin do Django: o log de eventos e os comentários só se consultam.

RN14 — comentário nunca é editado nem removido. RNF12 — o histórico de eventos
é só de inclusão. O /admin é a outra porta de entrada para os dados, então ele
também não pode criar, alterar nem apagar esses dois registros.
"""
from datetime import timedelta

from django.conf import settings
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from core.models import (
    Comentario,
    Entrega,
    EstadoEntrega,
    Evento,
    Orientacao,
    Perfil,
    TCC,
    TipoEvento,
    Usuario,
    Versao,
)


# Em produção os estáticos do admin saem de um manifesto gerado pelo collectstatic;
# no teste ele não existe, então as páginas do admin usam o armazenamento simples.
@override_settings(
    STORAGES={
        **settings.STORAGES,
        "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
    }
)
class AdminSomenteLeituraTests(TestCase):
    def setUp(self):
        self.admin = Usuario.objects.create_superuser(
            email="admin@sgtcc.test", nome="Administrador", senha="senhaForte123"
        )
        aluno = Usuario.objects.create_user(
            email="lucas@aluno.edu.br", nome="Lucas", senha="senhaForte123", perfil=Perfil.ALUNO
        )
        self.orientador = Usuario.objects.create_user(
            email="marcos@prof.edu.br", nome="Marcos", senha="senhaForte123",
            perfil=Perfil.ORIENTADOR,
        )
        self.tcc = TCC.objects.create(aluno=aluno)
        Orientacao.objects.create(tcc=self.tcc, orientador=self.orientador)
        self.entrega = Entrega.objects.create(
            tcc=self.tcc, titulo="Capítulo 1", prazo=timezone.localdate() + timedelta(days=30),
            estado=EstadoEntrega.CORRECAO_SOLICITADA,
        )
        self.versao = Versao.objects.create(
            entrega=self.entrega, numero=1, arquivo="tcc/1/v1.pdf", nome_original="v1.pdf",
            tamanho=1, enviado_por=aluno,
        )
        self.evento = Evento.objects.create(
            tcc=self.tcc, tipo=TipoEvento.CORRECAO_SOLICITADA, descricao="Correção solicitada.",
            usuario_relacionado=self.orientador, entrega=self.entrega,
        )
        self.comentario = Comentario.objects.create(
            entrega=self.entrega, versao=self.versao, autor=self.orientador,
            texto="Revise a fundamentação.",
        )
        self.client.force_login(self.admin)

    def test_listagens_de_evento_e_comentario_abrem(self):
        for modelo in ("evento", "comentario"):
            with self.subTest(modelo=modelo):
                resposta = self.client.get(reverse(f"admin:core_{modelo}_changelist"))
                self.assertEqual(resposta.status_code, 200)

    def test_o_comentario_aparece_na_listagem_com_autor_e_versao(self):
        resposta = self.client.get(reverse("admin:core_comentario_changelist"))
        self.assertContains(resposta, "Marcos")
        self.assertContains(resposta, "Capítulo 1")

    def test_nao_ha_como_criar_pelo_admin(self):
        for modelo in ("evento", "comentario"):
            with self.subTest(modelo=modelo):
                resposta = self.client.get(reverse(f"admin:core_{modelo}_add"))
                self.assertEqual(resposta.status_code, 403)

    def test_nao_ha_como_alterar_pelo_admin(self):
        resposta = self.client.post(
            reverse("admin:core_comentario_change", args=[self.comentario.pk]),
            {"texto": "Texto trocado à mão."},
        )
        self.assertEqual(resposta.status_code, 403)
        resposta = self.client.post(
            reverse("admin:core_evento_change", args=[self.evento.pk]),
            {"descricao": "Descrição trocada à mão."},
        )
        self.assertEqual(resposta.status_code, 403)

        self.comentario.refresh_from_db()
        self.evento.refresh_from_db()
        self.assertEqual(self.comentario.texto, "Revise a fundamentação.")
        self.assertEqual(self.evento.descricao, "Correção solicitada.")

    def test_nao_ha_como_apagar_pelo_admin(self):
        for modelo, objeto in (("evento", self.evento), ("comentario", self.comentario)):
            with self.subTest(modelo=modelo):
                url = reverse(f"admin:core_{modelo}_delete", args=[objeto.pk])
                self.assertEqual(self.client.get(url).status_code, 403)
                self.assertEqual(self.client.post(url, {"post": "yes"}).status_code, 403)
        self.assertTrue(Comentario.objects.filter(pk=self.comentario.pk).exists())
        self.assertTrue(Evento.objects.filter(pk=self.evento.pk).exists())

    def test_apagar_o_tcc_pelo_admin_nao_leva_eventos_e_comentarios_junto(self):
        """O admin barra a exclusão em cascata: o TCC tem eventos, que ele não pode apagar."""
        url = reverse("admin:core_tcc_delete", args=[self.tcc.pk])

        self.assertEqual(self.client.post(url, {"post": "yes"}).status_code, 403)

        self.assertTrue(TCC.objects.filter(pk=self.tcc.pk).exists())
        self.assertTrue(Evento.objects.filter(pk=self.evento.pk).exists())
        self.assertTrue(Comentario.objects.filter(pk=self.comentario.pk).exists())

    def test_apagar_a_entrega_pelo_admin_nao_leva_os_comentarios_junto(self):
        url = reverse("admin:core_entrega_delete", args=[self.entrega.pk])

        self.assertEqual(self.client.post(url, {"post": "yes"}).status_code, 403)

        self.assertTrue(Entrega.objects.filter(pk=self.entrega.pk).exists())
        self.assertTrue(Comentario.objects.filter(pk=self.comentario.pk).exists())

    def test_apagar_o_orientador_autor_de_um_comentario_e_barrado(self):
        """O autor do comentário é protegido no banco (PROTECT)."""
        url = reverse("admin:core_usuario_delete", args=[self.orientador.pk])

        self.client.post(url, {"post": "yes"})

        self.assertTrue(Usuario.objects.filter(pk=self.orientador.pk).exists())
        self.assertTrue(Comentario.objects.filter(pk=self.comentario.pk).exists())

    def test_a_consulta_de_um_registro_continua_possivel(self):
        resposta = self.client.get(
            reverse("admin:core_comentario_change", args=[self.comentario.pk])
        )
        self.assertEqual(resposta.status_code, 200)
        self.assertContains(resposta, "Revise a fundamentação.")

    def test_a_listagem_de_versoes_continua_funcionando(self):
        resposta = self.client.get(reverse("admin:core_versao_changelist"))
        self.assertEqual(resposta.status_code, 200)
