/**
 * Contraste de leitura (WCAG) das combinações de texto e fundo, nos dois temas.
 *
 * Calcula a razão de contraste entre cada par usado de verdade na interface, lendo
 * as cores direto de `styles.css`. O mínimo é 4,5:1 para texto comum e 3:1 para o que
 * é só apoio (texto de ajuda fraco, marcações). Existe porque já houve um botão
 * selecionado que ficava ilegível ao passar o mouse: um fundo claro com texto claro.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// O Vitest roda na raiz do frontend; o jsdom não dá uma URL de arquivo para este módulo.
// O Git no Windows pode gravar o arquivo com CRLF; os testes comparam com \n.
const CSS = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8').replace(/\r\n/g, '\n')

/** Pega as variáveis `--nome: valor;` de um bloco do CSS, a partir do seletor dado. */
function variaveis(seletor) {
  const inicio = CSS.indexOf(seletor)
  const abre = CSS.indexOf('{', inicio)
  const fecha = CSS.indexOf('\n}', abre)
  const corpo = CSS.slice(abre + 1, fecha)
  return Object.fromEntries([...corpo.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]))
}

const CLARO = variaveis(':root {')
const ESCURO = { ...CLARO, ...variaveis(":root[data-tema='escuro'] {") }

function cor(valor) {
  const v = valor.trim()
  if (v.startsWith('#')) {
    const h = v.length === 4 ? [...v.slice(1)].map((c) => c + c).join('') : v.slice(1)
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
  }
  throw new Error(`cor não prevista no teste: ${valor}`)
}

function luminancia([r, g, b]) {
  const [R, G, B] = [r, g, b].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}

function contraste(a, b) {
  const [la, lb] = [luminancia(cor(a)), luminancia(cor(b))]
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** [texto, fundo, mínimo, onde é usado] — nomes de variável do tema. */
const PARES = [
  ['--texto', '--superficie', 4.5, 'texto nos cartões'],
  ['--texto', '--bg-app', 4.5, 'texto na página'],
  ['--texto-suave', '--superficie', 4.5, 'texto de apoio nos cartões'],
  ['--texto-suave', '--bg-app', 4.5, 'texto de apoio na página'],
  ['--texto-suave', '--bg-sutil', 4.5, 'texto de apoio em fundo sutil (coluna lateral)'],
  ['--texto-fraco', '--superficie', 3, 'placeholder e datas fracas'],
  ['--texto', '--bg-hover', 4.5, 'texto sob o mouse'],
  ['--texto-suave', '--bg-hover', 4.5, 'texto de apoio sob o mouse'],
  ['--texto', '--bg-ativo', 4.5, 'texto em item ativo'],
  ['--texto-suave', '--bg-ativo', 4.5, 'contadores em cinza'],
  ['--acao-texto', '--acao', 4.5, 'botão principal'],
  ['--acao-texto', '--acao-hover', 4.5, 'botão principal sob o mouse'],
  ['--acao-texto', '--destaque', 4.5, 'selos e botões no destaque'],
  ['--destaque-forte', '--destaque-suave', 4.5, 'item ativo e selecionado em segmentado'],
  ['--destaque', '--superficie', 4.5, 'links nos cartões'],
  ['--destaque', '--bg-app', 4.5, 'links na página'],
  ['--vermelho', '--superficie', 4.5, 'erros e vencido'],
  ['--vermelho', '--bg-app', 4.5, 'vencido na página'],
  ['--pr-media', '--superficie', 4.5, 'prazo perto'],
  ['--superficie', '--vermelho', 4.5, 'etiqueta de prazo vencido'],
  ['--superficie', '--pr-media', 4.5, 'etiqueta de prazo perto'],
  ['--bg-app', '--texto', 4.5, 'etiqueta da pílula'],
  ['--desativado-texto', '--desativado-bg', 3, 'botão desativado'],
]

describe.each([
  ['claro', CLARO],
  ['escuro', ESCURO],
])('Contraste no tema %s', (_nome, tema) => {
  it.each(PARES)('%s sobre %s (mínimo %s:1) — %s', (texto, fundo, minimo, uso) => {
    const razao = contraste(tema[texto], tema[fundo])
    expect(razao, `${uso}: ${tema[texto]} sobre ${tema[fundo]} deu ${razao.toFixed(2)}:1`).toBeGreaterThanOrEqual(minimo)
  })
})

describe('Menu lateral escuro', () => {
  it('o texto e o destaque leem bem sobre o fundo do menu, nos dois temas', () => {
    // A regra do menu que troca as variáveis (a primeira `.sidebar` só cuida do layout).
    const menu = variaveis('.sidebar {\n  --texto:')
    for (const fundo of ['#16302c', '#0f1f1d']) {
      expect(contraste(menu['--texto'], fundo)).toBeGreaterThanOrEqual(4.5)
      expect(contraste(menu['--texto-suave'], fundo)).toBeGreaterThanOrEqual(4.5)
      expect(contraste(menu['--destaque'], fundo)).toBeGreaterThanOrEqual(4.5)
      expect(contraste(menu['--texto-fraco'], fundo)).toBeGreaterThanOrEqual(3)
    }
    expect(contraste(menu['--acao-texto'], menu['--destaque'])).toBeGreaterThanOrEqual(4.5)
  })
})

describe('Estados que já falharam', () => {
  /** Devolve as declarações de uma regra do CSS pelo seletor exato (a última que aparecer). */
  function regra(seletor) {
    const escapado = seletor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const achados = [...CSS.matchAll(new RegExp(`(?:^|\\n)${escapado}\\s*\\{([^}]*)\\}`, 'g'))]
    return achados.at(-1)?.[1] ?? ''
  }

  it('o filtro selecionado continua legível quando o mouse passa por cima', () => {
    const sob_mouse = regra(".filtro[aria-pressed='true']:hover:not(:disabled)")
    expect(sob_mouse, 'regra do selecionado sob o mouse').toMatch(/background:\s*var\(--acao-hover\)/)
    expect(sob_mouse).toMatch(/color:\s*var\(--acao-texto\)/)
  })

  it('o segmento selecionado não perde as cores sob o mouse', () => {
    const sob_mouse = regra(".segmentado button[aria-pressed='true']:hover:not(:disabled)")
    expect(sob_mouse).toMatch(/background:\s*var\(--destaque-suave\)/)
    expect(sob_mouse).toMatch(/color:\s*var\(--destaque-forte\)/)
  })
})
