"""
Regras de negócio dos Sprints 3 e 4.

Notificações (US03 CA2, US03 CA4, US04 CA3, US08 CA3, US10 CA1, US11 CA3): cada
ponto registra um Evento; o envio é a US02.
"""
from pathlib import Path

from django.conf import settings
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.utils import timezone

from .models import (
    Comentario,
    Entrega,
    EstadoEntrega,
    Evento,
    Orientacao,
    Perfil,
    StatusTema,
    TCC,
    Tema,
    TipoEvento,
    Versao,
)


def registrar_evento(tcc, tipo, descricao, usuario=None, entrega=None):
    """RN10 — ponto único de gravação no log do TCC."""
    return Evento.objects.create(
        tcc=tcc, tipo=tipo, descricao=descricao, usuario_relacionado=usuario, entrega=entrega
    )


@transaction.atomic
def propor_tema(*, aluno, titulo, descricao, orientador):
    """
    US03 — propor tema e indicar orientador.

    CA1: cria o TCC, o Tema com status "proposto" e a Orientação ativa.
    CA3: o orientador é obrigatório (validado também no serializer).
    RN01: um aluno tem um único TCC.
    RN15: todo TCC nasce com uma Orientação ativa.
    """
    if not aluno.eh_aluno:
        raise PermissionDenied("Apenas alunos podem propor tema.")
    if orientador is None:
        raise ValidationError({"orientador": "É obrigatório indicar um orientador."})
    if orientador.perfil != Perfil.ORIENTADOR:
        raise ValidationError({"orientador": "O usuário indicado não é um orientador."})
    if TCC.objects.filter(aluno=aluno).exists():
        raise ValidationError(
            {"detail": "Você já possui um TCC. Edite o tema existente em vez de propor outro."}
        )

    tcc = TCC.objects.create(aluno=aluno)
    tema = Tema.objects.create(
        tcc=tcc, titulo=titulo, descricao=descricao, status=StatusTema.PROPOSTO
    )
    Orientacao.objects.create(tcc=tcc, orientador=orientador, ativa=True)

    # CA2 — o orientador indicado é notificado (registro do gatilho).
    registrar_evento(
        tcc,
        TipoEvento.TEMA_PROPOSTO,
        f'Tema "{tema.titulo}" proposto para {orientador.nome}.',
        usuario=aluno,
    )
    return tema


@transaction.atomic
def reenviar_tema(*, aluno, tema, titulo, descricao):
    """
    US03 CA4 — tema em "ajuste solicitado" volta a "proposto" após a correção.

    É o mesmo Tema, não um novo: o histórico da proposta é preservado.
    """
    if tema.tcc.aluno_id != aluno.id:
        raise PermissionDenied("Este tema não pertence a você.")
    if tema.status != StatusTema.AJUSTE_SOLICITADO:
        raise ValidationError(
            {"detail": 'Só é possível reenviar um tema com status "ajuste solicitado".'}
        )

    tema.titulo = titulo
    tema.descricao = descricao
    tema.status = StatusTema.PROPOSTO
    tema.justificativa_ajuste = ""
    tema.data_proposta = timezone.now()
    tema.save()

    registrar_evento(
        tema.tcc,
        TipoEvento.TEMA_REENVIADO,
        f'Tema "{tema.titulo}" corrigido e reenviado para aprovação.',
        usuario=aluno,
    )
    return tema


def _exigir_orientador_ativo(orientador, tcc):
    """RN05 — só o orientador com Orientação ativa age sobre aquele TCC."""
    orientacao = tcc.orientacao_ativa
    if orientacao is None or orientacao.orientador_id != orientador.id:
        raise PermissionDenied("Você não é o orientador ativo deste TCC.")


