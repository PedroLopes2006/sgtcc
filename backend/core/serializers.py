"""Serializers do Sprint 3."""
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework.exceptions import APIException, AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from . import services
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
    Usuario,
    Versao,
)


class UsuarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Usuario
        # `data_cadastro` alimenta o "Membro desde" da tela de Perfil (só leitura).
        fields = ["id", "nome", "email", "perfil", "telegram_chat_id", "data_cadastro"]
        read_only_fields = fields


class OrientadorResumoSerializer(serializers.ModelSerializer):
    """Lista enxuta para o aluno escolher o orientador na US03."""

    class Meta:
        model = Usuario
        fields = ["id", "nome", "email"]


class CadastroSerializer(serializers.ModelSerializer):
    """US01 CA1 e CA2 — cadastro com nome, e-mail, senha e perfil."""

    senha = serializers.CharField(write_only=True, min_length=8, style={"input_type": "password"})

    class Meta:
        model = Usuario
        fields = ["id", "nome", "email", "perfil", "senha"]

    def validate_email(self, valor):
        valor = valor.strip().lower()
        # CA2 — e-mail já cadastrado não pode ser reutilizado.
        if Usuario.objects.filter(email__iexact=valor).exists():
            raise serializers.ValidationError("Já existe uma conta com este e-mail.")
        return valor

    def validate_perfil(self, valor):
        if valor not in Perfil.values:
            raise serializers.ValidationError("Perfil inválido.")
        return valor

    def validate_senha(self, valor):
        validate_password(valor)
        return valor

    def create(self, dados_validados):
        return Usuario.objects.create_user(
            email=dados_validados["email"],
            nome=dados_validados["nome"],
            senha=dados_validados["senha"],
            perfil=dados_validados["perfil"],
        )


class LoginBloqueado(APIException):
    """EXTRA — 429: muitas tentativas erradas para este e-mail."""

    status_code = 429
    default_code = "login_bloqueado"

    def __init__(self, minutos):
        super().__init__(
            f"Muitas tentativas de entrar. Tente de novo em {minutos} minuto(s)."
        )


class LoginSerializer(TokenObtainPairSerializer):
    """
    US01 CA3 e CA4.

    CA4 pede erro genérico: o simplejwt distingue conta inexistente de senha
    errada na mensagem padrão, então sobrescrevemos para uma resposta única
    que não revela se o e-mail existe.
    """

    username_field = "email"
    default_error_messages = {"no_active_account": "E-mail ou senha inválidos."}

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["perfil"] = user.perfil
        token["nome"] = user.nome
        return token

    def validate(self, attrs):
        email = attrs.get(self.username_field, "").strip().lower()
        attrs[self.username_field] = email

        # EXTRA — fora dos requisitos: depois de 8 senhas erradas seguidas o e-mail
        # fica bloqueado por um tempo. A resposta é igual exista a conta ou não (CA4).
        minutos = services.minutos_de_bloqueio_do_login(email)
        if minutos:
            raise LoginBloqueado(minutos)
        try:
            dados = super().validate(attrs)
        except AuthenticationFailed:
            services.registrar_falha_de_login(email)
            raise
        services.limpar_falhas_de_login(email)
        # CA3 — o front usa o perfil para direcionar ao painel correto.
        dados["usuario"] = UsuarioSerializer(self.user).data
        return dados


class TemaSerializer(serializers.ModelSerializer):
    orientador = OrientadorResumoSerializer(source="tcc.orientador_atual", read_only=True)
    aluno = OrientadorResumoSerializer(source="tcc.aluno", read_only=True)

    class Meta:
        model = Tema
        fields = [
            "id",
            "titulo",
            "descricao",
            "status",
            "justificativa_ajuste",
            "data_proposta",
            "data_aprovacao",
            "orientador",
            "aluno",
        ]
        read_only_fields = fields


class PropostaTemaSerializer(serializers.Serializer):
    """US03 — entrada da proposta de tema."""

    titulo = serializers.CharField(max_length=200)
    descricao = serializers.CharField()
    # CA3 — a escolha do orientador é exigida pelo próprio contrato do endpoint.
    orientador_id = serializers.IntegerField()

    def validate_orientador_id(self, valor):
        # Mesma regra da lista que o aluno vê: o administrador não pode ser indicado.
        if not Usuario.objects.orientadores_disponiveis().filter(id=valor).exists():
            raise serializers.ValidationError("Orientador não encontrado.")
        return valor


