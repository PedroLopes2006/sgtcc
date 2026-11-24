"""
Modelos do SGTCC: as 9 classes do diagrama (a Notificação entra com a US02)
e os extras marcados como tal.
As RN citadas são as da Especificação do Sistema (Sprint 1), seção 7.
"""
from pathlib import Path

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


class EstadoTrabalhoFinal(models.TextChoices):
    """
    Sprint 4 / RF20, RF21 — estados do trabalho final.

    "Não enviado" não é um estado gravado: é a ausência do registro. O trabalho nasce
    "em avaliação" no primeiro envio (US18).
    """

    EM_AVALIACAO = "em_avaliacao", "Em avaliação"
    CORRECAO_SOLICITADA = "correcao_solicitada", "Correção solicitada"
    APROVADO = "aprovado", "Aprovado"
    REPROVADO = "reprovado", "Reprovado"
    ENVIADO_A_BANCA = "enviado_a_banca", "Enviado à banca"


class StatusGeralTCC(models.TextChoices):
    EM_ANDAMENTO = "em_andamento", "Em andamento"
    CONCLUIDO = "concluido", "Concluído"


class TipoEvento(models.TextChoices):
    TEMA_PROPOSTO = "tema_proposto", "Tema proposto"
    TEMA_REENVIADO = "tema_reenviado", "Tema reenviado"
    TEMA_APROVADO = "tema_aprovado", "Tema aprovado"
    TEMA_AJUSTE_SOLICITADO = "tema_ajuste_solicitado", "Ajuste de tema solicitado"
    ENTREGA_CRIADA = "entrega_criada", "Entrega criada"
    # US08 CA3 — RN10 / RF18: gatilho da notificação ao orientador (RF16).
    ENTREGA_PRONTA = "entrega_pronta", "Entrega sinalizada como pronta"
    UPLOAD = "upload", "Versão enviada"
    # US10 CA1 — RN10 / RF18: gatilho da notificação ao aluno (RF16).
    ENTREGA_EM_REVISAO = "entrega_em_revisao", "Entrega em revisão"
    # US11 CA3 — RN10 / RF18: gatilho da notificação ao aluno (RF16).
    CORRECAO_SOLICITADA = "correcao_solicitada", "Correção solicitada"
    # US11 / RF10 — RN10 / RF18: comentário adicional do orientador (RN14: novo comentário
    # em vez de editar o anterior); gatilho da notificação ao aluno (RF16).
    COMENTARIO_ADICIONADO = "comentario_adicionado", "Comentário adicionado"
    # US12 / US13 — RN10: conclusão e encerramento formal.
    ENTREGA_CONCLUIDA = "entrega_concluida", "Entrega concluída"
    ENTREGA_ENVIADA_A_BANCA = "entrega_enviada_a_banca", "Entrega enviada à banca"
    TROCA_ORIENTADOR = "troca_orientador", "Troca de orientador"
    # Sprint 4 / US18–US20 — RN10: o trabalho final (o TCC completo) tem o seu próprio ciclo.
    # O envio é o gatilho da notificação ao orientador; os demais, ao aluno (RF16).
    TRABALHO_FINAL_ENVIADO = "trabalho_final_enviado", "Trabalho final enviado"
    TRABALHO_FINAL_CORRECAO_SOLICITADA = (
        "trabalho_final_correcao_solicitada",
        "Correção solicitada no trabalho final",
    )
    TRABALHO_FINAL_APROVADO = "trabalho_final_aprovado", "Trabalho final aprovado"
    TRABALHO_FINAL_REPROVADO = "trabalho_final_reprovado", "Trabalho final reprovado"
    TRABALHO_FINAL_ENVIADO_A_BANCA = (
        "trabalho_final_enviado_a_banca",
        "Trabalho final enviado à banca",
    )


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

    def orientadores_disponiveis(self):
        """
        Orientadores que podem ser escolhidos: na proposta de tema (US03 CA1) e
        no destino de uma reatribuição (US15).

        A conta do administrador (superusuário) nasce com perfil de orientador,
        mas serve só à gestão pelo /admin: ela não entra na lista nem pode ser
        indicada. Também ficam de fora as contas inativas.
        """
        return self.filter(perfil=Perfil.ORIENTADOR, is_active=True, is_superuser=False)


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
    # EXTRA — fora dos requisitos do documento: a aba de Avisos. Marca até quando o
    # usuário já viu os avisos; o que for mais novo que isto conta como não lido.
    avisos_lidos_em = models.DateTimeField("avisos vistos até", null=True, blank=True)

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
    # RN13 — contador que só avança. Olhar o maior número existente
    # reaproveitaria o número de uma versão apagada.
    versoes_enviadas = models.PositiveIntegerField("versões enviadas", default=0)

    class Meta:
        verbose_name = "entrega"
        verbose_name_plural = "entregas"
        ordering = ["prazo", "id"]

    def __str__(self):
        return f"{self.titulo} [{self.get_estado_display()}]"

    @property
    def atrasada(self):
        return self.estado not in EstadoEntrega.encerrados() and self.prazo < timezone.localdate()

    @property
    def pode_ser_sinalizada(self):
        """RN04 — em rascunho e com ao menos uma versão enviada."""
        return self.estado == EstadoEntrega.RASCUNHO and self.versoes.exists()

    @property
    def aceita_versao(self):
        """RN03 — upload só em "rascunho" ou "correção solicitada"."""
        return self.estado in (EstadoEntrega.RASCUNHO, EstadoEntrega.CORRECAO_SOLICITADA)

    @property
    def versao_atual(self):
        return self.versoes.first()

    @property
    def numero_da_proxima_versao(self):
        return self.versoes_enviadas + 1

