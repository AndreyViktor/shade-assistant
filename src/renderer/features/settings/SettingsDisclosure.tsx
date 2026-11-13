import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Preferences } from '../../../contracts/settings/preferences';
import { SettingsPanel } from './SettingsPanel';

export function SettingsDisclosure({
  children,
  onSaved,
}: {
  children?: ReactNode;
  onSaved?: (preferences: Preferences) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [visited, setVisited] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const back = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (expanded) back.current?.focus();
    else if (visited) toggle.current?.focus();
  }, [expanded, visited]);

  function close() {
    setExpanded(false);
  }

  return (
    <>
      <div hidden={expanded}>
        {children}
        <div className="settings-disclosure">
          <button
            ref={toggle}
            aria-expanded={expanded}
            aria-controls="panel-settings"
            onClick={() => {
              setVisited(true);
              setExpanded(true);
            }}
          >
            Preferências
          </button>
        </div>
      </div>
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
        <button ref={back} onClick={close}>
          Voltar ao painel
        </button>
        <p>
          Ao navegar, a sessão continua no estado atual. As escolhas salvas
          valem para a próxima sessão.
        </p>
        {visited && <SettingsPanel active={expanded} onSaved={onSaved} />}
      </div>
    </>
  );
}
