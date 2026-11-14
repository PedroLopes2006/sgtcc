/**
 * EXTRA — fora dos requisitos do documento: o usuário troca o próprio e-mail de login
 * na tela de Perfil, pedindo a senha atual (RNF03).
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import api from '../api'
import { AuthProvider } from '../auth'
import AreaAluno from '../pages/aluno/AreaAluno'
import PerfilAluno from '../pages/aluno/PerfilAluno'

const ALUNO = { id: 1, nome: 'Lucas Andrade', email: 'lucas@aluno.edu.br', perfil: 'aluno' }

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

afterEach(() => {
  cleanup()
  localStorage.clear()
})

function abrirPerfil() {
  localStorage.setItem('sgtcc.usuario', JSON.stringify(ALUNO))
  localStorage.setItem('sgtcc.access', 'token-de-teste')
  vi.spyOn(api, 'get').mockImplementation((url) =>
    Promise.resolve({
      data:
        url === '/auth/eu/'
          ? { ...ALUNO, telegram_chat_id: null, data_cadastro: '2026-08-14T12:00:00Z' }
          : url === '/avisos/'
            ? { nao_lidos: 0, avisos: [] }
            : { tcc: null },
    }),
  )
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/aluno/perfil']}>
        <Routes>
          <Route path="/aluno" element={<AreaAluno />}>
            <Route path="perfil" element={<PerfilAluno />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('Trocar o e-mail no Perfil (extra)', () => {
  it('envia o novo e-mail com a senha atual e mostra o novo na tela e no navegador', async () => {
    abrirPerfil()
    const post = vi
      .spyOn(api, 'post')
      .mockResolvedValue({ data: { ...ALUNO, email: 'novo@aluno.edu.br' } })

    await userEvent.click(await screen.findByRole('button', { name: 'Alterar e-mail' }))
    await userEvent.type(screen.getByLabelText('Novo e-mail'), 'novo@aluno.edu.br')
    await userEvent.type(screen.getByLabelText('Confirme com a sua senha'), 'senhaForte123')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar e-mail' }))

    expect(post).toHaveBeenCalledWith('/auth/alterar-email/', {
      email: 'novo@aluno.edu.br',
      senha_atual: 'senhaForte123',
    })
    expect(await screen.findByText('E-mail atualizado. Use o novo para entrar.')).toBeInTheDocument()
    expect(screen.getAllByText('novo@aluno.edu.br').length).toBeGreaterThan(0)
    expect(JSON.parse(localStorage.getItem('sgtcc.usuario')).email).toBe('novo@aluno.edu.br')
  })

  it('mostra o erro da API, como senha errada ou e-mail já usado, e mantém o formulário', async () => {
    abrirPerfil()
    vi.spyOn(api, 'post').mockRejectedValue({
      response: { data: { email: 'Já existe uma conta com este e-mail.' } },
    })

    await userEvent.click(await screen.findByRole('button', { name: 'Alterar e-mail' }))
    await userEvent.type(screen.getByLabelText('Novo e-mail'), 'ana@aluno.edu.br')
    await userEvent.type(screen.getByLabelText('Confirme com a sua senha'), 'senhaForte123')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar e-mail' }))

    expect(await screen.findByText('Já existe uma conta com este e-mail.')).toBeInTheDocument()
    expect(screen.getByLabelText('Novo e-mail')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('sgtcc.usuario')).email).toBe('lucas@aluno.edu.br')
  })

  it('cancelar descarta o que foi digitado e não chama a API', async () => {
    abrirPerfil()
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} })

    await userEvent.click(await screen.findByRole('button', { name: 'Alterar e-mail' }))
    await userEvent.type(screen.getByLabelText('Novo e-mail'), 'qualquer@x.com')
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByLabelText('Novo e-mail')).not.toBeInTheDocument()
    expect(post).not.toHaveBeenCalled()
    expect(screen.getAllByText('lucas@aluno.edu.br').length).toBeGreaterThan(0)
  })

  it('o campo é de e-mail e a senha é obrigatória', async () => {
    abrirPerfil()

    await userEvent.click(await screen.findByRole('button', { name: 'Alterar e-mail' }))

    expect(screen.getByLabelText('Novo e-mail')).toHaveAttribute('type', 'email')
    expect(screen.getByLabelText('Confirme com a sua senha')).toBeRequired()
  })
})
