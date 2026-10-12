"""
Tabela "Orientandos" do protótipo: colunas prontas para o front.

As User Stories mandam sobre o protótipo onde os dois divergem: o Figma
mostrava "1 de 5 entregas", sugerindo etapas fixas, mas na US05 o aluno cria
as entregas que quiser — então o total é quantas ele criou.
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
    Usuario,
)


class TabelaOrientandosTests(APITestCase):
    def setUp(self):
        self.orientador = Usuario.objects.create_user(
            email="marcos@prof.edu.br", nome="Marcos", senha="senhaForte123",
            perfil=Perfil.ORIENTADOR,
        )
        self.aluno = Usuario.objects.create_user(
            email="lucas@aluno.edu.br", nome="Lucas", senha="senhaForte123", perfil=Perfil.ALUNO
        )
        self.tcc = TCC.objects.create(aluno=self.aluno)
        self.tema = Tema.objects.create(
            tcc=self.tcc, titulo="Gestão de TCC", descricao="Sistema web.",
            status=StatusTema.PROPOSTO,
        )
        Orientacao.objects.create(tcc=self.tcc, orientador=self.orientador)
        self.client.force_authenticate(self.orientador)

    def _linha(self):
        resposta = self.client.get(reverse("orientandos"))
        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        return resposta.data[0]

    def _aprovar_tema(self):
        self.tema.status = StatusTema.APROVADO
        self.tema.data_aprovacao = timezone.now()
        self.tema.save()

    def test_tema_pendente_liga_o_botao_avaliar_tema(self):
        linha = self._linha()
        self.assertTrue(linha["aguarda_avaliacao_de_tema"])
        self.assertEqual(linha["fase_atual"], "Tema em análise")
        self.assertEqual(linha["estado"]["codigo"], StatusTema.PROPOSTO)

    def test_tema_aprovado_desliga_o_botao(self):
        self._aprovar_tema()
        self.assertFalse(self._linha()["aguarda_avaliacao_de_tema"])

    def test_fase_atual_e_a_primeira_entrega_em_andamento(self):
        self._aprovar_tema()
        hoje = timezone.localdate()
        Entrega.objects.create(
            tcc=self.tcc, titulo="Introdução", prazo=hoje + timedelta(days=5),
            estado=EstadoEntrega.CONCLUIDA,
        )
        Entrega.objects.create(
            tcc=self.tcc, titulo="Referencial teórico", prazo=hoje + timedelta(days=20)
        )

        linha = self._linha()
        self.assertEqual(linha["fase_atual"], "Referencial teórico")
        self.assertEqual(linha["estado"]["codigo"], EstadoEntrega.RASCUNHO)

    def test_progresso_conta_as_entregas_que_o_aluno_criou(self):
        self._aprovar_tema()
        hoje = timezone.localdate()
        Entrega.objects.create(
            tcc=self.tcc, titulo="Introdução", prazo=hoje + timedelta(days=5),
            estado=EstadoEntrega.CONCLUIDA,
        )
        Entrega.objects.create(tcc=self.tcc, titulo="Metodologia", prazo=hoje + timedelta(days=9))
        Entrega.objects.create(tcc=self.tcc, titulo="Resultados", prazo=hoje + timedelta(days=30))

        # Não é "1 de 5": o total é o que existe, não um número fixo de etapas.
        self.assertEqual(self._linha()["progresso"], {"concluidas": 1, "total": 3})

    def test_sem_entregas_o_progresso_e_zero_de_zero(self):
        self._aprovar_tema()
        linha = self._linha()
        self.assertEqual(linha["progresso"], {"concluidas": 0, "total": 0})
        self.assertEqual(linha["fase_atual"], "Sem entregas")
        self.assertIsNone(linha["prazo"])

    def test_prazo_vencido_e_sinalizado(self):
        """US14 CA2 — o caso vencido precisa ser destacado na tabela."""
        self._aprovar_tema()
        Entrega.objects.create(
            tcc=self.tcc, titulo="Atrasada", prazo=timezone.localdate() - timedelta(days=3)
        )
        linha = self._linha()
        self.assertTrue(linha["prazo_vencido"])

    def test_entrega_concluida_vencida_nao_conta_como_atraso(self):
        self._aprovar_tema()
        Entrega.objects.create(
            tcc=self.tcc, titulo="Entregue no prazo", prazo=timezone.localdate() - timedelta(days=3),
            estado=EstadoEntrega.CONCLUIDA,
        )
        self.assertFalse(self._linha()["prazo_vencido"])

    def test_tabela_nao_mostra_orientandos_de_outro_orientador(self):
        outra_aluna = Usuario.objects.create_user(
            email="ana@aluno.edu.br", nome="Ana", senha="senhaForte123", perfil=Perfil.ALUNO
        )
        outro_orientador = Usuario.objects.create_user(
            email="paula@prof.edu.br", nome="Paula", senha="senhaForte123",
            perfil=Perfil.ORIENTADOR,
        )
        outro_tcc = TCC.objects.create(aluno=outra_aluna)
        Orientacao.objects.create(tcc=outro_tcc, orientador=outro_orientador)

        resposta = self.client.get(reverse("orientandos"))
        self.assertEqual(len(resposta.data), 1)
        self.assertEqual(resposta.data[0]["aluno"]["nome"], "Lucas")
