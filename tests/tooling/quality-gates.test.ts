// @vitest-environment node
import { resolve } from 'node:path';
import { ESLint } from 'eslint';
import * as prettier from 'prettier';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

describe('ESLint quality gates', () => {
  const eslint = new ESLint();

  it.each([
    [
      'unused variables',
      'const unused = 1;',
      '@typescript-eslint/no-unused-vars',
    ],
    [
      'explicit any',
      'export const value: any = 1;',
      '@typescript-eslint/no-explicit-any',
    ],
    [
      'floating promises',
      'Promise.resolve(1);',
      '@typescript-eslint/no-floating-promises',
    ],
    [
      'non-null assertions',
      'export const value = document.body.parentElement!;',
      '@typescript-eslint/no-non-null-assertion',
    ],
    [
      'conditional hooks',
      "import { useState } from 'react'; export function Probe({ enabled }: { enabled: boolean }) { if (enabled) useState(0); return null; }",
      'react-hooks/rules-of-hooks',
    ],
  ])('rejects %s', async (_label, source, ruleId) => {
    const results = await eslint.lintText(source, {
      filePath: 'src/renderer/app/App.tsx',
    });
    expect(results.flatMap((result) => result.messages)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId, severity: 2 }),
      ]),
    );
  });

  it('accepts typed code without suppressions', async () => {
    const results = await eslint.lintText('export const value: number = 1;\n', {
      filePath: 'src/renderer/app/App.tsx',
    });
    expect(results.flatMap((result) => result.messages)).toEqual([]);
  });
});

describe('TypeScript quality gates', () => {
  it.each(['node', 'renderer', 'tooling'])(
    'enforces strict checks in %s',
    (target) => {
      const configPath = resolve(`tsconfig.${target}.json`);
      const parsed = ts.getParsedCommandLineOfConfigFile(
        configPath,
        {},
        {
          ...ts.sys,
          onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
            throw new Error(
              ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
            );
          },
        },
      );
      if (!parsed) throw new Error(`Cannot read ${configPath}`);
      expect(parsed.errors).toEqual([]);

      // Compile only an in-memory probe with the actual inherited project options.
      const filename = resolve('quality-probe.ts');
      const source = [
        'export function implicit(value) { return value; }',
        'export const indexed: string = ([] as string[])[0];',
        'try {} catch (error) { error.message; }',
      ].join('\n');
      const host = ts.createCompilerHost(parsed.options);
      const getSourceFile = host.getSourceFile.bind(host);
      host.getSourceFile = (
        path,
        languageVersion,
        onError,
        shouldCreateNewSourceFile,
      ) =>
        path === filename
          ? ts.createSourceFile(path, source, languageVersion, true)
          : getSourceFile(
              path,
              languageVersion,
              onError,
              shouldCreateNewSourceFile,
            );
      const program = ts.createProgram([filename], parsed.options, host);
      const codes = ts
        .getPreEmitDiagnostics(program)
        .map((diagnostic) => diagnostic.code);
      expect(codes).toEqual(expect.arrayContaining([7006, 2322, 18046]));
    },
  );
});

describe('Prettier quality gate', () => {
  it('rejects unformatted code and accepts the configured output', async () => {
    const options = {
      ...(await prettier.resolveConfig('src/renderer/app/App.tsx')),
      filepath: 'src/renderer/app/App.tsx',
    };
    const source = 'export const label="DEMO"';
    expect(await prettier.check(source, options)).toBe(false);
    const formatted = await prettier.format(source, options);
    expect(formatted).toBe("export const label = 'DEMO';\n");
    expect(await prettier.check(formatted, options)).toBe(true);
  });
});
