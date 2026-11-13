"""
A conta do administrador não é um orientador que se possa escolher.

O superusuário nasce com perfil de orientador (ver `criar_admin`), mas serve só
à gestão pelo /admin. Ele não aparece na lista que o aluno vê (US03 CA1), não
pode ser indicado ao propor o tema (US03 / RF03) nem ser o destino de uma
reatribuição (US15 / RF14). Contas inativas também ficam de fora.
"""
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from core.models import Orientacao, Perfil, TCC, Tema, StatusTema, Usuario


class OrientadoresDisponiveisTests(APITestCase):
    def setUp(self):
        self.aluno = Usuario.objects.create_user(
            email="lucas@aluno.edu.br", nome="Lucas", senha="senhaForte123", perfil=Perfil.ALUNO
        )
        self.marcos = Usuario.objects.create_user(
            email="marcos@prof.edu.br", nome="Marcos", senha="senhaForte123",
            perfil=Perfil.ORIENTADOR,
        )
        self.paula = Usuario.objects.create_user(
            email="paula@prof.edu.br", nome="Paula", senha="senhaForte123",
            perfil=Perfil.ORIENTADOR,
        )
        self.admin = Usuario.objects.create_superuser(
            email="admin@sgtcc.test", nome="Administrador", senha="senhaForte123"
        )

    def test_a_conta_do_administrador_tem_perfil_de_orientador(self):
        """É por isso que a regra existe: sem ela, o administrador entraria na lista."""
        self.assertEqual(self.admin.perfil, Perfil.ORIENTADOR)
        self.assertTrue(self.admin.is_superuser)

    def test_a_lista_do_aluno_nao_traz_o_administrador(self):
        self.client.force_authenticate(self.aluno)

        resposta = self.client.get(reverse("orientadores"))

        nomes = sorted(o["nome"] for o in resposta.data)
        self.assertEqual(nomes, ["Marcos", "Paula"])

    def test_orientador_inativo_tambem_fica_de_fora(self):
        Usuario.objects.filter(pk=self.paula.pk).update(is_active=False)
        self.client.force_authenticate(self.aluno)

        nomes = [o["nome"] for o in self.client.get(reverse("orientadores")).data]

        self.assertEqual(nomes, ["Marcos"])

    def test_nao_da_para_propor_tema_indicando_o_administrador(self):
        """Mesmo sabendo o id, o aluno não consegue indicar o administrador."""
        self.client.force_authenticate(self.aluno)

        resposta = self.client.post(
            reverse("propor-tema"),
            {"titulo": "Tema", "descricao": "Descrição.", "orientador_id": self.admin.id},
            format="json",
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("orientador_id", resposta.data)
        self.assertFalse(TCC.objects.filter(aluno=self.aluno).exists())

    def test_propor_tema_com_um_orientador_comum_continua_funcionando(self):
        self.client.force_authenticate(self.aluno)

        resposta = self.client.post(
            reverse("propor-tema"),
            {"titulo": "Tema", "descricao": "Descrição.", "orientador_id": self.marcos.id},
            format="json",
        )

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)

    def test_nao_da_para_reatribuir_um_aluno_ao_administrador(self):
        tcc = TCC.objects.create(aluno=self.aluno)
        Tema.objects.create(
            tcc=tcc, titulo="Tema", descricao="Descrição.", status=StatusTema.APROVADO
        )
        Orientacao.objects.create(tcc=tcc, orientador=self.marcos)
        self.client.force_authenticate(self.marcos)

        resposta = self.client.post(
            reverse("reatribuir-orientador", args=[tcc.id]),
            {"novo_orientador": self.admin.id},
            format="json",
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(tcc.orientador_atual, self.marcos)
        self.assertEqual(tcc.orientacoes.count(), 1)

    def test_reatribuir_para_um_orientador_comum_continua_funcionando(self):
        tcc = TCC.objects.create(aluno=self.aluno)
        Tema.objects.create(
            tcc=tcc, titulo="Tema", descricao="Descrição.", status=StatusTema.APROVADO
        )
        Orientacao.objects.create(tcc=tcc, orientador=self.marcos)
        self.client.force_authenticate(self.marcos)

        resposta = self.client.post(
            reverse("reatribuir-orientador", args=[tcc.id]),
            {"novo_orientador": self.paula.id},
            format="json",
        )

        self.assertIn(resposta.status_code, (status.HTTP_200_OK, status.HTTP_201_CREATED))
        self.assertEqual(tcc.orientador_atual, self.paula)
