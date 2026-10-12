import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api, { mensagemDeErro } from '../../api'
import { useTcc } from './AreaAluno'

/**
 * US05 — cria a etapa com título e prazo.
 *
 * Sem campo de arquivo: o upload de versões é a US06, fora deste sprint.
 */
export default function NovaEntrega() {
  const { tcc, recarregar } = useTcc()
  const navegar = useNavigate()
  const [form, setForm] = useState({ titulo: '', prazo: '' })
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    // RN02 — a tela nem abre sem tema aprovado.
    if (tcc?.tema?.status !== 'aprovado') navegar('/aluno/entregas', { replace: true })
  }, [tcc, navegar])

  async function aoEnviar(evento) {
    evento.preventDefault()
    setErro('')
    setEnviando(true)
    try {
      await api.post('/entregas/', form)
      await recarregar()
      navegar('/aluno/entregas', { replace: true })
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível criar a entrega.'))
      setEnviando(false)
    }
  }

  return (
    <div className="conteudo-estreito">
      <Link className="voltar" to="/aluno/entregas">
        ← Entregas
      </Link>
      <h1>Nova entrega</h1>
      <p className="legenda">Defina o título e o prazo. Depois você poderá enviar versões.</p>

      <form onSubmit={aoEnviar}>
        <div className="campo">
          <label htmlFor="titulo">Título</label>
          <input
            id="titulo"
            value={form.titulo}
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            placeholder="Ex.: Referencial teórico"
            required
          />
        </div>

        <div className="campo">
          <label htmlFor="prazo">Prazo</label>
          <input
            id="prazo"
            type="date"
            value={form.prazo}
            onChange={(e) => setForm({ ...form, prazo: e.target.value })}
            required
          />
          <p className="ajuda">O prazo deve ser uma data futura.</p>
        </div>

        {erro && <p className="erro">{erro}</p>}

        <div className="barra-acoes">
          <button type="button" className="contorno" onClick={() => navegar('/aluno/entregas')}>
            Cancelar
          </button>
          <button type="submit" disabled={enviando}>
            {enviando ? 'Criando…' : 'Criar entrega'}
          </button>
        </div>
      </form>
    </div>
  )
}
