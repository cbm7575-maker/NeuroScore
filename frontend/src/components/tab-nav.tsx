"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { isHooksUnlocked } from "@/lib/hooks-access";
import { isScriptUnlocked } from "@/lib/script-access";

type GateKey = "hooks" | "script";

const TABS: { label: string; href: string; gate?: GateKey }[] = [
  { label: "Analysis", href: "/" },
  { label: "Hooks", href: "/hooks", gate: "hooks" },
  { label: "Script", href: "/script", gate: "script" },
];

const GATE_MESSAGES: Record<GateKey, string> = {
  hooks: "Complete your analysis and click Generate hooks to unlock",
  script: "Select a hook and click Generate script to unlock",
};

export default function TabNav() {
  const pathname = usePathname();
  const [unlocked, setUnlocked] = useState<Record<GateKey, boolean>>({
    hooks: false,
    script: false,
  });

  useEffect(() => {
    setUnlocked({
      hooks: isHooksUnlocked(),
      script: isScriptUnlocked(),
    });
  }, [pathname]);

  return (
    <nav className="border-b border-[var(--border)]">
      <div className="mx-auto flex max-w-4xl gap-1 px-6">
        {TABS.map(({ label, href, gate }) => {
          const locked = gate != null && !unlocked[gate];
          const active = pathname === href;

          if (locked) {
            return (
              <span
                key={href}
                title={gate ? GATE_MESSAGES[gate] : ""}
                className="flex cursor-not-allowed items-center gap-1.5 border-b-2 border-transparent px-4 py-3 text-sm font-medium text-[var(--text-secondary)]/50 select-none"
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                  />
                </svg>
                {label}
              </span>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                active
                  ? "border-[var(--accent)] text-[var(--text-primary)]"
                  : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
