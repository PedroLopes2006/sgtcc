/**
 * Cada estado tem o seu pontinho colorido, e a mesma cor em qualquer tela.
 *
 * O atraso não troca a cor do estado: uma entrega "pronto para revisão" vencida
 * continua azul, e o aviso "vencido" fica no texto.
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import Estado from '../components/Estado'
import { ESTADOS_COM_COR, classeDoEstado } from '../formato'

// O Vitest roda na raiz do frontend; o jsdom não dá uma URL de arquivo para este módulo.
const CSS = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8')

function regraDoPonto(estado) {
  const achada = CSS.match(new RegExp(`\\.ponto\\.${estado}\\s*\\{([^}]*)\\}`))
  return achada ? achada[1].replace(/\s+/g, ' ').trim() : null
}

afterEach(cleanup)

describe('Cor de cada estado', () => {
  it('dá uma classe diferente a cada estado existente', () => {
    const classes = ESTADOS_COM_COR.map((estado) => classeDoEstado(estado))
    expect(classes).toEqual(ESTADOS_COM_COR)
    expect(new Set(classes).size).toBe(ESTADOS_COM_COR.length)
  })

  it('tem no CSS uma regra para cada estado, e nenhuma repete a outra', () => {
    const regras = ESTADOS_COM_COR.map(regraDoPonto)
    regras.forEach((regra, i) => expect(regra, ESTADOS_COM_COR[i]).not.toBeNull())
    expect(new Set(regras).size).toBe(ESTADOS_COM_COR.length)
  })

  it('cobre todos os estados da entrega e do tema', () => {
    for (const estado of [
      'rascunho', 'pronto_para_revisao', 'em_revisao', 'correcao_solicitada',
      'concluida', 'enviada_a_banca', 'proposto', 'ajuste_solicitado', 'aprovado',
    ]) {
      expect(ESTADOS_COM_COR).toContain(estado)
    }
  })

  it('cai em rascunho para um código desconhecido', () => {
    expect(classeDoEstado('sem_tema')).toBe('rascunho')
  })

  it('o pontinho de "Pronto para revisão" tem a cor do estado, vencido ou não', () => {
    const { container } = render(
      <Estado codigo="pronto_para_revisao" rotulo="Pronto para revisão" atrasado />,
    )
    const ponto = container.querySelector('.ponto')
    expect(ponto).toHaveClass('pronto_para_revisao')
    expect(ponto).not.toHaveClass('atrasado')
  })
})
