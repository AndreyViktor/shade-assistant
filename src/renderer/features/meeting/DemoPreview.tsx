import type { DemoSnapshot } from '../../../contracts/meeting/demo';
import type { SessionPhase } from '../../../contracts/meeting/session';

export function DemoPreview({
  demo,
  phase,
}: {
  demo: DemoSnapshot;
  phase: SessionPhase;
}) {
  if (phase === 'idle' || phase === 'stopped') return null;
  return (
    <section
      className="demo-preview"
      aria-label="Roteiro DEMO"
      aria-live="polite"
    >
      <h3>Transcrição simulada</h3>
      {demo.transcript ? (
        <>
          <p>
            Fonte simulada:{' '}
            {demo.transcript.source === 'mic' ? 'microfone' : 'sistema'} ·{' '}
            {demo.transcript.locale} · fala {demo.transcript.sequence}
          </p>
          <p>{demo.transcript.text}</p>
        </>
      ) : (
        <p>Aguardando fala simulada…</p>
      )}
      <h3>Sugestão simulada</h3>
      <p>{demo.suggestion?.text ?? 'Nenhuma sugestão neste momento.'}</p>
      {phase === 'paused' && (
        <p>Roteiro pausado. Retomar continua da próxima etapa.</p>
      )}
      {demo.completed && (
        <p>Roteiro concluído. Use Parar e Iniciar DEMO para repetir.</p>
      )}
    </section>
  );
}
