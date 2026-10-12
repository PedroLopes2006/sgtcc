import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
})

// Anexa o token JWT em toda requisição autenticada.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sgtcc.access')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Token expirado derruba a sessão e devolve o usuário ao login.
api.interceptors.response.use(
  (resposta) => resposta,
  (erro) => {
    if (erro.response?.status === 401 && localStorage.getItem('sgtcc.access')) {
      localStorage.removeItem('sgtcc.access')
      localStorage.removeItem('sgtcc.refresh')
      localStorage.removeItem('sgtcc.usuario')
      window.location.href = '/login'
    }
    return Promise.reject(erro)
  },
)

/** Extrai a mensagem útil de um erro da API, sem despejar JSON na tela. */
export function mensagemDeErro(erro, padrao = 'Não foi possível concluir a ação.') {
  const dados = erro?.response?.data
  if (!dados) return padrao
  if (typeof dados === 'string') return dados
  if (dados.detail) return String(dados.detail)
  const primeiraChave = Object.keys(dados)[0]
  if (!primeiraChave) return padrao
  const valor = dados[primeiraChave]
  return Array.isArray(valor) ? String(valor[0]) : String(valor)
}

export default api
