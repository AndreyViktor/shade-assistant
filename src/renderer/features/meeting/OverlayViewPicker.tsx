import { PanelIcon } from '../../ui/PanelIcon';

const views = [
  {
    id: 'complete',
    name: 'Completa',
    label: 'Visualização completa',
    icon: 'columns2',
  },
  {
    id: 'transcript',
    name: 'Transcrição',
    label: 'Só transcrição',
    icon: 'scrollText',
  },
  {
    id: 'assistance',
    name: 'Assistência',
    label: 'Só assistência',
    icon: 'sparkles',
  },
] as const;

export type OverlayMode = (typeof views)[number]['id'];

export function OverlayViewPicker({
  selected,
  onChange,
}: {
  selected: OverlayMode;
  onChange?: (view: OverlayMode) => void;
}) {
  return (
    <fieldset className="overlay-mode-picker">
      <legend className="visually-hidden">Visualização do overlay</legend>
      <div className="overlay-mode-actions">
        {views.map(({ id, name, label, icon }) => (
          <button
            key={id}
            type="button"
            aria-label={label}
            aria-pressed={selected === id}
            onClick={() => onChange?.(id)}
          >
            <PanelIcon name={icon} />
            {name}
            <span className="overlay-mode-tooltip" aria-hidden="true">
              {label}
            </span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
