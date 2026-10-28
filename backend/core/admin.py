from django.contrib import admin

from .models import Entrega, Evento, Orientacao, TCC, Tema, Usuario, Versao


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
class EventoAdmin(admin.ModelAdmin):
    list_display = ("tcc", "tipo", "data_hora")
    list_filter = ("tipo",)

@admin.register(Versao)
class VersaoAdmin(admin.ModelAdmin):
    """Provisório: permite criar uma versão à mão para testar a US08 até a US06 entrar."""

    list_display = ("entrega", "numero", "data_envio")

