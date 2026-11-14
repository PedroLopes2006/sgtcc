import { useEffect, useState } from 'react'
import api from '../api'
import { useAvisosRecentes } from '../avisos'
import Layout from './Layout'
import { LateralOrientador } from './Lateral'

/**
 * Casca das telas do orientador: a barra lateral com Fila de revisão (US09),
 * Orientandos (US04/US14) e Perfil, e o contador de cada item, como no protótipo.
 *
 * Cada página informa o contador que já tem nos próprios dados (`fila`,
 * `orientandos`). O que ela não informar, o menu busca uma vez na API. Assim a
 * página não faz duas vezes a mesma requisição só para preencher o menu.
 */
export default function LayoutOrientador({ fila, orientandos, temas, linhas, children }) {
  const [buscados, setBuscados] = useState({})
  const { naoLidos: avisosNaoLidos, recentes } = useAvisosRecentes()

  useEffect(() => {
    let ativo = true
    const faltando = [
      fila === undefined && ['fila', '/fila-revisao/'],
      orientandos === undefined && ['orientandos', '/orientandos/'],
    ].filter(Boolean)

    faltando.forEach(([chave, rota]) => {
      api
        .get(rota)
        .then(({ data }) => {
          if (ativo && Array.isArray(data)) {
            setBuscados((atual) => ({ ...atual, [chave]: data.length }))
          }
        })
        .catch(() => {}) // o contador é só um detalhe do menu; a página mostra os erros
    })
    return () => {
      ativo = false
    }
    // Busca só ao montar e quando a página deixa de informar um contador.
  }, [fila === undefined, orientandos === undefined]) // eslint-disable-line react-hooks/exhaustive-deps

  const contadorFila = fila ?? buscados.fila
  const contadorOrientandos = orientandos ?? buscados.orientandos

  const itens = [
    // EXTRA (fora dos requisitos) — visão geral do que pede atenção
    { rotulo: 'Visão geral', icone: '◈', para: '/orientador/visao-geral' },
    {
      rotulo: 'Fila de revisão',
      icone: '▤',
      para: '/orientador/fila',
      contador: contadorFila || undefined,
    },
    {
      rotulo: 'Orientandos',
      icone: '◍',
      para: '/orientador',
      exato: true,
      contador: contadorOrientandos || undefined,
    },
    // EXTRA (fora dos requisitos) — avisos dentro do sistema
    { rotulo: 'Avisos', icone: '◔', para: '/orientador/avisos', contador: avisosNaoLidos || undefined },
    { rotulo: 'Perfil', icone: '◎', para: '/orientador/perfil' },
  ]

  return (
    <Layout
      itens={itens}
      lateral={
        <LateralOrientador avisos={recentes} fila={contadorFila} temas={temas} linhas={linhas} />
      }
    >
      {children}
    </Layout>
  )
}
