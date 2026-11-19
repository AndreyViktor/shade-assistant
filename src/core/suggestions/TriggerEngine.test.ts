import { describe, expect, it } from 'vitest';
import { TriggerEngine } from './TriggerEngine';
import type { SpeechSegment } from '../../contracts/meeting/localTranscript';
import type { TriggerInput } from './TriggerEngine';

function speech(text: string): SpeechSegment {
  return {
    version: 1,
    sessionId: 'synthetic',
    seq: 1,
    source: 'system',
    locale: 'pt-BR',
    timestampMs: 1000,
    type: 'final',
    segmentId: 'one',
    startMs: 0,
    endMs: 1000,
    text,
  };
}

describe('TriggerEngine — synthetic pt-BR utterances', () => {
  const engine = new TriggerEngine();

  it.each([
    'Que riscos temos ao migrar esse módulo?',
    'Qual é o prazo para a entrega?',
    'Quais alternativas temos',
    'Quanto custa a migração?',
    'Quem vai revisar a proposta?',
    'Onde podemos consultar os requisitos?',
    'Por que o prazo mudou?',
    'Como podemos evitar perda de dados?',
    'Quando será a entrega?',
    'Você pode explicar o impacto?',
    'Pode repetir?',
    'O que acha da proposta?',
    'Vocês recomendam adiar a entrega?',
    'Bom dia! Tudo bem? Qual é o prazo?',
    '  QUAIS   OPÇÕES temos para a migração  ',
    'Voce\u0302 pode confirmar o prazo',
  ])('detects a direct question: %s', (text) => {
    expect(engine.evaluate(speech(text))).toBe('question');
  });

  it.each([
    'Não concordo com esse prazo.',
    'Discordo da proposta.',
    'Mas não podemos entregar sem os testes.',
    'Não conseguimos acessar o ambiente.',
    'Isso não atende aos requisitos.',
    'Essa proposta é inviável.',
    'Há um risco de perda de dados.',
    'Temos um impedimento na integração.',
    'Estamos bloqueados pela dependência.',
    'Falta confirmar o orçamento.',
    'Precisamos esclarecer os critérios de aceite.',
  ])('detects an objection or missing necessary information: %s', (text) => {
    expect(engine.evaluate(speech(text))).toBe('objection');
  });

  it.each([
    'Eu vou enviar a proposta amanhã.',
    'Vamos revisar o contrato.',
    'Precisamos definir o responsável.',
    'Nós devemos confirmar a entrega.',
    'Me comprometo a entregar o relatório.',
    'Fico responsável por validar a migração.',
    'O prazo é sexta-feira.',
    'A entrega ficou para amanhã.',
    'Ficou decidido que vamos adiar a migração.',
    'Vou revisar para não atrasar a entrega.',
  ])('detects a commitment to confirm, not an established fact: %s', (text) => {
    expect(engine.evaluate(speech(text))).toBe('commitment');
  });

  it.each([
    '',
    '   ',
    '... ???',
    'Hum, ah, é...',
    'Bom dia!',
    'Tudo bem?',
    'Como você está?',
    'Qual é o seu nome?',
    'Que horas são?',
    'Tudo certo. Obrigado!',
    'Acho que sim, né?',
    'Legal?',
    'Qual?',
    'O documento tem uma seção chamada riscos.',
    'Falamos de prazo e compromisso ontem.',
    'O risco foi resolvido.',
    'Não há risco de perda de dados.',
    'Não vou enviar a proposta.',
    'Não precisamos definir outro prazo.',
    'Se fosse necessário, eu enviaria o relatório.',
    'Vamos tomar um café.',
    'Como combinado, a revisão terminou.',
    'Quando terminar, eu aviso.',
    'Ele perguntou qual era o prazo.',
    'Mudando de assunto, gostei do almoço.',
  ])('deliberately remains silent: %s', (text) => {
    expect(engine.evaluate(speech(text))).toBe('none');
  });

  it.each([
    ['Vou entregar amanhã. Não concordo com o prazo.', 'objection'],
    ['Não concordo. Qual alternativa temos?', 'question'],
    ['Vou revisar. Pode confirmar a data?', 'question'],
  ] as const)('uses deterministic precedence: %s', (text, expected) => {
    expect(engine.evaluate(speech(text))).toBe(expected);
  });

  it('waits for a final instead of treating interrupted hypotheses as a trigger', () => {
    const partial = { ...speech('Qual é o prazo?'), type: 'partial' as const };
    expect(engine.evaluate(partial)).toBe('none');
    expect(engine.evaluate({ ...partial, text: 'Não concordo.' })).toBe('none');
    expect(engine.evaluate({ ...partial, text: 'Vou entregar amanhã.' })).toBe(
      'none',
    );
    expect(
      engine.evaluate(speech('Obrigado, já encontrei a informação.')),
    ).toBe('none');
    expect(engine.evaluate(speech('Qual é o prazo?'))).toBe('question');
  });

  const envelope = {
    version: 1,
    sessionId: 'synthetic',
    seq: 2,
    source: 'system',
    locale: 'pt-BR',
    timestampMs: 2000,
  } as const;
  it.each<TriggerInput>([
    { type: 'silence' },
    { ...envelope, type: 'ready', supportsPartial: true },
    { ...envelope, type: 'status', state: 'listening' },
    { ...envelope, type: 'status', state: 'paused' },
    { ...envelope, type: 'error', code: 'capture-failed' },
    { ...envelope, type: 'stopped', reason: 'completed' },
  ])('ignores non-speech input: $type', (input) => {
    expect(engine.evaluate(input)).toBe('none');
  });

  it('allows manual requests with no speech and following any automatic outcome', () => {
    expect(engine.evaluate({ type: 'manual' })).toBe('manual');
    for (const text of [
      'Qual é o prazo?',
      'Discordo.',
      'Vou revisar.',
      'Obrigado.',
    ]) {
      engine.evaluate(speech(text));
      expect(engine.evaluate({ type: 'manual' })).toBe('manual');
    }
  });

  it('does not infer speaker identity or mutate the transcript', () => {
    const event = Object.freeze(speech('Qual é o prazo?'));
    expect(engine.evaluate(event)).toBe('question');
    expect(engine.evaluate({ ...event, source: 'mic' })).toBe('question');
    expect(event).toEqual(speech('Qual é o prazo?'));
  });

  it.each([
    ['What is the deadline?', 'question'],
    ["We don't agree with this deadline.", 'objection'],
    ['We need to define the owner.', 'commitment'],
    ['We are discussing the delivery.', 'none'],
    ['How are you?', 'none'],
    ['Qual é o prazo?', 'none'],
  ] as const)('classifies supported English sessions: %s', (text, expected) => {
    expect(engine.evaluate({ ...speech(text), locale: 'en-US' })).toBe(
      expected,
    );
  });

  it('does not retain old questions or schedule automatic retries during silence', () => {
    expect(engine.evaluate(speech('Qual é o prazo?'))).toBe('question');
    for (let i = 0; i < 100; i += 1) {
      expect(engine.evaluate({ type: 'silence' })).toBe('none');
    }
    expect(engine.evaluate(speech('Certo, obrigado.'))).toBe('none');
    // T023 owns deduplication; classification itself remains deterministic.
    expect(engine.evaluate(speech('Qual é o prazo?'))).toBe('question');
  });
});
