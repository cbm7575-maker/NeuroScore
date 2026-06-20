const KEY = "neuroscore_script_unlocked";
const HOOK_KEY = "neuroscore_selected_hook";

export function isScriptUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(KEY) === "1";
}

export function unlockScript(hook: string): void {
  sessionStorage.setItem(KEY, "1");
  sessionStorage.setItem(HOOK_KEY, hook);
}

export function getSelectedHook(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(HOOK_KEY);
}
