/**
 * Testes de fumaça das telas do Sprint 3.
 *
 * Não substituem teste manual de layout — garantem que cada tela monta, que
 * os textos combinados no protótipo estão lá e que as regras visíveis das US
 * (botão desabilitado, justificativa obrigatória) valem na interface.
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import api from '../api'
import { AuthProvider } from '../auth'
import Cadastro from '../pages/Cadastro'
import Login from '../pages/Login'
import AreaAluno from '../pages/aluno/AreaAluno'
import Entregas from '../pages/aluno/Entregas'
import MeuTCC from '../pages/aluno/MeuTCC'
import Orientandos from '../pages/orientador/Orientandos'

const ALUNO = { id: 1, nome: 'Lucas Andrade', email: 'lucas@aluno.edu.br', perfil: 'aluno' }
const ORIENTADOR = { id: 2, nome: 'Marcos Ribeiro', email: 'm@prof.edu.br', perfil: 'orientador' }

function entrarComo(usuario) {
  localStorage.setItem('sgtcc.usuario', JSON.stringify(usuario))
  localStorage.setItem('sgtcc.access', 'token-de-teste')
}

function tccComTema(status, entregas = []) {
  return {
    id: 1,
    aluno: ALUNO,
    orientador: { id: 2, nome: 'Prof. Marcos Ribeiro' },
    tema: {
      id: 9,
      titulo: 'Sistema de gestão de TCC',
      descricao: 'Plataforma web para acompanhar entregas.',
      status,
      justificativa_ajuste: status === 'ajuste_solicitado' ? 'O escopo está amplo.' : '',
      data_proposta: '2026-08-20T12:00:00Z',
      data_aprovacao: status === 'aprovado' ? '2026-08-25T12:00:00Z' : null,
    },
    entregas,
  }
}

function renderizarAreaAluno(rotaInicial = '/aluno') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[rotaInicial]}>
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

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

afterEach(() => {
  // Com globals: false o Testing Library não registra a limpeza sozinho,
  // e o DOM de um teste vazaria para o seguinte.
  cleanup()
  localStorage.clear()
})

describe('Cadastro (US01)', () => {
  it('usa dois segmentos para o perfil, com Aluno marcado por padrão', async () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <Cadastro />
        </MemoryRouter>
      </AuthProvider>,
    )

    const aluno = screen.getByRole('button', { name: 'Aluno' })
    const orientador = screen.getByRole('button', { name: 'Orientador' })
    expect(aluno).toHaveAttribute('aria-pressed', 'true')
    expect(orientador).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(orientador)
    expect(orientador).toHaveAttribute('aria-pressed', 'true')
    expect(aluno).toHaveAttribute('aria-pressed', 'false')
  })

  it('leva ao login com aviso quando a conta nasce mas o login automático falha', async () => {
    // Regressão: o cadastro gravava a conta e dizia que falhou.
    vi.spyOn(api, 'post').mockImplementation((rota) =>
      rota === '/auth/registrar/'
        ? Promise.resolve({ data: { id: 7 } })
        : Promise.reject(new Error('Network Error')),
    )

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/cadastro']}>
          <Routes>
            <Route path="/cadastro" element={<Cadastro />} />
            <Route path="/login" element={<Login />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )

    await userEvent.type(screen.getByLabelText('Nome'), 'Pedro Lopes')
    await userEvent.type(screen.getByLabelText('E-mail'), 'pedro@aluno.edu.br')
    await userEvent.type(screen.getByLabelText('Senha'), 'TccSprint3!')
    await userEvent.click(screen.getByRole('button', { name: /criar conta/i }))

    expect(await screen.findByText('Conta criada. Entre com seu e-mail e senha.')).toBeInTheDocument()
    expect(screen.queryByText('Não foi possível criar a conta.')).not.toBeInTheDocument()
    expect(screen.getByLabelText('E-mail')).toHaveValue('pedro@aluno.edu.br')
  })
})

describe('Meu TCC (US03)', () => {
  it('mostra o aviso de que o orientador foi notificado quando o tema está proposto', async () => {
    entrarComo(ALUNO)
    vi.spyOn(api, 'get').mockResolvedValue({ data: tccComTema('proposto') })

    renderizarAreaAluno()

    expect(await screen.findByText('Tema proposto')).toBeInTheDocument()
    expect(
      screen.getByText('Seu orientador foi notificado e vai avaliar o tema.'),
    ).toBeInTheDocument()
  })

  it('no ajuste solicitado, edita tema e descrição na própria tela (CA4)', async () => {
    entrarComo(ALUNO)
    vi.spyOn(api, 'get').mockResolvedValue({ data: tccComTema('ajuste_solicitado') })

    renderizarAreaAluno()

    expect(await screen.findByText('Justificativa do orientador')).toBeInTheDocument()
    expect(screen.getByText('O escopo está amplo.')).toBeInTheDocument()
    expect(screen.getByLabelText('Tema')).toHaveValue('Sistema de gestão de TCC')
    expect(screen.getByRole('button', { name: 'Reenviar tema' })).toBeInTheDocument()
  })
})

describe('Entregas (US05)', () => {
  it('desabilita Nova entrega e explica o motivo quando o tema não foi aprovado (CA2)', async () => {
    entrarComo(ALUNO)
    vi.spyOn(api, 'get').mockResolvedValue({ data: tccComTema('proposto') })

    renderizarAreaAluno('/aluno/entregas')

    const botao = await screen.findByRole('button', { name: 'Nova entrega' })
    expect(botao).toBeDisabled()
    expect(
      screen.getByText('Você poderá criar entregas depois que o orientador aprovar o seu tema.'),
    ).toBeInTheDocument()
  })

  it('libera Nova entrega com o tema aprovado', async () => {
    entrarComo(ALUNO)
    vi.spyOn(api, 'get').mockResolvedValue({ data: tccComTema('aprovado') })

    renderizarAreaAluno('/aluno/entregas')

    expect(await screen.findByRole('button', { name: 'Nova entrega' })).toBeEnabled()
  })

  it('lista as entregas com prazo e estado', async () => {
    entrarComo(ALUNO)
    vi.spyOn(api, 'get').mockResolvedValue({
      data: tccComTema('aprovado', [
        {
          id: 1,
          titulo: 'Introdução',
          estado: 'concluida',
          prazo: '2026-10-10',
          atrasada: false,
        },
        {
          id: 2,
          titulo: 'Referencial teórico',
          estado: 'rascunho',
          prazo: '2026-10-24',
          atrasada: true,
        },
      ]),
    })

    renderizarAreaAluno('/aluno/entregas')

    expect(await screen.findByText('Introdução')).toBeInTheDocument()
    expect(screen.getByText('Concluída')).toBeInTheDocument()
    expect(screen.getByText(/Prazo 10 out/)).toBeInTheDocument()
    expect(screen.getByText(/vencido/)).toBeInTheDocument()
  })
})

describe('Orientandos (US04)', () => {
  const linha = {
    id: 1,
    aluno: { id: 1, nome: 'Carla Dias' },
    tema: {
      id: 7,
      titulo: 'Ensino de lógica com jogos',
      descricao: 'Plataforma de jogos educativos.',
      status: 'proposto',
      data_proposta: '2026-09-28T12:00:00Z',
    },
    entregas: [],
    fase_atual: 'Tema em análise',
    estado: { codigo: 'proposto', rotulo: 'Proposto' },
    progresso: { concluidas: 0, total: 0 },
    prazo: null,
    prazo_vencido: false,
    aguarda_avaliacao_de_tema: true,
  }

  function renderizarPainel() {
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

  it('mostra a linha do orientando com o botão de avaliar tema', async () => {
    entrarComo(ORIENTADOR)
    vi.spyOn(api, 'get').mockResolvedValue({ data: [linha] })

    renderizarPainel()

    expect(await screen.findByText('Carla Dias')).toBeInTheDocument()
    expect(screen.getByText('Tema em análise')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Avaliar tema' })).toBeInTheDocument()
  })

  it('abre o modal e aprova o tema (CA1)', async () => {
    entrarComo(ORIENTADOR)
    vi.spyOn(api, 'get').mockResolvedValue({ data: [linha] })
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} })

    renderizarPainel()

    await userEvent.click(await screen.findByRole('button', { name: 'Avaliar tema' }))
    const modal = screen.getByRole('dialog')
    expect(within(modal).getByText('Ensino de lógica com jogos')).toBeInTheDocument()

    await userEvent.click(within(modal).getByRole('button', { name: 'Aprovar tema' }))
    await waitFor(() => expect(post).toHaveBeenCalledWith('/temas/7/aprovar/'))
  })

  it('exige justificativa antes de enviar a solicitação de ajuste (CA2)', async () => {
    entrarComo(ORIENTADOR)
    vi.spyOn(api, 'get').mockResolvedValue({ data: [linha] })
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} })

    renderizarPainel()

    await userEvent.click(await screen.findByRole('button', { name: 'Avaliar tema' }))
    const modal = screen.getByRole('dialog')
    await userEvent.click(within(modal).getByRole('button', { name: 'Solicitar ajuste' }))

    const enviar = within(modal).getByRole('button', { name: 'Enviar solicitação' })
    expect(enviar).toBeDisabled()

    await userEvent.type(
      within(modal).getByLabelText('Justificativa'),
      'Delimite melhor o escopo.',
    )
    expect(enviar).toBeEnabled()

    await userEvent.click(enviar)
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/temas/7/solicitar-ajuste/', {
        justificativa: 'Delimite melhor o escopo.',
      }),
    )
  })
})
