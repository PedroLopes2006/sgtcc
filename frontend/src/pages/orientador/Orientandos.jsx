import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { mensagemDeErro } from '../../api'
import Estado from '../../components/Estado'
import Indicadores from '../../components/Indicadores'
import LayoutOrientador from '../../components/LayoutOrientador'
import LinkVersao from '../../components/LinkVersao'
import MenuMais from '../../components/MenuMais'
import Modal from '../../components/Modal'
import Toast from '../../components/Toast'
import { dataCurta, iniciais, semAcento } from '../../formato'

/**
 * US04 — a avaliação do tema sai desta tabela, num modal, como no protótipo.
 *
 * Não existe uma "fila de temas" separada: o orientador vê todos os
 * orientandos e age na linha de quem está com tema pendente. A "Fila de
 * revisão" do protótipo é de entregas (US09) e tem tela própria (FilaRevisao).
 *
 * US10 — a entrega pronta para revisão ganha "Iniciar revisão" na linha.
 * US11 — a entrega em revisão ganha "Solicitar correção", num modal com o
 * comentário obrigatório (RN07). Quem diz qual entrega espera o orientador é
 * a API (`entrega_para_revisao`); a tela só liga o botão do estado certo.
 * US11 / RF10 — "Adicionar comentário" registra um comentário a mais, sem mudar
 * o estado, para complementar ou corrigir o anterior (RN14: o comentário nunca
 * é editado). A entrega vem em `entrega_para_comentario`, só a primeira pendente
 * (RN06), em revisão ou com correção solicitada.
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
  const [comentando, setComentando] = useState(null)
  const [iniciando, setIniciando] = useState(null) // id da entrega em andamento
  const [filtro, setFiltro] = useState('todos')
  const [busca, setBusca] = useState('')

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
  const emAtraso = linhas.filter((l) => l.prazo_vencido).length
  // US09 — a fila é a mesma regra de `entrega_para_revisao` (só a primeira pendente,
  // se estiver pronta), então o contador sai destes dados, sem outra requisição.
  const naFila = linhas.filter(
    (l) => l.entrega_para_revisao?.estado === 'pronto_para_revisao',
  ).length

  // EXTRA (fora dos requisitos) — filtros e busca sobre o que a tela já carregou.
  // Quem manda no que existe e na ordem é a API; aqui só se esconde o que não interessa.
  const filtros = [
    { codigo: 'todos', rotulo: 'Todos', quantos: linhas.length },
    { codigo: 'revisar', rotulo: 'Para revisar', quantos: naFila },
    { codigo: 'temas', rotulo: 'Temas a avaliar', quantos: pendentes },
    { codigo: 'atraso', rotulo: 'Em atraso', quantos: emAtraso },
  ]
  const passaNoFiltro = {
    todos: () => true,
    revisar: (l) => l.entrega_para_revisao?.estado === 'pronto_para_revisao',
    temas: (l) => l.aguarda_avaliacao_de_tema,
    atraso: (l) => l.prazo_vencido,
  }[filtro]
  const termo = semAcento(busca.trim())
  const visiveis = linhas.filter(
    (l) =>
      passaNoFiltro(l) &&
      (!termo || semAcento(`${l.aluno?.nome} ${l.tema?.titulo || ''}`).includes(termo)),
  )

  return (
    <LayoutOrientador orientandos={linhas.length} fila={naFila}>
      <div className="cabecalho-pagina">
        <h1>Orientandos</h1>
        {pendentes > 0 && (
          <span className="estado">
            <span className="ponto proposto" aria-hidden="true" />
            {pendentes} {pendentes === 1 ? 'tema aguardando' : 'temas aguardando'}
          </span>
        )}
      </div>

      <Toast mensagem={aviso} aoFechar={() => setAviso('')} />
      {erro && <p className="erro">{erro}</p>}

      {/* Números de relance, tirados dos mesmos dados da tabela (sem nova requisição). */}
      {!carregando && linhas.length > 0 && (
        <Indicadores
          itens={[
            { rotulo: 'Orientandos ativos', valor: linhas.length },
            { rotulo: 'Para revisar', valor: naFila },
            { rotulo: 'Temas a avaliar', valor: pendentes },
            { rotulo: 'Em atraso', valor: emAtraso, alerta: emAtraso > 0 },
          ]}
        />
      )}

      {carregando ? (
        <p className="carregando">Carregando…</p>
      ) : linhas.length === 0 ? (
        <div className="vazio">
          <strong>Você ainda não tem orientandos</strong>
          <span>Quando um aluno indicar você ao propor o tema, ele aparece aqui.</span>
        </div>
      ) : (
        <>
        <div className="filtros-barra">
          <div className="filtros" role="group" aria-label="Filtrar orientandos">
            {filtros.map(({ codigo, rotulo, quantos }) => (
              <button
                key={codigo}
                type="button"
                className="filtro"
                aria-pressed={filtro === codigo}
                onClick={() => setFiltro(codigo)}
              >
                {rotulo}
                <span className="filtro-numero">{quantos}</span>
              </button>
            ))}
          </div>
          <div className="busca">
            <input
              type="search"
              aria-label="Buscar orientando"
              placeholder="Buscar por aluno ou tema"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </div>
        {visiveis.length === 0 ? (
          <div className="vazio vazio-compacto">
            <strong>Nenhum orientando com esse filtro</strong>
            <span>Troque o filtro ou limpe a busca para ver os outros.</span>
          </div>
        ) : (
        <table className="tabela tabela-cartoes">
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
            {visiveis.map((linha) => (
              <tr key={linha.id}>
                <td data-rotulo="Orientando">
                  <div className="celula-aluno">
                    <span className="avatar">{iniciais(linha.aluno?.nome)}</span>
                    <div>
                      <div>{linha.aluno?.nome}</div>
                      <div className="tema">{linha.tema?.titulo || 'Sem tema'}</div>
                    </div>
                  </div>
                </td>
                <td data-rotulo="Fase atual">{linha.fase_atual}</td>
                <td data-rotulo="Estado">
                  <Estado codigo={linha.estado.codigo} rotulo={linha.estado.rotulo} />
                </td>
                <td className="numerico" data-rotulo="Progresso">
                  {linha.progresso.total === 0 ? (
                    '—'
                  ) : (
                    <div className="progresso-celula">
                      <span>{`${linha.progresso.concluidas} de ${linha.progresso.total}`}</span>
                      <span className="barra-progresso" aria-hidden="true">
                        <span
                          style={{
                            width: `${Math.round((linha.progresso.concluidas / linha.progresso.total) * 100)}%`,
                          }}
                        />
                      </span>
                    </div>
                  )}
                </td>
                {/* US14 CA2 — prazo vencido: data em vermelho e um ponto vermelho próprio,
                    separado do ponto do estado (que mantém a cor do estado). */}
                <td className={linha.prazo_vencido ? 'numerico prazo-vencido' : 'numerico'} data-rotulo="Prazo">
                  {linha.prazo_vencido && (
                    <span
                      className="marcador-vencido"
                      role="img"
                      aria-label="Prazo vencido"
                      title="Prazo vencido"
                    />
                  )}
                  {dataCurta(linha.prazo)}
                </td>
                <td className="celula-acoes">
                  <div className="acoes-linha">
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
                    {/* EXTRA (protótipo, fora dos requisitos) — tela de Revisão da entrega. */}
                    {(linha.entrega_para_revisao || linha.entrega_para_comentario) && (
                      <Link
                        className="contorno"
                        to={`/orientador/entregas/${(linha.entrega_para_revisao || linha.entrega_para_comentario).id}`}
                        aria-label={`Abrir revisão de ${(linha.entrega_para_revisao || linha.entrega_para_comentario).titulo}`}
                      >
                        Abrir revisão
                      </Link>
                    )}
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
                    {/* O que se faz menos, ou só às vezes, fica no "Mais ações". */}
                    <MenuMais rotulo={`Mais ações de ${linha.aluno?.nome}`}>
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
                      {/* US11 / RF10 / RN14 — comentário a mais, sem mudar o estado (RN06). */}
                      {linha.entrega_para_comentario && (
                        <button
                          className="contorno"
                          onClick={() => setComentando(linha)}
                          aria-label={`Adicionar comentário em ${linha.entrega_para_comentario.titulo}`}
                        >
                          Adicionar comentário
                        </button>
                      )}
                      {/* US15 CA1–CA2 / RF14 / RN08 / RNF04 */}
                      <Link to={`/orientador/orientandos/${linha.id}/historico`}>Histórico</Link>
                      <button className="contorno" onClick={() => setReatribuindo(linha)}>
                        Reatribuir
                      </button>
                    </MenuMais>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
        </>
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
      {comentando && (
        <ModalComentarioAdicional
          linha={comentando}
          aoFechar={() => setComentando(null)}
          aoConcluir={async () => {
            const { titulo } = comentando.entrega_para_comentario
            setComentando(null)
            setAviso(`Comentário adicionado em "${titulo}". O aluno foi avisado.`)
            await carregar()
          }}
        />
      )}
    </LayoutOrientador>
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

/**
 * US11 / RF10 — comentário a mais, sem mudar o estado da entrega.
 *
 * RN14: o comentário anterior nunca é editado, então o ajuste vira um novo. A
 * lista do que já foi escrito aparece acima do campo, só para leitura.
 * RN07: o texto é obrigatório; a mensagem aparece ao tentar enviar vazio.
 */
function ModalComentarioAdicional({ linha, aoFechar, aoConcluir }) {
  const { aluno, entrega_para_comentario: entrega } = linha
  const anteriores = entrega.comentarios || []
  const [comentario, setComentario] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar(evento) {
    evento.preventDefault()
    if (!comentario.trim()) {
      setErro('Escreva um comentário para adicioná-lo.')
      return
    }
    setErro('')
    setEnviando(true)
    try {
      await api.post(`/entregas/${entrega.id}/comentarios/`, { comentario })
      await aoConcluir()
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível adicionar o comentário.'))
      setEnviando(false)
    }
  }

  return (
    <Modal titulo="Adicionar comentário" aoFechar={aoFechar}>
      <div className="modal-autor">
        <span className="avatar">{iniciais(aluno?.nome)}</span>
        <div>
          <div>{aluno?.nome}</div>
          <div className="quando">{entrega.titulo}</div>
        </div>
      </div>

      {anteriores.length > 0 && (
        <div className="bloco-leitura">
          <div className="rotulo">Comentários anteriores</div>
          {anteriores.map((anterior) => (
            <div className="comentario-correcao" key={anterior.id}>
              <div>{anterior.texto}</div>
              <div className="rotulo">
                {anterior.autor?.nome}
                {anterior.versao && ` · versão ${anterior.versao}`}
                {` · ${dataCurta(anterior.data_criacao)}`}
              </div>
            </div>
          ))}
        </div>
      )}

      {erro && <p className="erro">{erro}</p>}

      <form onSubmit={enviar}>
        <div className="campo">
          <label htmlFor="comentario-adicional">Novo comentário</label>
          <textarea
            id="comentario-adicional"
            rows={5}
            value={comentario}
            onChange={(e) => {
              setComentario(e.target.value)
              setErro('')
            }}
            placeholder="Complemente ou corrija o que já escreveu"
          />
          <p className="ajuda">
            Os comentários anteriores não são alterados. O aluno recebe este junto com a
            notificação.
          </p>
        </div>

        <div className="barra-acoes">
          <button type="button" className="contorno" onClick={aoFechar} disabled={enviando}>
            Cancelar
          </button>
          <button type="submit" disabled={enviando}>
            {enviando ? 'Enviando…' : 'Adicionar comentário'}
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
