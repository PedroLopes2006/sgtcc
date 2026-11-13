"""
Regras de negócio dos Sprints 3 e 4.

Notificações (US03 CA2, US03 CA4, US04 CA3, US08 CA3, US10 CA1, US11 CA3 e o
comentário adicional da US11): cada ponto registra um Evento; o envio é a US02.
"""
from datetime import timedelta
from pathlib import Path

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.db.models import F, Max
from django.utils import timezone

from .models import (
    Comentario,
    Entrega,
    EstadoEntrega,
    Evento,
    NivelPrioridade,
    Orientacao,
    Perfil,
    PrioridadeRevisao,
    StatusTema,
    TentativaLogin,
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
    # A conta do administrador tem perfil de orientador, mas não pode ser indicada.
    if orientador.perfil != Perfil.ORIENTADOR or orientador.is_superuser:
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


def _exigir_primeira_entrega_pendente(entrega):
    """
    RN06 / US12 CA2 — o orientador revisa as entregas em ordem.

    Só a primeira entrega ainda pendente (que não está "concluída" nem
    "enviada à banca"), na ordem de prazo e criação, pode ser revisada. A
    seguinte só chega à vez quando a anterior é concluída.
    """
    primeira = entrega.tcc.entregas.exclude(estado__in=EstadoEntrega.encerrados()).first()
    if primeira is not None and primeira.pk != entrega.pk:
        raise ValidationError(
            {
                "detail": "Só é possível revisar a primeira entrega pendente do aluno "
                f'("{primeira.titulo}").'
            }
        )


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
    RN06: as entregas são revisadas em ordem; só a primeira pendente do aluno.
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
    # RN06 — as entregas são revisadas em ordem: só a primeira pendente.
    _exigir_primeira_entrega_pendente(entrega)

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
    RN06: as entregas são revisadas em ordem; só a primeira pendente do aluno.
    RN10 / RF18 / RNF12: a mudança de estado gera um Evento, só de inclusão.
    RN14: o Comentario é criado e nunca alterado.
    RF10: o Comentario fica vinculado à entrega e à versão avaliada.
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
    # RN06 — as entregas são revisadas em ordem: só a primeira pendente.
    _exigir_primeira_entrega_pendente(entrega)

    texto = comentario.strip()
    # RF10 — o comentário aponta a versão que o orientador acabou de avaliar.
    Comentario.objects.create(
        entrega=entrega, versao=entrega.versao_atual, autor=orientador, texto=texto
    )
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


@transaction.atomic
def adicionar_comentario_entrega(*, orientador, entrega, comentario):
    """
    US11 / RF10 — adicionar um comentário a uma entrega, sem mudar o estado dela.

    É o caminho para complementar ou corrigir o que o orientador escreveu: o
    comentário anterior nunca é editado (RN14), então o ajuste vira um novo.
    Só vale com a entrega "em revisão" ou com "correção solicitada", que é
    quando há uma revisão em curso.
    RN05: só o orientador ativo do TCC age sobre a entrega.
    RN06: as entregas são revisadas em ordem; só a primeira pendente do aluno.
    RN07: o comentário é obrigatório (sem texto, não há o que registrar).
    RN14: o Comentario é criado e nunca alterado nem removido.
    RF10: o Comentario fica vinculado à entrega e à versão avaliada.
    RF16 / RF18 / RNF12: o aluno é notificado por um Evento, só de inclusão.
    """
    _exigir_orientador_ativo(orientador, entrega.tcc)
    # RN07 — sem texto não há comentário.
    if not (comentario or "").strip():
        raise ValidationError({"comentario": "O comentário é obrigatório."})
    # RF10 — comentar só faz sentido durante a revisão, antes ou depois do pedido de correção.
    if entrega.estado not in (EstadoEntrega.EM_REVISAO, EstadoEntrega.CORRECAO_SOLICITADA):
        raise ValidationError(
            {
                "detail": 'Só é possível comentar uma entrega "em revisão" '
                'ou com "correção solicitada".'
            }
        )
    # RN06 — as entregas são revisadas em ordem: só a primeira pendente.
    _exigir_primeira_entrega_pendente(entrega)

    texto = comentario.strip()
    # RF10 / RN14 — o comentário aponta a versão avaliada e nunca é editado.
    novo = Comentario.objects.create(
        entrega=entrega, versao=entrega.versao_atual, autor=orientador, texto=texto
    )

    # RF16 / RF18 — o aluno é notificado e recebe o texto junto, como na correção.
    registrar_evento(
        entrega.tcc,
        TipoEvento.COMENTARIO_ADICIONADO,
        f'Comentário adicionado na entrega "{entrega.titulo}": {texto}',
        usuario=orientador,
        entrega=entrega,
    )
    return novo


# ---------------------------------------------------------------- US12

@transaction.atomic
def aprovar_entrega(*, orientador, entrega):
    """US12 CA1–CA2 / RF11, RF16–18 / RN05, RN06, RN10 / RNF04, RNF12.

    Conclui a primeira pendente em revisão e registra o aviso e a próxima etapa.
    """
    tcc = TCC.objects.select_for_update().get(pk=entrega.tcc_id)
    _exigir_orientador_ativo(orientador, tcc)
    if not orientador.eh_orientador:
        raise PermissionDenied("Apenas orientadores podem aprovar entregas.")
    entrega = Entrega.objects.select_for_update().get(pk=entrega.pk)
    if entrega.estado != EstadoEntrega.EM_REVISAO:
        raise ValidationError({"detail": 'Só é possível aprovar uma entrega "em revisão".'})
    _exigir_primeira_entrega_pendente(entrega)
    entrega.estado = EstadoEntrega.CONCLUIDA
    entrega.data_conclusao = timezone.now()
    entrega.save(update_fields=["estado", "data_conclusao"])
    proxima = tcc.entregas.exclude(estado__in=EstadoEntrega.encerrados()).first()
    descricao = f'Entrega "{entrega.titulo}" concluída por {orientador.nome}.'
    if proxima:
        descricao += f' Próxima etapa disponível: "{proxima.titulo}".'
    registrar_evento(tcc, TipoEvento.ENTREGA_CONCLUIDA, descricao,
                     usuario=orientador, entrega=entrega)
    return entrega


# ---------------------------------------------------------------- US13

@transaction.atomic
def enviar_a_banca_entrega(*, orientador, entrega):
    """US13 CA1 / RF12 / RN12, RN06, RN10, RN05 / RNF04: encerramento formal."""
    tcc = TCC.objects.select_for_update().get(pk=entrega.tcc_id)
    _exigir_orientador_ativo(orientador, tcc)
    if not orientador.eh_orientador:
        raise PermissionDenied("Apenas orientadores podem enviar à banca.")
    entrega = Entrega.objects.select_for_update().get(pk=entrega.pk)
    if entrega.estado != EstadoEntrega.CONCLUIDA:
        raise ValidationError({"detail": 'Só é possível enviar à banca uma entrega "concluída".'})
    entrega.estado = EstadoEntrega.ENVIADA_A_BANCA
    entrega.save(update_fields=["estado"])
    registrar_evento(tcc, TipoEvento.ENTREGA_ENVIADA_A_BANCA,
                     f'Entrega "{entrega.titulo}" enviada à banca por {orientador.nome}. Encerramento formal registrado.',
                     usuario=orientador, entrega=entrega)
    return entrega


# ---------------------------------------------------------------- US15

@transaction.atomic
def reatribuir_orientador(*, orientador, tcc, novo_orientador):
    """US15 CA1–CA3 / RF14 / RN05, RN08, RN09, RN15, RN10 / RNF04.

    Trava o TCC, encerra o vínculo antigo e preserva todo o histórico existente.
    """
    tcc = TCC.objects.select_for_update().get(pk=tcc.pk)
    _exigir_orientador_ativo(orientador, tcc)
    if not orientador.eh_orientador:
        raise PermissionDenied("Apenas orientadores podem reatribuir um TCC.")
    # O administrador não é um destino válido (veja `orientadores_disponiveis`).
    if (
        novo_orientador.perfil != Perfil.ORIENTADOR
        or not novo_orientador.is_active
        or novo_orientador.is_superuser
    ):
        raise ValidationError({"novo_orientador": "Selecione um orientador ativo."})
    if novo_orientador.pk == orientador.pk:
        raise ValidationError({"novo_orientador": "Escolha um orientador diferente do atual."})
    anterior = tcc.orientacao_ativa
    anterior.encerrar()
    nova = Orientacao.objects.create(tcc=tcc, orientador=novo_orientador)
    registrar_evento(tcc, TipoEvento.TROCA_ORIENTADOR,
                     f'Orientação reatribuída de {orientador.nome} para {novo_orientador.nome}. Histórico preservado.',
                     usuario=orientador)
    return nova


def consultar_historico(*, orientador, tcc):
    """US15 CA2 / RF14 / RN05, RN08 / RNF04: histórico só para o orientador atual."""
    if not orientador.eh_orientador:
        raise PermissionDenied("Apenas orientadores podem consultar este histórico.")
    _exigir_orientador_ativo(orientador, tcc)
    return tcc


# ---------------------------------------------------------------- US09 — fila de revisão


def fila_de_revisao(*, orientador):
    """
    US09 — entregas aguardando a revisão do orientador, por ordem de chegada.

    CA1 / RF09: as entregas "pronto_para_revisao" dos orientandos ativos dele.
    CA2: sem pendência, a lista vem vazia (a tela mostra a mensagem de fila vazia).
    RN05: só os TCCs com Orientação ativa do orientador; o ex-orientador não vê.
    RN06: só a primeira entrega pendente de cada aluno, a mesma que o
        "Iniciar revisão" (US10) aceita; as seguintes esperam a vez.
    Ordem: da que ficou pronta há mais tempo para a mais recente, pela data do
        último Evento ENTREGA_PRONTA da entrega (depois de uma correção, a
        entrega é sinalizada de novo e volta para o fim da fila). Entrega sem
        esse Evento (dados antigos ou criados à mão) fica no fim, sem data.

    Cada entrega devolvida ganha o atributo `pronta_em` (datetime ou None) e, como
    EXTRA do protótipo (fora dos requisitos), `prioridade`: a que ESTE orientador
    deu a ela ("alta", "media", "baixa") ou None. A prioridade não muda a ordem.
    """
    tccs = (
        TCC.objects.filter(orientacoes__orientador=orientador, orientacoes__ativa=True)
        .select_related("aluno", "tema")
        .prefetch_related("entregas__versoes")
        .distinct()
    )

    entregas = []
    for tcc in tccs:
        primeira = next(
            (e for e in tcc.entregas.all() if e.estado not in EstadoEntrega.encerrados()), None
        )
        if primeira is not None and primeira.estado == EstadoEntrega.PRONTO_PARA_REVISAO:
            entregas.append(primeira)

    prontas_em = dict(
        Evento.objects.filter(entrega__in=entregas, tipo=TipoEvento.ENTREGA_PRONTA)
        .values("entrega")
        .annotate(ultima=Max("data_hora"))
        .values_list("entrega", "ultima")
    )
    prioridades = dict(
        PrioridadeRevisao.objects.filter(orientador=orientador, entrega__in=entregas)
        .values_list("entrega_id", "nivel")
    )
    for entrega in entregas:
        entrega.pronta_em = prontas_em.get(entrega.id)
        entrega.prioridade = prioridades.get(entrega.id)

    agora = timezone.now()
    entregas.sort(key=lambda e: (e.pronta_em is None, e.pronta_em or agora, e.id))
    return entregas


# ---------------------------------------------------------------- EXTRA — tela de Revisão
# Fora dos requisitos do documento: a tela de Revisão vem do protótipo do Figma.
# Ela reúne, numa tela só, o que as US07, US10, US11, US12 e US13 já fazem.


def acoes_da_revisao(entrega):
    """
    EXTRA (protótipo) — o que o orientador pode fazer agora com a entrega.

    São as mesmas condições dos services que executam cada ação, reunidas aqui
    para a tela não decidir regra sozinha (RN06):
      iniciar_revisao   → "pronto_para_revisao" e é a primeira pendente (US10).
      solicitar_correcao → "em_revisao" e é a primeira pendente (US11).
      aprovar           → "em_revisao" e é a primeira pendente (US12).
      comentar          → "em_revisao" ou "correcao_solicitada" e é a primeira
                          pendente (comentário adicional da US11, RF10).
      enviar_a_banca    → "concluida" (US13, RN12).
    """
    primeira = entrega.tcc.entregas.exclude(estado__in=EstadoEntrega.encerrados()).first()
    e_a_vez = primeira is not None and primeira.pk == entrega.pk
    return {
        "iniciar_revisao": e_a_vez and entrega.estado == EstadoEntrega.PRONTO_PARA_REVISAO,
        "solicitar_correcao": e_a_vez and entrega.estado == EstadoEntrega.EM_REVISAO,
        "aprovar": e_a_vez and entrega.estado == EstadoEntrega.EM_REVISAO,
        "comentar": e_a_vez
        and entrega.estado in (EstadoEntrega.EM_REVISAO, EstadoEntrega.CORRECAO_SOLICITADA),
        "enviar_a_banca": entrega.estado == EstadoEntrega.CONCLUIDA,
    }


def consultar_revisao(*, orientador, entrega):
    """
    EXTRA (protótipo) — a entrega aberta na tela de Revisão do orientador.

    RN05: só o orientador com Orientação ativa no TCC da entrega a consulta; o
    ex-orientador e os outros orientadores recebem acesso negado.
    RNF04: exclusivo de orientadores (a view já barra o aluno).
    """
    if not orientador.eh_orientador:
        raise PermissionDenied("Apenas orientadores podem abrir a revisão.")
    _exigir_orientador_ativo(orientador, entrega.tcc)
    return entrega


# ---------------------------------------------------------------- EXTRA — prioridade na fila
# Fora dos requisitos do documento: a prioridade vem do protótipo do Figma.

SEM_PRIORIDADE = "sem_prioridade"


@transaction.atomic
def definir_prioridade(*, orientador, entrega, nivel):
    """
    EXTRA (protótipo) — marcar a prioridade de uma entrega na Fila de revisão.

    O orientador escolhe "alta", "media" ou "baixa"; "sem_prioridade" remove a
    marcação. A prioridade é só dele: fica por orientador e por entrega, e o
    aluno nunca a vê. Não é mudança de estado, então não gera Evento (RN10 não
    se aplica) e ninguém é notificado.
    RN05: só o orientador ativo do TCC marca prioridade.
    Entrega "concluída" ou "enviada à banca" não está mais na fila: é recusada.
    Devolve o nível gravado, ou None quando a marcação foi removida.
    """
    if not orientador.eh_orientador:
        raise PermissionDenied("Apenas orientadores podem marcar prioridade.")
    _exigir_orientador_ativo(orientador, entrega.tcc)
    if entrega.estado in EstadoEntrega.encerrados():
        raise ValidationError({"detail": "Só se marca prioridade em uma entrega pendente."})

    if nivel == SEM_PRIORIDADE:
        PrioridadeRevisao.objects.filter(orientador=orientador, entrega=entrega).delete()
        return None
    if nivel not in NivelPrioridade.values:
        raise ValidationError({"prioridade": "Escolha alta, média, baixa ou sem prioridade."})

    PrioridadeRevisao.objects.update_or_create(
        orientador=orientador, entrega=entrega, defaults={"nivel": nivel}
    )
    return nivel


# ---------------------------------------------------------------- EXTRA: avisos
# EXTRA — fora dos requisitos do documento. É a alternativa dentro do sistema ao envio
# pelo Telegram (US02): a aba de Avisos lê os mesmos `Evento` que são o gatilho do
# RF16 (RN10, RF18). Não cria dado novo além de "visto até quando", e não impede
# nenhuma ação se falhar (RNF11).

# O orientador só é avisado do que depende dele; o resto do log ele já vê nas telas.
TIPOS_DE_AVISO_DO_ORIENTADOR = (
    TipoEvento.TEMA_PROPOSTO,
    TipoEvento.TEMA_REENVIADO,
    TipoEvento.ENTREGA_PRONTA,
    TipoEvento.TROCA_ORIENTADOR,
)
LIMITE_DE_AVISOS = 30


def eventos_de_aviso(usuario):
    """Eventos que viram aviso para o usuário, do mais novo para o mais antigo. RNF04."""
    if usuario.eh_aluno:
        eventos = Evento.objects.filter(tcc__aluno=usuario)
    elif usuario.eh_orientador:
        # Só o que aconteceu depois que ele assumiu o TCC (RN08: o histórico anterior é
        # preservado, mas não vira aviso novo).
        eventos = Evento.objects.filter(
            tcc__orientacoes__orientador=usuario,
            tcc__orientacoes__ativa=True,
            data_hora__gte=F("tcc__orientacoes__data_inicio"),
            tipo__in=TIPOS_DE_AVISO_DO_ORIENTADOR,
        )
    else:
        return Evento.objects.none()
    # Quem fez a ação não precisa ser avisado dela.
    return (
        eventos.exclude(usuario_relacionado=usuario)
        .select_related("usuario_relacionado", "entrega")
        .order_by("-data_hora", "-id")
    )


def avisos_do_usuario(usuario):
    """Os últimos avisos e quantos ainda não foram vistos."""
    todos = eventos_de_aviso(usuario)
    vistos_ate = usuario.avisos_lidos_em
    nao_lidos = todos.filter(data_hora__gt=vistos_ate).count() if vistos_ate else todos.count()
    return list(todos[:LIMITE_DE_AVISOS]), nao_lidos, vistos_ate


def marcar_avisos_como_lidos(usuario):
    """Marca tudo o que existe agora como visto."""
    usuario.avisos_lidos_em = timezone.now()
    usuario.save(update_fields=["avisos_lidos_em"])
    return usuario.avisos_lidos_em


# ---------------------------------------------------------------- EXTRA: perfil editável
# EXTRA — fora dos requisitos do documento. A senha continua guardada só como hash (RNF03).
TAMANHO_MINIMO_DA_SENHA = 8


def atualizar_nome(*, usuario, nome):
    """Troca o nome exibido da conta. E-mail e perfil não mudam (RNF04)."""
    nome = (nome or "").strip()
    if not nome:
        raise ValidationError({"nome": "Informe o nome."})
    if len(nome) > 150:
        raise ValidationError({"nome": "O nome pode ter no máximo 150 caracteres."})
    usuario.nome = nome
    usuario.save(update_fields=["nome"])
    return usuario


def alterar_senha(*, usuario, senha_atual, nova_senha):
    """Troca a senha depois de conferir a atual. RNF03."""
    if not usuario.check_password(senha_atual or ""):
        raise ValidationError({"senha_atual": "A senha atual não confere."})
    if len(nova_senha or "") < TAMANHO_MINIMO_DA_SENHA:
        raise ValidationError(
            {"nova_senha": f"A nova senha precisa ter ao menos {TAMANHO_MINIMO_DA_SENHA} caracteres."}
        )
    if nova_senha == senha_atual:
        raise ValidationError({"nova_senha": "A nova senha precisa ser diferente da atual."})
    # As mesmas regras de senha do cadastro (US01).
    try:
        validate_password(nova_senha, usuario)
    except ValidationError as erro:
        raise ValidationError({"nova_senha": list(erro.messages)})
    usuario.set_password(nova_senha)
    usuario.save(update_fields=["password"])
    return usuario


# ---------------------------------------------------------------- EXTRA: limite de tentativas
# EXTRA — fora dos requisitos do documento. Dificulta adivinhar senha (RNF03). Vale para
# qualquer e-mail digitado, exista ou não, para não revelar quais contas existem (US01 CA4).
LIMITE_TENTATIVAS_LOGIN = 8
MINUTOS_DE_BLOQUEIO_DO_LOGIN = 15


def _normalizar_email(email):
    return (email or "").strip().lower()


def minutos_de_bloqueio_do_login(email):
    """Quantos minutos faltam para liberar o login deste e-mail (0 se não está bloqueado)."""
    tentativa = TentativaLogin.objects.filter(email=_normalizar_email(email)).first()
    if not tentativa or not tentativa.bloqueado_ate:
        return 0
    restante = (tentativa.bloqueado_ate - timezone.now()).total_seconds()
    if restante <= 0:
        # Passou o tempo: recomeça do zero.
        tentativa.delete()
        return 0
    return int(restante // 60) + 1


@transaction.atomic
def registrar_falha_de_login(email):
    """Soma uma senha errada; no limite, bloqueia o e-mail por um tempo."""
    email = _normalizar_email(email)
    if not email:
        return
    tentativa, _ = TentativaLogin.objects.select_for_update().get_or_create(email=email)
    tentativa.falhas += 1
    if tentativa.falhas >= LIMITE_TENTATIVAS_LOGIN:
        tentativa.bloqueado_ate = timezone.now() + timedelta(minutes=MINUTOS_DE_BLOQUEIO_DO_LOGIN)
        tentativa.falhas = 0
    tentativa.save()


def limpar_falhas_de_login(email):
    """Um login certo zera a contagem."""
    TentativaLogin.objects.filter(email=_normalizar_email(email)).delete()
