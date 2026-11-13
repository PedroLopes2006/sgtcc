/**
 * Melhorias de interface: aviso que some sozinho, menu "Mais ações", etapas da
 * entrega, linha do tempo por dia e busca na fila.
 */
import '@testing-library/jest-dom/vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import api from '../api'
import { AuthProvider } from '../auth'
import EtapasEntrega from '../components/EtapasEntrega'
import MenuMais from '../components/MenuMais'
import Toast from '../components/Toast'
import { chaveDoDia, mesEAno, rotuloDoDia } from '../formato'
import AreaAluno from '../pages/aluno/AreaAluno'
import Entregas from '../pages/aluno/Entregas'
import LinhaDoTempo from '../pages/aluno/LinhaDoTempo'
import FilaRevisao from '../pages/orientador/FilaRevisao'
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
  vi.useRealTimers()
  cleanup()
  localStorage.clear()
})

describe('Toast (aviso que some sozinho)', () => {
  it('mostra a mensagem como um aviso de status', () => {
    render(<Toast mensagem="Revisão iniciada." aoFechar={() => {}} />)
    expect(screen.getByRole('status')).toHaveTextContent('Revisão iniciada.')
  })

  it('não mostra nada sem mensagem', () => {
    render(<Toast mensagem="" aoFechar={() => {}} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('fecha pelo botão', async () => {
    const fechar = vi.fn()
    render(<Toast mensagem="Pronto." aoFechar={fechar} />)

    await userEvent.click(screen.getByRole('button', { name: 'Fechar aviso' }))

    expect(fechar).toHaveBeenCalledTimes(1)
  })

  it('some sozinho depois do tempo', () => {
    vi.useFakeTimers()
    const fechar = vi.fn()
    render(<Toast mensagem="Pronto." aoFechar={fechar} duracao={3000} />)

    act(() => vi.advanceTimersByTime(2999))
    expect(fechar).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(fechar).toHaveBeenCalledTimes(1)
  })

  it('redesenhar a tela com a mesma mensagem não prolonga o aviso', () => {
    vi.useFakeTimers()
    const fechar = vi.fn()
    const { rerender } = render(<Toast mensagem="Pronto." aoFechar={() => fechar()} duracao={3000} />)

    act(() => vi.advanceTimersByTime(2000))
    // A tela redesenha (uma função nova a cada vez) e o relógio segue de onde estava.
    rerender(<Toast mensagem="Pronto." aoFechar={() => fechar()} duracao={3000} />)
    act(() => vi.advanceTimersByTime(1000))

    expect(fechar).toHaveBeenCalledTimes(1)
  })

  it('uma mensagem nova reinicia o tempo', () => {
    vi.useFakeTimers()
    const fechar = vi.fn()
    const { rerender } = render(<Toast mensagem="Primeira." aoFechar={fechar} duracao={3000} />)

    act(() => vi.advanceTimersByTime(2000))
    rerender(<Toast mensagem="Segunda." aoFechar={fechar} duracao={3000} />)
    act(() => vi.advanceTimersByTime(2000))
    expect(fechar).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(1000))
    expect(fechar).toHaveBeenCalledTimes(1)
  })
})

describe('MenuMais', () => {
  function montar() {
    render(
      <div>
        <button>Fora do menu</button>
        <MenuMais rotulo="Mais ações de Ana">
          <button onClick={() => {}}>Reatribuir</button>
          <a href="/historico">Histórico</a>
        </MenuMais>
      </div>,
    )
    return screen.getByRole('button', { name: 'Mais ações de Ana' })
  }

  it('começa fechado, sem as ações no documento', () => {
    const gatilho = montar()

    expect(gatilho).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: 'Reatribuir' })).not.toBeInTheDocument()
  })

  it('abre e fecha pelo botão', async () => {
    const gatilho = montar()

    await userEvent.click(gatilho)
    expect(gatilho).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Reatribuir' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Histórico' })).toBeInTheDocument()

    await userEvent.click(gatilho)
    expect(screen.queryByRole('button', { name: 'Reatribuir' })).not.toBeInTheDocument()
  })

  it('fecha com Esc', async () => {
    await userEvent.click(montar())
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('button', { name: 'Reatribuir' })).not.toBeInTheDocument()
  })

  it('fecha ao clicar fora', async () => {
    await userEvent.click(montar())
    await userEvent.click(screen.getByRole('button', { name: 'Fora do menu' }))
    expect(screen.queryByRole('button', { name: 'Reatribuir' })).not.toBeInTheDocument()
  })

  it('fecha ao escolher uma ação', async () => {
    await userEvent.click(montar())
    await userEvent.click(screen.getByRole('button', { name: 'Reatribuir' }))
    expect(screen.queryByRole('button', { name: 'Reatribuir' })).not.toBeInTheDocument()
  })
})

