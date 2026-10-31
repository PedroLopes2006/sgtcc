"""
Fluxo completo da entrega, de ponta a ponta pela API: US06, US08, US10 e US11.

rascunho → pronto_para_revisao → em_revisao → correcao_solicitada → rascunho (ciclo)

Regras exercitadas: RN03 (upload só em rascunho ou correção), RN04 (sinalizar
exige versão), RN06 / RF17 (sequência de estados), RN07 (comentário na
correção), RN10 / RF18 (um Evento por mudança), RN13 (versão incremental),
RN14 (comentários preservados) e RF10 (comentário ligado à versão avaliada).
"""
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
    Comentario,
    Entrega,
    EstadoEntrega,
    Orientacao,
    Perfil,
    StatusTema,
    TCC,
    Tema,
    TipoEvento,
    Usuario,
)

ARMAZENAMENTO_TEMPORARIO = tempfile.mkdtemp()


def pdf(nome="capitulo.pdf"):
    return SimpleUploadedFile(nome, b"%PDF-1.4 conteudo de teste", content_type="application/pdf")


@override_settings(MEDIA_ROOT=ARMAZENAMENTO_TEMPORARIO)
class FluxoDeRevisaoTests(APITestCase):
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
            tcc=self.tcc, titulo="Capítulo 1", prazo=timezone.localdate() + timedelta(days=30)
        )

    # ---- atalhos, cada um age como o perfil que faria a ação no sistema

    def _como(self, usuario):
        self.client.force_authenticate(usuario)

    def aluno_envia_versao(self, entrega=None):
        self._como(self.aluno)
        entrega = entrega or self.entrega
        return self.client.post(
            reverse("versoes", args=[entrega.id]), {"arquivo": pdf()}, format="multipart"
        )

    def aluno_sinaliza(self, entrega=None):
        self._como(self.aluno)
        return self.client.post(reverse("sinalizar-pronta", args=[(entrega or self.entrega).id]))

    def orientador_inicia_revisao(self, entrega=None):
        self._como(self.orientador)
        return self.client.post(reverse("iniciar-revisao", args=[(entrega or self.entrega).id]))

    def orientador_pede_correcao(self, texto, entrega=None):
        self._como(self.orientador)
        return self.client.post(
            reverse("solicitar-correcao", args=[(entrega or self.entrega).id]),
            {"comentario": texto},
            format="json",
        )

    def estado(self, entrega=None):
        entrega = entrega or self.entrega
        entrega.refresh_from_db()
        return entrega.estado

    # ---- o fluxo

    def test_ciclo_completo_com_uma_correcao(self):
        # US06 CA1 — o aluno envia a versão 1; a entrega segue em rascunho.
        resposta = self.aluno_envia_versao()
        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        self.assertEqual(self.estado(), EstadoEntrega.RASCUNHO)

        # US08 CA1 — sinaliza como pronta.
        self.assertEqual(self.aluno_sinaliza().status_code, status.HTTP_200_OK)
        self.assertEqual(self.estado(), EstadoEntrega.PRONTO_PARA_REVISAO)

        # RN03 — pronta para revisão não aceita upload.
        self.assertEqual(self.aluno_envia_versao().status_code, status.HTTP_400_BAD_REQUEST)

        # US10 CA1 — o orientador abre a entrega.
        self.assertEqual(self.orientador_inicia_revisao().status_code, status.HTTP_200_OK)
        self.assertEqual(self.estado(), EstadoEntrega.EM_REVISAO)

        # US11 CA1 — o orientador pede correção, com comentário.
        resposta = self.orientador_pede_correcao("Revise a fundamentação teórica.")
        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(self.estado(), EstadoEntrega.CORRECAO_SOLICITADA)

        # O aluno lê o que precisa corrigir, e a versão que foi avaliada (RF10).
        self._como(self.aluno)
        entrega_do_aluno = self.client.get(reverse("entregas")).data[0]
        self.assertEqual(entrega_do_aluno["estado"], EstadoEntrega.CORRECAO_SOLICITADA)
        self.assertEqual(
            entrega_do_aluno["ultimo_comentario"]["texto"], "Revise a fundamentação teórica."
        )
        self.assertEqual(entrega_do_aluno["ultimo_comentario"]["versao"], 1)
        self.assertEqual(entrega_do_aluno["ultimo_comentario"]["autor"]["nome"], "Marcos")
        self.assertTrue(entrega_do_aluno["aceita_versao"])

        # US06 CA2 / RN13 — a versão 2 devolve a entrega ao rascunho.
        resposta = self.aluno_envia_versao()
        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resposta.data["versao"]["numero"], 2)
        self.assertEqual(self.estado(), EstadoEntrega.RASCUNHO)

        # O ciclo recomeça: sinaliza, o orientador abre e dessa vez o comentário
        # aponta a versão 2.
        self.aluno_sinaliza()
        self.orientador_inicia_revisao()
        self.orientador_pede_correcao("Agora ajuste as referências.")
        self.assertEqual(self.estado(), EstadoEntrega.CORRECAO_SOLICITADA)

        # RN14 — os dois comentários continuam gravados, cada um com a sua versão.
        self.assertEqual(
            list(Comentario.objects.values_list("texto", "versao__numero")),
            [("Revise a fundamentação teórica.", 1), ("Agora ajuste as referências.", 2)],
        )

        # RN10 / RF18 — um Evento por mudança de estado, na ordem em que ocorreram.
        self.assertEqual(
            list(self.tcc.eventos.values_list("tipo", flat=True)),
            [
                TipoEvento.UPLOAD,
                TipoEvento.ENTREGA_PRONTA,
                TipoEvento.ENTREGA_EM_REVISAO,
                TipoEvento.CORRECAO_SOLICITADA,
                TipoEvento.UPLOAD,
                TipoEvento.ENTREGA_PRONTA,
                TipoEvento.ENTREGA_EM_REVISAO,
                TipoEvento.CORRECAO_SOLICITADA,
            ],
        )

    def test_nao_ha_atalho_entre_os_estados(self):
        """RN06 / RF17 — cada passo só vale a partir do estado anterior."""
        self.aluno_envia_versao()

        # Em rascunho, o orientador não pula etapas.
        self.assertEqual(self.orientador_inicia_revisao().status_code, 400)
        self.assertEqual(self.orientador_pede_correcao("Texto.").status_code, 400)

        self.aluno_sinaliza()
        # Pronta para revisão: ainda não dá para pedir correção sem abrir antes.
        self.assertEqual(self.orientador_pede_correcao("Texto.").status_code, 400)
        self.assertEqual(self.estado(), EstadoEntrega.PRONTO_PARA_REVISAO)
        self.assertEqual(Comentario.objects.count(), 0)

    def test_sinalizar_sem_versao_continua_impedido(self):
        """RN04 — sem versão, a entrega nem chega às mãos do orientador."""
        self.assertEqual(self.aluno_sinaliza().status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.orientador_inicia_revisao().status_code, 400)


