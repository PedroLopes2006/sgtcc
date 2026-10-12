import { useNavigate } from 'react-router-dom'
import Estado from '../../components/Estado'
import { ROTULO_ESTADO_ENTREGA, dataCurta } from '../../formato'
import { useTcc } from './AreaAluno'

/** US05 — lista de entregas e porta de entrada para criar uma nova. */
export default function Entregas() {
  const { tcc } = useTcc()
  const navegar = useNavigate()

  const temaAprovado = tcc?.tema?.status === 'aprovado'
  const entregas = tcc?.entregas || []

  return (
    <div>
      <div className="cabecalho-pagina">
        <h1>Entregas</h1>
        <div className="cabecalho-acoes">
          {/* CA2 — sem tema aprovado, criar entrega fica indisponível. */}
          <button
            onClick={() => navegar('/aluno/entregas/nova')}
            disabled={!temaAprovado}
            title={temaAprovado ? undefined : 'Disponível depois que o orientador aprovar o tema'}
          >
            Nova entrega
          </button>
        </div>
      </div>

      {entregas.length === 0 ? (
        <div className="vazio">
          <strong>Você ainda não tem entregas</strong>
          <span>
            {temaAprovado
              ? 'Crie a primeira etapa do seu trabalho para começar a organizar as entregas.'
              : 'Você poderá criar entregas depois que o orientador aprovar o seu tema.'}
          </span>
        </div>
      ) : (
        <ul className="lista">
          {entregas.map((entrega) => (
            <li key={entrega.id}>
              <div>
                <div className="titulo">{entrega.titulo}</div>
                <div className={`meta ${entrega.atrasada ? 'prazo-vencido' : ''}`}>
                  Prazo {dataCurta(entrega.prazo)}
                  {entrega.atrasada && ' · vencido'}
                </div>
              </div>
              <Estado
                codigo={entrega.estado}
                rotulo={ROTULO_ESTADO_ENTREGA[entrega.estado]}
                atrasado={entrega.atrasada}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
