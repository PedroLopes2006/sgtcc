"""
US11 / RF10 — comentário adicional do orientador, sem mudar o estado da entrega.

É o caminho para complementar ou corrigir o que foi escrito: o comentário
anterior nunca é editado (RN14), então o ajuste vira um comentário novo.

Regras exercitadas: RN05 (orientador ativo), RN06 (primeira entrega pendente),
RN07 (texto obrigatório), RN14 (comentários só crescem), RF10 (vínculo com a
entrega e a versão), RF16 / RF18 / RNF12 (Evento só de inclusão) e RNF04
(acesso por perfil).
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
from core.tests.base_test import criar_versao


class ComentarioAdicionalTests(APITestCase):
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
            tcc=self.tcc, titulo="Capítulo 1", prazo=timezone.localdate() + timedelta(days=30),
            estado=EstadoEntrega.EM_REVISAO,
        )
        self.versao = criar_versao(self.entrega)
        self.url = reverse("adicionar-comentario", args=[self.entrega.id])
        self.dados = {"comentario": "Inclua também a seção de limitações."}
        self.client.force_authenticate(self.orientador)

    def test_comentario_em_revisao_e_gravado_sem_mudar_o_estado(self):
        resposta = self.client.post(self.url, self.dados, format="json")

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resposta.data["texto"], "Inclua também a seção de limitações.")
        self.entrega.refresh_from_db()
        self.assertEqual(self.entrega.estado, EstadoEntrega.EM_REVISAO)

    def test_comentario_com_correcao_solicitada_complementa_o_pedido(self):
        """O caso de uso principal: o orientador quer acrescentar algo depois de pedir a correção."""
        Entrega.objects.filter(pk=self.entrega.pk).update(estado=EstadoEntrega.CORRECAO_SOLICITADA)
        Comentario.objects.create(
            entrega=self.entrega, versao=self.versao, autor=self.orientador, texto="Revise o texto."
        )

        resposta = self.client.post(self.url, self.dados, format="json")

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        self.entrega.refresh_from_db()
        self.assertEqual(self.entrega.estado, EstadoEntrega.CORRECAO_SOLICITADA)
        self.assertEqual(Comentario.objects.filter(entrega=self.entrega).count(), 2)

    def test_rf10_o_comentario_fica_ligado_a_entrega_e_a_versao(self):
        self.client.post(self.url, self.dados, format="json")

        comentario = Comentario.objects.get(entrega=self.entrega)
        self.assertEqual(comentario.autor, self.orientador)
        self.assertEqual(comentario.versao, self.versao)

    def test_rn14_o_comentario_anterior_continua_intacto(self):
        """O ajuste vira comentário novo: o antigo não é alterado nem removido."""
        antigo = Comentario.objects.create(
            entrega=self.entrega, versao=self.versao, autor=self.orientador, texto="Texto original."
        )

        self.client.post(self.url, self.dados, format="json")

        antigo.refresh_from_db()
        self.assertEqual(antigo.texto, "Texto original.")
        self.assertEqual(
            list(Comentario.objects.filter(entrega=self.entrega).values_list("texto", flat=True)),
            ["Texto original.", "Inclua também a seção de limitações."],
        )

    def test_rn14_nao_ha_rota_para_editar_ou_remover(self):
        resposta = self.client.post(self.url, self.dados, format="json")
        for nome in ("editar-comentario", "remover-comentario", "comentario"):
            with self.assertRaises(NoReverseMatch):
                reverse(nome, args=[resposta.data["id"]])
        for metodo in ("put", "patch", "delete"):
            with self.subTest(metodo=metodo):
                chamada = getattr(self.client, metodo)(self.url, self.dados, format="json")
                self.assertEqual(chamada.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_rn07_o_texto_e_obrigatorio(self):
        for corpo in ({}, {"comentario": ""}, {"comentario": "   "}):
            with self.subTest(corpo=corpo):
                resposta = self.client.post(self.url, corpo, format="json")
                self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn("comentario", resposta.data)
        self.assertEqual(Comentario.objects.count(), 0)
        self.assertFalse(self.tcc.eventos.filter(tipo=TipoEvento.COMENTARIO_ADICIONADO).exists())

    def test_so_comenta_com_a_entrega_em_revisao_ou_com_correcao_solicitada(self):
        permitidos = (EstadoEntrega.EM_REVISAO, EstadoEntrega.CORRECAO_SOLICITADA)
        for estado in [e for e in EstadoEntrega.values if e not in permitidos]:
            with self.subTest(estado=estado):
                Entrega.objects.filter(pk=self.entrega.pk).update(estado=estado)

                resposta = self.client.post(self.url, self.dados, format="json")

                self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Comentario.objects.count(), 0)

    def test_aluno_e_notificado_por_evento_com_o_texto(self):
        """RF16 / RF18 / RNF12 — o Evento é o gatilho da notificação e é só de inclusão."""
        self.client.post(self.url, self.dados, format="json")

        evento = self.tcc.eventos.get(tipo=TipoEvento.COMENTARIO_ADICIONADO)
        self.assertEqual(evento.usuario_relacionado, self.orientador)
        self.assertEqual(evento.entrega, self.entrega)
        self.assertIn("Capítulo 1", evento.descricao)
        self.assertIn("seção de limitações", evento.descricao)

    def test_rn05_somente_o_orientador_ativo_comenta(self):
        outro = Usuario.objects.create_user(
            email="outro@prof.edu.br", nome="Outro", senha="senhaForte123",
            perfil=Perfil.ORIENTADOR,
        )
        self.client.force_authenticate(outro)

        resposta = self.client.post(self.url, self.dados, format="json")

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(Comentario.objects.count(), 0)

    def test_rnf04_aluno_nao_comenta_como_orientador(self):
        self.client.force_authenticate(self.aluno)
        resposta = self.client.post(self.url, self.dados, format="json")
        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)

    def test_entrega_inexistente_retorna_404(self):
        resposta = self.client.post(
            reverse("adicionar-comentario", args=[99999]), self.dados, format="json"
        )
        self.assertEqual(resposta.status_code, status.HTTP_404_NOT_FOUND)

    def test_rn06_so_a_primeira_entrega_pendente_recebe_comentario(self):
        segunda = Entrega.objects.create(
            tcc=self.tcc, titulo="Capítulo 2", prazo=self.entrega.prazo + timedelta(days=7),
            estado=EstadoEntrega.EM_REVISAO,
        )
        criar_versao(segunda)
        url_segunda = reverse("adicionar-comentario", args=[segunda.id])

        resposta = self.client.post(url_segunda, self.dados, format="json")

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Capítulo 1", str(resposta.data["detail"]))
        self.assertEqual(Comentario.objects.filter(entrega=segunda).count(), 0)

        # Encerrada a primeira, a segunda passa a ser a pendente.
        Entrega.objects.filter(pk=self.entrega.pk).update(estado=EstadoEntrega.CONCLUIDA)
        resposta = self.client.post(url_segunda, self.dados, format="json")
        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)


class SaidasDoComentarioAdicionalTests(APITestCase):
    """O que as telas leem: a lista de comentários e a entrega que aceita um comentário a mais."""

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

    def test_o_aluno_le_todos_os_comentarios_da_entrega_em_ordem(self):
        entrega = Entrega.objects.create(
            tcc=self.tcc, titulo="Capítulo 1", prazo=self.prazo,
            estado=EstadoEntrega.CORRECAO_SOLICITADA,
        )
        versao = criar_versao(entrega)
        for texto in ("Primeiro comentário.", "Segundo comentário."):
            Comentario.objects.create(
                entrega=entrega, versao=versao, autor=self.orientador, texto=texto
            )
        self.client.force_authenticate(self.aluno)

        dados = self.client.get(reverse("entregas")).data[0]

        self.assertEqual(
            [c["texto"] for c in dados["comentarios"]],
            ["Primeiro comentário.", "Segundo comentário."],
        )
        self.assertEqual(dados["comentarios"][0]["versao"], 1)
        self.assertEqual(dados["ultimo_comentario"]["texto"], "Segundo comentário.")

    def test_entrega_sem_comentario_traz_a_lista_vazia(self):
        Entrega.objects.create(tcc=self.tcc, titulo="Capítulo 1", prazo=self.prazo)
        self.client.force_authenticate(self.aluno)
        self.assertEqual(self.client.get(reverse("entregas")).data[0]["comentarios"], [])

    def test_a_linha_do_orientador_oferece_comentar_em_revisao_e_com_correcao(self):
        for estado in (EstadoEntrega.EM_REVISAO, EstadoEntrega.CORRECAO_SOLICITADA):
            with self.subTest(estado=estado):
                Entrega.objects.all().delete()
                Entrega.objects.create(
                    tcc=self.tcc, titulo="Capítulo 1", prazo=self.prazo, estado=estado
                )

                linha = self._linha_do_orientador()

                self.assertEqual(linha["entrega_para_comentario"]["titulo"], "Capítulo 1")
                self.assertEqual(linha["entrega_para_comentario"]["estado"], estado)

    def test_a_linha_nao_oferece_comentar_nos_outros_estados(self):
        permitidos = (EstadoEntrega.EM_REVISAO, EstadoEntrega.CORRECAO_SOLICITADA)
        for estado in [e for e in EstadoEntrega.values if e not in permitidos]:
            with self.subTest(estado=estado):
                Entrega.objects.all().delete()
                Entrega.objects.create(
                    tcc=self.tcc, titulo="Capítulo 1", prazo=self.prazo, estado=estado
                )
                self.assertIsNone(self._linha_do_orientador()["entrega_para_comentario"])

    def test_a_entrega_seguinte_nao_aparece_enquanto_a_primeira_esta_pendente(self):
        """RN06 — o Capítulo 2 está em revisão, mas o Capítulo 1 ainda é rascunho."""
        Entrega.objects.create(tcc=self.tcc, titulo="Capítulo 1", prazo=self.prazo)
        Entrega.objects.create(
            tcc=self.tcc, titulo="Capítulo 2", prazo=self.prazo + timedelta(days=7),
            estado=EstadoEntrega.EM_REVISAO,
        )
        self.assertIsNone(self._linha_do_orientador()["entrega_para_comentario"])

    def test_a_linha_traz_os_comentarios_que_o_orientador_ja_escreveu(self):
        entrega = Entrega.objects.create(
            tcc=self.tcc, titulo="Capítulo 1", prazo=self.prazo, estado=EstadoEntrega.EM_REVISAO
        )
        Comentario.objects.create(
            entrega=entrega, versao=criar_versao(entrega), autor=self.orientador,
            texto="Já escrito.",
        )

        textos = [c["texto"] for c in self._linha_do_orientador()["entrega_para_comentario"]["comentarios"]]

        self.assertEqual(textos, ["Já escrito."])