class TrabalhoFinal(models.Model):
    """
    Sprint 4 / RF20, RF21 — o trabalho completo do aluno, enviado depois das entregas.

    É o documento único que une as etapas e recebe o resultado do TCC: aprovado ou
    reprovado pelo orientador, e então enviado à banca (US18 a US20). Um por TCC. As
    versões e os comentários ficam nas mesmas tabelas das entregas (`Versao` e
    `Comentario`), ligados a este registro.
    """

    tcc = models.OneToOneField(TCC, on_delete=models.CASCADE, related_name="trabalho_final")
    estado = models.CharField(
        max_length=25, choices=EstadoTrabalhoFinal.choices, default=EstadoTrabalhoFinal.EM_AVALIACAO
    )
    # RN13 — contador que só avança, como nas entregas.
    versoes_enviadas = models.PositiveIntegerField("versões enviadas", default=0)
    data_criacao = models.DateTimeField(default=timezone.now)
    data_aprovacao = models.DateTimeField(null=True, blank=True)
    data_banca = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "trabalho final"
        verbose_name_plural = "trabalhos finais"

    def __str__(self):
        return f"Trabalho final de {self.tcc.aluno.nome} [{self.get_estado_display()}]"

    @property
    def aceita_versao(self):
        """RN18 — o aluno reenvia depois de um pedido de correção ou de uma reprovação."""
        return self.estado in (
            EstadoTrabalhoFinal.CORRECAO_SOLICITADA,
            EstadoTrabalhoFinal.REPROVADO,
        )

    @property
    def versao_atual(self):
        return self.versoes.first()

    @property
    def numero_da_proxima_versao(self):
        return self.versoes_enviadas + 1


def caminho_da_versao(versao, nome_original):
    """
    tcc/<id>/entrega/<id>/v<n>.pdf (entrega) ou tcc/<id>/trabalho-final/v<n>.pdf —
    previsível e sem colisão entre alunos.
    """
    extensao = Path(nome_original).suffix.lower() or ".pdf"
    if versao.trabalho_final_id:
        return f"tcc/{versao.trabalho_final.tcc_id}/trabalho-final/v{versao.numero}{extensao}"
    return f"tcc/{versao.entrega.tcc_id}/entrega/{versao.entrega_id}/v{versao.numero}{extensao}"


