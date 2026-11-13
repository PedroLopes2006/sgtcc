/**
 * US14 — Painel do orientador (testes de fumaça).
 *
 * CA1: orientandos ativos com tema, fase e prazo.
 * CA2: prazo vencido destacado visualmente — data em vermelho e um ponto
 * vermelho próprio ao lado do prazo, separado do ponto do estado.
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import api from '../api'
import { AuthProvider } from '../auth'
import Orientandos from '../pages/orientador/Orientandos'

const ORIENTADOR = { id: 2, nome: 'Marcos Ribeiro', email: 'm@prof.edu.br', perfil: 'orientador' }

function linha({ id, nome, titulo, fase, prazo, vencido, estado }) {
  return {
    id,
    aluno: { id, nome },
    tema: { id, titulo, status: 'aprovado' },
    entregas: [],
    fase_atual: fase,
    estado,
    progresso: { concluidas: 0, total: 1 },
    prazo,
    prazo_vencido: vencido,
    aguarda_avaliacao_de_tema: false,
    entrega_para_revisao: null,
  }
}

const EM_DIA = linha({
  id: 1,
  nome: 'Carla Dias',
  titulo: 'Ensino de lógica com jogos',
  fase: 'Introdução',
  prazo: '2026-12-20',
  vencido: false,
  estado: { codigo: 'rascunho', rotulo: 'Rascunho' },
})

const VENCIDA = linha({
  id: 2,
  nome: 'Lucas Andrade',
  titulo: 'Sistema de gestão de TCC',
  fase: 'Metodologia',
  prazo: '2026-09-10',
  vencido: true,
  estado: { codigo: 'pronto_para_revisao', rotulo: 'Pronto para revisão' },
})

function renderizarPainel(linhas) {
  localStorage.setItem('sgtcc.usuario', JSON.stringify(ORIENTADOR))
  localStorage.setItem('sgtcc.access', 'token-de-teste')
  vi.spyOn(api, 'get').mockResolvedValue({ data: linhas })
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/orientador']}>
        <Routes>
          <Route path="/orientador" element={<Orientandos />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

async function linhaDe(nome) {
  return (await screen.findByText(nome)).closest('tr')
}

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('Painel do orientador (US14)', () => {
  it('mostra tema, fase e prazo de cada orientando ativo (CA1)', async () => {
    renderizarPainel([EM_DIA, VENCIDA])

    const carla = await linhaDe('Carla Dias')
    expect(within(carla).getByText('Ensino de lógica com jogos')).toBeInTheDocument()
    expect(within(carla).getByText('Introdução')).toBeInTheDocument()
    expect(within(carla).getByText('20 dez')).toBeInTheDocument()

    const lucas = await linhaDe('Lucas Andrade')
    expect(within(lucas).getByText('Sistema de gestão de TCC')).toBeInTheDocument()
    expect(within(lucas).getByText('Metodologia')).toBeInTheDocument()
    expect(within(lucas).getByText('10 set')).toBeInTheDocument()
  })

  it('destaca o prazo vencido com o ponto vermelho e a data em vermelho (CA2)', async () => {
    renderizarPainel([EM_DIA, VENCIDA])

    const lucas = await linhaDe('Lucas Andrade')
    const marcador = within(lucas).getByRole('img', { name: 'Prazo vencido' })
    expect(marcador).toHaveClass('marcador-vencido')
    expect(within(lucas).getByText('10 set')).toHaveClass('prazo-vencido')
  })

  it('não marca o prazo em dia (CA2)', async () => {
    renderizarPainel([EM_DIA])

    const carla = await linhaDe('Carla Dias')
    expect(within(carla).queryByRole('img', { name: 'Prazo vencido' })).not.toBeInTheDocument()
    expect(within(carla).getByText('20 dez')).not.toHaveClass('prazo-vencido')
  })

  it('o marcador é separado do ponto do estado, que mantém a cor do estado', async () => {
    renderizarPainel([VENCIDA])

    const lucas = await linhaDe('Lucas Andrade')
    const pontoDoEstado = lucas.querySelector('.estado .ponto')
    expect(pontoDoEstado).toHaveClass('pronto_para_revisao')
    expect(pontoDoEstado).not.toHaveClass('marcador-vencido')
    expect(lucas.querySelectorAll('.marcador-vencido')).toHaveLength(1)
  })

  it('mostra o aviso quando não há orientandos', async () => {
    renderizarPainel([])
    expect(await screen.findByText('Você ainda não tem orientandos')).toBeInTheDocument()
  })
})
