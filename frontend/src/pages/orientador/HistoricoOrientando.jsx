import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api, { mensagemDeErro } from '../../api'
import Layout from '../../components/Layout'
import Estado from '../../components/Estado'
import LinkVersao from '../../components/LinkVersao'
import { dataCurta, ROTULO_ESTADO_ENTREGA } from '../../formato'

/** US15 CA2–CA3 / RF14 / RN05, RN08, RN10 / RNF04: histórico preservado do TCC. */
export default function HistoricoOrientando() {
  const { tccId } = useParams()
  const [tcc, setTcc] = useState(null)
  const [erro, setErro] = useState('')
  useEffect(() => {
    let ativo = true
    setTcc(null)
    setErro('')
    api.get(`/orientandos/${tccId}/historico/`).then(({ data }) => {
      if (ativo) setTcc(data)
    }).catch(e => { if (ativo) setErro(mensagemDeErro(e, 'Não foi possível carregar o histórico.')) })
    return () => { ativo = false }
  }, [tccId])
  return <Layout itens={[{ rotulo: 'Orientandos', para: '/orientador', icone: '◍' }]}>
    <Link to="/orientador">Orientandos</Link>
    <h1>Histórico</h1>
    {erro ? <p className="erro">{erro}</p> : !tcc ? <p>Carregando…</p> : <>
      <h2>{tcc.aluno.nome}</h2>
      <h3>{tcc.tema?.titulo}</h3><p>{tcc.tema?.descricao}</p>
      <h2>Orientações</h2>
      {tcc.orientacoes.map(o => <p key={o.id}>{o.orientador.nome} · {dataCurta(o.data_inicio)} · {o.ativa ? 'Ativa' : dataCurta(o.data_fim)}</p>)}
      <h2>Entregas</h2>
      {tcc.entregas.map(e => <section key={e.id}>
        <h3>{e.titulo}</h3><Estado codigo={e.estado} rotulo={ROTULO_ESTADO_ENTREGA[e.estado]} />
        <p>Prazo: {dataCurta(e.prazo)}</p>
        <h4>Versões</h4>
        {e.versoes.map(v => <p key={v.id}><LinkVersao versao={v} /> {v.nome_original} · {dataCurta(v.data_envio)}</p>)}
        <h4>Comentários</h4>
        {e.comentarios.map(c => <div key={c.id}><strong>{c.autor.nome}</strong> · {dataCurta(c.data_criacao)} · {c.versao && `Versão ${c.versao}`}<p>{c.texto}</p></div>)}
      </section>)}
      <h2>Eventos</h2>
      {tcc.eventos.map(e => <p key={e.id}>{dataCurta(e.data_hora)} · {e.descricao}</p>)}
    </>}
  </Layout>
}