class Versao(models.Model):
    """
    Arquivo enviado pelo aluno: dentro de uma Entrega (US06) ou como versão do
    Trabalho final (US18). Pertence a um dos dois, nunca aos dois (veja a restrição).
    """

    entrega = models.ForeignKey(
        Entrega, on_delete=models.CASCADE, related_name="versoes", null=True, blank=True
    )
    trabalho_final = models.ForeignKey(
        TrabalhoFinal, on_delete=models.CASCADE, related_name="versoes", null=True, blank=True
    )
    numero = models.PositiveIntegerField("número")
    arquivo = models.FileField("arquivo", upload_to=caminho_da_versao)
    nome_original = models.CharField("nome original", max_length=255)
    tamanho = models.PositiveIntegerField("tamanho em bytes")
    enviado_por = models.ForeignKey(Usuario, on_delete=models.PROTECT, related_name="versoes")
    data_envio = models.DateTimeField(default=timezone.now)

    class Meta:
        verbose_name = "versão"
        verbose_name_plural = "versões"
        ordering = ["-numero"]
        constraints = [
            # RN13 — o número não se repete dentro da entrega nem dentro do trabalho final.
            models.UniqueConstraint(
                fields=["entrega", "numero"], name="numero_de_versao_unico_por_entrega"
            ),
            models.UniqueConstraint(
                fields=["trabalho_final", "numero"],
                name="numero_de_versao_unico_por_trabalho_final",
            ),
            # Uma versão é de uma entrega ou do trabalho final, nunca dos dois nem de nenhum.
            models.CheckConstraint(
                condition=(
                    models.Q(entrega__isnull=False, trabalho_final__isnull=True)
                    | models.Q(entrega__isnull=True, trabalho_final__isnull=False)
                ),
                name="versao_de_uma_entrega_ou_do_trabalho_final",
            ),
        ]

    @property
    def tcc_id(self):
        return self.entrega.tcc_id if self.entrega_id else self.trabalho_final.tcc_id

    def __str__(self):
        if self.trabalho_final_id:
            return f"Trabalho final — versão {self.numero}"
        return f"{self.entrega.titulo} — versão {self.numero}"



class Comentario(models.Model):
    """
    Parecer do orientador sobre uma Entrega (RF10).

    US11 — registrado ao solicitar correção (RN07) ou, depois, como comentário
    adicional do orientador (RF10).
    RN14 — não é editado nem removido: a API não expõe nenhuma rota para isso, e
    o ajuste de um comentário vira um comentário novo.
    RF10 — pode apontar a Versão avaliada; se a versão for apagada (RN13), o
    comentário permanece, só perde o vínculo.
    """

    # Sprint 4 — o parecer é de uma entrega ou do trabalho final (veja a restrição abaixo).
    entrega = models.ForeignKey(
        Entrega, on_delete=models.CASCADE, related_name="comentarios", null=True, blank=True
    )
    trabalho_final = models.ForeignKey(
        TrabalhoFinal, on_delete=models.CASCADE, related_name="comentarios", null=True, blank=True
    )
    versao = models.ForeignKey(
        Versao, on_delete=models.SET_NULL, null=True, blank=True, related_name="comentarios"
    )
    autor = models.ForeignKey(Usuario, on_delete=models.PROTECT, related_name="comentarios")
    texto = models.TextField("texto")
    data_criacao = models.DateTimeField(default=timezone.now)

    class Meta:
        verbose_name = "comentário"
        verbose_name_plural = "comentários"
        ordering = ["data_criacao", "id"]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(entrega__isnull=False, trabalho_final__isnull=True)
                    | models.Q(entrega__isnull=True, trabalho_final__isnull=False)
                ),
                name="comentario_de_uma_entrega_ou_do_trabalho_final",
            )
        ]

    def __str__(self):
        alvo = "o trabalho final" if self.trabalho_final_id else self.entrega.titulo
        return f"Comentário de {self.autor.nome} em {alvo}"


class NivelPrioridade(models.TextChoices):
    """Níveis da prioridade de revisão. "Sem prioridade" é a ausência de registro."""

    ALTA = "alta", "Alta"
    MEDIA = "media", "Média"
    BAIXA = "baixa", "Baixa"


