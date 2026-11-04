// @vitest-environment node
import { ESLint } from 'eslint';
import { dirname, relative } from 'node:path';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';

describe('module boundaries', () => {
  // Virtual files exercise the production rule without introducing illegal product imports.
  // Type-aware rules are covered separately; these fixtures intentionally import missing modules.
  const eslint = new ESLint({
    overrideConfig: [tseslint.configs.disableTypeChecked],
  });

  const layers = [
    ['contracts', 'meeting/suggestion.ts', ['contracts']],
    ['core', 'suggestions/SuggestionStore.ts', ['core', 'contracts']],
    [
      'infrastructure',
      'transcription/mock/DemoPlayback.ts',
      ['infrastructure', 'core', 'contracts'],
    ],
    [
      'main',
      'ipc/registerSessionIpc.ts',
      ['main', 'infrastructure', 'core', 'contracts'],
    ],
    ['preload', 'createMeetingCopilotApi.ts', ['preload', 'contracts']],
    ['renderer', 'features/meeting/DemoPreview.tsx', ['renderer', 'contracts']],
  ] as const;
  const matrix = layers.flatMap(([from, file, permitted]) =>
    layers.flatMap(([to, target]) =>
      [false, true].map((isTest) => ({
        from,
        to,
        isTest,
        file: `src/${from}/${isTest ? file.replace(/\.tsx?$/, '.test.ts') : file}`,
        target: `src/${to}/${target}`,
        allowed: permitted.some((layer) => layer === to),
      })),
    ),
  );

  it.each(matrix)(
    '$from → $to (test=$isTest): enforces the layer matrix for nested feature files',
    async ({ file, target, allowed }) => {
      const path = relative(dirname(file), target).replace(/\.tsx?$/, '');
      const specifier = JSON.stringify(
        path.startsWith('.') ? path : `./${path}`,
      );
      for (const source of [
        `import ${specifier};`,
        `export * from ${specifier};`,
        `export type Probe = import(${specifier}).Probe;`,
        `import(${specifier});`,
        `require(${specifier});`,
      ]) {
        const results = await eslint.lintText(source, { filePath: file });
        const messages = results.flatMap((result) => result.messages);
        expect(
          messages.some((message) => message.fatal),
          source,
        ).toBe(false);
        const violations = messages.filter(
          (message) => message.ruleId === 'architecture/module-boundaries',
        );
        expect(violations, source).toHaveLength(allowed ? 0 : 1);
        if (!allowed) {
          expect(violations[0]).toMatchObject({
            severity: 2,
            messageId: 'forbidden',
          });
        }
      }
    },
  );

  it.each([
    ['core', "import 'electron';"],
    ['core', "import 'react';"],
    ['core', "import 'openai';"],
    ['core', "import 'node:fs';"],
    ['core', "import '../infrastructure/adapter';"],
    ['core', "import '../renderer/app/App';"],
    ['contracts', "import '../core/domain';"],
    ['contracts', "import '../main/index';"],
    ['contracts', "import 'electron';"],
    ['contracts', "import 'react';"],
    ['infrastructure', "import '../main/index';"],
    ['infrastructure', "import '../preload/index';"],
    ['infrastructure', "import 'react';"],
    ['main', "import '../renderer/app/App';"],
    ['main', "import '../preload/index';"],
    ['preload', "import '../main/index';"],
    ['preload', "import '../infrastructure/adapter';"],
    ['preload', "import '../core/domain';"],
    ['preload', "import 'node:fs';"],
    ['renderer', "import '../main/index';"],
    ['renderer', "import '../infrastructure/adapter';"],
    ['renderer', "import '../core/domain';"],
    ['renderer', "import '../preload/index';"],
    ['renderer', "import 'node:fs';"],
    ['renderer', "import 'fs/promises';"],
    ['renderer', "import 'electron/renderer';"],
    ['renderer', "import 'openai/resources';"],
    ['renderer', "export * from '../main/index';"],
    ['renderer', "export { value } from '../infrastructure/adapter';"],
    ['renderer', "import('../main/index');"],
    ['renderer', "require('../main/index');"],
    ['renderer', "import secret = require('../main/index');"],
    ['renderer', "export type Secret = import('../main/index').Secret;"],
    ['renderer', "import '../renderer/../main/index';"],
    ['renderer', "import '@/main/index';"],
    ['renderer', "import name from '/tmp/outside';"],
    ['renderer', "import '../../outside';"],
    ['renderer', 'import(variable);'],
    ['renderer', 'require(variable);'],
  ])('rejects %s: %s', async (layer, source) => {
    const results = await eslint.lintText(source, {
      filePath: `src/${layer}/boundary-probe.ts`,
    });
    const messages = results.flatMap((result) => result.messages);
    expect(messages.some((message) => message.fatal)).toBe(false);
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'architecture/module-boundaries',
          severity: 2,
        }),
      ]),
    );
  });

  it.each([
    ['contracts', "import './ipc/appStatus';"],
    ['core', "import '../contracts/ipc/appStatus';"],
    ['infrastructure', "import '../core/domain'; import 'node:fs';"],
    [
      'main',
      "import '../infrastructure/adapter'; import 'electron'; import 'node:path';",
    ],
    ['preload', "import '../contracts/ipc/appStatus'; import 'electron';"],
    [
      'renderer',
      "import '../contracts/ipc/appStatus'; import 'react'; import 'react-dom/client';",
    ],
    [
      'renderer',
      "export type Api = import('../contracts/ipc/appStatus').MeetingCopilotApi;",
    ],
    ['renderer', "import('./app/App');"],
  ])('allows %s: %s', async (layer, source) => {
    const results = await eslint.lintText(source, {
      filePath: `src/${layer}/boundary-probe.ts`,
    });
    const messages = results.flatMap((result) => result.messages);
    expect(messages.some((message) => message.fatal)).toBe(false);
    expect(
      messages.filter(
        (message) => message.ruleId === 'architecture/module-boundaries',
      ),
    ).toEqual([]);
  });
});
