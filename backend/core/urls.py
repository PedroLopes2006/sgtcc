from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

urlpatterns = [
    # US01
    path("auth/registrar/", views.CadastroView.as_view(), name="registrar"),
    path("auth/login/", views.LoginView.as_view(), name="login"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="refresh"),
    path("auth/eu/", views.eu, name="eu"),
    # EXTRA (fora dos requisitos) — perfil editável e aba de Avisos
    path("auth/alterar-senha/", views.alterar_senha, name="alterar-senha"),
    path("avisos/", views.avisos, name="avisos"),
    path("avisos/marcar-lidos/", views.marcar_avisos_lidos, name="marcar-avisos-lidos"),
    # US03
    path("orientadores/", views.listar_orientadores, name="orientadores"),
    path("meu-tcc/", views.MeuTCCView.as_view(), name="meu-tcc"),
    path("temas/", views.ProporTemaView.as_view(), name="propor-tema"),
    path("temas/<int:tema_id>/reenviar/", views.ReenviarTemaView.as_view(), name="reenviar-tema"),
    # US04
    path("temas/pendentes/", views.temas_pendentes, name="temas-pendentes"),
    path("orientandos/", views.meus_orientandos, name="orientandos"),
    path("temas/<int:tema_id>/aprovar/", views.AprovarTemaView.as_view(), name="aprovar-tema"),
    path(
        "temas/<int:tema_id>/solicitar-ajuste/",
        views.SolicitarAjusteTemaView.as_view(),
        name="solicitar-ajuste-tema",
    ),
    # US05
    path("entregas/", views.EntregasView.as_view(), name="entregas"),
    # US06
    path("entregas/<int:entrega_id>/versoes/", views.VersoesView.as_view(), name="versoes"),
    # US08
    path(
        "entregas/<int:entrega_id>/sinalizar-pronta/",
        views.SinalizarProntaView.as_view(),
        name="sinalizar-pronta",
    ),
    # US10
    path(
        "entregas/<int:entrega_id>/iniciar-revisao/",
        views.IniciarRevisaoView.as_view(),
        name="iniciar-revisao",
    ),
    # US11
    path(
        "entregas/<int:entrega_id>/solicitar-correcao/",
        views.SolicitarCorrecaoView.as_view(),
        name="solicitar-correcao",
    ),
    # US11 / RF10 — comentário adicional, sem mudar o estado
    path(
        "entregas/<int:entrega_id>/comentarios/",
        views.ComentarioAdicionalView.as_view(),
        name="adicionar-comentario",
    ),
    # ---------------------------------------------------------------- US12
    path("entregas/<int:entrega_id>/aprovar/", views.AprovarEntregaView.as_view(), name="aprovar-entrega"),
    # ---------------------------------------------------------------- US13
    path("entregas/<int:entrega_id>/enviar-a-banca/", views.EnviarABancaView.as_view(), name="enviar-a-banca"),
    # ---------------------------------------------------------------- US15
    path("orientandos/<int:tcc_id>/reatribuir/", views.ReatribuirOrientadorView.as_view(), name="reatribuir-orientador"),
    path("orientandos/<int:tcc_id>/historico/", views.HistoricoOrientandoView.as_view(), name="historico-orientando"),
    # US09 — fila de revisão
    path("fila-revisao/", views.fila_revisao, name="fila-revisao"),
    # EXTRA (protótipo, fora dos requisitos) — tela de Revisão do orientador
    path("entregas/<int:entrega_id>/revisao/", views.RevisaoEntregaView.as_view(), name="revisao-entrega"),
    # EXTRA (protótipo, fora dos requisitos) — prioridade na fila de revisão
    path(
        "entregas/<int:entrega_id>/prioridade/",
        views.PrioridadeEntregaView.as_view(),
        name="prioridade-entrega",
    ),
    # log / base da timeline
    path("eventos/", views.meus_eventos, name="eventos"),
]