class ReenvioTemaSerializer(serializers.Serializer):
    """US03 CA4 — correção de um tema com ajuste solicitado."""

    titulo = serializers.CharField(max_length=200)
    descricao = serializers.CharField()


class SolicitacaoAjusteSerializer(serializers.Serializer):
    """US04 CA2 — a justificativa é obrigatória."""

    justificativa = serializers.CharField(allow_blank=False, trim_whitespace=True)


class VersaoSerializer(serializers.ModelSerializer):
    """US06 — uma versão enviada."""

    arquivo_url = serializers.SerializerMethodField()

    class Meta:
        model = Versao
        fields = ["id", "numero", "nome_original", "tamanho", "data_envio", "arquivo_url"]
        read_only_fields = fields

    def get_arquivo_url(self, versao):
        """
        Em produção, URL assinada do Supabase (vale 1 hora). Em disco, o storage
        devolve "/media/...": com o request, vira absoluta no host da API, porque
        o front roda em outra origem. URL já absoluta passa sem mudança.
        """
        try:
            url = versao.arquivo.url
        except (ValueError, NotImplementedError):
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(url) if request else url


class ComentarioSerializer(serializers.ModelSerializer):
    """US11 / RF10 — parecer do orientador, com a versão avaliada quando houver."""

    autor = OrientadorResumoSerializer(read_only=True)
    versao = serializers.IntegerField(source="versao.numero", read_only=True, default=None)

    class Meta:
        model = Comentario
        fields = ["id", "autor", "texto", "versao", "data_criacao"]
        read_only_fields = fields


class EntregaSerializer(serializers.ModelSerializer):
    atrasada = serializers.BooleanField(read_only=True)
    aceita_versao = serializers.BooleanField(read_only=True)
    numero_da_proxima_versao = serializers.IntegerField(read_only=True)
    versao_atual = VersaoSerializer(read_only=True)
    # US08 — vem da mesma regra do service (RN04), para o front não decidir sozinho.
    pode_sinalizar = serializers.BooleanField(source="pode_ser_sinalizada", read_only=True)
    # US11 — o aluno precisa ler o que o orientador pediu para corrigir.
    ultimo_comentario = serializers.SerializerMethodField()
    # US11 / RF10 — todos os comentários da entrega, do mais antigo ao mais novo (RN14: só crescem).
    comentarios = serializers.SerializerMethodField()

    def get_ultimo_comentario(self, entrega):
        comentario = entrega.comentarios.select_related("autor", "versao").last()
        return ComentarioSerializer(comentario).data if comentario else None

    def get_comentarios(self, entrega):
        comentarios = entrega.comentarios.select_related("autor", "versao")
        return ComentarioSerializer(comentarios, many=True).data

    class Meta:
        model = Entrega
        fields = [
            "id",
            "titulo",
            "estado",
            "prazo",
            "data_criacao",
            "data_conclusao",
            "atrasada",
            "aceita_versao",
            "numero_da_proxima_versao",
            "versao_atual",
            "pode_sinalizar",
            "ultimo_comentario",
            "comentarios",
        ]
        read_only_fields = fields


class EnvioDeVersaoSerializer(serializers.Serializer):
    """US06 — entrada do upload."""

    arquivo = serializers.FileField()


class CriacaoEntregaSerializer(serializers.Serializer):
    """US05 — só título e prazo; o arquivo é a US06."""

    titulo = serializers.CharField(max_length=200)
    prazo = serializers.DateField()


class SolicitacaoCorrecaoSerializer(serializers.Serializer):
    """US11 CA2 / RN07 — o comentário é obrigatório."""

    comentario = serializers.CharField(allow_blank=False, trim_whitespace=True)


class NovoComentarioSerializer(serializers.Serializer):
    """US11 / RF10 — entrada do comentário adicional; o texto é obrigatório (RN07)."""

    comentario = serializers.CharField(allow_blank=False, trim_whitespace=True)


class EventoSerializer(serializers.ModelSerializer):
    usuario_relacionado = OrientadorResumoSerializer(read_only=True)

    class Meta:
        model = Evento
        fields = ["id", "tipo", "descricao", "data_hora", "usuario_relacionado"]