@transaction.atomic
def aprovar_tema(*, orientador, tema):
    """US04 CA1 — tema "proposto" passa a "aprovado", com data registrada."""
    _exigir_orientador_ativo(orientador, tema.tcc)
    if tema.status != StatusTema.PROPOSTO:
        raise ValidationError({"detail": 'Só é possível aprovar um tema com status "proposto".'})

    tema.status = StatusTema.APROVADO
    tema.data_aprovacao = timezone.now()
    tema.justificativa_ajuste = ""
    tema.save(update_fields=["status", "data_aprovacao", "justificativa_ajuste"])

    # CA3 — o aluno é notificado da mudança de status.
    registrar_evento(
        tema.tcc,
        TipoEvento.TEMA_APROVADO,
        f'Tema "{tema.titulo}" aprovado por {orientador.nome}.',
        usuario=orientador,
    )
    return tema


@transaction.atomic
def solicitar_ajuste_tema(*, orientador, tema, justificativa):
    """US04 CA2 — pedir ajuste exige justificativa."""
    _exigir_orientador_ativo(orientador, tema.tcc)
    if tema.status != StatusTema.PROPOSTO:
        raise ValidationError(
            {"detail": 'Só é possível solicitar ajuste em um tema com status "proposto".'}
        )
    if not (justificativa or "").strip():
        raise ValidationError({"justificativa": "A justificativa é obrigatória."})

    tema.status = StatusTema.AJUSTE_SOLICITADO
    tema.justificativa_ajuste = justificativa.strip()
    tema.data_aprovacao = None
    tema.save(update_fields=["status", "justificativa_ajuste", "data_aprovacao"])

    registrar_evento(
        tema.tcc,
        TipoEvento.TEMA_AJUSTE_SOLICITADO,
        f'Ajuste solicitado no tema "{tema.titulo}": {tema.justificativa_ajuste}',
        usuario=orientador,
    )
    return tema


@transaction.atomic
def criar_entrega(*, aluno, titulo, prazo):
    """
    US05 — criar entrega.

    CA1: nasce em "rascunho".
    CA2 / RN02: exige Tema com status "aprovado".
    A etapa é criada sem arquivo; o upload é a US06, fora deste sprint.
    """
    if not aluno.eh_aluno:
        raise PermissionDenied("Apenas alunos podem criar entregas.")

    tcc = TCC.objects.filter(aluno=aluno).first()
    if tcc is None:
        raise ValidationError({"detail": "Proponha e tenha um tema aprovado antes de criar entregas."})

    tema = getattr(tcc, "tema", None)
    if tema is None or not tema.aprovado:
        raise ValidationError(
            {"detail": "A entrega só pode ser criada com o tema aprovado pelo orientador."}
        )

    entrega = Entrega.objects.create(
        tcc=tcc, titulo=titulo, prazo=prazo, estado=EstadoEntrega.RASCUNHO
    )
    registrar_evento(
        tcc,
        TipoEvento.ENTREGA_CRIADA,
        f'Entrega "{entrega.titulo}" criada com prazo {entrega.prazo:%d/%m/%Y}.',
        usuario=aluno,
    )
    return entrega


def _validar_arquivo_da_versao(arquivo):
    """Formato PDF, conforme o protótipo, e um teto de tamanho."""
    if arquivo is None:
        raise ValidationError({"arquivo": "Selecione um arquivo."})

    extensao = Path(arquivo.name).suffix.lower()
    if extensao not in settings.VERSAO_EXTENSOES:
        permitidas = ", ".join(settings.VERSAO_EXTENSOES)
        raise ValidationError({"arquivo": f"Formato não aceito. Envie um arquivo {permitidas}."})

    if arquivo.size == 0:
        raise ValidationError({"arquivo": "O arquivo está vazio."})

    if arquivo.size > settings.VERSAO_TAMANHO_MAXIMO:
        teto = settings.VERSAO_TAMANHO_MAXIMO // (1024 * 1024)
        raise ValidationError({"arquivo": f"O arquivo passa do limite de {teto} MB."})


