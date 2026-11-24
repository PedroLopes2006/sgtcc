import Carregando from '../components/Carregando'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { mensagemDeErro } from '../api'
import { TITULOS_DE_AVISO, avisarQueMudou } from '../avisos'
import { useAuth } from '../auth'
import BarraDeFiltro from '../components/BarraDeFiltro'
import SemResultados from '../components/SemResultados'
import { casaComBusca } from '../filtros'
import { dataHoraCurta, tempoRelativo } from '../formato'

/**
 * EXTRA — fora dos requisitos do documento: aba de Avisos.
 *
 * Alternativa dentro do sistema ao envio pelo Telegram (US02): mostra o que o
 * RF16 pede que seja avisado, lendo os `Evento` do log (RN10, RF18) que
 * interessam a quem está logado. O aluno vê o que o orientador fez; o orientador
 * vê o que depende dele (tema proposto, entrega pronta, orientando recebido).
 *
 * Ao abrir, tudo o que existe é marcado como visto. Nesta visita os itens novos
 * continuam destacados, para dar tempo de ver o que mudou; na próxima já vêm
 * como lidos.
 */

export default function Avisos() {
  const { usuario } = useAuth()
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  // US17 — filtro (todos ou só os novos) e busca; só escondem itens na tela (CA3).
  const [filtro, setFiltro] = useState('todos')
  const [busca, setBusca] = useState('')

  useEffect(() => {
    let ativo = true

    async function carregar() {
      let naoLidos = 0
      try {
        const { data } = await api.get('/avisos/')
        if (!ativo) return
        setDados(data)
        naoLidos = data.nao_lidos
      } catch (e) {
        if (ativo) setErro(mensagemDeErro(e, 'Não foi possível carregar os avisos.'))
        return
      }
      if (!naoLidos) return
      try {
        await api.post('/avisos/marcar-lidos/')
        avisarQueMudou()
      } catch {
        // marcar como visto é secundário: a lista já está na tela
      }
    }

    carregar()
    return () => {
      ativo = false
    }
    // Só ao abrir a página.
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** Para onde o aviso leva, quando há um lugar certo. */
  function destino(aviso) {
    if (usuario.perfil === 'orientador') {
      return aviso.entrega_id ? `/orientador/entregas/${aviso.entrega_id}` : '/orientador'
    }
    return aviso.entrega_id ? '/aluno/entregas' : '/aluno'
  }

  const avisosVisiveis = (dados?.avisos || []).filter(
    (a) =>
      (filtro === 'todos' || a.nao_lido) &&
      casaComBusca(busca, TITULOS_DE_AVISO[a.tipo], a.descricao),
  )

  return (
    <div className="pagina-avisos">
      <div className="cabecalho-pagina">
        <div>
          <h1>Avisos</h1>
          <p className="legenda">O que mudou no seu TCC e pede a sua atenção.</p>
        </div>
      </div>

      {erro ? (
        <p className="erro" role="alert">{erro}</p>
      ) : dados === null ? (
        <Carregando />
      ) : dados.avisos.length === 0 ? (
        <div className="vazio vazio-compacto">
          <strong>Nenhum aviso por enquanto</strong>
          <span>Quando algo acontecer no seu TCC, você vê aqui.</span>
        </div>
      ) : (
        <>
        <BarraDeFiltro
          rotulo="Filtrar avisos"
          opcoes={[
            { codigo: 'todos', rotulo: 'Todos', quantos: dados.avisos.length },
            { codigo: 'novos', rotulo: 'Novos', quantos: dados.avisos.filter((a) => a.nao_lido).length },
          ]}
          filtro={filtro}
          aoFiltrar={setFiltro}
          busca={busca}
          aoBuscar={setBusca}
          rotuloBusca="Buscar aviso"
          placeholder="Buscar nos avisos"
        />
        {avisosVisiveis.length === 0 ? (
          <SemResultados
            aoLimpar={() => {
              setFiltro('todos')
              setBusca('')
            }}
          />
        ) : (
        <ul className="lista-avisos">
          {avisosVisiveis.map((aviso) => (
            <li key={aviso.id} className={aviso.nao_lido ? 'aviso-item novo' : 'aviso-item'}>
              <span className="aviso-marca" aria-hidden="true" />
              <div className="aviso-corpo">
                <div className="aviso-cabecalho">
                  <h2>
                    {TITULOS_DE_AVISO[aviso.tipo] || 'Atualização'}
                    {aviso.nao_lido && <span className="aviso-selo">Novo</span>}
                  </h2>
                  <time dateTime={aviso.data_hora} title={dataHoraCurta(aviso.data_hora)}>
                    {tempoRelativo(aviso.data_hora)}
                  </time>
                </div>
                <p>{aviso.descricao}</p>
                <Link to={destino(aviso)}>Abrir</Link>
              </div>
            </li>
          ))}
        </ul>
        )}
        </>
      )}
    </div>
  )
}
