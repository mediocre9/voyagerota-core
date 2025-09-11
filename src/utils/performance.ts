type AsyncFn = () => Promise<void>;
type SyncFn = () => void;

export async function measurePerfomanceAsAsync(fn: AsyncFn): Promise<number> {
  const startTime = performance.now();
  await fn();
  const elapsedTime = performance.now() - startTime;
  return elapsedTime;
}

export function measurePerfomanceAsSync(fn: SyncFn): number {
  const startTime = performance.now();
  fn();
  const elapsedTime = performance.now() - startTime;
  return elapsedTime;
}
