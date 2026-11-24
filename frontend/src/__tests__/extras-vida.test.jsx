/**
 * EXTRAS — fora dos requisitos do documento, da rodada "mais vida" do visual:
 *  - contagem regressiva dos prazos;
 *  - ordenar e agrupar as entregas, escolhidos pelo aluno;
 *  - atalhos rápidos e caminho do TCC no Meu TCC;
 *  - aviso discreto de conclusão;
 *  - aba "Visão geral" do orientador.
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import api from '../api'
import { AuthProvider } from '../auth'
import { mensagemDeConclusao } from '../conclusoes'
import { agrupar, lerVista, ordenar } from '../entregasVista'
import { prazoRestante } from '../formato'
import AreaAluno from '../pages/aluno/AreaAluno'
import Entregas from '../pages/aluno/Entregas'
import MeuTCC from '../pages/aluno/MeuTCC'
import VisaoGeral from '../pages/orientador/VisaoGeral'

// O Vitest roda na raiz do frontend; o jsdom não dá uma URL de arquivo para este módulo.
// O Git no Windows pode gravar o arquivo com CRLF; os testes comparam com \n.
const CSS = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8').replace(/\r\n/g, '\n')

const ALUNO = { id: 1, nome: 'Lucas Andrade', email: 'lucas@aluno.edu.br', perfil: 'aluno' }
const ORIENTADOR = { id: 2, nome: 'Marcos Ribeiro', email: 'm@prof.edu.br', perfil: 'orientador' }

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

afterEach(() => {
  cleanup()
  localStorage.clear()
})

// ------------------------------------------------------- contagem regressiva

describe('Contagem regressiva do prazo (extra)', () => {
  const agora = new Date(2026, 10, 10, 15, 0) // 10 de novembro de 2026

  it('diz quantos dias faltam, com o tom certo', () => {
    expect(prazoRestante('2026-11-30', 'rascunho', agora)).toEqual({ texto: 'faltam 20 dias', nivel: 'ok' })
    expect(prazoRestante('2026-11-15', 'rascunho', agora)).toEqual({ texto: 'faltam 5 dias', nivel: 'perto' })
    expect(prazoRestante('2026-11-11', 'rascunho', agora)).toEqual({ texto: 'falta 1 dia', nivel: 'urgente' })
    expect(prazoRestante('2026-11-10', 'rascunho', agora)).toEqual({ texto: 'vence hoje', nivel: 'urgente' })
  })

  it('conta o atraso em dias', () => {
    expect(prazoRestante('2026-11-09', 'em_revisao', agora)).toEqual({
      texto: 'vencido há 1 dia',
      nivel: 'vencido',
    })
    expect(prazoRestante('2026-11-05', 'rascunho', agora).texto).toBe('vencido há 5 dias')
  })

  it('não mostra nada para entrega encerrada ou sem prazo', () => {
    expect(prazoRestante('2026-11-05', 'concluida', agora)).toBeNull()
    expect(prazoRestante('2026-11-05', 'enviada_a_banca', agora)).toBeNull()
    expect(prazoRestante(null, 'rascunho', agora)).toBeNull()
  })
})

// ---------------------------------------------------- ordenar e agrupar (lógica)

describe('Ordenar e agrupar entregas (extra)', () => {
  const entregas = [
    { id: 1, titulo: 'Metodologia', estado: 'em_revisao', prazo: '2026-12-01' },
    { id: 2, titulo: 'Introdução', estado: 'concluida', prazo: '2026-11-01' },
    { id: 3, titulo: 'Cronograma', estado: 'rascunho', prazo: '2026-11-20' },
  ]
  const ids = (lista) => lista.map((e) => e.id)

  it('ordena por prazo, título e estado, e mantém a ordem de criação por padrão', () => {
    expect(ids(ordenar(entregas, 'criacao'))).toEqual([1, 2, 3])
    expect(ids(ordenar(entregas, 'prazo'))).toEqual([2, 3, 1])
    expect(ids(ordenar(entregas, 'prazo_desc'))).toEqual([1, 3, 2])
    expect(ids(ordenar(entregas, 'titulo'))).toEqual([3, 2, 1])
    expect(ids(ordenar(entregas, 'estado'))).toEqual([3, 1, 2]) // rascunho, em revisão, concluída
  })

  it('não altera a lista original', () => {
    ordenar(entregas, 'titulo')
    expect(ids(entregas)).toEqual([1, 2, 3])
  })

  it('agrupa por situação, por estado e por prazo, sem grupos vazios', () => {
    const agora = new Date(2026, 10, 10)

    expect(agrupar(entregas, 'situacao').map((g) => g.titulo)).toEqual(['Em andamento', 'Encerradas'])
    expect(agrupar(entregas, 'estado').map((g) => g.titulo)).toEqual([
      'Rascunho',
      'Em revisão',
      'Concluída',
    ])
    expect(agrupar(entregas, 'prazo', agora).map((g) => g.titulo)).toEqual([
      'Mais adiante',
      'Encerradas',
    ])
  })

  it('sem agrupamento, devolve um grupo só, sem título', () => {
    const grupos = agrupar(entregas, 'nenhum')
    expect(grupos).toHaveLength(1)
    expect(grupos[0].titulo).toBeNull()
  })

  it('a escolha guardada que não existe mais volta ao padrão', () => {
    localStorage.setItem('sgtcc.entregas.vista', JSON.stringify({ ordem: 'xyz', agrupar: 'abc' }))
    expect(lerVista()).toEqual({ ordem: 'criacao', agrupar: 'nenhum' })
  })
})

// -------------------------------------------------------------- conclusão (lógica)

describe('Aviso de conclusão (extra)', () => {
  const entrega = (estado, extras = {}) => ({ id: 1, titulo: 'Capítulo 1', estado, ...extras })

  it('avisa quando uma entrega passa a concluída', () => {
    expect(mensagemDeConclusao({ 1: 'em_revisao' }, [entrega('concluida')])).toBe(
      'Parabéns! "Capítulo 1" foi concluída.',
    )
  })

  it('avisa quando passa a enviada à banca', () => {
    expect(mensagemDeConclusao({ 1: 'concluida' }, [entrega('enviada_a_banca')])).toBe('')
    expect(mensagemDeConclusao({ 1: 'em_revisao' }, [entrega('enviada_a_banca')])).toBe(
      '"Capítulo 1" foi enviada à banca.',
    )
  })

  it('junta várias conclusões numa mensagem só', () => {
    const anteriores = { 1: 'em_revisao', 2: 'em_revisao' }
    const atuais = [entrega('concluida'), entrega('concluida', { id: 2 })]
    expect(mensagemDeConclusao(anteriores, atuais)).toBe('Parabéns! 2 entregas foram concluídas.')
  })

  it('não avisa na primeira vez, nem de entrega nova, nem de estado que não mudou', () => {
    expect(mensagemDeConclusao(null, [entrega('concluida')])).toBe('')
    expect(mensagemDeConclusao({}, [entrega('concluida')])).toBe('')
    expect(mensagemDeConclusao({ 1: 'concluida' }, [entrega('concluida')])).toBe('')
  })
})

// ------------------------------------------------------------------ telas do aluno

const ENTREGA = (extras = {}) => ({
  id: 7,
  titulo: 'Capítulo 1',
  estado: 'rascunho',
  prazo: '2099-12-31',
  atrasada: false,
  aceita_versao: true,
  pode_sinalizar: false,
  ...extras,
})

function tcc(entregas, statusDoTema = 'aprovado') {
  return {
    id: 1,
    aluno: ALUNO,
    orientador: { id: 2, nome: 'Prof. Marcos' },
    tema: {
      id: 9, titulo: 'Sistema de gestão', descricao: 'Plataforma web.', status: statusDoTema,
      justificativa_ajuste: '',
      data_proposta: '2026-08-20T12:00:00Z', data_aprovacao: '2026-08-25T12:00:00Z',
    },
    entregas,
  }
}

function abrirComoAluno(rota, entregas, statusDoTema) {
  localStorage.setItem('sgtcc.usuario', JSON.stringify(ALUNO))
  localStorage.setItem('sgtcc.access', 'token-de-teste')
  vi.spyOn(api, 'get').mockImplementation((url) =>
    Promise.resolve({
      data: url === '/meu-tcc/' ? tcc(entregas, statusDoTema) : { nao_lidos: 0, avisos: [] },
    }),
  )
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={[rota]}>
        <Routes>
          <Route path="/aluno" element={<AreaAluno />}>
            <Route index element={<MeuTCC />} />
            <Route path="entregas" element={<Entregas />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('Meu TCC: atalhos e caminho (extra)', () => {
  it('mostra atalhos só para o que faz sentido agora', async () => {
    abrirComoAluno('/aluno', [ENTREGA(), ENTREGA({ id: 8, titulo: 'Metodologia', estado: 'correcao_solicitada' })])

    const atalhos = await screen.findByRole('region', { name: 'Atalhos' })

    expect(within(atalhos).getByRole('link', { name: /Enviar versão/ })).toHaveAttribute(
      'href',
      '/aluno/entregas?enviar=7',
    )
    expect(within(atalhos).getByRole('link', { name: /Ver correção pedida/ })).toBeInTheDocument()
    expect(within(atalhos).getByRole('link', { name: /Nova entrega/ })).toHaveAttribute(
      'href',
      '/aluno/entregas/nova',
    )
  })

  it('sem entrega que aceite versão nem correção, só sobra criar entrega', async () => {
    abrirComoAluno('/aluno', [ENTREGA({ estado: 'em_revisao', aceita_versao: false })])

    const atalhos = await screen.findByRole('region', { name: 'Atalhos' })

    expect(within(atalhos).queryByRole('link', { name: /Enviar versão/ })).not.toBeInTheDocument()
    expect(within(atalhos).queryByRole('link', { name: /Ver correção/ })).not.toBeInTheDocument()
    expect(within(atalhos).getByRole('link', { name: /Nova entrega/ })).toBeInTheDocument()
  })

  it('sem tema aprovado, não há atalhos nem caminho', async () => {
    abrirComoAluno('/aluno', [], 'proposto')

    await screen.findByText('Seu orientador foi notificado e vai avaliar o tema.')

    expect(screen.queryByRole('region', { name: 'Atalhos' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Caminho do TCC' })).not.toBeInTheDocument()
  })

  it('o caminho do TCC começa no tema e segue pelas entregas por prazo, com a contagem', async () => {
    abrirComoAluno('/aluno', [
      ENTREGA({ id: 1, titulo: 'Depois', prazo: '2099-12-31' }),
      ENTREGA({ id: 2, titulo: 'Antes', prazo: '2098-01-10', estado: 'em_revisao', aceita_versao: false }),
    ])

    const caminho = await screen.findByRole('region', { name: 'Caminho do TCC' })
    const paradas = within(caminho).getAllByRole('listitem')

    expect(paradas[0]).toHaveTextContent('Tema aprovado')
    expect(paradas[1]).toHaveTextContent('Antes')
    expect(paradas[1]).toHaveTextContent('Em revisão')
    expect(paradas[2]).toHaveTextContent('Depois')
    expect(paradas[2]).toHaveTextContent(/faltam \d+ dias/)
    expect(within(caminho).getByRole('link', { name: 'Ver linha do tempo' })).toBeInTheDocument()
  })

  it('sem entregas, o caminho avisa que ainda não há nenhuma', async () => {
    abrirComoAluno('/aluno', [])

    expect(await screen.findByText('Nenhuma entrega ainda')).toBeInTheDocument()
  })
})

describe('Entregas: contagem, ordem e agrupamento (extra)', () => {
  const tres = [
    ENTREGA({ id: 1, titulo: 'Metodologia', prazo: '2099-12-01' }),
    ENTREGA({ id: 2, titulo: 'Cronograma', prazo: '2098-11-20', estado: 'concluida', aceita_versao: false }),
    ENTREGA({ id: 3, titulo: 'Introdução', prazo: '2098-11-25', estado: 'em_revisao', aceita_versao: false }),
  ]
  const titulos = () =>
    screen.getAllByRole('listitem').map((li) => li.querySelector('.titulo')?.textContent).filter(Boolean)

  it('mostra a contagem regressiva, e nada para a entrega concluída', async () => {
    abrirComoAluno('/aluno/entregas', tres)

    await screen.findByText('Metodologia')

    expect(screen.getAllByText(/faltam \d+ dias/).length).toBeGreaterThan(0)
    const concluida = screen.getByText('Cronograma').closest('li')
    expect(within(concluida).queryByText(/faltam|vence|vencido/)).not.toBeInTheDocument()
  })

  it('o aluno escolhe a ordem, e a escolha fica guardada', async () => {
    abrirComoAluno('/aluno/entregas', tres)
    await screen.findByText('Metodologia')
    expect(titulos()).toEqual(['Metodologia', 'Cronograma', 'Introdução'])

    await userEvent.selectOptions(screen.getByLabelText('Ordenar por'), 'titulo')

    expect(titulos()).toEqual(['Cronograma', 'Introdução', 'Metodologia'])
    expect(JSON.parse(localStorage.getItem('sgtcc.entregas.vista')).ordem).toBe('titulo')
  })

  it('o aluno escolhe o agrupamento, com título e contagem em cada grupo', async () => {
    abrirComoAluno('/aluno/entregas', tres)
    await screen.findByText('Metodologia')

    await userEvent.selectOptions(screen.getByLabelText('Agrupar por'), 'situacao')

    const grupos = screen.getAllByRole('heading', { level: 2 })
    expect(grupos.map((g) => g.textContent.replace(/\s+/g, ' ').trim())).toEqual([
      'Em andamento 2',
      'Encerradas 1',
    ])
  })

  it('a escolha guardada vale na próxima visita', async () => {
    localStorage.setItem('sgtcc.entregas.vista', JSON.stringify({ ordem: 'titulo', agrupar: 'nenhum' }))

    abrirComoAluno('/aluno/entregas', tres)
    await screen.findByText('Metodologia')

    expect(screen.getByLabelText('Ordenar por')).toHaveValue('titulo')
    expect(titulos()).toEqual(['Cronograma', 'Introdução', 'Metodologia'])
  })

  it('o atalho "Enviar versão" chega com o envio já aberto', async () => {
    abrirComoAluno('/aluno/entregas?enviar=1', tres)

    expect(await screen.findByRole('dialog', { name: 'Enviar versão' })).toBeInTheDocument()
  })

  it('o atalho não abre o envio de uma entrega que não aceita versão', async () => {
    abrirComoAluno('/aluno/entregas?enviar=2', tres)
    await screen.findByText('Metodologia')

    expect(screen.queryByRole('dialog', { name: 'Enviar versão' })).not.toBeInTheDocument()
  })
})

describe('Aviso de conclusão na tela do aluno (extra)', () => {
  it('mostra o aviso quando uma entrega foi concluída desde a última visita', async () => {
    localStorage.setItem('sgtcc.estados.1', JSON.stringify({ 7: 'em_revisao' }))

    abrirComoAluno('/aluno', [ENTREGA({ estado: 'concluida', aceita_versao: false })])

    expect(await screen.findByText('Parabéns! "Capítulo 1" foi concluída.')).toBeInTheDocument()
  })

  it('não mostra de novo na visita seguinte', async () => {
    localStorage.setItem('sgtcc.estados.1', JSON.stringify({ 7: 'concluida' }))

    abrirComoAluno('/aluno', [ENTREGA({ estado: 'concluida', aceita_versao: false })])
    await screen.findByRole('region', { name: 'Caminho do TCC' })

    expect(screen.queryByText(/Parabéns/)).not.toBeInTheDocument()
  })
})

// ------------------------------------------------------------- visão geral do orientador

describe('Visão geral do orientador (extra)', () => {
  const linha = (id, nome, extras = {}) => ({
    id,
    aluno: { id, nome },
    tema: { id, titulo: `Tema de ${nome}`, status: 'aprovado' },
    fase_atual: 'Metodologia',
    estado: { codigo: 'aprovado', rotulo: 'Tema aprovado' },
    progresso: { concluidas: 0, total: 0 },
    prazo: '2026-10-01',
    prazo_vencido: false,
    aguarda_avaliacao_de_tema: false,
    entrega_para_revisao: null,
    entrega_para_comentario: null,
    entrega_para_banca: null,
    ...extras,
  })

  function abrir(linhas) {
    localStorage.setItem('sgtcc.usuario', JSON.stringify(ORIENTADOR))
    localStorage.setItem('sgtcc.access', 'token-de-teste')
    vi.spyOn(api, 'get').mockImplementation((url) =>
      Promise.resolve({
        data: url === '/orientandos/' ? linhas : url === '/avisos/' ? { nao_lidos: 0, avisos: [] } : [],
      }),
    )
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/orientador/visao-geral']}>
          <Routes>
            <Route path="/orientador/visao-geral" element={<VisaoGeral />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )
  }

  const painel = (nome) => screen.getByRole('heading', { name: new RegExp(nome) }).closest('section')

  it('separa o que pede atenção, com link para a tela de cada entrega', async () => {
    abrir([
      linha(1, 'Ana', {
        prazo_vencido: true,
        estado: { codigo: 'pronto_para_revisao', rotulo: 'Pronta para revisão' },
        entrega_para_revisao: { id: 5, titulo: 'Introdução', estado: 'pronto_para_revisao' },
      }),
      linha(2, 'Bruno', {
        aguarda_avaliacao_de_tema: true,
        estado: { codigo: 'proposto', rotulo: 'Tema proposto' },
      }),
      linha(3, 'Carla', {
        entrega_para_revisao: { id: 6, titulo: 'Cronograma', estado: 'em_revisao' },
        estado: { codigo: 'em_revisao', rotulo: 'Em revisão' },
      }),
      linha(4, 'Davi', {
        trabalho_final: { id: 4, estado: 'aprovado', estado_rotulo: 'Aprovado', acoes: { aprovar: false, enviar_a_banca: true } },
        estado: { codigo: 'concluida', rotulo: 'Concluída' },
      }),
    ])

    await screen.findByRole('heading', { name: 'Visão geral' })

    const revisar = painel('Para revisar')
    expect(within(revisar).getByRole('link', { name: /Introdução/ })).toHaveAttribute(
      'href',
      '/orientador/entregas/5',
    )
    expect(within(painel('Em revisão')).getByRole('link', { name: /Cronograma/ })).toHaveAttribute(
      'href',
      '/orientador/entregas/6',
    )
    expect(within(painel('Temas a avaliar')).getByText('Tema de Bruno')).toBeInTheDocument()
    expect(within(painel('Prazos vencidos')).getByText(/Ana/)).toBeInTheDocument()
    expect(within(painel('Trabalhos finais')).getByRole('link', { name: /Davi/ })).toHaveAttribute(
      'href',
      '/orientador/orientandos/4/trabalho-final',
    )
  })

  it('conta os orientandos por estado', async () => {
    abrir([linha(1, 'Ana'), linha(2, 'Bruno'), linha(3, 'Carla', { estado: { codigo: 'proposto', rotulo: 'Tema proposto' } })])

    await screen.findByRole('heading', { name: 'Visão geral' })

    const estados = painel('Orientandos por estado')
    expect(within(estados).getByText('Tema aprovado').closest('li')).toHaveTextContent('2')
    expect(within(estados).getByText('Tema proposto').closest('li')).toHaveTextContent('1')
  })

  it('painel sem nada diz isso em vez de ficar vazio', async () => {
    abrir([linha(1, 'Ana')])

    await screen.findByRole('heading', { name: 'Visão geral' })

    expect(within(painel('Para revisar')).getByText('Nenhuma entrega esperando.')).toBeInTheDocument()
    expect(within(painel('Prazos vencidos')).getByText('Nenhum prazo vencido.')).toBeInTheDocument()
  })

  it('sem orientandos, mostra a mensagem de vazio', async () => {
    abrir([])

    expect(await screen.findByText('Você ainda não tem orientandos')).toBeInTheDocument()
  })

  it('o menu do orientador tem a aba Visão geral', async () => {
    abrir([linha(1, 'Ana')])

    const aba = await screen.findByRole('link', { name: /Visão geral/ })

    await waitFor(() => expect(aba).toHaveAttribute('href', '/orientador/visao-geral'))
  })
})

// ----------------------------------------------------------------------- visual

describe('Visual da segunda rodada (extra)', () => {
  it('a barra lateral é escura nos dois temas', () => {
    expect(CSS).toMatch(/\.sidebar\s*\{[^}]*background:\s*linear-gradient/)
    expect(CSS).toMatch(/:root\[data-tema='escuro'\]\s*\.sidebar/)
  })

  it('o conteúdo parte da esquerda, sem centralizar numa coluna', () => {
    // Valem todas as regras juntas, da última para a primeira.
    const regras = [...CSS.matchAll(/\n\.conteudo\s*\{([^}]*)\}/g)].map((m) => m[1])
    // A última declaração de margem é a que vale: zero, sem o "auto" que centralizava.
    const margens = [...regras.join('\n').matchAll(/(?<![-\w])margin:\s*([^;]+);/g)].map((m) => m[1])
    expect(margens.at(-1)).toBe('0')
    // E a largura não tem limite: a última declaração de largura é `none`, para o conteúdo
    // ir até a coluna lateral.
    const larguras = [...regras.join('\n').matchAll(/max-width:\s*([^;]+);/g)].map((m) => m[1])
    expect(larguras.at(-1)).toBe('none')
  })
})