@transaction.atomic
def enviar_versao(*, aluno, entrega, arquivo):
    """
    US06 — upload de versão.

    CA1 / RN13: cria a Versão com número incremental.
    CA2: de "correção solicitada", a entrega volta para "rascunho".
    CA3 / RN03: qualquer outro estado é recusado.
    CA4: registra um Evento "upload".
    """
    if not aluno.eh_aluno:
        raise PermissionDenied("Apenas alunos enviam versões.")
    if entrega.tcc.aluno_id != aluno.id:
        raise PermissionDenied("Esta entrega não pertence a você.")

    if not entrega.aceita_versao:
        raise ValidationError(
            {
                "detail": "Só é possível enviar versão com a entrega em "
                '"rascunho" ou "correção solicitada".'
            }
        )

    _validar_arquivo_da_versao(arquivo)

    # Trava a entrega até o fim da transação: dois envios simultâneos não
    # podem calcular o mesmo número.
    entrega = Entrega.objects.select_for_update().get(pk=entrega.pk)

    versao = Versao(
        entrega=entrega,
        numero=entrega.numero_da_proxima_versao,
        enviado_por=aluno,
        nome_original=Path(arquivo.name).name[:255],
        tamanho=arquivo.size,
    )
    versao.arquivo = arquivo
    versao.save()

    campos = ["versoes_enviadas"]
    entrega.versoes_enviadas = versao.numero

    voltou_para_rascunho = entrega.estado == EstadoEntrega.CORRECAO_SOLICITADA
    if voltou_para_rascunho:
        entrega.estado = EstadoEntrega.RASCUNHO
        campos.append("estado")

    entrega.save(update_fields=campos)

    descricao = f'Versão {versao.numero} enviada em "{entrega.titulo}".'
    if voltou_para_rascunho:
        descricao += " A entrega voltou para rascunho."
    registrar_evento(entrega.tcc, TipoEvento.UPLOAD, descricao, usuario=aluno, entrega=entrega)

    return versao

# us08
@transaction.atomic
def sinalizar_pronta(*, aluno, entrega):
    """
    US08 — sinalizar a entrega como pronta para revisão.

    CA1: "rascunho" com ao menos uma versão passa a "pronto para revisão".
    CA2: sem nenhuma versão, o sistema impede (RN04).
    CA3: o orientador ativo é avisado (registro do gatilho) e um Evento é gravado.

    A entrega é travada durante a transição: um segundo clique, ou duas abas,
    esperam a primeira terminar e já encontram o novo estado, então a
    sinalização nunca é registrada duas vezes. (Em SQLite, usado só nos
    testes, o select_for_update não faz nada.)
    """
    if not aluno.eh_aluno:
        raise PermissionDenied("Apenas alunos podem sinalizar entregas.")
    entrega = Entrega.objects.select_for_update().select_related("tcc").get(pk=entrega.pk)
    if entrega.tcc.aluno_id != aluno.id:
        raise PermissionDenied("Esta entrega não pertence a você.")

    if entrega.estado != EstadoEntrega.RASCUNHO:
        raise ValidationError(
            {
                "detail": (
                    'Só é possível sinalizar uma entrega em "rascunho". '
                    f"Estado atual: {entrega.get_estado_display().lower()}."
                )
            }
        )
    ultima = entrega.versoes.order_by("-numero").first()
    if ultima is None:
        raise ValidationError(
            {"detail": "Envie ao menos uma versão antes de sinalizar a entrega como pronta."}
        )
    orientador = entrega.tcc.orientador_atual
    if orientador is None:
        raise ValidationError({"detail": "Esta entrega não tem um orientador ativo para avisar."})

    entrega.estado = EstadoEntrega.PRONTO_PARA_REVISAO
    entrega.save(update_fields=["estado"])

    # CA3 — o orientador é notificado da mudança de estado.
    registrar_evento(
        entrega.tcc,
        TipoEvento.ENTREGA_PRONTA,
        f'Entrega "{entrega.titulo}" sinalizada como pronta para revisão '
        f"(versão {ultima.numero}). {orientador.nome} foi avisado.",
        usuario=aluno,
        entrega=entrega,
    )
    return entrega


