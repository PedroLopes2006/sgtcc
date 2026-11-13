/** US12 CA1–CA2, US13 CA1, US15 CA1–CA2 / RN05–06, RN08, RN12 / RNF04: fumaça. */
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import api from '../api'
import { AuthProvider } from '../auth'
import Orientandos from '../pages/orientador/Orientandos'
import HistoricoOrientando from '../pages/orientador/HistoricoOrientando'

const orientador = { id: 2, nome: 'Marcos', perfil: 'orientador' }
const entrega = { id: 7, titulo: 'Introdução', estado: 'em_revisao' }
const linha = {
  id: 3, aluno: { nome: 'Lucas' }, tema: { titulo: 'Sistema', orientador },
  estado: { codigo: 'em_revisao', rotulo: 'Em revisão' }, progresso: { concluidas: 0, total: 1 },
  fase_atual: 'Introdução', entrega_para_revisao: entrega, entrega_para_banca: null,
}
beforeEach(() => {
  vi.restoreAllMocks()
  localStorage.setItem('sgtcc.usuario', JSON.stringify(orientador))
  localStorage.setItem('sgtcc.access', 'teste')
})
afterEach(() => { cleanup(); localStorage.clear() })

/** CA1–CA2 / RNF04: monta a tela autenticada e as rotas de histórico. */
function montar(historico = false) {
  render(<AuthProvider><MemoryRouter initialEntries={[historico ? '/orientador/orientandos/3/historico' : '/orientador']}>
    <Routes>
      <Route path="/orientador" element={<Orientandos />} />
      <Route path="/orientador/orientandos/:tccId/historico" element={<HistoricoOrientando />} />
    </Routes>
  </MemoryRouter></AuthProvider>)
}
/**
 * Responde às buscas da tela em ordem (a primeira carga, depois as recargas, que
 * repetem a última). O contador de avisos da barra lateral usa outra rota e tem a
 * sua resposta fixa, para não gastar uma das respostas da sequência.
 */
function respostasEmSequencia(...respostas) {
  const restantes = [...respostas]
  return vi.spyOn(api, 'get').mockImplementation((url) => {
    if (url === '/avisos/') return Promise.resolve({ data: { nao_lidos: 0, avisos: [] } })
    return Promise.resolve(restantes.length > 1 ? restantes.shift() : restantes[0])
  })
}
it('US12: aprova e atualiza o painel com a próxima entrega (CA1–CA2 / RN06)', async () => {
  const get = respostasEmSequencia(
    { data: [linha] },
    { data: [{ ...linha, fase_atual: 'Metodologia', entrega_para_revisao: null }] },
  )
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} })
  montar()
  await userEvent.click(await screen.findByRole('button', { name: 'Aprovar entrega Introdução' }))
  expect(post).toHaveBeenCalledWith('/entregas/7/aprovar/')
  expect(await screen.findByText('Metodologia')).toBeInTheDocument()
  expect(get.mock.calls.filter(([url]) => url !== '/avisos/')).toHaveLength(2)
})
it('US13: encontra concluída fora da revisão e envia à banca (CA1 / RN12)', async () => {
  respostasEmSequencia(
    { data: [{ ...linha, entrega_para_revisao: null, entrega_para_banca: { ...entrega, estado: 'concluida' } }] },
    { data: [] },
  )
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} })
  montar()
  await userEvent.click(await screen.findByRole('button', { name: 'Enviar à banca Introdução' }))
  expect(post).toHaveBeenCalledWith('/entregas/7/enviar-a-banca/')
  await waitFor(() => expect(screen.queryByRole('button', { name: /Enviar à banca/ })).not.toBeInTheDocument())
})
it('US12: exibe erro e mantém a ação disponível para tentar novamente (CA1)', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({ data: [linha] })
  vi.spyOn(api, 'post').mockRejectedValue(new Error('falha'))
  montar()
  await userEvent.click(await screen.findByRole('button', { name: 'Aprovar entrega Introdução' }))
  expect(await screen.findByText('Não foi possível concluir a ação.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Aprovar entrega Introdução' })).toBeEnabled()
})
it('US15: escolhe outro orientador e remove a linha após a troca (CA1 / RN05, RN08)', async () => {
  vi.spyOn(api, 'get').mockImplementation(url => Promise.resolve({ data: url === '/orientadores/' ? [orientador, { id: 9, nome: 'Ana' }] : [linha] }))
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} })
  montar()
  await userEvent.click(await screen.findByRole('button', { name: 'Mais ações de Lucas' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Reatribuir' }))
  await userEvent.selectOptions(await screen.findByLabelText('Orientador'), '9')
  vi.mocked(api.get).mockResolvedValue({ data: [] })
  const botoes = screen.getAllByRole('button', { name: 'Reatribuir' })
  await userEvent.click(botoes[botoes.length - 1])
  expect(post).toHaveBeenCalledWith('/orientandos/3/reatribuir/', { novo_orientador: 9 })
  expect(await screen.findByText('Você ainda não tem orientandos')).toBeInTheDocument()
})
it('US15: mostra tema, versões, comentários e eventos herdados (CA2 / RF14)', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({ data: {
    aluno: { nome: 'Lucas' }, tema: { titulo: 'Sistema', descricao: 'Tema preservado' }, orientacoes: [],
    entregas: [{ ...entrega, versoes: [{ id: 1, numero: 1, nome_original: 'tcc.pdf', arquivo_url: 'https://example.org/tcc.pdf' }], comentarios: [{ id: 1, autor: orientador, texto: 'Comentário anterior', versao: 1 }] }],
    eventos: [{ id: 1, descricao: 'Troca de orientador registrada' }],
  } })
  montar(true)
  expect(await screen.findByText('Tema preservado')).toBeInTheDocument()
  expect(screen.getByText('Comentário anterior')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Abrir versão 1/ })).toHaveAttribute('href', 'https://example.org/tcc.pdf')
  expect(screen.getByText(/Troca de orientador registrada/)).toBeInTheDocument()
})
it('US15: acesso negado ao histórico não exibe dados (RN05 / RNF04)', async () => {
  vi.spyOn(api, 'get').mockRejectedValue(new Error('negado'))
  montar(true)
  expect(await screen.findByText('Não foi possível carregar o histórico.')).toBeInTheDocument()
  expect(screen.queryByText('Lucas')).not.toBeInTheDocument()
})
