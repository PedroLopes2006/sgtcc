/**
 * EXTRA — tela de Revisão do orientador (protótipo do Figma).
 *
 * Fora dos requisitos do documento: não há RF, RN nem US para ela. A tela reúne
 * o que as US07, US10, US11, US12 e US13 já fazem. Quem decide o que o
 * orientador pode fazer é a API (`acoes`, RN06); a tela só liga os botões que
 * ela libera. O comentário é obrigatório para pedir correção (RN07).
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import api from '../api'
import { AuthProvider } from '../auth'
import Orientandos from '../pages/orientador/Orientandos'
import RevisaoEntrega from '../pages/orientador/RevisaoEntrega'

const ORIENTADOR = { id: 2, nome: 'Marcos Ribeiro', email: 'm@prof.edu.br', perfil: 'orientador' }

const NENHUMA = {
  iniciar_revisao: false,
  solicitar_correcao: false,
  aprovar: false,
  comentar: false,
  enviar_a_banca: false,
}

const V1 = { id: 1, numero: 1, nome_original: 'v1.pdf', data_envio: '2026-10-01T12:00:00Z', arquivo_url: 'https://a.test/v1.pdf' }
const V2 = { id: 2, numero: 2, nome_original: 'v2.pdf', data_envio: '2026-10-05T12:00:00Z', arquivo_url: 'https://a.test/v2.pdf' }
const COMENTARIO = {
  id: 1, autor: { id: 2, nome: 'Marcos Ribeiro' }, texto: 'Revise a fundamentação.',
  versao: 1, data_criacao: '2026-10-03T12:00:00Z',
}

function entrega(estado, acoes = {}, extras = {}) {
  return {
    id: 6,
    titulo: 'Metodologia',
    estado,
    prazo: '2026-11-24',
    atrasada: false,
    aluno: { id: 1, nome: 'Bruno Alves' },
    tema: 'Análise de dados educacionais',
    versao_atual: V2,
    versoes: [V1, V2],
    comentarios: [],
    data_conclusao: null,
    acoes: { ...NENHUMA, ...acoes },
    ...extras,
  }
}

function renderizar(payload) {
  localStorage.setItem('sgtcc.usuario', JSON.stringify(ORIENTADOR))
  localStorage.setItem('sgtcc.access', 'token-de-teste')
  const get = vi.spyOn(api, 'get').mockImplementation((url) => {
    if (url === '/entregas/6/revisao/') {
      return payload instanceof Error ? Promise.reject(payload) : Promise.resolve({ data: payload })
    }
    return Promise.resolve({ data: [] }) // os contadores do menu
  })
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/orientador/entregas/6']}>
        <Routes>
          <Route path="/orientador/entregas/:entregaId" element={<RevisaoEntrega />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
  return get
}

const cargas = (get) => get.mock.calls.filter(([url]) => url === '/entregas/6/revisao/').length

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('Tela de Revisão (extra)', () => {
  it('mostra a entrega, o aluno, as versões da mais nova para a mais antiga e os comentários', async () => {
    renderizar(entrega('correcao_solicitada', { comentar: true }, { comentarios: [COMENTARIO] }))

    expect(await screen.findByRole('heading', { name: 'Metodologia' })).toBeInTheDocument()
    expect(screen.getByText(/Bruno Alves · prazo 24 nov · versão 2/)).toBeInTheDocument()

    const versoes = within(screen.getByRole('region', { name: 'Versões' })).getAllByRole('listitem')
    expect(versoes[0]).toHaveTextContent('Versão 2 · atual')
    expect(versoes[1]).toHaveTextContent('Versão 1')
    expect(within(versoes[1]).getByRole('link', { name: /Abrir versão 1/ })).toHaveAttribute(
      'href',
      'https://a.test/v1.pdf',
    )

    const comentarios = screen.getByRole('region', { name: 'Comentários' })
    expect(within(comentarios).getByText('Revise a fundamentação.')).toBeInTheDocument()
    expect(within(comentarios).getByText(/Marcos Ribeiro · versão 1 · 3 out/)).toBeInTheDocument()
    expect(screen.getByText('Tema: Análise de dados educacionais')).toBeInTheDocument()
  })

  it('pronta para revisão: só "Iniciar revisão", sem campo de comentário', async () => {
    const get = renderizar(entrega('pronto_para_revisao', { iniciar_revisao: true }))
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} })

    expect(await screen.findByText('Inicie a revisão para comentar.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Novo comentário')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aprovar entrega' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Iniciar revisão' }))

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/entregas/6/iniciar-revisao/', undefined),
    )
    expect(await screen.findByText('Revisão iniciada. O aluno foi avisado.')).toBeInTheDocument()
    await waitFor(() => expect(cargas(get)).toBe(2)) // carga inicial + recarga
  })

  it('exige o comentário para solicitar correção (RN07) e envia quando há texto', async () => {
    renderizar(
      entrega('em_revisao', { solicitar_correcao: true, aprovar: true, comentar: true }),
    )
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} })

    await userEvent.click(await screen.findByRole('button', { name: 'Solicitar correção' }))
    expect(screen.getByText('Escreva um comentário para solicitar correção.')).toBeInTheDocument()
    expect(post).not.toHaveBeenCalled()

    await userEvent.type(screen.getByLabelText('Novo comentário'), 'Ajuste a metodologia.')
    await userEvent.click(screen.getByRole('button', { name: 'Solicitar correção' }))

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/entregas/6/solicitar-correcao/', {
        comentario: 'Ajuste a metodologia.',
      }),
    )
    expect(await screen.findByText('Correção solicitada. O aluno foi avisado.')).toBeInTheDocument()
  })

  it('aprova a entrega sem exigir comentário', async () => {
    renderizar(entrega('em_revisao', { solicitar_correcao: true, aprovar: true, comentar: true }))
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} })

    await userEvent.click(await screen.findByRole('button', { name: 'Aprovar entrega' }))

    await waitFor(() => expect(post).toHaveBeenCalledWith('/entregas/6/aprovar/', undefined))
    expect(await screen.findByText('Entrega aprovada. O aluno foi avisado.')).toBeInTheDocument()
  })

  it('acrescenta um comentário sem mudar o estado, e exige o texto (RN07, RN14)', async () => {
    renderizar(entrega('em_revisao', { solicitar_correcao: true, aprovar: true, comentar: true }))
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} })

    await userEvent.click(await screen.findByRole('button', { name: 'Adicionar comentário' }))
    expect(screen.getByText('Escreva um comentário para adicioná-lo.')).toBeInTheDocument()
    expect(post).not.toHaveBeenCalled()

    await userEvent.type(screen.getByLabelText('Novo comentário'), 'Inclua as limitações.')
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar comentário' }))

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/entregas/6/comentarios/', {
        comentario: 'Inclua as limitações.',
      }),
    )
    expect(await screen.findByText('Comentário adicionado. O aluno foi avisado.')).toBeInTheDocument()
  })

  it('com correção solicitada, só permite acrescentar comentário', async () => {
    renderizar(entrega('correcao_solicitada', { comentar: true }, { comentarios: [COMENTARIO] }))

    expect(await screen.findByRole('button', { name: 'Adicionar comentário' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Solicitar correção' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aprovar entrega' })).not.toBeInTheDocument()
  })

  it('concluída: informa a data e oferece "Enviar à banca"', async () => {
    renderizar(
      entrega('concluida', { enviar_a_banca: true }, { data_conclusao: '2026-10-03T12:00:00Z' }),
    )
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} })

    expect(await screen.findByText('Entrega aprovada em 3 out.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Enviar à banca' }))

    await waitFor(() => expect(post).toHaveBeenCalledWith('/entregas/6/enviar-a-banca/', undefined))
    expect(await screen.findByText('Entrega enviada à banca.')).toBeInTheDocument()
  })

  it('enviada à banca: só informa, sem nenhum botão de ação', async () => {
    renderizar(entrega('enviada_a_banca'))

    expect(await screen.findByText('Entrega enviada à banca.')).toBeInTheDocument()
    expect(within(screen.getByRole('main')).queryByRole('button')).not.toBeInTheDocument()
  })

  it('explica por que não há ação quando não é a vez da entrega (RN06)', async () => {
    renderizar(entrega('em_revisao'))
    expect(
      await screen.findByText('Só é possível revisar a primeira entrega pendente do aluno.'),
    ).toBeInTheDocument()
    expect(within(screen.getByRole('main')).queryByRole('button')).not.toBeInTheDocument()
  })

  it('rascunho: diz que o aluno ainda não sinalizou a entrega como pronta', async () => {
    renderizar(entrega('rascunho'))
    expect(
      await screen.findByText('O aluno ainda não sinalizou esta entrega como pronta.'),
    ).toBeInTheDocument()
  })

  it('mostra o erro da API quando a ação é recusada', async () => {
    renderizar(entrega('em_revisao', { solicitar_correcao: true, aprovar: true, comentar: true }))
    vi.spyOn(api, 'post').mockRejectedValue({
      response: { data: { detail: 'Você não é o orientador ativo deste TCC.' } },
    })

    await userEvent.click(await screen.findByRole('button', { name: 'Aprovar entrega' }))

    expect(await screen.findByText('Você não é o orientador ativo deste TCC.')).toBeInTheDocument()
  })

  it('mostra o erro quando a entrega não pode ser aberta (RN05)', async () => {
    renderizar(
      Object.assign(new Error('403'), {
        response: { data: { detail: 'Você não é o orientador ativo deste TCC.' } },
      }),
    )

    expect(await screen.findByText('Você não é o orientador ativo deste TCC.')).toBeInTheDocument()
    expect(within(screen.getByRole('main')).queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('Acesso à tela de Revisão pela tabela de Orientandos (extra)', () => {
  function linha(id, nome, extras = {}) {
    return {
      id,
      aluno: { id, nome },
      tema: { id, titulo: `Tema de ${nome}`, status: 'aprovado' },
      entregas: [],
      fase_atual: 'Metodologia',
      estado: { codigo: 'aprovado', rotulo: 'Tema aprovado' },
      progresso: { concluidas: 0, total: 1 },
      prazo: null,
      prazo_vencido: false,
      aguarda_avaliacao_de_tema: false,
      entrega_para_revisao: null,
      entrega_para_comentario: null,
      entrega_para_banca: null,
      ...extras,
    }
  }

  function renderizarPainel(linhas) {
    localStorage.setItem('sgtcc.usuario', JSON.stringify(ORIENTADOR))
    localStorage.setItem('sgtcc.access', 'token-de-teste')
    vi.spyOn(api, 'get').mockResolvedValue({ data: linhas })
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/orientador']}>
          <Routes>
            <Route path="/orientador" element={<Orientandos />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )
  }

  it('oferece "Abrir revisão" na linha com entrega para revisar ou comentar', async () => {
    renderizarPainel([
      linha(1, 'Bruno Alves', {
        entrega_para_revisao: { id: 6, titulo: 'Metodologia', estado: 'em_revisao' },
      }),
      linha(2, 'Carla Dias', {
        entrega_para_comentario: { id: 9, titulo: 'Resultados', estado: 'correcao_solicitada' },
      }),
      linha(3, 'Davi Souza'),
    ])

    expect(
      await screen.findByRole('link', { name: 'Abrir revisão de Metodologia' }),
    ).toHaveAttribute('href', '/orientador/entregas/6')
    expect(screen.getByRole('link', { name: 'Abrir revisão de Resultados' })).toHaveAttribute(
      'href',
      '/orientador/entregas/9',
    )
    expect(screen.getAllByRole('link', { name: /Abrir revisão/ })).toHaveLength(2)
  })
})
