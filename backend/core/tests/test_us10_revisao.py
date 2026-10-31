"""
US10 — Marcar em revisão.

Cobre os CA1 e CA2 e as regras envolvidas: RN05 (orientador ativo), RN06 / RF17
(transição estrita de estado), RN10 / RF18 / RNF12 (evento no log), RF16
(notificação) e RNF04 (acesso por perfil).
"""
from datetime import timedelta

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
)


class MarcarEmRevisaoTests(APITestCase):
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
        # Sem a US08 no código, o estado é posto direto no banco.
        self.entrega = Entrega.objects.create(
            tcc=self.tcc,
            titulo="Capítulo 1",
            prazo=timezone.localdate() + timedelta(days=30),
            estado=EstadoEntrega.PRONTO_PARA_REVISAO,
        )
        self.url = reverse("iniciar-revisao", args=[self.entrega.id])
        self.client.force_authenticate(self.orientador)

    def test_ca1_pronta_para_revisao_passa_para_em_revisao(self):
        resposta = self.client.post(self.url)

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(resposta.data["estado"], EstadoEntrega.EM_REVISAO)
        self.entrega.refresh_from_db()
        self.assertEqual(self.entrega.estado, EstadoEntrega.EM_REVISAO)

    def test_ca1_aluno_e_notificado_por_evento(self):
        """RN10 / RF18 / RF16 — o Evento é o gatilho da notificação."""
        self.client.post(self.url)

        evento = self.tcc.eventos.get(tipo=TipoEvento.ENTREGA_EM_REVISAO)
        self.assertEqual(evento.usuario_relacionado, self.orientador)
        self.assertIn("Capítulo 1", evento.descricao)

    def test_ca2_outros_estados_sao_impedidos(self):
        """RN06 / RF17 — só pronto_para_revisao → em_revisao é válido."""
        outros = [e for e in EstadoEntrega.values if e != EstadoEntrega.PRONTO_PARA_REVISAO]
        for estado in outros:
            with self.subTest(estado=estado):
                self.entrega.estado = estado
                self.entrega.save(update_fields=["estado"])

                resposta = self.client.post(self.url)

                self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
                self.entrega.refresh_from_db()
                self.assertEqual(self.entrega.estado, estado)
        self.assertFalse(self.tcc.eventos.filter(tipo=TipoEvento.ENTREGA_EM_REVISAO).exists())

    def test_nao_inicia_revisao_duas_vezes(self):
        """RN06 / RF17 — em_revisao → em_revisao não é transição válida."""
        self.client.post(self.url)
        segunda = self.client.post(self.url)

        self.assertEqual(segunda.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.tcc.eventos.filter(tipo=TipoEvento.ENTREGA_EM_REVISAO).count(), 1)

    def test_rn05_somente_o_orientador_ativo_inicia_a_revisao(self):
        """RN05 — outro orientador, sem Orientação ativa no TCC, não altera o estado."""
        outro = Usuario.objects.create_user(
            email="outro@prof.edu.br", nome="Outro", senha="senhaForte123",
            perfil=Perfil.ORIENTADOR,
        )
        self.client.force_authenticate(outro)

        resposta = self.client.post(self.url)

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)
        self.entrega.refresh_from_db()
        self.assertEqual(self.entrega.estado, EstadoEntrega.PRONTO_PARA_REVISAO)

    def test_rnf04_aluno_nao_inicia_revisao(self):
        """RNF04 — função exclusiva de orientador."""
        self.client.force_authenticate(self.aluno)
        resposta = self.client.post(self.url)
        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)

    def test_entrega_inexistente_retorna_404(self):
        resposta = self.client.post(reverse("iniciar-revisao", args=[99999]))
        self.assertEqual(resposta.status_code, status.HTTP_404_NOT_FOUND)
