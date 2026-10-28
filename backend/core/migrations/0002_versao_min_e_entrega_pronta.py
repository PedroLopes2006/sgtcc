# Migration da US08: Versão em forma mínima (a US06 a completa), vínculo do
# Evento com a Entrega e o tipo de evento "entrega_pronta".

import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="evento",
            name="tipo",
            field=models.CharField(
                choices=[
                    ("tema_proposto", "Tema proposto"),
                    ("tema_reenviado", "Tema reenviado"),
                    ("tema_aprovado", "Tema aprovado"),
                    ("tema_ajuste_solicitado", "Ajuste de tema solicitado"),
                    ("entrega_criada", "Entrega criada"),
                    ("entrega_pronta", "Entrega sinalizada como pronta"),
                    ("troca_orientador", "Troca de orientador"),
                ],
                max_length=40,
            ),
        ),
        migrations.AddField(
            model_name="evento",
            name="entrega",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="eventos",
                to="core.entrega",
            ),
        ),
        migrations.CreateModel(
            name="Versao",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("numero", models.PositiveIntegerField(verbose_name="número")),
                (
                    "arquivo",
                    models.FileField(blank=True, upload_to="versoes/", verbose_name="arquivo"),
                ),
                ("data_envio", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "entrega",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="versoes",
                        to="core.entrega",
                    ),
                ),
            ],
            options={
                "verbose_name": "versão",
                "verbose_name_plural": "versões",
                "ordering": ["numero"],
            },
        ),
    ]
