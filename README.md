# SGTCC — Sistema de Gestão de TCC

Grupo 1 (Turma CC4N)
Frederico Mariani, Pedro Augusto, Felipe Regiani, Carlos Augusto, Paulo Sérgio, Vitor Marçal

## O que está implementado

| US | Descrição | Situação |
|----|-----------|----------|
| US01 | Cadastro e login | Completa (CA1–CA4) |
| US02 | Vincular Telegram | Completa (CA1–CA3) |
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
- **As notificações saem do `Evento`.** Os pontos que pedem aviso (US03 CA2 e CA4, US04 CA3, US08 CA3, US10 CA1, US11 CA3, US12) gravam um `Evento` no log, e cada `Evento` gera a `Notificacao` de quem precisa saber dele, enviada pelo Telegram (US02).
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
| US02 | O usuário cola o código do chat (chat_id) no Perfil e recebe uma mensagem de teste; cada `Evento` gera uma `Notificacao` por destinatário, enviada pelo bot a quem tem Telegram e só registrada para quem não tem; uma falha no envio fica anotada e não trava a ação | RF02, RF16 | RN10, RN11 | RNF04, RNF05, RNF11 |
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

\* RF16: a US grava o `Evento`; o envio pelo Telegram é feito pela US02 a partir dele.

### Requisitos atendidos no projeto

| Tipo | Atendidos | Parciais |
|------|-----------|----------|
| RF | 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16, 17, 18 | — |
| RNF | 01 (medido em teste, veja abaixo), 03, 04, 05, 06, 09, 11, 12, 13, 14 (exportação, veja abaixo) | — |
| RN | 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15 | — |

No código, cada função de `services.py` cita no docstring o CA e as regras que aplica, e os testes citam a regra que cada um confere.

Com a US02, todos os RF, RN e RNF estão cobertos por código e por teste, com duas ressalvas que dependem do ambiente final:

- **RNF01 (3 segundos):** `test_rnf01_desempenho.py` mede login, upload de um PDF de 1 MB e cada mudança de estado da entrega na API, e todos ficam bem abaixo do limite. Esse teste não inclui a hospedagem: no plano gratuito do Render, a primeira chamada depois de o serviço dormir leva cerca de 1 minuto.
- **RNF08 (Chrome, Firefox e Edge):** o código usa só recursos comuns do navegador e não precisa de aplicativo, mas ainda não foi aberto nos três. Conferir à mão antes da apresentação.

O RNF11 (falha de aviso não travar a ação) é garantido na US02: o registro das notificações roda num savepoint próprio e o envio ao Telegram só acontece depois que a ação foi gravada (`on_commit`), dentro de um `try/except`. Uma falha (token ausente, rede, chat errado) vira `status_envio = falhou` com o motivo em `erro`, visível no `/admin`, e a ação continua valendo. A aba de Avisos segue mostrando tudo dentro do sistema, com ou sem Telegram.

### Exportação periódica dos dados (RNF14)

O comando `exportar_dados` grava todo o conteúdo do banco (usuários, TCCs, temas, entregas, versões, comentários e eventos) num JSON datado e apaga as exportações mais antigas. As senhas saem só como hash (RNF03).

```bash
docker compose exec backend python manage.py exportar_dados                  # grava em backend/exportacoes/
docker compose exec backend python manage.py exportar_dados --manter 30      # guarda as 30 últimas (padrão: 14)
docker compose exec backend python manage.py exportar_dados --pasta /caminho # outra pasta
```

Para a exportação ser **periódica**, é só agendar o comando: no Linux, uma linha no `cron` (por exemplo, todo dia às 3h: `0 3 * * * cd /app && python manage.py exportar_dados`); no Windows, o Agendador de Tarefas chamando o mesmo comando. Como o plano gratuito do Render não tem shell nem agendador, em produção a exportação se faz do computador da equipe, com `DATABASE_URL` apontando para o banco, ou pelo painel do Supabase. A pasta `backend/exportacoes/` fica fora do Git, porque tem dados das pessoas. Os PDFs enviados não entram no arquivo: ficam no Supabase Storage (ou em `backend/media`, local) e devem ser copiados à parte. Para restaurar: `python manage.py loaddata <arquivo>.json`.

