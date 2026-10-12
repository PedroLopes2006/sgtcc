import { useCallback, useEffect, useState } from 'react'
import { Outlet, useOutletContext } from 'react-router-dom'
import api, { mensagemDeErro } from '../../api'
import Layout from '../../components/Layout'

/**
 * Área do aluno: carrega o TCC uma vez e compartilha com as telas filhas,
 * para a barra lateral e as páginas não buscarem a mesma coisa em duplicata.
 */
export default function AreaAluno() {
  const [tcc, setTcc] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const recarregar = useCallback(async () => {
    try {
      const { data } = await api.get('/meu-tcc/')
      setTcc(data.tcc === null ? null : data)
      setErro('')
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível carregar seu TCC.'))
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  const itens = [
    { rotulo: 'Meu TCC', icone: '▦', para: '/aluno', exato: true },
    {
      rotulo: 'Entregas',
      icone: '▤',
      para: '/aluno/entregas',
      contador: tcc?.entregas?.length || undefined,
    },
    { rotulo: 'Linha do tempo', icone: '◷' },
    { rotulo: 'Perfil', icone: '◎' },
  ]

  return (
    <Layout itens={itens}>
      {carregando ? (
        <p className="carregando">Carregando…</p>
      ) : erro ? (
        <p className="erro">{erro}</p>
      ) : (
        <Outlet context={{ tcc, recarregar }} />
      )}
    </Layout>
  )
}

export function useTcc() {
  return useOutletContext()
}
