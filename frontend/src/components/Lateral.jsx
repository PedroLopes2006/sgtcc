import { Link } from 'react-router-dom'
import { TITULOS_DE_AVISO } from '../avisos'
import { dataCurta, dataHoraCurta, tempoRelativo } from '../formato'
import PrazoRestante from './PrazoRestante'

/**
 * EXTRA — fora dos requisitos do documento: coluna lateral das telas largas.
 *
 * Fica à direita do conteúdo, só em telas largas, e repete o que pede atenção sem
 * que a pessoa precise trocar de aba: os próximos prazos (aluno) e os avisos
 * mais recentes. Tudo vem de dados que a tela já tem, sem requisição própria
 * além da dos avisos, que o menu já faz.
 */
const ENCERRADAS = ['concluida', 'enviada_a_banca']

function AvisosRecentes({ avisos, para }) {
  return (
    <section className="lateral-bloco" aria-labelledby="lateral-avisos">
      <h2 id="lateral-avisos">Avisos recentes</h2>
      {avisos.length === 0 ? (
        <p className="ajuda">Nada de novo por enquanto.</p>
      ) : (
        <ul className="lateral-lista">
          {avisos.map((aviso) => (
            <li key={aviso.id} className={aviso.nao_lido ? 'novo' : undefined}>
              <strong>{TITULOS_DE_AVISO[aviso.tipo] || 'Atualização'}</strong>
              <span className="lateral-texto">{aviso.descricao}</span>
              <time dateTime={aviso.data_hora} title={dataHoraCurta(aviso.data_hora)}>
                {tempoRelativo(aviso.data_hora)}
              </time>
            </li>
          ))}
        </ul>
      )}
      <Link className="lateral-ver-todos" to={para}>
        Ver todos os avisos
      </Link>
    </section>
  )
}

/** Aluno: os próximos prazos em aberto e os avisos. */
export function LateralAluno({ tcc, avisos }) {
  const abertas = (tcc?.entregas || [])
    .filter((e) => !ENCERRADAS.includes(e.estado) && e.prazo)
    .sort((a, b) => String(a.prazo).localeCompare(String(b.prazo)))
    .slice(0, 4)

  return (
    <>
      <section className="lateral-bloco" aria-labelledby="lateral-prazos">
        <h2 id="lateral-prazos">Próximos prazos</h2>
        {abertas.length === 0 ? (
          <p className="ajuda">Nenhum prazo em aberto.</p>
        ) : (
          <ul className="lateral-lista">
            {abertas.map((entrega) => (
              <li key={entrega.id}>
                <strong>{entrega.titulo}</strong>
                <span className="lateral-texto">
                  {dataCurta(entrega.prazo)}{' '}
                  <PrazoRestante prazo={entrega.prazo} estado={entrega.estado} atrasada={entrega.atrasada} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <AvisosRecentes avisos={avisos} para="/aluno/avisos" />
    </>
  )
}

/** Orientador: o que pede ação, os prazos mais próximos dos orientandos e os avisos. */
export function LateralOrientador({ avisos, fila, temas, linhas }) {
  // Os prazos da fase atual de cada orientando, do mais antigo (vencido) ao mais distante.
  const prazos = (linhas || [])
    .filter((l) => l.prazo)
    .sort((a, b) => String(a.prazo).localeCompare(String(b.prazo)))
    .slice(0, 4)

  return (
    <>
      <section className="lateral-bloco" aria-labelledby="lateral-agora">
        <h2 id="lateral-agora">Agora</h2>
        <ul className="lateral-lista">
          <li>
            <Link to="/orientador/fila">
              <strong>{fila ?? 0} para revisar</strong>
              <span className="lateral-texto">Fila de revisão</span>
            </Link>
          </li>
          {temas != null && (
            <li>
              <Link to="/orientador">
                <strong>{temas} {temas === 1 ? 'tema' : 'temas'} a avaliar</strong>
                <span className="lateral-texto">Orientandos</span>
              </Link>
            </li>
          )}
        </ul>
      </section>
      {prazos.length > 0 && (
        <section className="lateral-bloco" aria-labelledby="lateral-prazos-orientador">
          <h2 id="lateral-prazos-orientador">Próximos prazos</h2>
          <ul className="lateral-lista">
            {prazos.map((linha) => (
              <li key={linha.id}>
                <strong>{linha.aluno?.nome}</strong>
                <span className="lateral-texto">
                  {linha.fase_atual} · {dataCurta(linha.prazo)}{' '}
                  {linha.prazo_vencido && <span className="prazo-restante vencido">vencido</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <AvisosRecentes avisos={avisos} para="/orientador/avisos" />
    </>
  )
}
