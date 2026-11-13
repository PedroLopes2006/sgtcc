import { useCallback, useEffect, useState } from 'react'

/**
 * Modo claro e escuro.
 *
 * O tema vive num atributo do <html> (`data-tema="claro"` ou `"escuro"`), e o
 * CSS troca todas as cores por variáveis (veja `styles.css`).
 *
 * A pessoa tem três preferências: "claro", "escuro" e "sistema" (automático).
 * Em "sistema", que é o padrão da primeira visita, vale o tema do computador e
 * a tela acompanha quando ele muda. Escolhendo claro ou escuro, a escolha fica
 * guardada no navegador; "sistema" é a ausência dessa escolha. O index.html
 * aplica o tema antes do primeiro desenho, para a tela não piscar em claro
 * quando o tema é escuro.
 */
export const CHAVE_TEMA = 'sgtcc.tema'

export function lerTemaSalvo() {
  try {
    const salvo = localStorage.getItem(CHAVE_TEMA)
    return salvo === 'claro' || salvo === 'escuro' ? salvo : null
  } catch {
    return null // navegador com o armazenamento bloqueado
  }
}

export function temaDoSistema() {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro'
  } catch {
    return 'claro'
  }
}

export function aplicarTema(tema) {
  document.documentElement.dataset.tema = tema
}

function salvarTema(tema) {
  try {
    localStorage.setItem(CHAVE_TEMA, tema)
  } catch {
    // sem armazenamento, o tema vale só até recarregar a página
  }
}

function esquecerTema() {
  try {
    localStorage.removeItem(CHAVE_TEMA)
  } catch {
    // idem
  }
}

/**
 * O tema em uso (`tema`), a preferência da pessoa (`preferencia`: claro, escuro
 * ou sistema), `alternar` (liga e desliga o modo escuro) e `definir` (escolhe
 * uma das três preferências).
 */
export function useTema() {
  const [preferencia, setPreferencia] = useState(() => lerTemaSalvo() || 'sistema')
  const [sistema, setSistema] = useState(temaDoSistema)
  const tema = preferencia === 'sistema' ? sistema : preferencia

  useEffect(() => {
    aplicarTema(tema)
  }, [tema])

  // Em "sistema", acompanha o computador quando ele troca de tema.
  useEffect(() => {
    if (preferencia !== 'sistema') return undefined
    let consulta
    try {
      consulta = window.matchMedia('(prefers-color-scheme: dark)')
    } catch {
      return undefined
    }
    if (!consulta?.addEventListener) return undefined
    const mudou = () => setSistema(temaDoSistema())
    consulta.addEventListener('change', mudou)
    return () => consulta.removeEventListener('change', mudou)
  }, [preferencia])

  const definir = useCallback((valor) => {
    if (valor === 'sistema') esquecerTema()
    else salvarTema(valor)
    setPreferencia(valor)
  }, [])

  const alternar = useCallback(
    () => definir(tema === 'escuro' ? 'claro' : 'escuro'),
    [definir, tema],
  )

  return { tema, preferencia, alternar, definir }
}
