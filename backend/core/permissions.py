"""RNF04 — o acesso respeita o perfil do usuário."""
from rest_framework.permissions import BasePermission

from .models import Perfil


class EhAluno(BasePermission):
    message = "Esta ação é exclusiva de alunos."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and request.user.perfil == Perfil.ALUNO)


class EhOrientador(BasePermission):
    message = "Esta ação é exclusiva de orientadores."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and request.user.perfil == Perfil.ORIENTADOR)
