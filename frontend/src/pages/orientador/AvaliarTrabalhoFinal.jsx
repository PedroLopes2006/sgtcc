import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api, { mensagemDeErro } from '../../api'
import Carregando from '../../components/Carregando'
import ConfirmarAcao from '../../components/ConfirmarAcao'
import Estado from '../../components/Estado'
import LayoutOrientador from '../../components/LayoutOrientador'
import LinkVersao from '../../components/LinkVersao'
import Toast from '../../components/Toast'
import { ROTULO_ESTADO_TRABALHO_FINAL, dataCurta } from '../../formato'

/**
 * US19 — o orientador avalia o trabalho final: aprova, pede correção ou reprova.
 * US20 — com o trabalho aprovado, envia à banca.
 *
 * Quem diz o que o orientador pode fazer agora é a API (`acoes`, RN12, RN17): a tela só
 * liga os botões liberados. O parecer é obrigatório para pedir correção (RN07) e para
 * reprovar (RN17, justificativa), e nunca é editado depois (RN14). Aprovar, reprovar e
 * enviar à banca não têm volta, então pedem confirmação. A reprovação vale só para o
 * trabalho final: nas entregas, o orientador pede correção.
 */
export default function AvaliarTrabalhoFinal() {
  const { tccId } = useParams()
  const [dados, setDados] = useState(null)
  const [erroCarga, setErroCarga] = useState('')
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [parecer, setParecer] = useState('')
  const [agindo, setAgindo] = useState(false)
  const [pedido, setPedido] = useState(null)

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get(`/orientandos/${tccId}/trabalho-final/`)
      setDados(data)
      setErroCarga('')
    } catch (e) {
      setErroCarga(mensagemDeErro(e, 'Não foi possível abrir o trabalho final.'))
    }
  }, [tccId])

  useEffect(() => {
    carregar()
  }, [carregar])

  const voltar = (
    <Link className="voltar" to="/orientador">
      ← Orientandos
    </Link>
  )

  if (erroCarga) {
    return (
      <LayoutOrientador>
        <div className="conteudo-estreito">
          {voltar}
          <p className="erro" role="alert">{erroCarga}</p>
        </div>
      </LayoutOrientador>
    )
  }
  if (!dados) {
    return (
      <LayoutOrientador>
        <div className="conteudo-estreito">
          {voltar}
          <Carregando />
        </div>
      </LayoutOrientador>
    )
  }

  const { aluno, trabalho } = dados

  /** Chama o endpoint da ação, avisa o resultado e recarrega a tela. */
  async function executar(rota, corpo, mensagem) {
    setAviso('')
    setErro('')
    setAgindo(true)
    try {
      await api.post(`/trabalho-final/${trabalho.id}/${rota}/`, corpo)
      setParecer('')
      setAviso(mensagem)
      await carregar()
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível concluir a ação.'))
    } finally {
      setAgindo(false)
    }
  }

  function pedirConfirmacao(tipo) {
    if (tipo === 'reprovar' && !parecer.trim()) {
      // RN17 — a justificativa é obrigatória.
      setErro('Escreva a justificativa para reprovar o trabalho final.')
      return
    }
    const nome = aluno?.nome
    const pedidos = {
      aprovar: {
        titulo: 'Aprovar o trabalho final?',
        texto: `O trabalho final de ${nome} passa a aprovado e o aluno é avisado. Depois disso, ele só pode ser enviado à banca.`,
        rotulo: 'Aprovar trabalho final',
        rota: 'aprovar',
        mensagem: 'Trabalho final aprovado. O aluno foi avisado.',
      },
      reprovar: {
        titulo: 'Reprovar o trabalho final?',
        texto: `O trabalho final de ${nome} é reprovado e a justificativa fica registrada para o aluno. Ele poderá enviar uma nova versão. Isso não pode ser desfeito.`,
        rotulo: 'Reprovar trabalho final',
        rota: 'reprovar',
        corpo: { justificativa: parecer },
        mensagem: 'Trabalho final reprovado. O aluno foi avisado.',
      },
      banca: {
        titulo: 'Enviar à banca?',
        texto: `O trabalho final de ${nome} é registrado como enviado à banca e o TCC passa a concluído. Isso não pode ser desfeito.`,
        rotulo: 'Enviar à banca',
        rota: 'enviar-a-banca',
        mensagem: 'Trabalho final enviado à banca. O TCC está concluído.',
      },
    }
    setErro('')
    setPedido(pedidos[tipo])
  }

  function solicitarCorrecao() {
    // RN07 — como na revisão das entregas, o botão fica ativo e a mensagem aparece ao tentar.
    if (!parecer.trim()) {
      setErro('Escreva um comentário para solicitar correção.')
      return
    }
    executar('solicitar-correcao', { comentario: parecer }, 'Correção solicitada. O aluno foi avisado.')
  }

  const cabecalho = (
    <div className="cabecalho-pagina">
      <div>
        <h1>Trabalho final</h1>
        <p className="legenda">{aluno?.nome}</p>
      </div>
      {trabalho && (
        <div className="cabecalho-acoes">
          <Estado codigo={trabalho.estado} rotulo={ROTULO_ESTADO_TRABALHO_FINAL[trabalho.estado]} />
          <LinkVersao versao={[...trabalho.versoes].pop()} titulo="trabalho final" />
        </div>
      )}
    </div>
  )

  if (!trabalho) {
    return (
      <LayoutOrientador>
        <div className="conteudo-estreito">
          {voltar}
          {cabecalho}
          <div className="vazio vazio-compacto">
            <strong>Trabalho final ainda não enviado</strong>
            <span>Quando {aluno?.nome} enviar o trabalho, ele aparece aqui para avaliação.</span>
          </div>
        </div>
      </LayoutOrientador>
    )
  }

  const { acoes } = trabalho
  const versoes = [...trabalho.versoes].reverse() // a API manda em ordem cronológica
  const podeAvaliar = acoes.aprovar || acoes.solicitar_correcao || acoes.reprovar

  return (
    <LayoutOrientador>
      <div className="conteudo-estreito">
        {voltar}
        {cabecalho}

        <Toast mensagem={aviso} aoFechar={() => setAviso('')} />
        <ConfirmarAcao
          pedido={pedido}
          aoCancelar={() => setPedido(null)}
          aoConfirmar={() => {
            const { rota, corpo, mensagem } = pedido
            setPedido(null)
            executar(rota, corpo, mensagem)
          }}
        />
        {erro && <p className="erro" role="alert">{erro}</p>}

        <section className="secao-revisao" aria-label="Versões">
          <h2>Versões</h2>
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
                <LinkVersao versao={versao} titulo="trabalho final" />
              </li>
            ))}
          </ol>
        </section>

        <section className="secao-revisao" aria-label="Pareceres">
          <h2>Pareceres</h2>
          {trabalho.comentarios.length === 0 ? (
            <p className="meta">Nenhum parecer ainda.</p>
          ) : (
            trabalho.comentarios.map((item) => (
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

          {/* US19 / RN07, RN17 — o mesmo campo vale para pedir correção e para a justificativa. */}
          {podeAvaliar && (
            <div className="campo">
              <label htmlFor="parecer">Parecer</label>
              <textarea
                id="parecer"
                rows={5}
                value={parecer}
                onChange={(e) => {
                  setParecer(e.target.value)
                  setErro('')
                }}
                placeholder="Para pedir correção ou reprovar, descreva o motivo"
              />
              <p className="ajuda">
                Obrigatório para pedir correção e para reprovar. O aluno recebe o texto junto com
                o aviso, e ele não pode ser alterado depois.
              </p>
            </div>
          )}
        </section>

        {(podeAvaliar || acoes.enviar_a_banca) && (
          <div className="barra-acoes">
            {/* US19 CA2 / RN07 */}
            {acoes.solicitar_correcao && (
              <button className="contorno" onClick={solicitarCorrecao} disabled={agindo}>
                Solicitar correção
              </button>
            )}
            {/* US19 CA3, CA4 / RN17 */}
            {acoes.reprovar && (
              <button className="contorno" onClick={() => pedirConfirmacao('reprovar')} disabled={agindo}>
                Reprovar
              </button>
            )}
            {/* US19 CA1 */}
            {acoes.aprovar && (
              <button onClick={() => pedirConfirmacao('aprovar')} disabled={agindo}>
                Aprovar trabalho final
              </button>
            )}
            {/* US20 / RN12 */}
            {acoes.enviar_a_banca && (
              <button onClick={() => pedirConfirmacao('banca')} disabled={agindo}>
                Enviar à banca
              </button>
            )}
          </div>
        )}

        {trabalho.estado === 'enviado_a_banca' && (
          <p className="meta">Trabalho final enviado à banca em {dataCurta(trabalho.data_banca)}.</p>
        )}
        {trabalho.estado === 'correcao_solicitada' && (
          <p className="meta">Aguardando o aluno enviar uma nova versão.</p>
        )}
        {trabalho.estado === 'reprovado' && (
          <p className="meta">Reprovado. O aluno pode enviar uma nova versão para tentar de novo.</p>
        )}
      </div>
    </LayoutOrientador>
  )
}