class TCCSerializer(serializers.ModelSerializer):
    aluno = OrientadorResumoSerializer(read_only=True)
    orientador = OrientadorResumoSerializer(source="orientador_atual", read_only=True)
    tema = TemaSerializer(read_only=True)
    entregas = EntregaSerializer(many=True, read_only=True)

    class Meta:
        model = TCC
        fields = ["id", "status_geral", "data_criacao", "aluno", "orientador", "tema", "entregas"]


class OrientandoSerializer(serializers.ModelSerializer):
    """
    Uma linha da tabela "Orientandos" do protótipo.

    As colunas (fase atual, estado, progresso, prazo) vêm prontas daqui para
    o front não precisar recalcular nada a cada render.
    """

    aluno = OrientadorResumoSerializer(read_only=True)
    tema = TemaSerializer(read_only=True)
    entregas = EntregaSerializer(many=True, read_only=True)
    fase_atual = serializers.SerializerMethodField()
    estado = serializers.SerializerMethodField()
    progresso = serializers.SerializerMethodField()
    prazo = serializers.SerializerMethodField()
    prazo_vencido = serializers.SerializerMethodField()
    aguarda_avaliacao_de_tema = serializers.SerializerMethodField()
    # ---------------------------------------------------------------- US13
    entrega_para_banca = serializers.SerializerMethodField()
    entrega_para_revisao = serializers.SerializerMethodField()
    # US11 / RF10 — a entrega que aceita um comentário a mais.
    entrega_para_comentario = serializers.SerializerMethodField()

    class Meta:
        model = TCC
        fields = [
            "id",
            "aluno",
            "tema",
            "entregas",
            "fase_atual",
            "estado",
            "progresso",
            "prazo",
            "prazo_vencido",
            "aguarda_avaliacao_de_tema",
            "entrega_para_revisao",
            "entrega_para_comentario",
            "entrega_para_banca",
        ]

    def _entrega_atual(self, tcc):
        """A primeira entrega ainda em andamento; se não houver, a última."""
        entregas = list(tcc.entregas.all())
        if not entregas:
            return None
        em_andamento = [e for e in entregas if e.estado not in EstadoEntrega.encerrados()]
        return em_andamento[0] if em_andamento else entregas[-1]

    def get_fase_atual(self, tcc):
        tema = getattr(tcc, "tema", None)
        if tema is None or not tema.aprovado:
            return "Tema em análise"
        entrega = self._entrega_atual(tcc)
        return entrega.titulo if entrega else "Sem entregas"

    def get_estado(self, tcc):
        tema = getattr(tcc, "tema", None)
        if tema is None:
            return {"codigo": "sem_tema", "rotulo": "Sem tema"}
        if not tema.aprovado:
            return {"codigo": tema.status, "rotulo": tema.get_status_display()}
        entrega = self._entrega_atual(tcc)
        if entrega is None:
            return {"codigo": "aprovado", "rotulo": "Tema aprovado"}
        return {"codigo": entrega.estado, "rotulo": entrega.get_estado_display()}

    def get_progresso(self, tcc):
        """
        "x de y entregas concluídas", onde y é quantas o aluno criou.

        O protótipo mostrava "1 de 5", sugerindo etapas fixas; as User Stories
        mandam, e na US05 o aluno cria as entregas que quiser.
        """
        entregas = list(tcc.entregas.all())
        concluidas = [e for e in entregas if e.estado in EstadoEntrega.encerrados()]
        return {"concluidas": len(concluidas), "total": len(entregas)}

    def get_prazo(self, tcc):
        entrega = self._entrega_atual(tcc)
        return entrega.prazo if entrega else None

    def get_prazo_vencido(self, tcc):
        entrega = self._entrega_atual(tcc)
        return bool(entrega and entrega.atrasada)

    def get_aguarda_avaliacao_de_tema(self, tcc):
        """Liga o botão "Avaliar tema" na linha."""
        tema = getattr(tcc, "tema", None)
        return bool(tema and tema.status == StatusTema.PROPOSTO)

    def get_entrega_para_revisao(self, tcc):
        """
        US10 / US11 — a entrega que espera uma ação do orientador.

        RN06 — as entregas são revisadas em ordem: só a primeira pendente (que
        não está "concluída" nem "enviada à banca") pode ser revisada, e é a
        mesma "fase atual" da linha. "pronto_para_revisao" liga o botão "Iniciar
        revisão" e "em_revisao" liga o "Solicitar correção". Se a primeira
        pendente ainda é rascunho ou espera correção do aluno, não há ação, e as
        seguintes ficam fora de vista até chegar a vez delas.
        """
        for entrega in tcc.entregas.all():
            if entrega.estado in EstadoEntrega.encerrados():
                continue
            if entrega.estado in (EstadoEntrega.PRONTO_PARA_REVISAO, EstadoEntrega.EM_REVISAO):
                return EntregaSerializer(entrega, context=self.context).data
            return None
        return None

    def get_entrega_para_comentario(self, tcc):
        """
        US11 / RF10 — a entrega que aceita um comentário adicional.

        RN06 — só a primeira pendente, como na revisão. Ela precisa estar "em
        revisão" ou com "correção solicitada" (o comentário a mais serve para
        complementar o pedido sem editar o anterior, RN14). Vem com a lista de
        comentários, para o orientador ler o que já escreveu antes de acrescentar.
        """
        for entrega in tcc.entregas.all():
            if entrega.estado in EstadoEntrega.encerrados():
                continue
            if entrega.estado in (EstadoEntrega.EM_REVISAO, EstadoEntrega.CORRECAO_SOLICITADA):
                return EntregaSerializer(entrega, context=self.context).data
            return None
        return None

    # ---------------------------------------------------------------- US13
    def get_entrega_para_banca(self, tcc):
        """US13 CA1 / RF12 / RN12: primeira concluída ainda não enviada à banca."""
        entrega = next((e for e in tcc.entregas.all() if e.estado == EstadoEntrega.CONCLUIDA), None)
        return EntregaSerializer(entrega, context=self.context).data if entrega else None


