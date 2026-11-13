"""
RNF14 — exportação periódica dos dados do banco.

Grava um arquivo JSON com todo o conteúdo do SGTCC (usuários, TCCs, temas,
entregas, versões, comentários e eventos) e apaga os mais antigos, para a pasta
não crescer sem fim. É feito para rodar de tempos em tempos (cron, agendador do
sistema ou tarefa agendada do servidor); o README explica como agendar.

O que entra: os registros do banco. O que não entra: os PDFs enviados, que ficam
na pasta de mídia e devem ser copiados à parte. As senhas saem só como hash (RNF03).

Para restaurar: `python manage.py loaddata <arquivo>.json`.
"""
from pathlib import Path

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

PREFIXO = "sgtcc-"


class Command(BaseCommand):
    help = "RNF14 — exporta o banco para um arquivo JSON datado e mantém só os mais recentes."

    def add_arguments(self, parser):
        parser.add_argument(
            "--pasta",
            default=str(Path(settings.BASE_DIR) / "exportacoes"),
            help="Pasta de destino (padrão: backend/exportacoes).",
        )
        parser.add_argument(
            "--manter",
            type=int,
            default=14,
            help="Quantas exportações guardar; as mais antigas são apagadas (padrão: 14).",
        )

    def handle(self, *args, **opcoes):
        if opcoes["manter"] < 1:
            raise CommandError("--manter precisa ser pelo menos 1.")

        pasta = Path(opcoes["pasta"])
        pasta.mkdir(parents=True, exist_ok=True)

        arquivo = pasta / f"{PREFIXO}{timezone.localtime():%Y%m%d-%H%M%S}.json"
        with arquivo.open("w", encoding="utf-8") as saida:
            call_command(
                "dumpdata",
                "core",
                indent=2,
                stdout=saida,
                use_natural_foreign_keys=False,
            )
        self.stdout.write(self.style.SUCCESS(f"Exportação gravada em {arquivo}"))

        antigos = sorted(pasta.glob(f"{PREFIXO}*.json"))[: -opcoes["manter"]]
        for velho in antigos:
            velho.unlink()
        if antigos:
            self.stdout.write(f"{len(antigos)} exportação(ões) antiga(s) removida(s).")
