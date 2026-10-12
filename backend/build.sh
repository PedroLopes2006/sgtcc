#!/usr/bin/env bash
# Executado pelo host a cada deploy do backend.
set -o errexit

pip install -r requirements.txt
python manage.py collectstatic --no-input
python manage.py migrate