class PrioridadeRevisao(models.Model):
    """
    EXTRA — fora dos requisitos do documento: vem do protótipo do Figma.

    Prioridade que o orientador dá a uma entrega da Fila de revisão (alta,
    média ou baixa). É só dele: guarda-se por orientador e por entrega, e o
    aluno nunca vê. Não há RF, RN nem US para isso na especificação do Sprint 1.
    """

    orientador = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name="prioridades")
    entrega = models.ForeignKey(Entrega, on_delete=models.CASCADE, related_name="prioridades")
    nivel = models.CharField(max_length=10, choices=NivelPrioridade.choices)

    class Meta:
        verbose_name = "prioridade de revisão"
        verbose_name_plural = "prioridades de revisão"
        constraints = [
            models.UniqueConstraint(
                fields=["orientador", "entrega"],
                name="uma_prioridade_por_orientador_e_entrega",
            )
        ]

    def __str__(self):
        return f"{self.get_nivel_display()} — {self.entrega.titulo} ({self.orientador.nome})"


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
    # Eventos de uma entrega (sinalização…) apontam para ela; os de tema não.
    # A US09 usa isto para saber desde quando a entrega espera revisão.
    entrega = models.ForeignKey(
        Entrega, on_delete=models.SET_NULL, null=True, blank=True, related_name="eventos"
    )
    data_hora = models.DateTimeField(default=timezone.now)

    class Meta:
        verbose_name = "evento"
        verbose_name_plural = "eventos"
        ordering = ["data_hora", "id"]

    def __str__(self):
        return f"{self.get_tipo_display()} em {self.data_hora:%d/%m/%Y %H:%M}"


class CanalNotificacao(models.TextChoices):
    TELEGRAM = "telegram", "Telegram"
    # RN11 — o usuário não tem canal configurado: a notificação só fica registrada.
    NENHUM = "nenhum", "Nenhum canal"


class StatusEnvio(models.TextChoices):
    PENDENTE = "pendente", "Pendente"
    ENVIADA = "enviada", "Enviada"
    FALHOU = "falhou", "Falhou"
    # US02 CA3 / RN11 — registrada, mas não entregue por falta de canal.
    SEM_CANAL = "sem_canal", "Não enviada (sem canal)"


class Notificacao(models.Model):
    """
    US02 / RF16 / RN11 — registro de cada notificação disparada.

    Nasce de um Evento (RN10) para cada destinatário. Quem tem Telegram vinculado
    recebe a mensagem (CA2); quem não tem fica só com o registro (CA3). Uma falha
    no envio fica anotada aqui e não desfaz a ação do usuário (RNF11).
    `evento` é opcional, como no diagrama: a mensagem de teste do vínculo não tem.
    """

    destinatario = models.ForeignKey(
        Usuario, on_delete=models.CASCADE, related_name="notificacoes",
        verbose_name="destinatário",
    )
    evento = models.ForeignKey(
        Evento, on_delete=models.CASCADE, null=True, blank=True, related_name="notificacoes"
    )
    canal = models.CharField(max_length=20, choices=CanalNotificacao.choices)
    conteudo = models.TextField("conteúdo")
    status_envio = models.CharField(
        "status do envio", max_length=20, choices=StatusEnvio.choices,
        default=StatusEnvio.PENDENTE,
    )
    # Para depuração: o motivo de uma falha de envio.
    erro = models.TextField("erro", blank=True)
    data_hora = models.DateTimeField(default=timezone.now)

    class Meta:
        verbose_name = "notificação"
        verbose_name_plural = "notificações"
        ordering = ["-data_hora", "-id"]

    def __str__(self):
        return f"Para {self.destinatario.nome} — {self.get_status_envio_display()}"


class TentativaLogin(models.Model):
    """
    EXTRA — fora dos requisitos do documento: limite de tentativas de login.

    Conta quantas senhas erradas seguidas houve para um e-mail. Ao chegar ao limite
    (veja `services.LIMITE_TENTATIVAS_LOGIN`) o login daquele e-mail fica bloqueado
    por um tempo. É guardado por e-mail digitado, exista a conta ou não, para a
    resposta não revelar se o e-mail está cadastrado (US01 CA4, RNF03).
    """

    email = models.EmailField("e-mail", unique=True)
    falhas = models.PositiveIntegerField(default=0)
    bloqueado_ate = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "tentativa de login"
        verbose_name_plural = "tentativas de login"

    def __str__(self):
        return f"{self.email}: {self.falhas} falha(s)"
