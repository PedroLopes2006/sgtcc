import { useCallback, useEffect, useState } from 'react'
import api, { mensagemDeErro } from '../../api'
import Estado from '../../components/Estado'
import Layout from '../../components/Layout'
import Modal from '../../components/Modal'
import { dataCurta, iniciais } from '../../formato'

/**
 * US04 — a avaliação do tema sai desta tabela, num modal, como no protótipo.
 *
 * Não existe uma "fila de temas" separada: o orientador vê todos os
 * orientandos e age na linha de quem está com tema pendente. A "Fila de
 * revisão" do protótipo é de entregas (US09), e entra num próximo sprint.
 */
export default function Orientandos() {
  const [linhas, setLinhas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [avaliando, setAvaliando] = useState(null)

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
            <span className="ponto aguardando" aria-hidden="true" />
            {pendentes} {pendentes === 1 ? 'tema aguardando' : 'temas aguardando'}
          </span>
        )}
      </div>

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
                  {linha.aguarda_avaliacao_de_tema && (
                    <button className="contorno" onClick={() => setAvaliando(linha)}>
                      Avaliar tema
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
    </Layout>
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
