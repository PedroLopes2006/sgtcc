import { useEffect, useState } from 'react'
import api, { mensagemDeErro } from '../api'
import { useAuth } from '../auth'
import { mesEAno } from '../formato'
import Avatar from './Avatar'
import { useTema } from '../tema'
import Estado from './Estado'

/**
 * Tela de Perfil, a parte que é igual para aluno e orientador: o cabeçalho com
 * o nome, os dados da conta, a escolha de aparência (claro, escuro ou
 * automático), o Telegram e o botão de sair. O "Resumo" é de cada perfil e
 * chega como `children`.
 *
 * Os dados vêm de `GET /api/auth/eu/`, para mostrar o que está valendo agora (o
 * Telegram vinculado, desde quando a conta existe) e não o que ficou guardado
 * no navegador no login. Enquanto isso carrega, vale o que o login guardou.
 *
 * US02 (RF02) — o cartão do Telegram vincula o código do chat. Ao vincular, o
 * sistema manda uma mensagem de teste e a tela diz se ela chegou; o vínculo fica
 * gravado mesmo se não chegar (RNF11), com a dica do que conferir.
 */
const PAPEL = { aluno: 'Aluno', orientador: 'Orientador' }

const APARENCIAS = [
  { valor: 'claro', rotulo: 'Claro' },
  { valor: 'escuro', rotulo: 'Escuro' },
  { valor: 'sistema', rotulo: 'Automático' },
]

