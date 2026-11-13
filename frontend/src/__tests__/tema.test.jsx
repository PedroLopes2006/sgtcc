/**
 * Modo escuro e identidade visual.
 *
 * O tema vive no atributo `data-tema` do <html>. Na primeira visita vale o tema
 * do computador; depois que a pessoa escolhe, vale a escolha, guardada no
 * navegador. O CSS troca as cores por variáveis, então os dois temas precisam
 * definir as mesmas variáveis, senão uma cor ficaria "esquecida" no outro modo.
 */
import '@testing-library/jest-dom/vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from '../auth'
import AlternarTema from '../components/AlternarTema'
import Login from '../pages/Login'
import { CHAVE_TEMA, lerTemaSalvo, temaDoSistema } from '../tema'

// O Vitest roda na raiz do frontend; o jsdom não dá uma URL de arquivo para este módulo.
const CSS = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8')

function bloco(seletor) {
  const inicio = CSS.indexOf(seletor)
  expect(inicio, `bloco ${seletor}`).toBeGreaterThanOrEqual(0)
  return CSS.slice(CSS.indexOf('{', inicio) + 1, CSS.indexOf('\n}', inicio))
}

function variaveis(texto) {
  return [...texto.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((achado) => achado[1])
}

function simularSistema(escuro) {
  window.matchMedia = vi.fn().mockImplementation((consulta) => ({
    matches: escuro && consulta.includes('dark'),
    media: consulta,
  }))
}

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.tema
  simularSistema(false)
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  delete document.documentElement.dataset.tema
})

describe('Modo escuro', () => {
  it('começa no tema do computador quando a pessoa ainda não escolheu', () => {
    simularSistema(true)
    render(<AlternarTema />)

    expect(document.documentElement.dataset.tema).toBe('escuro')
    expect(screen.getByRole('button', { name: 'Modo escuro' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('a escolha guardada vale mais que o tema do computador', () => {
    simularSistema(true)
    localStorage.setItem(CHAVE_TEMA, 'claro')
    render(<AlternarTema />)

    expect(document.documentElement.dataset.tema).toBe('claro')
    expect(screen.getByRole('button', { name: 'Modo escuro' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('alterna entre claro e escuro e guarda a escolha', async () => {
    render(<AlternarTema />)
    const botao = screen.getByRole('button', { name: 'Modo escuro' })
    expect(document.documentElement.dataset.tema).toBe('claro')

    await userEvent.click(botao)
    expect(document.documentElement.dataset.tema).toBe('escuro')
    expect(botao).toHaveAttribute('aria-pressed', 'true')
    expect(localStorage.getItem(CHAVE_TEMA)).toBe('escuro')

    await userEvent.click(botao)
    expect(document.documentElement.dataset.tema).toBe('claro')
    expect(localStorage.getItem(CHAVE_TEMA)).toBe('claro')
  })

  it('no automático, acompanha o computador quando ele troca de tema', () => {
    let aoMudar = null
    let escuro = false
    window.matchMedia = vi.fn().mockImplementation((consulta) => ({
      get matches() {
        return escuro && consulta.includes('dark')
      },
      media: consulta,
      addEventListener: (_, funcao) => {
        aoMudar = funcao
      },
      removeEventListener: () => {},
    }))
    render(<AlternarTema />)
    expect(document.documentElement.dataset.tema).toBe('claro')

    escuro = true
    act(() => aoMudar())

    expect(document.documentElement.dataset.tema).toBe('escuro')
  })

  it('com a escolha feita, o computador deixa de mandar no tema', async () => {
    let aoMudar = null
    let escuro = false
    window.matchMedia = vi.fn().mockImplementation((consulta) => ({
      get matches() {
        return escuro && consulta.includes('dark')
      },
      media: consulta,
      addEventListener: (_, funcao) => {
        aoMudar = funcao
      },
      removeEventListener: () => {
        aoMudar = null
      },
    }))
    render(<AlternarTema />)

    await userEvent.click(screen.getByRole('button', { name: 'Modo escuro' })) // escolhe "escuro"
    await userEvent.click(screen.getByRole('button', { name: 'Modo escuro' })) // escolhe "claro"
    escuro = true

    // Sem acompanhar o computador, nada muda sozinho.
    expect(aoMudar).toBeNull()
    expect(document.documentElement.dataset.tema).toBe('claro')
  })

  it('ignora um valor guardado que não é um tema', () => {
    localStorage.setItem(CHAVE_TEMA, 'roxo')
    expect(lerTemaSalvo()).toBeNull()
  })

  it('segue funcionando quando o armazenamento do navegador está bloqueado', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    expect(lerTemaSalvo()).toBeNull()

    render(<AlternarTema />)
    await userEvent.click(screen.getByRole('button', { name: 'Modo escuro' }))

    expect(document.documentElement.dataset.tema).toBe('escuro')
    vi.restoreAllMocks()
  })

  it('sem suporte a matchMedia, cai no tema claro', () => {
    window.matchMedia = undefined
    expect(temaDoSistema()).toBe('claro')
  })

  it('a tela de entrar também oferece o modo escuro', () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      </AuthProvider>,
    )
    expect(screen.getByRole('button', { name: 'Modo escuro' })).toBeInTheDocument()
  })
})

describe('Variáveis de cor', () => {
  const claro = new Set(variaveis(bloco(':root {')))
  const escuro = new Set(variaveis(bloco(":root[data-tema='escuro']")))

  it('o modo escuro redefine cada cor do modo claro', () => {
    // Medidas, fontes e o color-scheme não mudam entre os temas; cor, sim.
    const naoSaoCor = ['--fonte-texto', '--fonte-titulo', '--raio', '--raio-g', '--sidebar-l']
    const faltando = [...claro].filter((nome) => !naoSaoCor.includes(nome) && !escuro.has(nome))
    expect(faltando).toEqual([])
  })

  it('o modo escuro não inventa variável que o claro não tem', () => {
    expect([...escuro].filter((nome) => !claro.has(nome))).toEqual([])
  })

  it('as cores de estado e de prioridade existem nos dois temas', () => {
    for (const nome of [
      '--st-pronta', '--st-revisao', '--st-correcao', '--st-concluida', '--st-banca',
      '--st-proposto', '--st-ajuste', '--st-aprovado', '--pr-alta', '--pr-media', '--pr-baixa',
    ]) {
      expect(claro.has(nome), `${nome} no claro`).toBe(true)
      expect(escuro.has(nome), `${nome} no escuro`).toBe(true)
    }
  })

  it('cada nível de prioridade tem a sua cor, e a ausência de prioridade não tem', () => {
    for (const nivel of ['alta', 'media', 'baixa']) {
      expect(CSS).toMatch(new RegExp(`seletor-prioridade\\[data-prioridade='${nivel}'\\]`))
    }
    expect(CSS).not.toMatch(/data-prioridade='nenhuma'/)
  })
})

describe('Peso da plataforma', () => {
  it('não baixa fonte, imagem nem folha de estilo externa', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
    expect(CSS).not.toMatch(/@font-face|@import|url\(/)
    expect(html).not.toMatch(/<link[^>]+(stylesheet|font)/i)
    expect(html).not.toMatch(/fonts\.(googleapis|gstatic)/)
  })
})
