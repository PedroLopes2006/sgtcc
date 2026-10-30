import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import EnviarVersao from '../../components/EnviarVersao'
import Estado from '../../components/Estado'
import { ROTULO_ESTADO_ENTREGA, dataCurta } from '../../formato'
import { useTcc } from './AreaAluno'

/** US05 — lista de entregas. US06 — envio de versão a partir dela. */
export default function Entregas() {
  const { tcc, recarregar } = useTcc()
  const navegar = useNavigate()
  const [enviandoVersaoDe, setEnviandoVersaoDe] = useState(null)

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
                  {entrega.versao_atual && ` · versão ${entrega.versao_atual.numero}`}
                  {entrega.atrasada && ' · vencido'}
                </div>
              </div>

              <div className="acoes-da-linha">
                <Estado
                  codigo={entrega.estado}
                  rotulo={ROTULO_ESTADO_ENTREGA[entrega.estado]}
                  atrasado={entrega.atrasada}
                />
                {/* RN03 — fora de rascunho e correção solicitada, não há envio. */}
                {entrega.aceita_versao && (
                  <button className="contorno" onClick={() => setEnviandoVersaoDe(entrega)}>
                    Enviar versão
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {enviandoVersaoDe && (
        <EnviarVersao
          entrega={enviandoVersaoDe}
          aoFechar={() => setEnviandoVersaoDe(null)}
          aoConcluir={async () => {
            setEnviandoVersaoDe(null)
            await recarregar()
          }}
        />
      )}
    </div>
  )
}
