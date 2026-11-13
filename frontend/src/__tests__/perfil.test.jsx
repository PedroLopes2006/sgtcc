/**
 * Tela de Perfil, de aluno e de orientador.
 *
 * Mostra a conta (nome, e-mail, perfil, "Membro desde"), um resumo do trabalho,
 * a escolha de aparência (claro, escuro ou automático), a situação do Telegram
 * e o botão de sair. O Telegram ainda não vincula nada: a US02 é a próxima etapa,
 * então o formulário aparece desabilitado e avisa que chega em breve.
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import api from '../api'
import { AuthProvider } from '../auth'
import RotaProtegida from '../components/RotaProtegida'
import AreaAluno from '../pages/aluno/AreaAluno'
import PerfilAluno from '../pages/aluno/PerfilAluno'
import PerfilOrientador from '../pages/orientador/PerfilOrientador'
import { CHAVE_TEMA } from '../tema'

const ALUNO = { id: 1, nome: 'Lucas Andrade', email: 'lucas@aluno.edu.br', perfil: 'aluno' }
const ORIENTADOR = { id: 2, nome: 'Marcos Ribeiro', email: 'm@prof.edu.br', perfil: 'orientador' }

function entrarComo(usuario) {
  localStorage.setItem('sgtcc.usuario', JSON.stringify(usuario))
  localStorage.setItem('sgtcc.access', 'token-de-teste')
}

function simularSistema(escuro = false) {
  window.matchMedia = vi.fn().mockImplementation((consulta) => ({
    matches: escuro && consulta.includes('dark'),
    media: consulta,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.tema
  simularSistema(false)
  vi.restoreAllMocks()
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  delete document.documentElement.dataset.tema
})

const CONTA_DO_ALUNO = {
  ...ALUNO,
  telegram_chat_id: null,
  data_cadastro: '2026-08-14T12:00:00Z',
}

function tccDoAluno(entregas = []) {
  return {
    id: 1,
    aluno: ALUNO,
    orientador: { id: 2, nome: 'Marcos Ribeiro' },
    tema: {
      id: 9, titulo: 'Sistema de gestão de TCC', descricao: 'Plataforma web.',
      status: 'aprovado', justificativa_ajuste: '',
      data_proposta: '2026-08-20T12:00:00Z', data_aprovacao: '2026-08-25T12:00:00Z',
    },
    entregas,
  }
}

function renderizarAluno({ tcc = tccDoAluno(), conta = CONTA_DO_ALUNO } = {}) {
  entrarComo(ALUNO)
  vi.spyOn(api, 'get').mockImplementation((url) => {
    if (url === '/meu-tcc/') return Promise.resolve({ data: tcc ?? { tcc: null } })
    if (url === '/auth/eu/') {
      return conta ? Promise.resolve({ data: conta }) : Promise.reject(new Error('sem rede'))
    }
    return Promise.resolve({ data: [] })
  })
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/aluno/perfil']}>
        <Routes>
          <Route
            path="/aluno"
            element={
              <RotaProtegida perfil="aluno">
                <AreaAluno />
              </RotaProtegida>
            }
          >
            <Route path="perfil" element={<PerfilAluno />} />
          </Route>
          <Route path="/login" element={<p>Tela de entrada</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('Perfil do aluno', () => {
  it('mostra o cabeçalho com o nome, o papel e o e-mail', async () => {
    renderizarAluno()

    expect(await screen.findByRole('heading', { name: 'Lucas Andrade', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Aluno', { selector: '.chip-papel' })).toBeInTheDocument()
    expect(screen.getAllByText('lucas@aluno.edu.br').length).toBeGreaterThan(0)
  })

  it('o item Perfil do menu agora leva à tela', async () => {
    renderizarAluno()
    expect(await screen.findByRole('link', { name: 'Perfil' })).toHaveAttribute(
      'href',
      '/aluno/perfil',
    )
  })

  it('resume o TCC: orientador, tema, progresso e fase atual', async () => {
    renderizarAluno({
      tcc: tccDoAluno([
        { id: 1, titulo: 'Introdução', estado: 'concluida', prazo: '2026-10-10' },
        { id: 2, titulo: 'Metodologia', estado: 'rascunho', prazo: '2026-11-24' },
      ]),
    })

    const resumo = await screen.findByRole('region', { name: 'Resumo' })

    expect(within(resumo).getByText('Marcos Ribeiro')).toBeInTheDocument()
    expect(within(resumo).getByText(/Sistema de gestão de TCC/)).toBeInTheDocument()
    expect(within(resumo).getByText('Tema aprovado')).toBeInTheDocument()
    expect(within(resumo).getByText('1 de 2 entregas concluídas')).toBeInTheDocument()
    expect(within(resumo).getByText('Metodologia · prazo 24 nov')).toBeInTheDocument()
    expect(within(resumo).getByRole('link', { name: 'Ver entregas' })).toHaveAttribute(
      'href',
      '/aluno/entregas',
    )
  })

  it('sem TCC, convida a propor o tema', async () => {
    renderizarAluno({ tcc: null })

    const resumo = await screen.findByRole('region', { name: 'Resumo' })

    expect(within(resumo).getByText('Você ainda não propôs o tema do seu TCC.')).toBeInTheDocument()
    expect(within(resumo).getByRole('link', { name: 'Propor tema' })).toHaveAttribute(
      'href',
      '/aluno/propor',
    )
  })

  it('mostra desde quando a conta existe', async () => {
    renderizarAluno()

    const conta = await screen.findByRole('region', { name: 'Conta' })

    await waitFor(() =>
      expect(within(conta).getByText('agosto de 2026')).toBeInTheDocument(),
    )
    expect(within(conta).getByText('Membro desde')).toBeInTheDocument()
  })

  it('segue funcionando quando a busca dos dados da conta falha', async () => {
    renderizarAluno({ conta: null })

    const conta = await screen.findByRole('region', { name: 'Conta' })

    expect(within(conta).getByText('Lucas Andrade')).toBeInTheDocument()
    expect(within(conta).queryByText('Membro desde')).not.toBeInTheDocument()
  })
})

describe('Telegram no perfil', () => {
  it('mostra "Não vinculado" e deixa claro que o formulário chega em breve', async () => {
    renderizarAluno()

    const cartao = await screen.findByRole('region', { name: 'Telegram' })

    expect(within(cartao).getByText('Não vinculado')).toBeInTheDocument()
    expect(within(cartao).getByLabelText('Código do chat')).toBeDisabled()
    expect(within(cartao).getByRole('button', { name: 'Vincular' })).toBeDisabled()
    expect(within(cartao).getByText(/Disponível em breve/)).toBeInTheDocument()
    expect(
      within(cartao).getByText('Receba avisos de correção e aprovação no Telegram.'),
    ).toBeInTheDocument()
  })

  it('mostra "Vinculado" quando a conta já tem o chat cadastrado', async () => {
    renderizarAluno({ conta: { ...CONTA_DO_ALUNO, telegram_chat_id: '12345' } })

    const cartao = await screen.findByRole('region', { name: 'Telegram' })

    await waitFor(() => expect(within(cartao).getByText('Vinculado')).toBeInTheDocument())
    expect(within(cartao).queryByText('Não vinculado')).not.toBeInTheDocument()
  })
})

describe('Aparência no perfil', () => {
  it('oferece claro, escuro e automático, com o tema atual marcado', async () => {
    renderizarAluno()

    const grupo = await screen.findByRole('group', { name: 'Tema da tela' })
    const botoes = within(grupo).getAllByRole('button')

    expect(botoes.map((b) => b.textContent)).toEqual(['Claro', 'Escuro', 'Automático'])
    expect(within(grupo).getByRole('button', { name: 'Automático' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('escolher Escuro aplica o tema e guarda a escolha', async () => {
    renderizarAluno()

    await userEvent.click(await screen.findByRole('button', { name: 'Escuro' }))

    expect(document.documentElement.dataset.tema).toBe('escuro')
    expect(localStorage.getItem(CHAVE_TEMA)).toBe('escuro')
    expect(screen.getByRole('button', { name: 'Escuro' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('Automático esquece a escolha e volta a seguir o computador', async () => {
    simularSistema(true)
    localStorage.setItem(CHAVE_TEMA, 'claro')
    renderizarAluno()

    expect(await screen.findByRole('button', { name: 'Claro' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Automático' }))

    expect(localStorage.getItem(CHAVE_TEMA)).toBeNull()
    expect(document.documentElement.dataset.tema).toBe('escuro')
  })
})

describe('Sair da conta', () => {
  it('limpa a sessão guardada no navegador', async () => {
    renderizarAluno()

    await userEvent.click(await screen.findByRole('button', { name: 'Sair da conta' }))

    expect(localStorage.getItem('sgtcc.usuario')).toBeNull()
    expect(localStorage.getItem('sgtcc.access')).toBeNull()
    // Como no app, quem saiu vai para a tela de entrada.
    expect(await screen.findByText('Tela de entrada')).toBeInTheDocument()
  })
})

describe('Perfil do orientador', () => {
  function linha(id, extras = {}) {
    return {
      id,
      aluno: { id, nome: `Aluno ${id}` },
      tema: { id, titulo: `Tema ${id}`, status: 'aprovado' },
      entregas: [],
      progresso: { concluidas: 0, total: 0 },
      prazo_vencido: false,
      aguarda_avaliacao_de_tema: false,
      entrega_para_revisao: null,
      ...extras,
    }
  }

  function renderizarOrientador(linhas) {
    entrarComo(ORIENTADOR)
    vi.spyOn(api, 'get').mockImplementation((url) => {
      if (url === '/orientandos/') return Promise.resolve({ data: linhas })
      if (url === '/auth/eu/') {
        return Promise.resolve({
          data: { ...ORIENTADOR, telegram_chat_id: null, data_cadastro: '2026-09-01T12:00:00Z' },
        })
      }
      return Promise.resolve({ data: [] })
    })
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/orientador/perfil']}>
          <Routes>
            <Route path="/orientador/perfil" element={<PerfilOrientador />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )
  }

  it('mostra os números do trabalho do orientador', async () => {
    renderizarOrientador([
      linha(1, {
        prazo_vencido: true,
        entrega_para_revisao: { id: 5, titulo: 'Introdução', estado: 'pronto_para_revisao' },
      }),
      linha(2, { aguarda_avaliacao_de_tema: true }),
      linha(3),
    ])

    const resumo = await screen.findByRole('region', { name: 'Resumo' })
    const indicador = (rotulo) => within(resumo).getByText(rotulo).closest('div')

    await waitFor(() =>
      expect(within(indicador('Orientandos ativos')).getByText('3')).toBeInTheDocument(),
    )
    expect(within(indicador('Para revisar')).getByText('1')).toBeInTheDocument()
    expect(within(indicador('Temas a avaliar')).getByText('1')).toBeInTheDocument()
    expect(within(indicador('Em atraso')).getByText('1')).toHaveClass('alerta')
  })

  it('leva à fila e aos orientandos, e o texto do Telegram é o do orientador', async () => {
    renderizarOrientador([linha(1)])

    const resumo = await screen.findByRole('region', { name: 'Resumo' })

    expect(
      await within(resumo).findByRole('link', { name: 'Ir para a fila de revisão' }),
    ).toHaveAttribute('href', '/orientador/fila')
    expect(within(resumo).getByRole('link', { name: 'Ver orientandos' })).toHaveAttribute(
      'href',
      '/orientador',
    )
    expect(
      screen.getByText('Receba avisos de entregas prontas para revisão no Telegram.'),
    ).toBeInTheDocument()
  })

  it('o item Perfil do menu leva à tela', async () => {
    renderizarOrientador([linha(1)])
    expect(await screen.findByRole('link', { name: 'Perfil' })).toHaveAttribute(
      'href',
      '/orientador/perfil',
    )
  })
})
