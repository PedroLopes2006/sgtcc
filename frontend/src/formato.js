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

/**
 * US09 — "Enviada há N dias", contando dias de calendário (ontem à noite já é
 * "há 1 dia"). Sem data, devolve null e a tela não mostra o trecho.
 */
export function enviadaHa(valor, agora = new Date()) {
  if (!valor) return null
  const d = new Date(valor)
  if (Number.isNaN(d.getTime())) return null
  const inicioDoDia = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const dias = Math.round((inicioDoDia(agora) - inicioDoDia(d)) / 86400000)
  if (dias <= 0) return 'Enviada hoje'
  return dias === 1 ? 'Enviada há 1 dia' : `Enviada há ${dias} dias`
}

const MESES_POR_EXTENSO = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

/** Identifica o dia (no fuso de quem consulta) de um instante, para agrupar eventos. */
export function chaveDoDia(valor) {
  const d = new Date(valor)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

/**
 * Rótulo de um dia na linha do tempo: "Hoje", "Ontem" ou "12 de novembro" (com
 * o ano quando não é o atual). Conta dias de calendário, como `enviadaHa`.
 */
export function rotuloDoDia(valor, agora = new Date()) {
  const d = new Date(valor)
  if (Number.isNaN(d.getTime())) return '—'
  const inicioDoDia = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const dias = Math.round((inicioDoDia(agora) - inicioDoDia(d)) / 86400000)
  if (dias === 0) return 'Hoje'
  if (dias === 1) return 'Ontem'
  const base = `${d.getDate()} de ${MESES_POR_EXTENSO[d.getMonth()]}`
  return d.getFullYear() === agora.getFullYear() ? base : `${base} de ${d.getFullYear()}`
}

/** "novembro de 2026", para o "Membro desde" do perfil. */
export function mesEAno(valor) {
  const d = new Date(valor)
  if (Number.isNaN(d.getTime())) return '—'
  return `${MESES_POR_EXTENSO[d.getMonth()]} de ${d.getFullYear()}`
}

/** Sem acento e em minúsculas, para a busca achar "Introducao" ao digitar "introdução". */
export function semAcento(texto) {
  return (texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

const ENTREGA_ENCERRADA = ['concluida', 'enviada_a_banca']

/** Dia de calendário (sem hora) de uma data só com dia, como o prazo "2026-11-20". */
function diaDoPrazo(valor) {
  const [ano, mes, dia] = String(valor).slice(0, 10).split('-').map(Number)
  return new Date(ano, mes - 1, dia).getTime()
}

/**
 * EXTRA — contagem regressiva do prazo: "faltam 3 dias", "vence hoje", "vencido há 2 dias".
 *
 * Devolve `{ texto, nivel }`, ou null quando a entrega já foi encerrada (concluída ou
 * enviada à banca) ou não tem prazo. O nível só ajuda a dar o tom: `ok` (mais de uma
 * semana), `perto` (até uma semana), `urgente` (hoje ou amanhã) e `vencido`.
 * Conta dias de calendário, como `enviadaHa`.
 */
export function prazoRestante(prazo, estado, agora = new Date()) {
  if (!prazo || ENTREGA_ENCERRADA.includes(estado)) return null
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime()
  const dias = Math.round((diaDoPrazo(prazo) - hoje) / 86400000)
  if (Number.isNaN(dias)) return null
  if (dias < 0) {
    const atraso = -dias
    return { texto: `vencido há ${atraso} ${atraso === 1 ? 'dia' : 'dias'}`, nivel: 'vencido' }
  }
  if (dias === 0) return { texto: 'vence hoje', nivel: 'urgente' }
  if (dias === 1) return { texto: 'falta 1 dia', nivel: 'urgente' }
  return { texto: `faltam ${dias} dias`, nivel: dias <= 7 ? 'perto' : 'ok' }
}

/** Um de seis tons para o avatar, sempre o mesmo para o mesmo nome. */
export function tomDoAvatar(nome = '') {
  let soma = 0
  for (const letra of String(nome).trim().toLowerCase()) soma = (soma * 31 + letra.charCodeAt(0)) % 6007
  return soma % 6
}

/**
 * "agora há pouco", "há 5 min", "há 2 h", "ontem", "há 3 dias" ou a data, para avisos e
 * atividades. A data completa fica no `title` de quem usa. Conta dias de calendário
 * como as outras funções daqui.
 */
export function tempoRelativo(valor, agora = new Date()) {
  const d = new Date(valor)
  if (Number.isNaN(d.getTime())) return '—'
  const minutos = Math.floor((agora.getTime() - d.getTime()) / 60000)
  if (minutos < 1) return 'agora há pouco'
  if (minutos < 60) return `há ${minutos} min`
  const inicioDoDia = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const dias = Math.round((inicioDoDia(agora) - inicioDoDia(d)) / 86400000)
  if (dias === 0) return `há ${Math.floor(minutos / 60)} h`
  if (dias === 1) return 'ontem'
  if (dias < 7) return `há ${dias} dias`
  return dataCurta(valor)
}
