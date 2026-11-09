const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** "20 ago", como no protótipo. Datas só com dia (prazo) não têm fuso. */
export function dataCurta(valor) {
  if (!valor) return '—'
  const soData = /^\d{4}-\d{2}-\d{2}$/.test(valor)
  const d = soData ? new Date(`${valor}T12:00:00`) : new Date(valor)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.getDate()} ${MESES[d.getMonth()]}`
}

/** Data e horário de um evento, no fuso horário local de quem consulta. */
export function dataHoraCurta(valor) {
  if (!valor) return '—'
  const d = new Date(valor)
  if (Number.isNaN(d.getTime())) return '—'
  return `${dataCurta(valor)} · ${d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`
}

export function iniciais(nome = '') {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

/** Estados de entrega e de tema que têm cor própria no pontinho (veja `.ponto` em styles.css). */
export const ESTADOS_COM_COR = [
  'rascunho',
  'pronto_para_revisao',
  'em_revisao',
  'correcao_solicitada',
  'concluida',
  'enviada_a_banca',
  'proposto',
  'ajuste_solicitado',
  'aprovado',
]

/**
 * Classe do pontinho de estado: uma por estado, para cada um ter a sua cor.
 * O atraso não entra aqui; quem está vencido continua com a cor do estado e
 * ganha o aviso "vencido" no texto.
 */
export function classeDoEstado(codigo) {
  return ESTADOS_COM_COR.includes(codigo) ? codigo : 'rascunho'
}

export const ROTULO_ESTADO_ENTREGA = {
  rascunho: 'Rascunho',
  pronto_para_revisao: 'Pronto para revisão',
  em_revisao: 'Em revisão',
  correcao_solicitada: 'Correção solicitada',
  concluida: 'Concluída',
  enviada_a_banca: 'Enviada à banca',
}

export const ROTULO_STATUS_TEMA = {
  proposto: 'Tema proposto',
  aprovado: 'Tema aprovado',
  ajuste_solicitado: 'Ajuste solicitado',
}
