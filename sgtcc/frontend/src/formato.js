const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** "20 ago", como no protótipo. Datas só com dia (prazo) não têm fuso. */
export function dataCurta(valor) {
  if (!valor) return '—'
  const soData = /^\d{4}-\d{2}-\d{2}$/.test(valor)
  const d = soData ? new Date(`${valor}T12:00:00`) : new Date(valor)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.getDate()} ${MESES[d.getMonth()]}`
}

export function iniciais(nome = '') {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

/** Classe do pontinho de estado, pela semântica e não pela cor. */
export function classeDoEstado(codigo, atrasado = false) {
  if (atrasado) return 'atrasado'
  if (['proposto', 'ajuste_solicitado', 'pronto_para_revisao', 'em_revisao',
       'correcao_solicitada'].includes(codigo)) {
    return 'aguardando'
  }
  if (['aprovado', 'concluida', 'enviada_a_banca'].includes(codigo)) return 'concluido'
  return 'rascunho'
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
