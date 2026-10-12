import { createContext, useContext, useMemo, useState } from 'react'
import api from './api'

const AuthContext = createContext(null)

function usuarioSalvo() {
  try {
    return JSON.parse(localStorage.getItem('sgtcc.usuario')) || null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(usuarioSalvo)

  const valor = useMemo(
    () => ({
      usuario,

      // US01 CA3 — o perfil retornado define para qual painel o front direciona.
      async entrar(email, senha) {
        const { data } = await api.post('/auth/login/', { email, password: senha })
        localStorage.setItem('sgtcc.access', data.access)
        localStorage.setItem('sgtcc.refresh', data.refresh)
        localStorage.setItem('sgtcc.usuario', JSON.stringify(data.usuario))
        setUsuario(data.usuario)
        return data.usuario
      },

      // US01 CA1 — cadastro seguido de login automático.
      async cadastrar({ nome, email, senha, perfil }) {
        await api.post('/auth/registrar/', { nome, email, senha, perfil })
        return this.entrar(email, senha)
      },

      sair() {
        localStorage.removeItem('sgtcc.access')
        localStorage.removeItem('sgtcc.refresh')
        localStorage.removeItem('sgtcc.usuario')
        setUsuario(null)
      },
    }),
    [usuario],
  )

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const contexto = useContext(AuthContext)
  if (!contexto) throw new Error('useAuth precisa estar dentro de AuthProvider.')
  return contexto
}

export function painelDoPerfil(perfil) {
  return perfil === 'orientador' ? '/orientador' : '/aluno'
}
