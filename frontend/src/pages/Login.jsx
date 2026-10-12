import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { mensagemDeErro } from '../api'
import { painelDoPerfil, useAuth } from '../auth'

/** US01 CA3 e CA4. */
export default function Login() {
  const { usuario, entrar } = useAuth()
  const navegar = useNavigate()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  if (usuario) return <Navigate to={painelDoPerfil(usuario.perfil)} replace />

  async function aoEnviar(evento) {
    evento.preventDefault()
    setErro('')
    setEnviando(true)
    try {
      const logado = await entrar(email, senha)
      // CA3 — o perfil decide o painel de destino.
      navegar(painelDoPerfil(logado.perfil), { replace: true })
    } catch (e) {
      // CA4 — erro genérico, sem revelar se o e-mail existe.
      setErro(mensagemDeErro(e, 'E-mail ou senha inválidos.'))
      setEnviando(false)
    }
  }

  return (
    <div className="tela-acesso">
      <form className="cartao-acesso" onSubmit={aoEnviar}>
        <h1>Entrar</h1>
        <p className="legenda">Acesse para acompanhar seu TCC.</p>

        <div className="campo">
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nome@email.com"
            autoComplete="email"
            required
          />
        </div>

        <div className="campo">
          <label htmlFor="senha">Senha</label>
          <input
            id="senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Sua senha"
            autoComplete="current-password"
            required
          />
        </div>

        {erro && <p className="erro">{erro}</p>}

        <button type="submit" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>

        <p className="rodape-acesso">
          Não tem conta? <Link to="/cadastro">Criar conta</Link>
        </p>
      </form>
    </div>
  )
}
