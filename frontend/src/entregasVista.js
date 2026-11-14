/**
 * EXTRA — fora dos requisitos do documento: como o aluno quer ver a lista de entregas.
 *
 * Duas escolhas, que ele mesmo faz e que ficam guardadas no navegador: a ordem
 * (prazo, título, estado ou a ordem em que as entregas foram criadas) e o
 * agrupamento (nenhum, situação, estado ou prazo). Isto só muda a apresentação:
 * quem manda no que existe e no que cada entrega pode fazer é a API (RN06).
 */
import { ROTULO_ESTADO_ENTREGA } from './formato'

export const ORDENS = [
  { valor: 'criacao', rotulo: 'Ordem de criação' },
  { valor: 'prazo', rotulo: 'Prazo mais próximo' },
  { valor: 'prazo_desc', rotulo: 'Prazo mais distante' },
  { valor: 'titulo', rotulo: 'Título (A a Z)' },
  { valor: 'estado', rotulo: 'Estado (do fluxo)' },
]

export const AGRUPAMENTOS = [
  { valor: 'nenhum', rotulo: 'Sem agrupar' },
  { valor: 'situacao', rotulo: 'Em andamento e encerradas' },
  { valor: 'estado', rotulo: 'Estado' },
  { valor: 'prazo', rotulo: 'Prazo' },
]

export const VISTA_PADRAO = { ordem: 'criacao', agrupar: 'nenhum' }

const CHAVE = 'sgtcc.entregas.vista'

/** Ordem do fluxo da entrega, a mesma da máquina de estados (RN06). */
const FLUXO = [
  'rascunho',
  'pronto_para_revisao',
  'em_revisao',
  'correcao_solicitada',
  'concluida',
  'enviada_a_banca',
]
const ENCERRADAS = ['concluida', 'enviada_a_banca']

export function lerVista() {
  try {
    const salva = JSON.parse(localStorage.getItem(CHAVE))
    return {
      ordem: ORDENS.some((o) => o.valor === salva?.ordem) ? salva.ordem : VISTA_PADRAO.ordem,
      agrupar: AGRUPAMENTOS.some((a) => a.valor === salva?.agrupar)
        ? salva.agrupar
        : VISTA_PADRAO.agrupar,
    }
  } catch {
    return { ...VISTA_PADRAO }
  }
}

export function guardarVista(vista) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(vista))
  } catch {
    // sem armazenamento, a escolha só vale até fechar a página
  }
}

const porPrazo = (a, b) => String(a.prazo).localeCompare(String(b.prazo))

export function ordenar(entregas, ordem) {
  const copia = [...entregas]
  if (ordem === 'prazo') return copia.sort(porPrazo)
  if (ordem === 'prazo_desc') return copia.sort((a, b) => porPrazo(b, a))
  if (ordem === 'titulo') return copia.sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'))
  if (ordem === 'estado') {
    return copia.sort((a, b) => FLUXO.indexOf(a.estado) - FLUXO.indexOf(b.estado))
  }
  return copia // criação: a ordem que a API já manda
}

/** Em que faixa de prazo a entrega está, para o agrupamento por prazo. */
function faixaDoPrazo(entrega, agora) {
  if (ENCERRADAS.includes(entrega.estado)) return 'Encerradas'
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime()
  const [ano, mes, dia] = String(entrega.prazo).slice(0, 10).split('-').map(Number)
  const dias = Math.round((new Date(ano, mes - 1, dia).getTime() - hoje) / 86400000)
  if (dias < 0) return 'Vencidas'
  if (dias <= 7) return 'Nos próximos 7 dias'
  return 'Mais adiante'
}

const ORDEM_DAS_FAIXAS = ['Vencidas', 'Nos próximos 7 dias', 'Mais adiante', 'Encerradas']

function montar(entregas, titulo, ordemDosTitulos) {
  const grupos = new Map(ordemDosTitulos.map((t) => [t, []]))
  entregas.forEach((entrega) => {
    const t = titulo(entrega)
    if (!grupos.has(t)) grupos.set(t, [])
    grupos.get(t).push(entrega)
  })
  return [...grupos]
    .filter(([, itens]) => itens.length > 0)
    .map(([t, itens]) => ({ chave: t, titulo: t, itens }))
}

/**
 * Divide a lista (já ordenada) em grupos `{ chave, titulo, itens }`, sem grupos vazios.
 * Sem agrupamento, devolve um grupo só, sem título.
 */
export function agrupar(entregas, agrupamento, agora = new Date()) {
  if (agrupamento === 'situacao') {
    return montar(
      entregas,
      (e) => (ENCERRADAS.includes(e.estado) ? 'Encerradas' : 'Em andamento'),
      ['Em andamento', 'Encerradas'],
    )
  }
  if (agrupamento === 'estado') {
    return montar(
      entregas,
      (e) => ROTULO_ESTADO_ENTREGA[e.estado] || e.estado,
      FLUXO.map((estado) => ROTULO_ESTADO_ENTREGA[estado]),
    )
  }
  if (agrupamento === 'prazo') {
    return montar(entregas, (e) => faixaDoPrazo(e, agora), ORDEM_DAS_FAIXAS)
  }
  return [{ chave: 'todas', titulo: null, itens: entregas }]
}
