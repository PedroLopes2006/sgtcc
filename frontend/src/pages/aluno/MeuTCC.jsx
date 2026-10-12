import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api, { mensagemDeErro } from '../../api'
import Estado from '../../components/Estado'
import { ROTULO_STATUS_TEMA, dataCurta } from '../../formato'
import { useTcc } from './AreaAluno'

/**
 * "Meu TCC" nos três estados do protótipo: sem tema, tema proposto/aprovado
 * e ajuste solicitado.
 *
 * No ajuste, Tema e Descrição viram campos editáveis na própria lista — é
 * assim no Figma, e evita jogar o aluno para outra tela só para corrigir
 * duas linhas (US03 CA4).
 */
export default function MeuTCC() {
  const { tcc, recarregar } = useTcc()
  const navegar = useNavigate()

  if (!tcc) return <SemTema />

  const { tema, orientador, entregas } = tcc
  const emAjuste = tema.status === 'ajuste_solicitado'
  const concluidas = entregas.filter((e) =>
    ['concluida', 'enviada_a_banca'].includes(e.estado),
  ).length

  return (
    <div>
      <div className="cabecalho-pagina">
        <h1>Meu TCC</h1>
        {tema.status === 'aprovado' && (
          <button className="contorno" onClick={() => navegar('/aluno/entregas')}>
            Ver entregas
          </button>
        )}
      </div>

      {emAjuste ? (
        <FormularioDeAjuste tema={tema} orientador={orientador} aoConcluir={recarregar} />
      ) : (
        <>
          <dl className="definicoes lista-informacoes">
            <div>
              <dt>Orientador</dt>
              <dd>{orientador?.nome || '—'}</dd>
            </div>
            <div>
              <dt>Tema</dt>
              <dd>{tema.titulo}</dd>
            </div>
            <div>
              <dt>Descrição</dt>
              <dd>{tema.descricao}</dd>
            </div>
            <div>
              <dt>Situação</dt>
              <dd>
                <Estado codigo={tema.status} rotulo={ROTULO_STATUS_TEMA[tema.status]} />
              </dd>
            </div>
            <div>
              <dt>Proposto em</dt>
              <dd>{dataCurta(tema.data_proposta)}</dd>
            </div>
            {tema.status === 'aprovado' && (
              <>
                <div>
                  <dt>Aprovado em</dt>
                  <dd>{dataCurta(tema.data_aprovacao)}</dd>
                </div>
                <div>
                  <dt>Progresso</dt>
                  <dd>
                    {entregas.length === 0
                      ? 'Nenhuma entrega criada'
                      : `${concluidas} de ${entregas.length} ${
                          entregas.length === 1 ? 'entrega concluída' : 'entregas concluídas'
                        }`}
                  </dd>
                </div>
              </>
            )}
          </dl>

          {tema.status === 'proposto' && (
            <p className="nota-rodape">Seu orientador foi notificado e vai avaliar o tema.</p>
          )}
        </>
      )}
    </div>
  )
}

function SemTema() {
  return (
    <div>
      <div className="cabecalho-pagina">
        <h1>Meu TCC</h1>
      </div>
      <div className="vazio">
        <strong>Você ainda não propôs um tema</strong>
        <span>Proponha o tema e indique seu orientador para começar.</span>
        <div style={{ marginTop: 20 }}>
          <Link to="/aluno/propor">
            <button>Propor tema</button>
          </Link>
        </div>
      </div>
    </div>
  )
}

/** US03 CA4 — corrige e reenvia o mesmo tema. */
function FormularioDeAjuste({ tema, orientador, aoConcluir }) {
  const [form, setForm] = useState({ titulo: tema.titulo, descricao: tema.descricao })
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function reenviar(evento) {
    evento.preventDefault()
    setErro('')
    setEnviando(true)
    try {
      await api.post(`/temas/${tema.id}/reenviar/`, form)
      await aoConcluir()
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível reenviar o tema.'))
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={reenviar}>
      <dl className="definicoes">
        <div>
          <dt>Orientador</dt>
          <dd>{orientador?.nome || '—'}</dd>
        </div>
        <div>
          <dt>
            <label htmlFor="titulo">Tema</label>
          </dt>
          <dd>
            <input
              id="titulo"
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              required
            />
          </dd>
        </div>
        <div>
          <dt>
            <label htmlFor="descricao">Descrição</label>
          </dt>
          <dd>
            <textarea
              id="descricao"
              rows={3}
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              required
            />
          </dd>
        </div>
        <div>
          <dt>Situação</dt>
          <dd>
            <Estado codigo={tema.status} rotulo={ROTULO_STATUS_TEMA[tema.status]} />
          </dd>
        </div>
      </dl>

      <h2 style={{ marginTop: 24 }}>Justificativa do orientador</h2>
      <div className="citacao">
        {tema.justificativa_ajuste}
        <div className="assinatura">
          {orientador?.nome || 'Orientador'} · {dataCurta(tema.data_proposta)}
        </div>
      </div>

      {erro && <p className="erro">{erro}</p>}

      <div className="barra-acoes">
        <button type="submit" disabled={enviando}>
          {enviando ? 'Reenviando…' : 'Reenviar tema'}
        </button>
      </div>
    </form>
  )
}
