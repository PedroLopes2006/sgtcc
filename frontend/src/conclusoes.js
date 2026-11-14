/**
 * EXTRA — fora dos requisitos do documento: aviso discreto de conclusão para o aluno.
 *
 * Quando o aluno volta ao sistema, compara o estado de cada entrega com o da última
 * vez que a viu (guardado no navegador). Se alguma passou a "concluída" ou "enviada
 * à banca" nesse meio-tempo, devolve a mensagem para o `Toast`. Só apresentação: o
 * fato em si já está no log de eventos (RN10) e na aba de Avisos.
 */
const ENCERRADAS = ['concluida', 'enviada_a_banca']

const chave = (usuarioId) => `sgtcc.estados.${usuarioId}`

function lerAnteriores(usuarioId) {
  try {
    return JSON.parse(localStorage.getItem(chave(usuarioId))) || null
  } catch {
    return null
  }
}

/** Mensagem sobre as entregas que acabaram de ser encerradas, ou '' se não houve nenhuma. */
export function mensagemDeConclusao(anteriores, entregas) {
  // Primeira vez neste navegador: não há com o que comparar, então não se avisa.
  if (!anteriores) return ''
  const novas = entregas.filter(
    (e) =>
      ENCERRADAS.includes(e.estado) &&
      anteriores[e.id] !== undefined &&
      !ENCERRADAS.includes(anteriores[e.id]),
  )
  if (novas.length === 0) return ''
  if (novas.length > 1) return `Parabéns! ${novas.length} entregas foram concluídas.`
  const [entrega] = novas
  return entrega.estado === 'enviada_a_banca'
    ? `"${entrega.titulo}" foi enviada à banca.`
    : `Parabéns! "${entrega.titulo}" foi concluída.`
}

/** Compara com o que foi visto da última vez, guarda o estado de agora e devolve a mensagem. */
export function conferirConclusoes(usuarioId, entregas) {
  const mensagem = mensagemDeConclusao(lerAnteriores(usuarioId), entregas)
  try {
    localStorage.setItem(
      chave(usuarioId),
      JSON.stringify(Object.fromEntries(entregas.map((e) => [e.id, e.estado]))),
    )
  } catch {
    // sem armazenamento, simplesmente não há aviso na próxima vez
  }
  return mensagem
}
