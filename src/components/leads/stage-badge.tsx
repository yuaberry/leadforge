import { STAGE_LABELS, type LeadStage } from "@/validators/lead";
import { cn } from "@/lib/utils";

const STAGE_CLASS: Record<LeadStage, string> = {
  new: "bg-blue-500/15 text-blue-400",
  qualified: "bg-violet-500/15 text-violet-400",
  contacted: "bg-cyan-500/15 text-cyan-300",
  replied: "bg-teal-500/15 text-teal-300",
  meeting: "bg-amber-500/15 text-amber-400",
  proposal: "bg-orange-500/15 text-orange-400",
  negotiation: "bg-pink-500/15 text-pink-400",
  won: "bg-emerald-500/15 text-emerald-400",
  lost: "bg-red-500/15 text-red-400",
};

export function StageBadge({ stage }: { stage: string }) {
  const key = (stage as LeadStage) in STAGE_LABELS ? (stage as LeadStage) : null;
  if (!key) {
    return (
      <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold">
        {stage}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        STAGE_CLASS[key]
      )}
    >
      {STAGE_LABELS[key]}
    </span>
  );
}
