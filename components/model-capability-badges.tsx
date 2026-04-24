import type { ModelCapabilityFlags } from "@/lib/models";

const MODEL_CAPABILITY_BADGES = [
  { key: "supportsImages", label: "Vision" },
  { key: "supportsTools", label: "Tools" },
  { key: "supportsReasoning", label: "Reasoning" },
  { key: "supportsCode", label: "Code" },
] satisfies Array<{
  key: keyof ModelCapabilityFlags;
  label: string;
}>;

type ModelCapabilityBadgesProps = {
  className?: string;
  compact?: boolean;
  model?: ModelCapabilityFlags | null;
  testId?: string;
  tone?: "default" | "inverse";
};

export function ModelCapabilityBadges({
  className = "",
  compact = false,
  model,
  testId,
  tone = "default",
}: ModelCapabilityBadgesProps) {
  const badges = MODEL_CAPABILITY_BADGES.filter((badge) => model?.[badge.key]);

  if (badges.length === 0) {
    return null;
  }

  return (
    <span
      aria-label={`Model capabilities: ${badges.map((badge) => badge.label).join(", ")}`}
      className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}
      data-testid={testId}
    >
      {badges.map((badge) => (
        <span
          key={badge.key}
          className={`rounded-full border font-semibold uppercase tracking-[0.14em] ${
            compact ? "px-2 py-0.5 text-[9px]" : "px-2.5 py-1 text-[10px]"
          } ${
            tone === "inverse"
              ? "border-white/24 bg-white/14 text-white/86"
              : "border-[color:var(--border)] bg-[color:var(--surface-muted)] text-[color:var(--accent-strong)]"
          }`}
        >
          {badge.label}
        </span>
      ))}
    </span>
  );
}
