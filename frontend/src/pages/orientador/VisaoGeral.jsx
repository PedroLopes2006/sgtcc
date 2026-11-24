import Carregando from '../../components/Carregando'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { mensagemDeErro } from '../../api'
import LayoutOrientador from '../../components/LayoutOrientador'
import { classeDoEstado, dataCurta } from '../../formato'

/**
 * EXTRA — fora dos requisitos do documento: aba "Visão geral" do orientador.
 *
 * Junta num lugar só o que pede a atenção dele hoje: entregas para revisar e em
 * revisão, temas a avaliar, prazos vencidos, entregas prontas para a banca e como
 * os orientandos se distribuem por estado. Não traz regra nova nem pede outra
 * rota: tudo sai de `GET /api/orientandos/` (US14, RN05), e cada item leva à tela
 * onde a ação acontece, com as mesmas regras de sempre (RN06).
 */
export default function VisaoGeral() {
  const [linhas, setLinhas] = useState(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let ativo = true
    api
      .get('/orientandos/')
      .then(({ data }) => {
        if (ativo) setLinhas(Array.isArray(data) ? data : [])
      })
      .catch((e) => {
        if (ativo) setErro(mensagemDeErro(e, 'Não foi possível carregar a visão geral.'))
      })
    return () => {
      ativo = false
    }
  }, [])

  const dados = linhas || []
  const paraRevisar = dados.filter((l) => l.entrega_para_revisao?.estado === 'pronto_para_revisao')
  const emRevisao = dados.filter((l) => l.entrega_para_revisao?.estado === 'em_revisao')
  const temas = dados.filter((l) => l.aguarda_avaliacao_de_tema)
  const vencidos = dados.filter((l) => l.prazo_vencido)
  // US19, US20 — trabalhos finais esperando decisão do orientador (avaliar ou enviar à banca).
  const trabalhosFinais = dados.filter(
    (l) => l.trabalho_final && (l.trabalho_final.acoes.aprovar || l.trabalho_final.acoes.enviar_a_banca),
  )

  // Quantos orientandos há em cada estado, na ordem em que aparecem.
  const porEstado = []
  dados.forEach((l) => {
    const existente = porEstado.find((p) => p.codigo === l.estado.codigo)
    if (existente) existente.quantos += 1
    else porEstado.push({ codigo: l.estado.codigo, rotulo: l.estado.rotulo, quantos: 1 })
  })

  const irParaEntrega = (entrega) => `/orientador/entregas/${entrega.id}`

  return (
    // Os contadores do menu saem dos mesmos dados da página (0 enquanto carrega; o menu esconde o zero).
    <LayoutOrientador orientandos={dados.length} fila={paraRevisar.length} temas={temas.length} linhas={dados}>
      <div className="cabecalho-pagina">
        <div>
          <h1>Visão geral</h1>
          <p className="legenda sem-margem">O que pede a sua atenção hoje.</p>
        </div>
      </div>

      {erro && <p className="erro" role="alert">{erro}</p>}

      {linhas === null && !erro && <Carregando />}

      {linhas && linhas.length === 0 && (
        <div className="vazio">
          <strong>Você ainda não tem orientandos</strong>
          <span>Quando um aluno indicar você ao propor o tema, ele aparece aqui.</span>
        </div>
      )}

      {linhas && linhas.length > 0 && (
        <>
          <div className="visao-grade">
            <Painel titulo="Para revisar" total={paraRevisar.length} vazio="Nenhuma entrega esperando.">
              {paraRevisar.map((l) => (
                <ItemDoPainel
                  key={l.id}
                  para={irParaEntrega(l.entrega_para_revisao)}
                  titulo={l.entrega_para_revisao.titulo}
                  detalhe={l.aluno?.nome}
                />
              ))}
            </Painel>

            <Painel titulo="Em revisão" total={emRevisao.length} vazio="Nenhuma revisão em andamento.">
              {emRevisao.map((l) => (
                <ItemDoPainel
                  key={l.id}
                  para={irParaEntrega(l.entrega_para_revisao)}
                  titulo={l.entrega_para_revisao.titulo}
                  detalhe={l.aluno?.nome}
                />
              ))}
            </Painel>

            <Painel titulo="Temas a avaliar" total={temas.length} vazio="Nenhum tema aguardando.">
              {temas.map((l) => (
                <ItemDoPainel
                  key={l.id}
                  para="/orientador"
                  titulo={l.tema?.titulo || 'Tema proposto'}
                  detalhe={l.aluno?.nome}
                />
              ))}
            </Painel>

            <Painel titulo="Prazos vencidos" total={vencidos.length} vazio="Nenhum prazo vencido." alerta>
              {vencidos.map((l) => (
                <ItemDoPainel
                  key={l.id}
                  para="/orientador"
                  titulo={l.fase_atual}
                  detalhe={`${l.aluno?.nome} · prazo ${dataCurta(l.prazo)}`}
                />
              ))}
            </Painel>

            <Painel
              titulo="Trabalhos finais"
              total={trabalhosFinais.length}
              vazio="Nenhum trabalho final esperando."
            >
              {trabalhosFinais.map((l) => (
                <ItemDoPainel
                  key={l.id}
                  para={`/orientador/orientandos/${l.id}/trabalho-final`}
                  titulo={l.aluno?.nome}
                  detalhe={l.trabalho_final.estado_rotulo}
                />
              ))}
            </Painel>

            <section className="painel-visao" aria-labelledby="visao-estados">
              <h2 id="visao-estados">Orientandos por estado</h2>
              <ul className="barras-estado">
                {porEstado.map((p) => (
                  <li key={p.codigo}>
                    <span className="barras-rotulo">
                      <span className={`ponto ${classeDoEstado(p.codigo)}`} aria-hidden="true" />
                      {p.rotulo}
                    </span>
                    <span className="barras-trilho" aria-hidden="true">
                      <span style={{ width: `${Math.round((p.quantos / dados.length) * 100)}%` }} />
                    </span>
                    <span className="barras-numero">{p.quantos}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}
    </LayoutOrientador>
  )
}

function Painel({ titulo, total, vazio, alerta = false, children }) {
  return (
    // Sem itens, o grupo encolhe para uma linha: não ocupa espaço com um vazio.
    <section
      className={['painel-visao', alerta && total > 0 ? 'alerta' : '', total === 0 ? 'sem-itens' : '']
        .filter(Boolean)
        .join(' ')}
    >
      <h2>
        {titulo} <span className="grupo-contagem">{total}</span>
      </h2>
      {total === 0 ? <p className="ajuda">{vazio}</p> : <ul className="itens-visao">{children}</ul>}
    </section>
  )
}

function ItemDoPainel({ para, titulo, detalhe }) {
  return (
    <li>
      <Link to={para}>
        <strong>{titulo}</strong>
        <span>{detalhe}</span>
      </Link>
    </li>
  )
}
