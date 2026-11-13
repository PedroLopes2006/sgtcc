/**
 * Ícones da barra lateral: traços simples em SVG, com a cor do texto (currentColor).
 * São poucos desenhos de poucos traços, então não pesam nada.
 *
 * As telas ainda passam o símbolo de texto de sempre (▦, ▤, ◷, ◍, ◎) no `icone`
 * do item de menu; `ICONE_POR_SIMBOLO` o troca pelo desenho. Símbolo
 * desconhecido continua aparecendo como texto.
 */
const DESENHOS = {
  inicio: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  lista: (
    <>
      <path d="M9 6h12M9 12h12M9 18h12" />
      <circle cx="4.5" cy="6" r="1" />
      <circle cx="4.5" cy="12" r="1" />
      <circle cx="4.5" cy="18" r="1" />
    </>
  ),
  relogio: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  pessoas: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c2 .7 3.2 2.4 3.5 5.2" />
    </>
  ),
  sino: (
    <>
      <path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </>
  ),
  perfil: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c.8-4.5 4-6.5 8-6.5s7.2 2 8 6.5" />
    </>
  ),
}

export const ICONE_POR_SIMBOLO = {
  '▦': 'inicio',
  '▤': 'lista',
  '◷': 'relogio',
  '◍': 'pessoas',
  '◎': 'perfil',
  '◔': 'sino',
}

export default function Icone({ nome }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {DESENHOS[nome]}
    </svg>
  )
}
