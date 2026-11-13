"""
EXTRA — tela de Revisão do orientador (protótipo do Figma).

Fora dos requisitos do documento: não há RF, RN nem US para ela. A tela reúne,
num lugar só, o que as US07, US10, US11, US12 e US13 já fazem. Aqui se confere
a API que a alimenta: `GET /api/entregas/<id>/revisao/`.

Regras que ela respeita: RN05 (só o orientador ativo), RN06 (só a primeira
entrega pendente tem ações) e RNF04 (acesso por perfil).
"""
from datetime import timedelta

from django.urls import reverse
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
    Usuario,
)
from core.tests.base_test import criar_versao

TODAS_AS_ACOES = {
    "iniciar_revisao",
    "solicitar_correcao",
    "aprovar",
    "comentar",
    "enviar_a_banca",
}


class TelaDeRevisaoTests(APITestCase):
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
        self.entrega = Entrega.objects.create(
            tcc=self.tcc, titulo="Capítulo 1", prazo=self.prazo,
            estado=EstadoEntrega.EM_REVISAO,
        )
        self.url = reverse("revisao-entrega", args=[self.entrega.id])
        self.client.force_authenticate(self.orientador)

    def _acoes(self, entrega=None):
        entrega = entrega or self.entrega
        resposta = self.client.get(reverse("revisao-entrega", args=[entrega.id]))
        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        return resposta.data["acoes"]

    # ---- o que a tela mostra

    def test_traz_a_entrega_com_aluno_tema_versoes_e_comentarios(self):
        v1 = criar_versao(self.entrega)
        v2 = criar_versao(self.entrega)
        Comentario.objects.create(
            entrega=self.entrega, versao=v2, autor=self.orientador, texto="Revise o texto."
        )

        resposta = self.client.get(self.url)

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        dados = resposta.data
        self.assertEqual(dados["titulo"], "Capítulo 1")
        self.assertEqual(dados["aluno"]["nome"], "Lucas")
        self.assertEqual(dados["tema"], "Gestão de TCC")
        # RN13 — as versões vêm da mais antiga à mais nova; a tela inverte para mostrar a atual primeiro.
        self.assertEqual([v["numero"] for v in dados["versoes"]], [v1.numero, v2.numero])
        self.assertEqual(dados["versao_atual"]["numero"], v2.numero)
        self.assertEqual([c["texto"] for c in dados["comentarios"]], ["Revise o texto."])
        self.assertEqual(dados["comentarios"][0]["versao"], v2.numero)

    def test_entrega_sem_versao_nem_comentario_traz_listas_vazias(self):
        dados = self.client.get(self.url).data
        self.assertEqual(dados["versoes"], [])
        self.assertEqual(dados["comentarios"], [])
        self.assertIsNone(dados["versao_atual"])

    # ---- o que o orientador pode fazer em cada estado

    def test_acoes_por_estado_da_primeira_entrega_pendente(self):
        esperado = {
            EstadoEntrega.RASCUNHO: set(),
            EstadoEntrega.PRONTO_PARA_REVISAO: {"iniciar_revisao"},
            EstadoEntrega.EM_REVISAO: {"solicitar_correcao", "aprovar", "comentar"},
            EstadoEntrega.CORRECAO_SOLICITADA: {"comentar"},
            EstadoEntrega.CONCLUIDA: {"enviar_a_banca"},
            EstadoEntrega.ENVIADA_A_BANCA: set(),
        }
        for estado, ligadas in esperado.items():
            with self.subTest(estado=estado):
                Entrega.objects.filter(pk=self.entrega.pk).update(estado=estado)

                acoes = self._acoes()

                self.assertEqual({nome for nome, ativa in acoes.items() if ativa}, ligadas)
                self.assertEqual(set(acoes), TODAS_AS_ACOES)

    def test_rn06_a_entrega_seguinte_nao_tem_acoes_enquanto_a_primeira_esta_pendente(self):
        segunda = Entrega.objects.create(
            tcc=self.tcc, titulo="Capítulo 2", prazo=self.prazo + timedelta(days=7),
            estado=EstadoEntrega.EM_REVISAO,
        )

        acoes = self._acoes(segunda)

        self.assertFalse(any(acoes.values()))

        # Encerrada a primeira, a segunda passa a ser a pendente e ganha as ações.
        Entrega.objects.filter(pk=self.entrega.pk).update(estado=EstadoEntrega.CONCLUIDA)
        self.assertTrue(self._acoes(segunda)["aprovar"])

    def test_as_acoes_coincidem_com_o_que_os_endpoints_aceitam(self):
        """
        A tela só liga um botão se a API diz que pode; este teste garante que a
        resposta de `acoes` é a mesma do endpoint que executa cada ação.
        """
        endpoints = {
            "iniciar_revisao": ("iniciar-revisao", None),
            "solicitar_correcao": ("solicitar-correcao", {"comentario": "Ajuste."}),
            "aprovar": ("aprovar-entrega", None),
            "comentar": ("adicionar-comentario", {"comentario": "Mais um."}),
            "enviar_a_banca": ("enviar-a-banca", None),
        }
        for estado in EstadoEntrega.values:
            for acao, (rota, corpo) in endpoints.items():
                with self.subTest(estado=estado, acao=acao):
                    Entrega.objects.filter(pk=self.entrega.pk).update(estado=estado)
                    liberada = self._acoes()[acao]

                    resposta = self.client.post(
                        reverse(rota, args=[self.entrega.id]), corpo, format="json"
                    )

                    self.assertEqual(
                        resposta.status_code in (status.HTTP_200_OK, status.HTTP_201_CREATED),
                        liberada,
                    )

    # ---- quem pode abrir

    def test_rn05_somente_o_orientador_ativo_abre_a_revisao(self):
        outro = Usuario.objects.create_user(
            email="outro@prof.edu.br", nome="Outro", senha="senhaForte123",
            perfil=Perfil.ORIENTADOR,
        )
        self.client.force_authenticate(outro)
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_403_FORBIDDEN)

    def test_ex_orientador_nao_abre_mais_a_revisao(self):
        novo = Usuario.objects.create_user(
            email="paula@prof.edu.br", nome="Paula", senha="senhaForte123",
            perfil=Perfil.ORIENTADOR,
        )
        self.tcc.orientacao_ativa.encerrar()
        Orientacao.objects.create(tcc=self.tcc, orientador=novo)

        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(novo)
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_200_OK)

    def test_rnf04_o_aluno_nao_abre_a_tela_de_revisao(self):
        self.client.force_authenticate(self.aluno)
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_403_FORBIDDEN)

    def test_entrega_inexistente_retorna_404(self):
        resposta = self.client.get(reverse("revisao-entrega", args=[99999]))
        self.assertEqual(resposta.status_code, status.HTTP_404_NOT_FOUND)

    def test_so_leitura(self):
        for metodo in ("post", "put", "patch", "delete"):
            with self.subTest(metodo=metodo):
                resposta = getattr(self.client, metodo)(self.url, {}, format="json")
                self.assertEqual(resposta.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
