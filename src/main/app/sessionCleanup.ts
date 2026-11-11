const cleanups = new Set<() => Promise<void>>();

export function trackSessionCleanup(cleanup: () => Promise<void>): () => void {
  cleanups.add(cleanup);
  return () => {
    cleanups.delete(cleanup);
  };
}

export async function cleanupSessions(): Promise<void> {
  await Promise.allSettled([...cleanups].map((cleanup) => cleanup()));
}
