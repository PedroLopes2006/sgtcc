/**
 * US17 (CA1) — barra de filtro e busca das listas: botões de filtro (com a quantidade de
 * cada um) e um campo de busca. Só esconde itens na tela (CA3); quem usa decide o que
 * cada filtro faz.
 *
 * `opcoes` é `[{ codigo, rotulo, quantos }]`; sem opções, mostra só a busca.
 */
export default function BarraDeFiltro({
  rotulo,
  opcoes = [],
  filtro,
  aoFiltrar,
  busca,
  aoBuscar,
  rotuloBusca,
  placeholder,
}) {
  return (
    <div className="filtros-barra">
      {opcoes.length > 0 && (
        <div className="filtros" role="group" aria-label={rotulo}>
          {opcoes.map(({ codigo, rotulo: nome, quantos }) => (
            <button
              key={codigo}
              type="button"
              className="filtro"
              aria-pressed={filtro === codigo}
              onClick={() => aoFiltrar(codigo)}
            >
              {nome}
              {quantos != null && <span className="filtro-numero">{quantos}</span>}
            </button>
          ))}
        </div>
      )}
      <div className="busca">
        <input
          type="search"
          aria-label={rotuloBusca}
          placeholder={placeholder}
          value={busca}
          onChange={(e) => aoBuscar(e.target.value)}
        />
      </div>
    </div>
  )
}
