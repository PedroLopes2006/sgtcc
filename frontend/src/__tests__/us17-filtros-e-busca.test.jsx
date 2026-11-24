/**
 * US17 — filtros e busca nas telas.
 *
 * CA1: Entregas, Linha do tempo, Avisos, Fila de revisão e históricos têm filtros e busca.
 * CA2: sem resultados, a tela mostra uma mensagem e a opção de limpar os filtros.
 * CA3: o filtro só esconde itens na tela; não muda dados nem acessos (nenhum POST/PUT).
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import api from '../api'
import { AuthProvider } from '../auth'
import { casaComBusca, categoriaDoEvento } from '../filtros'
import Avisos from '../pages/Avisos'
import Entregas from '../pages/aluno/Entregas'
import HistoricoVersoes from '../pages/aluno/HistoricoVersoes'
import LinhaDoTempo from '../pages/aluno/LinhaDoTempo'
import HistoricoOrientando from '../pages/orientador/HistoricoOrientando'

const ALUNO = { id: 1, nome: 'Lucas Andrade', email: 'l@aluno.edu.br', perfil: 'aluno' }
const ORIENTADOR = { id: 2, nome: 'Marcos Ribeiro', email: 'm@prof.edu.br', perfil: 'orientador' }

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

describe('regras de filtro', () => {
  it('a busca ignora acentos e maiúsculas, e sem termo tudo passa', () => {
    expect(casaComBusca('INTRODUCAO', 'Introdução ao tema')).toBe(true)
    expect(casaComBusca('  ', 'qualquer coisa')).toBe(true)
    expect(casaComBusca('xyz', 'Introdução', 'Metodologia')).toBe(false)
  })

  it('agrupa os tipos de evento por assunto', () => {
    expect(categoriaDoEvento('tema_aprovado')).toBe('tema')
    expect(categoriaDoEvento('upload')).toBe('entregas')
    expect(categoriaDoEvento('correcao_solicitada')).toBe('entregas')
    expect(categoriaDoEvento('trabalho_final_enviado')).toBe('trabalho_final')
    expect(categoriaDoEvento('troca_orientador')).toBe('orientador')
  })
})

// ---------------------------------------------------------------- Entregas

function entrega(id, titulo, estado) {
  return {
    id,
    titulo,
    estado,
    prazo: '2026-12-20',
    atrasada: false,
    aceita_versao: false,
    pode_sinalizar: false,
    versao_atual: null,
    ultimo_comentario: null,
    comentarios: [],
  }
}

function telaDeEntregas(entregas) {
  entrarComo(ALUNO)
  vi.spyOn(api, 'get').mockResolvedValue({ data: [] })
  const post = vi.spyOn(api, 'post')
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/aluno/entregas']}>
        <Routes>
          <Route
            path="/aluno"
            element={<Outlet context={{ tcc: { tema: { status: 'aprovado' }, entregas }, recarregar: vi.fn() }} />}
          >
            <Route path="entregas" element={<Entregas />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
  return post
}

describe('Entregas', () => {
  const ENTREGAS = [
    entrega(1, 'Introdução', 'concluida'),
    entrega(2, 'Metodologia', 'em_revisao'),
    entrega(3, 'Referencial teórico', 'correcao_solicitada'),
  ]

  it('CA1: filtra por situação e mostra a quantidade de cada filtro', async () => {
    telaDeEntregas(ENTREGAS)
    expect(await screen.findByText('Introdução')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Concluídas/ }))
    expect(screen.getByText('Introdução')).toBeInTheDocument()
    expect(screen.queryByText('Metodologia')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Correção solicitada/ }))
    expect(screen.getByText('Referencial teórico')).toBeInTheDocument()
    expect(screen.queryByText('Introdução')).not.toBeInTheDocument()
  })

  it('CA1: busca pelo título, sem diferenciar acentos', async () => {
    telaDeEntregas(ENTREGAS)
    await userEvent.type(await screen.findByLabelText('Buscar entrega'), 'referencial teorico')
    expect(screen.getByText('Referencial teórico')).toBeInTheDocument()
    expect(screen.queryByText('Metodologia')).not.toBeInTheDocument()
  })

  it('CA2 e CA3: sem resultado mostra a mensagem, "Limpar filtros" volta a lista e nada é gravado', async () => {
    const post = telaDeEntregas(ENTREGAS)
    await userEvent.type(await screen.findByLabelText('Buscar entrega'), 'zzz')
    expect(screen.getByText('Nenhum resultado')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    expect(screen.getByText('Introdução')).toBeInTheDocument()
    expect(screen.getByText('Metodologia')).toBeInTheDocument()
    expect(screen.getByLabelText('Buscar entrega')).toHaveValue('')
    expect(post).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------- Linha do tempo

const EVENTOS = [
  { id: 3, tipo: 'trabalho_final_enviado', descricao: 'Versão 1 do trabalho final enviada para avaliação.', data_hora: '2026-11-20T12:00:00Z', usuario_relacionado: { id: 1, nome: 'Lucas Andrade' } },
  { id: 2, tipo: 'upload', descricao: 'Versão 2 de "Metodologia" enviada.', data_hora: '2026-11-10T12:00:00Z', usuario_relacionado: { id: 1, nome: 'Lucas Andrade' } },
  { id: 1, tipo: 'tema_aprovado', descricao: 'Tema aprovado pelo orientador.', data_hora: '2026-11-01T12:00:00Z', usuario_relacionado: { id: 2, nome: 'Marcos Ribeiro' } },
]

function telaDaLinhaDoTempo() {
  entrarComo(ALUNO)
  vi.spyOn(api, 'get').mockResolvedValue({ data: EVENTOS })
  render(
    <AuthProvider>
      <MemoryRouter>
        <LinhaDoTempo />
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('Linha do tempo', () => {
  it('CA1: filtra por assunto', async () => {
    telaDaLinhaDoTempo()
    expect(await screen.findByText(/Tema aprovado pelo orientador/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^Trabalho final/ }))
    expect(screen.getByText(/trabalho final enviada/)).toBeInTheDocument()
    expect(screen.queryByText(/Tema aprovado pelo orientador/)).not.toBeInTheDocument()
    expect(screen.getByText('1 registro')).toBeInTheDocument()
  })

  it('CA1: busca no texto do evento', async () => {
    telaDaLinhaDoTempo()
    await userEvent.type(await screen.findByLabelText('Buscar na linha do tempo'), 'metodologia')
    expect(screen.getByText(/Versão 2 de/)).toBeInTheDocument()
    expect(screen.queryByText(/Tema aprovado pelo orientador/)).not.toBeInTheDocument()
  })

  it('CA2: sem resultado, oferece limpar os filtros', async () => {
    telaDaLinhaDoTempo()
    await userEvent.type(await screen.findByLabelText('Buscar na linha do tempo'), 'zzz')
    expect(screen.getByText('Nenhum resultado')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    expect(screen.getByText(/Tema aprovado pelo orientador/)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------- Avisos

const AVISOS = {
  nao_lidos: 1,
  avisos: [
    { id: 2, tipo: 'correcao_solicitada', descricao: 'Correção pedida em "Metodologia".', data_hora: '2026-11-20T12:00:00Z', de: 'Marcos', entrega_id: 5, nao_lido: true },
    { id: 1, tipo: 'tema_aprovado', descricao: 'Seu tema foi aprovado.', data_hora: '2026-11-01T12:00:00Z', de: 'Marcos', entrega_id: null, nao_lido: false },
  ],
}

function telaDeAvisos() {
  entrarComo(ALUNO)
  vi.spyOn(api, 'get').mockResolvedValue({ data: AVISOS })
  vi.spyOn(api, 'post').mockResolvedValue({ data: {} })
  render(
    <AuthProvider>
      <MemoryRouter>
        <Avisos />
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('Avisos', () => {
  it('CA1: o filtro "Novos" esconde os já vistos', async () => {
    telaDeAvisos()
    expect(await screen.findByText('Seu tema foi aprovado.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^Novos/ }))
    expect(screen.getByText(/Correção pedida/)).toBeInTheDocument()
    expect(screen.queryByText('Seu tema foi aprovado.')).not.toBeInTheDocument()
  })

  it('CA1: busca no título e no texto do aviso', async () => {
    telaDeAvisos()
    await userEvent.type(await screen.findByLabelText('Buscar aviso'), 'tema')
    expect(screen.getByText('Seu tema foi aprovado.')).toBeInTheDocument()
    expect(screen.queryByText(/Correção pedida/)).not.toBeInTheDocument()
  })

  it('CA2: sem resultado, oferece limpar os filtros', async () => {
    telaDeAvisos()
    await userEvent.type(await screen.findByLabelText('Buscar aviso'), 'zzz')
    expect(screen.getByText('Nenhum resultado')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    expect(screen.getByText('Seu tema foi aprovado.')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------- Históricos

describe('Histórico de versões', () => {
  it('CA1 e CA2: busca por versão ou arquivo e limpa quando não acha', async () => {
    entrarComo(ALUNO)
    vi.spyOn(api, 'get').mockResolvedValue({
      data: [
        { id: 1, numero: 1, nome_original: 'rascunho.pdf', data_envio: '2026-10-01T12:00:00Z', arquivo_url: 'https://a.test/1.pdf' },
        { id: 2, numero: 2, nome_original: 'revisado.pdf', data_envio: '2026-10-05T12:00:00Z', arquivo_url: 'https://a.test/2.pdf' },
      ],
    })
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/aluno/entregas/7/versoes']}>
          <Routes>
            <Route path="/aluno/entregas/:entregaId/versoes" element={<HistoricoVersoes />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )

    await userEvent.type(await screen.findByLabelText('Buscar versão'), 'revisado')
    expect(screen.getByText('Versão 2')).toBeInTheDocument()
    expect(screen.queryByText('Versão 1')).not.toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText('Buscar versão'))
    await userEvent.type(screen.getByLabelText('Buscar versão'), 'zzz')
    expect(screen.getByText('Nenhum resultado')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    expect(screen.getByText('Versão 1')).toBeInTheDocument()
  })
})

describe('Histórico do orientando', () => {
  it('CA1: a busca alcança entregas, comentários e eventos', async () => {
    entrarComo(ORIENTADOR)
    vi.spyOn(api, 'get').mockResolvedValue({
      data: {
        aluno: { id: 1, nome: 'Lucas Andrade' },
        tema: { titulo: 'Gestão de TCC', descricao: 'Sistema web.' },
        orientacoes: [],
        entregas: [
          { id: 1, titulo: 'Introdução', estado: 'concluida', prazo: '2026-10-10', versoes: [], comentarios: [] },
          {
            id: 2, titulo: 'Metodologia', estado: 'em_revisao', prazo: '2026-11-10', versoes: [],
            comentarios: [{ id: 1, autor: { nome: 'Marcos' }, texto: 'Detalhe a amostra.', versao: 1, data_criacao: '2026-11-02T12:00:00Z' }],
          },
        ],
        eventos: [{ id: 1, descricao: 'Tema aprovado.', data_hora: '2026-10-01T12:00:00Z' }],
      },
    })
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/orientador/orientandos/3/historico']}>
          <Routes>
            <Route path="/orientador/orientandos/:tccId/historico" element={<HistoricoOrientando />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )

    await userEvent.type(await screen.findByLabelText('Buscar no histórico'), 'amostra')
    expect(screen.getByRole('heading', { name: 'Metodologia' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Introdução' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Tema aprovado\./)).not.toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText('Buscar no histórico'))
    await userEvent.type(screen.getByLabelText('Buscar no histórico'), 'zzz')
    expect(screen.getByText('Nenhum resultado')).toBeInTheDocument()
    expect(within(screen.getByRole('main')).getByRole('button', { name: 'Limpar filtros' })).toBeInTheDocument()
  })
})