describe('Menu "Mais ações" na tabela de Orientandos', () => {
  it('guarda Histórico e Reatribuir, e as mantém fora da vista até abrir', async () => {
    entrarComo(ORIENTADOR)
    vi.spyOn(api, 'get').mockResolvedValue({
      data: [
        {
          id: 1,
          aluno: { id: 1, nome: 'Ana Lima' },
          tema: { id: 1, titulo: 'Tema', status: 'aprovado' },
          entregas: [],
          fase_atual: 'Sem entregas',
          estado: { codigo: 'aprovado', rotulo: 'Tema aprovado' },
          progresso: { concluidas: 0, total: 0 },
          prazo: null,
          prazo_vencido: false,
          aguarda_avaliacao_de_tema: false,
          entrega_para_revisao: null,
          entrega_para_comentario: null,
          entrega_para_banca: null,
        },
      ],
    })
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/orientador']}>
          <Routes>
            <Route path="/orientador" element={<Orientandos />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )

    await screen.findByText('Ana Lima')
    expect(screen.queryByRole('button', { name: 'Reatribuir' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Mais ações de Ana Lima' }))

    expect(screen.getByRole('link', { name: 'Histórico' })).toHaveAttribute(
      'href',
      '/orientador/orientandos/1/historico',
    )
    expect(screen.getByRole('button', { name: 'Reatribuir' })).toBeInTheDocument()
  })
})

describe('EtapasEntrega', () => {
  function etapas(estado) {
    render(<EtapasEntrega estado={estado} />)
    const lista = screen.getByRole('list', { name: 'Etapas da entrega' })
    const itens = within(lista).getAllByRole('listitem')
    return {
      rotulos: itens.map((i) => i.textContent),
      atual: itens.find((i) => i.getAttribute('aria-current') === 'step')?.textContent,
      feitas: itens.filter((i) => i.classList.contains('feita')).map((i) => i.textContent),
      itens,
    }
  }

  it('mostra as cinco etapas, na ordem', () => {
    expect(etapas('rascunho').rotulos).toEqual(['Preparo', 'Envio', 'Revisão', 'Aprovação', 'Banca'])
  })

  it.each([
    ['rascunho', 'Preparo', 0],
    ['pronto_para_revisao', 'Envio', 1],
    ['em_revisao', 'Revisão', 2],
    ['correcao_solicitada', 'Revisão', 2],
    ['concluida', 'Aprovação', 3],
    ['enviada_a_banca', 'Banca', 4],
  ])('em "%s", a etapa atual é %s e %i etapas já foram feitas', (estado, atual, feitas) => {
    const resultado = etapas(estado)
    expect(resultado.atual).toBe(atual)
    expect(resultado.feitas).toHaveLength(feitas)
  })

  it('a etapa atual leva a classe do estado, que dá a cor', () => {
    expect(etapas('correcao_solicitada').itens[2]).toHaveClass('atual', 'e-correcao_solicitada')
  })

  it('um estado desconhecido cai na primeira etapa', () => {
    expect(etapas('inventado').atual).toBe('Preparo')
  })
})

describe('Etapas na lista de Entregas do aluno', () => {
  it('cada entrega mostra onde está', async () => {
    entrarComo(ALUNO)
    vi.spyOn(api, 'get').mockResolvedValue({
      data: {
        id: 1,
        aluno: ALUNO,
        orientador: { id: 2, nome: 'Marcos' },
        tema: {
          id: 9, titulo: 'Tema', descricao: 'Descrição.', status: 'aprovado',
          justificativa_ajuste: '', data_proposta: '2026-08-20T12:00:00Z',
          data_aprovacao: '2026-08-25T12:00:00Z',
        },
        entregas: [
          { id: 1, titulo: 'Introdução', estado: 'concluida', prazo: '2026-10-10', atrasada: false },
          { id: 2, titulo: 'Metodologia', estado: 'em_revisao', prazo: '2026-11-24', atrasada: false },
        ],
      },
    })
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/aluno/entregas']}>
          <Routes>
            <Route path="/aluno" element={<AreaAluno />}>
              <Route path="entregas" element={<Entregas />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )

    await screen.findByText('Introdução')
    const listas = screen.getAllByRole('list', { name: 'Etapas da entrega' })

    expect(listas).toHaveLength(2)
    expect(within(listas[0]).getByText('Aprovação')).toHaveAttribute('aria-current', 'step')
    expect(within(listas[1]).getByText('Revisão')).toHaveAttribute('aria-current', 'step')
  })
})

describe('Dias da linha do tempo', () => {
  const agora = new Date(2026, 10, 13, 15, 0)

  it('rotuloDoDia diz Hoje, Ontem ou a data por extenso', () => {
    expect(rotuloDoDia(new Date(2026, 10, 13, 8, 0).toISOString(), agora)).toBe('Hoje')
    expect(rotuloDoDia(new Date(2026, 10, 12, 23, 59).toISOString(), agora)).toBe('Ontem')
    expect(rotuloDoDia(new Date(2026, 9, 2, 12, 0).toISOString(), agora)).toBe('2 de outubro')
  })

  it('rotuloDoDia acrescenta o ano quando não é o atual', () => {
    expect(rotuloDoDia(new Date(2025, 11, 31, 12, 0).toISOString(), agora)).toBe(
      '31 de dezembro de 2025',
    )
  })

  it('rotuloDoDia e mesEAno aguentam data inválida', () => {
    expect(rotuloDoDia('nada', agora)).toBe('—')
    expect(mesEAno('nada')).toBe('—')
  })

  it('mesEAno escreve o mês por extenso', () => {
    expect(mesEAno(new Date(2026, 7, 14, 12, 0).toISOString())).toBe('agosto de 2026')
  })

  it('chaveDoDia é a mesma para o mesmo dia e diferente entre dias', () => {
    const manha = new Date(2026, 10, 13, 8, 0).toISOString()
    const noite = new Date(2026, 10, 13, 22, 0).toISOString()
    const ontem = new Date(2026, 10, 12, 22, 0).toISOString()
    expect(chaveDoDia(manha)).toBe(chaveDoDia(noite))
    expect(chaveDoDia(manha)).not.toBe(chaveDoDia(ontem))
  })

  it('a linha do tempo abre cada dia com um cabeçalho e agrupa os eventos dele', async () => {
    entrarComo(ALUNO)
    const hoje = new Date()
    const ontem = new Date(Date.now() - 86400000)
    const antigo = new Date(hoje.getFullYear(), 0, 2, 12, 0)
    // A API devolve do mais antigo ao mais novo; a tela inverte.
    const eventos = [
      { id: 1, tipo: 'tema_proposto', descricao: 'Tema proposto.', data_hora: antigo.toISOString() },
      { id: 2, tipo: 'upload', descricao: 'Versão 1 enviada.', data_hora: ontem.toISOString() },
      { id: 3, tipo: 'entrega_pronta', descricao: 'Pronta.', data_hora: hoje.toISOString() },
      { id: 4, tipo: 'entrega_em_revisao', descricao: 'Em revisão.', data_hora: hoje.toISOString() },
    ]
    vi.spyOn(api, 'get').mockResolvedValue({ data: eventos })
    render(
      <AuthProvider>
        <MemoryRouter>
          <Routes>
            <Route path="*" element={<LinhaDoTempo />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )

    await screen.findByText('Em revisão.')
    const cabecalhos = Array.from(document.querySelectorAll('.dia-timeline')).map(
      (c) => c.textContent,
    )

    // Hoje tem dois eventos e um só cabeçalho; ontem e a data antiga abrem os seus.
    expect(cabecalhos).toHaveLength(3)
    expect(cabecalhos[0]).toBe('Hoje')
    expect(cabecalhos[1]).toBe('Ontem')
    expect(cabecalhos[2]).toBe('2 de janeiro')
  })
})

describe('Busca na fila de revisão', () => {
  function item(id, nome, titulo, atrasada = false) {
    return {
      id,
      titulo,
      estado: 'pronto_para_revisao',
      prazo: '2026-12-20',
      atrasada,
      tcc: id,
      aluno: { id, nome },
      versao_atual: null,
      pronta_em: new Date().toISOString(),
      prioridade: null,
    }
  }

  async function montarFila(itens) {
    entrarComo(ORIENTADOR)
    vi.spyOn(api, 'get').mockImplementation((url) =>
      Promise.resolve({ data: url === '/fila-revisao/' ? itens : [] }),
    )
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/orientador/fila']}>
          <Routes>
            <Route path="/orientador/fila" element={<FilaRevisao />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )
    await screen.findByText('Ana Lima · Introdução')
  }

  const FILA = [
    item(1, 'Ana Lima', 'Introdução'),
    item(2, 'Bruno Alves', 'Metodologia'),
    item(3, 'Ana Souza', 'Resultados'),
  ]

  it('filtra pelo nome do aluno', async () => {
    await montarFila(FILA)

    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar na fila' }), 'ana')

    expect(screen.getByText('Ana Lima · Introdução')).toBeInTheDocument()
    expect(screen.getByText('Ana Souza · Resultados')).toBeInTheDocument()
    expect(screen.queryByText('Bruno Alves · Metodologia')).not.toBeInTheDocument()
  })

  it('filtra pelo nome da entrega, sem diferenciar acento nem maiúscula', async () => {
    await montarFila(FILA)

    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar na fila' }), 'INTRODUCAO')

    expect(screen.getByText('Ana Lima · Introdução')).toBeInTheDocument()
    expect(screen.queryByText('Bruno Alves · Metodologia')).not.toBeInTheDocument()
  })

  it('avisa quando nada combina e volta ao normal ao limpar', async () => {
    await montarFila(FILA)
    const busca = screen.getByRole('searchbox', { name: 'Buscar na fila' })

    await userEvent.type(busca, 'zzz')
    expect(screen.getByText('Nenhum resultado')).toBeInTheDocument()
    expect(screen.getByText('Nada na fila combina com “zzz”.')).toBeInTheDocument()

    await userEvent.clear(busca)
    expect(screen.queryByText('Nenhum resultado')).not.toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it('a busca não mexe nos números do topo', async () => {
    await montarFila(FILA)

    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar na fila' }), 'bruno')

    const aguardando = screen.getByText('Aguardando').closest('div')
    expect(within(aguardando).getByText('3')).toBeInTheDocument()
  })

  it('com a fila vazia, não aparece a busca', async () => {
    entrarComo(ORIENTADOR)
    vi.spyOn(api, 'get').mockResolvedValue({ data: [] })
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/orientador/fila']}>
          <Routes>
            <Route path="/orientador/fila" element={<FilaRevisao />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )

    expect(await screen.findByText('Nenhuma entrega aguardando revisão')).toBeInTheDocument()
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
  })
})
