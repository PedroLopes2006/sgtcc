"""
US02 — Vincular Telegram (RF02, RF16, RN11, RNF11).

CA1: o usuário informa o chat_id e ele fica associado ao perfil.
CA2: com chat_id, a notificação gerada vai pelo Telegram.
CA3: sem chat_id, a notificação fica registrada, mas não é enviada.

O Telegram de verdade nunca é chamado: `telegram.enviar_mensagem` é simulado
nos testes de regra, e o `urlopen` nos testes do módulo de envio.
"""
import io
import json
import urllib.error
from unittest import mock

from django.db import transaction
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework import status

from core import services, telegram
from core.models import (
    CanalNotificacao,
    EstadoEntrega,
    Notificacao,
    StatusEnvio,
    TipoEvento,
)

from .base_test import BaseEntregaTests, criar_versao

ENVIO = "core.services.telegram.enviar_mensagem"


class VincularTelegramTests(BaseEntregaTests):
    """CA1 / RF02 — POST /api/auth/telegram/."""

    def vincular(self, chat_id):
        return self.client.post(reverse("vincular-telegram"), {"chat_id": chat_id}, format="json")

    @mock.patch(ENVIO)
    def test_ca1_vincula_o_chat_id_e_manda_mensagem_de_teste(self, envio):
        resposta = self.vincular(" 123456789 ")

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(resposta.data["telegram_chat_id"], "123456789")
        self.assertEqual(resposta.data["teste"], "enviada")
        self.aluno.refresh_from_db()
        self.assertEqual(self.aluno.telegram_chat_id, "123456789")
        envio.assert_called_once()
        self.assertEqual(envio.call_args.args[0], "123456789")
        teste = Notificacao.objects.get(destinatario=self.aluno)
        self.assertIsNone(teste.evento)
        self.assertEqual(teste.status_envio, StatusEnvio.ENVIADA)

    @mock.patch(ENVIO, side_effect=telegram.ErroTelegram("400: Bad Request: chat not found"))
    def test_teste_que_falha_mantem_o_vinculo_e_avisa_a_tela(self, _envio):
        resposta = self.vincular("123456789")

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(resposta.data["teste"], "falhou")
        self.aluno.refresh_from_db()
        self.assertEqual(self.aluno.telegram_chat_id, "123456789")
        teste = Notificacao.objects.get(destinatario=self.aluno)
        self.assertEqual(teste.status_envio, StatusEnvio.FALHOU)
        self.assertIn("chat not found", teste.erro)

    @mock.patch(ENVIO)
    def test_aceita_chat_de_grupo_com_sinal_de_menos(self, _envio):
        resposta = self.vincular("-1001234567890")
        self.assertEqual(resposta.status_code, status.HTTP_200_OK)

    @mock.patch(ENVIO)
    def test_codigo_que_nao_e_numero_e_recusado(self, envio):
        for invalido in ("@lucas", "abc123", "12 34", "1" * 21):
            with self.subTest(invalido=invalido):
                resposta = self.vincular(invalido)
                self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn("chat_id", resposta.data)
        self.aluno.refresh_from_db()
        self.assertIsNone(self.aluno.telegram_chat_id)
        envio.assert_not_called()

    @mock.patch(ENVIO)
    def test_campo_vazio_desvincula(self, envio):
        self.aluno.telegram_chat_id = "123456789"
        self.aluno.save()

        resposta = self.vincular("")

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertIsNone(resposta.data["telegram_chat_id"])
        self.assertIsNone(resposta.data["teste"])
        self.aluno.refresh_from_db()
        self.assertIsNone(self.aluno.telegram_chat_id)
        envio.assert_not_called()

    @mock.patch(ENVIO)
    def test_orientador_tambem_vincula(self, _envio):
        self.client.force_authenticate(self.orientador)
        self.assertEqual(self.vincular("987654321").status_code, status.HTTP_200_OK)
        self.orientador.refresh_from_db()
        self.assertEqual(self.orientador.telegram_chat_id, "987654321")

    def test_exige_login(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.vincular("123456789").status_code, status.HTTP_401_UNAUTHORIZED)

    @override_settings(TELEGRAM_BOT_USERNAME="sgtcc_uvv_bot")
    def test_perfil_informa_o_bot(self):
        resposta = self.client.get(reverse("eu"))
        self.assertEqual(resposta.data["telegram_bot"], "sgtcc_uvv_bot")

    @override_settings(TELEGRAM_BOT_USERNAME="")
    def test_sem_bot_configurado_o_perfil_recebe_nulo(self):
        self.assertIsNone(self.client.get(reverse("eu")).data["telegram_bot"])


