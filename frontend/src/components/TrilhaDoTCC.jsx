import { Link } from 'react-router-dom'
import { ROTULO_ESTADO_ENTREGA, classeDoEstado, dataCurta } from '../formato'
import PrazoRestante from './PrazoRestante'

const ENCERRADAS = ['concluida', 'enviada_a_banca']

/**
 * EXTRA — fora dos requisitos do documento: o caminho do TCC numa linha só.
 *
 * Começa pelo tema aprovado e segue pelas entregas, da de prazo mais próximo para
 * a mais distante. Cada parada mostra o estado (o mesmo pontinho colorido do resto
 * do sistema), o prazo e a contagem regressiva. Só lê o que o "Meu TCC" já carregou;
 * a ordem é só de apresentação, e quem decide a vez de cada entrega é a API (RN06).
 */
export default function TrilhaDoTCC({ tema, entregas }) {
  const ordenadas = [...entregas].sort((a, b) => String(a.prazo).localeCompare(String(b.prazo)))
  // A parada de agora é a primeira entrega ainda aberta; as depois dela ainda estão por vir.
  const atual = ordenadas.find((e) => !ENCERRADAS.includes(e.estado))
  const posicaoDaAtual = atual ? ordenadas.indexOf(atual) : ordenadas.length

  return (
    <section className="trilha-cartao" aria-labelledby="trilha-titulo">
      <div className="trilha-topo">
        <h2 id="trilha-titulo">Caminho do TCC</h2>
        <Link to="/aluno/linha-do-tempo">Ver linha do tempo</Link>
      </div>

      <ol className="trilha">
        <li className="trilha-parada feita">
          <span className="trilha-marca ponto aprovado" aria-hidden="true" />
          <strong>Tema aprovado</strong>
          <span className="trilha-meta">{dataCurta(tema.data_aprovacao)}</span>
        </li>

        {ordenadas.map((entrega, posicao) => (
          <li
            key={entrega.id}
            className={[
              'trilha-parada',
              entrega.estado,
              entrega === atual ? 'atual' : posicao > posicaoDaAtual ? 'futura' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-current={entrega === atual ? 'step' : undefined}
          >
            <span
              className={`trilha-marca ponto ${classeDoEstado(entrega.estado)}`}
              aria-hidden="true"
            />
            <strong>
              {entrega.titulo}
              {entrega === atual && <span className="trilha-agora">Agora</span>}
            </strong>
            <span className="trilha-meta">{ROTULO_ESTADO_ENTREGA[entrega.estado]}</span>
            <span className="trilha-meta">
              {dataCurta(entrega.prazo)}{' '}
              <PrazoRestante prazo={entrega.prazo} estado={entrega.estado} />
            </span>
          </li>
        ))}

        {ordenadas.length === 0 && (
          <li className="trilha-parada vazia">
            <span className="trilha-marca ponto" aria-hidden="true" />
            <strong>Nenhuma entrega ainda</strong>
            <span className="trilha-meta">Crie a primeira etapa em Entregas.</span>
          </li>
        )}
      </ol>
    </section>
  )
}
