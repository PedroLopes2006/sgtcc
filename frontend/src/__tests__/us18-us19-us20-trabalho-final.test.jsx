/**
 * US18 (aluno envia), US19 (orientador avalia) e US20 (envia à banca) — trabalho final.
 *
 * Quem decide o que cada lado pode fazer é a API (`pode_enviar`, `acoes`: RN12, RN16,
 * RN17); a tela só liga os botões liberados. Parecer obrigatório para pedir correção
 * (RN07) e justificativa obrigatória para reprovar (RN17).
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import api from '../api'
import { AuthProvider } from '../auth'
import AvaliarTrabalhoFinal from '../pages/orientador/AvaliarTrabalhoFinal'
import TrabalhoFinal from '../pages/aluno/TrabalhoFinal'

const ALUNO = { id: 1, nome: 'Bruno Alves', email: 'b@aluno.edu.br', perfil: 'aluno' }
const ORIENTADOR = { id: 2, nome: 'Marcos Ribeiro', email: 'm@prof.edu.br', perfil: 'orientador' }

const V1 = { id: 1, numero: 1, nome_original: 'tcc-v1.pdf', data_envio: '2026-11-01T12:00:00Z', arquivo_url: 'https://a.test/v1.pdf' }
const PARECER = {
  id: 1, autor: { id: 2, nome: 'Marcos Ribeiro' }, texto: 'Revise a conclusão.',
  versao: 1, data_criacao: '2026-11-03T12:00:00Z',
}

const SEM_ACAO = { aprovar: false, solicitar_correcao: false, reprovar: false, enviar_a_banca: false }

function trabalho(estado, acoes = {}, extras = {}) {
  return {
    id: 9,
    estado,
    estado_rotulo: estado,
    versoes_enviadas: 1,
    data_criacao: '2026-11-01T12:00:00Z',
    data_aprovacao: null,
    data_banca: null,
    versoes: [V1],
    comentarios: [],
    acoes: { ...SEM_ACAO, ...acoes },
    ...extras,
  }
}

function situacao(estado, extras = {}) {
  return {
    estado,
    estado_rotulo: estado,
    pode_enviar: false,
    pendentes: [],
    trabalho: null,
    ...extras,
  }
}

function telaDoAluno(payload) {
  localStorage.setItem('sgtcc.usuario', JSON.stringify(ALUNO))
  localStorage.setItem('sgtcc.access', 'token-de-teste')
  vi.spyOn(api, 'get').mockResolvedValue({ data: payload })
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/aluno/trabalho-final']}>
        <Routes>
          <Route path="/aluno/trabalho-final" element={<TrabalhoFinal />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

function telaDoOrientador(trabalhoFinal) {
  localStorage.setItem('sgtcc.usuario', JSON.stringify(ORIENTADOR))
  localStorage.setItem('sgtcc.access', 'token-de-teste')
  const get = vi.spyOn(api, 'get').mockImplementation((url) => {
    if (url === '/orientandos/3/trabalho-final/') {
      return Promise.resolve({ data: { aluno: { id: 1, nome: 'Bruno Alves' }, trabalho: trabalhoFinal } })
    }
    return Promise.resolve({ data: [] }) // contadores do menu
  })
  const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} })
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/orientador/orientandos/3/trabalho-final']}>
        <Routes>
          <Route path="/orientador/orientandos/:tccId/trabalho-final" element={<AvaliarTrabalhoFinal />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
  return { get, post }
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('US18 — o aluno envia o trabalho final', () => {
  it('CA2 / RN16: com entrega pendente, não oferece o envio e diz o que falta', async () => {
    telaDoAluno(
      situacao('nao_enviado', { pendentes: [{ id: 5, titulo: 'Metodologia', estado: 'em_revisao' }] }),
    )
    expect(await screen.findByText('Metodologia')).toBeInTheDocument()
    expect(screen.getByText(/só é liberado quando todas as entregas/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /enviar trabalho final/i })).not.toBeInTheDocument()
  })

  it('CA1: com tudo concluído, libera o envio do PDF', async () => {
    telaDoAluno(situacao('nao_enviado', { pode_enviar: true }))
    expect(await screen.findByRole('button', { name: 'Enviar trabalho final' })).toBeInTheDocument()
  })

  it('em avaliação: mostra a versão e não oferece novo envio', async () => {
    telaDoAluno(situacao('em_avaliacao', { trabalho: trabalho('em_avaliacao') }))
    expect(await screen.findByText(/está avaliando o trabalho/i)).toBeInTheDocument()
    expect(screen.getByText('Versão 1')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /enviar nova versão/i })).not.toBeInTheDocument()
  })

  it('CA3 / RN18: depois de correção solicitada, mostra o parecer e permite nova versão', async () => {
    telaDoAluno(
      situacao('correcao_solicitada', {
        pode_enviar: true,
        trabalho: trabalho('correcao_solicitada', {}, { comentarios: [PARECER] }),
      }),
    )
    expect(await screen.findByText('Revise a conclusão.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar nova versão' })).toBeInTheDocument()
  })

  it('RN18: reprovado mostra a justificativa e permite tentar de novo', async () => {
    telaDoAluno(
      situacao('reprovado', {
        pode_enviar: true,
        trabalho: trabalho('reprovado', {}, { comentarios: [{ ...PARECER, texto: 'Fora do escopo.' }] }),
      }),
    )
    expect(await screen.findByText('Fora do escopo.')).toBeInTheDocument()
    expect(screen.getByText(/reprovado\. leia a justificativa|foi reprovado/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar nova versão' })).toBeInTheDocument()
  })

  it('enviado à banca: diz que o TCC está concluído', async () => {
    telaDoAluno(
      situacao('enviado_a_banca', {
        trabalho: trabalho('enviado_a_banca', {}, { data_banca: '2026-11-20T12:00:00Z' }),
      }),
    )
    expect(await screen.findByText(/seu tcc está concluído/i)).toBeInTheDocument()
  })
})

describe('US19 — o orientador avalia o trabalho final', () => {
  it('CA1: aprovar pede confirmação e chama a API', async () => {
    const { post } = telaDoOrientador(
      trabalho('em_avaliacao', { aprovar: true, solicitar_correcao: true, reprovar: true }),
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Aprovar trabalho final' }))
    // Antes de confirmar nada é enviado: aprovar não tem volta.
    expect(post).not.toHaveBeenCalled()
    expect(screen.getByText(/depois disso, ele só pode ser enviado à banca/i)).toBeInTheDocument()
  })

  it('CA1: confirmar a aprovação envia o POST certo', async () => {
    const { post } = telaDoOrientador(
      trabalho('em_avaliacao', { aprovar: true, solicitar_correcao: true, reprovar: true }),
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Aprovar trabalho final' }))
    const dialogo = screen.getByRole('dialog')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Aprovar trabalho final' }))
    await waitFor(() => expect(post).toHaveBeenCalledWith('/trabalho-final/9/aprovar/', undefined))
  })

  it('CA2 / RN07: pedir correção sem parecer mostra o erro e não chama a API', async () => {
    const { post } = telaDoOrientador(
      trabalho('em_avaliacao', { aprovar: true, solicitar_correcao: true, reprovar: true }),
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Solicitar correção' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/comentário/i)
    expect(post).not.toHaveBeenCalled()
  })

  it('CA2: pedir correção com parecer envia o comentário', async () => {
    const { post } = telaDoOrientador(
      trabalho('em_avaliacao', { aprovar: true, solicitar_correcao: true, reprovar: true }),
    )
    await userEvent.type(await screen.findByLabelText('Parecer'), 'Revise a conclusão.')
    await userEvent.click(screen.getByRole('button', { name: 'Solicitar correção' }))
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/trabalho-final/9/solicitar-correcao/', {
        comentario: 'Revise a conclusão.',
      }),
    )
  })

  it('CA4 / RN17: reprovar sem justificativa mostra o erro e não chama a API', async () => {
    const { post } = telaDoOrientador(
      trabalho('em_avaliacao', { aprovar: true, solicitar_correcao: true, reprovar: true }),
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Reprovar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/justificativa/i)
    expect(post).not.toHaveBeenCalled()
  })

  it('CA3 / RN17: reprovar com justificativa pede confirmação e envia o texto', async () => {
    const { post } = telaDoOrientador(
      trabalho('em_avaliacao', { aprovar: true, solicitar_correcao: true, reprovar: true }),
    )
    await userEvent.type(await screen.findByLabelText('Parecer'), 'Fora do escopo do tema.')
    await userEvent.click(screen.getByRole('button', { name: 'Reprovar' }))
    expect(post).not.toHaveBeenCalled()
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reprovar trabalho final' }))
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/trabalho-final/9/reprovar/', {
        justificativa: 'Fora do escopo do tema.',
      }),
    )
  })

  it('sem ação liberada pela API, não mostra botão de avaliação', async () => {
    telaDoOrientador(trabalho('correcao_solicitada'))
    expect(await screen.findByText(/aguardando o aluno enviar uma nova versão/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /aprovar|reprovar|solicitar/i })).not.toBeInTheDocument()
  })

  it('trabalho ainda não enviado: avisa que não há o que avaliar', async () => {
    telaDoOrientador(null)
    expect(await screen.findByText(/ainda não enviado/i)).toBeInTheDocument()
  })
})

describe('US20 — enviar o trabalho final à banca', () => {
  it('só o aprovado mostra "Enviar à banca"; confirmar chama a API', async () => {
    const { post } = telaDoOrientador(trabalho('aprovado', { enviar_a_banca: true }))
    await userEvent.click(await screen.findByRole('button', { name: 'Enviar à banca' }))
    expect(post).not.toHaveBeenCalled()
    const dialogo = screen.getByRole('dialog')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Enviar à banca' }))
    await waitFor(() => expect(post).toHaveBeenCalledWith('/trabalho-final/9/enviar-a-banca/', undefined))
  })

  it('RN12: em avaliação não mostra "Enviar à banca"', async () => {
    telaDoOrientador(trabalho('em_avaliacao', { aprovar: true, solicitar_correcao: true, reprovar: true }))
    await screen.findByRole('button', { name: 'Aprovar trabalho final' })
    expect(screen.queryByRole('button', { name: 'Enviar à banca' })).not.toBeInTheDocument()
  })
})
