"""
US14 — Painel do orientador.

Requisitos: RF13 · RN05 · RNF02, RNF04.

CA1. Dado um orientador autenticado, quando acessa o painel, então vê todos
     os orientandos ativos com tema, fase e prazo.
CA2. Dado um prazo vencido, quando o painel é exibido, então esse caso é
     destacado visualmente.

O painel é a tabela "Orientandos" (`GET /api/orientandos/`). As colunas já
eram conferidas em test_painel_orientador.py; aqui ficam os critérios de
aceite da US14 e as regras de acesso que eles pressupõem.
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


class PainelOrientadorTests(APITestCase):
    def setUp(self):
        self.orientador = Usuario.objects.create_user(
            email="marcos@prof.edu.br", nome="Marcos", senha="senhaForte123",
            perfil=Perfil.ORIENTADOR,
        )
        self.lucas = self._criar_orientando("lucas@aluno.edu.br", "Lucas", "Gestão de TCC")
        self.client.force_authenticate(self.orientador)

    def _criar_orientando(self, email, nome, titulo, orientador=None):
        aluno = Usuario.objects.create_user(
            email=email, nome=nome, senha="senhaForte123", perfil=Perfil.ALUNO
        )
        tcc = TCC.objects.create(aluno=aluno)
        Tema.objects.create(
            tcc=tcc, titulo=titulo, descricao="Descrição.",
            status=StatusTema.APROVADO, data_aprovacao=timezone.now(),
        )
        Orientacao.objects.create(tcc=tcc, orientador=orientador or self.orientador)
        return tcc

    def _painel(self):
        resposta = self.client.get(reverse("orientandos"))
        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        return {linha["aluno"]["nome"]: linha for linha in resposta.data}

    # ------------------------------------------------------------- CA1

    def test_ca1_mostra_tema_fase_e_prazo_de_cada_orientando(self):
        """US14 CA1 / RF13 — tema, fase e prazo vêm em cada linha."""
        prazo = timezone.localdate() + timedelta(days=10)
        Entrega.objects.create(tcc=self.lucas, titulo="Introdução", prazo=prazo)

        linha = self._painel()["Lucas"]
        self.assertEqual(linha["tema"]["titulo"], "Gestão de TCC")
        self.assertEqual(linha["fase_atual"], "Introdução")
        self.assertEqual(str(linha["prazo"]), prazo.isoformat())

    def test_ca1_mostra_todos_os_orientandos_ativos(self):
        """US14 CA1 — todos os orientandos ativos, não só o primeiro."""
        self._criar_orientando("ana@aluno.edu.br", "Ana", "Jogos no ensino")
        self.assertEqual(set(self._painel()), {"Lucas", "Ana"})

    def test_ca1_orientacao_encerrada_sai_do_painel(self):
        """US14 CA1 / RN05 — só orientandos ativos: depois de uma troca, o antigo não vê."""
        novo = Usuario.objects.create_user(
            email="paula@prof.edu.br", nome="Paula", senha="senhaForte123",
            perfil=Perfil.ORIENTADOR,
        )
        self.lucas.orientacao_ativa.encerrar()
        Orientacao.objects.create(tcc=self.lucas, orientador=novo)

        self.assertEqual(self._painel(), {})

    def test_ca1_orientando_de_outro_orientador_nao_aparece(self):
        """US14 CA1 / RN05 — o painel é só dos orientandos do orientador logado."""
        outro = Usuario.objects.create_user(
            email="paula@prof.edu.br", nome="Paula", senha="senhaForte123",
            perfil=Perfil.ORIENTADOR,
        )
        self._criar_orientando("ana@aluno.edu.br", "Ana", "Jogos no ensino", orientador=outro)
        self.assertEqual(set(self._painel()), {"Lucas"})

    def test_ca1_painel_vazio_sem_orientandos(self):
        """US14 CA1 — orientador sem orientandos recebe a lista vazia (a tela mostra o aviso)."""
        sem_alunos = Usuario.objects.create_user(
            email="paula@prof.edu.br", nome="Paula", senha="senhaForte123",
            perfil=Perfil.ORIENTADOR,
        )
        self.client.force_authenticate(sem_alunos)
        self.assertEqual(self._painel(), {})

    # ------------------------------------------------------------- CA2

    def test_ca2_prazo_vencido_e_destacado(self):
        """US14 CA2 — a fase atual com prazo no passado vem marcada como vencida."""
        Entrega.objects.create(
            tcc=self.lucas, titulo="Metodologia",
            prazo=timezone.localdate() - timedelta(days=1),
        )
        self.assertTrue(self._painel()["Lucas"]["prazo_vencido"])

    def test_ca2_prazo_de_hoje_ainda_nao_venceu(self):
        """US14 CA2 — vence só depois do dia do prazo."""
        Entrega.objects.create(tcc=self.lucas, titulo="Metodologia", prazo=timezone.localdate())
        self.assertFalse(self._painel()["Lucas"]["prazo_vencido"])

    def test_ca2_destaque_vale_para_a_fase_atual_e_nao_para_as_seguintes(self):
        """US14 CA2 — o prazo mostrado é o da fase atual; só ele decide o destaque."""
        hoje = timezone.localdate()
        Entrega.objects.create(
            tcc=self.lucas, titulo="Introdução", prazo=hoje - timedelta(days=5),
            estado=EstadoEntrega.CONCLUIDA,
        )
        Entrega.objects.create(tcc=self.lucas, titulo="Metodologia", prazo=hoje + timedelta(days=5))

        linha = self._painel()["Lucas"]
        self.assertEqual(linha["fase_atual"], "Metodologia")
        self.assertFalse(linha["prazo_vencido"])

    # ------------------------------------------------------------- RNF04

    def test_rnf04_aluno_nao_acessa_o_painel(self):
        """RNF04 — o painel é exclusivo de orientadores."""
        self.client.force_authenticate(self.lucas.aluno)
        resposta = self.client.get(reverse("orientandos"))
        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)

    def test_rnf04_sem_login_nao_acessa_o_painel(self):
        """RNF04 — sem autenticação, nada."""
        self.client.force_authenticate(None)
        resposta = self.client.get(reverse("orientandos"))
        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)