export default function PerfilBase({ textoTelegram, children }) {
  const { usuario: salvo, sair, atualizarUsuario } = useAuth()
  const { preferencia, definir } = useTema()
  const [usuario, setUsuario] = useState(salvo)

  useEffect(() => {
    let ativo = true
    api
      .get('/auth/eu/')
      .then(({ data }) => {
        if (ativo) setUsuario((atual) => ({ ...atual, ...data }))
      })
      .catch(() => {}) // sem a busca, continua valendo o que o login guardou
    return () => {
      ativo = false
    }
  }, [])

  const vinculado = Boolean(usuario.telegram_chat_id)

  // US02 — vincular (ou desvincular) o Telegram.
  const [chatId, setChatId] = useState('')
  const [salvandoTelegram, setSalvandoTelegram] = useState(false)
  const [mensagemTelegram, setMensagemTelegram] = useState('')
  const [erroTelegram, setErroTelegram] = useState(false)

  async function enviarTelegram(codigo) {
    setMensagemTelegram('')
    setSalvandoTelegram(true)
    try {
      const { data } = await api.post('/auth/telegram/', { chat_id: codigo })
      const { teste, ...conta } = data
      setUsuario((atual) => ({ ...atual, ...conta }))
      atualizarUsuario({ telegram_chat_id: conta.telegram_chat_id })
      setChatId('')
      if (teste === 'enviada') {
        setErroTelegram(false)
        setMensagemTelegram('Telegram vinculado. Mandamos uma mensagem de teste para você.')
      } else if (teste === 'falhou') {
        setErroTelegram(true)
        setMensagemTelegram(
          'O código foi salvo, mas a mensagem de teste não chegou. Confira se você tocou em ' +
            '"Iniciar" no bot e se o código está certo, e vincule de novo.',
        )
      } else {
        setErroTelegram(false)
        setMensagemTelegram('Telegram desvinculado. Os avisos continuam na aba Avisos.')
      }
    } catch (e) {
      setErroTelegram(true)
      setMensagemTelegram(mensagemDeErro(e, 'Não foi possível vincular o Telegram.'))
    } finally {
      setSalvandoTelegram(false)
    }
  }

  function vincularTelegram(evento) {
    evento.preventDefault()
    if (!chatId.trim()) {
      setErroTelegram(true)
      setMensagemTelegram('Cole o código do seu chat.')
      return
    }
    enviarTelegram(chatId)
  }

  // EXTRA (fora dos requisitos) — trocar o nome e a senha da própria conta.
  const [editandoNome, setEditandoNome] = useState(false)
  const [nome, setNome] = useState(salvo.nome)
  const [salvandoNome, setSalvandoNome] = useState(false)
  const [mensagemNome, setMensagemNome] = useState('')
  const [erroNome, setErroNome] = useState(false)
  const [senhas, setSenhas] = useState({ atual: '', nova: '' })
  const [salvandoSenha, setSalvandoSenha] = useState(false)
  const [mensagemSenha, setMensagemSenha] = useState('')
  const [erroSenha, setErroSenha] = useState(false)

  function cancelarNome() {
    setEditandoNome(false)
    setNome(usuario.nome)
  }

  async function salvarNome(evento) {
    evento.preventDefault()
    setMensagemNome('')
    if (!nome.trim()) {
      setErroNome(true)
      setMensagemNome('Informe o nome.')
      return
    }
    setSalvandoNome(true)
    try {
      const { data } = await api.patch('/auth/eu/', { nome })
      setUsuario((atual) => ({ ...atual, ...data }))
      atualizarUsuario({ nome: data.nome })
      setEditandoNome(false)
      setErroNome(false)
      setMensagemNome('Nome atualizado.')
    } catch (e) {
      setErroNome(true)
      setMensagemNome(mensagemDeErro(e, 'Não foi possível atualizar o nome.'))
    } finally {
      setSalvandoNome(false)
    }
  }

  // EXTRA (fora dos requisitos) — trocar o e-mail de login, pedindo a senha atual.
  const [editandoEmail, setEditandoEmail] = useState(false)
  const [novoEmail, setNovoEmail] = useState('')
  const [senhaDoEmail, setSenhaDoEmail] = useState('')
  const [salvandoEmail, setSalvandoEmail] = useState(false)

  function cancelarEmail() {
    setEditandoEmail(false)
    setNovoEmail('')
    setSenhaDoEmail('')
    setMensagemNome('')
  }

  async function salvarEmail(evento) {
    evento.preventDefault()
    setMensagemNome('')
    setSalvandoEmail(true)
    try {
      const { data } = await api.post('/auth/alterar-email/', {
        email: novoEmail,
        senha_atual: senhaDoEmail,
      })
      setUsuario((atual) => ({ ...atual, ...data }))
      atualizarUsuario({ email: data.email })
      setEditandoEmail(false)
      setNovoEmail('')
      setSenhaDoEmail('')
      setErroNome(false)
      setMensagemNome('E-mail atualizado. Use o novo para entrar.')
    } catch (e) {
      setErroNome(true)
      setMensagemNome(mensagemDeErro(e, 'Não foi possível atualizar o e-mail.'))
    } finally {
      setSalvandoEmail(false)
    }
  }

  async function salvarSenha(evento) {
    evento.preventDefault()
    setMensagemSenha('')
    setSalvandoSenha(true)
    try {
      await api.post('/auth/alterar-senha/', {
        senha_atual: senhas.atual,
        nova_senha: senhas.nova,
      })
      setSenhas({ atual: '', nova: '' })
      setErroSenha(false)
      setMensagemSenha('Senha alterada.')
    } catch (e) {
      setErroSenha(true)
      setMensagemSenha(mensagemDeErro(e, 'Não foi possível alterar a senha.'))
    } finally {
      setSalvandoSenha(false)
    }
  }

  return (
    <div className="perfil">
      <header className="perfil-cabecalho">
        <Avatar nome={usuario.nome} grande escondido />
        <div>
          <h1>{usuario.nome}</h1>
          <p className="perfil-sub">
            <span className="chip-papel">{PAPEL[usuario.perfil] || usuario.perfil}</span>
            <span>{usuario.email}</span>
          </p>
        </div>
      </header>

      <div className="perfil-grade">
        <section className="cartao-perfil perfil-resumo" aria-labelledby="perfil-resumo">
          <h2 id="perfil-resumo">Resumo</h2>
          {children}
        </section>

        <section className="cartao-perfil" aria-labelledby="perfil-aparencia">
          <h2 id="perfil-aparencia">Aparência</h2>
          <p className="ajuda">
            Automático segue o tema do seu computador e muda junto com ele.
          </p>
          <div className="segmentado tres" role="group" aria-label="Tema da tela">
            {APARENCIAS.map(({ valor, rotulo }) => (
              <button
                key={valor}
                type="button"
                aria-pressed={preferencia === valor}
                onClick={() => definir(valor)}
              >
                {rotulo}
              </button>
            ))}
          </div>
        </section>

        <section className="cartao-perfil" aria-labelledby="perfil-telegram">
          <h2 id="perfil-telegram">Telegram</h2>
          <p className="perfil-situacao">
            <Estado
              codigo={vinculado ? 'concluida' : 'rascunho'}
              rotulo={vinculado ? 'Vinculado' : 'Não vinculado'}
            />
          </p>
          <p className="ajuda">{textoTelegram}</p>
          <ol className="ajuda perfil-telegram-passos" id="telegram-como">
            <li>
              No Telegram, abra{' '}
              {usuario.telegram_bot ? (
                <a href={`https://t.me/${usuario.telegram_bot}`} target="_blank" rel="noreferrer">
                  @{usuario.telegram_bot}
                </a>
              ) : (
                'o bot do SGTCC'
              )}{' '}
              e toque em <strong>Iniciar</strong>.
            </li>
            <li>
              Fale com o <strong>@userinfobot</strong>: ele responde com o seu código (o “Id”).
            </li>
            <li>Cole o código aqui e toque em Vincular.</li>
          </ol>
          <form className="campo perfil-telegram-form" onSubmit={vincularTelegram}>
            <label htmlFor="codigo-chat">
              {vinculado ? 'Trocar o código do chat' : 'Código do chat'}
            </label>
            <input
              id="codigo-chat"
              inputMode="numeric"
              autoComplete="off"
              placeholder={vinculado ? usuario.telegram_chat_id : 'Ex.: 123456789'}
              value={chatId}
              maxLength={64}
              onChange={(e) => setChatId(e.target.value)}
              aria-describedby="telegram-como"
            />
            <div className="perfil-form-linha">
              <button type="submit" disabled={salvandoTelegram} aria-busy={salvandoTelegram}>
                {salvandoTelegram ? 'Salvando…' : 'Vincular'}
              </button>
              {vinculado && (
                <button
                  type="button"
                  className="contorno"
                  disabled={salvandoTelegram}
                  onClick={() => enviarTelegram('')}
                >
                  Desvincular
                </button>
              )}
            </div>
          </form>
          {mensagemTelegram && (
            <p
              className={erroTelegram ? 'erro' : 'sucesso'}
              role={erroTelegram ? 'alert' : 'status'}
            >
              {mensagemTelegram}
            </p>
          )}
        </section>

        <section className="cartao-perfil" aria-labelledby="perfil-conta">
          <h2 id="perfil-conta">Conta</h2>
          <dl className="definicoes">
            <div>
              <dt>Nome</dt>
              <dd>
                {editandoNome ? (
                  <form className="perfil-form-linha" onSubmit={salvarNome}>
                    <input
                      id="novo-nome"
                      aria-label="Nome"
                      value={nome}
                      maxLength={150}
                      onChange={(e) => setNome(e.target.value)}
                      autoFocus
                    />
                    <button type="submit" disabled={salvandoNome} aria-busy={salvandoNome}>
                      {salvandoNome ? 'Salvando…' : 'Salvar'}
                    </button>
                    <button type="button" className="contorno" onClick={cancelarNome}>
                      Cancelar
                    </button>
                  </form>
                ) : (
                  <>
                    {usuario.nome}{' '}
                    <button type="button" className="texto" onClick={() => setEditandoNome(true)}>
                      Editar nome
                    </button>
                  </>
                )}
              </dd>
            </div>
            <div>
              <dt>E-mail</dt>
              <dd>
                {editandoEmail ? (
                  <form className="perfil-form" onSubmit={salvarEmail}>
                    <div className="campo">
                      <label htmlFor="novo-email">Novo e-mail</label>
                      <input
                        id="novo-email"
                        type="email"
                        value={novoEmail}
                        autoComplete="email"
                        onChange={(e) => setNovoEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="campo">
                      <label htmlFor="senha-do-email">Confirme com a sua senha</label>
                      <input
                        id="senha-do-email"
                        type="password"
                        value={senhaDoEmail}
                        autoComplete="current-password"
                        onChange={(e) => setSenhaDoEmail(e.target.value)}
                        required
                      />
                      <p className="ajuda">Pedimos a senha porque o e-mail é o que você usa para entrar.</p>
                    </div>
                    <div className="perfil-form-linha">
                      <button type="submit" disabled={salvandoEmail} aria-busy={salvandoEmail}>
                        {salvandoEmail ? 'Salvando…' : 'Salvar e-mail'}
                      </button>
                      <button type="button" className="contorno" onClick={cancelarEmail}>
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    {usuario.email}{' '}
                    <button type="button" className="texto" onClick={() => setEditandoEmail(true)}>
                      Alterar e-mail
                    </button>
                  </>
                )}
              </dd>
            </div>
            <div>
              <dt>Perfil</dt>
              <dd>{PAPEL[usuario.perfil] || usuario.perfil}</dd>
            </div>
            {usuario.data_cadastro && (
              <div>
                <dt>Membro desde</dt>
                <dd>{mesEAno(usuario.data_cadastro)}</dd>
              </div>
            )}
          </dl>
          {mensagemNome && (
            <p className={erroNome ? 'erro' : 'sucesso'} role={erroNome ? 'alert' : 'status'}>
              {mensagemNome}
            </p>
          )}
          <div className="barra-acoes">
            <button type="button" className="contorno" onClick={sair}>
              Sair da conta
            </button>
          </div>
        </section>

        {/* EXTRA (fora dos requisitos): troca de senha. RNF03: a atual é conferida e só o hash fica guardado. */}
        <section className="cartao-perfil" aria-labelledby="perfil-seguranca">
          <h2 id="perfil-seguranca">Senha</h2>
          <form className="perfil-form" onSubmit={salvarSenha}>
            <div className="campo">
              <label htmlFor="senha-atual">Senha atual</label>
              <input
                id="senha-atual"
                type="password"
                autoComplete="current-password"
                value={senhas.atual}
                onChange={(e) => setSenhas({ ...senhas, atual: e.target.value })}
                required
              />
            </div>
            <div className="campo">
              <label htmlFor="senha-nova">Nova senha</label>
              <input
                id="senha-nova"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={senhas.nova}
                onChange={(e) => setSenhas({ ...senhas, nova: e.target.value })}
                required
              />
              <p className="ajuda">Use ao menos 8 caracteres.</p>
            </div>
            {mensagemSenha && (
              <p className={erroSenha ? 'erro' : 'sucesso'} role={erroSenha ? 'alert' : 'status'}>
                {mensagemSenha}
              </p>
            )}
            <button type="submit" disabled={salvandoSenha} aria-busy={salvandoSenha}>
              {salvandoSenha ? 'Salvando…' : 'Alterar senha'}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
