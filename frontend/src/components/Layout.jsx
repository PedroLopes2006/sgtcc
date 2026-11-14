import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../auth'
import Avatar from './Avatar'
import Logo from './Logo'
import AlternarTema from './AlternarTema'
import Icone, { ICONE_POR_SIMBOLO } from './Icone'

/** O desenho do ícone, ou o próprio símbolo de texto quando não há desenho. */
function icone(simbolo) {
  return ICONE_POR_SIMBOLO[simbolo] ? <Icone nome={ICONE_POR_SIMBOLO[simbolo]} /> : simbolo
}

const TELA_LARGA = '(min-width: 1280px)'

/**
 * Diz se a tela é larga o bastante para a coluna lateral. A coluna só é montada
 * nesses casos, então no celular ela nem entra na página. Sem `matchMedia` (como
 * nos testes), conta como tela estreita.
 */
function useTelaLarga() {
  const medir = () =>
    typeof window.matchMedia === 'function' && Boolean(window.matchMedia(TELA_LARGA)?.matches)
  const [larga, setLarga] = useState(medir)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined
    const consulta = window.matchMedia(TELA_LARGA)
    if (!consulta) return undefined
    const atualizar = () => setLarga(consulta.matches)
    consulta.addEventListener?.('change', atualizar)
    atualizar()
    return () => consulta.removeEventListener?.('change', atualizar)
  }, [])

  return larga
}

/**
 * Casca do app: barra lateral fixa à esquerda, conteúdo no meio e, em telas
 * largas, uma coluna lateral à direita.
 *
 * Um item sem `para` aparece desativado em vez de virar link quebrado; hoje todos
 * os itens do menu têm destino.
 */
export default function Layout({ itens, lateral, children }) {
  const { usuario, sair } = useAuth()
  const telaLarga = useTelaLarga()
  const { pathname } = useLocation()

  // O título da aba acompanha a tela: quem tem várias abas abertas sabe qual é qual.
  // Vale o item de menu mais específico que combina com o endereço.
  const atual = itens
    .filter((item) => item.para && (pathname === item.para || pathname.startsWith(`${item.para}/`)))
    .sort((a, b) => b.para.length - a.para.length)[0]
  useEffect(() => {
    document.title = atual ? `${atual.rotulo} · SGTCC` : 'SGTCC — Sistema de Gestão de TCC'
  }, [atual])

  // Ao trocar de tela, o foco vai para o conteúdo: quem usa teclado ou leitor de tela
  // recomeça do início da tela nova, e não do menu. Na primeira tela nada muda.
  const principal = useRef(null)
  const primeiraTela = useRef(true)
  useEffect(() => {
    if (primeiraTela.current) {
      primeiraTela.current = false
      return
    }
    principal.current?.focus({ preventScroll: true })
  }, [pathname])

  return (
    <div className="app">
      <a className="pular" href="#conteudo">
        Pular para o conteúdo
      </a>
      <aside className="sidebar">
        <div className="sidebar-marca">
          <Logo />
        </div>

        <div className="sidebar-usuario">
          <Avatar nome={usuario.nome} />
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

      <main className="conteudo" id="conteudo" tabIndex={-1} ref={principal}>
        {children}
      </main>

      {/* EXTRA (fora dos requisitos): coluna lateral, só em telas largas. */}
      {lateral && telaLarga && (
        <aside className="lateral" aria-label="Resumo">
          {lateral}
        </aside>
      )}
    </div>
  )
}