### Extras do protótipo (fora dos requisitos do documento)

Estas funcionalidades **não fazem parte dos requisitos da especificação do Sprint 1**: não há US, RF, RN nem RNF para elas. As duas primeiras vêm do protótipo do Figma; as outras foram acrescentadas como melhoria. Todas estão marcadas como `EXTRA` no código, nos docstrings e nos nomes dos testes.

| Extra | O que faz |
|-------|-----------|
| Tela de Revisão do orientador | Reúne numa tela só (`/orientador/entregas/<id>`) o que as US07, US10, US11, US12 e US13 já fazem: ver as versões e os comentários da entrega, iniciar a revisão, pedir correção, acrescentar comentário, aprovar e enviar à banca. Quem diz o que pode ser feito agora é a API (`acoes`), com as mesmas regras dos services (RN06). Na Fila, o "Iniciar revisão" leva a ela; na tabela de orientandos, o link "Abrir revisão" também. |
| Prioridade na fila de revisão | Na Fila de revisão (US09), o orientador marca cada entrega como alta, média, baixa ou sem prioridade. A marcação é só dele (por orientador e por entrega), o aluno nunca a vê, ela não muda a ordem de chegada e não gera evento. |
| Aba de Avisos | Item "Avisos" na barra lateral, com o contador do que ainda não foi visto. Mostra o que o RF16 pede que seja avisado, lendo os mesmos `Evento` do log (RN10, RF18) que o Telegram (US02) também usa: o aluno vê o que o orientador fez (tema aprovado ou com ajuste, revisão iniciada, correção, comentário, conclusão, banca, troca de orientador); o orientador vê o que depende dele (tema proposto ou reenviado, entrega pronta, orientando recebido por troca). Quem fez a ação não recebe aviso dela, e o orientador novo não recebe como novo o que aconteceu antes de assumir (RN08). Ao abrir a aba, tudo vira "visto" (só se guarda até quando a pessoa viu). Cada aviso leva à tela certa. |
| Perfil editável | Na tela de Perfil, o usuário troca o próprio nome, o e-mail e a senha. A troca de senha pede a senha atual, exige 8 caracteres e passa pelas mesmas regras do cadastro. A troca de e-mail também pede a senha atual (é o e-mail que a pessoa usa para entrar), grava em minúsculas, recusa um e-mail de outra conta (US01 CA2) e a partir daí o login passa a usar o novo. Errar a senha atual em qualquer das duas trocas conta no mesmo limite de tentativas do login, para não dar para adivinhar a senha por essas rotas. O perfil (aluno ou orientador) não muda, nem nada do TCC (RNF04). |
| Limite de tentativas de login | Depois de 8 senhas erradas seguidas para o mesmo e-mail, o login desse e-mail fica bloqueado por 15 minutos (resposta 429), mesmo com a senha certa. Vale para qualquer e-mail digitado, exista a conta ou não, então não revela quais contas existem (US01 CA4). Um login certo zera a contagem. |
| Atalhos e caminho do TCC | No Meu TCC (com o tema aprovado), um cartão de atalhos leva direto à ação certa: "Enviar versão" (abre o envio da primeira entrega que aceita versão), "Ver correção pedida" (só quando há uma) e "Nova entrega". Abaixo, o "Caminho do TCC" mostra o tema aprovado e as entregas por prazo numa trilha horizontal, cada parada com o estado, o prazo e a contagem regressiva. As regras são as de sempre (RN02, RN03); a tela só lê o que a API já diz. |
| Contagem regressiva dos prazos | Na lista de Entregas e no caminho do TCC, o prazo mostra "faltam 3 dias", "vence hoje" ou "vencido há 2 dias", com o tom mais forte conforme aperta (cinza, âmbar, vermelho). Entrega concluída ou enviada à banca não mostra nada. |
| Ordenar e agrupar Entregas | O aluno escolhe a ordem (criação, prazo mais próximo ou mais distante, título, estado do fluxo) e o agrupamento (nenhum, em andamento e encerradas, estado ou faixa de prazo). A escolha fica guardada no navegador. Só muda a apresentação: a API continua mandando no que cada entrega pode fazer (RN06). |
| Aviso de conclusão | Um aviso discreto no canto quando uma entrega é concluída ou enviada à banca. O orientador o vê ao aprovar ou enviar à banca; o aluno, na primeira vez que abre o sistema depois da mudança (o navegador guarda o último estado visto). O fato continua registrado no log (RN10) e na aba de Avisos. |
| Visão geral do orientador | Aba "Visão geral" no menu do orientador, a primeira. Reúne o que pede atenção: entregas para revisar e em revisão, temas a avaliar, prazos vencidos, entregas prontas para a banca e a distribuição dos orientandos por estado. Usa só `GET /api/orientandos/` (US14, RN05), e cada item leva à tela onde a ação acontece. |
| Coluna lateral e resumo por estado | Em telas largas, uma coluna à direita mostra os próximos prazos e os avisos recentes (aluno) ou o que está para revisar, os prazos dos orientandos e os avisos (orientador). No Meu TCC, um cartão "Entregas por estado" conta as entregas em cada estado, na ordem do fluxo (RN06). Só leem dados que a tela já tem e os avisos que o menu já busca. |
| Filtros e celular em Orientandos | Filtros "Todos", "Para revisar", "Temas a avaliar" e "Em atraso", com a contagem de cada um, e busca por aluno ou tema (sem diferenciar acento nem maiúscula). No celular, a tabela vira uma lista de cartões, um por aluno. Os filtros só escondem linhas já carregadas: a API continua mandando no que existe e na ordem. |

