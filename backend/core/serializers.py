"""Serializers do Sprint 3."""
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

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
        fields = ["id", "nome", "email", "perfil", "telegram_chat_id"]
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
        attrs[self.username_field] = attrs.get(self.username_field, "").strip().lower()
        dados = super().validate(attrs)
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
        if not Usuario.objects.filter(id=valor, perfil=Perfil.ORIENTADOR).exists():
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
        try:
            return versao.arquivo.url
        except (ValueError, NotImplementedError):
            return None


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

    def get_ultimo_comentario(self, entrega):
        comentario = entrega.comentarios.select_related("autor", "versao").last()
        return ComentarioSerializer(comentario).data if comentario else None

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
    entrega_para_revisao = serializers.SerializerMethodField()

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
        US10 / US11 — a primeira entrega que espera uma ação do orientador.

        "pronto_para_revisao" liga o botão "Iniciar revisão" e "em_revisao" liga
        o "Solicitar correção". A "entrega atual" da linha não serve aqui: ela
        é a primeira em andamento, que pode ser um rascunho do aluno.
        """
        for entrega in tcc.entregas.all():
            if entrega.estado in (EstadoEntrega.PRONTO_PARA_REVISAO, EstadoEntrega.EM_REVISAO):
                return EntregaSerializer(entrega).data
        return None
