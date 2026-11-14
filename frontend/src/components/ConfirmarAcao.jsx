import Modal from './Modal'

/**
 * EXTRA — fora dos requisitos do documento: confirmação antes de uma ação sem volta.
 *
 * Sinalizar uma entrega como pronta, aprovar e enviar à banca mudam o estado da
 * entrega de um jeito que o sistema não desfaz (RN06), então a pessoa confirma antes,
 * lendo o que vai acontecer. Só a tela muda: as regras e a API são as mesmas.
 *
 * `pedido` é `{ titulo, texto, rotulo }`, ou null quando não há nada a confirmar.
 */
export default function ConfirmarAcao({ pedido, aoCancelar, aoConfirmar }) {
  if (!pedido) return null

  return (
    <Modal titulo={pedido.titulo} aoFechar={aoCancelar}>
      <p className="confirmar-texto">{pedido.texto}</p>
      <div className="barra-acoes">
        <button type="button" onClick={aoConfirmar} autoFocus>
          {pedido.rotulo}
        </button>
        <button type="button" className="contorno" onClick={aoCancelar}>
          Cancelar
        </button>
      </div>
    </Modal>
  )
}
