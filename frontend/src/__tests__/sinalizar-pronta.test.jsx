/**
 * Teste de fumaça da US08 (Sprint 4): o botão "Sinalizar pronta" na lista de entregas.
 *
 * Quem decide se uma entrega pode ser sinalizada é a API (`pode_sinalizar`, RN04);
 * a tela só mostra o botão quando ela diz que sim.
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import api from '../api'
import { AuthProvider } from '../auth'
import AreaAluno from '../pages/aluno/AreaAluno'
import Entregas from '../pages/aluno/Entregas'
import MeuTCC from '../pages/aluno/MeuTCC'

const ALUNO = { id: 1, nome: 'Lucas Andrade', email: 'lucas@aluno.edu.br', perfil: 'aluno' }

const COM_VERSAO = {
  id: 5, titulo: 'Referencial teórico', estado: 'rascunho', prazo: '2026-10-24',
  atrasada: false, pode_sinalizar: true,
}
const SEM_VERSAO = {
  id: 6, titulo: 'Metodologia', estado: 'rascunho', prazo: '2026-11-07',
  atrasada: false, pode_sinalizar: false,
}
const JA_SINALIZADA = {
  id: 7, titulo: 'Cronograma', estado: 'pronto_para_revisao', prazo: '2026-11-21',
  atrasada: false, pode_sinalizar: false,
}

function tccComEntregas(entregas) {
  return {
    id: 1,
    aluno: ALUNO,
    orientador: { id: 2, nome: 'Prof. Marcos Ribeiro' },
    tema: {
      id: 9, titulo: 'Sistema de gestão de TCC', descricao: 'Plataforma web.',
      status: 'aprovado', justificativa_ajuste: '',
      data_proposta: '2026-08-20T12:00:00Z', data_aprovacao: '2026-08-25T12:00:00Z',
    },
    entregas,
  }
}

function renderizar(entregas) {
  localStorage.setItem('sgtcc.usuario', JSON.stringify(ALUNO))
  localStorage.setItem('sgtcc.access', 'token-de-teste')
  const get = vi.spyOn(api, 'get').mockImplementation((caminho) => {
    if (caminho === '/meu-tcc/') return Promise.resolve({ data: tccComEntregas(entregas) })
    return Promise.reject(new Error(`rota inesperada: ${caminho}`))
  })
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/aluno/entregas']}>
        <Routes>
          <Route path="/aluno" element={<AreaAluno />}>
            <Route index element={<MeuTCC />} />
            <Route path="entregas" element={<Entregas />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
  return get
}

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('Sinalizar pronta (US08)', () => {
  it('mostra o botão só nas entregas que a API diz que podem ser sinalizadas', async () => {
    renderizar([COM_VERSAO, SEM_VERSAO, JA_SINALIZADA])

    expect(await screen.findByText('Referencial teórico')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Sinalizar Referencial teórico como pronta' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Sinalizar Metodologia/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Sinalizar Cronograma/ })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Sinalizar .* como pronta/ })).toHaveLength(1)
  })

  it('sinaliza, confirma que o orientador foi avisado e recarrega a lista (CA1 e CA3)', async () => {
    const get = renderizar([COM_VERSAO])
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} })

    await userEvent.click(
      await screen.findByRole('button', { name: 'Sinalizar Referencial teórico como pronta' }),
    )

    await waitFor(() => expect(post).toHaveBeenCalledWith('/entregas/5/sinalizar-pronta/'))
    expect(
      await screen.findByText('"Referencial teórico" sinalizada. Seu orientador foi avisado.'),
    ).toBeInTheDocument()
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2)) // carga inicial + recarga
  })

  it('mostra a mensagem da API quando a sinalização é recusada', async () => {
    renderizar([COM_VERSAO])
    vi.spyOn(api, 'post').mockRejectedValue({
      response: { data: { detail: 'Só é possível sinalizar uma entrega em "rascunho".' } },
    })

    await userEvent.click(
      await screen.findByRole('button', { name: 'Sinalizar Referencial teórico como pronta' }),
    )

    expect(await screen.findByText(/Só é possível sinalizar uma entrega/)).toBeInTheDocument()
    expect(screen.queryByText(/foi avisado/)).not.toBeInTheDocument()
  })
})
