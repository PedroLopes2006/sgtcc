/**
 * EXTRAS — fora dos requisitos do documento: coluna lateral das telas largas e
 * resumo das entregas por estado, da rodada que preenche melhor a tela.
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import api from '../api'
import { AuthProvider } from '../auth'
import ResumoDasEntregas from '../components/ResumoDasEntregas'
import AreaAluno from '../pages/aluno/AreaAluno'
import MeuTCC from '../pages/aluno/MeuTCC'
import VisaoGeral from '../pages/orientador/VisaoGeral'

// O Vitest roda na raiz do frontend; o jsdom não dá uma URL de arquivo para este módulo.
const CSS = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8')

const ALUNO = { id: 1, nome: 'Lucas Andrade', email: 'lucas@aluno.edu.br', perfil: 'aluno' }
const ORIENTADOR = { id: 2, nome: 'Marcos Ribeiro', email: 'm@prof.edu.br', perfil: 'orientador' }

function simularTela(larga) {
  window.matchMedia = vi.fn().mockImplementation((consulta) => ({
    matches: larga && consulta.includes('min-width'),
    media: consulta,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

afterEach(() => {
  cleanup()
  delete window.matchMedia
  localStorage.clear()
})

const AVISO = {
  id: 1,
  tipo: 'correcao_solicitada',
  descricao: 'Correção solicitada na entrega "Capítulo 1".',
  data_hora: '2026-11-10T14:30:00Z',
  de: 'Marcos',
  entrega_id: 7,
  nao_lido: true,
}

const ENTREGAS = [
  { id: 1, titulo: 'Capítulo 2', estado: 'rascunho', prazo: '2099-12-31', atrasada: false, aceita_versao: true },
  { id: 2, titulo: 'Capítulo 1', estado: 'em_revisao', prazo: '2098-11-01', atrasada: false, aceita_versao: false },
  { id: 3, titulo: 'Capítulo 0', estado: 'concluida', prazo: '2026-01-01', atrasada: false, aceita_versao: false },
]

function abrirComoAluno() {
  localStorage.setItem('sgtcc.usuario', JSON.stringify(ALUNO))
  localStorage.setItem('sgtcc.access', 'token-de-teste')
  vi.spyOn(api, 'get').mockImplementation((url) =>
    Promise.resolve({
      data:
        url === '/meu-tcc/'
          ? {
              id: 1,
              aluno: ALUNO,
              orientador: { id: 2, nome: 'Prof. Marcos' },
              tema: {
                id: 9, titulo: 'Sistema', descricao: 'Web.', status: 'aprovado', justificativa_ajuste: '',
                data_proposta: '2026-08-20T12:00:00Z', data_aprovacao: '2026-08-25T12:00:00Z',
              },
              entregas: ENTREGAS,
            }
          : { nao_lidos: 1, avisos: [AVISO] },
    }),
  )
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
}

describe('Coluna lateral do aluno (extra)', () => {
  it('em tela larga, mostra os próximos prazos em aberto e os avisos recentes', async () => {
    simularTela(true)
    abrirComoAluno()

    const lateral = await screen.findByRole('complementary', { name: 'Resumo' })
    const prazos = await within(lateral).findByRole('heading', { name: 'Próximos prazos' })
    const itens = within(prazos.closest('section')).getAllByRole('listitem')

    // Só as entregas ainda abertas, do prazo mais próximo para o mais distante.
    expect(itens).toHaveLength(2)
    expect(itens[0]).toHaveTextContent('Capítulo 1')
    expect(itens[1]).toHaveTextContent('Capítulo 2')
    expect(await within(lateral).findByText('Correção solicitada')).toBeInTheDocument()
    expect(within(lateral).getByRole('link', { name: 'Ver todos os avisos' })).toHaveAttribute(
      'href',
      '/aluno/avisos',
    )
  })

  it('em tela estreita, a coluna nem é montada', async () => {
    simularTela(false)
    abrirComoAluno()

    await screen.findByRole('region', { name: 'Caminho do TCC' })

    expect(screen.queryByRole('complementary', { name: 'Resumo' })).not.toBeInTheDocument()
  })
})

describe('Coluna lateral do orientador (extra)', () => {
  it('mostra o que pede ação, os prazos dos orientandos e os avisos', async () => {
    simularTela(true)
    localStorage.setItem('sgtcc.usuario', JSON.stringify(ORIENTADOR))
    localStorage.setItem('sgtcc.access', 'token-de-teste')
    const linha = (id, nome, prazo, extras = {}) => ({
      id,
      aluno: { id, nome },
      tema: { id, titulo: `Tema de ${nome}`, status: 'aprovado' },
      fase_atual: 'Metodologia',
      estado: { codigo: 'aprovado', rotulo: 'Tema aprovado' },
      progresso: { concluidas: 0, total: 0 },
      prazo,
      prazo_vencido: false,
      aguarda_avaliacao_de_tema: false,
      entrega_para_revisao: null,
      entrega_para_comentario: null,
      entrega_para_banca: null,
      ...extras,
    })
    vi.spyOn(api, 'get').mockImplementation((url) =>
      Promise.resolve({
        data:
          url === '/orientandos/'
            ? [
                linha(1, 'Ana', '2098-12-01'),
                linha(2, 'Bruno', '2026-01-10', { prazo_vencido: true, aguarda_avaliacao_de_tema: true }),
              ]
            : { nao_lidos: 1, avisos: [AVISO] },
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

    const lateral = await screen.findByRole('complementary', { name: 'Resumo' })
    const prazos = await within(lateral).findByRole('heading', { name: 'Próximos prazos' })
    const itens = within(prazos.closest('section')).getAllByRole('listitem')

    expect(within(lateral).getByText('1 tema a avaliar')).toBeInTheDocument()
    expect(itens[0]).toHaveTextContent('Bruno') // o vencido vem primeiro
    expect(itens[0]).toHaveTextContent('vencido')
    expect(itens[1]).toHaveTextContent('Ana')
    expect(await within(lateral).findByText('Correção solicitada')).toBeInTheDocument()
  })
})

describe('Resumo das entregas por estado (extra)', () => {
  it('conta por estado, na ordem do fluxo, sem estados vazios', () => {
    render(<ResumoDasEntregas entregas={ENTREGAS} />)

    const itens = screen.getAllByRole('listitem').map((li) => li.textContent)

    expect(itens).toEqual(['Rascunho1', 'Em revisão1', 'Concluída1'])
  })

  it('sem entregas, não aparece', () => {
    const { container } = render(<ResumoDasEntregas entregas={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('aparece no Meu TCC, ao lado dos atalhos', async () => {
    simularTela(false)
    abrirComoAluno()

    expect(await screen.findByRole('region', { name: 'Entregas por estado' })).toBeInTheDocument()
  })
})

describe('Visual achatado (extra)', () => {
  it('os cartões não têm sombra: só um fio de borda', () => {
    expect(CSS).toMatch(/--sombra-leve:\s*none;/)
  })

  it('o fundo tem uma pauta de caderno nos dois temas', () => {
    expect(CSS).toMatch(/--pauta:\s*rgba\(29, 27, 25/)
    expect(CSS).toMatch(/--pauta:\s*rgba\(255, 255, 255/)
    expect(CSS).toMatch(/repeating-linear-gradient\([^)]*var\(--pauta\)/)
  })

  it('o cabeçalho da página é editorial, sem caixa nem degradê', () => {
    // Vale a última regra do arquivo: as anteriores foram trocadas nesta rodada.
    const regras = [...CSS.matchAll(/\n\.cabecalho-pagina\s*\{([^}]*)\}/g)].map((m) => m[1])
    const vigente = regras.join('\n')
    expect(vigente).toMatch(/border-radius:\s*0;/)
    expect(vigente).toMatch(/box-shadow:\s*none;/)
    expect(regras.at(-1)).toMatch(/background:\s*var\(--bg-app\)/)
  })
})
