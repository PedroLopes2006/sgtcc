"""US18 (aluno envia), US19 (orientador avalia), US20 (envia à banca) — trabalho final."""
import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from core.models import (
    EstadoEntrega,
    EstadoTrabalhoFinal,
    Perfil,
    StatusGeralTCC,
    TipoEvento,
    TrabalhoFinal,
    Usuario,
)
from .base_test import BaseEntregaTests

ARMAZENAMENTO_TEMPORARIO = tempfile.mkdtemp()


def pdf(nome="tcc-final.pdf", conteudo=b"%PDF-1.4 trabalho final"):
    return SimpleUploadedFile(nome, conteudo, content_type="application/pdf")


@override_settings(MEDIA_ROOT=ARMAZENAMENTO_TEMPORARIO)
class TrabalhoFinalBase(BaseEntregaTests):
    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(ARMAZENAMENTO_TEMPORARIO, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        super().setUp()
        self.url_aluno = reverse("trabalho-final")

    def concluir_entregas(self):
        self.definir_estado(EstadoEntrega.CONCLUIDA)

    def enviar(self, arquivo=None):
        return self.client.post(self.url_aluno, {"arquivo": arquivo or pdf()}, format="multipart")

    def trabalho_em_estado(self, estado):
        """Trabalho final já enviado e levado direto ao estado pedido."""
        self.concluir_entregas()
        self.enviar()
        TrabalhoFinal.objects.filter(tcc=self.tcc).update(estado=estado)
        return TrabalhoFinal.objects.get(tcc=self.tcc)

    def url_acao(self, nome, trabalho):
        return reverse(f"trabalho-final-{nome}", args=[trabalho.pk])


# ---------------------------------------------------------------- US18


class EnviarTrabalhoFinalTests(TrabalhoFinalBase):
    def test_ca1_com_entregas_concluidas_entra_em_avaliacao(self):
        """CA1 / RN16: envio liberado; versão 1, estado em avaliação, evento registrado."""
        self.concluir_entregas()
        resposta = self.enviar()
        self.assertEqual(resposta.status_code, 201)
        trabalho = TrabalhoFinal.objects.get(tcc=self.tcc)
        self.assertEqual(trabalho.estado, EstadoTrabalhoFinal.EM_AVALIACAO)
        self.assertEqual(trabalho.versoes.get().numero, 1)
        self.assertEqual(resposta.data["estado"], "em_avaliacao")
        self.assertTrue(self.tcc.eventos.filter(tipo=TipoEvento.TRABALHO_FINAL_ENVIADO).exists())

    def test_ca2_entrega_pendente_bloqueia_e_diz_qual_falta(self):
        """CA2 / RN16: com entrega pendente o envio é recusado e a mensagem cita o título."""
        resposta = self.enviar()
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("Capítulo 1", str(resposta.data))
        self.assertFalse(TrabalhoFinal.objects.exists())
        self.assertEqual(self.tcc.eventos.count(), 0)

    def test_rn16_sem_nenhuma_entrega_tambem_bloqueia(self):
        """RN16: é preciso ter ao menos uma entrega."""
        self.entrega.delete()
        self.assertEqual(self.enviar().status_code, 400)

    def test_get_informa_o_que_impede_o_envio(self):
        """CA2: a tela do aluno recebe o estado, `pode_enviar` e as entregas pendentes."""
        dados = self.client.get(self.url_aluno).data
        self.assertEqual(dados["estado"], "nao_enviado")
        self.assertFalse(dados["pode_enviar"])
        self.assertEqual([e["titulo"] for e in dados["pendentes"]], ["Capítulo 1"])
        self.concluir_entregas()
        dados = self.client.get(self.url_aluno).data
        self.assertTrue(dados["pode_enviar"])
        self.assertEqual(dados["pendentes"], [])

    def test_ca3_depois_de_correcao_nova_versao_volta_para_avaliacao(self):
        """CA3 / RN13: versão 2 em "correção solicitada" volta para "em avaliação"."""
        self.trabalho_em_estado(EstadoTrabalhoFinal.CORRECAO_SOLICITADA)
        self.assertEqual(self.enviar().status_code, 201)
        trabalho = TrabalhoFinal.objects.get(tcc=self.tcc)
        self.assertEqual(trabalho.estado, EstadoTrabalhoFinal.EM_AVALIACAO)
        self.assertEqual(sorted(trabalho.versoes.values_list("numero", flat=True)), [1, 2])

    def test_rn18_depois_de_reprovado_o_aluno_tenta_de_novo(self):
        """RN18: reprovado aceita nova versão e o histórico anterior fica intacto."""
        trabalho = self.trabalho_em_estado(EstadoTrabalhoFinal.REPROVADO)
        self.assertEqual(self.enviar().status_code, 201)
        trabalho.refresh_from_db()
        self.assertEqual(trabalho.estado, EstadoTrabalhoFinal.EM_AVALIACAO)
        self.assertEqual(trabalho.versoes.count(), 2)

    def test_demais_estados_recusam_nova_versao(self):
        """CA3: em avaliação, aprovado e enviado à banca não aceitam arquivo novo."""
        trabalho = self.trabalho_em_estado(EstadoTrabalhoFinal.EM_AVALIACAO)
        for estado in (
            EstadoTrabalhoFinal.EM_AVALIACAO,
            EstadoTrabalhoFinal.APROVADO,
            EstadoTrabalhoFinal.ENVIADO_A_BANCA,
        ):
            with self.subTest(estado=estado):
                TrabalhoFinal.objects.filter(pk=trabalho.pk).update(estado=estado)
                self.assertEqual(self.enviar().status_code, 400)
        self.assertEqual(trabalho.versoes.count(), 1)

    def test_ca4_so_pdf(self):
        """CA4: mesmas regras de arquivo da US06."""
        self.concluir_entregas()
        resposta = self.enviar(SimpleUploadedFile("tcc.docx", b"conteudo"))
        self.assertEqual(resposta.status_code, 400)
        self.assertFalse(TrabalhoFinal.objects.exists())

    def test_so_aluno_envia(self):
        """RNF04: orientador não envia o trabalho final."""
        self.client.force_authenticate(self.orientador)
        self.assertEqual(self.enviar().status_code, 403)

    def test_anonimo_sem_acesso(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(self.url_aluno).status_code, 401)


# ---------------------------------------------------------------- US19


class AvaliarTrabalhoFinalTests(TrabalhoFinalBase):
    def setUp(self):
        super().setUp()
        self.trabalho = self.trabalho_em_estado(EstadoTrabalhoFinal.EM_AVALIACAO)
        self.client.force_authenticate(self.orientador)

    def test_ca1_aprovar(self):
        """CA1: aprova, registra a data e o evento."""
        resposta = self.client.post(self.url_acao("aprovar", self.trabalho))
        self.assertEqual(resposta.status_code, 200)
        self.trabalho.refresh_from_db()
        self.assertEqual(self.trabalho.estado, EstadoTrabalhoFinal.APROVADO)
        self.assertIsNotNone(self.trabalho.data_aprovacao)
        self.assertTrue(self.tcc.eventos.filter(tipo=TipoEvento.TRABALHO_FINAL_APROVADO).exists())

    def test_ca2_pedir_correcao_guarda_o_comentario(self):
        """CA2 / RN14: o parecer fica ligado à versão avaliada."""
        resposta = self.client.post(
            self.url_acao("solicitar-correcao", self.trabalho), {"comentario": "Revise a conclusão."}
        )
        self.assertEqual(resposta.status_code, 200)
        self.trabalho.refresh_from_db()
        self.assertEqual(self.trabalho.estado, EstadoTrabalhoFinal.CORRECAO_SOLICITADA)
        parecer = self.trabalho.comentarios.get()
        self.assertEqual(parecer.texto, "Revise a conclusão.")
        self.assertEqual(parecer.versao, self.trabalho.versao_atual)
        self.assertTrue(
            self.tcc.eventos.filter(tipo=TipoEvento.TRABALHO_FINAL_CORRECAO_SOLICITADA).exists()
        )

    def test_rn07_correcao_sem_comentario_e_recusada(self):
        """RN07: comentário obrigatório."""
        for corpo in ({}, {"comentario": "   "}):
            with self.subTest(corpo=corpo):
                resposta = self.client.post(self.url_acao("solicitar-correcao", self.trabalho), corpo)
                self.assertEqual(resposta.status_code, 400)
        self.trabalho.refresh_from_db()
        self.assertEqual(self.trabalho.estado, EstadoTrabalhoFinal.EM_AVALIACAO)

    def test_ca3_reprovar_com_justificativa(self):
        """CA3 / RN17: reprova e grava a justificativa."""
        resposta = self.client.post(
            self.url_acao("reprovar", self.trabalho), {"justificativa": "Fora do escopo do tema."}
        )
        self.assertEqual(resposta.status_code, 200)
        self.trabalho.refresh_from_db()
        self.assertEqual(self.trabalho.estado, EstadoTrabalhoFinal.REPROVADO)
        self.assertEqual(self.trabalho.comentarios.get().texto, "Fora do escopo do tema.")
        evento = self.tcc.eventos.get(tipo=TipoEvento.TRABALHO_FINAL_REPROVADO)
        self.assertIn("Fora do escopo do tema.", evento.descricao)

    def test_ca4_rn17_reprovar_sem_justificativa_e_recusado(self):
        """CA4 / RN17: sem justificativa nada muda e nenhum evento é criado."""
        eventos = self.tcc.eventos.count()
        for corpo in ({}, {"justificativa": ""}, {"justificativa": "  "}):
            with self.subTest(corpo=corpo):
                resposta = self.client.post(self.url_acao("reprovar", self.trabalho), corpo)
                self.assertEqual(resposta.status_code, 400)
        self.trabalho.refresh_from_db()
        self.assertEqual(self.trabalho.estado, EstadoTrabalhoFinal.EM_AVALIACAO)
        self.assertEqual(self.tcc.eventos.count(), eventos)

    def test_so_avalia_em_avaliacao(self):
        """Aprovar, pedir correção ou reprovar só valem "em avaliação"."""
        for estado in (
            EstadoTrabalhoFinal.CORRECAO_SOLICITADA,
            EstadoTrabalhoFinal.APROVADO,
            EstadoTrabalhoFinal.REPROVADO,
            EstadoTrabalhoFinal.ENVIADO_A_BANCA,
        ):
            TrabalhoFinal.objects.filter(pk=self.trabalho.pk).update(estado=estado)
            with self.subTest(estado=estado):
                self.assertEqual(self.client.post(self.url_acao("aprovar", self.trabalho)).status_code, 400)
                self.assertEqual(
                    self.client.post(
                        self.url_acao("reprovar", self.trabalho), {"justificativa": "x"}
                    ).status_code,
                    400,
                )
                self.assertEqual(
                    self.client.post(
                        self.url_acao("solicitar-correcao", self.trabalho), {"comentario": "x"}
                    ).status_code,
                    400,
                )

    def test_rn05_outro_orientador_sem_acesso(self):
        """CA5 / RN05: só o orientador ativo avalia ou consulta."""
        outro = Usuario.objects.create_user(
            email="outro@prof.edu.br", nome="Outro", senha="senhaForte123", perfil=Perfil.ORIENTADOR
        )
        self.client.force_authenticate(outro)
        self.assertEqual(self.client.post(self.url_acao("aprovar", self.trabalho)).status_code, 403)
        self.assertEqual(
            self.client.get(reverse("trabalho-final-orientador", args=[self.tcc.pk])).status_code, 403
        )

    def test_aluno_nao_avalia(self):
        """RNF04: aluno não aprova o próprio trabalho."""
        self.client.force_authenticate(self.aluno)
        self.assertEqual(self.client.post(self.url_acao("aprovar", self.trabalho)).status_code, 403)

    def test_consulta_do_orientador_traz_versoes_e_acoes(self):
        """A tela de avaliação recebe versões, pareceres e o que pode ser feito agora."""
        dados = self.client.get(reverse("trabalho-final-orientador", args=[self.tcc.pk])).data
        self.assertEqual(dados["aluno"]["nome"], "Lucas")
        self.assertEqual(len(dados["trabalho"]["versoes"]), 1)
        self.assertEqual(
            dados["trabalho"]["acoes"],
            {"aprovar": True, "solicitar_correcao": True, "reprovar": True, "enviar_a_banca": False},
        )

    def test_consulta_sem_envio_devolve_trabalho_nulo(self):
        TrabalhoFinal.objects.all().delete()
        dados = self.client.get(reverse("trabalho-final-orientador", args=[self.tcc.pk])).data
        self.assertIsNone(dados["trabalho"])

    def test_orientandos_traz_resumo_do_trabalho_final(self):
        """US19: a lista de Orientandos mostra o estado e as ações do trabalho final."""
        linha = self.client.get(reverse("orientandos")).data[0]
        self.assertEqual(linha["trabalho_final"]["estado"], "em_avaliacao")
        self.assertTrue(linha["trabalho_final"]["acoes"]["aprovar"])


# ---------------------------------------------------------------- US20


class EnviarTrabalhoFinalABancaTests(TrabalhoFinalBase):
    def setUp(self):
        super().setUp()
        self.trabalho = self.trabalho_em_estado(EstadoTrabalhoFinal.APROVADO)
        self.client.force_authenticate(self.orientador)

    def test_ca1_ca3_envia_a_banca_e_conclui_o_tcc(self):
        """CA1, CA3 / RN12: registra a data, conclui o TCC e gera o evento."""
        resposta = self.client.post(self.url_acao("enviar-a-banca", self.trabalho))
        self.assertEqual(resposta.status_code, 200)
        self.trabalho.refresh_from_db()
        self.assertEqual(self.trabalho.estado, EstadoTrabalhoFinal.ENVIADO_A_BANCA)
        self.assertIsNotNone(self.trabalho.data_banca)
        self.tcc.refresh_from_db()
        self.assertEqual(self.tcc.status_geral, StatusGeralTCC.CONCLUIDO)
        self.assertTrue(
            self.tcc.eventos.filter(tipo=TipoEvento.TRABALHO_FINAL_ENVIADO_A_BANCA).exists()
        )

    def test_ca2_rn12_so_aprovado_vai_a_banca(self):
        """CA2 / RN12: qualquer outro estado é recusado, sem mudar o TCC."""
        for estado in (
            EstadoTrabalhoFinal.EM_AVALIACAO,
            EstadoTrabalhoFinal.CORRECAO_SOLICITADA,
            EstadoTrabalhoFinal.REPROVADO,
            EstadoTrabalhoFinal.ENVIADO_A_BANCA,
        ):
            TrabalhoFinal.objects.filter(pk=self.trabalho.pk).update(estado=estado)
            with self.subTest(estado=estado):
                resposta = self.client.post(self.url_acao("enviar-a-banca", self.trabalho))
                self.assertEqual(resposta.status_code, 400)
        self.tcc.refresh_from_db()
        self.assertEqual(self.tcc.status_geral, StatusGeralTCC.EM_ANDAMENTO)

    def test_rn05_e_rnf04(self):
        """RN05 / RNF04: só o orientador ativo envia à banca."""
        self.client.force_authenticate(self.aluno)
        self.assertEqual(self.client.post(self.url_acao("enviar-a-banca", self.trabalho)).status_code, 403)
        outro = Usuario.objects.create_user(
            email="outro@prof.edu.br", nome="Outro", senha="senhaForte123", perfil=Perfil.ORIENTADOR
        )
        self.client.force_authenticate(outro)
        self.assertEqual(self.client.post(self.url_acao("enviar-a-banca", self.trabalho)).status_code, 403)


# ---------------------------------------------------------------- Avisos (RN10, RF16)


class AvisosDoTrabalhoFinalTests(TrabalhoFinalBase):
    def test_orientador_recebe_aviso_do_envio_e_aluno_do_parecer(self):
        """RF16: o envio avisa o orientador; a decisão avisa o aluno (e não o próprio autor)."""
        self.concluir_entregas()
        self.enviar()
        self.client.force_authenticate(self.orientador)
        tipos = [a["tipo"] for a in self.client.get(reverse("avisos")).data["avisos"]]
        self.assertIn(TipoEvento.TRABALHO_FINAL_ENVIADO, tipos)

        trabalho = TrabalhoFinal.objects.get(tcc=self.tcc)
        self.client.post(self.url_acao("aprovar", trabalho))
        tipos_orientador = [a["tipo"] for a in self.client.get(reverse("avisos")).data["avisos"]]
        self.assertNotIn(TipoEvento.TRABALHO_FINAL_APROVADO, tipos_orientador)

        self.client.force_authenticate(self.aluno)
        tipos_aluno = [a["tipo"] for a in self.client.get(reverse("avisos")).data["avisos"]]
        self.assertIn(TipoEvento.TRABALHO_FINAL_APROVADO, tipos_aluno)
        self.assertNotIn(TipoEvento.TRABALHO_FINAL_ENVIADO, tipos_aluno)
