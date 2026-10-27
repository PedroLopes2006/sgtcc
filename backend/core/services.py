"""
Regras de negócio do Sprint 3.

Notificações (US03 CA2, US03 CA4, US04 CA3): cada ponto registra um Evento;
o envio é a US02.
"""
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
)


def registrar_evento(tcc, tipo, descricao, usuario=None):
    """RN10 — ponto único de gravação no log do TCC."""
    return Evento.objects.create(
        tcc=tcc, tipo=tipo, descricao=descricao, usuario_relacionado=usuario
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
    )
    return entrega
