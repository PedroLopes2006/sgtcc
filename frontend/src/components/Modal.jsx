import { useEffect } from 'react'

export default function Modal({ titulo, aoFechar, children }) {
  useEffect(() => {
    function aoTeclar(evento) {
      if (evento.key === 'Escape') aoFechar()
    }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [aoFechar])

  return (
    <div className="fundo-modal" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="modal-topo">
          <h2>{titulo}</h2>
          <button className="fechar" onClick={aoFechar} aria-label="Fechar">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
