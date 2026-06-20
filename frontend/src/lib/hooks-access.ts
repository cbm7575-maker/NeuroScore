const KEY = "neuroscore_hooks_unlocked";

export function isHooksUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(KEY) === "1";
}

export function unlockHooks(): void {
  sessionStorage.setItem(KEY, "1");
}
