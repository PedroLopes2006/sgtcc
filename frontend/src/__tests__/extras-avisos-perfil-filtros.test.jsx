/**
 * EXTRAS — fora dos requisitos do documento:
 *  - a aba de Avisos (alternativa dentro do sistema ao Telegram, US02);
 *  - o perfil editável (trocar o nome e a senha);
 *  - os filtros e a busca em Orientandos, e a tabela em cartões no celular;
 *  - a mensagem do limite de tentativas de login.
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
import LayoutOrientador from '../components/LayoutOrientador'
import Avisos from '../pages/Avisos'
import Login from '../pages/Login'
import AreaAluno from '../pages/aluno/AreaAluno'
import PerfilAluno from '../pages/aluno/PerfilAluno'
import Orientandos from '../pages/orientador/Orientandos'

// O Vitest roda na raiz do frontend; o jsdom não dá uma URL de arquivo para este módulo.
const CSS = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8')

const ALUNO = { id: 1, nome: 'Lucas Andrade', email: 'lucas@aluno.edu.br', perfil: 'aluno' }
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

const AVISO = (extras = {}) => ({
  id: 1,
  tipo: 'entrega_pronta',
  descricao: 'Entrega "Introdução" sinalizada como pronta.',
  data_hora: '2026-11-10T14:30:00Z',
  de: 'Lucas Andrade',
  entrega_id: 7,
  nao_lido: true,
  ...extras,
})

// ------------------------------------------------------------------ avisos

describe('Aba de Avisos (extra)', () => {
  function abrirAvisos(avisos, naoLidos, perfil = ORIENTADOR) {
    entrarComo(perfil)
    const get = vi.spyOn(api, 'get').mockImplementation((url) => {
      if (url === '/avisos/') return Promise.resolve({ data: { nao_lidos: naoLidos, avisos } })
      return Promise.resolve({ data: [] })
    })
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { nao_lidos: 0 } })
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/orientador/avisos']}>
          <Routes>
            <Route
              path="/orientador/avisos"
              element={
                <LayoutOrientador>
                  <Avisos />
                </LayoutOrientador>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )
    return { get, post }
  }

  it('lista os avisos com título, texto, data e destaque nos novos', async () => {
    abrirAvisos(
      [
        AVISO(),
        AVISO({ id: 2, tipo: 'tema_proposto', descricao: 'Tema "Sistema" proposto.', nao_lido: false }),
      ],
      1,
    )

    expect(await screen.findByText('Entrega pronta para revisão')).toBeInTheDocument()
    expect(screen.getByText('Tema proposto')).toBeInTheDocument()
    expect(screen.getAllByText('Novo')).toHaveLength(1)
    expect(screen.getByText('Entrega "Introdução" sinalizada como pronta.')).toBeInTheDocument()
  })

  it('o aviso de entrega leva à tela de Revisão dela, no perfil do orientador', async () => {
    abrirAvisos([AVISO()], 1)

    const link = await screen.findByRole('link', { name: 'Abrir' })

    expect(link).toHaveAttribute('href', '/orientador/entregas/7')
  })

  it('ao abrir, marca tudo como visto', async () => {
    const { post } = abrirAvisos([AVISO()], 1)

    await screen.findByText('Entrega pronta para revisão')

    await waitFor(() => expect(post).toHaveBeenCalledWith('/avisos/marcar-lidos/'))
  })

  it('sem nada novo, não faz a chamada de marcar como visto', async () => {
    const { post } = abrirAvisos([AVISO({ nao_lido: false })], 0)

    await screen.findByText('Entrega pronta para revisão')

    expect(post).not.toHaveBeenCalled()
  })

  it('sem avisos, mostra a mensagem de vazio', async () => {
    abrirAvisos([], 0)

    expect(await screen.findByText('Nenhum aviso por enquanto')).toBeInTheDocument()
  })

  it('mostra o erro quando a busca falha', async () => {
    entrarComo(ORIENTADOR)
    vi.spyOn(api, 'get').mockRejectedValue({ response: { data: { detail: 'Falhou.' } } })
    render(
      <AuthProvider>
        <MemoryRouter>
          <Avisos />
        </MemoryRouter>
      </AuthProvider>,
    )

    expect(await screen.findByText('Falhou.')).toBeInTheDocument()
  })

  it('a barra lateral mostra quantos avisos ainda não foram vistos', async () => {
    abrirAvisos([AVISO()], 3)

    const item = await screen.findByRole('link', { name: /Avisos/ })

    await waitFor(() => expect(within(item).getByText('3')).toBeInTheDocument())
  })

  it('o menu do aluno também tem a aba de Avisos', async () => {
    entrarComo(ALUNO)
    vi.spyOn(api, 'get').mockImplementation((url) =>
      Promise.resolve({
        data: url === '/avisos/' ? { nao_lidos: 2, avisos: [] } : { tcc: null },
      }),
    )
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/aluno']}>
          <Routes>
            <Route path="/aluno" element={<AreaAluno />}>
              <Route index element={<p>Início</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )

    const item = await screen.findByRole('link', { name: /Avisos/ })

    expect(item).toHaveAttribute('href', '/aluno/avisos')
    await waitFor(() => expect(within(item).getByText('2')).toBeInTheDocument())
  })
})

// ------------------------------------------------------------ perfil editável

describe('Perfil editável (extra)', () => {
  function abrirPerfil() {
    entrarComo(ALUNO)
    vi.spyOn(api, 'get').mockImplementation((url) => {
      if (url === '/auth/eu/') {
        return Promise.resolve({
          data: { ...ALUNO, telegram_chat_id: null, data_cadastro: '2026-08-14T12:00:00Z' },
        })
      }
      if (url === '/avisos/') return Promise.resolve({ data: { nao_lidos: 0, avisos: [] } })
      return Promise.resolve({ data: { tcc: null } })
    })
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

  it('troca o nome, mostra o novo no perfil e no menu e guarda no navegador', async () => {
    abrirPerfil()
    const patch = vi
      .spyOn(api, 'patch')
      .mockResolvedValue({ data: { ...ALUNO, nome: 'Lucas A. Silva' } })

    await userEvent.click(await screen.findByRole('button', { name: 'Editar nome' }))
    const campo = screen.getByLabelText('Nome')
    await userEvent.clear(campo)
    await userEvent.type(campo, 'Lucas A. Silva')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(patch).toHaveBeenCalledWith('/auth/eu/', { nome: 'Lucas A. Silva' })
    expect(await screen.findByText('Nome atualizado.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Lucas A. Silva' })).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('sgtcc.usuario')).nome).toBe('Lucas A. Silva')
  })

  it('não deixa salvar o nome vazio', async () => {
    abrirPerfil()
    const patch = vi.spyOn(api, 'patch').mockResolvedValue({ data: ALUNO })

    await userEvent.click(await screen.findByRole('button', { name: 'Editar nome' }))
    await userEvent.clear(screen.getByLabelText('Nome'))
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Informe o nome.')).toBeInTheDocument()
    expect(patch).not.toHaveBeenCalled()
  })

  it('cancelar descarta o que foi digitado', async () => {
    abrirPerfil()

    await userEvent.click(await screen.findByRole('button', { name: 'Editar nome' }))
    await userEvent.type(screen.getByLabelText('Nome'), ' extra')
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByLabelText('Nome')).not.toBeInTheDocument()
    expect(screen.getAllByText('Lucas Andrade').length).toBeGreaterThan(0)
  })

  it('altera a senha, limpa os campos e confirma', async () => {
    abrirPerfil()
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} })

    await userEvent.type(await screen.findByLabelText('Senha atual'), 'senhaForte123')
    await userEvent.type(screen.getByLabelText('Nova senha'), 'OutraSenha456')
    await userEvent.click(screen.getByRole('button', { name: 'Alterar senha' }))

    expect(post).toHaveBeenCalledWith('/auth/alterar-senha/', {
      senha_atual: 'senhaForte123',
      nova_senha: 'OutraSenha456',
    })
    expect(await screen.findByText('Senha alterada.')).toBeInTheDocument()
    expect(screen.getByLabelText('Senha atual')).toHaveValue('')
    expect(screen.getByLabelText('Nova senha')).toHaveValue('')
  })

  it('mostra o erro da API quando a senha atual não confere', async () => {
    abrirPerfil()
    vi.spyOn(api, 'post').mockRejectedValue({
      response: { data: { senha_atual: 'A senha atual não confere.' } },
    })

    await userEvent.type(await screen.findByLabelText('Senha atual'), 'errada')
    await userEvent.type(screen.getByLabelText('Nova senha'), 'OutraSenha456')
    await userEvent.click(screen.getByRole('button', { name: 'Alterar senha' }))

    expect(await screen.findByText('A senha atual não confere.')).toBeInTheDocument()
  })

  it('a nova senha exige 8 caracteres no campo', async () => {
    abrirPerfil()

    expect(await screen.findByLabelText('Nova senha')).toHaveAttribute('minLength', '8')
  })
})

// ------------------------------------------------- filtros de Orientandos

describe('Filtros e busca em Orientandos (extra)', () => {
  const linha = (id, nome, extras = {}) => ({
    id,
    aluno: { id, nome },
    tema: { id, titulo: `Tema de ${nome}`, status: 'aprovado' },
    entregas: [],
    fase_atual: 'Metodologia',
    estado: { codigo: 'aprovado', rotulo: 'Tema aprovado' },
    progresso: { concluidas: 0, total: 0 },
    prazo: null,
    prazo_vencido: false,
    aguarda_avaliacao_de_tema: false,
    entrega_para_revisao: null,
    entrega_para_comentario: null,
    entrega_para_banca: null,
    ...extras,
  })

  async function abrirOrientandos() {
    entrarComo(ORIENTADOR)
    vi.spyOn(api, 'get').mockImplementation((url) =>
      Promise.resolve({
        data:
          url === '/orientandos/'
            ? [
                linha(1, 'Ana', {
                  prazo_vencido: true,
                  entrega_para_revisao: { id: 5, titulo: 'Introdução', estado: 'pronto_para_revisao' },
                }),
                linha(2, 'Bruno', { aguarda_avaliacao_de_tema: true }),
                linha(3, 'Carla'),
              ]
            : url === '/avisos/'
              ? { nao_lidos: 0, avisos: [] }
              : [],
      }),
    )
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/orientador']}>
          <Routes>
            <Route path="/orientador" element={<Orientandos />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )
    await screen.findByText('Carla')
  }

  const filtro = (nome) => screen.getByRole('button', { name: new RegExp(nome) })
  const nomesNaTabela = () =>
    within(screen.getByRole('table'))
      .getAllByRole('row')
      .slice(1)
      .map((linhaDaTabela) => within(linhaDaTabela).getAllByRole('cell')[0].textContent)

  it('começa em Todos, com a contagem de cada filtro', async () => {
    await abrirOrientandos()

    expect(filtro('Todos')).toHaveAttribute('aria-pressed', 'true')
    expect(within(filtro('Todos')).getByText('3')).toBeInTheDocument()
    expect(within(filtro('Para revisar')).getByText('1')).toBeInTheDocument()
    expect(within(filtro('Temas a avaliar')).getByText('1')).toBeInTheDocument()
    expect(within(filtro('Em atraso')).getByText('1')).toBeInTheDocument()
    expect(nomesNaTabela()).toHaveLength(3)
  })

  it('cada filtro deixa só os orientandos que combinam', async () => {
    await abrirOrientandos()

    await userEvent.click(filtro('Para revisar'))
    expect(nomesNaTabela()).toEqual([expect.stringContaining('Ana')])

    await userEvent.click(filtro('Temas a avaliar'))
    expect(nomesNaTabela()).toEqual([expect.stringContaining('Bruno')])

    await userEvent.click(filtro('Em atraso'))
    expect(nomesNaTabela()).toEqual([expect.stringContaining('Ana')])

    await userEvent.click(filtro('Todos'))
    expect(nomesNaTabela()).toHaveLength(3)
  })

  it('a busca acha pelo nome ou pelo tema, sem ligar para acento e maiúscula', async () => {
    await abrirOrientandos()

    await userEvent.type(screen.getByLabelText('Buscar orientando'), 'BRUNO')
    expect(nomesNaTabela()).toEqual([expect.stringContaining('Bruno')])

    await userEvent.clear(screen.getByLabelText('Buscar orientando'))
    await userEvent.type(screen.getByLabelText('Buscar orientando'), 'tema de carla')
    expect(nomesNaTabela()).toEqual([expect.stringContaining('Carla')])
  })

  it('sem resultado, avisa em vez de mostrar uma tabela vazia', async () => {
    await abrirOrientandos()

    await userEvent.type(screen.getByLabelText('Buscar orientando'), 'zzz')

    expect(screen.getByText('Nenhum orientando com esse filtro')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('as células trazem o rótulo que vira título no cartão do celular', async () => {
    await abrirOrientandos()

    const primeira = within(screen.getByRole('table')).getAllByRole('row')[1]
    const rotulos = [...primeira.querySelectorAll('td[data-rotulo]')].map((td) => td.dataset.rotulo)

    expect(rotulos).toEqual(['Orientando', 'Fase atual', 'Estado', 'Progresso', 'Prazo'])
    expect(CSS).toMatch(/\.tabela-cartoes td\[data-rotulo\]::before/)
  })
})

// --------------------------------------------------- limite de tentativas

describe('Login bloqueado por tentativas (extra)', () => {
  it('mostra a mensagem do bloqueio que a API devolve', async () => {
    vi.spyOn(api, 'post').mockRejectedValue({
      response: {
        status: 429,
        data: { detail: 'Muitas tentativas de entrar. Tente de novo em 15 minuto(s).' },
      },
    })
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<Login />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )

    await userEvent.type(screen.getByLabelText('E-mail'), 'lucas@aluno.edu.br')
    await userEvent.type(screen.getByLabelText('Senha'), 'qualquer123')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText(/Muitas tentativas de entrar/)).toBeInTheDocument()
  })
})
