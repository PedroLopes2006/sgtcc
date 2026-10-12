import { classeDoEstado } from '../formato'

/** Pontinho + rótulo, o indicador de estado usado em todo o protótipo. */
export default function Estado({ codigo, rotulo, atrasado = false }) {
  return (
    <span className="estado">
      <span className={`ponto ${classeDoEstado(codigo, atrasado)}`} aria-hidden="true" />
      {rotulo}
    </span>
  )
}
