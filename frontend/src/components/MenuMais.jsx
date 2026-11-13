import { useEffect, useRef, useState } from 'react'

/**
 * Botão "Mais" que abre uma lista de ações secundárias.
 *
 * Fecha ao clicar fora, ao apertar Esc e ao escolher uma ação. As ações são
 * botões e links comuns, então continuam com os próprios nomes para leitores de
 * tela e para quem navega pelo teclado.
 */
export default function MenuMais({ rotulo, children }) {
  const [aberto, setAberto] = useState(false)
  const caixa = useRef(null)

  useEffect(() => {
    if (!aberto) return undefined
    const clicouFora = (evento) => {
      if (caixa.current && !caixa.current.contains(evento.target)) setAberto(false)
    }
    const apertouEsc = (evento) => {
      if (evento.key === 'Escape') setAberto(false)
    }
    document.addEventListener('mousedown', clicouFora)
    document.addEventListener('keydown', apertouEsc)
    return () => {
      document.removeEventListener('mousedown', clicouFora)
      document.removeEventListener('keydown', apertouEsc)
    }
  }, [aberto])

  return (
    <div className="menu-mais" ref={caixa}>
      <button
        type="button"
        className="contorno"
        aria-expanded={aberto}
        aria-label={rotulo}
        onClick={() => setAberto((atual) => !atual)}
      >
        Mais ▾
      </button>
      {aberto && (
        <div className="menu-mais-lista" onClick={() => setAberto(false)}>
          {children}
        </div>
      )}
    </div>
  )
}
