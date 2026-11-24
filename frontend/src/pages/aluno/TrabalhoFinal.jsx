import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { mensagemDeErro } from '../../api'
import Carregando from '../../components/Carregando'
import EnviarVersao from '../../components/EnviarVersao'
import Estado from '../../components/Estado'
import LinkVersao from '../../components/LinkVersao'
import Toast from '../../components/Toast'
import { ROTULO_ESTADO_ENTREGA, ROTULO_ESTADO_TRABALHO_FINAL, dataCurta } from '../../formato'

/** O que o aluno lê sobre o estado atual do trabalho final, em uma frase. */
function orientacaoDoEstado(estado, trabalho) {
  switch (estado) {
    case 'em_avaliacao':
      return 'Seu orientador está avaliando o trabalho. Você será avisado da decisão.'
    case 'correcao_solicitada':
      return 'Seu orientador pediu correções. Leia o parecer abaixo e envie uma nova versão.'
    case 'reprovado':
      return 'O trabalho foi reprovado. Leia a justificativa abaixo e envie uma nova versão para tentar de novo.'
    case 'aprovado':
      return `Trabalho aprovado em ${dataCurta(trabalho?.data_aprovacao)}. Falta o orientador enviá-lo à banca.`
    case 'enviado_a_banca':
      return `Trabalho enviado à banca em ${dataCurta(trabalho?.data_banca)}. Seu TCC está concluído.`
    default:
      return ''
  }
}

/**
 * US18 — o aluno envia o trabalho final (o TCC completo) e acompanha a avaliação.
 *
 * O trabalho final é a última etapa: só é liberado quando todas as entregas estão
 * concluídas (RN16, CA2), e a tela diz quais ainda faltam. Depois de "correção
 * solicitada" ou "reprovado", o aluno envia uma nova versão (CA3, RN13, RN18) e o
 * histórico anterior continua visível. Os pareceres do orientador nunca são alterados
 * (RN14). Quem decide se o envio está liberado é a API (`pode_enviar`).
 */
export default function TrabalhoFinal() {
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState('')

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get('/trabalho-final/')
      setDados(data)
      setErro('')
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível carregar o trabalho final.'))
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  if (erro && !dados) {
    return (
      <div>
        <p className="erro" role="alert">{erro}</p>
      </div>
    )
  }
  if (!dados) return <Carregando />

  const { trabalho, pendentes, pode_enviar: podeEnviar, estado } = dados
  const versoes = trabalho ? [...trabalho.versoes].reverse() : [] // a API manda em ordem cronológica
  const pareceres = trabalho ? [...trabalho.comentarios].reverse() : []
  const reenvio = Boolean(trabalho)

  return (
    <div>
      <div className="cabecalho-pagina">
        <div>
          <h1>Trabalho final</h1>
          <p className="legenda">O TCC completo, enviado depois de concluir todas as entregas.</p>
        </div>
        <div className="cabecalho-acoes">
          <Estado codigo={estado} rotulo={ROTULO_ESTADO_TRABALHO_FINAL[estado] || estado} />
          {podeEnviar && (
            <button onClick={() => setEnviando(true)}>
              {reenvio ? 'Enviar nova versão' : 'Enviar trabalho final'}
            </button>
          )}
        </div>
      </div>

      <Toast mensagem={aviso} aoFechar={() => setAviso('')} />

      {trabalho && <p className="meta">{orientacaoDoEstado(estado, trabalho)}</p>}

      {/* CA2 / RN16 — enquanto houver entrega pendente, o envio fica bloqueado e a tela diz o que falta. */}
      {!trabalho && !podeEnviar && (
        <section className="secao-revisao" aria-label="O que falta">
          {pendentes.length === 0 ? (
            <div className="vazio vazio-compacto">
              <strong>Ainda não há entregas</strong>
              <span>Crie e conclua suas entregas para liberar o trabalho final.</span>
              <Link className="contorno" to="/aluno/entregas">Ir para Entregas</Link>
            </div>
          ) : (
            <>
              <h2>O que falta para liberar o envio</h2>
              <p className="meta">
                O trabalho final só é liberado quando todas as entregas estão concluídas.
              </p>
              <ul className="lista">
                {pendentes.map((item) => (
                  <li key={item.id}>
                    <div>
                      <div className="titulo">{item.titulo}</div>
                    </div>
                    <div className="acoes-linha">
                      <Estado codigo={item.estado} rotulo={ROTULO_ESTADO_ENTREGA[item.estado]} />
                    </div>
                  </li>
                ))}
              </ul>
              <div className="acao-secao">
                <Link className="contorno" to="/aluno/entregas">Ir para Entregas</Link>
              </div>
            </>
          )}
        </section>
      )}

      {!trabalho && podeEnviar && (
        <div className="vazio vazio-compacto">
          <strong>Tudo pronto para o envio</strong>
          <span>Todas as entregas foram concluídas. Envie o PDF do trabalho final.</span>
        </div>
      )}

      {pareceres.length > 0 && (
        <section className="secao-revisao" aria-label="Pareceres do orientador">
          <h2>Pareceres do orientador</h2>
          {pareceres.map((item) => (
            <div className="comentario-correcao" key={item.id}>
              <div>{item.texto}</div>
              <div className="rotulo">
                {item.autor?.nome}
                {item.versao && ` · versão ${item.versao}`}
                {` · ${dataCurta(item.data_criacao)}`}
              </div>
            </div>
          ))}
        </section>
      )}

      {versoes.length > 0 && (
        <section className="secao-revisao" aria-label="Versões">
          <h2>Versões enviadas</h2>
          <ol className="lista lista-versoes">
            {versoes.map((versao, posicao) => (
              <li key={versao.id}>
                <div>
                  <div className="titulo">
                    Versão {versao.numero}
                    {posicao === 0 && <span className="meta"> · atual</span>}
                  </div>
                  <div className="meta">
                    {versao.nome_original} · Enviada em {dataCurta(versao.data_envio)}
                  </div>
                </div>
                <LinkVersao versao={versao} titulo="trabalho final" />
              </li>
            ))}
          </ol>
        </section>
      )}

      {enviando && (
        <EnviarVersao
          url="/trabalho-final/"
          titulo={reenvio ? 'Enviar nova versão' : 'Enviar trabalho final'}
          legenda={
            reenvio
              ? `Trabalho final · nova versão ${(trabalho.versoes_enviadas || 0) + 1}`
              : 'Trabalho final · versão 1'
          }
          aoFechar={() => setEnviando(false)}
          aoConcluir={async () => {
            setEnviando(false)
            await carregar()
            setAviso('Trabalho final enviado. Seu orientador foi avisado.')
          }}
        />
      )}
    </div>
  )
}
