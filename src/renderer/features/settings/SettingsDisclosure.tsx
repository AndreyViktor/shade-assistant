import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Preferences } from '../../../contracts/settings/preferences';
import { SettingsPanel } from './SettingsPanel';

export function SettingsDisclosure({
  children,
  onSaved,
  diagnostics,
  connection,
  sessionSummary,
  demoSummary,
  showToggle = true,
}: {
  children?: ReactNode;
  diagnostics?: ReactNode;
  connection?: ReactNode;
  sessionSummary?: string;
  demoSummary?: string;
  showToggle?: boolean;
  onSaved?: (preferences: Preferences) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [visited, setVisited] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!expanded && visited) toggle.current?.focus();
  }, [expanded, visited]);

  function close() {
    setExpanded(false);
  }

  return (
    <>
      <div className="operation-panel" hidden={expanded}>
        {children}
        {showToggle && (
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
        )}
      </div>
      <div id="panel-settings" hidden={!expanded}>
        {visited && (
          <SettingsPanel
            active={expanded}
            onSaved={onSaved}
            connection={connection}
            diagnostics={diagnostics}
            sessionSummary={sessionSummary}
            demoSummary={demoSummary}
            onClose={close}
          />
        )}
      </div>
    </>
  );
}
