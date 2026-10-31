# Migration da US08, ajustada depois do merge com a US06.
#
# Nasceu como "0002_versao_min_e_entrega_pronta", com uma Versão provisória.
# A US06 criou a Versão definitiva na sua própria 0002, então esta migration
# passou a depender dela e ficou só com o que é da US08: o vínculo opcional do
# Evento com a Entrega e o tipo de evento "entrega_pronta".

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0002_entrega_versoes_enviadas_alter_evento_tipo_versao"),
    ]

    operations = [
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
                    ("upload", "Versão enviada"),
                    ("troca_orientador", "Troca de orientador"),
                ],
                max_length=40,
            ),
        ),
    ]
