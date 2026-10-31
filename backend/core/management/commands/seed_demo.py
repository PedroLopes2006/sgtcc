"""
Popula o banco com as duas personas do Sprint 2, para demonstração e testes
manuais. Não use em produção.

    python manage.py seed_demo
"""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from core.models import Orientacao, Perfil, StatusTema, TCC, Tema, Usuario, Versao
from core.services import criar_entrega


class Command(BaseCommand):
    help = "Cria usuários e um TCC de exemplo (personas Lucas e Marcos)."

    def handle(self, *args, **opcoes):
        if Usuario.objects.filter(email="lucas@aluno.edu.br").exists():
            self.stdout.write(self.style.WARNING("Dados de exemplo já existem. Nada a fazer."))
            return

        aluno = Usuario.objects.create_user(
            email="lucas@aluno.edu.br", nome="Lucas Andrade",
            senha="senhaForte123", perfil=Perfil.ALUNO,
        )
        orientador = Usuario.objects.create_user(
            email="marcos@prof.edu.br", nome="Marcos Ribeiro",
            senha="senhaForte123", perfil=Perfil.ORIENTADOR,
        )
        Usuario.objects.create_user(
            email="paula@prof.edu.br", nome="Paula Nogueira",
            senha="senhaForte123", perfil=Perfil.ORIENTADOR,
        )
        ana = Usuario.objects.create_user(
            email="ana@aluno.edu.br", nome="Ana Beatriz",
            senha="senhaForte123", perfil=Perfil.ALUNO,
        )

        # Lucas: tema aprovado e uma entrega criada.
        tcc = TCC.objects.create(aluno=aluno)
        Tema.objects.create(
            tcc=tcc,
            titulo="Sistema de Gestão de TCC",
            descricao="Aplicação web para acompanhar etapas, versões e revisões de TCC.",
            status=StatusTema.APROVADO,
            data_aprovacao=timezone.now(),
        )
        Orientacao.objects.create(tcc=tcc, orientador=orientador)
        # Rascunho sem versão: sinalizar pronta é barrado (US08 CA2).
        criar_entrega(
            aluno=aluno,
            titulo="Capítulo 1 — Introdução",
            prazo=timezone.localdate() + timedelta(days=21),
        )

        # Rascunho com uma versão: já pode ser sinalizado como pronto (US08 CA1).
        # A versão é só um registro, sem arquivo; o envio de verdade é a US06.
        referencial = criar_entrega(
            aluno=aluno,
            titulo="Capítulo 2 — Referencial teórico",
            prazo=timezone.localdate() + timedelta(days=35),
        )
        Versao.objects.create(entrega=referencial, numero=1)

        # Ana: tema proposto, esperando parecer do Marcos — alimenta a fila da US04.
        tcc_ana = TCC.objects.create(aluno=ana)
        Tema.objects.create(
            tcc=tcc_ana,
            titulo="Acessibilidade em aplicações web acadêmicas",
            descricao="Estudo de conformidade com WCAG em sistemas universitários.",
            status=StatusTema.PROPOSTO,
        )
        Orientacao.objects.create(tcc=tcc_ana, orientador=orientador)

        self.stdout.write(self.style.SUCCESS("Dados de exemplo criados."))
        self.stdout.write("  Aluno:      lucas@aluno.edu.br / senhaForte123")
        self.stdout.write("  Aluna:      ana@aluno.edu.br / senhaForte123")
        self.stdout.write("  Orientador: marcos@prof.edu.br / senhaForte123")
