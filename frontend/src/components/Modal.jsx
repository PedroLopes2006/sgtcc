import { useEffect, useRef } from 'react'
import Icone from './Icone'

const FOCAVEIS =
  'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

/**
 * Janela por cima da página.
 *
 * Cuida do foco do teclado, que é o que torna uma janela usável sem mouse: ao abrir, o
 * foco vai para o primeiro campo (ou para o botão de confirmar, quando a janela traz
 * `autoFocus`); o Tab dá a volta só dentro dela; e, ao fechar, o foco volta para o botão
 * que a abriu. Esc e um clique no fundo fecham.
 */
export default function Modal({ titulo, aoFechar, children }) {
  const caixa = useRef(null)
  const fechar = useRef(aoFechar)

  useEffect(() => {
    fechar.current = aoFechar
  })

  useEffect(() => {
    const origem = document.activeElement
    const dentro = caixa.current
    const focaveis = () => [...dentro.querySelectorAll(FOCAVEIS)]

    // Quem já pediu foco (autoFocus) fica como está; senão, o primeiro campo ou botão útil.
    if (!dentro.contains(document.activeElement)) {
      const primeiro =
        focaveis().find((el) => /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) ||
        focaveis().find((el) => !el.classList.contains('fechar')) ||
        dentro
      primeiro.focus()
    }

    function aoTeclar(evento) {
      if (evento.key === 'Escape') {
        fechar.current()
        return
      }
      if (evento.key !== 'Tab') return
      const itens = focaveis()
      if (itens.length === 0) {
        evento.preventDefault()
        return
      }
      const primeiro = itens[0]
      const ultimo = itens[itens.length - 1]
      if (evento.shiftKey && document.activeElement === primeiro) {
        evento.preventDefault()
        ultimo.focus()
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault()
        primeiro.focus()
      }
    }

    document.addEventListener('keydown', aoTeclar)
    return () => {
      document.removeEventListener('keydown', aoTeclar)
      if (origem && typeof origem.focus === 'function' && document.contains(origem)) origem.focus()
    }
  }, [])

  return (
    <div className="fundo-modal" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo} ref={caixa} tabIndex={-1}>
        <div className="modal-topo">
          <h2>{titulo}</h2>
          <button className="fechar" onClick={aoFechar} aria-label="Fechar">
            <Icone nome="fechar" tamanho={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
