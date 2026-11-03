import { isBuiltin } from 'node:module';
import { dirname, relative, resolve, sep } from 'node:path';

const allowedLayers = {
  contracts: ['contracts'],
  core: ['core', 'contracts'],
  infrastructure: ['infrastructure', 'core', 'contracts'],
  main: ['main', 'infrastructure', 'core', 'contracts'],
  preload: ['preload', 'contracts'],
  renderer: ['renderer', 'contracts'],
};

const allowedPackages = {
  contracts: [],
  core: [],
  infrastructure: [],
  main: ['electron'],
  preload: ['electron'],
  renderer: ['react', 'react-dom', 'vite'],
};

function packageName(specifier) {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

export default {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      forbidden:
        'Import não permitido pela fronteira de {{layer}}: {{source}}.',
      dynamic: 'Imports/require devem usar um caminho literal verificável.',
    },
  },
  create(context) {
    const sourceRoot = resolve(context.cwd, 'src');
    const filename = context.filename;
    const layer = relative(sourceRoot, filename).split(sep)[0];
    if (!Object.hasOwn(allowedLayers, layer)) return {};
    const isTest = /\.test\.tsx?$/.test(filename);

    function check(node, source) {
      if (!source || typeof source.value !== 'string') {
        context.report({ node, messageId: 'dynamic' });
        return;
      }
      const specifier = source.value;
      let allowed;
      if (specifier.startsWith('.')) {
        // Normalize traversal so renderer/../main and re-exports cannot bypass it.
        const target = resolve(dirname(filename), specifier);
        const targetLayer = relative(sourceRoot, target).split(sep)[0];
        allowed = allowedLayers[layer].includes(targetLayer);
      } else {
        const pkg = packageName(specifier);
        allowed =
          allowedPackages[layer].includes(pkg) ||
          (['main', 'infrastructure'].includes(layer) &&
            isBuiltin(specifier)) ||
          (isTest && ['vitest', '@testing-library/react'].includes(pkg));
      }
      if (!allowed) {
        context.report({
          node,
          messageId: 'forbidden',
          data: { layer, source: specifier },
        });
      }
    }

    return {
      ImportDeclaration: (node) => check(node, node.source),
      ExportNamedDeclaration: (node) => {
        if (node.source) check(node, node.source);
      },
      ExportAllDeclaration: (node) => check(node, node.source),
      ImportExpression: (node) => check(node, node.source),
      TSImportType: (node) => check(node, node.source),
      TSExternalModuleReference: (node) => check(node, node.expression),
      CallExpression: (node) => {
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'require'
        ) {
          check(node, node.arguments[0]);
        }
      },
    };
  },
};
