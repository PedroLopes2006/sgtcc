# SGTCC — Sistema de Gestão de TCC

Grupo 1 (Turma CC4N)
Frederico Mariani, Pedro Augusto, Felipe Regiani, Carlos Augusto, Paulo Sérgio, Vitor Marçal

## O que está implementado

| US | Descrição | Situação |
|----|-----------|----------|
| US01 | Cadastro e login | Completa (CA1–CA4) |
| US03 | Propor tema e indicar orientador | Completa (CA1–CA4) |
| US04 | Aprovar ou ajustar tema | Completa (CA1–CA3) |
| US05 | Criar entrega | Completa (CA1–CA2) |
| US06 | Upload de versão | Completa (CA1–CA4) |
| US07 | Histórico de versões | Completa (CA1–CA2) |
| US08 | Sinalizar pronta para revisão | Completa (CA1–CA3) |
| US09 | Fila de revisão | Completa (CA1–CA2) |
| US10 | Marcar em revisão | Completa (CA1–CA2) |
| US11 | Solicitar correção | Completa (CA1–CA3) |
| US12 | Aprovar/concluir entrega | Completa (CA1–CA2; aviso via Evento) |
| US13 | Enviar à banca | Completa (CA1) |
| US14 | Painel do orientador | Completa (CA1–CA2) |
| US15 | Reatribuir orientador e herdar histórico | Completa (CA1–CA3) |
| US16 | Timeline do aluno | Completa (CA1) |

Conforme o recorte combinado para o sprint:

