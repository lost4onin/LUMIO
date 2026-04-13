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
      return { bgColor: "bg-red-600", label: "Distracted" };
    }
    if (normalizedScore <= 0.6) {
      return { bgColor: "bg-yellow-600", label: "Low Focus" };
    }
    return { bgColor: "bg-green-600", label: "Focused" };
  }, [normalizedScore]);

  return (
    <div className={`w-full ${className}`}>
      {/* Background track */}
      <div className="h-2 w-full bg-surface border-[1px] border-border overflow-hidden" style={{ borderRadius: '8px' }}>
        {/* Progress fill */}
        <div
          className={`h-full ${bgColor} transition-all duration-500 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Labels below bar */}
      <div className="flex items-center justify-between mt-3">
        {/* Score percentage on the left */}
        <span className="text-xs text-muted font-mono" style={{ letterSpacing: '0.1em' }}>
          {percentage}%
        </span>

        {/* Cause label or status */}
        <span className="text-xs text-muted font-mono" style={{ letterSpacing: '0.1em' }}>{causeLabel || label}</span>
      </div>
    </div>
  );
};

export default FocusBar;
