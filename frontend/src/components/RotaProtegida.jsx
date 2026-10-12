import { Navigate } from 'react-router-dom'
import { painelDoPerfil, useAuth } from '../auth'

/**
 * RNF04 — cada rota exige um perfil. Quem não está logado vai para o login;
 * quem está logado no perfil errado é mandado ao próprio painel.
 */
export default function RotaProtegida({ perfil, children }) {
  const { usuario } = useAuth()

  if (!usuario) return <Navigate to="/login" replace />
  if (perfil && usuario.perfil !== perfil) {
    return <Navigate to={painelDoPerfil(usuario.perfil)} replace />
  }
  return children
}
