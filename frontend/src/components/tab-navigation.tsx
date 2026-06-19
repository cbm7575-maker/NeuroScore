"use client";

export type TabId = "analysis" | "hooks" | "script";

interface Tab {
  id: TabId;
  label: string;
  enabled: boolean;
}

interface TabNavigationProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  hooksEnabled: boolean;
  scriptEnabled: boolean;
}

export default function TabNavigation({
  activeTab,
  onTabChange,
  hooksEnabled,
  scriptEnabled,
}: TabNavigationProps) {
  const tabs: Tab[] = [
    { id: "analysis", label: "Analysis", enabled: true },
    { id: "hooks", label: "Hooks", enabled: hooksEnabled },
    { id: "script", label: "Script", enabled: scriptEnabled },
  ];

  return (
    <div className="flex gap-1 border-b border-[var(--border)]">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => tab.enabled && onTabChange(tab.id)}
          disabled={!tab.enabled}
          className={`
            relative px-4 py-2.5 text-sm font-medium transition-colors
            ${
              activeTab === tab.id
                ? "text-[var(--accent)] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[var(--accent)]"
                : tab.enabled
                  ? "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  : "cursor-not-allowed text-[var(--text-secondary)]/40"
            }
          `}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
