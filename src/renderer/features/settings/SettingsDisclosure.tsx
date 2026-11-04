import { useRef, useState } from 'react';
import { SettingsPanel } from './SettingsPanel';

export function SettingsDisclosure() {
  const [expanded, setExpanded] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);

  function close() {
    setExpanded(false);
    toggle.current?.focus();
  }

  return (
    <div className="settings-disclosure">
      <button
        ref={toggle}
        aria-expanded={expanded}
        aria-controls="panel-settings"
        onClick={() => setExpanded(!expanded)}
      >
        Preferências
        <span aria-hidden="true">{expanded ? ' −' : ' +'}</span>
      </button>
      <div
        id="panel-settings"
        hidden={!expanded}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !event.defaultPrevented) {
            event.stopPropagation();
            close();
          }
        }}
      >
        <SettingsPanel />
        <button onClick={close}>Voltar ao painel</button>
      </div>
    </div>
  );
}
