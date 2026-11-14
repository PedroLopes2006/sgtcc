import { useEffect, useState } from 'react'
import api from './api'

/**
 * EXTRA — fora dos requisitos do documento: contador da aba de Avisos e os avisos
 * mais recentes, que a coluna lateral mostra.
 *
 * Os avisos vêm dos `Evento` do log (RN10, RF18) por `GET /api/avisos/`. A barra
 * lateral mostra quantos ainda não foram vistos. A busca acontece ao abrir, de
 * minuto em minuto e quando a página de Avisos marca tudo como visto
 * (`avisarQueMudou`). Se falhar, ficam os últimos valores: avisar é secundário e
 * nunca deve atrapalhar a tela (RNF11).
 */
const EVENTO = 'sgtcc:avisos'
const INTERVALO = 60_000

/** Títulos curtos de cada tipo de aviso, usados na aba de Avisos e na coluna lateral. */
export const TITULOS_DE_AVISO = {
  tema_proposto: 'Tema proposto',
  tema_reenviado: 'Tema reenviado',
  tema_aprovado: 'Tema aprovado',
  tema_ajuste_solicitado: 'Ajuste de tema solicitado',
  entrega_pronta: 'Entrega pronta para revisão',
  entrega_em_revisao: 'Entrega em revisão',
  correcao_solicitada: 'Correção solicitada',
  comentario_adicionado: 'Novo comentário',
  entrega_concluida: 'Entrega concluída',
  entrega_enviada_a_banca: 'Entrega enviada à banca',
  troca_orientador: 'Troca de orientador',
}

export function avisarQueMudou() {
  window.dispatchEvent(new Event(EVENTO))
}

/** `{ naoLidos, recentes }`: o contador do menu e a lista curta para a coluna lateral. */
export function useAvisosRecentes() {
  const [estado, setEstado] = useState({ naoLidos: 0, recentes: [] })

  useEffect(() => {
    let ativo = true

    async function buscar() {
      try {
        const { data } = await api.get('/avisos/')
        if (!ativo || typeof data?.nao_lidos !== 'number') return
        setEstado({
          naoLidos: data.nao_lidos,
          recentes: Array.isArray(data.avisos) ? data.avisos.slice(0, 5) : [],
        })
      } catch {
        // mantém o que já estava
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

  return estado
}

export function useContadorDeAvisos() {
  return useAvisosRecentes().naoLidos
}
