// a staging release may go to production once a device installed it and none of them failed....
export type StagingGate = { passed: boolean; reason: "untested" | "failing" | null };

export function stagingGate(updated: number, failed: number): StagingGate {
  if (failed > 0) return { passed: false, reason: "failing" };
  if (updated < 1) return { passed: false, reason: "untested" };
  return { passed: true, reason: null };
}

// the default changelog a release gets when none was written....
export function isPlaceholderChangelog(changelog?: string | null): boolean {
  const text = (changelog ?? "")
    .replace(/^#+\s*/gm, "")
    .trim()
    .toLowerCase();
  return text === "" || text === "what's new" || text === "whats new";
}
