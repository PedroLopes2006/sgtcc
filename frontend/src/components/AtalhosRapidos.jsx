import { Link } from 'react-router-dom'

/**
 * EXTRA — fora dos requisitos do documento: atalhos para o que o aluno costuma fazer.
 *
 * Cada atalho só aparece quando a ação faz sentido agora, e quem decide isso é a API
 * (`aceita_versao`, estado da entrega e tema aprovado), com as mesmas regras de
 * sempre (RN02, RN03). Os atalhos só levam à tela onde a ação acontece.
 */
export default function AtalhosRapidos({ tcc }) {
  if (tcc?.tema?.status !== 'aprovado') return null

  const entregas = tcc.entregas || []
  const paraEnviar = entregas.find((e) => e.aceita_versao)
  const comCorrecao = entregas.find((e) => e.estado === 'correcao_solicitada')

  return (
    <section className="atalhos-cartao" aria-labelledby="atalhos-titulo">
      <h2 id="atalhos-titulo">Atalhos</h2>
      <div className="atalhos">
        {paraEnviar && (
          <Link className="atalho" to={`/aluno/entregas?enviar=${paraEnviar.id}`}>
            <strong>Enviar versão</strong>
            <span>{paraEnviar.titulo}</span>
          </Link>
        )}
        {comCorrecao && (
          <Link className="atalho destaque" to="/aluno/entregas">
            <strong>Ver correção pedida</strong>
            <span>{comCorrecao.titulo}</span>
          </Link>
        )}
        <Link className="atalho" to="/aluno/entregas/nova">
          <strong>Nova entrega</strong>
          <span>Criar a próxima etapa</span>
        </Link>
      </div>
    </section>
  )
}
