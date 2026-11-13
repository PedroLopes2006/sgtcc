"""
RNF01 — as operações principais (login, upload, mudança de estado) respondem em
até 3 segundos em condições normais de uso.

Mede o tempo de cada operação na própria API, com banco de teste e arquivo em
pasta temporária. Isso confere o trabalho do nosso código: a hospedagem gratuita
(Render dormindo, rede, Supabase) fica de fora e precisa ser medida no ambiente
final. O limite é o do requisito, e o teste serve de alarme se alguma mudança
tornar uma dessas operações lenta.
"""
import shutil
import tempfile
import time
from datetime import timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from core.models import Entrega, Orientacao, Perfil, StatusTema, TCC, Tema, Usuario

LIMITE_EM_SEGUNDOS = 3
ARMAZENAMENTO_TEMPORARIO = tempfile.mkdtemp()


@override_settings(MEDIA_ROOT=ARMAZENAMENTO_TEMPORARIO)
class DesempenhoDasOperacoesPrincipaisTests(APITestCase):
    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(ARMAZENAMENTO_TEMPORARIO, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        self.aluno = Usuario.objects.create_user(
            email="lucas@aluno.edu.br", nome="Lucas", senha="senhaForte123", perfil=Perfil.ALUNO
        )
        self.orientador = Usuario.objects.create_user(
            email="marcos@prof.edu.br", nome="Marcos", senha="senhaForte123",
            perfil=Perfil.ORIENTADOR,
        )
        tcc = TCC.objects.create(aluno=self.aluno)
        Tema.objects.create(
            tcc=tcc, titulo="Gestão de TCC", descricao="Sistema web.",
            status=StatusTema.APROVADO, data_aprovacao=timezone.now(),
        )
        Orientacao.objects.create(tcc=tcc, orientador=self.orientador)
        self.entrega = Entrega.objects.create(
            tcc=tcc, titulo="Capítulo 1", prazo=timezone.localdate() + timedelta(days=20)
        )

    def medir(self, chamada, esperado):
        inicio = time.perf_counter()
        resposta = chamada()
        duracao = time.perf_counter() - inicio
        self.assertEqual(resposta.status_code, esperado)
        self.assertLess(duracao, LIMITE_EM_SEGUNDOS, f"levou {duracao:.2f}s")
        return duracao

    def test_login(self):
        self.medir(
            lambda: self.client.post(
                reverse("login"),
                {"email": "lucas@aluno.edu.br", "password": "senhaForte123"},
                format="json",
            ),
            status.HTTP_200_OK,
        )

    def test_upload_de_versao(self):
        self.client.force_authenticate(self.aluno)
        pdf = SimpleUploadedFile(
            "capitulo.pdf", b"%PDF-1.4 " + b"x" * 1_000_000, content_type="application/pdf"
        )
        self.medir(
            lambda: self.client.post(
                reverse("versoes", args=[self.entrega.id]), {"arquivo": pdf}, format="multipart"
            ),
            status.HTTP_201_CREATED,
        )

    def test_mudancas_de_estado_da_entrega(self):
        self.client.force_authenticate(self.aluno)
        pdf = SimpleUploadedFile("c.pdf", b"%PDF-1.4 x", content_type="application/pdf")
        self.client.post(
            reverse("versoes", args=[self.entrega.id]), {"arquivo": pdf}, format="multipart"
        )

        self.medir(
            lambda: self.client.post(reverse("sinalizar-pronta", args=[self.entrega.id])),
            status.HTTP_200_OK,
        )

        self.client.force_authenticate(self.orientador)
        self.medir(
            lambda: self.client.post(reverse("iniciar-revisao", args=[self.entrega.id])),
            status.HTTP_200_OK,
        )
        self.medir(
            lambda: self.client.post(reverse("aprovar-entrega", args=[self.entrega.id])),
            status.HTTP_200_OK,
        )
        self.medir(
            lambda: self.client.post(reverse("enviar-a-banca", args=[self.entrega.id])),
            status.HTTP_200_OK,
        )
