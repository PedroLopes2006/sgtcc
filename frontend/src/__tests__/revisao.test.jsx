/**
 * Testes de fumaça da US10 e da US11: os botões do orientador e o comentário
 * que o aluno lê.
 *
 * Quem decide qual entrega espera o orientador é a API (`entrega_para_revisao`);
 * a tela só liga o botão do estado certo (RN06). O comentário da correção é
 * obrigatório também na interface (RN07).
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

describe('Revisão do orientador (US10 e US11)', () => {
  function entrega(id, titulo, estado) {
    return { id, titulo, estado, prazo: '2026-11-24', atrasada: false }
  }

  function linha(id, nome, entregaParaRevisao) {
    return {
      id,
      aluno: { id, nome },
      tema: { id, titulo: `Tema de ${nome}`, status: 'aprovado' },
      entregas: entregaParaRevisao ? [entregaParaRevisao] : [],
      fase_atual: entregaParaRevisao ? entregaParaRevisao.titulo : 'Sem entregas',
      estado: { codigo: 'aprovado', rotulo: 'Tema aprovado' },
      progresso: { concluidas: 0, total: entregaParaRevisao ? 1 : 0 },
      prazo: null,
      prazo_vencido: false,
      aguarda_avaliacao_de_tema: false,
      entrega_para_revisao: entregaParaRevisao,
    }
  }

  const PRONTA = linha(1, 'Carla Dias', entrega(5, 'Referencial teórico', 'pronto_para_revisao'))
  const EM_REVISAO = linha(2, 'Bruno Alves', entrega(6, 'Metodologia', 'em_revisao'))
  const SEM_PENDENCIA = linha(3, 'Davi Souza', null)

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

  it('liga cada botão só na entrega do estado certo (RN06)', async () => {
    renderizarPainel([PRONTA, EM_REVISAO, SEM_PENDENCIA])

    expect(await screen.findByText('Carla Dias')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Iniciar revisão de Referencial teórico' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Solicitar correção de Metodologia' }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Iniciar revisão/ })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: /Solicitar correção/ })).toHaveLength(1)
  })

  it('inicia a revisão, avisa que o aluno foi notificado e recarrega a tabela (US10 CA1)', async () => {
    const get = renderizarPainel([PRONTA])
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} })

    await userEvent.click(
      await screen.findByRole('button', { name: 'Iniciar revisão de Referencial teórico' }),
    )

    await waitFor(() => expect(post).toHaveBeenCalledWith('/entregas/5/iniciar-revisao/'))
    expect(
      await screen.findByText('Revisão de "Referencial teórico" iniciada. O aluno foi avisado.'),
    ).toBeInTheDocument()
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2)) // carga inicial + recarga
  })

  it('mostra a mensagem da API quando a transição é recusada (US10 CA2)', async () => {
    renderizarPainel([PRONTA])
    vi.spyOn(api, 'post').mockRejectedValue({
      response: { data: { detail: 'Só é possível iniciar a revisão de uma entrega "pronta para revisão".' } },
    })

    await userEvent.click(
      await screen.findByRole('button', { name: 'Iniciar revisão de Referencial teórico' }),
    )

    expect(await screen.findByText(/Só é possível iniciar a revisão/)).toBeInTheDocument()
    expect(screen.queryByText(/O aluno foi avisado/)).not.toBeInTheDocument()
  })

  it('exige o comentário antes de enviar a solicitação de correção (US11 CA2)', async () => {
    renderizarPainel([EM_REVISAO])
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} })

    await userEvent.click(
      await screen.findByRole('button', { name: 'Solicitar correção de Metodologia' }),
    )
    const modal = screen.getByRole('dialog')
    expect(within(modal).getByText('Bruno Alves')).toBeInTheDocument()

    // Como no protótipo: o botão fica ativo e a mensagem aparece ao tentar enviar vazio.
    const enviar = within(modal).getByRole('button', { name: 'Solicitar correção' })
    await userEvent.click(enviar)
    expect(
      within(modal).getByText('Escreva um comentário para solicitar correção.'),
    ).toBeInTheDocument()

    await userEvent.type(within(modal).getByLabelText('Novo comentário'), '   ')
    await userEvent.click(enviar)
    expect(
      within(modal).getByText('Escreva um comentário para solicitar correção.'),
    ).toBeInTheDocument()
    expect(post).not.toHaveBeenCalled()
  })

  it('envia o comentário, fecha o modal e avisa o orientador (US11 CA1 e CA3)', async () => {
    const get = renderizarPainel([EM_REVISAO])
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} })

    await userEvent.click(
      await screen.findByRole('button', { name: 'Solicitar correção de Metodologia' }),
    )
    const modal = screen.getByRole('dialog')
    await userEvent.type(within(modal).getByLabelText('Novo comentário'), 'Revise a metodologia.')
    await userEvent.click(within(modal).getByRole('button', { name: 'Solicitar correção' }))

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/entregas/6/solicitar-correcao/', {
        comentario: 'Revise a metodologia.',
      }),
    )
    expect(
      await screen.findByText('Correção solicitada em "Metodologia". O aluno foi avisado.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2))
  })
})

describe('Comentário da correção para o aluno (US11)', () => {
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

  const COMENTARIO = {
    id: 1,
    autor: { id: 2, nome: 'Marcos Ribeiro' },
    texto: 'Revise a fundamentação teórica.',
    versao: 2,
    data_criacao: '2026-10-30T12:00:00Z',
  }

  it('mostra o que o orientador pediu quando a correção foi solicitada', async () => {
    renderizarEntregas({
      id: 5, titulo: 'Referencial teórico', estado: 'correcao_solicitada', prazo: '2026-11-24',
      atrasada: false, aceita_versao: true, numero_da_proxima_versao: 3,
      ultimo_comentario: COMENTARIO,
    })

    expect(await screen.findByText('Revise a fundamentação teórica.')).toBeInTheDocument()
    expect(screen.getByText('Marcos Ribeiro · versão 2 · 30 out')).toBeInTheDocument()
    // O aviso do protótipo, no topo da lista.
    expect(screen.getByText('Seu orientador pediu correção')).toBeInTheDocument()
    expect(screen.getByText('Referencial teórico · Marcos Ribeiro')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar versão' })).toBeInTheDocument()
  })

  it('não mostra o comentário antigo depois que a entrega voltou a rascunho', async () => {
    renderizarEntregas({
      id: 5, titulo: 'Referencial teórico', estado: 'rascunho', prazo: '2026-11-24',
      atrasada: false, aceita_versao: true, numero_da_proxima_versao: 3,
      ultimo_comentario: COMENTARIO,
    })

    expect(await screen.findByText('Referencial teórico')).toBeInTheDocument()
    expect(screen.queryByText('Revise a fundamentação teórica.')).not.toBeInTheDocument()
    expect(screen.queryByText('Seu orientador pediu correção')).not.toBeInTheDocument()
  })
})
