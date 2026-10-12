import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api, { mensagemDeErro } from '../../api'
import { useTcc } from './AreaAluno'

/** US03 — propor tema e indicar orientador. */
export default function ProporTema() {
  const { tcc, recarregar } = useTcc()
  const navegar = useNavigate()
  const [orientadores, setOrientadores] = useState([])
  const [form, setForm] = useState({ titulo: '', descricao: '', orientador_id: '' })
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    // RN01 — quem já tem TCC não propõe outro.
    if (tcc) navegar('/aluno', { replace: true })
  }, [tcc, navegar])

  useEffect(() => {
    api
      .get('/orientadores/')
      .then(({ data }) => setOrientadores(data))
      .catch((e) => setErro(mensagemDeErro(e, 'Não foi possível carregar os orientadores.')))
  }, [])

  async function aoEnviar(evento) {
    evento.preventDefault()
    setErro('')
    setEnviando(true)
    try {
      await api.post('/temas/', { ...form, orientador_id: Number(form.orientador_id) })
      await recarregar()
      navegar('/aluno', { replace: true })
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível enviar a proposta.'))
      setEnviando(false)
    }
  }

  return (
    <div className="conteudo-estreito">
      <Link className="voltar" to="/aluno">
        ← Meu TCC
      </Link>
      <h1>Propor tema</h1>
      <p className="legenda">
        Seu orientador será notificado e vai aprovar o tema ou pedir ajuste.
      </p>

      <form onSubmit={aoEnviar}>
        <div className="campo">
          <label htmlFor="titulo">Título</label>
          <input
            id="titulo"
            value={form.titulo}
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            placeholder="Ex.: Sistema de gestão de TCC"
            required
          />
        </div>

        <div className="campo">
          <label htmlFor="descricao">Descrição</label>
          <textarea
            id="descricao"
            rows={4}
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            placeholder="Descreva o objetivo e o escopo do trabalho."
            required
          />
        </div>

        {/* CA3 — a escolha do orientador é obrigatória. */}
        <div className="campo">
          <label htmlFor="orientador">Orientador</label>
          <select
            id="orientador"
            value={form.orientador_id}
            onChange={(e) => setForm({ ...form, orientador_id: e.target.value })}
            required
          >
            <option value="">Selecione um orientador</option>
            {orientadores.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </select>
          <p className="ajuda">Obrigatório. Escolha quem vai orientar o seu TCC.</p>
        </div>

        {erro && <p className="erro">{erro}</p>}

        <div className="barra-acoes">
          <button type="button" className="contorno" onClick={() => navegar('/aluno')}>
            Cancelar
          </button>
          <button type="submit" disabled={enviando}>
            {enviando ? 'Enviando…' : 'Enviar proposta'}
          </button>
        </div>
      </form>
    </div>
  )
}
