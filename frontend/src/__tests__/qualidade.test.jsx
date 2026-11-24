/**
 * Revisão de qualidade de interface (impeccable + ui-ux-pro-max):
 * foco do teclado nas janelas, pular para o conteúdo, título de cada tela, mensagens de
 * erro anunciadas, botão com indicação de carregamento, hierarquia dos botões nas
 * entregas e mensagens sem faixa colorida na lateral.
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { useState } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import api from '../api'
import { AuthProvider } from '../auth'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import AreaAluno from '../pages/aluno/AreaAluno'
import Entregas from '../pages/aluno/Entregas'
import Login from '../pages/Login'

// O Vitest roda na raiz do frontend; o jsdom não dá uma URL de arquivo para este módulo.
// O Git no Windows pode gravar o arquivo com CRLF; os testes comparam com \n.
const CSS = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8').replace(/\r\n/g, '\n')

const ALUNO = { id: 1, nome: 'Lucas Andrade', email: 'lucas@aluno.edu.br', perfil: 'aluno' }

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  document.title = ''
})

// ------------------------------------------------------------------ foco nas janelas

function JanelaDeTeste() {
  const [aberta, setAberta] = useState(false)
  return (
    <>
      <button onClick={() => setAberta(true)}>Abrir janela</button>
      {aberta && (
        <Modal titulo="Nome" aoFechar={() => setAberta(false)}>
          <input aria-label="Campo" />
          <button>Salvar</button>
        </Modal>
      )}
    </>
  )
}

describe('Foco nas janelas (ui-ux-pro-max)', () => {
  it('ao abrir, o foco vai para o primeiro campo', async () => {
    render(<JanelaDeTeste />)

    await userEvent.click(screen.getByRole('button', { name: 'Abrir janela' }))

    expect(screen.getByLabelText('Campo')).toHaveFocus()
  })

  it('o Tab dá a volta só dentro da janela, nos dois sentidos', async () => {
    render(<JanelaDeTeste />)
    await userEvent.click(screen.getByRole('button', { name: 'Abrir janela' }))
    const dialogo = screen.getByRole('dialog')
    const campo = within(dialogo).getByLabelText('Campo')
    const salvar = within(dialogo).getByRole('button', { name: 'Salvar' })

    await userEvent.tab() // campo -> Salvar
    expect(salvar).toHaveFocus()
    await userEvent.tab() // Salvar -> volta ao primeiro item da janela (o botão de fechar)
    expect(dialogo).toContainElement(document.activeElement)
    await userEvent.tab({ shift: true })
    expect(salvar).toHaveFocus()
    await userEvent.tab({ shift: true })
    expect(campo).toHaveFocus()
    await userEvent.tab({ shift: true }) // do primeiro para o último, sem sair da janela
    expect(dialogo).toContainElement(document.activeElement)
  })

  it('ao fechar com Esc, o foco volta para o botão que abriu a janela', async () => {
    render(<JanelaDeTeste />)
    const abrir = screen.getByRole('button', { name: 'Abrir janela' })
    await userEvent.click(abrir)

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(abrir).toHaveFocus()
  })
})

// ------------------------------------------------------- pular, título e navegação

describe('Navegação por teclado e orientação (ui-ux-pro-max)', () => {
  function montar(rota) {
    localStorage.setItem('sgtcc.usuario', JSON.stringify(ALUNO))
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={[rota]}>
          <Layout
            itens={[
              { rotulo: 'Meu TCC', para: '/aluno', exato: true },
              { rotulo: 'Entregas', para: '/aluno/entregas' },
            ]}
          >
            <p>Conteúdo</p>
          </Layout>
        </MemoryRouter>
      </AuthProvider>,
    )
  }

  it('o primeiro item do teclado é "Pular para o conteúdo", que leva ao conteúdo principal', async () => {
    montar('/aluno')

    await userEvent.tab()

    const pular = screen.getByRole('link', { name: 'Pular para o conteúdo' })
    expect(pular).toHaveFocus()
    expect(pular).toHaveAttribute('href', '#conteudo')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'conteudo')
  })

  it('o título da aba do navegador acompanha a tela', () => {
    montar('/aluno/entregas/nova')

    expect(document.title).toBe('Entregas · SGTCC')
  })

  it('na tela inicial, o título é o do item inicial', () => {
    montar('/aluno')

    expect(document.title).toBe('Meu TCC · SGTCC')
  })

  it('o item atual do menu é anunciado como a página atual', () => {
    montar('/aluno/entregas')

    expect(screen.getByRole('link', { name: /Entregas/ })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /Meu TCC/ })).not.toHaveAttribute('aria-current')
  })
})

// ------------------------------------------------------ erros anunciados e carregando

describe('Erros e carregamento (ui-ux-pro-max)', () => {
  function abrirLogin() {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<Login />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )
  }

  it('a mensagem de erro do login é anunciada pelo leitor de tela (role alert)', async () => {
    vi.spyOn(api, 'post').mockRejectedValue({ response: { data: { detail: 'E-mail ou senha inválidos.' } } })
    abrirLogin()

    await userEvent.type(screen.getByLabelText('E-mail'), 'a@b.com')
    await userEvent.type(screen.getByLabelText('Senha'), 'qualquer123')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha inválidos.')
  })

  it('enquanto envia, o botão fica ocupado (aria-busy) e mostra a indicação de carregando', async () => {
    vi.spyOn(api, 'post').mockReturnValue(new Promise(() => {}))
    abrirLogin()

    await userEvent.type(screen.getByLabelText('E-mail'), 'a@b.com')
    await userEvent.type(screen.getByLabelText('Senha'), 'qualquer123')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    const botao = await screen.findByRole('button', { name: 'Entrando…' })
    expect(botao).toHaveAttribute('aria-busy', 'true')
    expect(CSS).toMatch(/button\[aria-busy='true'\]::before\s*\{[^}]*animation:\s*girar/)
  })
})

// ------------------------------------------------- hierarquia dos botões nas entregas

describe('Hierarquia dos botões nas Entregas (impeccable)', () => {
  function abrir(entregas) {
    localStorage.setItem('sgtcc.usuario', JSON.stringify(ALUNO))
    localStorage.setItem('sgtcc.access', 'token-de-teste')
    vi.spyOn(api, 'get').mockImplementation((url) =>
      Promise.resolve({
        data:
          url === '/meu-tcc/'
            ? {
                id: 1, aluno: ALUNO, orientador: { id: 2, nome: 'Prof. Marcos' },
                tema: {
                  id: 9, titulo: 'T', descricao: 'D', status: 'aprovado', justificativa_ajuste: '',
                  data_proposta: '2026-08-20T12:00:00Z', data_aprovacao: '2026-08-25T12:00:00Z',
                },
                entregas,
              }
            : { nao_lidos: 0, avisos: [] },
      }),
    )
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/aluno/entregas']}>
          <Routes>
            <Route path="/aluno" element={<AreaAluno />}>
              <Route path="entregas" element={<Entregas />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )
  }

  const base = { id: 1, titulo: 'Capítulo 1', estado: 'rascunho', prazo: '2099-12-31', atrasada: false }

  it('sem versão, o botão principal (cheio) é "Enviar versão"', async () => {
    abrir([{ ...base, aceita_versao: true, pode_sinalizar: false }])

    const enviar = await screen.findByRole('button', { name: 'Enviar versão' })

    expect(enviar).not.toHaveClass('contorno')
  })

  it('com versão pronta, o principal é "Sinalizar pronta" e "Enviar versão" passa a secundário', async () => {
    abrir([{ ...base, aceita_versao: true, pode_sinalizar: true, versao_atual: { numero: 1 } }])

    const sinalizar = await screen.findByRole('button', { name: /Sinalizar Capítulo 1 como pronta/ })

    expect(sinalizar).not.toHaveClass('contorno')
    expect(screen.getByRole('button', { name: 'Enviar versão' })).toHaveClass('contorno')
  })
})

// -------------------------------------------------- mensagens sem faixa colorida na lateral

describe('Mensagens e superfícies (impeccable)', () => {
  it('nenhuma regra usa borda lateral colorida acima de 1px', () => {
    const achados = [...CSS.matchAll(/border-(left|right)(?:-width)?:\s*([2-9])px(?:\s+solid\s+(var\([^)]+\)))?/g)]
    // As únicas bordas laterais de 2px são citações em cinza neutro (comentário do orientador e
    // texto do painel de entrada); nenhuma delas leva a cor de um estado.
    for (const [, , , cor] of achados) {
      expect(['var(--borda-forte)', undefined]).toContain(cor)
    }
  })

  it('erro, aviso e sucesso têm borda de 1px tingida, fundo tingido e um ponto de cor', () => {
    for (const classe of ['erro', 'aviso', 'sucesso']) {
      expect(CSS).toMatch(new RegExp(`\\.${classe}::before[\\s\\S]*?border-radius:\\s*50%`))
    }
    expect(CSS).toMatch(/\.erro\s*\{[^}]*color-mix\(in srgb, var\(--vermelho\)/)
  })

  it('o resumo do topo é uma linha de números, não cartões de destaque', () => {
    const regra = CSS.match(/\n\.indicadores\s*\{([^}]*)\}\n\n\.indicadores > div,\n\.indicadores > div:nth-child\(n\)/)
    expect(regra, 'regra do resumo em linha').not.toBeNull()
    expect(regra[1]).toMatch(/display:\s*flex;/)
    expect(regra[1]).toMatch(/background:\s*none;/)
    expect(regra[1]).toMatch(/border:\s*0;/)
  })

  it('a Visão geral é uma lista de trabalho única, sem cartões lado a lado', () => {
    const regra = CSS.match(/\n\.visao-grade\s*\{\s*display:\s*block;/)
    expect(regra).not.toBeNull()
    expect(CSS).toMatch(/\.painel-visao,\s*\.painel-visao:hover\s*\{[^}]*border:\s*0;/)
  })

  it('só uma entrada de página: os cartões não entram um depois do outro', () => {
    expect(CSS).toMatch(/\.indicadores > div,\s*\.lista-avisos > li,\s*\.perfil-grade > section\s*\{\s*animation:\s*none;/)
  })

  it('os alvos de toque têm 44px', () => {
    expect(CSS).toMatch(/@media \(pointer: coarse\)\s*\{\s*button,[\s\S]*?min-height:\s*44px;/)
  })
})

// ------------------------------------------------------------ fechamento responsivo

describe('Fechamento: desktop, tablet e celular', () => {
  it('ao trocar de tela, o foco vai para o conteúdo (e na primeira tela não mexe)', async () => {
    localStorage.setItem('sgtcc.usuario', JSON.stringify(ALUNO))
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/aluno']}>
          <Layout
            itens={[
              { rotulo: 'Meu TCC', para: '/aluno', exato: true },
              { rotulo: 'Entregas', para: '/aluno/entregas' },
            ]}
          >
            <p>Conteúdo</p>
          </Layout>
        </MemoryRouter>
      </AuthProvider>,
    )
    expect(screen.getByRole('main')).not.toHaveFocus()

    await userEvent.click(screen.getByRole('link', { name: /Entregas/ }))

    expect(screen.getByRole('main')).toHaveFocus()
    expect(document.title).toBe('Entregas · SGTCC')
  })

  it('a tabela de Orientandos vira cartões já no tablet, em colunas quando cabe', () => {
    expect(CSS).toMatch(/@media \(max-width: 1100px\)\s*\{\s*\.tabela-cartoes,/)
    expect(CSS).toMatch(/@media \(min-width: 721px\) and \(max-width: 1100px\)\s*\{\s*\.tabela-cartoes tbody\s*\{\s*display:\s*grid;/)
  })

  it('nas Entregas, título e ações dividem a linha e o passo a passo vem em barras', () => {
    expect(CSS).toMatch(/\.grupo-entregas \.lista > li\s*\{\s*display:\s*grid;/)
    // As etapas (itens de lista dentro da lista) não herdam a linha nem o espaçamento das linhas.
    expect(CSS).toMatch(/\.lista \.etapas li,\s*\.lista \.etapas li:hover\s*\{[^}]*border:\s*0;/)
    expect(CSS).toMatch(/\.grupo-entregas \.etapas\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*repeat\(5,/)
    expect(CSS).toMatch(/\.grupo-entregas \.etapas li\.feita::before\s*\{\s*background:\s*var\(--destaque\);/)
  })

  it('o rótulo de um botão nunca quebra em duas linhas', () => {
    expect(CSS).toMatch(/\nbutton,\s*a\.contorno,\s*\.botao-link\s*\{\s*white-space:\s*nowrap;/)
  })

  it('a janela sobe ao abrir e, no celular, entra como folha pelo rodapé', () => {
    expect(CSS).toMatch(/\.modal\s*\{\s*animation:\s*janela-sobe/)
    expect(CSS).toMatch(/@keyframes folha-sobe\s*\{\s*from\s*\{\s*transform:\s*translateY\(100%\)/)
  })

  it('no celular, texto e campos têm 16px (sem o zoom automático do iOS)', () => {
    expect(CSS).toMatch(/@media \(max-width: 720px\)\s*\{\s*body,\s*input,\s*select,\s*textarea\s*\{\s*font-size:\s*16px;/)
  })
})
