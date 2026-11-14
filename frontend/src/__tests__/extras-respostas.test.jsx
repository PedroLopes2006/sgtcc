/**
 * EXTRAS — fora dos requisitos do documento, da rodada "respostas visuais":
 * pílula de atenção no Meu TCC, botões com seta e as regras de CSS que fazem os botões
 * responderem ao mouse e ao toque e o layout se adaptar a cada tela.
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'

import { AuthProvider } from '../auth'
import PilulaDeAtencao from '../components/PilulaDeAtencao'
import Cadastro from '../pages/Cadastro'
import Login from '../pages/Login'

// O Vitest roda na raiz do frontend; o jsdom não dá uma URL de arquivo para este módulo.
const CSS = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8')

afterEach(cleanup)

const entrega = (extras = {}) => ({
  id: 1, titulo: 'Capítulo 1', estado: 'rascunho', prazo: '2099-12-31', ...extras,
})

function mostrar(entregas) {
  return render(
    <MemoryRouter>
      <PilulaDeAtencao entregas={entregas} />
    </MemoryRouter>,
  )
}

describe('Pílula de atenção (extra)', () => {
  it('com correção pedida, avisa isso e leva às entregas', () => {
    mostrar([entrega(), entrega({ id: 2, titulo: 'Capítulo 2', estado: 'correcao_solicitada' })])

    const pilula = screen.getByRole('link')

    expect(pilula).toHaveTextContent('Correção')
    expect(pilula).toHaveTextContent('Capítulo 2')
    expect(pilula).toHaveClass('destaque')
    expect(pilula).toHaveAttribute('href', '/aluno/entregas')
  })

  it('sem correção, mostra o prazo mais próximo entre as entregas em aberto', () => {
    mostrar([
      entrega({ id: 1, titulo: 'Depois', prazo: '2099-12-31' }),
      entrega({ id: 2, titulo: 'Antes', prazo: '2098-06-01' }),
      entrega({ id: 3, titulo: 'Já feita', prazo: '2000-01-01', estado: 'concluida' }),
    ])

    const pilula = screen.getByRole('link')

    expect(pilula).toHaveTextContent('Próximo prazo')
    expect(pilula).toHaveTextContent('Antes')
    expect(pilula).not.toHaveTextContent('Já feita')
    expect(pilula).toHaveTextContent(/faltam \d+ dias/)
  })

  it('prazo vencido ganha o tom de vencido', () => {
    mostrar([entrega({ prazo: '2000-01-01' })])

    expect(screen.getByRole('link')).toHaveClass('vencido')
    expect(screen.getByRole('link')).toHaveTextContent(/vencido há/)
  })

  it('sem entregas em aberto, não aparece', () => {
    const { container } = mostrar([entrega({ estado: 'concluida' }), entrega({ id: 2, estado: 'enviada_a_banca' })])
    expect(container).toBeEmptyDOMElement()
    expect(mostrar([]).container).toBeEmptyDOMElement()
  })
})

describe('Botões com seta (extra)', () => {
  function abrir(tela, rota) {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={[rota]}>
          <Routes>
            <Route path={rota} element={tela} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )
  }

  it('Entrar e Criar conta levam a seta', () => {
    abrir(<Login />, '/login')
    expect(screen.getByRole('button', { name: 'Entrar' })).toHaveClass('seta')
    cleanup()
    abrir(<Cadastro />, '/cadastro')
    expect(screen.getByRole('button', { name: 'Criar conta' })).toHaveClass('seta')
  })

  it('a seta é desenhada com bordas (não é um caractere) e desliza no hover e no foco', () => {
    const regra = CSS.match(/\.seta::after,\s*\.pilula::after\s*\{([^}]*)\}/)[1]
    expect(regra).toMatch(/content:\s*'';/)
    expect(regra).toMatch(/border-top:\s*2px solid currentColor;/)
    expect(regra).toMatch(/border-right:\s*2px solid currentColor;/)
    expect(CSS).toMatch(/\.seta:hover:not\(:disabled\)::after,[\s\S]*?\{[^}]*translateX\(3px\) rotate\(45deg\)/)
  })

  it('nenhum caractere de seta, visto ou fechar está no CSS nem nos componentes (só ícones desenhados)', () => {
    const { readdirSync } = require('node:fs')
    const pasta = resolve(process.cwd(), 'src/components')
    const fontes = readdirSync(pasta)
      .filter((f) => f.endsWith('.jsx'))
      .map((f) => readFileSync(resolve(pasta, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''))
    const codigo = [CSS.replace(/\/\*[\s\S]*?\*\//g, ''), ...fontes].join('\n')
    expect(codigo).not.toMatch(/[→✓✕✗▾▸▼▲]/)
  })
})

describe('Botões que respondem (extra)', () => {
  it('os botões são em pílula, e os que têm forma própria mantêm a sua', () => {
    expect(CSS).toMatch(/\nbutton,\s*a\.contorno\s*\{\s*border-radius:\s*999px;/)
    expect(CSS).toMatch(/\.segmentado button,\s*\.segmentado button:hover:not\(:disabled\)\s*\{[^}]*border-radius:\s*0;/)
  })

  it('o botão sobe no hover só em quem tem mouse, e afunda ao clicar', () => {
    const hover = CSS.match(/@media \(hover: hover\)\s*\{([\s\S]*?)\n\}/)
    expect(hover, 'bloco de hover').not.toBeNull()
    expect(hover[1]).toMatch(/translateY\(-1px\)/)
    expect(CSS).toMatch(/button:active:not\(:disabled\),\s*a\.contorno:active\s*\{[^}]*translateY\(1px\)/)
  })

  it('o clique em tela de toque não deixa o botão "preso" no hover', () => {
    // Nada de transformação fora do bloco que só vale com mouse, exceto o clique (active).
    const fora = CSS.replace(/@media \(hover: hover\)\s*\{[\s\S]*?\n\}/, '')
    expect(fora).not.toMatch(/button:hover[^{]*\{[^}]*translateY\(-1px\)/)
  })
})

describe('Etiquetas e cartões (extra)', () => {
  it('as etiquetas pequenas usam a fonte do texto, em caixa normal e legíveis', () => {
    const regra = CSS.match(/\.indicadores dt,[\s\S]*?\.pilula-tag\s*\{([^}]*)\}/)[1]
    expect(regra).toMatch(/font-family:\s*var\(--fonte-texto\)/)
    expect(regra).toMatch(/text-transform:\s*none/)
    expect(regra).toMatch(/font-size:\s*12px/)
    expect(CSS).not.toMatch(/ui-monospace/)
  })

  it('os cartões de conteúdo têm o traço do destaque no topo, que se alonga no hover', () => {
    expect(CSS).toMatch(/\.atalhos-cartao::before,[\s\S]*?\{[^}]*height:\s*2px;/)
    expect(CSS).toMatch(/\.atalhos-cartao:hover::before,[\s\S]*?\{[^}]*width:\s*72px;/)
  })

  it('nada é numerado por contador, porque nada ali é uma sequência', () => {
    expect(CSS).not.toMatch(/counter-reset|counter-increment|decimal-leading-zero/)
  })
})

describe('Adaptação a cada tela (extra)', () => {
  it('título e espaços crescem e encolhem com a tela', () => {
    expect(CSS).toMatch(/\.cabecalho-pagina h1\s*\{\s*font-size:\s*clamp\(/)
    expect(CSS).toMatch(/\.conteudo\s*\{\s*padding:\s*clamp\(/)
  })

  it('no celular, o topo é compacto e o menu vira uma fita rolável', () => {
    const celular = CSS.match(/@media \(max-width: 720px\)\s*\{\s*\/\* Topo compacto[\s\S]*?\n\}\n\n\/\* Janelas/)
    expect(celular, 'bloco do topo compacto').not.toBeNull()
    expect(celular[0]).toMatch(/flex-direction:\s*row;/)
    expect(celular[0]).toMatch(/overflow-x:\s*auto;/)
    expect(celular[0]).toMatch(/\.sidebar-usuario > span:not\(\.avatar\)\s*\{\s*display:\s*none;/)
  })

  it('em tela pequena, as janelas sobem do rodapé e os botões ocupam a largura', () => {
    const pequena = CSS.match(/@media \(max-width: 520px\)\s*\{\s*\.fundo-modal[\s\S]*?\n\}\n\n\/\* Telas muito largas/)
    expect(pequena, 'bloco das janelas').not.toBeNull()
    expect(pequena[0]).toMatch(/align-items:\s*end;/)
    expect(pequena[0]).toMatch(/border-radius:\s*var\(--raio-g\) var\(--raio-g\) 0 0;/)
    expect(pequena[0]).toMatch(/\.modal \.barra-acoes > button,[\s\S]*?width:\s*100%;/)
  })
})
