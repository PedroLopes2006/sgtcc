import { useRef, useState } from 'react'
import api, { mensagemDeErro } from '../api'
import Modal from './Modal'

const FORMATO = '.pdf'

/** US06 — modal de envio de versão. */
export default function EnviarVersao({ entrega, aoFechar, aoConcluir }) {
  const [arquivo, setArquivo] = useState(null)
  const [arrastando, setArrastando] = useState(false)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const campo = useRef(null)

  function escolher(selecionado) {
    if (!selecionado) return
    if (!selecionado.name.toLowerCase().endsWith(FORMATO)) {
      setErro('Formato não aceito. Envie um arquivo .pdf.')
      setArquivo(null)
      return
    }
    setErro('')
    setArquivo(selecionado)
  }

  async function enviar(evento) {
    evento.preventDefault()
    setErro('')
    setEnviando(true)
    try {
      const corpo = new FormData()
      corpo.append('arquivo', arquivo)
      await api.post(`/entregas/${entrega.id}/versoes/`, corpo)
      await aoConcluir()
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível enviar a versão.'))
      setEnviando(false)
    }
  }

  return (
    <Modal titulo="Enviar versão" aoFechar={aoFechar}>
      <p className="legenda">
        {entrega.titulo} · nova versão {entrega.numero_da_proxima_versao}
      </p>

      <form onSubmit={enviar}>
        <div
          className={arrastando ? 'area-arquivo arrastando' : 'area-arquivo'}
          onClick={() => campo.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setArrastando(true)
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => {
            e.preventDefault()
            setArrastando(false)
            escolher(e.dataTransfer.files?.[0])
          }}
        >
          <span>Arraste o arquivo aqui ou escolha no computador</span>
          <span className="formato">Formato PDF</span>
          <input
            ref={campo}
            type="file"
            accept="application/pdf,.pdf"
            aria-label="Arquivo da versão"
            onChange={(e) => escolher(e.target.files?.[0])}
          />
        </div>

        {arquivo && (
          <div className="arquivo-escolhido">
            <span>{arquivo.name}</span>
            <span className="formato">Selecionado</span>
          </div>
        )}

        {erro && <p className="erro">{erro}</p>}

        <div className="barra-acoes">
          <button type="button" className="contorno" onClick={aoFechar} disabled={enviando}>
            Cancelar
          </button>
          <button type="submit" disabled={enviando || !arquivo}>
            {enviando ? 'Enviando…' : 'Enviar versão'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
