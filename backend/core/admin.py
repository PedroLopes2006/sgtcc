from django.contrib import admin

from .models import Comentario, Entrega, Evento, Orientacao, TCC, Tema, Usuario, Versao


class SomenteLeituraAdmin(admin.ModelAdmin):
    """
    RN14 / RNF12 — registros que só se consultam.

    O log de eventos e os comentários de correção são só de inclusão: nascem
    pelas ações do sistema e nunca são criados, alterados nem apagados à mão.
    """

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Usuario)
class UsuarioAdmin(admin.ModelAdmin):
    list_display = ("nome", "email", "perfil", "is_active")
    list_filter = ("perfil", "is_active")
    search_fields = ("nome", "email")


@admin.register(TCC)
class TCCAdmin(admin.ModelAdmin):
    list_display = ("aluno", "status_geral", "data_criacao")


@admin.register(Tema)
class TemaAdmin(admin.ModelAdmin):
    list_display = ("titulo", "tcc", "status", "data_aprovacao")
    list_filter = ("status",)


@admin.register(Orientacao)
class OrientacaoAdmin(admin.ModelAdmin):
    list_display = ("tcc", "orientador", "ativa", "data_inicio", "data_fim")
    list_filter = ("ativa",)


@admin.register(Entrega)
class EntregaAdmin(admin.ModelAdmin):
    list_display = ("titulo", "tcc", "estado", "prazo")
    list_filter = ("estado",)


@admin.register(Evento)
class EventoAdmin(SomenteLeituraAdmin):
    """Log do ciclo de vida do TCC (RN10, RNF12): somente leitura."""

    list_display = ("tcc", "tipo", "entrega", "usuario_relacionado", "data_hora")
    list_filter = ("tipo",)


@admin.register(Comentario)
class ComentarioAdmin(SomenteLeituraAdmin):
    """Comentários de correção (US11, RF10): somente leitura, conforme a RN14."""

    list_display = ("entrega", "versao", "autor", "data_criacao")


@admin.register(Versao)
class VersaoAdmin(admin.ModelAdmin):
    """Versões enviadas pelos alunos (US06), para consulta."""

    list_display = ("entrega", "numero", "enviado_por", "data_envio")

