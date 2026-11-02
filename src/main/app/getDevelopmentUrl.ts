export function getDevelopmentUrl(
  isPackaged: boolean,
  value: string | undefined,
): string | undefined {
  if (isPackaged || !value) return undefined;

  const url = new URL(value);
  if (
    url.origin !== 'http://127.0.0.1:5173' ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error('Endereço de desenvolvimento não permitido.');
  }
  return url.href;
}
