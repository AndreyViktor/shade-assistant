import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { PanelIcon } from '../../ui/PanelIcon';
import type { Preferences } from '../../../contracts/settings/preferences';
import { SettingsPanel } from './SettingsPanel';

export function SettingsDisclosure({
  children,
  onSaved,
  diagnostics,
  connection,
  sessionSummary,
  demoSummary,
}: {
  children: (preferencesButton: ReactNode) => ReactNode;
  diagnostics?: ReactNode;
  connection?: ReactNode;
  sessionSummary?: string;
  demoSummary?: string;
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
        {children(
          <button
            ref={toggle}
            type="button"
            className="preferences-button"
            aria-expanded={expanded}
            aria-controls="panel-settings"
            onClick={() => {
              setVisited(true);
              setExpanded(true);
            }}
          >
            <PanelIcon name="settings2" />
            Preferências
          </button>,
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
