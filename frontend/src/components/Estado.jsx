import { classeDoEstado } from '../formato'

/** Pontinho + rótulo, o indicador de estado usado em todo o protótipo. Cada estado tem a sua cor. */
export default function Estado({ codigo, rotulo }) {
  return (
    <span className="estado">
      <span className={`ponto ${classeDoEstado(codigo)}`} aria-hidden="true" />
      {rotulo}
    </span>
  )
}
