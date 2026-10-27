"""
Modelos do SGTCC. Escopo do Sprint 3: US01, US03, US04 e US05.

Versão, Comentário e Notificação ficam para a US06 em diante.
As RN citadas são as da Especificação do Sistema (Sprint 1), seção 7.
"""
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


class Perfil(models.TextChoices):
    ALUNO = "aluno", "Aluno"
    ORIENTADOR = "orientador", "Orientador"


class StatusTema(models.TextChoices):
    PROPOSTO = "proposto", "Proposto"
    APROVADO = "aprovado", "Aprovado"
    AJUSTE_SOLICITADO = "ajuste_solicitado", "Ajuste solicitado"


class EstadoEntrega(models.TextChoices):
    RASCUNHO = "rascunho", "Rascunho"
    PRONTO_PARA_REVISAO = "pronto_para_revisao", "Pronto para revisão"
    EM_REVISAO = "em_revisao", "Em revisão"
    CORRECAO_SOLICITADA = "correcao_solicitada", "Correção solicitada"
    CONCLUIDA = "concluida", "Concluída"
    ENVIADA_A_BANCA = "enviada_a_banca", "Enviada à banca"

    @classmethod
    def encerrados(cls):
        """Estados em que a etapa não conta mais como trabalho em andamento."""
        return (cls.CONCLUIDA, cls.ENVIADA_A_BANCA)


class StatusGeralTCC(models.TextChoices):
    EM_ANDAMENTO = "em_andamento", "Em andamento"
    CONCLUIDO = "concluido", "Concluído"


class TipoEvento(models.TextChoices):
    TEMA_PROPOSTO = "tema_proposto", "Tema proposto"
    TEMA_REENVIADO = "tema_reenviado", "Tema reenviado"
    TEMA_APROVADO = "tema_aprovado", "Tema aprovado"
    TEMA_AJUSTE_SOLICITADO = "tema_ajuste_solicitado", "Ajuste de tema solicitado"
    ENTREGA_CRIADA = "entrega_criada", "Entrega criada"
    # US10 CA1 — RN10 / RF18: gatilho da notificação ao aluno (RF16).
    ENTREGA_EM_REVISAO = "entrega_em_revisao", "Entrega em revisão"
    TROCA_ORIENTADOR = "troca_orientador", "Troca de orientador"


class UsuarioManager(BaseUserManager):
    """Gerencia a criação de usuários com e-mail como identificador."""

    use_in_migrations = True

    def _create_user(self, email, nome, senha, perfil, **extra):
        if not email:
            raise ValueError("O e-mail é obrigatório.")
        email = self.normalize_email(email).lower()
        usuario = self.model(email=email, nome=nome, perfil=perfil, **extra)
        # RNF03 — a senha nunca é persistida em texto plano.
        usuario.set_password(senha)
        usuario.full_clean(exclude=["password"])
        usuario.save(using=self._db)
        return usuario

    def create_user(self, email, nome="", senha=None, perfil=Perfil.ALUNO, password=None, **extra):
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create_user(email, nome, senha or password, perfil, **extra)

    def create_superuser(
        self, email, nome="Admin", senha=None, perfil=Perfil.ORIENTADOR, password=None, **extra
    ):
        """`password`: nome usado pelo createsuperuser do Django."""
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        return self._create_user(email, nome, senha or password, perfil, **extra)


class Usuario(AbstractBaseUser, PermissionsMixin):
    """Aluno ou orientador — entidade única para reaproveitar a autenticação."""

    nome = models.CharField("nome", max_length=150)
    email = models.EmailField("e-mail", unique=True)  # US01 CA2 — impede duplicidade
    perfil = models.CharField("perfil", max_length=20, choices=Perfil.choices)
    telegram_chat_id = models.CharField(
        "chat_id do Telegram", max_length=64, blank=True, null=True
    )
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    data_cadastro = models.DateTimeField(default=timezone.now)

    objects = UsuarioManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["nome", "perfil"]

    class Meta:
        verbose_name = "usuário"
        verbose_name_plural = "usuários"
        ordering = ["nome"]

    def __str__(self):
        return f"{self.nome} ({self.get_perfil_display()})"

    @property
    def eh_aluno(self):
        return self.perfil == Perfil.ALUNO

    @property
    def eh_orientador(self):
        return self.perfil == Perfil.ORIENTADOR


