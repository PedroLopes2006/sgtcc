import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { mensagemDeErro } from '../api'
import { painelDoPerfil, useAuth } from '../auth'

/** US01 CA1 e CA2. */
export default function Cadastro() {
  const { cadastrar } = useAuth()
  const navegar = useNavigate()
  const [form, setForm] = useState({ nome: '', email: '', senha: '', perfil: 'aluno' })
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  function alterar(campo) {
    return (evento) => setForm({ ...form, [campo]: evento.target.value })
  }

  async function aoEnviar(evento) {
    evento.preventDefault()
    setErro('')
    setEnviando(true)
    try {
      const usuario = await cadastrar(form)
      navegar(painelDoPerfil(usuario.perfil), { replace: true })
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível criar a conta.'))
      setEnviando(false)
    }
  }

  return (
    <div className="tela-acesso">
      <form className="cartao-acesso" onSubmit={aoEnviar}>
        <h1>Criar conta</h1>
        <p className="legenda">Preencha seus dados para começar.</p>

        <div className="campo">
          <label htmlFor="nome">Nome</label>
          <input
            id="nome"
            value={form.nome}
            onChange={alterar('nome')}
            placeholder="Nome completo"
            required
          />
        </div>

        <div className="campo">
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            type="email"
            value={form.email}
            onChange={alterar('email')}
            placeholder="nome@email.com"
            required
          />
        </div>

        <div className="campo">
          <label htmlFor="senha">Senha</label>
          <input
            id="senha"
            type="password"
            value={form.senha}
            onChange={alterar('senha')}
            placeholder="Sua senha"
            minLength={8}
            autoComplete="new-password"
            required
          />
        </div>

        {/* Dois segmentos, como no protótipo — não um select. */}
        <div className="campo">
          <label id="rotulo-perfil">Perfil</label>
          <div className="segmentado" role="group" aria-labelledby="rotulo-perfil">
            {['aluno', 'orientador'].map((valor) => (
              <button
                key={valor}
                type="button"
                aria-pressed={form.perfil === valor}
                onClick={() => setForm({ ...form, perfil: valor })}
              >
                {valor === 'aluno' ? 'Aluno' : 'Orientador'}
              </button>
            ))}
          </div>
        </div>

        {erro && <p className="erro">{erro}</p>}

        <button type="submit" disabled={enviando}>
          {enviando ? 'Criando…' : 'Criar conta'}
        </button>

        <p className="rodape-acesso">
          Já tem conta? <Link to="/login">Entrar</Link>
        </p>
      </form>
    </div>
  )
}
