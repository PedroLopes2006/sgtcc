import Carregando from '../../components/Carregando'
import { useCallback, useEffect, useState } from 'react'
import { Outlet, useOutletContext } from 'react-router-dom'
import api, { mensagemDeErro } from '../../api'
import { useAvisosRecentes } from '../../avisos'
import { useAuth } from '../../auth'
import Layout from '../../components/Layout'
import { LateralAluno } from '../../components/Lateral'
import Toast from '../../components/Toast'
import { conferirConclusoes } from '../../conclusoes'

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

  // EXTRA (fora dos requisitos) — aviso discreto quando uma entrega foi concluída ou
  // enviada à banca desde a última vez que o aluno olhou.
  const { usuario } = useAuth()
  const [conclusao, setConclusao] = useState('')
  useEffect(() => {
    if (tcc?.entregas) setConclusao(conferirConclusoes(usuario.id, tcc.entregas) || '')
  }, [tcc]) // eslint-disable-line react-hooks/exhaustive-deps

  const { naoLidos: avisosNaoLidos, recentes } = useAvisosRecentes()

  const itens = [
    { rotulo: 'Meu TCC', icone: '▦', para: '/aluno', exato: true },
    {
      rotulo: 'Entregas',
      icone: '▤',
      para: '/aluno/entregas',
      contador: tcc?.entregas?.length || undefined,
    },
    // US18 — o trabalho final, depois das entregas
    { rotulo: 'Trabalho final', icone: '◫', para: '/aluno/trabalho-final' },
    { rotulo: 'Linha do tempo', icone: '◷', para: '/aluno/linha-do-tempo' },
    // EXTRA (fora dos requisitos) — avisos dentro do sistema
    { rotulo: 'Avisos', icone: '◔', para: '/aluno/avisos', contador: avisosNaoLidos || undefined },
    { rotulo: 'Perfil', icone: '◎', para: '/aluno/perfil' },
  ]

  return (
    <Layout itens={itens} lateral={<LateralAluno tcc={tcc} avisos={recentes} />}>
      <Toast mensagem={conclusao} aoFechar={() => setConclusao('')} />
      {carregando ? (
        <Carregando />
      ) : erro ? (
        <p className="erro" role="alert">{erro}</p>
      ) : (
        <Outlet context={{ tcc, recarregar }} />
      )}
    </Layout>
  )
}

export function useTcc() {
  return useOutletContext()
}
