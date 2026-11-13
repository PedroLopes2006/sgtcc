/**
 * Detalhes do visual: indicadores, barras de progresso, ícones, painel de marca
 * e as garantias de leveza e de acessibilidade do CSS.
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import api from '../api'
import { AuthProvider } from '../auth'
import Layout from '../components/Layout'
import Login from '../pages/Login'
import AreaAluno from '../pages/aluno/AreaAluno'
import MeuTCC from '../pages/aluno/MeuTCC'
import FilaRevisao from '../pages/orientador/FilaRevisao'
import Orientandos from '../pages/orientador/Orientandos'

// O Vitest roda na raiz do frontend; o jsdom não dá uma URL de arquivo para este módulo.
const CSS = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8')

const ORIENTADOR = { id: 2, nome: 'Marcos Ribeiro', email: 'm@prof.edu.br', perfil: 'orientador' }
const ALUNO = { id: 1, nome: 'Lucas Andrade', email: 'lucas@aluno.edu.br', perfil: 'aluno' }

function entrarComo(usuario) {
  localStorage.setItem('sgtcc.usuario', JSON.stringify(usuario))
  localStorage.setItem('sgtcc.access', 'token-de-teste')
}

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

afterEach(() => {
  cleanup()
  localStorage.clear()
})

function linha(id, nome, extras = {}) {
  return {
    id,
    aluno: { id, nome },
    tema: { id, titulo: `Tema de ${nome}`, status: 'aprovado' },
    entregas: [],
    fase_atual: 'Metodologia',
    estado: { codigo: 'aprovado', rotulo: 'Tema aprovado' },
    progresso: { concluidas: 0, total: 0 },
    prazo: null,
    prazo_vencido: false,
    aguarda_avaliacao_de_tema: false,
    entrega_para_revisao: null,
    entrega_para_comentario: null,
    entrega_para_banca: null,
    ...extras,
  }
}

function renderizarRota(rota, elemento, respostas) {
  vi.spyOn(api, 'get').mockImplementation((url) => {
    const resposta = respostas[url]
    return Promise.resolve({ data: resposta === undefined ? [] : resposta })
  })
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={[rota]}>
        <Routes>
          <Route path={rota} element={elemento} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('Indicadores do orientador', () => {
  it('Orientandos mostra os números de relance e destaca o atraso', async () => {
    entrarComo(ORIENTADOR)
    renderizarRota('/orientador', <Orientandos />, {
      '/orientandos/': [
        linha(1, 'Ana', {
          progresso: { concluidas: 1, total: 4 },
          prazo_vencido: true,
          entrega_para_revisao: { id: 5, titulo: 'Introdução', estado: 'pronto_para_revisao' },
        }),
        linha(2, 'Bruno', { aguarda_avaliacao_de_tema: true }),
        linha(3, 'Carla'),
      ],
    })

    await screen.findByText('Ana')
    const indicador = (rotulo) => within(document.querySelector('.indicadores')).getByText(rotulo).closest('div')

    expect(within(indicador('Orientandos ativos')).getByText('3')).toBeInTheDocument()
    expect(within(indicador('Para revisar')).getByText('1')).toBeInTheDocument()
    expect(within(indicador('Temas a avaliar')).getByText('1')).toBeInTheDocument()
    expect(within(indicador('Em atraso')).getByText('1')).toHaveClass('alerta')
  })

  it('sem atraso, o número não é destacado', async () => {
    entrarComo(ORIENTADOR)
    renderizarRota('/orientador', <Orientandos />, { '/orientandos/': [linha(1, 'Ana')] })

    await screen.findByText('Ana')

    expect(within(within(document.querySelector('.indicadores')).getByText('Em atraso').closest('div')).getByText('0')).not.toHaveClass(
      'alerta',
    )
  })

  it('sem orientandos, não aparece a faixa de números', async () => {
    entrarComo(ORIENTADOR)
    renderizarRota('/orientador', <Orientandos />, { '/orientandos/': [] })

    expect(await screen.findByText('Você ainda não tem orientandos')).toBeInTheDocument()
    expect(screen.queryByText('Orientandos ativos')).not.toBeInTheDocument()
  })

  it('a Fila mostra quantas aguardam e há quanto tempo espera a mais antiga', async () => {
    entrarComo(ORIENTADOR)
    const tresDiasAtras = new Date(Date.now() - 3 * 86400000).toISOString()
    const item = (id, atrasada) => ({
      id,
      titulo: `Entrega ${id}`,
      estado: 'pronto_para_revisao',
      prazo: '2026-12-20',
      atrasada,
      tcc: id,
      aluno: { id, nome: `Aluno ${id}` },
      versao_atual: null,
      pronta_em: tresDiasAtras,
      prioridade: null,
    })
    renderizarRota('/orientador/fila', <FilaRevisao />, {
      '/fila-revisao/': [item(5, false), item(6, true)],
    })

    await screen.findByText('Aluno 5 · Entrega 5')
    const indicador = (rotulo) => within(document.querySelector('.indicadores')).getByText(rotulo).closest('div')

    expect(within(indicador('Aguardando')).getByText('2')).toBeInTheDocument()
    expect(within(indicador('Espera mais antiga')).getByText('há 3 dias')).toBeInTheDocument()
    expect(within(indicador('Em atraso')).getByText('1')).toHaveClass('alerta')
  })
})

describe('Barras de progresso', () => {
  it('Orientandos mostra o texto e uma barra proporcional ao concluído', async () => {
    entrarComo(ORIENTADOR)
    renderizarRota('/orientador', <Orientandos />, {
      '/orientandos/': [linha(1, 'Ana', { progresso: { concluidas: 1, total: 4 } })],
    })

    const texto = await screen.findByText('1 de 4')
    const barra = texto.parentElement.querySelector('.barra-progresso > span')

    expect(barra).toHaveStyle({ width: '25%' })
    expect(texto.parentElement.querySelector('.barra-progresso')).toHaveAttribute(
      'aria-hidden',
      'true',
    )
  })

  it('Meu TCC mostra a barra quando há entregas, e nenhuma sem elas', async () => {
    entrarComo(ALUNO)
    const tcc = (entregas) => ({
      id: 1,
      aluno: ALUNO,
      orientador: { id: 2, nome: 'Marcos' },
      tema: {
        id: 9, titulo: 'Tema', descricao: 'Descrição.', status: 'aprovado',
        justificativa_ajuste: '', data_proposta: '2026-08-20T12:00:00Z',
        data_aprovacao: '2026-08-25T12:00:00Z',
      },
      entregas,
    })
    const entrega = (id, estado) => ({ id, titulo: `E${id}`, estado, prazo: '2026-12-01' })

    vi.spyOn(api, 'get').mockResolvedValue({
      data: tcc([entrega(1, 'concluida'), entrega(2, 'rascunho')]),
    })
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/aluno']}>
          <Routes>
            <Route path="/aluno" element={<AreaAluno />}>
              <Route index element={<MeuTCC />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )

    const texto = await screen.findByText(/1 de 2 entregas concluídas/)
    expect(texto.querySelector('.barra-progresso > span')).toHaveStyle({ width: '50%' })
  })
})

describe('Ícones da barra lateral', () => {
  function renderizarLayout(itens) {
    entrarComo(ALUNO)
    render(
      <AuthProvider>
        <MemoryRouter>
          <Layout itens={itens}>conteúdo</Layout>
        </MemoryRouter>
      </AuthProvider>,
    )
  }

  it('troca o símbolo de texto por um desenho SVG', () => {
    renderizarLayout([{ rotulo: 'Meu TCC', icone: '▦', para: '/aluno' }])

    const link = screen.getByRole('link', { name: 'Meu TCC' })
    expect(link.querySelector('svg')).toBeInTheDocument()
    expect(link).not.toHaveTextContent('▦')
  })

  it('um símbolo sem desenho continua aparecendo como texto', () => {
    renderizarLayout([{ rotulo: 'Outro', icone: '★', para: '/outro' }])

    const link = screen.getByRole('link', { name: /Outro/ })
    expect(link.querySelector('svg')).not.toBeInTheDocument()
    expect(link).toHaveTextContent('★')
  })

  it('o ícone não entra no nome acessível do link', () => {
    renderizarLayout([{ rotulo: 'Entregas', icone: '▤', para: '/aluno/entregas' }])
    expect(screen.getByRole('link', { name: 'Entregas' })).toBeInTheDocument()
  })

  it('a barra lateral mostra a marca', () => {
    renderizarLayout([])
    expect(screen.getByText('SGTCC')).toBeInTheDocument()
  })
})

describe('Painel de marca da tela de entrar', () => {
  it('apresenta o sistema ao lado do formulário', () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      </AuthProvider>,
    )

    const painel = screen.getByRole('region', { name: 'Sobre o SGTCC' })
    expect(within(painel).getByText('Sistema de Gestão de TCC')).toBeInTheDocument()
    expect(within(painel).getAllByRole('listitem')).toHaveLength(3)
    // O formulário continua sendo o foco da tela.
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument()
  })
})

describe('Garantias do CSS', () => {
  it('a animação de entrada só muda a opacidade', () => {
    // Uma transformação deixaria o elemento como "bloco de contenção" dos modais (position: fixed).
    const bloco = CSS.match(/@keyframes entrada\s*\{([\s\S]*?)\n\}/)
    expect(bloco, 'keyframes entrada').not.toBeNull()
    expect(bloco[1]).toMatch(/opacity/)
    expect(bloco[1]).not.toMatch(/transform|translate|scale|rotate/)
  })

  it('quem pede menos movimento não vê transição nem animação', () => {
    const bloco = CSS.match(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/)
    expect(bloco, 'bloco de reduzir movimento').not.toBeNull()
    expect(bloco[1]).toMatch(/transition:\s*none/)
    expect(bloco[1]).toMatch(/animation:\s*none/)
  })

  it('a barra lateral volta ao fluxo normal no celular', () => {
    const celular = CSS.match(/@media \(max-width: 720px\)\s*\{([\s\S]*?)\n\}\n/)
    expect(celular, 'bloco do celular').not.toBeNull()
    expect(celular[1]).toMatch(/position:\s*static/)
  })

  it('o painel de marca só aparece em telas largas', () => {
    expect(CSS).toMatch(/\.painel-marca\s*\{\s*display:\s*none;\s*\}/)
    expect(CSS).toMatch(/@media \(min-width: 900px\)[\s\S]*\.painel-marca\s*\{\s*display:\s*flex/)
  })
})
