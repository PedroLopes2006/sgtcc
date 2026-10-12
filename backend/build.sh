#!/usr/bin/env bash
# Executado a cada deploy. O plano gratuito do Render não tem shell, então
# tudo que rodaria à mão no servidor acontece aqui.
set -o errexit

pip install -r requirements.txt
python manage.py collectstatic --no-input
python manage.py migrate

# Conta do /admin, se ADMIN_EMAIL e ADMIN_PASSWORD existirem.
python manage.py criar_admin

# Contas de demonstração. Rode uma vez e apague a variável.
if [ "$SEED_DEMO" = "1" ]; then
  python manage.py seed_demo
fi