class TCC(models.Model):
    """O trabalho em si. RN01 — um aluno possui exatamente um TCC ativo por vez."""

    aluno = models.OneToOneField(
        Usuario, on_delete=models.CASCADE, related_name="tcc", verbose_name="aluno"
    )
    status_geral = models.CharField(
        max_length=20, choices=StatusGeralTCC.choices, default=StatusGeralTCC.EM_ANDAMENTO
    )
    data_criacao = models.DateTimeField(default=timezone.now)

    class Meta:
        verbose_name = "TCC"
        verbose_name_plural = "TCCs"

    def __str__(self):
        return f"TCC de {self.aluno.nome}"

    def clean(self):
        if self.aluno_id and not self.aluno.eh_aluno:
            raise ValidationError({"aluno": "Somente usuários com perfil de aluno podem ter TCC."})

    @property
    def orientacao_ativa(self):
        return self.orientacoes.filter(ativa=True).first()

    @property
    def orientador_atual(self):
        orientacao = self.orientacao_ativa
        return orientacao.orientador if orientacao else None


class Tema(models.Model):
    """Proposta de assunto do TCC, com ciclo de aprovação próprio."""

    tcc = models.OneToOneField(TCC, on_delete=models.CASCADE, related_name="tema")
    titulo = models.CharField("título", max_length=200)
    descricao = models.TextField("descrição")
    status = models.CharField(max_length=20, choices=StatusTema.choices, default=StatusTema.PROPOSTO)
    justificativa_ajuste = models.TextField("justificativa do ajuste", blank=True)
    data_proposta = models.DateTimeField(default=timezone.now)
    data_aprovacao = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "tema"
        verbose_name_plural = "temas"

    def __str__(self):
        return f"{self.titulo} [{self.get_status_display()}]"

    @property
    def aprovado(self):
        return self.status == StatusTema.APROVADO


class Orientacao(models.Model):
    """
    Vínculo histórico entre orientador e TCC.

    RN09 — um TCC pode ter apenas uma Orientação ativa por vez (garantido pela
    constraint parcial abaixo, no próprio banco).
    """

    tcc = models.ForeignKey(TCC, on_delete=models.CASCADE, related_name="orientacoes")
    orientador = models.ForeignKey(
        Usuario, on_delete=models.PROTECT, related_name="orientacoes"
    )
    data_inicio = models.DateTimeField(default=timezone.now)
    data_fim = models.DateTimeField(null=True, blank=True)
    ativa = models.BooleanField(default=True)

    class Meta:
        verbose_name = "orientação"
        verbose_name_plural = "orientações"
        ordering = ["-data_inicio"]
        constraints = [
            models.UniqueConstraint(
                fields=["tcc"],
                condition=models.Q(ativa=True),
                name="uma_orientacao_ativa_por_tcc",
            )
        ]

    def __str__(self):
        return f"{self.orientador.nome} → {self.tcc}"

    def clean(self):
        if self.orientador_id and not self.orientador.eh_orientador:
            raise ValidationError(
                {"orientador": "O usuário indicado não tem perfil de orientador."}
            )

    def encerrar(self):
        """RN08 — encerra a orientação sem apagar nada do histórico."""
        self.ativa = False
        self.data_fim = timezone.now()
        self.save(update_fields=["ativa", "data_fim"])


class Entrega(models.Model):
    """Etapa do TCC, portadora do estado explícito do fluxo de revisão."""

    tcc = models.ForeignKey(TCC, on_delete=models.CASCADE, related_name="entregas")
    titulo = models.CharField("título", max_length=200)
    estado = models.CharField(
        max_length=25, choices=EstadoEntrega.choices, default=EstadoEntrega.RASCUNHO
    )
    prazo = models.DateField("prazo")
    data_criacao = models.DateTimeField(default=timezone.now)
    data_conclusao = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "entrega"
        verbose_name_plural = "entregas"
        ordering = ["prazo", "id"]

    def __str__(self):
        return f"{self.titulo} [{self.get_estado_display()}]"

    @property
    def atrasada(self):
        return self.estado not in EstadoEntrega.encerrados() and self.prazo < timezone.localdate()


class Evento(models.Model):
    """
    Log imutável do ciclo de vida do TCC.

    RN10 — toda mudança de estado relevante gera um Evento.
    RNF12 — o histórico é só de inclusão; nada aqui é editado ou removido.
    """

    tcc = models.ForeignKey(TCC, on_delete=models.CASCADE, related_name="eventos")
    tipo = models.CharField(max_length=40, choices=TipoEvento.choices)
    descricao = models.TextField("descrição")
    usuario_relacionado = models.ForeignKey(
        Usuario, on_delete=models.SET_NULL, null=True, blank=True, related_name="eventos"
    )
    data_hora = models.DateTimeField(default=timezone.now)

    class Meta:
        verbose_name = "evento"
        verbose_name_plural = "eventos"
        ordering = ["data_hora", "id"]

    def __str__(self):
        return f"{self.get_tipo_display()} em {self.data_hora:%d/%m/%Y %H:%M}"
