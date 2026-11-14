/**
 * Esqueleto de carregamento: algumas barras cinzas que pulsam suavemente (só opacidade)
 * no lugar de um "Carregando…" solto. O texto continua lá, escondido, para quem usa
 * leitor de tela. Cada barra tem uma largura diferente, para parecer texto de verdade.
 */
const LARGURAS = ['62%', '100%', '84%', '48%']

export default function Carregando({ linhas = 4 }) {
  return (
    <div className="esqueleto" role="status">
      <span className="so-leitor">Carregando…</span>
      {Array.from({ length: linhas }, (_, i) => (
        <span
          key={i}
          className="esqueleto-linha"
          style={{ width: LARGURAS[i % LARGURAS.length] }}
          aria-hidden="true"
        />
      ))}
    </div>
  )
}
