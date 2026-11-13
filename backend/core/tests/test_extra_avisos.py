"""
EXTRA — fora dos requisitos do documento: aba de Avisos.

Alternativa dentro do sistema ao Telegram (US02): lê os `Evento` do log (RN10, RF18)
e mostra a cada usuário o que lhe interessa (RNF04). Não cria dado novo além do
"visto até quando".
"""
from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status

from core import services
from core.models import Orientacao, Perfil, TipoEvento, Usuario

from .base_test import BaseEntregaTests, criar_versao


class AvisosTests(BaseEntregaTests):
    def entrar_como(self, usuario):
        self.client.force_authenticate(usuario)

    def listar(self):
        return self.client.get(reverse("avisos"))

    def test_orientador_e_avisado_quando_o_aluno_sinaliza_a_entrega(self):
        """RF16 / RF18: o gatilho é o Evento da US08."""
        criar_versao(self.entrega)
        self.sinalizar()

        self.entrar_como(self.orientador)
        resposta = self.listar()

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(resposta.data["nao_lidos"], 1)
        aviso = resposta.data["avisos"][0]
        self.assertEqual(aviso["tipo"], TipoEvento.ENTREGA_PRONTA)
        self.assertEqual(aviso["de"], "Lucas")
        self.assertEqual(aviso["entrega_id"], self.entrega.id)
        self.assertTrue(aviso["nao_lido"])

    def test_quem_fez_a_acao_nao_recebe_aviso_dela(self):
        criar_versao(self.entrega)
        self.sinalizar()

        resposta = self.listar()  # logado como o aluno

        self.assertEqual(resposta.data["nao_lidos"], 0)
        self.assertEqual(resposta.data["avisos"], [])

    def test_aluno_e_avisado_do_que_o_orientador_faz(self):
        criar_versao(self.entrega)
        self.sinalizar()
        self.entrar_como(self.orientador)
        self.client.post(reverse("iniciar-revisao", args=[self.entrega.id]))

        self.entrar_como(self.aluno)
        resposta = self.listar()

        tipos = [a["tipo"] for a in resposta.data["avisos"]]
        self.assertIn(TipoEvento.ENTREGA_EM_REVISAO, tipos)
        self.assertEqual(resposta.data["nao_lidos"], 1)

    def test_orientador_so_recebe_os_tipos_que_dependem_dele(self):
        """Envio de versão e criação de entrega ficam no log, mas não viram aviso."""
        services.registrar_evento(self.tcc, TipoEvento.UPLOAD, "Versão enviada.", usuario=self.aluno)
        services.registrar_evento(
            self.tcc, TipoEvento.ENTREGA_CRIADA, "Entrega criada.", usuario=self.aluno
        )

        self.entrar_como(self.orientador)

        self.assertEqual(self.listar().data["avisos"], [])

    def test_marcar_como_lidos_zera_o_contador_e_novos_avisos_voltam_a_contar(self):
        criar_versao(self.entrega)
        self.sinalizar()
        self.entrar_como(self.orientador)

        resposta = self.client.post(reverse("marcar-avisos-lidos"))
        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(resposta.data["nao_lidos"], 0)

        depois = self.listar()
        self.assertEqual(depois.data["nao_lidos"], 0)
        self.assertFalse(depois.data["avisos"][0]["nao_lido"])

        services.registrar_evento(
            self.tcc, TipoEvento.TEMA_REENVIADO, "Tema reenviado.", usuario=self.aluno
        )
        self.assertEqual(self.listar().data["nao_lidos"], 1)

    def test_orientador_novo_nao_recebe_como_novo_o_que_aconteceu_antes_de_assumir(self):
        """RN08: o histórico é preservado, mas não vira aviso para quem chega depois."""
        criar_versao(self.entrega)
        self.sinalizar()
        novo = Usuario.objects.create_user(
            email="carla@prof.edu.br", nome="Carla", senha="senhaForte123",
            perfil=Perfil.ORIENTADOR,
        )
        self.orientacao.encerrar()
        Orientacao.objects.create(
            tcc=self.tcc, orientador=novo, data_inicio=timezone.now() + timedelta(seconds=1)
        )

        self.entrar_como(novo)

        self.assertEqual(self.listar().data["avisos"], [])

    def test_orientador_que_saiu_nao_recebe_mais_avisos_do_tcc(self):
        """RN05."""
        self.orientacao.encerrar()
        services.registrar_evento(
            self.tcc, TipoEvento.TEMA_REENVIADO, "Tema reenviado.", usuario=self.aluno
        )

        self.entrar_como(self.orientador)

        self.assertEqual(self.listar().data["avisos"], [])

    def test_exige_estar_logado(self):
        self.client.force_authenticate(None)

        self.assertEqual(self.listar().status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(
            self.client.post(reverse("marcar-avisos-lidos")).status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_cada_usuario_ve_so_o_seu_tcc(self):
        """RNF04."""
        outra = self.outro_aluno()
        services.registrar_evento(
            self.tcc, TipoEvento.TEMA_APROVADO, "Aprovado.", usuario=self.orientador
        )

        self.entrar_como(outra)

        self.assertEqual(self.listar().data["avisos"], [])
