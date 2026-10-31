"""Base comum dos testes de entrega (US08)."""
from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from core.models import Entrega, Orientacao, Perfil, StatusTema, TCC, Tema, Usuario, Versao


def criar_versao(entrega, numero=None):
    """
    Cria uma versão direto no banco, sem passar pelo upload.

    O upload é a US06. Quando ela completar o modelo `Versao` (nome original,
    tamanho, autor, arquivo obrigatório…), ajuste só esta função: os testes da
    US08 continuam iguais.
    """
    numero = numero or entrega.versoes.count() + 1
    return Versao.objects.create(entrega=entrega, numero=numero)


class BaseEntregaTests(APITestCase):
    def setUp(self):
        self.aluno = Usuario.objects.create_user(
            email="lucas@aluno.edu.br", nome="Lucas", senha="senhaForte123", perfil=Perfil.ALUNO
        )
        self.orientador = Usuario.objects.create_user(
            email="marcos@prof.edu.br", nome="Marcos", senha="senhaForte123",
            perfil=Perfil.ORIENTADOR,
        )
        self.tcc = TCC.objects.create(aluno=self.aluno)
        Tema.objects.create(
            tcc=self.tcc, titulo="Gestão de TCC", descricao="Sistema web.",
            status=StatusTema.APROVADO, data_aprovacao=timezone.now(),
        )
        self.orientacao = Orientacao.objects.create(tcc=self.tcc, orientador=self.orientador)
        self.entrega = Entrega.objects.create(
            tcc=self.tcc, titulo="Capítulo 1", prazo=timezone.localdate() + timedelta(days=30)
        )
        self.client.force_authenticate(self.aluno)

    # ---- atalhos

    def sinalizar(self, entrega=None):
        entrega = entrega or self.entrega
        return self.client.post(reverse("sinalizar-pronta", args=[entrega.id]))

    def definir_estado(self, estado, entrega=None):
        entrega = entrega or self.entrega
        Entrega.objects.filter(pk=entrega.pk).update(estado=estado)
        entrega.refresh_from_db()

    def outro_aluno(self):
        return Usuario.objects.create_user(
            email="ana@aluno.edu.br", nome="Ana", senha="senhaForte123", perfil=Perfil.ALUNO
        )
