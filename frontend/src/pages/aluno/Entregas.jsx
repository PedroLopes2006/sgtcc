import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { mensagemDeErro } from '../../api'
import EnviarVersao from '../../components/EnviarVersao'
import Estado from '../../components/Estado'
import { ROTULO_ESTADO_ENTREGA, dataCurta } from '../../formato'
import { useTcc } from './AreaAluno'

/**
 * US05 — lista de entregas e porta de entrada para criar uma nova.
 * US06 — envio de versão a partir dela.
 * US08 — cada entrega que já pode ser sinalizada como pronta ganha o botão para isso.
 */
export default function Entregas() {
  const { tcc, recarregar } = useTcc()
  const navegar = useNavigate()
  const [enviandoVersaoDe, setEnviandoVersaoDe] = useState(null)
  const [sinalizando, setSinalizando] = useState(null) // id da entrega em andamento
  const [aviso, setAviso] = useState('')
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

      {/* US11 CA3 — o aviso do protótipo: o aluno vê de relance que há correção pendente. */}
      {entregas
        .filter((e) => e.estado === 'correcao_solicitada' && e.ultimo_comentario)
        .map((e) => (
          <div className="aviso-correcao" key={e.id}>
            <strong>Seu orientador pediu correção</strong>
            <span>
              {e.titulo} · {e.ultimo_comentario.autor?.nome}
            </span>
          </div>
        ))}

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
                  {entrega.versao_atual && ` · versão ${entrega.versao_atual.numero}`}
                  {entrega.atrasada && ' · vencido'}
                </div>
                {/* US11 — o aluno lê o que o orientador pediu para corrigir. */}
                {entrega.estado === 'correcao_solicitada' && entrega.ultimo_comentario && (
                  <div className="comentario-correcao">
                    <div>{entrega.ultimo_comentario.texto}</div>
                    <div className="rotulo">
                      {entrega.ultimo_comentario.autor?.nome}
                      {entrega.ultimo_comentario.versao &&
                        ` · versão ${entrega.ultimo_comentario.versao}`}
                      {` · ${dataCurta(entrega.ultimo_comentario.data_criacao)}`}
                    </div>
                  </div>
                )}
              </div>
             <div className="acoes-linha">
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