## Relação com o protótipo do Figma

As telas seguem o [protótipo do Sprint 2](https://www.figma.com/design/S2vvHsgShUZoAzaORCW7gb/SGTCC?node-id=2034-66): barra lateral fixa, ação primária preta, e os textos de interface (rótulos, ajudas e estados vazios) copiados de lá.

Três divergências conscientes:

1. **Sem etapas fixas.** O protótipo mostra "Progresso: 1 de 5 entregas" e uma coluna "Fase atual", sugerindo um roteiro de 5 etapas pré-definidas. A US05 diz que o aluno cria as entregas que quiser, com título livre — e a User Story manda. Aqui o total é quantas entregas existem, e a fase atual é a primeira entrega ainda em andamento.
2. **A avaliação do tema sai da tabela de orientandos**, num modal, como no protótipo — não há fila de temas separada. A "Fila de revisão" desenhada no Figma é de *entregas* (US09) e tem tela própria; só o Perfil ainda aparece desativado na barra lateral.
3. **A revisão acontece na tabela de orientandos, e a tela de Revisão do protótipo é um extra.** No Figma, "Iniciar revisão" fica na Fila de revisão e na tela de Revisão da entrega (versões, comentários, "Novo comentário", "Solicitar correção" e "Aprovar entrega"). Os botões e modais da tabela de orientandos são o que cumpre as US10 a US13. A tela de Revisão foi feita depois, como complemento fora dos requisitos (veja *Extras do protótipo*), e a tabela manteve os atalhos. Os textos seguem o protótipo ("Novo comentário", "Descreva o que precisa ser ajustado", "Escreva um comentário para solicitar correção.", "Seu orientador pediu correção").

A tela de Perfil, que estava desativada, agora existe (conta, resumo, aparência e Telegram). O cartão do Telegram vincula o código do chat (US02).

## Identidade visual e modo escuro

O visual é sóbrio e leve. Cinzas de pedra, levemente quentes, em oito tons (fundo, barra lateral, superfícies, bordas e três graus de texto), e um único destaque verde-azulado (`--destaque`), usado nos botões, no item ativo do menu, nos links, no foco, nas barras de progresso e nos avisos novos. Fora ele, **só duas coisas ganham cor, porque carregam significado:** o estado de cada tema e entrega (os pontinhos) e a prioridade na fila de revisão. O visual é plano, de papel e tinta: os cartões têm só um fio de borda, sem sombra nem brilho; o fundo da página é um tom de pedra um pouco mais escuro que os cartões brancos, com uma pauta de caderno bem fraca (a mesma ideia do painel do login), de modo que o espaço vazio fica com cara de papel; a barra lateral é lisa, verde-azulada escura nos dois temas; o cabeçalho de cada página é só o título grande sobre uma linha; os números do topo de Orientandos e da Fila ficam numa faixa única dividida por traços; e o conteúdo parte da esquerda e usa a largura da tela, em vez de ficar numa coluna no meio. Em telas largas (a partir de 1280px), uma **coluna lateral** à direita repete o que pede atenção: os próximos prazos e os avisos recentes (e, para o orientador, o que está para revisar e os prazos dos orientandos). Ela só é montada em tela larga, então no celular nem entra na página. Os cartões de cada tela entram um depois do outro (só opacidade) e, em telas de toque, botões e itens de menu têm pelo menos 40px de altura.

- **Tipografia:** títulos em **Newsreader** (serifada, feita para leitura) e texto em **IBM Plex Sans** (sóbria e legível), as duas do Google Fonts, só os pesos usados (cerca de 60 kB, com `display=swap`: o texto aparece na hora com a fonte do sistema e troca quando a fonte chega). Se não carregarem, entram as fontes do sistema (Georgia e `system-ui`). Fora essas duas famílias, não há imagem nem biblioteca de estilo externa, e o CSS inteiro tem cerca de 56 kB (11 kB comprimido).
- **Detalhes de interface (extras):** cada pessoa tem um avatar de cor própria (seis tons suaves, escolhidos pelo nome, iguais em todas as telas); o carregamento mostra um esqueleto de barras que pulsam, em vez de um "Carregando…" solto (o texto continua para leitor de tela); avisos e atividades mostram o tempo relativo ("há 2 h", "ontem"), com a data completa ao passar o mouse; a mensagem de confirmação tem um ícone de visto e uma barrinha que mostra o tempo que falta para sumir; os estados vazios mostram duas folhas empilhadas; e **ações sem volta pedem confirmação**: sinalizar uma entrega como pronta, aprovar e enviar à banca abrem um diálogo que explica o que vai acontecer (RN06).
- **Logo e ícone:** o símbolo do SGTCC é o percurso em degraus do "Caminho do TCC" (sai de um ponto, avança por etapas e chega ao ponto final), num quadrado no tom do destaque. Aparece ao lado do nome no menu e no painel da tela de entrar (e, no celular, no topo do cartão de entrar). No menu escuro ele se inverte sozinho (fundo claro, traço escuro), porque as cores vêm das variáveis do tema. O mesmo desenho é o ícone da aba do navegador (`frontend/public/favicon.svg`, 375 bytes, sem nada externo) e do atalho no iOS (`apple-touch-icon.png`, 180×180). A cor da barra do navegador no celular acompanha o tema. Um teste confere que o desenho do favicon e o do logo da tela são o mesmo.
- **Revisão de acessibilidade e usabilidade (extras):** as janelas (Modal) controlam o foco: ao abrir, o foco vai para o primeiro campo; o Tab dá a volta só dentro delas; ao fechar, o foco volta ao botão que as abriu. Há um link "Pular para o conteúdo" (aparece quando o teclado chega nele), e o título da aba do navegador acompanha a tela ("Entregas · SGTCC"). As mensagens de erro são anunciadas por leitor de tela (`role="alert"`), e o botão que está enviando fica ocupado (`aria-busy`) com um aro que gira. As mensagens de erro, aviso e sucesso têm borda de 1px tingida, fundo levemente tingido e um ponto de cor, sem faixa colorida na lateral. Os ícones de fechar e abrir menu são desenhados (SVG), não caracteres. Nas Entregas, o próximo passo de cada uma é o botão cheio ("Enviar versão" ou "Sinalizar pronta") e o resto fica em segundo plano. Em Orientandos os números ficam nos próprios filtros (sem repetir numa faixa à parte), a Fila resume os seus numa linha, a Visão geral é uma lista de trabalho única em que os grupos sem itens encolhem para uma linha, e os atalhos são linhas de uma lista. Em telas de toque, os alvos têm 44px. Números em colunas usam algarismos de largura fixa.
- **Botões e cartões que respondem (extras):** os botões são em pílula; com mouse eles sobem um pouco ao receber o ponteiro (o principal ganha um brilho do destaque) e afundam ao clicar, e em tela de toque nada disso roda, para não ficar "preso". Os botões principais (Entrar, Criar conta, Nova entrega, Ver entregas) levam uma seta desenhada que desliza para o lado. Os cartões de conteúdo têm um traço curto do destaque no canto de cima, que se alonga ao passar o mouse. No alto do Meu TCC, uma pílula mostra o que pede atenção agora (a correção pedida pelo orientador ou o prazo mais próximo) e leva direto à tela certa.
- **Legibilidade garantida por teste:** `contraste.test.jsx` calcula a razão de contraste (WCAG) de cada combinação de texto e fundo da interface, nos temas claro e escuro, e exige pelo menos 4,5:1 para texto comum e 3:1 para o que é só apoio. Ele nasceu de um defeito real, um botão de filtro selecionado que ficava ilegível ao passar o mouse, e também confere que os estados selecionados repetem as suas cores sob o mouse.
- **Caminho do TCC mais claro (extra):** as etapas concluídas levam um visto, a etapa de agora tem um anel que pulsa e a etiqueta "Agora" (a primeira entrega ainda aberta), e as seguintes aparecem com a linha tracejada. Os estados vazios convidam a agir: entregas vazias, com o tema aprovado, levam a "Criar a primeira entrega", e a fila vazia leva a "Ver orientandos".
- **Fechamento em três larguras (extras):** conferido em desktop, tablet e celular. Nas Entregas, o título e as ações dividem a mesma linha e o passo a passo aparece em cinco barras (cheias as etapas feitas, na cor do estado a de agora); em tela estreita as ações descem. A tabela de Orientandos vira cartões já no tablet (até 1100px), em duas colunas quando cabe. O rótulo de um botão nunca quebra em duas linhas. A janela sobe ao abrir e, no celular, entra como folha pelo rodapé; o menu "Mais" aparece com um fade. Ao trocar de tela, o foco vai para o conteúdo. No celular, texto e campos têm 16px, para o iOS não dar zoom ao tocar num campo.
- **Adaptação a cada tela:** o título e os espaços crescem e encolhem com a tela (`clamp`). No celular, o topo fica compacto (marca, pessoa e interruptor numa linha, com o menu numa fita rolável), o interruptor do modo escuro mostra só o desenho, e as janelas sobem do rodapé como uma folha, com os botões na largura toda. Em telas muito largas, o texto de uma linha não se estica sem fim.
- **Modo escuro:** o botão "Modo escuro" fica na barra lateral e nas telas de entrar e criar conta. Na primeira visita vale o tema do computador; depois vale a escolha, guardada no navegador. O `index.html` aplica o tema antes do primeiro desenho, para a tela não piscar.
- **Como funciona:** todas as cores são variáveis de CSS em `src/styles.css`. O modo escuro troca os valores, não as regras (atributo `data-tema` do `<html>`, lógica em `src/tema.js`). Um teste confere que os dois temas definem as mesmas variáveis.
- **Contraste:** as cores de estado e de prioridade ficam um pouco mais claras no modo escuro, para manter a leitura. O atraso não troca a cor do estado: aparece no texto "vencido" e na data.
- **Acabamento:** ícones em SVG na barra lateral, que fica fixa ao rolar; listas e tabelas em cartão; estados como "chips"; faixa de números no topo de Orientandos e da Fila; barras finas de progresso; avisos e erros em faixa com marca lateral; entrar e criar conta com um painel de marca ao lado, só em telas largas. Tudo é CSS e SVG pequeno, e a entrada suave do conteúdo e as transições são desligadas para quem pede menos movimento.
- **Menos poluição na tabela de Orientandos:** a ação principal de cada linha (avaliar o tema, iniciar a revisão, aprovar, enviar à banca) fica à vista, e as demais (solicitar correção, adicionar comentário, histórico e reatribuir) ficam no botão "Mais ações".
- **Avisos que somem sozinhos:** a confirmação de uma ação ("Revisão iniciada. O aluno foi avisado.") aparece num aviso discreto no canto e some em alguns segundos. Erros continuam em faixa, porque a pessoa precisa lê-los.
- **Aluno:** cada entrega mostra a mini linha de etapas (Preparo, Envio, Revisão, Aprovação, Banca), e a linha do tempo agrupa os eventos por dia ("Hoje", "Ontem", "12 de novembro").
- **Orientador:** a Fila de revisão tem busca por aluno ou entrega, sem diferenciar acento nem maiúscula.
- **Perfil:** a tela existe para aluno e orientador. Mostra a conta (nome, e-mail, perfil e "Membro desde", que vem de `GET /api/auth/eu/`), um resumo do trabalho (do aluno: orientador, tema, progresso e fase atual; do orientador: os números da fila e dos orientandos), a escolha de aparência (claro, escuro ou automático, que acompanha o computador), o botão de sair e, como extra, a troca do nome e da senha. O cartão do Telegram (US02) mostra a situação (vinculado ou não), o passo a passo com o link do bot, o campo do código do chat e o botão de desvincular; ao vincular, diz se a mensagem de teste chegou.

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
| `TELEGRAM_BOT_TOKEN` | token do bot, dado pelo @BotFather (US02). É segredo: só no painel, nunca no código |
| `TELEGRAM_BOT_USERNAME` | nome do bot sem o @, ex. `sgtcc_uvv_bot`; aparece no Perfil |

As cinco do `AWS_` são da US06. O disco do Render é apagado a cada deploy, então os PDFs precisam ir para o Supabase Storage; sem elas o Django grava em `backend/media`, o que só serve para rodar local.

Sem `TELEGRAM_BOT_TOKEN` o sistema funciona igual, mas as notificações de quem tem Telegram ficam como "falhou", com o motivo anotado. Para rodar local, ponha as duas variáveis do Telegram em `backend/.env` (o arquivo fica fora do Git).

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
cd backend && python manage.py test core   # 275 testes
cd frontend && npm test                    # 350 testes
```

No backend, um teste por critério de aceite mais as regras de negócio envolvidas, organizados por US em `backend/core/tests/`. O `test_fluxo_revisao.py` percorre a entrega inteira pela API (US06, US08, US10 e US11), de rascunho até a correção e de volta. No frontend, testes de fumaça (Vitest + Testing Library) que montam cada tela e conferem os textos do protótipo e as regras visíveis — botão desabilitado sem tema aprovado, justificativa obrigatória no modal.

A US15 recebe `{"novo_orientador": <id>}` na reatribuição. Apenas o orientador ativo inicia a troca. O antigo perde acesso à lista e ao histórico; o novo consulta todas as versões e comentários, além dos eventos e vínculos anteriores. O histórico é uma página simples; o detalhe do Figma fica para a integração final. A US12 registra o aviso no `Evento`, que a US02 envia pelo Telegram.

## Endpoints

| Método | Rota | US | Perfil |
|--------|------|----|--------|
| POST | `/api/auth/registrar/` | US01 CA1, CA2 | público |
| POST | `/api/auth/login/` | US01 CA3, CA4 | público |
| POST | `/api/auth/refresh/` | — | público |
| GET | `/api/auth/eu/` | dados da conta para o Perfil (inclui `data_cadastro`) | autenticado |
| PATCH | `/api/auth/eu/` | **EXTRA** (fora dos requisitos): trocar o nome | autenticado |
| POST | `/api/auth/telegram/` | US02 CA1: vincular `{"chat_id": "..."}` (vazio desvincula); devolve `teste`: `enviada`, `falhou` ou `null` | autenticado |
| POST | `/api/auth/alterar-email/` | **EXTRA** (fora dos requisitos): trocar o e-mail de login | autenticado |
| POST | `/api/auth/alterar-senha/` | **EXTRA** (fora dos requisitos): trocar a senha | autenticado |
| GET | `/api/avisos/` | **EXTRA** (fora dos requisitos): aba de Avisos | autenticado |
| POST | `/api/avisos/marcar-lidos/` | **EXTRA** (fora dos requisitos): marcar os avisos como vistos | autenticado |
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
    models.py        Usuario, TCC, Tema, Orientacao, Entrega, Versao, Comentario, Evento, PrioridadeRevisao (extra), TentativaLogin (extra)
    management/      criar_admin, seed_demo, exportar_dados (RNF14)
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
    pages/           Login, Cadastro, Avisos (extra)
      aluno/         AreaAluno, MeuTCC, ProporTema, Entregas, NovaEntrega
      orientador/    Orientandos (tabela + modais de avaliação de tema e de correção), FilaRevisao (US09), RevisaoEntrega (extra), VisaoGeral (extra)
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

