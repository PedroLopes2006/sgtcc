"""
Cria o superusuário a partir de variáveis de ambiente.

Existe porque o plano gratuito do Render não dá acesso a shell: sem isto não
haveria como rodar `createsuperuser` no servidor. O `build.sh` chama este
comando a cada deploy.

É seguro rodar sempre: sem as variáveis não faz nada, e com elas é idempotente
— se a conta já existe, apenas garante a senha e as permissões.
"""
import os

from django.core.management.base import BaseCommand

from core.models import Perfil, Usuario


class Command(BaseCommand):
    help = "Cria ou atualiza o superusuário a partir de ADMIN_EMAIL e ADMIN_PASSWORD."

    def handle(self, *args, **opcoes):
        email = (os.environ.get("ADMIN_EMAIL") or "").strip().lower()
        senha = os.environ.get("ADMIN_PASSWORD") or ""
        nome = os.environ.get("ADMIN_NOME") or "Administrador"

        if not email or not senha:
            self.stdout.write("ADMIN_EMAIL/ADMIN_PASSWORD não definidos; nada a fazer.")
            return

        usuario = Usuario.objects.filter(email=email).first()

        if usuario is None:
            Usuario.objects.create_superuser(
                email=email, nome=nome, senha=senha, perfil=Perfil.ORIENTADOR
            )
            self.stdout.write(self.style.SUCCESS(f"Superusuário criado: {email}"))
            return

        usuario.set_password(senha)
        usuario.is_staff = True
        usuario.is_superuser = True
        usuario.is_active = True
        usuario.save(update_fields=["password", "is_staff", "is_superuser", "is_active"])
        self.stdout.write(self.style.SUCCESS(f"Superusuário atualizado: {email}"))
