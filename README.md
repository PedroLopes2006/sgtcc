# SGTCC — Sistema de Gestão de TCC

Sprint 3 — Grupo 1 (Turma CC4N)
Frederico Mariani, Pedro Augusto, Felipe Regiani, Carlos Augusto, Paulo Sérgio, Vitor Marçal

## O que está implementado

| US | Descrição | Situação |
|----|-----------|----------|
| US01 | Cadastro e login | Completa (CA1–CA4) |
| US03 | Propor tema e indicar orientador | Completa (CA1–CA4) |
| US04 | Aprovar ou ajustar tema | Completa (CA1–CA3) |
| US05 | Criar entrega | Completa (CA1–CA2) |
| US08 | Sinalizar pronta para revisão | Completa (CA1–CA3) |

Conforme o recorte combinado para o sprint:

- **A US05 cria só a etapa, sem arquivo.** O upload de versões é a US06, feita por outra pessoa do grupo — não há campo de arquivo em `Entrega`. A `Versao` existe aqui só na forma mínima que a US08 consulta (entrega e número, com `related_name="versoes"`); a US06 completa o modelo.
- **As notificações ficam para quando o Telegram entrar.** Os pontos que pedem aviso (US03 CA2 e CA4, US04 CA3, US08 CA3) já gravam um `Evento` no log, que é exatamente o gatilho que o disparo vai consumir depois. Nesta etapa só a mudança de status é implementada.
- **Versão** existe só em forma mínima (veja acima). **Comentário e Notificação** do DER do Sprint 1 ainda não existem no código.
- O `Evento` ganhou o vínculo opcional com a `Entrega`: a sinalização aponta para ela. A US09 usará isso para ordenar a fila pela data em que a entrega ficou pronta.
- **A sinalização fica como botão na lista de entregas** e não há como desfazê-la: depois de "pronto para revisão", a entrega só sai desse estado pela ação do orientador (US10 em diante).

## Relação com o protótipo do Figma

