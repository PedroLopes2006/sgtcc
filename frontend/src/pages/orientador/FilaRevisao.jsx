import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api, { mensagemDeErro } from '../../api'
import Estado from '../../components/Estado'
import Indicadores from '../../components/Indicadores'
import LayoutOrientador from '../../components/LayoutOrientador'
import LinkVersao from '../../components/LinkVersao'
import { dataCurta, enviadaHa, iniciais, semAcento } from '../../formato'

/**
 * US09 — Fila de revisão (RF09, RN05, RN06, RNF02, RNF04).
 *
 * CA1: as entregas "pronto para revisão" dos orientandos ativos, por ordem de
 * chegada. Quem decide o que entra e em que ordem é a API (`/fila-revisao/`):
 * só a primeira entrega pendente de cada aluno, então o "Iniciar revisão"
 * daqui nunca bate na regra de ordem da US10.
 * CA2: sem pendência, a mensagem de fila vazia do protótipo.
 *
 * "Iniciar revisão" chama o mesmo endpoint da US10: a entrega passa a "em
 * revisão", sai da fila, e o orientador segue para a tela de Revisão dela, onde
 * comenta, pede correção ou aprova. O nome da entrega também leva a essa tela.
 *
 * EXTRA (protótipo do Figma, fora dos requisitos do documento): a prioridade
 * alta, média ou baixa de cada item, que só o orientador vê. Ela não muda a
 * ordem de chegada.
 */
export default function FilaRevisao() {
  const navegar = useNavigate()
  const [itens, setItens] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [iniciando, setIniciando] = useState(null) // id da entrega em andamento
  const [busca, setBusca] = useState('')

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get('/fila-revisao/')
      setItens(data)
      setErro('')
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível carregar a fila de revisão.'))
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function iniciarRevisao(item) {
    setErro('')
    setIniciando(item.id)
    try {
      await api.post(`/entregas/${item.id}/iniciar-revisao/`)
      navegar(`/orientador/entregas/${item.id}`)
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível iniciar a revisão.'))
      setIniciando(null)
    }
  }

  /** EXTRA (protótipo, fora dos requisitos) — marca a prioridade só deste orientador. */
  async function definirPrioridade(item, prioridade) {
    setErro('')
    try {
      const { data } = await api.put(`/entregas/${item.id}/prioridade/`, { prioridade })
      setItens((atuais) =>
        atuais.map((outro) =>
          outro.id === item.id ? { ...outro, prioridade: data.prioridade } : outro,
        ),
      )
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível marcar a prioridade.'))
    }
  }

  // Busca no que a tela já carregou (aluno e entrega); a fila e a ordem seguem as da API.
  const termo = semAcento(busca.trim())
  const visiveis = termo
    ? itens.filter((item) => semAcento(`${item.aluno?.nome} ${item.titulo}`).includes(termo))
    : itens

  return (
    // A página sempre informa o contador da fila (0 enquanto carrega, e o menu
    // esconde o zero), para o menu não buscar a mesma lista outra vez.
    <LayoutOrientador fila={itens.length}>
      <div className="cabecalho-pagina">
        <h1>Fila de revisão</h1>
      </div>

      {erro && <p className="erro">{erro}</p>}

      {/* Números de relance. A fila já vem da mais antiga para a mais nova (RN06 e US09). */}
      {!carregando && itens.length > 0 && (
        <Indicadores
          itens={[
            { rotulo: 'Aguardando', valor: itens.length },
            {
              rotulo: 'Espera mais antiga',
              valor: enviadaHa(itens[0].pronta_em)?.replace('Enviada ', '') ?? '—',
            },
            {
              rotulo: 'Em atraso',
              valor: itens.filter((i) => i.atrasada).length,
              alerta: itens.some((i) => i.atrasada),
            },
          ]}
        />
      )}

      {carregando ? (
        <p className="carregando">Carregando…</p>
      ) : itens.length === 0 ? (
        // US09 CA2 — textos do protótipo.
        <div className="vazio">
          <strong>Nenhuma entrega aguardando revisão</strong>
          <span>Quando um aluno sinalizar uma entrega como pronta, ela aparece aqui.</span>
        </div>
      ) : (
        <>
        <div className="busca">
          <input
            type="search"
            aria-label="Buscar na fila"
            placeholder="Buscar por aluno ou entrega"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        {visiveis.length === 0 ? (
          <div className="vazio vazio-compacto">
            <strong>Nenhum resultado</strong>
            <span>Nada na fila combina com “{busca.trim()}”.</span>
          </div>
        ) : (
        <ul className="lista fila-revisao">
          {visiveis.map((item) => {
            const enviada = enviadaHa(item.pronta_em)
            return (
              <li key={item.id}>
                <div className="celula-aluno">
                  <span className="avatar">{iniciais(item.aluno?.nome)}</span>
                  <div>
                    <div className="titulo">
                      <Link to={`/orientador/entregas/${item.id}`}>
                        {item.aluno?.nome} · {item.titulo}
                      </Link>
                    </div>
                    <div className="meta">
                      <Estado codigo="pronto_para_revisao" rotulo="Pronta para revisão" />
                      {enviada && <span> · {enviada}</span>}
                      {item.versao_atual && <span> · versão {item.versao_atual.numero}</span>}
                      <span className={item.atrasada ? 'prazo-vencido' : undefined}>
                        {' · prazo '}
                        {dataCurta(item.prazo)}
                        {item.atrasada && ' · vencido'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="acoes-linha">
                  {/* EXTRA (protótipo, fora dos requisitos) — prioridade, só do orientador. */}
                  <select
                    className="seletor-prioridade"
                    aria-label={`Prioridade de ${item.titulo}`}
                    data-prioridade={item.prioridade || 'nenhuma'}
                    value={item.prioridade || 'sem_prioridade'}
                    onChange={(e) => definirPrioridade(item, e.target.value)}
                  >
                    <option value="sem_prioridade">Sem prioridade</option>
                    <option value="alta">Prioridade alta</option>
                    <option value="media">Prioridade média</option>
                    <option value="baixa">Prioridade baixa</option>
                  </select>
                  <LinkVersao versao={item.versao_atual} titulo={item.titulo} />
                  <button
                    className="contorno"
                    onClick={() => iniciarRevisao(item)}
                    disabled={iniciando === item.id}
                    aria-label={`Iniciar revisão de ${item.titulo}`}
                  >
                    {iniciando === item.id ? 'Iniciando…' : 'Iniciar revisão'}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
        )}
        </>
      )}
    </LayoutOrientador>
  )
}
