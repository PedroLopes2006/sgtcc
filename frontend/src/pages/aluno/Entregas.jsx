import { useNavigate } from 'react-router-dom'
import Estado from '../../components/Estado'
import { ROTULO_ESTADO_ENTREGA, dataCurta } from '../../formato'
import { useTcc } from './AreaAluno'

/*
 * US05 — lista de entregas e porta de entrada para criar uma nova.
 * US08 — cada entrega que já pode ser sinalizada como pronta ganha o botão para isso.
 */
export default function Entregas() {
  const { tcc } = useTcc()
  const navegar = useNavigate()
  const [sinalizando, setSinalizando] = useState(null) //id da entrega em andamento
  const [aviso,setAviso] = useState('')
  const [erro, setErro] = useState('')

  const temaAprovado = tcc?.tema?.status === 'aprovado'
  const entregas = tcc?.entregas || []

  async function sinalizar(entrega) {
    setAviso('')
    setErro('')
    setSinalizando(entrega.id)
    try {
      await api.post(`/entregas/${entrega.id}/sinalizar-pronta/`)
      setAviso(`"${entrega.titulo}" sinalizada. Seu orientador foi avisado.`)
      await recarregar()
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível sinalizar a entrega.'))
    } finally {
      setSinalizando(null)
    }
  }

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

      {aviso && <p className="aviso">{aviso}</p>}
      {erro && <p className="erro">{erro}</p>}


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
             <div className="acoes-linha">
                <Estado
                  codigo={entrega.estado}
                  rotulo={ROTULO_ESTADO_ENTREGA[entrega.estado]}
                  atrasado={entrega.atrasada}
                />
                {/* US08 — a API diz se a entrega pode ser sinalizada (RN04). */}
                {entrega.pode_sinalizar && (
                  <button
                    className="contorno"
                    onClick={() => sinalizar(entrega)}
                    disabled={sinalizando === entrega.id}
                    aria-label={`Sinalizar ${entrega.titulo} como pronta`}
                  >
                    {sinalizando === entrega.id ? 'Sinalizando…' : 'Sinalizar pronta'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
