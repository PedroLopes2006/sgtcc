import Carregando from '../../components/Carregando'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api, { mensagemDeErro } from '../../api'
import LinkVersao from '../../components/LinkVersao'
import BarraDeFiltro from '../../components/BarraDeFiltro'
import SemResultados from '../../components/SemResultados'
import { casaComBusca } from '../../filtros'
import { dataCurta } from '../../formato'
import { useTcc } from './AreaAluno'

/** US07 — consulta e acesso às versões já enviadas para uma entrega. */
export default function HistoricoVersoes() {
  const { entregaId } = useParams()
  const { tcc } = useTcc() || {}
  const [versoes, setVersoes] = useState(null)
  const [erro, setErro] = useState('')
  // US17 — busca por número da versão ou nome do arquivo; só esconde itens na tela (CA3).
  const [busca, setBusca] = useState('')

  const entrega = useMemo(
    () => tcc?.entregas?.find((item) => String(item.id) === entregaId),
    [entregaId, tcc],
  )

  useEffect(() => {
    let ativo = true

    api.get(`/entregas/${entregaId}/versoes/`).then(({ data }) => {
      if (ativo) setVersoes(data)
    }).catch((e) => {
      if (ativo) setErro(mensagemDeErro(e, 'Não foi possível carregar o histórico de versões.'))
    })

    return () => { ativo = false }
  }, [entregaId])

  const versoesVisiveis = [...(versoes || [])]
    .reverse()
    .filter((v) => casaComBusca(busca, `versão ${v.numero}`, v.nome_original))

  return (
    <div className="conteudo-estreito">
      <Link className="voltar" to="/aluno/entregas">← Entregas</Link>
      <div className="cabecalho-pagina">
        <div>
          <h1>Histórico de versões</h1>
          <p className="legenda">{entrega?.titulo || 'Entrega selecionada'}</p>
        </div>
      </div>

      {erro ? <p className="erro" role="alert">{erro}</p> : versoes === null ? (
        <Carregando />
      ) : versoes.length === 0 ? (
        <div className="vazio vazio-compacto">
          <strong>Nenhuma versão enviada</strong>
          <span>Quando você enviar um arquivo, ele aparecerá aqui.</span>
        </div>
      ) : (
        <>
        <BarraDeFiltro
          busca={busca}
          aoBuscar={setBusca}
          rotuloBusca="Buscar versão"
          placeholder="Buscar por versão ou arquivo"
        />
        {versoesVisiveis.length === 0 && <SemResultados aoLimpar={() => setBusca('')} />}
        <ol className="lista lista-versoes">
          {/* A API devolve em ordem cronológica; a tela mostra a mais nova primeiro, como no protótipo. */}
          {versoesVisiveis.map((versao, posicao) => (
            <li key={versao.id}>
              <div>
                <div className="titulo">
                  Versão {versao.numero}
                  {posicao === 0 && <span className="meta"> · atual</span>}
                </div>
                <div className="meta">{versao.nome_original} · Enviada em {dataCurta(versao.data_envio)}</div>
              </div>
              <LinkVersao versao={versao} titulo={entrega?.titulo} />
            </li>
          ))}
        </ol>
        </>
      )}
    </div>
  )
}
