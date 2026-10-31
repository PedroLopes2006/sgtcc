"""
US11 — Solicitar correção.

Cobre os CA1, CA2 e CA3 e as regras envolvidas: RN05 (orientador ativo), RN06 /
RF17 (transição estrita de estado), RN07 (comentário obrigatório), RN10 / RF18 /
RNF12 (evento no log), RN14 (comentário imutável), RF10 (comentário vinculado à
entrega), RF16 (notificação) e RNF04 (acesso por perfil).
"""
from datetime import timedelta

from django.urls import NoReverseMatch, reverse
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


class SolicitarCorrecaoTests(APITestCase):
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
            estado=EstadoEntrega.EM_REVISAO,
        )
        self.url = reverse("solicitar-correcao", args=[self.entrega.id])
        self.dados = {"comentario": "Revise a fundamentação teórica."}
        self.client.force_authenticate(self.orientador)

    def test_ca1_em_revisao_passa_para_correcao_solicitada(self):
        resposta = self.client.post(self.url, self.dados, format="json")

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(resposta.data["estado"], EstadoEntrega.CORRECAO_SOLICITADA)
        self.entrega.refresh_from_db()
        self.assertEqual(self.entrega.estado, EstadoEntrega.CORRECAO_SOLICITADA)

    def test_ca1_comentario_e_gravado_na_entrega(self):
        """RF10 — o comentário fica vinculado à entrega, com o orientador como autor."""
        self.client.post(self.url, self.dados, format="json")

        comentario = Comentario.objects.get(entrega=self.entrega)
        self.assertEqual(comentario.autor, self.orientador)
        self.assertEqual(comentario.texto, "Revise a fundamentação teórica.")

    def test_ca2_comentario_ausente_ou_em_branco_e_exigido(self):
        """RN07."""
        ausente = self.client.post(self.url, {}, format="json")
        vazio = self.client.post(self.url, {"comentario": ""}, format="json")
        espacos = self.client.post(self.url, {"comentario": "   "}, format="json")

        for resposta in (ausente, vazio, espacos):
            self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertIn("comentario", resposta.data)
        self.entrega.refresh_from_db()
        self.assertEqual(self.entrega.estado, EstadoEntrega.EM_REVISAO)
        self.assertEqual(Comentario.objects.count(), 0)
        self.assertFalse(self.tcc.eventos.filter(tipo=TipoEvento.CORRECAO_SOLICITADA).exists())

    def test_ca3_aluno_e_notificado_por_evento_com_o_texto(self):
        """RN10 / RF18 / RF16 — o Evento é o gatilho da notificação."""
        self.client.post(self.url, self.dados, format="json")

        evento = self.tcc.eventos.get(tipo=TipoEvento.CORRECAO_SOLICITADA)
        self.assertEqual(evento.usuario_relacionado, self.orientador)
        self.assertIn("Capítulo 1", evento.descricao)
        self.assertIn("fundamentação teórica", evento.descricao)

    def test_outros_estados_sao_impedidos(self):
        """RN06 / RF17 — só em_revisao → correcao_solicitada é válido."""
        outros = [e for e in EstadoEntrega.values if e != EstadoEntrega.EM_REVISAO]
        for estado in outros:
            with self.subTest(estado=estado):
                self.entrega.estado = estado
                self.entrega.save(update_fields=["estado"])

                resposta = self.client.post(self.url, self.dados, format="json")

                self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
                self.entrega.refresh_from_db()
                self.assertEqual(self.entrega.estado, estado)
        self.assertEqual(Comentario.objects.count(), 0)
        self.assertFalse(self.tcc.eventos.filter(tipo=TipoEvento.CORRECAO_SOLICITADA).exists())

    def test_nao_solicita_correcao_duas_vezes(self):
        self.client.post(self.url, self.dados, format="json")
        segunda = self.client.post(self.url, self.dados, format="json")

        self.assertEqual(segunda.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Comentario.objects.count(), 1)

    def test_rn05_somente_o_orientador_ativo_solicita_correcao(self):
        """RN05 — outro orientador, sem Orientação ativa no TCC, não altera o estado."""
        outro = Usuario.objects.create_user(
            email="outro@prof.edu.br", nome="Outro", senha="senhaForte123",
            perfil=Perfil.ORIENTADOR,
        )
        self.client.force_authenticate(outro)

        resposta = self.client.post(self.url, self.dados, format="json")

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)
        self.entrega.refresh_from_db()
        self.assertEqual(self.entrega.estado, EstadoEntrega.EM_REVISAO)
        self.assertEqual(Comentario.objects.count(), 0)

    def test_rnf04_aluno_nao_solicita_correcao(self):
        """RNF04 — função exclusiva de orientador."""
        self.client.force_authenticate(self.aluno)
        resposta = self.client.post(self.url, self.dados, format="json")
        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)

    def test_entrega_inexistente_retorna_404(self):
        resposta = self.client.post(
            reverse("solicitar-correcao", args=[99999]), self.dados, format="json"
        )
        self.assertEqual(resposta.status_code, status.HTTP_404_NOT_FOUND)

    def test_rn14_nao_ha_rota_para_editar_ou_remover_comentario(self):
        """RN14 — a API só cria comentários, via solicitação de correção."""
        self.client.post(self.url, self.dados, format="json")
        comentario = Comentario.objects.get()

        for nome in ("comentario", "comentarios", "editar-comentario", "remover-comentario"):
            with self.assertRaises(NoReverseMatch):
                reverse(nome, args=[comentario.id])
