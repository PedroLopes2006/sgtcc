import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth'
import { iniciais } from '../formato'
import AlternarTema from './AlternarTema'
import Icone, { ICONE_POR_SIMBOLO } from './Icone'

/** O desenho do ícone, ou o próprio símbolo de texto quando não há desenho. */
function icone(simbolo) {
  return ICONE_POR_SIMBOLO[simbolo] ? <Icone nome={ICONE_POR_SIMBOLO[simbolo]} /> : simbolo
}

/**
 * Casca do app: barra lateral fixa à esquerda, conteúdo à direita.
 *
 * Um item sem `para` aparece desativado em vez de virar link quebrado; hoje todos
 * os itens do menu têm destino.
 */
export default function Layout({ itens, children }) {
  const { usuario, sair } = useAuth()

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-marca">
          <span className="marca-nome">SGTCC</span>
        </div>

        <div className="sidebar-usuario">
          <span className="avatar">{iniciais(usuario.nome)}</span>
          <span>{usuario.nome}</span>
        </div>

        <nav>
          {itens.map((item) =>
            item.para ? (
              <NavLink
                key={item.rotulo}
                to={item.para}
                end={item.exato}
                className={({ isActive }) => (isActive ? 'ativo' : undefined)}
              >
                <span className="icone" aria-hidden="true">
                  {icone(item.icone)}
                </span>
                {item.rotulo}
                {item.contador != null && <span className="contador">{item.contador}</span>}
              </NavLink>
            ) : (
              <a
                key={item.rotulo}
                aria-disabled="true"
                title="Chega em um próximo sprint"
                style={{ opacity: 0.45, cursor: 'default' }}
              >
                <span className="icone" aria-hidden="true">
                  {icone(item.icone)}
                </span>
                {item.rotulo}
              </a>
            ),
          )}
        </nav>

        <div className="sidebar-rodape">
          <AlternarTema />
          <button className="texto" onClick={sair}>
            Sair
          </button>
        </div>
      </aside>

      <main className="conteudo">{children}</main>
    </div>
  )
}
