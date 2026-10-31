from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

urlpatterns = [
    # US01
    path("auth/registrar/", views.CadastroView.as_view(), name="registrar"),
    path("auth/login/", views.LoginView.as_view(), name="login"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="refresh"),
    path("auth/eu/", views.eu, name="eu"),
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
    # log / base da timeline
    path("eventos/", views.meus_eventos, name="eventos"),
]
