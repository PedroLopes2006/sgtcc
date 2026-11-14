import { ROTULO_ESTADO_ENTREGA, classeDoEstado } from '../formato'

/**
 * EXTRA — fora dos requisitos do documento: quantas entregas há em cada estado.
 *
 * Uma lista curta com o pontinho de cada estado e a contagem, na ordem do fluxo
 * (RN06). Só lê o que o "Meu TCC" já carregou. Sem entregas, não aparece.
 */
const FLUXO = [
  'rascunho',
  'pronto_para_revisao',
  'em_revisao',
  'correcao_solicitada',
  'concluida',
  'enviada_a_banca',
]

export default function ResumoDasEntregas({ entregas }) {
  const contagem = FLUXO.map((estado) => ({
    estado,
    quantas: entregas.filter((e) => e.estado === estado).length,
  })).filter((item) => item.quantas > 0)

  if (contagem.length === 0) return null

  return (
    <section className="resumo-cartao" aria-labelledby="resumo-entregas-titulo">
      <h2 id="resumo-entregas-titulo">Entregas por estado</h2>
      <ul className="resumo-lista">
        {contagem.map(({ estado, quantas }) => (
          <li key={estado}>
            <span className="resumo-rotulo">
              <span className={`ponto ${classeDoEstado(estado)}`} aria-hidden="true" />
              {ROTULO_ESTADO_ENTREGA[estado]}
            </span>
            <span className="resumo-numero">{quantas}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