class SaidasDaRevisaoTests(APITestCase):
    """O que as telas leem: a entrega que espera o orientador e o último comentário."""

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
        self.prazo = timezone.localdate() + timedelta(days=30)

    def _linha_do_orientador(self):
        self.client.force_authenticate(self.orientador)
        return self.client.get(reverse("orientandos")).data[0]

    def test_sem_entrega_esperando_o_orientador_o_campo_vem_vazio(self):
        Entrega.objects.create(tcc=self.tcc, titulo="Capítulo 1", prazo=self.prazo)
        self.assertIsNone(self._linha_do_orientador()["entrega_para_revisao"])

    def test_aponta_a_entrega_pronta_mesmo_com_um_rascunho_antes_dela(self):
        """O rascunho é a "entrega atual" da linha, mas quem espera revisão é a outra."""
        Entrega.objects.create(tcc=self.tcc, titulo="Capítulo 1", prazo=self.prazo)
        Entrega.objects.create(
            tcc=self.tcc, titulo="Capítulo 2", prazo=self.prazo + timedelta(days=7),
            estado=EstadoEntrega.PRONTO_PARA_REVISAO,
        )

        linha = self._linha_do_orientador()

        self.assertEqual(linha["fase_atual"], "Capítulo 1")
        self.assertEqual(linha["entrega_para_revisao"]["titulo"], "Capítulo 2")
        self.assertEqual(linha["entrega_para_revisao"]["estado"], EstadoEntrega.PRONTO_PARA_REVISAO)

    def test_entrega_em_revisao_tambem_espera_o_orientador(self):
        Entrega.objects.create(
            tcc=self.tcc, titulo="Capítulo 1", prazo=self.prazo, estado=EstadoEntrega.EM_REVISAO
        )
        self.assertEqual(
            self._linha_do_orientador()["entrega_para_revisao"]["estado"],
            EstadoEntrega.EM_REVISAO,
        )

    def test_entrega_sem_comentario_traz_o_campo_vazio_para_o_aluno(self):
        Entrega.objects.create(tcc=self.tcc, titulo="Capítulo 1", prazo=self.prazo)
        self.client.force_authenticate(self.aluno)
        self.assertIsNone(self.client.get(reverse("entregas")).data[0]["ultimo_comentario"])
