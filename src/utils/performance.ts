type AsyncFn = () => Promise<void>;
type SyncFn = () => void;

export async function computeElapsedTimeAsync(fn: AsyncFn): Promise<number> {
  const startTime = performance.now();
  await fn();
  const elapsedTime = performance.now() - startTime;
  return elapsedTime;
}

export function computeElapsedTimeSync(fn: SyncFn): number {
  const startTime = performance.now();
  fn();
  const elapsedTime = performance.now() - startTime;
  return elapsedTime;
}
