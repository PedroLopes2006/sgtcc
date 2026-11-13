/**
 * Testes de fumaça do comentário adicional (US11 / RF10).
 *
 * O orientador registra um comentário a mais, sem mudar o estado da entrega: o
 * anterior nunca é editado (RN14), então o ajuste vira um novo. Quem diz qual
 * entrega aceita o comentário é a API (`entrega_para_comentario`, só a primeira
 * pendente, RN06). O texto é obrigatório também na interface (RN07).
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import api from '../api'
import { AuthProvider } from '../auth'
import AreaAluno from '../pages/aluno/AreaAluno'
import Entregas from '../pages/aluno/Entregas'
import MeuTCC from '../pages/aluno/MeuTCC'
import Orientandos from '../pages/orientador/Orientandos'

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

const COMENTARIO_1 = {
  id: 1, autor: { id: 2, nome: 'Marcos Ribeiro' }, texto: 'Revise a fundamentação.',
  versao: 2, data_criacao: '2026-10-30T12:00:00Z',
}
const COMENTARIO_2 = {
  id: 2, autor: { id: 2, nome: 'Marcos Ribeiro' }, texto: 'Inclua também as limitações.',
  versao: 2, data_criacao: '2026-10-31T12:00:00Z',
}

describe('Adicionar comentário (orientador)', () => {
  function entrega(estado, comentarios = []) {
    return {
      id: 6, titulo: 'Metodologia', estado, prazo: '2026-11-24', atrasada: false, comentarios,
    }
  }

  function linha(id, nome, entregaParaComentario) {
    return {
      id,
      aluno: { id, nome },
      tema: { id, titulo: `Tema de ${nome}`, status: 'aprovado' },
      entregas: entregaParaComentario ? [entregaParaComentario] : [],
      fase_atual: entregaParaComentario ? entregaParaComentario.titulo : 'Sem entregas',
      estado: { codigo: 'aprovado', rotulo: 'Tema aprovado' },
      progresso: { concluidas: 0, total: entregaParaComentario ? 1 : 0 },
      prazo: null,
      prazo_vencido: false,
      aguarda_avaliacao_de_tema: false,
      entrega_para_revisao: null,
      entrega_para_comentario: entregaParaComentario,
      entrega_para_banca: null,
    }
  }

  function renderizarPainel(linhas) {
    entrarComo(ORIENTADOR)
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: linhas })
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/orientador']}>
          <Routes>
            <Route path="/orientador" element={<Orientandos />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )
    return get
  }

  it('só oferece o botão na linha cuja entrega aceita comentário', async () => {
    renderizarPainel([
      linha(1, 'Bruno Alves', entrega('correcao_solicitada')),
      linha(2, 'Davi Souza', null),
    ])

    expect(await screen.findByText('Bruno Alves')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Adicionar comentário em Metodologia' }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Adicionar comentário/ })).toHaveLength(1)
  })

  it('mostra o que já foi escrito, só para leitura, e exige o texto novo (RN07, RN14)', async () => {
    renderizarPainel([linha(1, 'Bruno Alves', entrega('correcao_solicitada', [COMENTARIO_1]))])
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} })

    await userEvent.click(
      await screen.findByRole('button', { name: 'Adicionar comentário em Metodologia' }),
    )
    const modal = screen.getByRole('dialog')

    expect(within(modal).getByText('Comentários anteriores')).toBeInTheDocument()
    expect(within(modal).getByText('Revise a fundamentação.')).toBeInTheDocument()
    // O comentário anterior não vira campo editável.
    expect(within(modal).getAllByRole('textbox')).toHaveLength(1)

    await userEvent.click(within(modal).getByRole('button', { name: 'Adicionar comentário' }))
    expect(
      within(modal).getByText('Escreva um comentário para adicioná-lo.'),
    ).toBeInTheDocument()
    expect(post).not.toHaveBeenCalled()
  })

  it('envia o comentário novo, avisa que o aluno foi notificado e recarrega a tabela', async () => {
    const get = renderizarPainel([
      linha(1, 'Bruno Alves', entrega('correcao_solicitada', [COMENTARIO_1])),
    ])
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} })

    await userEvent.click(
      await screen.findByRole('button', { name: 'Adicionar comentário em Metodologia' }),
    )
    const modal = screen.getByRole('dialog')
    await userEvent.type(within(modal).getByLabelText('Novo comentário'), 'Inclua as limitações.')
    await userEvent.click(within(modal).getByRole('button', { name: 'Adicionar comentário' }))

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/entregas/6/comentarios/', {
        comentario: 'Inclua as limitações.',
      }),
    )
    expect(
      await screen.findByText('Comentário adicionado em "Metodologia". O aluno foi avisado.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2)) // carga inicial + recarga
  })

  it('mostra a mensagem da API quando o comentário é recusado', async () => {
    renderizarPainel([linha(1, 'Bruno Alves', entrega('em_revisao'))])
    vi.spyOn(api, 'post').mockRejectedValue({
      response: { data: { detail: 'Só é possível comentar uma entrega "em revisão".' } },
    })

    await userEvent.click(
      await screen.findByRole('button', { name: 'Adicionar comentário em Metodologia' }),
    )
    const modal = screen.getByRole('dialog')
    await userEvent.type(within(modal).getByLabelText('Novo comentário'), 'Texto.')
    await userEvent.click(within(modal).getByRole('button', { name: 'Adicionar comentário' }))

    expect(await within(modal).findByText(/Só é possível comentar/)).toBeInTheDocument()
  })
})

describe('Comentários da correção (aluno)', () => {
  function tccComEntrega(entrega) {
    return {
      id: 1,
      aluno: ALUNO,
      orientador: { id: 2, nome: 'Prof. Marcos Ribeiro' },
      tema: {
        id: 9, titulo: 'Sistema de gestão de TCC', descricao: 'Plataforma web.',
        status: 'aprovado', justificativa_ajuste: '',
        data_proposta: '2026-08-20T12:00:00Z', data_aprovacao: '2026-08-25T12:00:00Z',
      },
      entregas: [entrega],
    }
  }

  function renderizarEntregas(entrega) {
    entrarComo(ALUNO)
    vi.spyOn(api, 'get').mockResolvedValue({ data: tccComEntrega(entrega) })
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/aluno/entregas']}>
          <Routes>
            <Route path="/aluno" element={<AreaAluno />}>
              <Route index element={<MeuTCC />} />
              <Route path="entregas" element={<Entregas />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )
  }

  const BASE = {
    id: 5, titulo: 'Referencial teórico', estado: 'correcao_solicitada', prazo: '2026-11-24',
    atrasada: false, aceita_versao: true, numero_da_proxima_versao: 3,
    versao_atual: { id: 2, numero: 2, nome_original: 'v2.pdf', arquivo_url: 'https://a.test/v2.pdf' },
  }

  it('mostra o pedido de correção e o comentário que veio depois', async () => {
    renderizarEntregas({
      ...BASE, comentarios: [COMENTARIO_1, COMENTARIO_2], ultimo_comentario: COMENTARIO_2,
    })

    expect(await screen.findByText('Revise a fundamentação.')).toBeInTheDocument()
    expect(screen.getByText('Inclua também as limitações.')).toBeInTheDocument()
  })

  it('só traz os comentários da versão que está em correção', async () => {
    const antigo = { ...COMENTARIO_1, id: 9, texto: 'Comentário da versão 1.', versao: 1 }
    renderizarEntregas({
      ...BASE, comentarios: [antigo, COMENTARIO_1], ultimo_comentario: COMENTARIO_1,
    })

    expect(await screen.findByText('Revise a fundamentação.')).toBeInTheDocument()
    expect(screen.queryByText('Comentário da versão 1.')).not.toBeInTheDocument()
  })

  it('cai no último comentário quando a API não manda a lista', async () => {
    renderizarEntregas({ ...BASE, ultimo_comentario: COMENTARIO_1 })
    expect(await screen.findByText('Revise a fundamentação.')).toBeInTheDocument()
  })
})
