import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { mensagemDeErro } from '../../api'
import Estado from '../../components/Estado'
import Layout from '../../components/Layout'
import LinkVersao from '../../components/LinkVersao'
import Modal from '../../components/Modal'
import { dataCurta, iniciais } from '../../formato'

/**
 * US04 — a avaliação do tema sai desta tabela, num modal, como no protótipo.
 *
 * Não existe uma "fila de temas" separada: o orientador vê todos os
 * orientandos e age na linha de quem está com tema pendente. A "Fila de
 * revisão" do protótipo é de entregas (US09), e entra num próximo sprint.
 *
 * US10 — a entrega pronta para revisão ganha "Iniciar revisão" na linha.
 * US11 — a entrega em revisão ganha "Solicitar correção", num modal com o
 * comentário obrigatório (RN07). Quem diz qual entrega espera o orientador é
 * a API (`entrega_para_revisao`); a tela só liga o botão do estado certo.
 *
 * Junto dos botões, o link "Abrir versão N" leva ao PDF da versão atual dessa
 * entrega, para o orientador ler o documento antes de decidir.
 */
export default function Orientandos() {
  const [reatribuindo, setReatribuindo] = useState(null)
  const [agindo, setAgindo] = useState(null)
  const [linhas, setLinhas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [avaliando, setAvaliando] = useState(null)
  const [corrigindo, setCorrigindo] = useState(null)
  const [iniciando, setIniciando] = useState(null) // id da entrega em andamento

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get('/orientandos/')
      setLinhas(data)
      setErro('')
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível carregar seus orientandos.'))
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function iniciarRevisao(entrega) {
    setAviso('')
    setErro('')
    setIniciando(entrega.id)
    try {
      await api.post(`/entregas/${entrega.id}/iniciar-revisao/`)
      setAviso(`Revisão de "${entrega.titulo}" iniciada. O aluno foi avisado.`)
      await carregar()
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível iniciar a revisão.'))
    } finally {
      setIniciando(null)
    }
  }

  /** US12 CA1–CA2 / US13 CA1 / RF11–12, RF16–18 / RN05–06, RN10, RN12 / RNF04, RNF12. */
  async function concluirAcao(entrega, acao) {
    setAgindo(entrega.id)
    setErro('')
    setAviso('')
    try {
      await api.post(`/entregas/${entrega.id}/${acao}/`)
      await carregar()
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível concluir a ação.'))
    } finally {
      setAgindo(null)
    }
  }

  const pendentes = linhas.filter((l) => l.aguarda_avaliacao_de_tema).length
  const itens = [
    { rotulo: 'Fila de revisão', icone: '▤' },
    {
      rotulo: 'Orientandos',
      icone: '◍',
      para: '/orientador',
      exato: true,
      contador: linhas.length || undefined,
    },
    { rotulo: 'Perfil', icone: '◎' },
  ]

  return (
    <Layout itens={itens}>
      <div className="cabecalho-pagina">
        <h1>Orientandos</h1>
        {pendentes > 0 && (
          <span className="estado">
            <span className="ponto proposto" aria-hidden="true" />
            {pendentes} {pendentes === 1 ? 'tema aguardando' : 'temas aguardando'}
          </span>
        )}
      </div>

      {aviso && <p className="aviso">{aviso}</p>}
      {erro && <p className="erro">{erro}</p>}

      {carregando ? (
        <p className="carregando">Carregando…</p>
      ) : linhas.length === 0 ? (
        <div className="vazio">
          <strong>Você ainda não tem orientandos</strong>
          <span>Quando um aluno indicar você ao propor o tema, ele aparece aqui.</span>
        </div>
      ) : (
        <table className="tabela">
          <thead>
            <tr>
              <th>Orientando</th>
              <th>Fase atual</th>
              <th>Estado</th>
              <th>Progresso</th>
              <th>Prazo</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => (
              <tr key={linha.id}>
                <td>
                  <div className="celula-aluno">
                    <span className="avatar">{iniciais(linha.aluno?.nome)}</span>
                    <div>
                      <div>{linha.aluno?.nome}</div>
                      <div className="tema">{linha.tema?.titulo || 'Sem tema'}</div>
                    </div>
                  </div>
                </td>
                <td>{linha.fase_atual}</td>
                <td>
                  <Estado codigo={linha.estado.codigo} rotulo={linha.estado.rotulo} />
                </td>
                <td className="numerico">
                  {linha.progresso.total === 0
                    ? '—'
                    : `${linha.progresso.concluidas} de ${linha.progresso.total}`}
                </td>
                <td className={linha.prazo_vencido ? 'numerico prazo-vencido' : 'numerico'}>
                  {dataCurta(linha.prazo)}
                </td>
                <td>
                  <div className="acoes-linha">
                    {/* US15 CA1–CA2 / RF14 / RN08 / RNF04 */}
                    <Link to={`/orientador/orientandos/${linha.id}/historico`}>Histórico</Link>
                    <button className="contorno" onClick={() => setReatribuindo(linha)}>Reatribuir</button>
                    {/* US12 CA1–CA2 / RN06 */}
                    {linha.entrega_para_revisao?.estado === 'em_revisao' && (
                      <button onClick={() => concluirAcao(linha.entrega_para_revisao, 'aprovar')}
                        disabled={agindo === linha.entrega_para_revisao.id}
                        aria-label={`Aprovar entrega ${linha.entrega_para_revisao.titulo}`}>
                        Aprovar entrega
                      </button>
                    )}
                    {/* US13 CA1 / RN12 */}
                    {linha.entrega_para_banca && (
                      <button onClick={() => concluirAcao(linha.entrega_para_banca, 'enviar-a-banca')}
                        disabled={agindo === linha.entrega_para_banca.id}
                        aria-label={`Enviar à banca ${linha.entrega_para_banca.titulo}`}>
                        Enviar à banca
                      </button>
                    )}
                    {linha.aguarda_avaliacao_de_tema && (
                      <button className="contorno" onClick={() => setAvaliando(linha)}>
                        Avaliar tema
                      </button>
                    )}
                    <LinkVersao
                      versao={linha.entrega_para_revisao?.versao_atual}
                      titulo={linha.entrega_para_revisao?.titulo}
                    />
                    {/* US10 CA1 — só a entrega pronta para revisão pode ser aberta (RN06). */}
                    {linha.entrega_para_revisao?.estado === 'pronto_para_revisao' && (
                      <button
                        className="contorno"
                        onClick={() => iniciarRevisao(linha.entrega_para_revisao)}
                        disabled={iniciando === linha.entrega_para_revisao.id}
                        aria-label={`Iniciar revisão de ${linha.entrega_para_revisao.titulo}`}
                      >
                        {iniciando === linha.entrega_para_revisao.id ? 'Iniciando…' : 'Iniciar revisão'}
                      </button>
                    )}
                    {/* US11 CA1 — só a entrega em revisão pede correção (RN06). */}
                    {linha.entrega_para_revisao?.estado === 'em_revisao' && (
                      <button
                        className="contorno"
                        onClick={() => setCorrigindo(linha)}
                        aria-label={`Solicitar correção de ${linha.entrega_para_revisao.titulo}`}
                      >
                        Solicitar correção
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {reatribuindo && (
        <ModalReatribuir linha={reatribuindo} aoFechar={() => setReatribuindo(null)}
          aoConcluir={async () => { setReatribuindo(null); await carregar() }} />
      )}
      {avaliando && (
        <ModalAvaliarTema
          linha={avaliando}
          aoFechar={() => setAvaliando(null)}
          aoConcluir={async () => {
            setAvaliando(null)
            await carregar()
          }}
        />
      )}
      {corrigindo && (
        <ModalSolicitarCorrecao
          linha={corrigindo}
          aoFechar={() => setCorrigindo(null)}
          aoConcluir={async () => {
            const { titulo } = corrigindo.entrega_para_revisao
            setCorrigindo(null)
            setAviso(`Correção solicitada em "${titulo}". O aluno foi avisado.`)
            await carregar()
          }}
        />
      )}
    </Layout>
  )
}

/** US11 — comentário obrigatório (RN07); o aluno o recebe junto com a notificação. */
function ModalSolicitarCorrecao({ linha, aoFechar, aoConcluir }) {
  const { aluno, entrega_para_revisao: entrega } = linha
  const [comentario, setComentario] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar(evento) {
    evento.preventDefault()
    // RN07 — como no protótipo, o botão fica ativo e a mensagem aparece ao tentar.
    if (!comentario.trim()) {
      setErro('Escreva um comentário para solicitar correção.')
      return
    }
    setErro('')
    setEnviando(true)
    try {
      await api.post(`/entregas/${entrega.id}/solicitar-correcao/`, { comentario })
      await aoConcluir()
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível solicitar a correção.'))
      setEnviando(false)
    }
  }

  return (
    <Modal titulo="Solicitar correção" aoFechar={aoFechar}>
      <div className="modal-autor">
        <span className="avatar">{iniciais(aluno?.nome)}</span>
        <div>
          <div>{aluno?.nome}</div>
          <div className="quando">{entrega.titulo}</div>
        </div>
      </div>

      {entrega.versao_atual?.arquivo_url && (
        <div className="bloco-leitura">
          <div className="rotulo">Documento</div>
          <div className="documento-versao">
            <LinkVersao versao={entrega.versao_atual} />
            <span className="meta">{entrega.versao_atual.nome_original}</span>
          </div>
        </div>
      )}

      {erro && <p className="erro">{erro}</p>}

      <form onSubmit={enviar}>
        <div className="campo">
          <label htmlFor="comentario">Novo comentário</label>
          <textarea
            id="comentario"
            rows={5}
            value={comentario}
            onChange={(e) => {
              setComentario(e.target.value)
              setErro('')
            }}
            placeholder="Descreva o que precisa ser ajustado"
          />
          <p className="ajuda">
            Obrigatório. O aluno recebe esse comentário junto com a notificação.
          </p>
        </div>

        <div className="barra-acoes">
          <button type="button" className="contorno" onClick={aoFechar} disabled={enviando}>
            Cancelar
          </button>
          <button type="submit" disabled={enviando}>
            {enviando ? 'Enviando…' : 'Solicitar correção'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function ModalAvaliarTema({ linha, aoFechar, aoConcluir }) {
  const { tema, aluno } = linha
  const [pedindoAjuste, setPedindoAjuste] = useState(false)
  const [justificativa, setJustificativa] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function aprovar() {
    setErro('')
    setEnviando(true)
    try {
      await api.post(`/temas/${tema.id}/aprovar/`)
      await aoConcluir()
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível aprovar o tema.'))
      setEnviando(false)
    }
  }

  async function solicitarAjuste(evento) {
    evento.preventDefault()
    setErro('')
    setEnviando(true)
    try {
      await api.post(`/temas/${tema.id}/solicitar-ajuste/`, { justificativa })
      await aoConcluir()
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível enviar a solicitação.'))
      setEnviando(false)
    }
  }

  return (
    <Modal titulo="Avaliar tema" aoFechar={aoFechar}>
      <div className="modal-autor">
        <span className="avatar">{iniciais(aluno?.nome)}</span>
        <div>
          <div>{aluno?.nome}</div>
          <div className="quando">Proposto em {dataCurta(tema.data_proposta)}</div>
        </div>
      </div>

      <div className="bloco-leitura">
        <div className="rotulo">Título</div>
        <strong>{tema.titulo}</strong>
      </div>

      <div className="bloco-leitura">
        <div className="rotulo">Descrição</div>
        <div>{tema.descricao}</div>
      </div>

      {erro && <p className="erro">{erro}</p>}

      {pedindoAjuste ? (
        <form onSubmit={solicitarAjuste}>
          {/* CA2 / RN07 — a justificativa é obrigatória. */}
          <div className="campo">
            <label htmlFor="justificativa">Justificativa</label>
            <textarea
              id="justificativa"
              rows={4}
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Explique o que precisa ser ajustado no tema"
              required
            />
            <p className="ajuda">
              Obrigatória. O aluno recebe essa mensagem junto com a notificação.
            </p>
          </div>

          <div className="barra-acoes">
            <button
              type="button"
              className="contorno"
              onClick={() => setPedindoAjuste(false)}
              disabled={enviando}
            >
              Cancelar
            </button>
            <button type="submit" disabled={enviando || !justificativa.trim()}>
              {enviando ? 'Enviando…' : 'Enviar solicitação'}
            </button>
          </div>
        </form>
      ) : (
        <div className="barra-acoes">
          <button className="contorno" onClick={() => setPedindoAjuste(true)} disabled={enviando}>
            Solicitar ajuste
          </button>
          <button onClick={aprovar} disabled={enviando}>
            {enviando ? 'Aprovando…' : 'Aprovar tema'}
          </button>
        </div>
      )}
    </Modal>
  )
}


/** US15 CA1–CA3 / RF14 / RN05, RN08–10, RN15 / RNF04: escolhe o novo orientador. */
function ModalReatribuir({ linha, aoFechar, aoConcluir }) {
  const [orientadores, setOrientadores] = useState([])
  const [destino, setDestino] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  useEffect(() => {
    let ativo = true
    api.get('/orientadores/').then(({ data }) => {
      if (ativo) setOrientadores(data.filter(o => o.id !== linha.tema?.orientador?.id))
    }).catch(e => { if (ativo) setErro(mensagemDeErro(e, 'Não foi possível carregar os orientadores.')) })
    return () => { ativo = false }
  }, [linha])

  /** US15 CA1–CA3 / RF14 / RN08–10, RN15 / RNF04: confirma a reatribuição via API. */
  async function enviar(evento) {
    evento.preventDefault()
    setEnviando(true)
    setErro('')
    try {
      await api.post(`/orientandos/${linha.id}/reatribuir/`, { novo_orientador: Number(destino) })
      await aoConcluir()
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível reatribuir a orientação.'))
      setEnviando(false)
    }
  }
  return <Modal titulo="Reatribuir" aoFechar={aoFechar}>
    {erro && <p className="erro">{erro}</p>}
    <form onSubmit={enviar}>
      <div className="campo">
        <label htmlFor="novo-orientador">Orientador</label>
        <select id="novo-orientador" value={destino} onChange={e => setDestino(e.target.value)} required>
          <option value="">Selecione um orientador</option>
          {orientadores.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
      </div>
      <div className="barra-acoes">
        <button type="button" className="contorno" onClick={aoFechar} disabled={enviando}>Cancelar</button>
        <button type="submit" disabled={enviando || !destino}>Reatribuir</button>
      </div>
    </form>
  </Modal>
}