class NotificacoesTests(BaseEntregaTests):
    """CA2, CA3, RF16, RN11 e RNF11 — notificações geradas pelos Eventos."""

    def setUp(self):
        super().setUp()
        criar_versao(self.entrega)

    def sinalizar_e_enviar(self):
        with self.captureOnCommitCallbacks(execute=True):
            return self.sinalizar()

    def iniciar_revisao_e_enviar(self):
        self.client.force_authenticate(self.orientador)
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(reverse("iniciar-revisao", args=[self.entrega.id]))

    # ---- CA2

    @mock.patch(ENVIO)
    def test_ca2_orientador_com_telegram_recebe_a_entrega_pronta(self, envio):
        self.orientador.telegram_chat_id = "111"
        self.orientador.save()

        self.sinalizar_e_enviar()

        envio.assert_called_once()
        chat_id, texto = envio.call_args.args
        self.assertEqual(chat_id, "111")
        self.assertIn("Entrega sinalizada como pronta", texto)
        self.assertIn("TCC de Lucas", texto)
        notificacao = Notificacao.objects.get(destinatario=self.orientador)
        self.assertEqual(notificacao.canal, CanalNotificacao.TELEGRAM)
        self.assertEqual(notificacao.status_envio, StatusEnvio.ENVIADA)
        self.assertEqual(notificacao.evento.tipo, TipoEvento.ENTREGA_PRONTA)

    @mock.patch(ENVIO)
    def test_ca2_aluno_com_telegram_recebe_o_inicio_da_revisao(self, envio):
        self.sinalizar()
        self.aluno.telegram_chat_id = "222"
        self.aluno.save()

        self.iniciar_revisao_e_enviar()

        envio.assert_called_once()
        chat_id, texto = envio.call_args.args
        self.assertEqual(chat_id, "222")
        self.assertIn("Entrega em revisão", texto)
        self.assertNotIn("TCC de", texto)

    @mock.patch(ENVIO)
    def test_quem_fez_a_acao_nao_e_notificado(self, envio):
        self.aluno.telegram_chat_id = "222"
        self.aluno.save()

        self.sinalizar_e_enviar()

        self.assertFalse(Notificacao.objects.filter(destinatario=self.aluno).exists())
        envio.assert_not_called()

    def test_orientador_so_e_notificado_do_que_depende_dele(self):
        evento = services.registrar_evento(
            self.tcc, TipoEvento.UPLOAD, "Versão 2 enviada.", usuario=self.aluno, entrega=self.entrega
        )
        self.assertEqual(services.destinatarios_do_evento(evento), [])

        evento = services.registrar_evento(
            self.tcc, TipoEvento.ENTREGA_CONCLUIDA, "Concluída.", usuario=self.orientador
        )
        self.assertEqual(services.destinatarios_do_evento(evento), [self.aluno])

    def test_troca_de_orientador_avisa_o_aluno_e_o_novo_orientador(self):
        from core.models import Perfil, Usuario

        nova = Usuario.objects.create_user(
            email="rita@prof.edu.br", nome="Rita", senha="senhaForte123", perfil=Perfil.ORIENTADOR
        )
        services.reatribuir_orientador(orientador=self.orientador, tcc=self.tcc, novo_orientador=nova)

        evento = self.tcc.eventos.get(tipo=TipoEvento.TROCA_ORIENTADOR)
        self.assertEqual(
            {n.destinatario for n in evento.notificacoes.all()}, {self.aluno, nova}
        )

    # ---- CA3 / RN11

    @mock.patch(ENVIO)
    def test_ca3_sem_telegram_fica_registrada_e_nao_e_enviada(self, envio):
        self.sinalizar_e_enviar()

        notificacao = Notificacao.objects.get(destinatario=self.orientador)
        self.assertEqual(notificacao.canal, CanalNotificacao.NENHUM)
        self.assertEqual(notificacao.status_envio, StatusEnvio.SEM_CANAL)
        self.assertIn("Capítulo 1", notificacao.conteudo)
        envio.assert_not_called()

    # ---- RNF11

    @mock.patch(ENVIO, side_effect=telegram.ErroTelegram("TELEGRAM_BOT_TOKEN não configurado no servidor."))
    def test_rnf11_falha_no_envio_nao_impede_a_acao(self, _envio):
        self.orientador.telegram_chat_id = "111"
        self.orientador.save()

        resposta = self.sinalizar_e_enviar()

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.entrega.refresh_from_db()
        self.assertEqual(self.entrega.estado, EstadoEntrega.PRONTO_PARA_REVISAO)
        notificacao = Notificacao.objects.get(destinatario=self.orientador)
        self.assertEqual(notificacao.status_envio, StatusEnvio.FALHOU)
        self.assertIn("TELEGRAM_BOT_TOKEN", notificacao.erro)

    @mock.patch(ENVIO, side_effect=RuntimeError("inesperado"))
    def test_rnf11_erro_inesperado_no_envio_tambem_nao_impede(self, _envio):
        self.orientador.telegram_chat_id = "111"
        self.orientador.save()

        with self.assertLogs("core.services", level="ERROR"):
            resposta = self.sinalizar_e_enviar()

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.entrega.refresh_from_db()
        self.assertEqual(self.entrega.estado, EstadoEntrega.PRONTO_PARA_REVISAO)

    def test_rnf11_falha_ao_registrar_a_notificacao_nao_impede_a_acao(self):
        with mock.patch.object(Notificacao.objects, "create", side_effect=RuntimeError("banco")):
            with self.assertLogs("core.services", level="ERROR"):
                resposta = self.sinalizar_e_enviar()

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertTrue(self.tcc.eventos.filter(tipo=TipoEvento.ENTREGA_PRONTA).exists())

    @mock.patch(ENVIO)
    def test_acao_desfeita_nao_dispara_mensagem(self, envio):
        self.orientador.telegram_chat_id = "111"
        self.orientador.save()

        with self.captureOnCommitCallbacks(execute=True):
            try:
                with transaction.atomic():
                    services.registrar_evento(
                        self.tcc, TipoEvento.ENTREGA_PRONTA, "x", usuario=self.aluno
                    )
                    raise ValueError("a ação falhou depois do evento")
            except ValueError:
                pass

        envio.assert_not_called()
        self.assertFalse(Notificacao.objects.exists())


