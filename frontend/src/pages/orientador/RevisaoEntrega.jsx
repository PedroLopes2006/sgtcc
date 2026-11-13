import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api, { mensagemDeErro } from '../../api'
import Estado from '../../components/Estado'
import LayoutOrientador from '../../components/LayoutOrientador'
import LinkVersao from '../../components/LinkVersao'
import Toast from '../../components/Toast'
import { ROTULO_ESTADO_ENTREGA, dataCurta } from '../../formato'

/**
 * EXTRA — tela de Revisão do orientador, do protótipo do Figma.
 *
 * Fora dos requisitos do documento: não há RF, RN nem US para ela. Ela reúne,
 * numa tela só, o que as US07, US10, US11, US12 e US13 já fazem: ver as
 * versões e os comentários da entrega, iniciar a revisão, pedir correção,
 * acrescentar um comentário, aprovar e enviar à banca.
 *
 * Quem decide o que o orientador pode fazer é a API (`acoes`, RN06): a tela só
 * liga os botões que ela libera. O comentário é obrigatório para pedir
 * correção (RN07) e nunca é editado (RN14): o ajuste vira um comentário novo.
 */
export default function RevisaoEntrega() {
  const { entregaId } = useParams()
  const [entrega, setEntrega] = useState(null)
  const [erroCarga, setErroCarga] = useState('')
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [comentario, setComentario] = useState('')
  const [agindo, setAgindo] = useState(false)

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get(`/entregas/${entregaId}/revisao/`)
      setEntrega(data)
      setErroCarga('')
    } catch (e) {
      setErroCarga(mensagemDeErro(e, 'Não foi possível abrir esta entrega.'))
    }
  }, [entregaId])

  useEffect(() => {
    carregar()
  }, [carregar])

  /** Chama o endpoint da ação, avisa o resultado e recarrega a tela. */
  async function executar(rota, corpo, mensagem) {
    setAviso('')
    setErro('')
    setAgindo(true)
    try {
      await api.post(`/entregas/${entrega.id}/${rota}/`, corpo)
      setComentario('')
      setAviso(mensagem)
      await carregar()
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível concluir a ação.'))
    } finally {
      setAgindo(false)
    }
  }

  function solicitarCorrecao() {
    // RN07 — como no protótipo, o botão fica ativo e a mensagem aparece ao tentar.
    if (!comentario.trim()) {
      setErro('Escreva um comentário para solicitar correção.')
      return
    }
    executar('solicitar-correcao', { comentario }, 'Correção solicitada. O aluno foi avisado.')
  }

  function adicionarComentario() {
    if (!comentario.trim()) {
      setErro('Escreva um comentário para adicioná-lo.')
      return
    }
    executar('comentarios', { comentario }, 'Comentário adicionado. O aluno foi avisado.')
  }

  const voltar = (
    <Link className="voltar" to="/orientador/fila">
      ← Fila de revisão
    </Link>
  )

  if (erroCarga) {
    return (
      <LayoutOrientador>
        <div className="conteudo-estreito">
          {voltar}
          <p className="erro">{erroCarga}</p>
        </div>
      </LayoutOrientador>
    )
  }

  if (!entrega) {
    return (
      <LayoutOrientador>
        <div className="conteudo-estreito">
          {voltar}
          <p className="carregando">Carregando…</p>
        </div>
      </LayoutOrientador>
    )
  }

  const { acoes, aluno } = entrega
  const encerrada = ['concluida', 'enviada_a_banca'].includes(entrega.estado)
  const semAcao = !Object.values(acoes).some(Boolean)
  const versoes = [...entrega.versoes].reverse() // a API manda em ordem cronológica

  return (
    <LayoutOrientador>
      <div className="conteudo-estreito">
        {voltar}

        <div className="cabecalho-pagina">
          <div>
            <h1>{entrega.titulo}</h1>
            <p className="legenda">
              {aluno?.nome} · prazo {dataCurta(entrega.prazo)}
              {entrega.versao_atual && ` · versão ${entrega.versao_atual.numero}`}
              {entrega.atrasada && ' · vencido'}
            </p>
          </div>
          <div className="cabecalho-acoes">
            <Estado codigo={entrega.estado} rotulo={ROTULO_ESTADO_ENTREGA[entrega.estado]} />
            <LinkVersao versao={entrega.versao_atual} titulo={entrega.titulo} />
            {/* US10 CA1 — só a entrega pronta para revisão, e só a primeira pendente (RN06). */}
            {acoes.iniciar_revisao && (
              <button
                onClick={() =>
                  executar('iniciar-revisao', undefined, 'Revisão iniciada. O aluno foi avisado.')
                }
                disabled={agindo}
              >
                Iniciar revisão
              </button>
            )}
          </div>
        </div>

        <Toast mensagem={aviso} aoFechar={() => setAviso('')} />
        {erro && <p className="erro">{erro}</p>}

        <section className="secao-revisao" aria-label="Versões">
          <h2>Versões</h2>
          {versoes.length === 0 ? (
            <p className="meta">Nenhuma versão enviada.</p>
          ) : (
            <ol className="lista lista-versoes">
              {versoes.map((versao, posicao) => (
                <li key={versao.id}>
                  <div>
                    <div className="titulo">
                      Versão {versao.numero}
                      {posicao === 0 && <span className="meta"> · atual</span>}
                    </div>
                    <div className="meta">
                      {versao.nome_original} · Enviada em {dataCurta(versao.data_envio)}
                    </div>
                  </div>
                  <LinkVersao versao={versao} titulo={entrega.titulo} />
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="secao-revisao" aria-label="Comentários">
          <h2>Comentários</h2>
          {entrega.comentarios.length === 0 ? (
            <p className="meta">
              {acoes.iniciar_revisao
                ? 'Inicie a revisão para comentar.'
                : 'Nenhum comentário ainda.'}
            </p>
          ) : (
            entrega.comentarios.map((item) => (
              <div className="comentario-correcao" key={item.id}>
                <div>{item.texto}</div>
                <div className="rotulo">
                  {item.autor?.nome}
                  {item.versao && ` · versão ${item.versao}`}
                  {` · ${dataCurta(item.data_criacao)}`}
                </div>
              </div>
            ))
          )}

          {/* US11 / RF10 — o campo vale para pedir correção e para acrescentar comentário. */}
          {acoes.comentar && (
            <div className="campo">
              <label htmlFor="novo-comentario">Novo comentário</label>
              <textarea
                id="novo-comentario"
                rows={4}
                value={comentario}
                onChange={(e) => {
                  setComentario(e.target.value)
                  setErro('')
                }}
                placeholder="Descreva o que precisa ser ajustado"
              />
              <p className="ajuda">
                O aluno recebe o comentário junto com a notificação. Os anteriores não são
                alterados.
              </p>
            </div>
          )}
        </section>

        {(acoes.comentar || acoes.aprovar || acoes.enviar_a_banca) && (
          <div className="barra-acoes">
            {/* US11 CA1 / RN07 */}
            {acoes.solicitar_correcao && (
              <button className="contorno" onClick={solicitarCorrecao} disabled={agindo}>
                Solicitar correção
              </button>
            )}
            {/* US11 / RF10 / RN14 — comentário a mais, sem mudar o estado. */}
            {acoes.comentar && (
              <button className="contorno" onClick={adicionarComentario} disabled={agindo}>
                Adicionar comentário
              </button>
            )}
            {/* US12 CA1 */}
            {acoes.aprovar && (
              <button
                onClick={() =>
                  executar('aprovar', undefined, 'Entrega aprovada. O aluno foi avisado.')
                }
                disabled={agindo}
              >
                Aprovar entrega
              </button>
            )}
            {/* US13 CA1 / RN12 */}
            {acoes.enviar_a_banca && (
              <button
                onClick={() =>
                  executar('enviar-a-banca', undefined, 'Entrega enviada à banca.')
                }
                disabled={agindo}
              >
                Enviar à banca
              </button>
            )}
          </div>
        )}

        {entrega.estado === 'concluida' && (
          <p className="meta">Entrega aprovada em {dataCurta(entrega.data_conclusao)}.</p>
        )}
        {entrega.estado === 'enviada_a_banca' && <p className="meta">Entrega enviada à banca.</p>}
        {semAcao && !encerrada && (
          <p className="meta">
            {entrega.estado === 'rascunho'
              ? 'O aluno ainda não sinalizou esta entrega como pronta.'
              : 'Só é possível revisar a primeira entrega pendente do aluno.'}
          </p>
        )}

        {entrega.tema && <p className="meta">Tema: {entrega.tema}</p>}
      </div>
    </LayoutOrientador>
  )
}
