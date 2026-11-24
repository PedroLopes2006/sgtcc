import { semAcento } from './formato'

/**
 * US17 — regras de filtro e busca das listas.
 *
 * O filtro só esconde itens na tela (CA3): ele trabalha sobre o que a página já
 * carregou e nunca muda dados nem acessos, que continuam decididos pela API.
 */

/** A busca ignora acentos e maiúsculas. Sem termo, tudo passa. */
export function casaComBusca(busca, ...textos) {
  const termo = semAcento((busca || '').trim())
  if (!termo) return true
  return semAcento(textos.filter(Boolean).join(' ')).includes(termo)
}

/** Filtros da lista de Entregas do aluno, por situação. */
export const FILTROS_DE_ENTREGA = [
  { codigo: 'todas', rotulo: 'Todas', passa: () => true },
  {
    codigo: 'andamento',
    rotulo: 'Em andamento',
    passa: (e) => ['rascunho', 'pronto_para_revisao', 'em_revisao'].includes(e.estado),
  },
  { codigo: 'correcao', rotulo: 'Correção solicitada', passa: (e) => e.estado === 'correcao_solicitada' },
  {
    codigo: 'concluidas',
    rotulo: 'Concluídas',
    passa: (e) => ['concluida', 'enviada_a_banca'].includes(e.estado),
  },
]

/** Filtros da Linha do tempo, por assunto do evento. */
export const FILTROS_DE_EVENTO = [
  { codigo: 'todos', rotulo: 'Todos' },
  { codigo: 'tema', rotulo: 'Tema' },
  { codigo: 'entregas', rotulo: 'Entregas' },
  { codigo: 'trabalho_final', rotulo: 'Trabalho final' },
  { codigo: 'orientador', rotulo: 'Orientador' },
]

/** O assunto de um evento, a partir do tipo gravado no log (RN10). */
export function categoriaDoEvento(tipo = '') {
  if (tipo.startsWith('tema')) return 'tema'
  if (tipo.startsWith('trabalho_final')) return 'trabalho_final'
  if (tipo === 'troca_orientador') return 'orientador'
  return 'entregas'
}

/** Monta as opções de uma barra de filtro com a quantidade de cada uma. */
export function comQuantidades(filtros, itens, passa) {
  return filtros.map((filtro) => ({
    codigo: filtro.codigo,
    rotulo: filtro.rotulo,
    quantos: itens.filter((item) => passa(filtro, item)).length,
  }))
}
