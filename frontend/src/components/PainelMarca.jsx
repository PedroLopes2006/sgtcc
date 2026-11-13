/**
 * Painel de marca das telas de entrar e criar conta. Só aparece em telas largas
 * (veja `.painel-marca` em styles.css); no celular o formulário fica sozinho.
 */
export default function PainelMarca() {
  return (
    <section className="painel-marca" aria-label="Sobre o SGTCC">
      <span className="marca-nome">SGTCC</span>
      <p className="marca-lema">Sistema de Gestão de TCC</p>
      <ul>
        <li>Tema, entregas e versões em um só lugar.</li>
        <li>Revisão com comentários ligados a cada versão.</li>
        <li>Linha do tempo de tudo o que acontece no trabalho.</li>
      </ul>
    </section>
  )
}
