import { useTema } from '../tema'

/**
 * Botão do modo escuro, na barra lateral e nas telas de acesso.
 *
 * O rótulo é sempre "Modo escuro"; quem informa o estado é o `aria-pressed`
 * (e o interruptor desenhado ao lado), como num botão liga e desliga.
 */
export default function AlternarTema({ className = '' }) {
  const { tema, alternar } = useTema()
  const escuro = tema === 'escuro'

  return (
    <button
      type="button"
      className={`texto alternar-tema ${className}`.trim()}
      onClick={alternar}
      aria-pressed={escuro}
    >
      <span className="trilho" aria-hidden="true" />
      Modo escuro
    </button>
  )
}
