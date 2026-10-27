"""
Endpoints do Sprint 3 — US01, US03, US04 e US05.

As views ficam finas de propósito: validam entrada, chamam core.services e
devolvem o estado resultante. As regras de negócio estão em services.py.
"""
from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from . import services
from .models import Entrega, Perfil, StatusTema, TCC, Tema, Usuario
from .permissions import EhAluno, EhOrientador
from .serializers import (
    CadastroSerializer,
    CriacaoEntregaSerializer,
    EntregaSerializer,
    EventoSerializer,
    LoginSerializer,
    OrientadorResumoSerializer,
    OrientandoSerializer,
    PropostaTemaSerializer,
    ReenvioTemaSerializer,
    SolicitacaoAjusteSerializer,
    SolicitacaoCorrecaoSerializer,
    TCCSerializer,
    TemaSerializer,
    UsuarioSerializer,
)


def traduzir_erros_de_dominio(funcao):
    """Converte as exceções do Django levantadas em services para erros da API."""

    def wrapper(*args, **kwargs):
        try:
            return funcao(*args, **kwargs)
        except DjangoValidationError as erro:
            detalhe = erro.message_dict if hasattr(erro, "message_dict") else {"detail": erro.messages}
            raise ValidationError(detalhe)
        except DjangoPermissionDenied as erro:
            raise PermissionDenied(str(erro))

    return wrapper


# ---------------------------------------------------------------- US01


class CadastroView(APIView):
    """US01 CA1 e CA2 — POST /api/auth/registrar/"""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = CadastroSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        usuario = serializer.save()
        return Response(UsuarioSerializer(usuario).data, status=status.HTTP_201_CREATED)