@transaction.atomic
def iniciar_revisao_entrega(*, orientador, entrega):
    """
    US10 — marcar a entrega como "em revisão".

    CA1: "pronto_para_revisao" passa a "em_revisao" e o aluno é notificado.
    CA2: em qualquer outro estado a transição é impedida.
    RN05: só o orientador ativo do TCC age sobre a entrega.
    RN06 / RF17: a máquina de estados é estrita; aqui só vale o passo
        pronto_para_revisao → em_revisao.
    RN10 / RF18 / RNF12: a mudança de estado gera um Evento, só de inclusão.
    RF16 / RNF11: a notificação é o Evento gravado; o envio é a US02 e uma
        falha nele não desfaz a transição.
    """
    _exigir_orientador_ativo(orientador, entrega.tcc)
    # CA2 / RN06 / RF17 — qualquer estado diferente de "pronto_para_revisao" é recusado.
    if entrega.estado != EstadoEntrega.PRONTO_PARA_REVISAO:
        raise ValidationError(
            {"detail": 'Só é possível iniciar a revisão de uma entrega "pronta para revisão".'}
        )

    entrega.estado = EstadoEntrega.EM_REVISAO
    entrega.save(update_fields=["estado"])

    # CA1 / RF16 — o aluno é notificado da mudança de estado (registro do gatilho).
    # RN10 / RF18 — a mudança de estado deixa rastro no log do TCC.
    registrar_evento(
        entrega.tcc,
        TipoEvento.ENTREGA_EM_REVISAO,
        f'Entrega "{entrega.titulo}" em revisão por {orientador.nome}.',
        usuario=orientador,
        entrega=entrega,
    )
    return entrega


@transaction.atomic
def solicitar_correcao_entrega(*, orientador, entrega, comentario):
    """
    US11 — registrar comentário e solicitar correção.

    CA1: "em_revisao" passa a "correcao_solicitada", com o comentário gravado.
    CA2 / RN07: o comentário é obrigatório.
    CA3: o aluno é notificado.
    RN05: só o orientador ativo do TCC age sobre a entrega.
    RN06 / RF17: aqui só vale o passo em_revisao → correcao_solicitada.
    RN10 / RF18 / RNF12: a mudança de estado gera um Evento, só de inclusão.
    RN14: o Comentario é criado e nunca alterado.
    RF16 / RNF11: a notificação é o Evento gravado; o envio é a US02.
    """
    _exigir_orientador_ativo(orientador, entrega.tcc)
    # CA2 / RN07 — sem texto não há solicitação.
    if not (comentario or "").strip():
        raise ValidationError({"comentario": "O comentário é obrigatório."})
    # RN06 / RF17 — qualquer estado diferente de "em_revisao" é recusado.
    if entrega.estado != EstadoEntrega.EM_REVISAO:
        raise ValidationError(
            {"detail": 'Só é possível solicitar correção de uma entrega "em revisão".'}
        )

    texto = comentario.strip()
    Comentario.objects.create(entrega=entrega, autor=orientador, texto=texto)
    entrega.estado = EstadoEntrega.CORRECAO_SOLICITADA
    entrega.save(update_fields=["estado"])

    # CA3 / RF16 — o aluno é notificado e recebe o texto junto, como na US04.
    # RN10 / RF18 — a mudança de estado deixa rastro no log do TCC.
    registrar_evento(
        entrega.tcc,
        TipoEvento.CORRECAO_SOLICITADA,
        f'Correção solicitada na entrega "{entrega.titulo}": {texto}',
        usuario=orientador,
        entrega=entrega,
    )
    return entrega
