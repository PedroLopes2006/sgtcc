import { iniciais, tomDoAvatar } from '../formato'

/**
 * As iniciais da pessoa num círculo. A cor vem do nome (uma de seis, todas suaves),
 * então cada pessoa tem sempre a mesma cor em qualquer tela, sem guardar nada.
 */
export default function Avatar({ nome, grande = false, escondido = false }) {
  return (
    <span
      className={`avatar av-${tomDoAvatar(nome)}${grande ? ' grande' : ''}`}
      aria-hidden={escondido ? 'true' : undefined}
    >
      {iniciais(nome)}
    </span>
  )
}
