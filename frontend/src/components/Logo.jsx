/**
 * Marca do SGTCC: o nome ao lado de um símbolo.
 *
 * O símbolo é o percurso em degraus do "Caminho do TCC": sai de um ponto, avança por etapas
 * e chega ao ponto final (a banca). O mesmo desenho é o ícone da aba do navegador
 * (`public/favicon.svg`).
 *
 * As cores vêm do tema: o fundo é o destaque e o traço é o texto sobre o destaque. No menu
 * escuro, que troca essas duas variáveis, o símbolo vira claro com traço escuro, sozinho.
 */
export function SimboloSGTCC({ tamanho = 28 }) {
  return (
    <svg
      className="logo-simbolo"
      width={tamanho}
      height={tamanho}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="32" height="32" rx="8" fill="var(--destaque)" />
      <path
        d="M8.5 22.5H16V9.5h7.5"
        fill="none"
        stroke="var(--acao-texto)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8.5" cy="22.5" r="2.6" fill="var(--acao-texto)" />
      <circle cx="23.5" cy="9.5" r="3.2" fill="var(--acao-texto)" />
    </svg>
  )
}

export default function Logo({ tamanho = 28 }) {
  return (
    <span className="logo">
      <SimboloSGTCC tamanho={tamanho} />
      <span className="marca-nome">SGTCC</span>
    </span>
  )
}
