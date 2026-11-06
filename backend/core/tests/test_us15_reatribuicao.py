"""US15 CA1–CA3 / RF14 / RN05, RN08–10, RN15 / RNF04."""
from unittest.mock import patch
from django.db import IntegrityError, transaction
from django.urls import reverse
from core import services
from core.models import Comentario, EstadoEntrega, Orientacao, Perfil, TipoEvento, Usuario
from .base_test import BaseEntregaTests, criar_versao


class ReatribuicaoTests(BaseEntregaTests):
    def setUp(self):
        """CA1–CA2 / RF14: prepara histórico e orientadores de origem e destino."""
        super().setUp()
        self.novo = Usuario.objects.create_user(email='novo@prof.edu.br', nome='Novo', perfil=Perfil.ORIENTADOR)
        self.versao = criar_versao(self.entrega)
        self.comentario = Comentario.objects.create(entrega=self.entrega, versao=self.versao,
            autor=self.orientador, texto='Rever introdução')
        services.registrar_evento(self.tcc, TipoEvento.UPLOAD, 'Versão anterior', entrega=self.entrega)
        self.client.force_authenticate(self.orientador)
        self.url = reverse('reatribuir-orientador', args=[self.tcc.pk])
        self.historico = reverse('historico-orientando', args=[self.tcc.pk])

    def test_encerra_e_cria_vinculo_com_evento(self):
        """CA1, CA3 / RN08–10, RN15: encerra antes de criar e registra troca."""
        self.assertEqual(self.client.post(self.url, {'novo_orientador': self.novo.pk}).status_code, 201)
        self.orientacao.refresh_from_db()
        self.assertFalse(self.orientacao.ativa)
        self.assertIsNotNone(self.orientacao.data_fim)
        nova = self.tcc.orientacao_ativa
        self.assertEqual(nova.orientador, self.novo)
        self.assertGreaterEqual(nova.data_inicio, self.orientacao.data_fim)
        self.assertEqual(self.tcc.orientacoes.filter(ativa=True).count(), 1)
        self.assertEqual(self.tcc.eventos.filter(tipo=TipoEvento.TROCA_ORIENTADOR).count(), 1)

    def test_novo_herda_historico_e_antigo_perde_acesso(self):
        """CA2 / RF14 / RN05, RN08 / RNF04: acesso integral apenas para o novo."""
        self.client.post(self.url, {'novo_orientador': self.novo.pk})
        self.assertEqual(self.client.get(self.historico).status_code, 403)
        self.assertEqual(self.client.get(reverse('orientandos')).data, [])
        self.definir_estado(EstadoEntrega.EM_REVISAO)
        self.assertEqual(self.client.post(reverse('aprovar-entrega', args=[self.entrega.pk])).status_code, 403)
        self.client.force_authenticate(self.novo)
        r = self.client.get(self.historico)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['tema']['titulo'], self.tcc.tema.titulo)
        self.assertEqual(r.data['entregas'][0]['versoes'][0]['id'], self.versao.pk)
        self.assertTrue(r.data['entregas'][0]['versoes'][0]['arquivo_url'])
        self.assertEqual(r.data['entregas'][0]['comentarios'][0]['id'], self.comentario.pk)
        self.assertEqual(len(r.data['eventos']), 2)
        self.assertEqual(len(r.data['orientacoes']), 2)
        self.assertEqual(len(self.client.get(reverse('orientandos')).data), 1)
        self.assertEqual(self.client.post(reverse('aprovar-entrega', args=[self.entrega.pk])).status_code, 200)

    def test_recusa_atual_aluno_inativo_e_inexistente(self):
        """CA1 / RN09, RN15: novo deve ser orientador ativo e diferente."""
        self.novo.is_active = False
        self.novo.save(update_fields=['is_active'])
        for destino in [self.orientador.pk, self.aluno.pk, self.novo.pk, 999999]:
            with self.subTest(destino=destino):
                self.assertEqual(self.client.post(self.url, {'novo_orientador': destino}).status_code, 400)
        self.assertTrue(self.tcc.orientacao_ativa.ativa)
        self.assertEqual(self.tcc.orientacoes.count(), 1)

    def test_outro_orientador_nao_reatribui(self):
        """RN05 / RNF04: apenas o ativo pode iniciar uma troca."""
        self.client.force_authenticate(self.novo)
        self.assertEqual(self.client.post(self.url, {'novo_orientador': self.orientador.pk}).status_code, 403)
        self.assertEqual(self.client.get(self.historico).status_code, 403)

    def test_aluno_nao_reatribui_nem_le_historico(self):
        """RNF04: as rotas são exclusivas de orientadores."""
        self.client.force_authenticate(self.aluno)
        self.assertEqual(self.client.post(self.url, {'novo_orientador': self.novo.pk}).status_code, 403)
        self.assertEqual(self.client.get(self.historico).status_code, 403)

    def test_anonimo_sem_acesso(self):
        """RNF04: ambas as rotas exigem autenticação."""
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(self.historico).status_code, 401)
        self.assertEqual(self.client.post(self.url, {'novo_orientador': self.novo.pk}).status_code, 401)

    def test_constraint_nunca_duas_ativas(self):
        """RN09: banco recusa duas orientações ativas."""
        with self.assertRaises(IntegrityError), transaction.atomic():
            Orientacao.objects.create(tcc=self.tcc, orientador=self.novo)

    def test_falha_no_log_reverte_troca(self):
        """CA1, CA3 / RN09, RN10, RN15: falha reverte encerramento e novo vínculo."""
        with patch('core.services.registrar_evento', side_effect=RuntimeError('falha')):
            with self.assertRaises(RuntimeError):
                services.reatribuir_orientador(orientador=self.orientador, tcc=self.tcc, novo_orientador=self.novo)
        self.orientacao.refresh_from_db()
        self.assertTrue(self.orientacao.ativa)
        self.assertIsNone(self.orientacao.data_fim)
        self.assertEqual(self.tcc.orientacoes.count(), 1)
