/**
 * Mini linha de etapas de uma entrega, para o aluno ver de relance onde ela está:
 * Preparo → Envio → Revisão → Aprovação → Banca.
 *
 * Os rótulos são curtos e diferentes dos nomes de estado (o chip já diz
 * "Rascunho", "Pronta para revisão" etc.), para não repetir o texto na tela.
 * "Correção solicitada" fica na etapa de revisão: a entrega volta ao aluno, mas
 * o ciclo continua nela. A etapa atual leva a cor do estado (variáveis --st-*).
 */
const ETAPAS = ['Preparo', 'Envio', 'Revisão', 'Aprovação', 'Banca']

const POSICAO = {
  rascunho: 0,
  pronto_para_revisao: 1,
  em_revisao: 2,
  correcao_solicitada: 2,
  concluida: 3,
  enviada_a_banca: 4,
}

export default function EtapasEntrega({ estado }) {
  const atual = POSICAO[estado] ?? 0

  return (
    <ol className="etapas" aria-label="Etapas da entrega">
      {ETAPAS.map((rotulo, posicao) => (
        <li
          key={rotulo}
          className={
            posicao < atual ? 'feita' : posicao === atual ? `atual e-${estado}` : undefined
          }
          aria-current={posicao === atual ? 'step' : undefined}
        >
          {rotulo}
        </li>
      ))}
    </ol>
  )
}
