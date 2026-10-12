import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import RotaProtegida from './components/RotaProtegida'
import { AuthProvider, painelDoPerfil, useAuth } from './auth'
import Cadastro from './pages/Cadastro'
import Login from './pages/Login'
import AreaAluno from './pages/aluno/AreaAluno'
import Entregas from './pages/aluno/Entregas'
import MeuTCC from './pages/aluno/MeuTCC'
import NovaEntrega from './pages/aluno/NovaEntrega'
import ProporTema from './pages/aluno/ProporTema'
import Orientandos from './pages/orientador/Orientandos'

function Raiz() {
  const { usuario } = useAuth()
  return <Navigate to={usuario ? painelDoPerfil(usuario.perfil) : '/login'} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Raiz />} />
          <Route path="/login" element={<Login />} />
          <Route path="/cadastro" element={<Cadastro />} />

          <Route
            path="/aluno"
            element={
              <RotaProtegida perfil="aluno">
                <AreaAluno />
              </RotaProtegida>
            }
          >
            <Route index element={<MeuTCC />} />
            <Route path="propor" element={<ProporTema />} />
            <Route path="entregas" element={<Entregas />} />
            <Route path="entregas/nova" element={<NovaEntrega />} />
          </Route>

          <Route
            path="/orientador"
            element={
              <RotaProtegida perfil="orientador">
                <Orientandos />
              </RotaProtegida>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