class LoginView(TokenObtainPairView):
    """US01 CA3 e CA4 — POST /api/auth/login/"""

    permission_classes = [AllowAny]
    serializer_class = LoginSerializer


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def eu(request):
    """Dados do usuário logado — o front usa o perfil para escolher o painel."""
    return Response(UsuarioSerializer(request.user).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def listar_orientadores(request):
    """US03 CA1 — o aluno precisa escolher entre orientadores cadastrados."""
    orientadores = Usuario.objects.filter(perfil=Perfil.ORIENTADOR, is_active=True)
    return Response(OrientadorResumoSerializer(orientadores, many=True).data)


# ---------------------------------------------------------------- US03


class MeuTCCView(APIView):
    """Estado atual do TCC do aluno logado: tema, orientador e entregas."""

    permission_classes = [IsAuthenticated, EhAluno]

    def get(self, request):
        tcc = TCC.objects.filter(aluno=request.user).first()
        if tcc is None:
            return Response({"tcc": None})
        return Response(TCCSerializer(tcc).data)


class ProporTemaView(APIView):
    """US03 — POST /api/temas/"""

    permission_classes = [IsAuthenticated, EhAluno]

    @traduzir_erros_de_dominio
    def post(self, request):
        serializer = PropostaTemaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        dados = serializer.validated_data

        tema = services.propor_tema(
            aluno=request.user,
            titulo=dados["titulo"],
            descricao=dados["descricao"],
            orientador=Usuario.objects.get(id=dados["orientador_id"]),
        )
        return Response(TemaSerializer(tema).data, status=status.HTTP_201_CREATED)


class ReenviarTemaView(APIView):
    """US03 CA4 — POST /api/temas/<id>/reenviar/"""

    permission_classes = [IsAuthenticated, EhAluno]

    @traduzir_erros_de_dominio
    def post(self, request, tema_id):
        serializer = ReenvioTemaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tema = get_object_or_404(Tema, id=tema_id)
        tema = services.reenviar_tema(
            aluno=request.user,
            tema=tema,
            titulo=serializer.validated_data["titulo"],
            descricao=serializer.validated_data["descricao"],
        )
        return Response(TemaSerializer(tema).data)


# ---------------------------------------------------------------- US04


@api_view(["GET"])
@permission_classes([IsAuthenticated, EhOrientador])
def temas_pendentes(request):
    """Fila de temas aguardando parecer do orientador logado."""
    temas = Tema.objects.filter(
        status=StatusTema.PROPOSTO,
        tcc__orientacoes__orientador=request.user,
        tcc__orientacoes__ativa=True,
    ).select_related("tcc__aluno")
    return Response(TemaSerializer(temas, many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated, EhOrientador])
def meus_orientandos(request):
    """Visão de conjunto dos TCCs que o orientador acompanha."""
    tccs = (
        TCC.objects.filter(orientacoes__orientador=request.user, orientacoes__ativa=True)
        .select_related("aluno", "tema")
        .prefetch_related("entregas")
        .distinct()
    )
    return Response(OrientandoSerializer(tccs, many=True).data)


class AprovarTemaView(APIView):
    """US04 CA1 — POST /api/temas/<id>/aprovar/"""

    permission_classes = [IsAuthenticated, EhOrientador]

    @traduzir_erros_de_dominio
    def post(self, request, tema_id):
        tema = get_object_or_404(Tema, id=tema_id)
        tema = services.aprovar_tema(orientador=request.user, tema=tema)
        return Response(TemaSerializer(tema).data)


class SolicitarAjusteTemaView(APIView):
    """US04 CA2 — POST /api/temas/<id>/solicitar-ajuste/"""

    permission_classes = [IsAuthenticated, EhOrientador]

    @traduzir_erros_de_dominio
    def post(self, request, tema_id):
        serializer = SolicitacaoAjusteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tema = get_object_or_404(Tema, id=tema_id)
        tema = services.solicitar_ajuste_tema(
            orientador=request.user,
            tema=tema,
            justificativa=serializer.validated_data["justificativa"],
        )
        return Response(TemaSerializer(tema).data)


# ---------------------------------------------------------------- US05


class EntregasView(APIView):
    """US05 — GET e POST /api/entregas/"""

    permission_classes = [IsAuthenticated, EhAluno]

    def get(self, request):
        tcc = TCC.objects.filter(aluno=request.user).first()
        entregas = tcc.entregas.all() if tcc else []
        return Response(EntregaSerializer(entregas, many=True).data)

    @traduzir_erros_de_dominio
    def post(self, request):
        serializer = CriacaoEntregaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        entrega = services.criar_entrega(
            aluno=request.user,
            titulo=serializer.validated_data["titulo"],
            prazo=serializer.validated_data["prazo"],
        )
        return Response(EntregaSerializer(entrega).data, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------- US10


class IniciarRevisaoView(APIView):
    """
    US10 CA1 e CA2 — POST /api/entregas/<id>/iniciar-revisao/

    RNF04: exclusivo de orientadores. RN05 e RN06 são aplicadas no service.
    """

    permission_classes = [IsAuthenticated, EhOrientador]

    @traduzir_erros_de_dominio
    def post(self, request, entrega_id):
        entrega = get_object_or_404(Entrega, id=entrega_id)
        entrega = services.iniciar_revisao_entrega(orientador=request.user, entrega=entrega)
        return Response(EntregaSerializer(entrega).data)


# ---------------------------------------------------------------- US11


class SolicitarCorrecaoView(APIView):
    """
    US11 CA1, CA2 e CA3 — POST /api/entregas/<id>/solicitar-correcao/

    RNF04: exclusivo de orientadores. RN05, RN06 e RN07 são aplicadas no service.
    RN14: não há rota para editar ou remover comentários.
    """

    permission_classes = [IsAuthenticated, EhOrientador]

    @traduzir_erros_de_dominio
    def post(self, request, entrega_id):
        serializer = SolicitacaoCorrecaoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        entrega = get_object_or_404(Entrega, id=entrega_id)
        entrega = services.solicitar_correcao_entrega(
            orientador=request.user,
            entrega=entrega,
            comentario=serializer.validated_data["comentario"],
        )
        return Response(EntregaSerializer(entrega).data)


# ---------------------------------------------------------------- log


@api_view(["GET"])
@permission_classes([IsAuthenticated, EhAluno])
def meus_eventos(request):
    """Base da timeline da US16 — já alimentada pelos eventos deste sprint."""
    tcc = TCC.objects.filter(aluno=request.user).first()
    eventos = tcc.eventos.all() if tcc else []
    return Response(EventoSerializer(eventos, many=True).data)
