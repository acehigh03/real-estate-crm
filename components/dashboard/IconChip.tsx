import type { LucideIcon } from "lucide-react";

const TONE = { accent: "icon-chip-accent", amber: "icon-chip-amber", emerald: "icon-chip-emerald", rose: "icon-chip-rose" } as const;

/** Round tinted badge that holds a card's icon. */
export function IconChip({ icon: Icon, tone = "accent", size = 40, shape = "full" }: { icon: LucideIcon; tone?: keyof typeof TONE; size?: number; shape?: "full" | "square" }) {
  return (
    <span aria-hidden className={`icon-chip ${TONE[tone]} ${shape === "full" ? "rounded-full" : "rounded-xl"}`} style={{ width: size, height: size }}>
      <Icon size={Math.round(size * 0.48)} strokeWidth={2} />
    </span>
  );
}
