"""
US02 / RF16 — envio de mensagens pela API de bots do Telegram.

Usa só a biblioteca padrão (urllib): a API é um POST HTTPS simples e não vale
uma dependência nova (RNF13). O token do bot vem da variável de ambiente
TELEGRAM_BOT_TOKEN e nunca vai para o código nem para o repositório.

Este módulo só envia e avisa quando não deu certo (levanta ErroTelegram). Quem
chama decide o que fazer com a falha: em services.py ela é anotada na
Notificação e não impede a ação do usuário (RNF11).
"""
import json
import urllib.error
import urllib.request

from django.conf import settings

URL_DA_API = "https://api.telegram.org/bot{token}/sendMessage"


class ErroTelegram(Exception):
    """O Telegram não recebeu a mensagem (sem token, recusa da API ou rede)."""


def configurado():
    return bool(settings.TELEGRAM_BOT_TOKEN)


def enviar_mensagem(chat_id, texto):
    """Manda `texto` para o chat. Levanta ErroTelegram se não for entregue à API."""
    if not configurado():
        raise ErroTelegram("TELEGRAM_BOT_TOKEN não configurado no servidor.")

    corpo = json.dumps(
        {"chat_id": chat_id, "text": texto, "disable_web_page_preview": True}
    ).encode("utf-8")
    pedido = urllib.request.Request(
        URL_DA_API.format(token=settings.TELEGRAM_BOT_TOKEN),
        data=corpo,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(pedido, timeout=settings.TELEGRAM_TIMEOUT) as resposta:
            dados = json.loads(resposta.read().decode("utf-8"))
    except urllib.error.HTTPError as erro:
        # A API explica o motivo no corpo (ex.: "chat not found" quando a pessoa
        # não tocou em Iniciar no bot ou o código está errado).
        raise ErroTelegram(_descricao_do_erro(erro)) from None
    except (urllib.error.URLError, TimeoutError, OSError, ValueError) as erro:
        raise ErroTelegram(f"Falha de comunicação com o Telegram: {erro}") from None

    if not dados.get("ok"):
        raise ErroTelegram(dados.get("description") or "O Telegram recusou a mensagem.")


def _descricao_do_erro(erro):
    try:
        dados = json.loads(erro.read().decode("utf-8"))
        return f"{erro.code}: {dados.get('description', '')}".strip()
    except Exception:  # noqa: BLE001 — só montando a mensagem de erro
        # Nunca usar str(erro) com a URL: ela contém o token.
        return f"HTTP {erro.code}"
