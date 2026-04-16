import { motion } from "framer-motion";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface KpiCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  change: string;
  borderColor?: string;
}

export const KpiCard = ({ icon: Icon, label, value, change, borderColor = "border-l-primary" }: KpiCardProps) => {
  const isNegative = change.startsWith("-") || change.includes("↓");
  const ArrowIcon = isNegative ? TrendingDown : TrendingUp;
  const changeColor = "text-success";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-card rounded-2xl p-5 border border-border/50 shadow-soft border-l-4 ${borderColor}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center">
          <Icon size={18} className="text-primary" />
        </div>
        <span className={`text-xs font-body ${changeColor} font-medium flex items-center gap-0.5`}>
          <ArrowIcon size={12} /> {change}
        </span>
      </div>
      <p className={`font-heading font-extrabold text-2xl ${
        value.endsWith('%') ? (parseInt(value) >= 80 ? 'text-success' : parseInt(value) >= 60 ? 'text-warning' : 'text-destructive') : 'text-foreground'
      }`}>{value}</p>
      <p className="text-xs text-muted-foreground font-body mt-0.5 uppercase tracking-wider">{label}</p>
    </motion.div>
  );
};
