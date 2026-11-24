/**
 * US17 (CA2) — mensagem de quando o filtro ou a busca não encontram nada, com a opção de
 * limpar os dois e voltar à lista inteira.
 */
export default function SemResultados({ aoLimpar, texto = 'Troque o filtro ou limpe a busca para ver tudo de novo.' }) {
  return (
    <div className="vazio vazio-compacto">
      <strong>Nenhum resultado</strong>
      <span>{texto}</span>
      <div>
        <button type="button" className="contorno" onClick={aoLimpar}>
          Limpar filtros
        </button>
      </div>
    </div>
  )
}
