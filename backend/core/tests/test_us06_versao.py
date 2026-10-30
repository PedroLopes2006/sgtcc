"""US06 — Upload de versão."""
import shutil
import tempfile
from datetime import timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from core.models import (
    Entrega,
    EstadoEntrega,
    Orientacao,
    Perfil,
    StatusTema,
    TCC,
    Tema,
    TipoEvento,
    Usuario,
    Versao,
)

ARMAZENAMENTO_TEMPORARIO = tempfile.mkdtemp()


def pdf(nome="capitulo.pdf", conteudo=b"%PDF-1.4 conteudo de teste"):
    return SimpleUploadedFile(nome, conteudo, content_type="application/pdf")


@override_settings(MEDIA_ROOT=ARMAZENAMENTO_TEMPORARIO)
class EnviarVersaoTests(APITestCase):
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
        self.tcc = TCC.objects.create(aluno=self.aluno)
        Tema.objects.create(
            tcc=self.tcc, titulo="Gestão de TCC", descricao="Sistema web.",
            status=StatusTema.APROVADO, data_aprovacao=timezone.now(),
        )
        Orientacao.objects.create(tcc=self.tcc, orientador=self.orientador)
        self.entrega = Entrega.objects.create(
            tcc=self.tcc,
            titulo="Referencial teórico",
            prazo=timezone.localdate() + timedelta(days=20),
        )
        self.client.force_authenticate(self.aluno)

    def enviar(self, arquivo=None, entrega=None):
        return self.client.post(
            reverse("versoes", args=[(entrega or self.entrega).id]),
            {"arquivo": arquivo or pdf()},
            format="multipart",
        )

    # ------------------------------------------------------------ CA1

    def test_ca1_rascunho_aceita_versao_e_numera_a_partir_de_um(self):
        resposta = self.enviar()

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resposta.data["versao"]["numero"], 1)

        versao = Versao.objects.get()
        self.assertEqual(versao.entrega, self.entrega)
        self.assertEqual(versao.enviado_por, self.aluno)
        self.assertEqual(versao.nome_original, "capitulo.pdf")
        self.assertTrue(versao.arquivo.name.endswith(".pdf"))

    def test_ca1_numeracao_e_incremental(self):
        self.enviar(pdf("v1.pdf"))
        self.enviar(pdf("v2.pdf"))
        terceira = self.enviar(pdf("v3.pdf"))

        self.assertEqual(terceira.data["versao"]["numero"], 3)
        self.assertEqual(
            list(Versao.objects.order_by("numero").values_list("numero", flat=True)), [1, 2, 3]
        )

    def test_ca1_correcao_solicitada_tambem_aceita_versao(self):
        self.entrega.estado = EstadoEntrega.CORRECAO_SOLICITADA
        self.entrega.save()

        self.assertEqual(self.enviar().status_code, status.HTTP_201_CREATED)

    def test_rn13_numero_nao_e_reaproveitado_apos_exclusao(self):
        self.enviar(pdf("v1.pdf"))
        self.enviar(pdf("v2.pdf"))
        Versao.objects.get(numero=2).delete()

        nova = self.enviar(pdf("v3.pdf"))
        self.assertEqual(nova.data["versao"]["numero"], 3)

    # ------------------------------------------------------------ CA2

    def test_ca2_de_correcao_solicitada_a_entrega_volta_para_rascunho(self):
        self.entrega.estado = EstadoEntrega.CORRECAO_SOLICITADA
        self.entrega.save()

        resposta = self.enviar()

        self.entrega.refresh_from_db()
        self.assertEqual(self.entrega.estado, EstadoEntrega.RASCUNHO)
        self.assertEqual(resposta.data["entrega"]["estado"], EstadoEntrega.RASCUNHO)

    def test_ca2_de_rascunho_o_estado_permanece_rascunho(self):
        self.enviar()

        self.entrega.refresh_from_db()
        self.assertEqual(self.entrega.estado, EstadoEntrega.RASCUNHO)

    # ------------------------------------------------------------ CA3

    def test_ca3_outros_estados_sao_recusados(self):
        """RN03 — fora de rascunho e correção solicitada, o upload não entra."""
        for estado in (
            EstadoEntrega.PRONTO_PARA_REVISAO,
            EstadoEntrega.EM_REVISAO,
            EstadoEntrega.CONCLUIDA,
            EstadoEntrega.ENVIADA_A_BANCA,
        ):
            with self.subTest(estado=estado):
                self.entrega.estado = estado
                self.entrega.save()

                resposta = self.enviar()

                self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertEqual(Versao.objects.count(), 0)

    # ------------------------------------------------------------ CA4

    def test_ca4_envio_registra_evento_de_upload(self):
        self.enviar()

        evento = self.tcc.eventos.get(tipo=TipoEvento.UPLOAD)
        self.assertIn("Versão 1", evento.descricao)
        self.assertEqual(evento.usuario_relacionado, self.aluno)

    def test_ca4_evento_menciona_a_volta_para_rascunho(self):
        self.entrega.estado = EstadoEntrega.CORRECAO_SOLICITADA
        self.entrega.save()

        self.enviar()

        evento = self.tcc.eventos.get(tipo=TipoEvento.UPLOAD)
        self.assertIn("rascunho", evento.descricao)

    # ------------------------------------------------- validação do arquivo

    def test_formato_diferente_de_pdf_e_recusado(self):
        resposta = self.enviar(SimpleUploadedFile("tcc.docx", b"conteudo"))

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("arquivo", resposta.data)
        self.assertEqual(Versao.objects.count(), 0)

    def test_arquivo_vazio_e_recusado(self):
        resposta = self.enviar(SimpleUploadedFile("vazio.pdf", b""))
        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    @override_settings(VERSAO_TAMANHO_MAXIMO=1024)
    def test_arquivo_acima_do_limite_e_recusado(self):
        resposta = self.enviar(pdf("grande.pdf", b"x" * 2048))

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("MB", str(resposta.data["arquivo"]))

    def test_sem_arquivo_o_sistema_exige_um(self):
        resposta = self.client.post(
            reverse("versoes", args=[self.entrega.id]), {}, format="multipart"
        )
        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------ acesso

    def test_aluno_nao_envia_versao_em_entrega_de_outro(self):
        outra = Usuario.objects.create_user(
            email="ana@aluno.edu.br", nome="Ana", senha="senhaForte123", perfil=Perfil.ALUNO
        )
        self.client.force_authenticate(outra)

        self.assertEqual(self.enviar().status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(Versao.objects.count(), 0)

    def test_rnf04_orientador_nao_envia_versao(self):
        self.client.force_authenticate(self.orientador)
        self.assertEqual(self.enviar().status_code, status.HTTP_403_FORBIDDEN)

    # ------------------------------------------------- reflexo na listagem

    def test_listagem_de_entregas_traz_a_versao_atual(self):
        self.enviar(pdf("v1.pdf"))
        self.enviar(pdf("v2.pdf"))

        entrega = self.client.get(reverse("entregas")).data[0]

        self.assertEqual(entrega["versao_atual"]["numero"], 2)
        self.assertEqual(entrega["numero_da_proxima_versao"], 3)
        self.assertTrue(entrega["aceita_versao"])

    def test_entrega_sem_versao_informa_ausencia(self):
        entrega = self.client.get(reverse("entregas")).data[0]

        self.assertIsNone(entrega["versao_atual"])
        self.assertEqual(entrega["numero_da_proxima_versao"], 1)
