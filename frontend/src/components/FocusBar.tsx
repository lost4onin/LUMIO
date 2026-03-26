import React, { useMemo } from "react";

interface FocusBarProps {
  focusScore: number;
  causeLabel?: string;
  className?: string;
}

export const FocusBar: React.FC<FocusBarProps> = ({
  focusScore,
  causeLabel,
  className = "",
}) => {
  const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value));

  const normalizedScore = clamp(focusScore, 0, 1);
  const percentage = Math.round(normalizedScore * 100);

  const { bgColor, label } = useMemo(() => {
    if (normalizedScore < 0.35) {
      return { bgColor: "bg-red-500", label: "Distracted" };
    }
    if (normalizedScore <= 0.6) {
      return { bgColor: "bg-amber-400", label: "Low Focus" };
    }
    return { bgColor: "bg-green-500", label: "Focused" };
  }, [normalizedScore]);

  return (
    <div className={`w-full ${className}`}>
      {/* Background track */}
      <div className="h-3 w-full rounded-full bg-slate-700 overflow-hidden">
        {/* Progress fill */}
        <div
          className={`h-full rounded-full ${bgColor} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Labels below bar */}
      <div className="flex items-center justify-between mt-2">
        {/* Score percentage on the left */}
        <span className="text-xs text-slate-400 font-medium">
          {percentage}%
        </span>

        {/* Cause label on the right, fallback to focus status */}
        <span className="text-xs text-slate-400">{causeLabel || label}</span>
      </div>
    </div>
  );
};

export default FocusBar;
