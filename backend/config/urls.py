from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("core.urls")),
]

# Só em desenvolvimento, quando as versões ficam em disco: sem isto o link do
# arquivo dá 404. Aqui o /media/ não confere quem pede; em produção o arquivo
# fica no Supabase e só sai por URL assinada, entregue a quem a API autoriza.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
