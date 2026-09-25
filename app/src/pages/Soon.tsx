import { VIEW_LABEL } from '../components/Layout'
import type { View } from '../state/permissions'

const WHAT: Partial<Record<View, string>> = {
  sala: 'Pianta 2D delle sale, stato dei tavoli durante il servizio, assegnazione trascinando le prenotazioni e modifica della pianta.',
  calendario: 'Vista del mese con i coperti di ogni giorno, chiusure e percentuale di no-show.',
  fidelity: 'Programma fedeltà: iscritti, punti, premi, livelli e regole personalizzabili.',
  impostazioni: 'Orari, chiusure, sconti, regole di prenotazione ed email.',
  modulo: 'Anteprima del modulo di prenotazione per i clienti.',
}

/** Placeholder for screens not yet ported from the prototype. */
export function Soon({ view }: { view: View }) {
  return (
    <>
      <header className="top"><h1>{VIEW_LABEL[view]}</h1></header>
      <main className="view">
        <section className="card card-b soon">
          <div className="eyebrow" style={{ marginBottom: 6 }}>In arrivo</div>
          <p style={{ margin: 0, lineHeight: 1.6 }}>{WHAT[view]}</p>
          <p className="hint" style={{ marginTop: 10 }}>Questa schermata è già pronta nel prototipo e viene portata nell'app nel prossimo passaggio.</p>
        </section>
      </main>
    </>
  )
}
