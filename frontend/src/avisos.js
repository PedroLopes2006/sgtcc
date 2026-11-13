import { useEffect, useState } from 'react'
import api from './api'

/**
 * EXTRA — fora dos requisitos do documento: contador da aba de Avisos.
 *
 * Os avisos vêm dos `Evento` do log (RN10, RF18) por `GET /api/avisos/`. A barra
 * lateral mostra quantos ainda não foram vistos. Ele busca ao abrir, de minuto em
 * minuto e quando a página de Avisos marca tudo como visto (`avisarQueMudou`).
 * Se a busca falhar, o contador só fica como estava: avisar é secundário e nunca
 * deve atrapalhar a tela (RNF11).
 */
const EVENTO = 'sgtcc:avisos'
const INTERVALO = 60_000

export function avisarQueMudou() {
  window.dispatchEvent(new Event(EVENTO))
}

export function useContadorDeAvisos() {
  const [naoLidos, setNaoLidos] = useState(0)

  useEffect(() => {
    let ativo = true

    async function buscar() {
      try {
        const { data } = await api.get('/avisos/')
        if (ativo && typeof data?.nao_lidos === 'number') setNaoLidos(data.nao_lidos)
      } catch {
        // mantém o último número
      }
    }

    buscar()
    const relogio = setInterval(buscar, INTERVALO)
    window.addEventListener(EVENTO, buscar)
    return () => {
      ativo = false
      clearInterval(relogio)
      window.removeEventListener(EVENTO, buscar)
    }
  }, [])

  return naoLidos
}
