import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { mensagemDeErro } from '../../api'
import Indicadores from '../../components/Indicadores'
import LayoutOrientador from '../../components/LayoutOrientador'
import PerfilBase from '../../components/PerfilBase'

/**
 * Perfil do orientador: os números do trabalho dele (orientandos ativos, para
 * revisar, temas a avaliar e prazos em atraso), tirados de `/orientandos/`, e a
 * parte comum do perfil (veja PerfilBase).
 */
export default function PerfilOrientador() {
  const [linhas, setLinhas] = useState(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let ativo = true
    api
      .get('/orientandos/')
      .then(({ data }) => {
        if (ativo) setLinhas(data)
      })
      .catch((e) => {
        if (ativo) setErro(mensagemDeErro(e, 'Não foi possível carregar seus orientandos.'))
      })
    return () => {
      ativo = false
    }
  }, [])

  const naFila = (linhas || []).filter(
    (l) => l.entrega_para_revisao?.estado === 'pronto_para_revisao',
  ).length

  return (
    <LayoutOrientador orientandos={linhas ? linhas.length : undefined} fila={linhas ? naFila : undefined}>
      <PerfilBase textoTelegram="Receba avisos de entregas prontas para revisão no Telegram.">
        {erro ? (
          <p className="erro">{erro}</p>
        ) : linhas === null ? (
          <p className="carregando">Carregando…</p>
        ) : (
          <>
            <Indicadores
              itens={[
                { rotulo: 'Orientandos ativos', valor: linhas.length },
                { rotulo: 'Para revisar', valor: naFila },
                {
                  rotulo: 'Temas a avaliar',
                  valor: linhas.filter((l) => l.aguarda_avaliacao_de_tema).length,
                },
                {
                  rotulo: 'Em atraso',
                  valor: linhas.filter((l) => l.prazo_vencido).length,
                  alerta: linhas.some((l) => l.prazo_vencido),
                },
              ]}
            />
            <div className="barra-acoes">
              <Link className="contorno" to="/orientador/fila">
                Ir para a fila de revisão
              </Link>
              <Link className="contorno" to="/orientador">
                Ver orientandos
              </Link>
            </div>
          </>
        )}
      </PerfilBase>
    </LayoutOrientador>
  )
}
