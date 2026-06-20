"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isHooksUnlocked } from "@/lib/hooks-access";
import { unlockScript } from "@/lib/script-access";

const PLACEHOLDER_HOOKS = [
  "Pattern interrupt with unexpected visual",
  "Open with a bold, contrarian claim",
  "Start mid-action to create curiosity",
];

export default function HooksPage() {
  const router = useRouter();
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [selectedHook, setSelectedHook] = useState<number | null>(null);

  useEffect(() => {
    setUnlocked(isHooksUnlocked());
  }, []);

  // Avoid flash before sessionStorage is read
  if (unlocked === null) return null;

  if (!unlocked) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <svg
          className="mb-6 h-12 w-12 text-[var(--text-secondary)]/40"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
          />
        </svg>
        <h2 className="text-xl font-semibold">Hooks not yet generated</h2>
        <p className="mt-2 max-w-sm text-sm text-[var(--text-secondary)]">
          Upload a video and click <strong>Generate hooks</strong> on the
          Analysis tab to unlock this page.
        </p>
        <Link
          href="/"
          className="mt-6 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-hover)]"
        >
          Go to Analysis
        </Link>
      </div>
    );
  }

  function handleGenerateScript() {
    if (selectedHook === null) return;
    unlockScript(PLACEHOLDER_HOOKS[selectedHook]);
    router.push("/script");
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Hooks</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Improved hook options based on your neural opening-seconds data.
        </p>
      </div>

      <ul className="space-y-2">
        {PLACEHOLDER_HOOKS.map((hook, i) => (
          <li key={i}>
            <button
              onClick={() => setSelectedHook(i)}
              className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                selectedHook === i
                  ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--text-primary)]"
                  : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-secondary)]/30"
              }`}
            >
              {hook}
            </button>
          </li>
        ))}
      </ul>

      <button
        disabled={selectedHook === null}
        onClick={handleGenerateScript}
        className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        Generate script
      </button>
    </div>
  );
}
