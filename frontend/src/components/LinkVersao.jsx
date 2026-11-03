/**
 * Abre o PDF da versão atual numa nova aba, para o orientador ler antes de
 * revisar (US10 a US12).
 *
 * A URL vem pronta da API: em produção é assinada e vale 1 hora, e só chega a
 * quem pode ver o TCC (RN05). Sem versão enviada, não mostra nada.
 */
export default function LinkVersao({ versao, titulo }) {
  if (!versao?.arquivo_url) return null
  const rotulo = `Abrir versão ${versao.numero}`
  return (
    <a
      className="contorno"
      href={versao.arquivo_url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={titulo ? `${rotulo} de ${titulo}` : undefined}
    >
      {rotulo}
    </a>
  )
}