def _resposta(corpo):
    caixa = mock.MagicMock()
    caixa.__enter__.return_value.read.return_value = json.dumps(corpo).encode()
    return caixa


@override_settings(TELEGRAM_BOT_TOKEN="123:SEGREDO", TELEGRAM_TIMEOUT=4)
class ModuloTelegramTests(TestCase):
    """O envio em si: a chamada à API do Telegram e o tratamento dos erros."""

    @mock.patch("core.telegram.urllib.request.urlopen", return_value=_resposta({"ok": True}))
    def test_envia_para_a_api_com_o_chat_e_o_texto(self, urlopen):
        telegram.enviar_mensagem("111", "Olá")

        pedido = urlopen.call_args.args[0]
        self.assertEqual(pedido.full_url, "https://api.telegram.org/bot123:SEGREDO/sendMessage")
        self.assertEqual(json.loads(pedido.data)["chat_id"], "111")
        self.assertEqual(json.loads(pedido.data)["text"], "Olá")
        self.assertEqual(urlopen.call_args.kwargs["timeout"], 4)

    @override_settings(TELEGRAM_BOT_TOKEN="")
    def test_sem_token_nao_tenta_enviar(self):
        with mock.patch("core.telegram.urllib.request.urlopen") as urlopen:
            with self.assertRaises(telegram.ErroTelegram):
                telegram.enviar_mensagem("111", "Olá")
        urlopen.assert_not_called()

    def test_recusa_da_api_vira_erro_legivel_sem_o_token(self):
        recusa = urllib.error.HTTPError(
            "https://api.telegram.org/bot123:SEGREDO/sendMessage", 400, "Bad Request", {},
            io.BytesIO(b'{"ok":false,"description":"Bad Request: chat not found"}'),
        )
        with mock.patch("core.telegram.urllib.request.urlopen", side_effect=recusa):
            with self.assertRaises(telegram.ErroTelegram) as erro:
                telegram.enviar_mensagem("111", "Olá")
        self.assertIn("chat not found", str(erro.exception))
        self.assertNotIn("SEGREDO", str(erro.exception))

    @mock.patch("core.telegram.urllib.request.urlopen", side_effect=TimeoutError("timed out"))
    def test_telegram_fora_do_ar_vira_erro(self, _urlopen):
        with self.assertRaises(telegram.ErroTelegram):
            telegram.enviar_mensagem("111", "Olá")
