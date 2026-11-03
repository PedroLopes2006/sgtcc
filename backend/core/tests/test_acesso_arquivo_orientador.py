"""
Acesso do orientador ao arquivo da versão atual.

Nenhum critério de aceite das US diz isso com todas as letras, mas a revisão
(US10 a US12) pressupõe que o orientador leia o documento antes de comentar ou
pedir correção. O acesso sai do campo `versao_atual.arquivo_url` que já vem em
`GET /api/orientandos/`: em produção é uma URL assinada do Supabase Storage,
que só é gerada para quem a API deixa ver o TCC (RN05).
"""
from django.urls import reverse
from django.utils import timezone
from rest_framework import status

from core.models import EstadoEntrega, Orientacao, Perfil, Usuario

from .base_test import BaseEntregaTests, criar_versao


class AcessoAoArquivoTests(BaseEntregaTests):
    def setUp(self):
        super().setUp()
        criar_versao(self.entrega)
        self.versao = criar_versao(self.entrega)  # a versão atual é a 2
        self.definir_estado(EstadoEntrega.PRONTO_PARA_REVISAO)

    def orientandos(self, usuario):
        self.client.force_authenticate(usuario)
        return self.client.get(reverse("orientandos"))

    def outro_orientador(self):
        return Usuario.objects.create_user(
            email="paula@prof.edu.br", nome="Paula", senha="senhaForte123",
            perfil=Perfil.ORIENTADOR,
        )

    def test_orientador_ativo_recebe_a_url_da_versao_atual(self):
        resposta = self.orientandos(self.orientador)

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        versao = resposta.data[0]["entregas"][0]["versao_atual"]
        self.assertEqual(versao["numero"], 2)
        self.assertTrue(versao["arquivo_url"])
        self.assertIn(self.versao.arquivo.name, versao["arquivo_url"])

    def test_a_entrega_em_revisao_tambem_traz_a_url(self):
        # É nela que ficam os botões da US10 e da US11, e o link junto deles.
        linha = self.orientandos(self.orientador).data[0]
        versao = linha["entrega_para_revisao"]["versao_atual"]
        self.assertEqual(versao["numero"], 2)
        self.assertIn(self.versao.arquivo.name, versao["arquivo_url"])

    def test_a_url_e_absoluta(self):
        # Em disco (desenvolvimento) o storage devolve "/media/...", e o front
        # roda em outra origem: sem o host da API, o link abriria no Vite.
        versao = self.orientandos(self.orientador).data[0]["entregas"][0]["versao_atual"]
        self.assertTrue(versao["arquivo_url"].startswith("http://testserver/"))

    def test_entrega_sem_versao_nao_traz_url(self):
        self.versao.entrega.versoes.all().delete()
        self.definir_estado(EstadoEntrega.RASCUNHO)

        entrega = self.orientandos(self.orientador).data[0]["entregas"][0]
        self.assertIsNone(entrega["versao_atual"])

    def test_orientador_sem_orientacao_sobre_o_tcc_nao_ve_o_arquivo(self):
        """RN05 — só o orientador vinculado acessa o TCC."""
        resposta = self.orientandos(self.outro_orientador())

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(resposta.data, [])
        self.assertNotIn(self.versao.arquivo.name, resposta.content.decode())

    def test_orientador_com_orientacao_encerrada_perde_o_acesso(self):
        """RN05 / RN09 — depois da troca de orientador, só o novo vê o TCC."""
        Orientacao.objects.filter(pk=self.orientacao.pk).update(
            ativa=False, data_fim=timezone.now()
        )
        novo = self.outro_orientador()
        Orientacao.objects.create(tcc=self.tcc, orientador=novo)

        antigo = self.orientandos(self.orientador)
        self.assertEqual(antigo.data, [])
        self.assertNotIn(self.versao.arquivo.name, antigo.content.decode())

        atual = self.orientandos(novo).data[0]["entregas"][0]["versao_atual"]
        self.assertIn(self.versao.arquivo.name, atual["arquivo_url"])

    def test_aluno_nao_acessa_a_lista_de_orientandos(self):
        resposta = self.orientandos(self.aluno)
        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)
