import { Link } from 'react-router-dom'
import { prazoRestante } from '../formato'

/**
 * EXTRA — fora dos requisitos do documento: uma pílula no alto do Meu TCC com a coisa
 * mais importante agora, que leva direto à tela onde se resolve.
 *
 * Com correção pedida pelo orientador, avisa isso (e é a prioridade). Sem correção,
 * mostra o prazo mais próximo entre as entregas ainda em aberto. Sem nenhuma das
 * duas, não aparece. Só lê o que o "Meu TCC" já carregou.
 */
const ENCERRADAS = ['concluida', 'enviada_a_banca']

export default function PilulaDeAtencao({ entregas }) {
  const comCorrecao = entregas.find((e) => e.estado === 'correcao_solicitada')
  if (comCorrecao) {
    return (
      <Link className="pilula destaque" to="/aluno/entregas">
        <span className="pilula-tag">Correção</span>
        <span>Seu orientador pediu ajustes em {comCorrecao.titulo}</span>
      </Link>
    )
  }

  const proxima = entregas
    .filter((e) => !ENCERRADAS.includes(e.estado) && e.prazo)
    .sort((a, b) => String(a.prazo).localeCompare(String(b.prazo)))[0]
  const restante = proxima && prazoRestante(proxima.prazo, proxima.estado)
  if (!restante) return null

  return (
    <Link className={`pilula ${restante.nivel}`} to="/aluno/entregas">
      <span className="pilula-tag">Próximo prazo</span>
      <span>
        {proxima.titulo} · {restante.texto}
      </span>
    </Link>
  )
}
