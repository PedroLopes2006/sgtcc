"""
RNF14 — os dados do banco podem ser exportados periodicamente.

Confere o comando `exportar_dados`: grava um JSON com os registros, não deixa
a senha em texto (RNF03) e mantém só as exportações mais recentes.
"""
import json
import tempfile
from io import StringIO
from pathlib import Path

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from core.models import Perfil, TCC, Usuario


class ExportarDadosTests(TestCase):
    def setUp(self):
        self.aluno = Usuario.objects.create_user(
            email="lucas@aluno.edu.br", nome="Lucas", senha="senhaForte123", perfil=Perfil.ALUNO
        )
        TCC.objects.create(aluno=self.aluno)
        self.pasta = tempfile.TemporaryDirectory()
        self.addCleanup(self.pasta.cleanup)

    def exportar(self, **opcoes):
        call_command("exportar_dados", pasta=self.pasta.name, stdout=StringIO(), **opcoes)
        return sorted(Path(self.pasta.name).glob("sgtcc-*.json"))

    def test_grava_um_json_com_os_registros(self):
        arquivos = self.exportar()

        self.assertEqual(len(arquivos), 1)
        registros = json.loads(arquivos[0].read_text(encoding="utf-8"))
        modelos = {registro["model"] for registro in registros}
        self.assertIn("core.usuario", modelos)
        self.assertIn("core.tcc", modelos)

    def test_a_senha_sai_so_como_hash(self):
        """RNF03."""
        texto = self.exportar()[0].read_text(encoding="utf-8")

        self.assertNotIn("senhaForte123", texto)

    def test_guarda_so_as_exportacoes_mais_recentes(self):
        pasta = Path(self.pasta.name)
        for nome in ("sgtcc-20200101-000000.json", "sgtcc-20200102-000000.json"):
            (pasta / nome).write_text("[]", encoding="utf-8")

        arquivos = self.exportar(manter=2)

        nomes = [a.name for a in arquivos]
        self.assertEqual(len(nomes), 2)
        self.assertNotIn("sgtcc-20200101-000000.json", nomes)

    def test_nao_apaga_arquivos_que_nao_sao_exportacoes(self):
        pasta = Path(self.pasta.name)
        (pasta / "anotacoes.txt").write_text("não mexa", encoding="utf-8")

        self.exportar(manter=1)

        self.assertTrue((pasta / "anotacoes.txt").exists())

    def test_manter_precisa_ser_positivo(self):
        with self.assertRaises(CommandError):
            call_command("exportar_dados", pasta=self.pasta.name, manter=0, stdout=StringIO())
