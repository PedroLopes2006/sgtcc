import { Fragment, useEffect, useState } from 'react'
import api, { mensagemDeErro } from '../../api'
import { useAuth } from '../../auth'
import { chaveDoDia, dataHoraCurta, rotuloDoDia } from '../../formato'

const TIPOS_EVENTO = {
  tema_proposto: { rotulo: 'Tema proposto', icone: 'tema' },
  tema_reenviado: { rotulo: 'Tema reenviado', icone: 'envio' },
  tema_aprovado: { rotulo: 'Tema aprovado', icone: 'aprovacao' },
  tema_ajuste_solicitado: { rotulo: 'Ajuste de tema solicitado', icone: 'comentario' },
  entrega_criada: { rotulo: 'Entrega criada', icone: 'criacao' },
  entrega_pronta: { rotulo: 'Entrega sinalizada como pronta', icone: 'pronta' },
  upload: { rotulo: 'Versão enviada', icone: 'envio' },
  entrega_em_revisao: { rotulo: 'Entrega em revisão', icone: 'revisao' },
  correcao_solicitada: { rotulo: 'Correção solicitada', icone: 'comentario' },
  comentario_adicionado: { rotulo: 'Comentário adicionado', icone: 'comentario' },
  entrega_concluida: { rotulo: 'Entrega concluída', icone: 'aprovacao' },
  entrega_enviada_a_banca: { rotulo: 'Entrega enviada à banca', icone: 'envio' },
  troca_orientador: { rotulo: 'Orientador alterado', icone: 'troca' },
}

function IconeEvento({ tipo }) {
  const desenhos = {
    tema: <><path d="M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4z" /><path d="M20 4h-4a3 3 0 0 0-3 3v14a4 4 0 0 1 4-2h3z" /></>,
    criacao: <><path d="M14 3H6v18h12V7zM14 3v5h4" /><path d="M9 14h6m-3-3v6" /></>,
    envio: <><path d="M12 16V3m-5 5 5-5 5 5" /><path d="M4 15v6h16v-6" /></>,
    pronta: <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>,
    revisao: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
    comentario: <><path d="M21 15a3 3 0 0 1-3 3H8l-5 3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3z" /><path d="M8 8h8m-8 5h5" /></>,
    aprovacao: <><path d="m6 12 4 4L20 6" /><path d="M20 13v7H3V3h11" /></>,
    troca: <><path d="M3 7h17l-4-4m5 14H4l4 4M20 7l-4 4M4 17l4-4" /></>,
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {desenhos[tipo] || desenhos.tema}
    </svg>
  )
}

/** US16 — log cronológico e somente leitura do TCC do aluno autenticado. */
export default function LinhaDoTempo() {
  const { usuario } = useAuth()
  const [eventos, setEventos] = useState(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let ativo = true

    api.get('/eventos/').then(({ data }) => {
      if (ativo) setEventos([...data].reverse())
    }).catch((e) => {
      if (ativo) setErro(mensagemDeErro(e, 'Não foi possível carregar a linha do tempo.'))
    })

    return () => { ativo = false }
  }, [])

  return (
    <div className="pagina-timeline">
      <div className="cabecalho-pagina">
        <div>
          <h1>Linha do tempo</h1>
          <p className="legenda">Histórico de atividades do seu TCC.</p>
        </div>
      </div>

      {erro ? <p className="erro">{erro}</p> : eventos === null ? (
        <p className="carregando">Carregando…</p>
      ) : eventos.length === 0 ? (
        <div className="vazio vazio-compacto">
          <strong>Nenhum evento registrado</strong>
          <span>Os acontecimentos do seu TCC aparecerão aqui.</span>
        </div>
      ) : (
        <>
          <div className="timeline-resumo">
            <span>{eventos.length} {eventos.length === 1 ? 'registro' : 'registros'}</span>
            <span>Mais recentes primeiro</span>
          </div>
          <ol className="linha-do-tempo">
            {eventos.map((evento, posicao) => {
              const tipo = TIPOS_EVENTO[evento.tipo] || { rotulo: evento.tipo, icone: 'tema' }
              const autor = evento.usuario_relacionado
              const meuEvento = autor?.id === usuario?.id
              // Os eventos já vêm do mais novo para o mais antigo; um cabeçalho abre cada dia.
              const novoDia =
                posicao === 0 ||
                chaveDoDia(evento.data_hora) !== chaveDoDia(eventos[posicao - 1].data_hora)

              return (
                <Fragment key={evento.id}>
                {novoDia && (
                  <li className="dia-timeline" role="presentation">
                    {rotuloDoDia(evento.data_hora)}
                  </li>
                )}
                <li className="evento-timeline">
                  <span className={`marcador-timeline icone-${tipo.icone}`}><IconeEvento tipo={tipo.icone} /></span>
                  <article className="timeline-registro" aria-label={tipo.rotulo}>
                    <div className="timeline-cabecalho">
                      <h2>{tipo.rotulo}</h2>
                      <time dateTime={evento.data_hora}>{dataHoraCurta(evento.data_hora)}</time>
                    </div>
                    <p>{evento.descricao}</p>
                    <div className="timeline-autor">
                      <span className="timeline-identidade">
                        {meuEvento ? 'Você' : autor?.nome || 'Registro do sistema'}
                      </span>
                      {autor && !meuEvento && <span>· Orientador</span>}
                    </div>
                  </article>
                </li>
                </Fragment>
              )
            })}
          </ol>
        </>
      )}
    </div>
  )
}
