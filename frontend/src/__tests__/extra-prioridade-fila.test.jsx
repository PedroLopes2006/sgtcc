/**
 * EXTRA — prioridade na Fila de revisão (protótipo do Figma).
 *
 * Fora dos requisitos do documento: não há RF, RN nem US para ela, e a US09 só
 * pede a lista e a mensagem de fila vazia. O orientador marca cada item como
 * alta, média, baixa ou sem prioridade; a marcação é só dele e não muda a ordem.
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import api from '../api'
import { AuthProvider } from '../auth'
import FilaRevisao from '../pages/orientador/FilaRevisao'

const ORIENTADOR = { id: 2, nome: 'Marcos Ribeiro', email: 'm@prof.edu.br', perfil: 'orientador' }

function item(id, nome, titulo, prioridade = null) {
  return {
    id,
    titulo,
    estado: 'pronto_para_revisao',
    prazo: '2026-12-20',
    atrasada: false,
    tcc: id,
    aluno: { id, nome },
    tema: `Tema de ${nome}`,
    versao_atual: { id, numero: 1, nome_original: 'v1.pdf', arquivo_url: 'http://x/v1.pdf' },
    pronta_em: new Date().toISOString(),
    prioridade,
  }
}

function renderizar(itens) {
  localStorage.setItem('sgtcc.usuario', JSON.stringify(ORIENTADOR))
  localStorage.setItem('sgtcc.access', 'token-de-teste')
  vi.spyOn(api, 'get').mockImplementation((url) =>
    Promise.resolve({ data: url === '/fila-revisao/' ? itens : [] }),
  )
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/orientador/fila']}>
        <Routes>
          <Route path="/orientador/fila" element={<FilaRevisao />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('Prioridade na fila (extra)', () => {
  it('mostra a prioridade já marcada e "Sem prioridade" nas demais', async () => {
    renderizar([item(5, 'Ana Lima', 'Metodologia', 'alta'), item(6, 'Lucas Andrade', 'Introdução')])

    expect(await screen.findByLabelText('Prioridade de Metodologia')).toHaveValue('alta')
    expect(screen.getByLabelText('Prioridade de Introdução')).toHaveValue('sem_prioridade')
  })

  it('oferece as quatro opções do protótipo', async () => {
    renderizar([item(5, 'Ana Lima', 'Metodologia')])

    const seletor = await screen.findByLabelText('Prioridade de Metodologia')
    expect(within(seletor).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Sem prioridade',
      'Prioridade alta',
      'Prioridade média',
      'Prioridade baixa',
    ])
  })

  it('marca a prioridade pela API e mostra a nova escolha', async () => {
    renderizar([item(5, 'Ana Lima', 'Metodologia')])
    const put = vi.spyOn(api, 'put').mockResolvedValue({ data: { prioridade: 'media' } })

    await userEvent.selectOptions(await screen.findByLabelText('Prioridade de Metodologia'), 'media')

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/entregas/5/prioridade/', { prioridade: 'media' }),
    )
    await waitFor(() => expect(screen.getByLabelText('Prioridade de Metodologia')).toHaveValue('media'))
  })

  it('"Sem prioridade" remove a marcação', async () => {
    renderizar([item(5, 'Ana Lima', 'Metodologia', 'baixa')])
    const put = vi.spyOn(api, 'put').mockResolvedValue({ data: { prioridade: null } })

    await userEvent.selectOptions(
      await screen.findByLabelText('Prioridade de Metodologia'),
      'sem_prioridade',
    )

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/entregas/5/prioridade/', { prioridade: 'sem_prioridade' }),
    )
    await waitFor(() =>
      expect(screen.getByLabelText('Prioridade de Metodologia')).toHaveValue('sem_prioridade'),
    )
  })

  it('mostra o erro da API e mantém a escolha anterior', async () => {
    renderizar([item(5, 'Ana Lima', 'Metodologia', 'alta')])
    vi.spyOn(api, 'put').mockRejectedValue({
      response: { data: { detail: 'Você não é o orientador ativo deste TCC.' } },
    })

    await userEvent.selectOptions(await screen.findByLabelText('Prioridade de Metodologia'), 'baixa')

    expect(await screen.findByText('Você não é o orientador ativo deste TCC.')).toBeInTheDocument()
    expect(screen.getByLabelText('Prioridade de Metodologia')).toHaveValue('alta')
  })

  it('a marcação não muda a ordem dos itens', async () => {
    renderizar([item(5, 'Ana Lima', 'Metodologia'), item(6, 'Lucas Andrade', 'Introdução')])
    vi.spyOn(api, 'put').mockResolvedValue({ data: { prioridade: 'alta' } })

    await userEvent.selectOptions(await screen.findByLabelText('Prioridade de Introdução'), 'alta')
    await waitFor(() => expect(screen.getByLabelText('Prioridade de Introdução')).toHaveValue('alta'))

    const linhas = screen.getAllByRole('listitem')
    expect(linhas[0]).toHaveTextContent('Ana Lima · Metodologia')
    expect(linhas[1]).toHaveTextContent('Lucas Andrade · Introdução')
  })
})