As telas seguem o [protótipo do Sprint 2](https://www.figma.com/design/S2vvHsgShUZoAzaORCW7gb/SGTCC?node-id=2034-66): barra lateral fixa, ação primária preta, e os textos de interface (rótulos, ajudas e estados vazios) copiados de lá.

Duas divergências conscientes:

1. **Sem etapas fixas.** O protótipo mostra "Progresso: 1 de 5 entregas" e uma coluna "Fase atual", sugerindo um roteiro de 5 etapas pré-definidas. A US05 diz que o aluno cria as entregas que quiser, com título livre — e a User Story manda. Aqui o total é quantas entregas existem, e a fase atual é a primeira entrega ainda em andamento.
2. **A avaliação do tema sai da tabela de orientandos**, num modal, como no protótipo — não há fila de temas separada. A "Fila de revisão" desenhada no Figma é de *entregas* (US09) e entra num próximo sprint; por isso o item aparece desativado na barra lateral, junto de Linha do tempo e Perfil.

Telas do protótipo ainda não implementadas, porque pertencem a US fora deste sprint: detalhe da entrega, enviar versão, revisão, linha do tempo e perfil.

## Stack

| Camada | Tecnologia |
|--------|------------|
| Backend | Python 3.12, Django 5.1, Django REST Framework |
| Frontend | React 18, Vite, React Router, Axios |
| Banco | PostgreSQL (local no Docker; Supabase depois) |
| Autenticação | JWT com `djangorestframework-simplejwt` |
| Ambiente | Docker Compose, repositório único |

## Como rodar

### Com Docker (recomendado para a equipe)

```bash
cp .env.example .env
docker compose up --build
```

- API: http://localhost:8000/api
- Front: http://localhost:5173
- Admin: http://localhost:8000/admin

Dados de exemplo (personas do Sprint 2):

```bash
docker compose exec backend python manage.py seed_demo
```
O seed cria, para o Lucas, uma entrega em rascunho sem versão (a sinalização é barrada) e outra com um registro de versão (já pode ser sinalizada). A versão é só um registro, sem arquivo, até a US06. O seed não roda de novo se o Lucas já existir: para recriar os dados, apague o volume (`docker compose down -v`).


| Perfil | E-mail | Senha |
|--------|--------|-------|
| Aluno | lucas@aluno.edu.br | senhaForte123 |
| Aluna | ana@aluno.edu.br | senhaForte123 |
| Orientador | marcos@prof.edu.br | senhaForte123 |

### Sem Docker

Sem `POSTGRES_HOST` definido, o Django cai para SQLite — serve para rodar os testes rápido.

```bash
# backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver

# frontend, em outro terminal
cd frontend
npm install
npm run dev
```

## Publicar (sem Docker)

O Docker serve só para o ambiente local. Em produção são três peças, todas em camada gratuita:

| Camada | Serviço | Limite que importa |
|---|---|---|
| Banco | Supabase | Pausa após 1 semana sem uso; 500 MB; 2 projetos grátis por organização |
| Backend | Render (web service, plano free) | Dorme após 15 min sem tráfego; acordar leva ~1 min |
| Frontend | Vercel, Netlify ou Cloudflare Pages | — |

**Não use o Postgres do Render:** o banco grátis dele expira 30 dias após a criação, com 14 dias de carência antes da exclusão definitiva.

### 1. Banco no Supabase

Crie o projeto e copie a connection string do *session pooler* (porta 5432). Evite o transaction pooler (6543): ele não combina com as conexões persistentes do Django.

### 2. Backend no Render

`render.yaml` na raiz já descreve o serviço — em Blueprints, aponte para o repositório. O build roda `backend/build.sh`, que instala, faz `collectstatic` e aplica as migrations.

Variáveis a preencher no painel:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | connection string do Supabase |
| `CORS_ALLOWED_ORIGINS` | URL do frontend, ex. `https://sgtcc.vercel.app` |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | a mesma URL |
| `ADMIN_EMAIL` e `ADMIN_PASSWORD` | conta do `/admin` |

`DJANGO_SECRET_KEY` o Render gera sozinho e `DJANGO_DEBUG` já vai como `0`.

**O plano gratuito do Render não dá acesso a shell**, então nada pode ser rodado à mão no servidor. Por isso o `build.sh` faz tudo a cada deploy: `collectstatic`, `migrate`, e `criar_admin`, que cria ou atualiza o superusuário a partir de `ADMIN_EMAIL` e `ADMIN_PASSWORD`. Sem essas duas variáveis o comando não faz nada.

Para popular as contas de demonstração, defina `SEED_DEMO=1`, aguarde um deploy e **apague a variável** — senão o seed roda a cada publicação.

### 3. Frontend

Qualquer host estático serve. Configuração:

- Diretório raiz: `frontend`
- Build: `npm run build`
- Saída: `dist`
- Variável: `VITE_API_URL` = URL do backend + `/api`

O roteamento já está resolvido: `vercel.json` para a Vercel, `public/_redirects` para Netlify e Cloudflare Pages. Sem isso, recarregar uma rota interna como `/aluno/entregas` daria 404.

Um detalhe de ordem: o `VITE_API_URL` entra no bundle durante o build, não é lido em tempo de execução. Se trocar a URL do backend depois, refaça o build do frontend.

## Testes

```bash
cd backend && python manage.py test core   # 42 testes
cd frontend && npm test                    # 9 testes
```

No backend, um teste por critério de aceite mais as regras de negócio envolvidas, organizados por US em `backend/core/tests/`. No frontend, testes de fumaça (Vitest + Testing Library) que montam cada tela e conferem os textos do protótipo e as regras visíveis — botão desabilitado sem tema aprovado, justificativa obrigatória no modal.

## Endpoints

| Método | Rota | US | Perfil |
|--------|------|----|--------|
| POST | `/api/auth/registrar/` | US01 CA1, CA2 | público |
| POST | `/api/auth/login/` | US01 CA3, CA4 | público |
| POST | `/api/auth/refresh/` | — | público |
| GET | `/api/auth/eu/` | — | autenticado |
| GET | `/api/orientadores/` | US03 CA1 | autenticado |
| GET | `/api/meu-tcc/` | — | aluno |
| POST | `/api/temas/` | US03 CA1–CA3 | aluno |
| POST | `/api/temas/<id>/reenviar/` | US03 CA4 | aluno |
| GET | `/api/orientandos/` | US04 | orientador |
| POST | `/api/temas/<id>/aprovar/` | US04 CA1 | orientador |
| POST | `/api/temas/<id>/solicitar-ajuste/` | US04 CA2 | orientador |
| GET | `/api/temas/pendentes/` | US04 (não usado pelo front) | orientador |
| GET, POST | `/api/entregas/` | US05 | aluno |
| GET | `/api/eventos/` | base da US16 | aluno |

## Organização do código

```
backend/
  config/            configurações, URLs raiz
  core/
    models.py        Usuario, TCC, Tema, Orientacao, Entrega, Evento
    services.py      regras de negócio — é aqui que mora a lógica das US
    serializers.py   validação de entrada e formato de saída
    views.py         endpoints finos, só orquestram services
    permissions.py   RNF04 — separação aluno / orientador
    tests/           um arquivo por US
frontend/
  src/
    api.js           cliente Axios com JWT
    auth.jsx         contexto de autenticação
    formato.js       datas, iniciais e cores de estado
    components/      Layout (barra lateral), Estado, Modal, RotaProtegida
    pages/           Login, Cadastro
      aluno/         AreaAluno, MeuTCC, ProporTema, Entregas, NovaEntrega
      orientador/    Orientandos (tabela + modal de avaliação)
    __tests__/       testes de fumaça das telas
```

As regras de negócio ficam em `services.py`, fora das views. Isso mantém a API fina e permite testar os critérios de aceite sem passar por HTTP — vale manter esse padrão nos próximos sprints.

## Regras de negócio cobertas

| Regra | Onde |
|-------|------|
| RN01 — um TCC por aluno | `TCC.aluno` é `OneToOneField` + checagem em `propor_tema` |
| RN02 — entrega exige tema aprovado | `criar_entrega` |
| RN05 — só o orientador ativo decide | `_exigir_orientador_ativo` |
| RN07 — ajuste exige justificativa | `solicitar_ajuste_tema` |
| RN09 — uma orientação ativa por TCC | constraint parcial no banco |
| RN10 — toda mudança gera evento | `registrar_evento` |
| RN15 — orientação ativa desde a proposta | `propor_tema` |
| RNF03 — senha com hash | `UsuarioManager.set_password` |
| RNF04 — acesso por perfil | `core/permissions.py` |

## Próximos passos

1. **US06 e US07** — upload de versões no Supabase Storage (PDF, com limite de tamanho) e histórico.
2. **US08 a US13** — máquina de estados completa da entrega (RN06) e fluxo de revisão.
3. **US02 e RF16** — bot do Telegram consumindo os `Evento` já gravados.
4. **US14 a US16** — painel com prazos vencidos destacados, reatribuição de orientador e timeline.
