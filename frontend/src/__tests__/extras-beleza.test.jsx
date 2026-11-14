/**
 * EXTRAS — fora dos requisitos do documento, da rodada "mais beleza":
 * avatares coloridos, esqueleto de carregamento, tempo relativo, aviso com barra de
 * tempo e confirmação antes de ações sem volta.
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import api from '../api'
import { AuthProvider } from '../auth'
import Avatar from '../components/Avatar'
import Carregando from '../components/Carregando'
import ConfirmarAcao from '../components/ConfirmarAcao'
import Toast from '../components/Toast'
import TrilhaDoTCC from '../components/TrilhaDoTCC'
import { tempoRelativo, tomDoAvatar } from '../formato'
import AreaAluno from '../pages/aluno/AreaAluno'
import Entregas from '../pages/aluno/Entregas'

// O Vitest roda na raiz do frontend; o jsdom não dá uma URL de arquivo para este módulo.
const CSS = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8')

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('Avatar com cor própria (extra)', () => {
  it('a mesma pessoa tem sempre o mesmo tom, entre 0 e 5', () => {
    expect(tomDoAvatar('Lucas Andrade')).toBe(tomDoAvatar('  lucas andrade '))
    for (const nome of ['Lucas', 'Ana Beatriz', 'Marcos Ribeiro', 'Zé', '']) {
      const tom = tomDoAvatar(nome)
      expect(tom).toBeGreaterThanOrEqual(0)
      expect(tom).toBeLessThanOrEqual(5)
    }
  })

  it('pessoas diferentes não caem todas no mesmo tom', () => {
    const tons = new Set(
      ['Lucas', 'Ana Beatriz', 'Marcos Ribeiro', 'Carla', 'Davi', 'Bruno', 'Elisa'].map(tomDoAvatar),
    )
    expect(tons.size).toBeGreaterThan(2)
  })

  it('mostra as iniciais com a classe do tom, e pode ficar escondido para leitor de tela', () => {
    render(<Avatar nome="Lucas Andrade" grande escondido />)

    const avatar = screen.getByText('LA')

    expect(avatar).toHaveClass('avatar', `av-${tomDoAvatar('Lucas Andrade')}`, 'grande')
    expect(avatar).toHaveAttribute('aria-hidden', 'true')
  })

  it('os seis tons existem no claro e no escuro', () => {
    for (let tom = 0; tom <= 5; tom += 1) {
      expect(CSS).toMatch(new RegExp(`\\n\\.avatar\\.av-${tom}\\s*\\{`))
      expect(CSS).toMatch(new RegExp(`:root\\[data-tema='escuro'\\]\\s*\\.avatar\\.av-${tom}\\s*\\{`))
    }
  })
})

describe('Tempo relativo (extra)', () => {
  const agora = new Date(2026, 10, 10, 15, 0)

  it('diz há quanto tempo, do minuto ao dia', () => {
    expect(tempoRelativo(new Date(2026, 10, 10, 14, 59, 40), agora)).toBe('agora há pouco')
    expect(tempoRelativo(new Date(2026, 10, 10, 14, 25), agora)).toBe('há 35 min')
    expect(tempoRelativo(new Date(2026, 10, 10, 11, 0), agora)).toBe('há 4 h')
    expect(tempoRelativo(new Date(2026, 10, 9, 23, 0), agora)).toBe('ontem')
    expect(tempoRelativo(new Date(2026, 10, 6, 10, 0), agora)).toBe('há 4 dias')
  })

  it('passada uma semana, volta a mostrar a data', () => {
    expect(tempoRelativo(new Date(2026, 9, 20, 10, 0), agora)).toBe('20 out')
  })

  it('data inválida não quebra', () => {
    expect(tempoRelativo('isso não é data', agora)).toBe('—')
  })
})

describe('Esqueleto de carregamento (extra)', () => {
  it('mantém o texto "Carregando…" para o leitor de tela e mostra as barras', () => {
    const { container } = render(<Carregando linhas={3} />)

    expect(screen.getByRole('status')).toHaveTextContent('Carregando…')
    expect(container.querySelectorAll('.esqueleto-linha')).toHaveLength(3)
  })
})

describe('Aviso com ícone e barra de tempo (extra)', () => {
  it('mostra o ícone de visto e a barra com a duração do aviso', () => {
    const { container } = render(<Toast mensagem="Pronto." aoFechar={() => {}} duracao={4000} />)

    expect(container.querySelector('.toast-icone')).toBeInTheDocument()
    expect(container.querySelector('.toast-tempo')).toHaveStyle({ animationDuration: '4000ms' })
  })
})

describe('Confirmação antes de ações sem volta (extra)', () => {
  it('não mostra nada sem pedido', () => {
    const { container } = render(
      <ConfirmarAcao pedido={null} aoCancelar={() => {}} aoConfirmar={() => {}} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('mostra o que vai acontecer, e confirma ou cancela', async () => {
    const aoConfirmar = vi.fn()
    const aoCancelar = vi.fn()
    render(
      <ConfirmarAcao
        pedido={{ titulo: 'Aprovar a entrega?', texto: 'Não pode ser desfeito.', rotulo: 'Aprovar' }}
        aoCancelar={aoCancelar}
        aoConfirmar={aoConfirmar}
      />,
    )

    const dialogo = screen.getByRole('dialog', { name: 'Aprovar a entrega?' })
    expect(within(dialogo).getByText('Não pode ser desfeito.')).toBeInTheDocument()

    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    expect(aoCancelar).toHaveBeenCalled()
    expect(aoConfirmar).not.toHaveBeenCalled()

    await userEvent.click(within(dialogo).getByRole('button', { name: 'Aprovar' }))
    expect(aoConfirmar).toHaveBeenCalledTimes(1)
  })

  it('o foco já começa no botão de confirmar e Esc cancela', async () => {
    const aoCancelar = vi.fn()
    render(
      <ConfirmarAcao
        pedido={{ titulo: 'Enviar à banca?', texto: 'Sem volta.', rotulo: 'Enviar à banca' }}
        aoCancelar={aoCancelar}
        aoConfirmar={() => {}}
      />,
    )

    await userEvent.keyboard('{Escape}')

    expect(aoCancelar).toHaveBeenCalled()
  })

  it('em Entregas, sinalizar pede confirmação e cancelar não chama a API', async () => {
    const aluno = { id: 1, nome: 'Lucas Andrade', email: 'lucas@aluno.edu.br', perfil: 'aluno' }
    localStorage.setItem('sgtcc.usuario', JSON.stringify(aluno))
    localStorage.setItem('sgtcc.access', 'token-de-teste')
    vi.spyOn(api, 'get').mockImplementation((url) =>
      Promise.resolve({
        data:
          url === '/meu-tcc/'
            ? {
                id: 1, aluno, orientador: { id: 2, nome: 'Prof. Marcos' },
                tema: {
                  id: 9, titulo: 'T', descricao: 'D', status: 'aprovado', justificativa_ajuste: '',
                  data_proposta: '2026-08-20T12:00:00Z', data_aprovacao: '2026-08-25T12:00:00Z',
                },
                entregas: [
                  {
                    id: 5, titulo: 'Referencial', estado: 'rascunho', prazo: '2099-12-31',
                    atrasada: false, aceita_versao: true, pode_sinalizar: true,
                    versao_atual: { numero: 1 },
                  },
                ],
              }
            : { nao_lidos: 0, avisos: [] },
      }),
    )
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} })
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

    await userEvent.click(await screen.findByRole('button', { name: /Sinalizar Referencial como pronta/ }))

    const dialogo = await screen.findByRole('dialog', { name: 'Sinalizar como pronta?' })
    expect(within(dialogo).getByText(/vai para a revisão do seu orientador/)).toBeInTheDocument()
    expect(post).not.toHaveBeenCalled()

    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(post).not.toHaveBeenCalled()
  })
})

describe('Tipografia e detalhes de CSS (extra)', () => {
  it('as fontes têm reserva do sistema', () => {
    expect(CSS).toMatch(/--fonte-texto:[^;]*system-ui[^;]*sans-serif;/)
    expect(CSS).toMatch(/--fonte-titulo:[^;]*Georgia[^;]*serif;/)
  })

  it('o esqueleto e o aviso só animam opacidade e largura, nunca transformam', () => {
    const bloco = (nome) => CSS.match(new RegExp(`@keyframes ${nome}\\s*\\{([\\s\\S]*?)\\n\\}`))[1]
    expect(bloco('encolher')).not.toMatch(/transform|translate|scale|rotate/)
    expect(bloco('pulsar')).not.toMatch(/transform|translate|scale|rotate/)
  })
})

// --------------------------------------------------- caminho do TCC e estados vazios

describe('Caminho do TCC: concluído, agora e por vir (extra)', () => {
  const entregas = [
    { id: 1, titulo: 'Feita', estado: 'concluida', prazo: '2026-01-10' },
    { id: 2, titulo: 'Em andamento', estado: 'em_revisao', prazo: '2098-02-10' },
    { id: 3, titulo: 'Depois', estado: 'rascunho', prazo: '2099-03-10' },
  ]

  function trilha() {
    return render(
      <MemoryRouter>
        <TrilhaDoTCC
          tema={{ data_aprovacao: '2025-12-01T12:00:00Z' }}
          entregas={entregas}
        />
      </MemoryRouter>,
    )
  }

  it('marca só a primeira entrega aberta como "Agora", com aria-current', () => {
    trilha()

    const paradas = screen.getAllByRole('listitem')
    const atuais = paradas.filter((p) => p.getAttribute('aria-current') === 'step')

    expect(atuais).toHaveLength(1)
    expect(atuais[0]).toHaveTextContent('Em andamento')
    expect(within(atuais[0]).getByText('Agora')).toBeInTheDocument()
    expect(screen.getAllByText('Agora')).toHaveLength(1)
  })

  it('as que vêm depois da atual ficam como "por vir", e a feita não', () => {
    trilha()

    const [, feita, atual, futura] = screen.getAllByRole('listitem')

    expect(feita).not.toHaveClass('futura', 'atual')
    expect(atual).toHaveClass('atual')
    expect(futura).toHaveClass('futura')
  })

  it('o visto é desenhado com bordas, o anel é uma borda e o traço futuro é tracejado', () => {
    const visto = CSS.match(/\.trilha-parada\.concluida \.trilha-marca::after[^{]*\{([^}]*)\}/)[1]
    expect(visto).toMatch(/content:\s*'';/)
    expect(visto).toMatch(/border-width:\s*0 2px 2px 0;/)
    const anel = CSS.match(/\.trilha-parada\.atual \.trilha-marca::after\s*\{([^}]*)\}/)[1]
    expect(anel).toMatch(/border:\s*2px solid var\(--destaque\)/)
    expect(anel).toMatch(/animation:\s*trilha-anel/)
    expect(CSS).toMatch(/\.trilha-parada\.futura::before\s*\{\s*background:\s*repeating-linear-gradient/)
  })

  it('o anel da etapa de agora só muda opacidade e tamanho, e não há halo de sombra', () => {
    const bloco = CSS.match(/@keyframes trilha-anel\s*\{([\s\S]*?)\n\}/)[1]
    expect(bloco).toMatch(/opacity/)
    expect(bloco).not.toMatch(/box-shadow/)
    expect(CSS).not.toMatch(/trilha-pulso/)
  })
})

describe('Estados vazios que convidam a agir (extra)', () => {
  it('a Fila vazia leva aos orientandos', async () => {
    const { default: FilaRevisao } = await import('../pages/orientador/FilaRevisao')
    const orientador = { id: 2, nome: 'Marcos Ribeiro', email: 'm@prof.edu.br', perfil: 'orientador' }
    localStorage.setItem('sgtcc.usuario', JSON.stringify(orientador))
    localStorage.setItem('sgtcc.access', 'token-de-teste')
    vi.spyOn(api, 'get').mockImplementation((url) =>
      Promise.resolve({ data: url === '/avisos/' ? { nao_lidos: 0, avisos: [] } : [] }),
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

    expect(await screen.findByRole('link', { name: /Ver orientandos/ })).toHaveAttribute('href', '/orientador')
  })

  it('as entregas vazias, com o tema aprovado, levam a criar a primeira', async () => {
    const aluno = { id: 1, nome: 'Lucas Andrade', email: 'lucas@aluno.edu.br', perfil: 'aluno' }
    localStorage.setItem('sgtcc.usuario', JSON.stringify(aluno))
    localStorage.setItem('sgtcc.access', 'token-de-teste')
    vi.spyOn(api, 'get').mockImplementation((url) =>
      Promise.resolve({
        data:
          url === '/meu-tcc/'
            ? {
                id: 1, aluno, orientador: { id: 2, nome: 'Prof. Marcos' },
                tema: {
                  id: 9, titulo: 'T', descricao: 'D', status: 'aprovado', justificativa_ajuste: '',
                  data_proposta: '2026-08-20T12:00:00Z', data_aprovacao: '2026-08-25T12:00:00Z',
                },
                entregas: [],
              }
            : { nao_lidos: 0, avisos: [] },
      }),
    )
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

    expect(await screen.findByRole('link', { name: /Criar a primeira entrega/ })).toHaveAttribute(
      'href',
      '/aluno/entregas/nova',
    )
  })
})
