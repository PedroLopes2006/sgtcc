import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { mensagemDeErro } from '../api'
import { avisarQueMudou } from '../avisos'
import { useAuth } from '../auth'
import { dataHoraCurta } from '../formato'

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
const TITULOS = {
  tema_proposto: 'Tema proposto',
  tema_reenviado: 'Tema reenviado',
  tema_aprovado: 'Tema aprovado',
  tema_ajuste_solicitado: 'Ajuste de tema solicitado',
  entrega_pronta: 'Entrega pronta para revisão',
  entrega_em_revisao: 'Entrega em revisão',
  correcao_solicitada: 'Correção solicitada',
  comentario_adicionado: 'Novo comentário',
  entrega_concluida: 'Entrega concluída',
  entrega_enviada_a_banca: 'Entrega enviada à banca',
  troca_orientador: 'Troca de orientador',
}

export default function Avisos() {
  const { usuario } = useAuth()
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')

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

  return (
    <div className="pagina-avisos">
      <div className="cabecalho-pagina">
        <div>
          <h1>Avisos</h1>
          <p className="legenda">O que mudou no seu TCC e pede a sua atenção.</p>
        </div>
      </div>

      {erro ? (
        <p className="erro">{erro}</p>
      ) : dados === null ? (
        <p className="carregando">Carregando…</p>
      ) : dados.avisos.length === 0 ? (
        <div className="vazio vazio-compacto">
          <strong>Nenhum aviso por enquanto</strong>
          <span>Quando algo acontecer no seu TCC, você vê aqui.</span>
        </div>
      ) : (
        <ul className="lista-avisos">
          {dados.avisos.map((aviso) => (
            <li key={aviso.id} className={aviso.nao_lido ? 'aviso-item novo' : 'aviso-item'}>
              <span className="aviso-marca" aria-hidden="true" />
              <div className="aviso-corpo">
                <div className="aviso-cabecalho">
                  <h2>
                    {TITULOS[aviso.tipo] || 'Atualização'}
                    {aviso.nao_lido && <span className="aviso-selo">Novo</span>}
                  </h2>
                  <time dateTime={aviso.data_hora}>{dataHoraCurta(aviso.data_hora)}</time>
                </div>
                <p>{aviso.descricao}</p>
                <Link to={destino(aviso)}>Abrir</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
