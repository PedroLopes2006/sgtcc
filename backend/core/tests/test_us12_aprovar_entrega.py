"""US12 CA1–CA2 / RF11, RF16–18 / RN05, RN06, RN10 / RNF04, RNF12."""
from datetime import timedelta
from unittest.mock import patch
from django.core.exceptions import ValidationError
from django.urls import reverse
from core import services
from core.models import Entrega, EstadoEntrega, Perfil, TipoEvento, Usuario
from .base_test import BaseEntregaTests


class AprovarEntregaTests(BaseEntregaTests):
    def setUp(self):
        """US12 CA1: prepara a entrega em revisão e autentica o orientador (RNF04)."""
        super().setUp()
        self.definir_estado(EstadoEntrega.EM_REVISAO)
        self.client.force_authenticate(self.orientador)
        self.url = reverse('aprovar-entrega', args=[self.entrega.pk])

    def test_conclui_com_data_e_evento(self):
        """CA1–CA2 / RN10 / RF11, RF16–18 / RNF12: conclusão e aviso no log."""
        r = self.client.post(self.url)
        self.assertEqual(r.status_code, 200)
        self.entrega.refresh_from_db()
        self.assertEqual(self.entrega.estado, EstadoEntrega.CONCLUIDA)
        self.assertIsNotNone(self.entrega.data_conclusao)
        evento = self.tcc.eventos.get(tipo=TipoEvento.ENTREGA_CONCLUIDA)
        self.assertEqual(evento.entrega, self.entrega)
        self.assertEqual(evento.usuario_relacionado, self.orientador)
        self.client.force_authenticate(self.aluno)
        self.assertIn(evento.pk, [e['id'] for e in self.client.get(reverse('eventos')).data])

    def test_recusa_os_outros_cinco_estados(self):
        """CA1 / RN06 / RF17: só em revisão é aceito, sem efeitos colaterais."""
        for estado in EstadoEntrega.values:
            if estado == EstadoEntrega.EM_REVISAO:
                continue
            with self.subTest(estado=estado):
                self.definir_estado(estado)
                self.assertEqual(self.client.post(self.url).status_code, 400)
                self.entrega.refresh_from_db()
                self.assertEqual(self.entrega.estado, estado)
                self.assertIsNone(self.entrega.data_conclusao)
        self.assertEqual(self.tcc.eventos.count(), 0)

    def test_proxima_entra_na_vez(self):
        """CA2 / RN06: a próxima fica disponível e é citada no evento."""
        proxima = Entrega.objects.create(tcc=self.tcc, titulo='Capítulo 2',
            prazo=self.entrega.prazo + timedelta(days=1), estado=EstadoEntrega.PRONTO_PARA_REVISAO)
        self.assertEqual(self.client.post(reverse('iniciar-revisao', args=[proxima.pk])).status_code, 400)
        self.assertEqual(self.client.post(self.url).status_code, 200)
        self.assertIn(proxima.titulo, self.tcc.eventos.get(tipo=TipoEvento.ENTREGA_CONCLUIDA).descricao)
        linha = self.client.get(reverse('orientandos')).data[0]
        self.assertEqual(linha['entrega_para_revisao']['id'], proxima.pk)
        self.assertEqual(self.client.post(reverse('iniciar-revisao', args=[proxima.pk])).status_code, 200)

    def test_nao_aprova_fora_da_ordem(self):
        """CA1 / RN06: só a primeira pendente pode ser concluída."""
        Entrega.objects.create(tcc=self.tcc, titulo='Anterior', prazo=self.entrega.prazo - timedelta(days=1))
        self.assertEqual(self.client.post(self.url).status_code, 400)

    def test_outro_orientador_sem_acesso(self):
        """RN05 / RNF04: outro orientador não pode aprovar."""
        outro = Usuario.objects.create_user(email='outro@prof.edu.br', nome='Outro', perfil=Perfil.ORIENTADOR)
        self.client.force_authenticate(outro)
        self.assertEqual(self.client.post(self.url).status_code, 403)

    def test_aluno_sem_acesso(self):
        """RNF04: aluno não pode aprovar."""
        self.client.force_authenticate(self.aluno)
        self.assertEqual(self.client.post(self.url).status_code, 403)

    def test_anonimo_sem_acesso(self):
        """RNF04: autenticação obrigatória."""
        self.client.force_authenticate(None)
        self.assertEqual(self.client.post(self.url).status_code, 401)

    def test_falha_no_evento_desfaz_conclusao(self):
        """CA1 / RN10: transação preserva consistência se o log falhar."""
        with patch('core.services.registrar_evento', side_effect=RuntimeError('falha')):
            with self.assertRaises(RuntimeError):
                services.aprovar_entrega(orientador=self.orientador, entrega=self.entrega)
        self.entrega.refresh_from_db()
        self.assertEqual(self.entrega.estado, EstadoEntrega.EM_REVISAO)
        self.assertIsNone(self.entrega.data_conclusao)

    def test_instancia_desatualizada_nao_duplica_aprovacao(self):
        """RN06, RN10 / RF17: releitura impede dupla conclusão com instância antiga."""
        services.aprovar_entrega(orientador=self.orientador, entrega=self.entrega)
        with self.assertRaises(ValidationError):
            services.aprovar_entrega(orientador=self.orientador, entrega=self.entrega)
        self.assertEqual(self.tcc.eventos.count(), 1)
