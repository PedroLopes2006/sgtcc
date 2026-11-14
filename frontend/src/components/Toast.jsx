import Icone from './Icone'
import { useEffect, useRef } from 'react'

/**
 * Aviso discreto que aparece no canto e some sozinho depois de alguns segundos.
 * Serve para a confirmação de uma ação ("Revisão iniciada. O aluno foi avisado."),
 * que não precisa ficar na tela. Erros continuam como faixa, porque a pessoa
 * precisa lê-los e agir.
 *
 * O tempo só recomeça quando chega uma mensagem nova: a tela pode redesenhar à
 * vontade (por exemplo, enquanto se digita) sem prolongar o aviso.
 */
export default function Toast({ mensagem, aoFechar, duracao = 6000 }) {
  const fechar = useRef(aoFechar)

  useEffect(() => {
    fechar.current = aoFechar
  })

  useEffect(() => {
    if (!mensagem) return undefined
    const relogio = setTimeout(() => fechar.current(), duracao)
    return () => clearTimeout(relogio)
  }, [mensagem, duracao])

  if (!mensagem) return null

  return (
    <div className="toast" role="status">
      <svg className="toast-icone" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12.5 2.6 2.6L16 9.5" />
      </svg>
      <span>{mensagem}</span>
      <button type="button" className="fechar" onClick={aoFechar} aria-label="Fechar aviso">
        <Icone nome="fechar" tamanho={16} />
      </button>
      {/* A barrinha mostra quanto falta para o aviso sumir. */}
      <span className="toast-tempo" style={{ animationDuration: `${duracao}ms` }} aria-hidden="true" />
    </div>
  )
}
