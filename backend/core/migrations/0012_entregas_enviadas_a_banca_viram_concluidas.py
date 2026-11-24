"""
Entregas que ficaram "enviadas à banca" passam a "concluídas".

O envio à banca deixou de existir por entrega: a entrega termina em "concluída" (aprovada) e só
o trabalho final vai à banca (US20, RN12). Esta migração acerta os dados gravados antes dessa
mudança. Os eventos antigos (RN10, RNF12) não são tocados, então o histórico continua igual.
Não há como saber, depois, quais entregas estavam enviadas à banca, por isso a volta não faz nada.
"""
from django.db import migrations


def enviadas_a_banca_viram_concluidas(apps, schema_editor):
    Entrega = apps.get_model("core", "Entrega")
    Entrega.objects.filter(estado="enviada_a_banca").update(estado="concluida")


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0011_trabalho_final"),
    ]

    operations = [
        migrations.RunPython(enviadas_a_banca_viram_concluidas, migrations.RunPython.noop),
    ]
