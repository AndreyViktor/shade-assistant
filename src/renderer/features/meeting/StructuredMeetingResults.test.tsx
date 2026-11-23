import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { StructuredMeetingResults } from './StructuredMeetingResults';

it('labels facts/inferences and points every result to speech and time', () => {
  render(
    <StructuredMeetingResults
      snapshot={{
        items: [
          {
            key: 'lancamento-sexta',
            kind: 'decision',
            text: 'Lançar na sexta.',
            groundedIn: 'meeting',
            evidence: [
              {
                source: 'system',
                segmentId: 'one',
                startMs: 61_000,
                endMs: 62_500,
                text: 'Decidimos lançar na sexta.',
                truncated: false,
              },
            ],
          },
          {
            key: 'risco-prazo',
            kind: 'risk',
            text: 'O prazo pode estar apertado.',
            groundedIn: 'inference',
            evidence: [
              {
                source: 'mic',
                segmentId: 'two',
                startMs: 63_000,
                endMs: 64_000,
                text: 'Temos pouco tempo.',
                truncated: true,
              },
            ],
          },
        ],
      }}
    />,
  );
  const region = screen.getByRole('region', {
    name: 'Resultados estruturados da reunião',
  });
  expect(within(region).getByText('Fato da reunião')).toBeVisible();
  expect(within(region).getByText('Inferência a confirmar')).toBeVisible();
  for (const summary of within(region).getAllByText('1 fala de suporte'))
    fireEvent.click(summary);
  expect(
    within(region).getByText(
      (_text, element) => element?.textContent === 'Sistema · 01:01–01:02',
    ),
  ).toBeVisible();
  expect(within(region).getByText('Decidimos lançar na sexta.')).toBeVisible();
  expect(within(region).getByText('Temos pouco tempo.…')).toBeVisible();
  fireEvent.click(within(region).getByText('Como estes resultados mudam?'));
  expect(within(region).getByText(/Nada é salvo por padrão/)).toBeVisible();
});

it('shows an explicit empty state without inventing content', () => {
  render(<StructuredMeetingResults snapshot={{ items: [] }} />);
  expect(
    screen.getByText(/Ainda não há fatos ou inferências com evidência/),
  ).toBeVisible();
});
