import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import api from '../api'
import { AuthProvider } from '../auth'
import HistoricoVersoes from '../pages/aluno/HistoricoVersoes'
import LinhaDoTempo from '../pages/aluno/LinhaDoTempo'

const ALUNO = { id: 1, nome: 'Lucas Andrade', email: 'lucas@aluno.edu.br', perfil: 'aluno' }

function entrarComoAluno() {
  localStorage.setItem('sgtcc.usuario', JSON.stringify(ALUNO))
  localStorage.setItem('sgtcc.access', 'token-de-teste')
}

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  entrarComoAluno()
})

afterEach(() => {
  cleanup()
  localStorage.clear()
})

it('US07: mostra todas as versões e permite abrir uma versão antiga', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: [
      { id: 1, numero: 1, nome_original: 'referencial-v1.pdf', data_envio: '2026-10-01T12:00:00Z', arquivo_url: 'https://arquivos.test/v1.pdf' },
      { id: 2, numero: 2, nome_original: 'referencial-v2.pdf', data_envio: '2026-10-05T12:00:00Z', arquivo_url: 'https://arquivos.test/v2.pdf' },
    ],
  })

  render(
    <AuthProvider><MemoryRouter initialEntries={['/aluno/entregas/7/versoes']}><Routes>
      <Route path="/aluno/entregas/:entregaId/versoes" element={<HistoricoVersoes />} />
    </Routes></MemoryRouter></AuthProvider>,
  )

  expect(await screen.findByText('Versão 1')).toBeInTheDocument()
  expect(screen.getByText('Versão 2')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Abrir versão 1/ })).toHaveAttribute('href', 'https://arquivos.test/v1.pdf')
  expect(api.get).toHaveBeenCalledWith('/entregas/7/versoes/')
})

it('US16: mostra os eventos com data, tipo e descrição', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: [{ id: 1, tipo: 'upload', descricao: 'Versão 1 enviada em "Introdução".', data_hora: '2026-10-02T14:30:00Z' }],
  })

  render(
    <AuthProvider><MemoryRouter><Routes>
      <Route path="*" element={<LinhaDoTempo />} />
    </Routes></MemoryRouter></AuthProvider>,
  )

  expect(await screen.findByText('Versão enviada')).toBeInTheDocument()
  expect(screen.getByText('Versão 1 enviada em "Introdução".')).toBeInTheDocument()
  expect(api.get).toHaveBeenCalledWith('/eventos/')
})
