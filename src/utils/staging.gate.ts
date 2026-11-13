// a staging release may go to production once a staging device installed it successfully....
export type StagingGate = { passed: boolean };

export function stagingGate(updated: number): StagingGate {
  return { passed: updated >= 1 };
}

// the default changelog a release gets when none was written....
export function isPlaceholderChangelog(changelog?: string | null): boolean {
  const text = (changelog ?? "")
    .replace(/^#+\s*/gm, "")
    .trim()
    .toLowerCase();
  return text === "" || text === "what's new" || text === "whats new";
}
