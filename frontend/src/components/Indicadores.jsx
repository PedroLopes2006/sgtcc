/**
 * Faixa de números no topo de uma tela: cada item é um rótulo curto e um valor.
 * Os números saem dos dados que a tela já carregou, sem nova requisição.
 * `alerta` pinta o valor de vermelho quando há algo a que prestar atenção.
 */
export default function Indicadores({ itens }) {
  return (
    <dl className="indicadores">
      {itens.map(({ rotulo, valor, alerta }) => (
        <div key={rotulo}>
          <dt>{rotulo}</dt>
          <dd className={alerta ? 'alerta' : undefined}>{valor}</dd>
        </div>
      ))}
    </dl>
  )
}
