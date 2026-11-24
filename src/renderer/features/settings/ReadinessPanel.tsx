import { useState } from 'react';
import type {
  PermissionSettingsTarget,
  PreflightState,
  ReadinessItem,
  ReadinessSnapshot,
} from '../../../contracts/ipc/readiness';

const STATE_LABELS: Record<PreflightState, string> = {
  'not-requested': 'Não solicitado',
  allowed: 'Permitido',
  denied: 'Negado',
  restricted: 'Restrito',
  unavailable: 'Indisponível',
};

const ITEMS: Array<{
  key: keyof Pick<
    ReadinessSnapshot,
    'microphone' | 'systemAudio' | 'speechRecognition' | 'helper'
  >;
  label: string;
  target?: PermissionSettingsTarget;
}> = [
  { key: 'microphone', label: 'Microfone', target: 'microphone' },
  {
    key: 'systemAudio',
    label: 'Áudio do sistema e gravação de tela',
    target: 'screen-recording',
  },
  {
    key: 'speechRecognition',
    label: 'Reconhecimento de fala (Speech)',
    target: 'speech-recognition',
  },
  { key: 'helper', label: 'Helper assinado' },
];

export function ReadinessPanel({
  onSummaryChange,
}: {
  onSummaryChange?: (summary: string) => void;
}) {
  const [snapshot, setSnapshot] = useState<ReadinessSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    'A prontidão ainda não foi verificada nesta abertura.',
  );

  async function check() {
    setBusy(true);
    setMessage('Verificando sem iniciar captura…');
    try {
      const result = await window.meetingCopilot.getReadiness();
      if (!result.ok || result.action !== 'check')
        throw new Error('UNAVAILABLE');
      setSnapshot(result.readiness);
      onSummaryChange?.('Verificado');
      setMessage('Prontidão rechecada. Nenhuma captura foi iniciada.');
    } catch {
      onSummaryChange?.('Falha na verificação');
      setMessage('Não foi possível rechecá-la. Nenhuma captura foi iniciada.');
    } finally {
      setBusy(false);
    }
  }

  async function open(target: PermissionSettingsTarget) {
    setBusy(true);
    setMessage('Abrindo os Ajustes do macOS…');
    try {
      const result = await window.meetingCopilot.openPermissionSettings(target);
      if (!result.ok || result.action !== 'open-settings')
        throw new Error('UNAVAILABLE');
      setMessage(
        'Ajustes abertos explicitamente. Nenhuma captura foi iniciada; rechecque após alterar a permissão.',
      );
    } catch {
      setMessage(
        'Não foi possível abrir os Ajustes. Nenhuma captura foi iniciada.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="readiness" aria-labelledby="readiness-title">
      <h3 id="readiness-title">Prontidão da sessão</h3>
      <p>
        A consulta usa o processo nativo{' '}
        <strong>MeetingCopilotTranscriber</strong>. No desenvolvimento, o macOS
        pode atribuir permissões também ao Electron, Terminal ou IDE. Confira o
        processo exibido nos Ajustes do macOS.
      </p>
      <p>
        Verificar ou abrir Ajustes não pede permissão, não liga microfone, não
        captura áudio/tela e não inicia uma sessão.
      </p>
      <p role="status">{message}</p>
      <button type="button" disabled={busy} onClick={() => void check()}>
        {snapshot ? 'Rechecar prontidão' : 'Verificar prontidão'}
      </button>
      {snapshot && (
        <ul className="readiness-list">
          {ITEMS.map((definition) => {
            const item = snapshot[definition.key];
            const target = definition.target;
            return (
              <li key={definition.key}>
                <div>
                  <strong>{definition.label}</strong>
                  <span>{itemLabel(item)}</span>
                  {definition.key === 'systemAudio' &&
                    item.detail === 'screen-preflight-ambiguous' && (
                      <small>
                        O preflight público do macOS não diferencia primeira
                        solicitação de uma negativa anterior.
                      </small>
                    )}
                  {definition.key === 'helper' && snapshot.helperIdentity && (
                    <small>
                      Identidade: {snapshot.helperIdentity.signingIdentifier} (
                      {snapshot.helperIdentity.signature === 'no-team'
                        ? 'sem identificador de equipe'
                        : 'com identificador de equipe'}
                      ).
                    </small>
                  )}
                </div>
                {target && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void open(target)}
                  >
                    Abrir Ajustes de {definition.label}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function itemLabel(item: ReadinessItem): string {
  if (item.detail === 'screen-preflight-ambiguous' && item.state === 'denied')
    return 'Não permitido ou ainda não solicitado';
  return STATE_LABELS[item.state];
}
