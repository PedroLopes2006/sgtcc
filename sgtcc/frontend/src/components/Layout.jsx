import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth'
import { iniciais } from '../formato'

/**
 * Casca do app: barra lateral fixa à esquerda, conteúdo à direita.
 *
 * Os itens que ainda não existem (Linha do tempo, Perfil, Fila de revisão)
 * aparecem desativados em vez de virarem links quebrados — eles entram nos
 * próximos sprints, junto das US correspondentes.
 */
export default function Layout({ itens, children }) {
  const { usuario, sair } = useAuth()

  return (
    <div className="app">
      <aside className="sidebar">
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
                  {item.icone}
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
                  {item.icone}
                </span>
                {item.rotulo}
              </a>
            ),
          )}
        </nav>

        <div className="sidebar-rodape">
          <button className="texto" onClick={sair}>
            Sair
          </button>
        </div>
      </aside>

      <main className="conteudo">{children}</main>
    </div>
  )
}