# ---------------------------------------------------------------- US12
# A resposta de aprovação usa EntregaSerializer (CA1 / RF11: estado e data_conclusao).

# ---------------------------------------------------------------- US15
class ReatribuicaoSerializer(serializers.Serializer):
    """US15 CA1 / RF14 / RN08, RN09, RN15 / RNF04: destino da reatribuição."""
    novo_orientador = serializers.PrimaryKeyRelatedField(
        queryset=Usuario.objects.orientadores_disponiveis()
    )


class EntregaHistoricoSerializer(EntregaSerializer):
    """US15 CA2 / RF14 / RN08: todas as versões e comentários preservados."""
    versoes = VersaoSerializer(many=True, read_only=True)
    comentarios = ComentarioSerializer(many=True, read_only=True)

    class Meta(EntregaSerializer.Meta):
        fields = EntregaSerializer.Meta.fields + ["versoes", "comentarios"]


class OrientacaoHistoricoSerializer(serializers.ModelSerializer):
    """US15 CA1–CA2 / RF14 / RN08, RN09: vínculos anteriores e atual."""
    orientador = OrientadorResumoSerializer(read_only=True)

    class Meta:
        model = Orientacao
        fields = ["id", "orientador", "data_inicio", "data_fim", "ativa"]
        read_only_fields = fields


class HistoricoTCCSerializer(TCCSerializer):
    """US15 CA2–CA3 / RF14 / RN08, RN10 / RNF04: histórico completo autorizado."""
    entregas = EntregaHistoricoSerializer(many=True, read_only=True)
    eventos = EventoSerializer(many=True, read_only=True)
    orientacoes = OrientacaoHistoricoSerializer(many=True, read_only=True)

    class Meta(TCCSerializer.Meta):
        fields = TCCSerializer.Meta.fields + ["eventos", "orientacoes"]


# ---------------------------------------------------------------- US09 — fila de revisão


