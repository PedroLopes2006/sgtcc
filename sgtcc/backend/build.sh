#!/usr/bin/env bash
# Executado pelo host a cada deploy do backend.
#
# O plano gratuito do Render não dá acesso a shell, então tudo que precisaria
# ser rodado "na mão" no servidor acontece aqui. Os dois últimos comandos são
# controlados por variáveis de ambiente e não fazem nada sem elas.
set -o errexit

pip install -r requirements.txt
python manage.py collectstatic --no-input
python manage.py migrate

# Cria o administrador do /admin, se ADMIN_EMAIL e ADMIN_PASSWORD existirem.
python manage.py criar_admin

# Popula as contas de demonstração, se SEED_DEMO=1. Rode uma vez e depois
# apague a variável, para não recriar os dados a cada deploy.
if [ "$SEED_DEMO" = "1" ]; then
  python manage.py seed_demo
fi
