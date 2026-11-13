import { useCallback, useEffect, useState } from 'react'
import api, { mensagemDeErro } from '../../api'
import Estado from '../../components/Estado'
import LayoutOrientador from '../../components/LayoutOrientador'
import LinkVersao from '../../components/LinkVersao'
import { dataCurta, enviadaHa, iniciais } from '../../formato'

/**
 * US09 — Fila de revisão (RF09, RN05, RN06, RNF02, RNF04).
 *
 * CA1: as entregas "pronto para revisão" dos orientandos ativos, por ordem de
 * chegada. Quem decide o que entra e em que ordem é a API (`/fila-revisao/`):
 * só a primeira entrega pendente de cada aluno, então o "Iniciar revisão"
 * daqui nunca bate na regra de ordem da US10.
 * CA2: sem pendência, a mensagem de fila vazia do protótipo.
 *
 * "Iniciar revisão" chama o mesmo endpoint da US10 e recarrega a lista: a
 * entrega passa a "em revisão" e sai da fila. Comentar e solicitar correção
 * continuam na tela de Orientandos até a tela de Revisão entrar.
 */
export default function FilaRevisao() {
  const [itens, setItens] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [iniciando, setIniciando] = useState(null) // id da entrega em andamento

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
    setAviso('')
    setErro('')
    setIniciando(item.id)
    try {
      await api.post(`/entregas/${item.id}/iniciar-revisao/`)
      setAviso(
        `Revisão de "${item.titulo}" iniciada. O aluno foi avisado. ` +
          'Para comentar ou solicitar correção, use a tela de Orientandos.',
      )
      await carregar()
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível iniciar a revisão.'))
    } finally {
      setIniciando(null)
    }
  }

  return (
    // A página sempre informa o contador da fila (0 enquanto carrega, e o menu
    // esconde o zero), para o menu não buscar a mesma lista outra vez.
    <LayoutOrientador fila={itens.length}>
      <div className="cabecalho-pagina">
        <h1>Fila de revisão</h1>
      </div>

      {aviso && <p className="aviso">{aviso}</p>}
      {erro && <p className="erro">{erro}</p>}

      {carregando ? (
        <p className="carregando">Carregando…</p>
      ) : itens.length === 0 ? (
        // US09 CA2 — textos do protótipo.
        <div className="vazio">
          <strong>Nenhuma entrega aguardando revisão</strong>
          <span>Quando um aluno sinalizar uma entrega como pronta, ela aparece aqui.</span>
        </div>
      ) : (
        <ul className="lista fila-revisao">
          {itens.map((item) => {
            const enviada = enviadaHa(item.pronta_em)
            return (
              <li key={item.id}>
                <div className="celula-aluno">
                  <span className="avatar">{iniciais(item.aluno?.nome)}</span>
                  <div>
                    <div className="titulo">
                      {item.aluno?.nome} · {item.titulo}
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
    </LayoutOrientador>
  )
}
