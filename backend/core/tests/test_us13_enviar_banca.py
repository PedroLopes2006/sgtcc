"""US13 CA1 / RF12 / RN12, RN06, RN10, RN05 / RNF04."""
from django.urls import reverse
from django.utils import timezone
from core.models import EstadoEntrega, Perfil, TipoEvento, Usuario
from .base_test import BaseEntregaTests


class EnviarBancaTests(BaseEntregaTests):
    def setUp(self):
        """CA1 / RN12 / RNF04: prepara conclusão e autentica orientador."""
        super().setUp()
        self.definir_estado(EstadoEntrega.CONCLUIDA)
        self.entrega.data_conclusao = timezone.now()
        self.entrega.save(update_fields=['data_conclusao'])
        self.client.force_authenticate(self.orientador)
        self.url = reverse('enviar-a-banca', args=[self.entrega.pk])

    def test_envio_registra_encerramento(self):
        """CA1 / RF12 / RN06, RN10, RN12: envio formal preserva a data de conclusão."""
        data = self.entrega.data_conclusao
        self.assertEqual(self.client.post(self.url).status_code, 200)
        self.entrega.refresh_from_db()
        self.assertEqual(self.entrega.estado, EstadoEntrega.ENVIADA_A_BANCA)
        self.assertEqual(self.entrega.data_conclusao, data)
        evento = self.tcc.eventos.get(tipo=TipoEvento.ENTREGA_ENVIADA_A_BANCA)
        self.assertEqual(evento.entrega, self.entrega)
        self.assertIn('Encerramento formal', evento.descricao)

    def test_recusa_demais_estados(self):
        """CA1 / RN12: só concluída é aceita, sem gerar eventos em recusas."""
        for estado in EstadoEntrega.values:
            if estado != EstadoEntrega.CONCLUIDA:
                with self.subTest(estado=estado):
                    self.definir_estado(estado)
                    self.assertEqual(self.client.post(self.url).status_code, 400)
                    self.entrega.refresh_from_db()
                    self.assertEqual(self.entrega.estado, estado)
        self.assertEqual(self.tcc.eventos.count(), 0)

    def test_serializer_encontra_concluida(self):
        """CA1 / RN12: concluída sai da revisão e aparece em entrega_para_banca."""
        linha = self.client.get(reverse('orientandos')).data[0]
        self.assertIsNone(linha['entrega_para_revisao'])
        self.assertEqual(linha['entrega_para_banca']['id'], self.entrega.pk)
        self.client.post(self.url)
        self.assertIsNone(self.client.get(reverse('orientandos')).data[0]['entrega_para_banca'])

    def test_outro_orientador_sem_acesso(self):
        """RN05 / RNF04: somente o orientador atual envia à banca."""
        outro = Usuario.objects.create_user(email='outro@prof.edu.br', nome='Outro', perfil=Perfil.ORIENTADOR)
        self.client.force_authenticate(outro)
        self.assertEqual(self.client.post(self.url).status_code, 403)

    def test_aluno_sem_acesso(self):
        """RNF04: aluno não pode enviar à banca."""
        self.client.force_authenticate(self.aluno)
        self.assertEqual(self.client.post(self.url).status_code, 403)

    def test_anonimo_sem_acesso(self):
        """RNF04: exige autenticação."""
        self.client.force_authenticate(None)
        self.assertEqual(self.client.post(self.url).status_code, 401)