class ItemFilaRevisaoSerializer(serializers.ModelSerializer):
    """
    US09 — um item da "Fila de revisão": aluno, entrega, prazo e versão atual.

    `pronta_em` vem de services.fila_de_revisao (data do último Evento
    ENTREGA_PRONTA); com ela a tela mostra "Enviada há N dias". O link do PDF
    sai completo quando a view passa o `request` no contexto.
    """

    aluno = OrientadorResumoSerializer(source="tcc.aluno", read_only=True)
    tcc = serializers.IntegerField(source="tcc_id", read_only=True)
    tema = serializers.CharField(source="tcc.tema.titulo", read_only=True, default=None)
    atrasada = serializers.BooleanField(read_only=True)
    versao_atual = serializers.SerializerMethodField()
    pronta_em = serializers.DateTimeField(read_only=True, default=None)
    # EXTRA (protótipo, fora dos requisitos): a prioridade que este orientador deu à entrega.
    prioridade = serializers.CharField(read_only=True, default=None)

    class Meta:
        model = Entrega
        fields = [
            "id",
            "titulo",
            "estado",
            "prazo",
            "atrasada",
            "tcc",
            "aluno",
            "tema",
            "versao_atual",
            "pronta_em",
            "prioridade",
        ]
        read_only_fields = fields

    def get_versao_atual(self, entrega):
        versao = entrega.versao_atual
        return VersaoSerializer(versao, context=self.context).data if versao else None


# ---------------------------------------------------------------- EXTRA — tela de Revisão
# Fora dos requisitos do documento: a tela de Revisão vem do protótipo do Figma.


class RevisaoEntregaSerializer(EntregaSerializer):
    """
    EXTRA (protótipo) — a entrega aberta na tela de Revisão do orientador.

    Reúne o que as US07, US10, US11, US12 e US13 já expõem em pedaços: o aluno,
    o tema, todas as versões (da mais antiga à mais nova, RN13), os comentários
    (herdados de EntregaSerializer, RF10) e, em `acoes`, o que o orientador pode
    fazer agora, para a tela não decidir regra sozinha (RN06). Traz também a
    prioridade que ESTE orientador deu à entrega (extra, só dele).
    """

    aluno = OrientadorResumoSerializer(source="tcc.aluno", read_only=True)
    tema = serializers.CharField(source="tcc.tema.titulo", read_only=True, default=None)
    versoes = serializers.SerializerMethodField()
    acoes = serializers.SerializerMethodField()
    prioridade = serializers.SerializerMethodField()

    class Meta(EntregaSerializer.Meta):
        fields = EntregaSerializer.Meta.fields + ["aluno", "tema", "versoes", "acoes", "prioridade"]
        read_only_fields = fields

    def get_versoes(self, entrega):
        versoes = entrega.versoes.order_by("data_envio", "id")
        return VersaoSerializer(versoes, many=True, context=self.context).data

    def get_acoes(self, entrega):
        from .services import acoes_da_revisao

        return acoes_da_revisao(entrega)

    def get_prioridade(self, entrega):
        orientador = self.context["request"].user
        registro = entrega.prioridades.filter(orientador=orientador).first()
        return registro.nivel if registro else None


# ---------------------------------------------------------------- EXTRA — prioridade na fila


class NovaPrioridadeSerializer(serializers.Serializer):
    """EXTRA (protótipo) — entrada da prioridade: alta, media, baixa ou sem_prioridade."""

    prioridade = serializers.ChoiceField(choices=["alta", "media", "baixa", "sem_prioridade"])


class AvisoSerializer(serializers.ModelSerializer):
    """
    EXTRA — fora dos requisitos do documento: um item da aba de Avisos.

    É um `Evento` do log (RN10, RF18) visto por quem precisa saber dele. `nao_lido`
    compara com o "visto até" do usuário, que a view passa no contexto.
    """

    de = serializers.CharField(source="usuario_relacionado.nome", default=None, read_only=True)
    entrega_id = serializers.IntegerField(read_only=True)
    nao_lido = serializers.SerializerMethodField()

    class Meta:
        model = Evento
        fields = ["id", "tipo", "descricao", "data_hora", "de", "entrega_id", "nao_lido"]

    def get_nao_lido(self, evento):
        vistos_ate = self.context.get("vistos_ate")
        return vistos_ate is None or evento.data_hora > vistos_ate


class NovoNomeSerializer(serializers.Serializer):
    """EXTRA — PATCH /api/auth/eu/: só o nome pode mudar."""

    nome = serializers.CharField(max_length=150)


class NovaSenhaSerializer(serializers.Serializer):
    """EXTRA — POST /api/auth/alterar-senha/."""

    senha_atual = serializers.CharField(write_only=True, style={"input_type": "password"})
    nova_senha = serializers.CharField(write_only=True, style={"input_type": "password"})
