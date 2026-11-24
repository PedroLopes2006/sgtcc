/**
 * Logo e ícone do SGTCC: o símbolo (o percurso em degraus do Caminho do TCC) aparece ao lado do
 * nome no menu e nas telas de entrada, e é o mesmo desenho do ícone da aba do navegador.
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'

import { AuthProvider } from '../auth'
import Layout from '../components/Layout'
import Logo from '../components/Logo'
import PainelMarca from '../components/PainelMarca'
import Cadastro from '../pages/Cadastro'
import Login from '../pages/Login'

// O Vitest roda na raiz do frontend; o jsdom não dá uma URL de arquivo para este módulo.
const raiz = (...partes) => resolve(process.cwd(), ...partes)
// O Git no Windows pode gravar o arquivo com CRLF; os testes comparam com \n.
const CSS = readFileSync(raiz('src/styles.css'), 'utf8').replace(/\r\n/g, '\n')

afterEach(cleanup)

describe('Logo (símbolo + nome)', () => {
  it('mostra o símbolo ao lado do nome, e o símbolo fica escondido do leitor de tela', () => {
    const { container } = render(<Logo />)

    expect(screen.getByText('SGTCC')).toBeInTheDocument()
    const simbolo = container.querySelector('svg.logo-simbolo')
    expect(simbolo).toHaveAttribute('aria-hidden', 'true')
    expect(simbolo).toHaveAttribute('viewBox', '0 0 32 32')
  })

  it('as cores do símbolo vêm do tema, então o menu escuro o inverte sozinho', () => {
    const { container } = render(<Logo />)

    expect(container.querySelector('rect')).toHaveAttribute('fill', 'var(--destaque)')
    expect(container.querySelector('path')).toHaveAttribute('stroke', 'var(--acao-texto)')
  })

  it('o tamanho do símbolo é configurável', () => {
    const { container } = render(<Logo tamanho={40} />)

    expect(container.querySelector('svg')).toHaveAttribute('width', '40')
  })

  it('o menu lateral e o painel de entrada usam o mesmo logo', () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <PainelMarca />
        </MemoryRouter>
      </AuthProvider>,
    )
    expect(document.querySelector('.painel-marca svg.logo-simbolo')).toBeInTheDocument()
    cleanup()

    localStorage.setItem('sgtcc.usuario', JSON.stringify({ id: 1, nome: 'Lucas', perfil: 'aluno' }))
    render(
      <AuthProvider>
        <MemoryRouter>
          <Layout itens={[{ rotulo: 'Meu TCC', para: '/aluno' }]}>
            <p>Conteúdo</p>
          </Layout>
        </MemoryRouter>
      </AuthProvider>,
    )
    expect(document.querySelector('.sidebar svg.logo-simbolo')).toBeInTheDocument()
    localStorage.clear()
  })

  it('as telas de entrar e criar conta abrem o cartão com o símbolo (para o celular, sem o painel)', () => {
    for (const [Tela, rota] of [[Login, '/login'], [Cadastro, '/cadastro']]) {
      render(
        <AuthProvider>
          <MemoryRouter initialEntries={[rota]}>
            <Routes>
              <Route path={rota} element={<Tela />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>,
      )
      expect(document.querySelector('.cartao-acesso > svg.logo-simbolo')).toBeInTheDocument()
      cleanup()
    }
    // No desktop o painel de marca já mostra o logo, então o do cartão some.
    expect(CSS).toMatch(/@media \(min-width: 900px\)\s*\{\s*\.cartao-acesso > \.logo-simbolo\s*\{\s*display:\s*none;/)
  })
})

describe('Ícone da aba do navegador', () => {
  const html = readFileSync(raiz('index.html'), 'utf8')

  it('o favicon em SVG existe e está ligado no index.html', () => {
    expect(existsSync(raiz('public/favicon.svg'))).toBe(true)
    expect(html).toMatch(/<link rel="icon" type="image\/svg\+xml" href="\/favicon\.svg"/)
  })

  it('o ícone do iOS existe como PNG de 180×180 e está ligado no index.html', () => {
    const png = raiz('public/apple-touch-icon.png')
    expect(existsSync(png)).toBe(true)
    expect(statSync(png).size).toBeGreaterThan(200)
    const cabecalho = readFileSync(png)
    expect(cabecalho.subarray(1, 4).toString()).toBe('PNG')
    expect(cabecalho.readUInt32BE(16)).toBe(180) // largura
    expect(cabecalho.readUInt32BE(20)).toBe(180) // altura
    expect(html).toMatch(/<link rel="apple-touch-icon" href="\/apple-touch-icon\.png"/)
  })

  it('a cor da barra do navegador acompanha o tema claro e o escuro', () => {
    expect(html).toMatch(/<meta name="theme-color" content="#eeece7" media="\(prefers-color-scheme: light\)"/)
    expect(html).toMatch(/<meta name="theme-color" content="#0e0e0d" media="\(prefers-color-scheme: dark\)"/)
  })

  it('o favicon e o logo da tela são o mesmo desenho (a mesma geometria)', () => {
    const svg = readFileSync(raiz('public/favicon.svg'), 'utf8')
    const logo = readFileSync(raiz('src/components/Logo.jsx'), 'utf8')
    for (const parte of ['M8.5 22.5H16V9.5h7.5', 'cx="8.5" cy="22.5" r="2.6"', 'cx="23.5" cy="9.5" r="3.2"', 'rx="8"']) {
      expect(svg, `favicon: ${parte}`).toContain(parte)
      expect(logo, `Logo.jsx: ${parte}`).toContain(parte)
    }
  })

  it('o favicon não depende de nada externo e é leve', () => {
    const svg = readFileSync(raiz('public/favicon.svg'), 'utf8')
    expect(svg).not.toMatch(/href=|url\(|<image|<style|<script/)
    expect(svg.length).toBeLessThan(1000)
  })
})