- **A US05 cria só a etapa, sem arquivo.** O arquivo entra pela US06, que anexa as `Versao` à entrega.
- **As notificações ficam para quando o Telegram entrar.** Os pontos que pedem aviso (US03 CA2 e CA4, US04 CA3, US08 CA3, US10 CA1, US11 CA3) já gravam um `Evento` no log, que é exatamente o gatilho que o disparo vai consumir depois. Nesta etapa só a mudança de status é implementada.
- **Notificação** do DER do Sprint 1 ainda não existe no código. O **Comentário** entrou com a US11.
- O `Evento` ganhou o vínculo opcional com a `Entrega`: a sinalização, a abertura da revisão e a correção apontam para ela. A US09 usa isso para ordenar a fila pela data em que a entrega ficou pronta.
- **A sinalização fica como botão na lista de entregas** e não há como desfazê-la: depois de "pronto para revisão", a entrega só sai desse estado pela ação do orientador.
- **A US10 e a US11 ficam como botões na tabela de orientandos.** "Iniciar revisão" aparece na linha cuja entrega está pronta para revisão, e "Solicitar correção" na que está em revisão, abrindo um modal com o comentário obrigatório. A API diz qual entrega espera o orientador (`entrega_para_revisao`).
- **O orientador revisa as entregas em ordem (RN06).** Só a primeira entrega ainda pendente do aluno (que não está "concluída" nem "enviada à banca") pode ser aberta e receber pedido de correção, e ela é a mesma "fase atual" da linha. A seguinte só chega à vez quando a anterior for concluída; até lá o backend recusa a ação (400) e a tela não mostra o botão. A US12 conclui a entrega em revisão e libera a seguinte.
- **O orientador abre o PDF da versão atual** pelo link "Abrir versão N", na linha da entrega que espera revisão e no modal de "Solicitar correção". Entrega sem versão não mostra o link. Ver a nota em [Endpoints](#endpoints).
- **A fila de revisão (US09) tem tela própria** (`/orientador/fila`), com o item habilitado na barra lateral e o contador de pendências. Ela lista as entregas prontas para revisão dos orientandos ativos, por ordem de chegada (a data do último `Evento` de sinalização; depois de uma correção, a entrega sinalizada de novo volta para o fim). Só entra a primeira entrega pendente de cada aluno, então o "Iniciar revisão" da fila nunca bate na regra de ordem. A prioridade alta, média e baixa do protótipo ficou de fora, porque pede um campo novo no banco. O menu do orientador passou para `LayoutOrientador`, usado pelas duas telas.
- **O painel do orientador (US14) é a tabela de Orientandos.** Cada linha traz tema, fase atual e prazo dos orientandos com Orientação ativa. O prazo vencido aparece com a data em vermelho e um ponto vermelho ao lado, como no protótipo. Esse ponto é separado do ponto do estado, que mantém a cor do estado. O prazo mostrado é o da fase atual, e uma entrega concluída não conta como atraso.
- **O comentário da correção** fica gravado ligado à entrega e à versão avaliada (RF10), nunca é editado nem removido (RN14), e o aluno o lê na lista de entregas enquanto a entrega estiver em "correção solicitada".
- **O orientador pode acrescentar comentários (RF10), mas não editar o anterior (RN14).** Com a entrega "em revisão" ou com "correção solicitada", o botão **"Adicionar comentário"** da tabela de orientandos registra um comentário a mais, sem mudar o estado, para complementar ou corrigir o que já escreveu. O modal mostra os comentários anteriores só para leitura, o texto é obrigatório (RN07), vale só para a primeira entrega pendente (RN06) e o aluno é avisado por um `Evento` (RF16, RF18). O aluno lê, na entrega, todos os comentários da versão em correção.

## O que cada US aplica

Resumo do que cada US entrega e de quais requisitos da especificação (RF, RN e RNF do Sprint 1) ela aplica.

| US | O que faz | RF | RN | RNF |
|----|-----------|----|----|-----|
| US01 | Cadastro e login com perfil de aluno ou orientador; erro genérico para credenciais inválidas | RF01 | — | RNF03, RNF04 |
| US03 | O aluno propõe o tema e indica o orientador: nascem o TCC, o Tema "proposto" e a Orientação ativa; reenvia o tema após um ajuste | RF03 | RN01, RN10, RN15 | RNF04 |
| US04 | O orientador aprova o tema ou pede ajuste, com justificativa obrigatória | RF04 | RN05, RN07, RN10 | RNF04 |
| US05 | O aluno cria uma entrega (título e prazo) em "rascunho", só com o tema aprovado | RF05 | RN02 | RNF04 |
| US06 | O aluno envia uma versão em PDF, com número incremental; depois de uma correção, a entrega volta a "rascunho" | RF06 | RN03, RN10, RN13 | RNF04 |
| US07 | O aluno consulta todas as versões de cada entrega, da mais nova para a mais antiga como no protótipo (a API devolve em ordem cronológica), com a atual marcada, e abre qualquer arquivo enviado | RF07 | — | RNF04 |
| US08 | O aluno sinaliza a entrega como "pronta para revisão" (exige ao menos uma versão) e o orientador é avisado | RF08 | RN04, RN10 | RNF04 |
| US10 | O orientador abre a primeira entrega pendente, se estiver "pronta para revisão", e ela passa a "em revisão"; o aluno é avisado; em qualquer outro estado, ou em outra entrega, a ação é recusada | RF16\*, RF17, RF18 | RN05, RN06, RN10 | RNF04, RNF12 |
| US11 | Com a primeira entrega pendente "em revisão", o orientador registra um comentário obrigatório e pede correção: ela passa a "correção solicitada", o aluno é avisado e lê o comentário; o comentário fica ligado à versão avaliada; o orientador pode acrescentar novos comentários, sem editar os anteriores | RF10, RF11 (parte), RF16\*, RF17, RF18 | RN05, RN06, RN07, RN10, RN14 | RNF04, RNF12 |
| US09 | O orientador vê a fila das entregas prontas para revisão dos orientandos ativos, por ordem de chegada (só a primeira pendente de cada aluno), e inicia a revisão dali; sem pendência, vê a mensagem de fila vazia | RF09 | RN05, RN06 | RNF02, RNF04 |
| US12 | Conclui a primeira entrega pendente em revisão, grava a data e o aviso e libera a próxima etapa | RF11, RF16\*, RF17, RF18 | RN05, RN06, RN10 | RNF04, RNF12 |
| US13 | Envia uma entrega concluída à banca, com registro do encerramento formal; a tela a encontra por `entrega_para_banca` | RF12 | RN12, RN06, RN10, RN05 | RNF04 |
| US14 | O orientador vê no painel todos os orientandos ativos, com tema, fase atual e prazo; o prazo vencido é destacado com a data em vermelho e um ponto vermelho próprio | RF13 | RN05 | RNF02, RNF04 |
| US15 | O orientador atual indica outro; encerra o vínculo anterior e cria o novo em transação, preservando tema, entregas, versões, comentários e eventos | RF14 | RN08, RN09, RN15, RN10, RN05 | RNF04 |
| US16 | O aluno consulta a timeline dos eventos registrados no seu TCC, do mais novo para o mais antigo como no protótipo (a API devolve em ordem cronológica) | RF15 | RN10 | RNF04, RNF12 |

\* RF16: nesta etapa só o gatilho, o `Evento` gravado no log. O envio pelo Telegram é a US02.

### Requisitos atendidos no projeto

| Tipo | Atendidos | Parciais |
|------|-----------|----------|
| RF | 01, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 17, 18 | 16 (grava o `Evento`, sem envio) |
| RNF | 03, 04, 05, 06, 09, 12, 13 | — |
| RN | 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 12, 13, 14, 15 | — |

No código, cada função de `services.py` cita no docstring o CA e as regras que aplica, e os testes citam a regra que cada um confere.

### Extras do protótipo (fora dos requisitos do documento)

Duas funcionalidades vêm **só do protótipo do Figma**. **Elas não fazem parte dos requisitos da especificação do Sprint 1**: não há US, RF, RN nem RNF para elas. Foram feitas como complemento e estão marcadas como `EXTRA` no código, nos docstrings e nos nomes dos testes.

| Extra | O que faz |
|-------|-----------|
| Tela de Revisão do orientador | Reúne numa tela só (`/orientador/entregas/<id>`) o que as US07, US10, US11, US12 e US13 já fazem: ver as versões e os comentários da entrega, iniciar a revisão, pedir correção, acrescentar comentário, aprovar e enviar à banca. Quem diz o que pode ser feito agora é a API (`acoes`), com as mesmas regras dos services (RN06). Na Fila, o "Iniciar revisão" leva a ela; na tabela de orientandos, o link "Abrir revisão" também. |
| Prioridade na fila de revisão | Na Fila de revisão (US09), o orientador marca cada entrega como alta, média, baixa ou sem prioridade. A marcação é só dele (por orientador e por entrega), o aluno nunca a vê, ela não muda a ordem de chegada e não gera evento. |

## Relação com o protótipo do Figma

As telas seguem o [protótipo do Sprint 2](https://www.figma.com/design/S2vvHsgShUZoAzaORCW7gb/SGTCC?node-id=2034-66): barra lateral fixa, ação primária preta, e os textos de interface (rótulos, ajudas e estados vazios) copiados de lá.

Três divergências conscientes:

1. **Sem etapas fixas.** O protótipo mostra "Progresso: 1 de 5 entregas" e uma coluna "Fase atual", sugerindo um roteiro de 5 etapas pré-definidas. A US05 diz que o aluno cria as entregas que quiser, com título livre — e a User Story manda. Aqui o total é quantas entregas existem, e a fase atual é a primeira entrega ainda em andamento.
2. **A avaliação do tema sai da tabela de orientandos**, num modal, como no protótipo — não há fila de temas separada. A "Fila de revisão" desenhada no Figma é de *entregas* (US09) e tem tela própria; só o Perfil ainda aparece desativado na barra lateral.
3. **A revisão acontece na tabela de orientandos, e a tela de Revisão do protótipo é um extra.** No Figma, "Iniciar revisão" fica na Fila de revisão e na tela de Revisão da entrega (versões, comentários, "Novo comentário", "Solicitar correção" e "Aprovar entrega"). Os botões e modais da tabela de orientandos são o que cumpre as US10 a US13. A tela de Revisão foi feita depois, como complemento fora dos requisitos (veja *Extras do protótipo*), e a tabela manteve os atalhos. Os textos seguem o protótipo ("Novo comentário", "Descreva o que precisa ser ajustado", "Escreva um comentário para solicitar correção.", "Seu orientador pediu correção").

Telas do protótipo ainda não implementadas, porque pertencem a US fora deste sprint: perfil.

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
O seed cria, para o Lucas, uma entrega em rascunho sem versão (a sinalização é barrada) e outra com um registro de versão (já pode ser sinalizada). A versão é só um registro, sem arquivo no disco. O seed não roda de novo se o Lucas já existir: para recriar os dados, apague o volume (`docker compose down -v`).


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
| `AWS_STORAGE_BUCKET_NAME` | nome do bucket no Supabase Storage, ex. `versoes` |
| `AWS_S3_ENDPOINT_URL` | `https://<project-ref>.supabase.co/storage/v1/s3` |
| `AWS_S3_REGION_NAME` | a região do projeto, ex. `sa-east-1` |
| `AWS_ACCESS_KEY_ID` e `AWS_SECRET_ACCESS_KEY` | Supabase > Settings > API > Storage > S3 Access Keys |

As cinco últimas são da US06. O disco do Render é apagado a cada deploy, então os PDFs precisam ir para o Supabase Storage; sem elas o Django grava em `backend/media`, o que só serve para rodar local.

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
cd backend && python manage.py test core   # 230 testes
cd frontend && npm test                    # 81 testes
```

No backend, um teste por critério de aceite mais as regras de negócio envolvidas, organizados por US em `backend/core/tests/`. O `test_fluxo_revisao.py` percorre a entrega inteira pela API (US06, US08, US10 e US11), de rascunho até a correção e de volta. No frontend, testes de fumaça (Vitest + Testing Library) que montam cada tela e conferem os textos do protótipo e as regras visíveis — botão desabilitado sem tema aprovado, justificativa obrigatória no modal.

A US15 recebe `{"novo_orientador": <id>}` na reatribuição. Apenas o orientador ativo inicia a troca. O antigo perde acesso à lista e ao histórico; o novo consulta todas as versões e comentários, além dos eventos e vínculos anteriores. O histórico é uma página simples; o detalhe do Figma fica para a integração final. A US12 registra o aviso no `Evento`, seguindo o contrato atual da US02 (Telegram pendente).

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
| GET | `/api/orientandos/` | US04, US14 CA1–CA2; acesso ao arquivo (US10–US12, implícito) | orientador |
| POST | `/api/temas/<id>/aprovar/` | US04 CA1 | orientador |
| POST | `/api/temas/<id>/solicitar-ajuste/` | US04 CA2 | orientador |
| GET | `/api/temas/pendentes/` | US04 (não usado pelo front) | orientador |
| GET, POST | `/api/entregas/` | US05 | aluno |
| GET, POST | `/api/entregas/<id>/versoes/` | US07 CA1–CA2; US06 CA1–CA4 | aluno (dono da entrega) |
| POST | `/api/entregas/<id>/sinalizar-pronta/` | US08 CA1–CA3 | aluno |
| GET | `/api/fila-revisao/` | US09 CA1, CA2 | orientador |
| GET | `/api/entregas/<id>/revisao/` | **EXTRA** (protótipo, fora dos requisitos): tela de Revisão | orientador ativo |
| PUT | `/api/entregas/<id>/prioridade/` | **EXTRA** (protótipo, fora dos requisitos): prioridade na fila | orientador ativo |
| POST | `/api/entregas/<id>/iniciar-revisao/` | US10 CA1, CA2 | orientador |
| POST | `/api/entregas/<id>/solicitar-correcao/` | US11 CA1–CA3 | orientador |
| POST | `/api/entregas/<id>/comentarios/` | US11 / RF10 (comentário adicional) | orientador |
| POST | `/api/entregas/<id>/aprovar/` | US12 CA1–CA2 | orientador ativo |
| POST | `/api/entregas/<id>/enviar-a-banca/` | US13 CA1 | orientador ativo |
| POST | `/api/orientandos/<tcc_id>/reatribuir/` | US15 CA1, CA3 | orientador ativo |
| GET | `/api/orientandos/<tcc_id>/historico/` | US15 CA2 | orientador ativo |
| GET | `/api/eventos/` | US16 CA1 | aluno |

**Acesso do orientador ao arquivo.** Não há rota própria: cada entrega em `GET /api/orientandos/` traz `versao_atual.arquivo_url`, o link do PDF da versão atual. Como a rota só lista os TCCs com Orientação ativa do orientador logado (RN05), o link só chega a ele; depois de uma troca de orientador, só o novo o recebe. Em produção é uma URL assinada do Supabase Storage, válida por 1 hora (recarregar a tela gera outra). Em desenvolvimento, com os arquivos em disco, a URL aponta para o `/media/` do runserver, servido só com `DJANGO_DEBUG=1` e sem conferir quem pede.

> Nenhum critério de aceite das US diz que o orientador abre o documento enviado: a US07 CA2 fala em baixar o arquivo, mas o ator é o aluno, e as US09 a US12 descrevem a revisão sem falar do acesso ao arquivo. Tratamos o acesso como implícito na revisão (US10 a US12) — não dá para comentar nem pedir correção sem ler a entrega.

## Organização do código

```
backend/
  config/            configurações, URLs raiz
  core/
    models.py        Usuario, TCC, Tema, Orientacao, Entrega, Versao, Comentario, Evento, PrioridadeRevisao (extra)
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
    components/      Layout (barra lateral), LayoutOrientador (menu do orientador), Estado, Modal, RotaProtegida, EnviarVersao, LinkVersao
    pages/           Login, Cadastro
      aluno/         AreaAluno, MeuTCC, ProporTema, Entregas, NovaEntrega
      orientador/    Orientandos (tabela + modais de avaliação de tema e de correção), FilaRevisao (US09), RevisaoEntrega (extra)
    __tests__/       testes de fumaça das telas
```
As regras de negócio ficam em `services.py`, fora das views. Isso mantém a API fina e permite testar os critérios de aceite sem passar por HTTP — vale manter esse padrão nos próximos sprints.

## Regras de negócio cobertas
| Regra | Onde |
|-------|------|
| RN01 — um TCC por aluno | `TCC.aluno` é `OneToOneField` + checagem em `propor_tema` |
| RN02 — entrega exige tema aprovado | `criar_entrega` |
| RN03 — estados em que a entrega aceita versão | `Entrega.aceita_versao`, `enviar_versao` |
| RN04 — sinalizar exige ao menos uma versão | `sinalizar_pronta`, `Entrega.pode_ser_sinalizada` |
| RN05 — só o orientador ativo decide | `_exigir_orientador_ativo`; a fila (`fila_de_revisao`) e o painel só listam os TCCs com Orientação ativa |
| RN06 — transições de estado da entrega, passo a passo, e revisão em ordem | `sinalizar_pronta`, `iniciar_revisao_entrega`, `solicitar_correcao_entrega` e `_exigir_primeira_entrega_pendente`, `aprovar_entrega` e `enviar_a_banca_entrega` |
| RN07 — ajuste e correção exigem texto | `solicitar_ajuste_tema`, `solicitar_correcao_entrega` |
| RN08 — reatribuição preserva histórico | `reatribuir_orientador`, `consultar_historico` |
| RN09 — uma orientação ativa por TCC | constraint parcial no banco |
| RN10 — toda mudança gera evento | `registrar_evento` |
| RN12 — envio à banca só após conclusão | `enviar_a_banca_entrega` |
| RN13 — número de versão nunca reutilizado | contador `Entrega.versoes_enviadas` + constraint no banco |
| RN14 — comentário nunca é editado nem removido | `Comentario` só é criado em `solicitar_correcao_entrega` e `adicionar_comentario_entrega`; a API não tem rota para alterá-lo nem removê-lo, e o ajuste vira um comentário novo |
| RN15 — orientação ativa desde a proposta | `propor_tema` |
| RNF03 — senha com hash | `UsuarioManager.set_password` |
| RNF04 — acesso por perfil | `core/permissions.py` |
| RNF12 — histórico de eventos imutável | `Evento` só é criado em `registrar_evento`; a API não tem rota para alterá-lo nem apagá-lo |

