import { Link } from 'react-router-dom'
import Estado from '../../components/Estado'
import PerfilBase from '../../components/PerfilBase'
import { ROTULO_STATUS_TEMA, dataCurta } from '../../formato'
import { useTcc } from './AreaAluno'

const ENCERRADAS = ['concluida', 'enviada_a_banca']

/**
 * Perfil do aluno: o resumo do TCC (orientador, tema, progresso e fase atual) e,
 * em volta, a parte comum do perfil (veja PerfilBase). Os dados do TCC já vêm
 * da área do aluno, então a tela não faz outra requisição para eles.
 */
export default function PerfilAluno() {
  const { tcc } = useTcc()
  const entregas = tcc?.entregas || []
  const concluidas = entregas.filter((e) => ENCERRADAS.includes(e.estado)).length
  const faseAtual = entregas.find((e) => !ENCERRADAS.includes(e.estado))

  return (
    <PerfilBase textoTelegram="Receba avisos de correção e aprovação no Telegram.">
      {!tcc ? (
        <>
          <p className="ajuda">Você ainda não propôs o tema do seu TCC.</p>
          <div className="barra-acoes">
            <Link className="contorno" to="/aluno/propor">
              Propor tema
            </Link>
          </div>
        </>
      ) : (
        <>
          <dl className="definicoes">
            <div>
              <dt>Orientador</dt>
              <dd>{tcc.orientador?.nome || '—'}</dd>
            </div>
            <div>
              <dt>Tema</dt>
              <dd>
                {tcc.tema?.titulo}
                {tcc.tema && (
                  <div className="perfil-situacao">
                    <Estado
                      codigo={tcc.tema.status}
                      rotulo={ROTULO_STATUS_TEMA[tcc.tema.status] || tcc.tema.status}
                    />
                  </div>
                )}
              </dd>
            </div>
            <div>
              <dt>Progresso</dt>
              <dd>
                {entregas.length === 0
                  ? 'Nenhuma entrega criada'
                  : `${concluidas} de ${entregas.length} ${
                      entregas.length === 1 ? 'entrega concluída' : 'entregas concluídas'
                    }`}
                {entregas.length > 0 && (
                  <span className="barra-progresso" aria-hidden="true">
                    <span style={{ width: `${Math.round((concluidas / entregas.length) * 100)}%` }} />
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt>Fase atual</dt>
              <dd>
                {faseAtual
                  ? `${faseAtual.titulo} · prazo ${dataCurta(faseAtual.prazo)}`
                  : entregas.length > 0
                    ? 'Todas as entregas estão encerradas'
                    : '—'}
              </dd>
            </div>
          </dl>
          <div className="barra-acoes">
            <Link className="contorno" to="/aluno/entregas">
              Ver entregas
            </Link>
          </div>
        </>
      )}
    </PerfilBase>
  )
}
