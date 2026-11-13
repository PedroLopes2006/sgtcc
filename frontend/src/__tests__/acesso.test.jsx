/**
 * Telas de entrar e criar conta: painel de marca e o comportamento dos
 * formulários (US01 CA1 a CA4).
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
import Cadastro from '../pages/Cadastro'
import Login from '../pages/Login'

// O Vitest roda na raiz do frontend; o jsdom não dá uma URL de arquivo para este módulo.
const CSS = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8')

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

afterEach(() => {
  cleanup()
  localStorage.clear()
})

function renderizar(rota) {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={[rota]}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/cadastro" element={<Cadastro />} />
          <Route path="/aluno" element={<p>Painel do aluno</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('Painel de marca', () => {
  it('mostra o nome do sistema e três frases sobre ele', () => {
    renderizar('/login')

    const painel = screen.getByRole('region', { name: 'Sobre o SGTCC' })

    expect(within(painel).getByText('Sistema de Gestão de TCC')).toBeInTheDocument()
    expect(within(painel).getAllByRole('listitem')).toHaveLength(3)
  })

  it('aparece também na tela de criar conta', () => {
    renderizar('/cadastro')
    expect(screen.getByRole('region', { name: 'Sobre o SGTCC' })).toBeInTheDocument()
  })

  it('some no celular e aparece só em telas largas', () => {
    expect(CSS).toMatch(/\.painel-marca\s*\{\s*display:\s*none;\s*\}/)
    expect(CSS).toMatch(/@media \(min-width: 900px\)[\s\S]*\.painel-marca\s*\{\s*display:\s*flex/)
  })
})

describe('Formulário de entrar', () => {
  it('entra e vai para o painel do perfil (US01 CA3)', async () => {
    vi.spyOn(api, 'post').mockResolvedValue({
      data: {
        access: 'a', refresh: 'r',
        usuario: { id: 1, nome: 'Lucas', email: 'lucas@aluno.edu.br', perfil: 'aluno' },
      },
    })
    renderizar('/login')

    await userEvent.type(screen.getByLabelText('E-mail'), 'lucas@aluno.edu.br')
    await userEvent.type(screen.getByLabelText('Senha'), 'senhaForte123')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText('Painel do aluno')).toBeInTheDocument()
  })

  it('mostra um erro genérico sem revelar se o e-mail existe (US01 CA4)', async () => {
    vi.spyOn(api, 'post').mockRejectedValue({
      response: { data: { detail: 'E-mail ou senha inválidos.' } },
    })
    renderizar('/login')

    await userEvent.type(screen.getByLabelText('E-mail'), 'alguem@aluno.edu.br')
    await userEvent.type(screen.getByLabelText('Senha'), 'errada123')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText('E-mail ou senha inválidos.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled())
  })

  it('o botão mostra "Entrando…" e fica desabilitado enquanto espera', async () => {
    vi.spyOn(api, 'post').mockReturnValue(new Promise(() => {}))
    renderizar('/login')

    await userEvent.type(screen.getByLabelText('E-mail'), 'lucas@aluno.edu.br')
    await userEvent.type(screen.getByLabelText('Senha'), 'senhaForte123')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('button', { name: 'Entrando…' })).toBeDisabled()
  })

  it('leva à tela de criar conta', () => {
    renderizar('/login')
    expect(screen.getByRole('link', { name: 'Criar conta' })).toHaveAttribute('href', '/cadastro')
  })
})

describe('Formulário de criar conta', () => {
  it('exige senha com 8 caracteres e começa com o perfil Aluno', () => {
    renderizar('/cadastro')

    expect(screen.getByLabelText('Senha')).toHaveAttribute('minLength', '8')
    expect(screen.getByRole('button', { name: 'Aluno' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('leva à tela de entrar', () => {
    renderizar('/cadastro')
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/login')
  })
})
