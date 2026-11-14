import { prazoRestante } from '../formato'

/**
 * EXTRA — fora dos requisitos do documento: contagem regressiva do prazo
 * ("faltam 3 dias"), com tom mais forte conforme o prazo aperta. Não mostra nada
 * para entrega já encerrada. O tom vem das cores que o sistema já tem (veja
 * `.prazo-restante` em styles.css) e nunca é a única pista: o texto diz tudo.
 *
 * `antes` é o separador que vem antes do texto (por exemplo " · ") e só aparece
 * quando há o que mostrar. `atrasada` é o que a API informa: se a conta local não
 * achar o prazo vencido, vale a palavra da API.
 */
export default function PrazoRestante({ prazo, estado, antes = '', atrasada = false }) {
  const restante = prazoRestante(prazo, estado)
  if (!restante) {
    return atrasada ? (
      <span className="prazo-restante vencido">{antes}vencido</span>
    ) : null
  }
  return (
    <span className={`prazo-restante ${restante.nivel}`}>
      {antes}
      {restante.texto}
    </span>
  )
}
