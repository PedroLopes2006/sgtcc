import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api, { mensagemDeErro } from '../../api'
import EnviarVersao from '../../components/EnviarVersao'
import EtapasEntrega from '../../components/EtapasEntrega'
import Estado from '../../components/Estado'
import Toast from '../../components/Toast'
import { ROTULO_ESTADO_ENTREGA, dataCurta } from '../../formato'
import { useTcc } from './AreaAluno'

/**
 * US11 / RF10 — o que o aluno lê numa entrega com correção solicitada: todos os
 * comentários da versão que o orientador avaliou (o pedido de correção e os
 * que vieram depois, RN14), do mais antigo ao mais novo. Sem a lista completa,
 * cai no último comentário.
 */
function comentariosDaCorrecao(entrega) {
  const todos = entrega.comentarios?.length
    ? entrega.comentarios
    : entrega.ultimo_comentario
      ? [entrega.ultimo_comentario]
      : []
  const daVersao = todos.filter((c) => c.versao === entrega.versao_atual?.numero)
  return daVersao.length ? daVersao : todos
}

/**
 * US05 — lista de entregas e porta de entrada para criar uma nova.
 * US06 — envio de versão a partir dela.
 * US08 — cada entrega que já pode ser sinalizada como pronta ganha o botão para isso.
 * US11 — a entrega com correção solicitada mostra os comentários do orientador.
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

      <Toast mensagem={aviso} aoFechar={() => setAviso('')} />
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
                <EtapasEntrega estado={entrega.estado} />
                {/* US11 / RF10 — o aluno lê o que o orientador pediu para corrigir: todos os
                    comentários da versão em correção, o pedido e os que vieram depois (RN14). */}
                {entrega.estado === 'correcao_solicitada' &&
                  comentariosDaCorrecao(entrega).map((comentario) => (
                    <div className="comentario-correcao" key={comentario.id}>
                      <div>{comentario.texto}</div>
                      <div className="rotulo">
                        {comentario.autor?.nome}
                        {comentario.versao && ` · versão ${comentario.versao}`}
                        {` · ${dataCurta(comentario.data_criacao)}`}
                      </div>
                    </div>
                  ))}
              </div>
             <div className="acoes-linha">
                <Estado codigo={entrega.estado} rotulo={ROTULO_ESTADO_ENTREGA[entrega.estado]} />
                {/* RN03 — fora de rascunho e correção solicitada, não há envio. */}
                {entrega.aceita_versao && (
                  <button className="contorno" onClick={() => setEnviandoVersaoDe(entrega)}>
                    Enviar versão
                  </button>
                )}
                <Link className="contorno" to={`/aluno/entregas/${entrega.id}/versoes`}>
                  Histórico de versões
                </Link>
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
