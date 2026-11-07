/**
 * US09 — Fila de revisão (testes de fumaça).
 *
 * CA1: lista as entregas prontas para revisão, na ordem que a API manda, com
 * "Aluno · Entrega · Pronta para revisão · Enviada há N dias · versão N".
 * CA2: fila vazia com os textos do protótipo.
 * "Iniciar revisão" chama o endpoint da US10 e recarrega a lista.
 * O item "Fila de revisão" da barra lateral fica habilitado e com o contador.
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import api from '../api'
import { AuthProvider } from '../auth'
import { enviadaHa } from '../formato'
import FilaRevisao from '../pages/orientador/FilaRevisao'
import Orientandos from '../pages/orientador/Orientandos'

const ORIENTADOR = { id: 2, nome: 'Marcos Ribeiro', email: 'm@prof.edu.br', perfil: 'orientador' }

function diasAtras(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

function item(id, nome, titulo, { dias = 2, versao = 1, atrasada = false } = {}) {
  return {
    id,
    titulo,
    estado: 'pronto_para_revisao',
    prazo: '2026-12-20',
    atrasada,
    tcc: id,
    aluno: { id, nome },
    tema: `Tema de ${nome}`,
    versao_atual: versao
      ? { id, numero: versao, nome_original: `v${versao}.pdf`, arquivo_url: `http://x/v${versao}.pdf` }
      : null,
    pronta_em: diasAtras(dias),
  }
}

const DA_ANA = item(5, 'Ana Lima', 'Metodologia', { dias: 3, versao: 2 })
const DO_LUCAS = item(6, 'Lucas Andrade', 'Introdução', { dias: 1, versao: 1 })

function renderizar(rota, respostas) {
  localStorage.setItem('sgtcc.usuario', JSON.stringify(ORIENTADOR))
  localStorage.setItem('sgtcc.access', 'token-de-teste')
  const get = vi.spyOn(api, 'get').mockImplementation((url) => {
    const resposta = respostas[url]
    return Promise.resolve({ data: typeof resposta === 'function' ? resposta() : resposta ?? [] })
  })
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={[rota]}>
        <Routes>
          <Route path="/orientador" element={<Orientandos />} />
          <Route path="/orientador/fila" element={<FilaRevisao />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
  return get
}

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('Fila de revisão (US09)', () => {
  it('lista as entregas prontas na ordem da API, com aluno, entrega, dias e versão (CA1)', async () => {
    renderizar('/orientador/fila', { '/fila-revisao/': [DA_ANA, DO_LUCAS] })

    expect(await screen.findByText('Ana Lima · Metodologia')).toBeInTheDocument()
    const linhas = screen.getAllByRole('listitem')
    expect(linhas).toHaveLength(2)
    expect(linhas[0]).toHaveTextContent('Ana Lima · Metodologia')
    expect(linhas[1]).toHaveTextContent('Lucas Andrade · Introdução')

    expect(within(linhas[0]).getByText('Pronta para revisão')).toBeInTheDocument()
    expect(linhas[0]).toHaveTextContent('Enviada há 3 dias')
    expect(linhas[0]).toHaveTextContent('versão 2')
    expect(linhas[1]).toHaveTextContent('Enviada há 1 dia')
    expect(within(linhas[0]).getByRole('link', { name: 'Abrir versão 2 de Metodologia' }))
      .toHaveAttribute('href', 'http://x/v2.pdf')
  })

  it('mostra a mensagem de fila vazia do protótipo (CA2)', async () => {
    renderizar('/orientador/fila', { '/fila-revisao/': [] })

    expect(await screen.findByText('Nenhuma entrega aguardando revisão')).toBeInTheDocument()
    expect(
      screen.getByText('Quando um aluno sinalizar uma entrega como pronta, ela aparece aqui.'),
    ).toBeInTheDocument()
  })

  it('"Iniciar revisão" chama a US10 e recarrega a fila', async () => {
    let fila = [DA_ANA, DO_LUCAS]
    const get = renderizar('/orientador/fila', { '/fila-revisao/': () => fila })
    const post = vi.spyOn(api, 'post').mockImplementation(async () => {
      fila = [DO_LUCAS]
      return { data: {} }
    })

    await userEvent.click(
      await screen.findByRole('button', { name: 'Iniciar revisão de Metodologia' }),
    )

    await waitFor(() => expect(post).toHaveBeenCalledWith('/entregas/5/iniciar-revisao/'))
    expect(await screen.findByText(/Revisão de "Metodologia" iniciada/)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Ana Lima · Metodologia')).not.toBeInTheDocument())
    expect(get.mock.calls.filter(([url]) => url === '/fila-revisao/')).toHaveLength(2)
  })

  it('mostra o erro da API quando a revisão não pode ser iniciada', async () => {
    renderizar('/orientador/fila', { '/fila-revisao/': [DA_ANA] })
    vi.spyOn(api, 'post').mockRejectedValue({
      response: { data: { detail: 'Você não é o orientador ativo deste TCC.' } },
    })

    await userEvent.click(
      await screen.findByRole('button', { name: 'Iniciar revisão de Metodologia' }),
    )
    expect(await screen.findByText('Você não é o orientador ativo deste TCC.')).toBeInTheDocument()
  })

  it('destaca o prazo vencido do item', async () => {
    renderizar('/orientador/fila', {
      '/fila-revisao/': [item(7, 'Bia Costa', 'Resultados', { atrasada: true })],
    })
    expect(await screen.findByText(/vencido/)).toHaveClass('prazo-vencido')
  })
})

describe('Barra lateral do orientador (US09)', () => {
  it('na fila, o item "Fila de revisão" é link e mostra o contador de pendências', async () => {
    renderizar('/orientador/fila', {
      '/fila-revisao/': [DA_ANA, DO_LUCAS],
      '/orientandos/': [{ id: 1 }, { id: 2 }, { id: 3 }],
    })

    const fila = await screen.findByRole('link', { name: /Fila de revisão/ })
    expect(fila).toHaveAttribute('href', '/orientador/fila')
    await waitFor(() => expect(fila).toHaveTextContent('2'))
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /Orientandos/ })).toHaveTextContent('3'),
    )
  })

  it('em Orientandos, o contador da fila sai dos próprios dados, sem outra requisição', async () => {
    const linha = (id, estado) => ({
      id,
      aluno: { id, nome: `Aluno ${id}` },
      tema: { id, titulo: `Tema ${id}`, status: 'aprovado' },
      entregas: [],
      fase_atual: 'Introdução',
      estado: { codigo: 'aprovado', rotulo: 'Tema aprovado' },
      progresso: { concluidas: 0, total: 1 },
      prazo: null,
      prazo_vencido: false,
      aguarda_avaliacao_de_tema: false,
      entrega_para_revisao: estado ? { id: id + 10, titulo: `Entrega ${id}`, estado } : null,
    })
    const get = renderizar('/orientador', {
      '/orientandos/': [linha(1, 'pronto_para_revisao'), linha(2, 'em_revisao'), linha(3, null)],
    })

    const fila = await screen.findByRole('link', { name: /Fila de revisão/ })
    await waitFor(() => expect(fila).toHaveTextContent('1'))
    expect(get.mock.calls.map(([url]) => url)).not.toContain('/fila-revisao/')
  })
})

describe('enviadaHa (US09)', () => {
  const agora = new Date(2026, 10, 7, 9, 0)

  it('conta dias de calendário', () => {
    expect(enviadaHa(new Date(2026, 10, 7, 1, 0).toISOString(), agora)).toBe('Enviada hoje')
    expect(enviadaHa(new Date(2026, 10, 6, 23, 0).toISOString(), agora)).toBe('Enviada há 1 dia')
    expect(enviadaHa(new Date(2026, 10, 2, 12, 0).toISOString(), agora)).toBe('Enviada há 5 dias')
  })

  it('sem data, não mostra nada', () => {
    expect(enviadaHa(null, agora)).toBeNull()
  })
})
