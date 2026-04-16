import { motion } from "framer-motion";
import { StudentLayout } from "@/components/student/StudentLayout";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "react-router-dom";
import { Zap, Clock, Target, TrendingUp, Home, CheckCircle2 } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";

const timelineData = Array.from({ length: 30 }, (_, i) => ({
  min: i + 1,
  focus: Math.max(30, Math.min(100, 75 + Math.sin(i * 0.5) * 15 + (Math.random() - 0.5) * 10)),
}));



const SessionSummary = () => {
  const location = useLocation();
  const durationSeconds = location.state?.durationSeconds || 30 * 60;
  const durationMins = Math.floor(durationSeconds / 60);
  const durationSecs = durationSeconds % 60;

  const avgFocus = 82;
  const duration = durationSecs > 0 ? `${durationMins}m ${durationSecs}s` : `${durationMins} min`;
  const xpEarned = Math.max(15, Math.floor(durationSeconds / 60) * 3 + Math.floor(avgFocus / 10));

  const getFocusMessage = (focus: number) => {
    if (focus >= 85) return { text: "Outstanding focus! You're in the zone 🔥", color: "text-success" };
    if (focus >= 70) return { text: "Great job! Your concentration is strong 💪", color: "text-success" };
    if (focus >= 55) return { text: "Good effort! A few more tweaks and you'll improve 📈", color: "text-warning" };
    return { text: "Keep going! Every session builds your focus muscle 🧠", color: "text-primary" };
  };

  const focusMessage = getFocusMessage(avgFocus);

  return (
    <StudentLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header with celebration */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
            className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-5"
          >
            <CheckCircle2 size={40} className="text-success" />
          </motion.div>
          <h1 className="font-heading font-extrabold text-4xl text-foreground mb-3">
            Session Complete! 🎉
          </h1>
          <p className="text-muted-foreground font-body text-base">
            Mathematics · Today at 10:30 AM
          </p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className={`mt-3 font-heading font-bold text-lg ${focusMessage.color}`}
          >
            {focusMessage.text}
          </motion.p>
        </motion.div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { icon: Target, label: "Avg Focus", value: `${avgFocus}%`, color: "text-primary", bg: "bg-primary/8" },
            { icon: Clock, label: "Duration", value: duration, color: "text-secondary", bg: "bg-secondary/8" },
            { icon: Zap, label: "XP Earned", value: `+${xpEarned}`, color: "text-success", bg: "bg-success/8" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.1 }}
              className="bg-card rounded-2xl p-6 border border-border/50 shadow-soft text-center"
            >
              <div className={`w-12 h-12 rounded-xl ${stat.bg} flex items-center justify-center mx-auto mb-3`}>
                <stat.icon size={22} className={stat.color} />
              </div>
              <p className="font-heading font-extrabold text-3xl text-foreground">{stat.value}</p>
              <p className="text-sm text-muted-foreground font-body mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Focus Timeline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card rounded-2xl p-6 border border-border/50 shadow-soft mb-8"
        >
          <h2 className="font-heading font-bold text-lg text-foreground mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-primary" /> Focus Timeline
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={timelineData}>
              <defs>
                <linearGradient id="summaryGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(241, 44%, 42%)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="hsl(241, 44%, 42%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="min" tick={{ fontSize: 11, fontFamily: "Lexend" }} stroke="hsl(240, 8%, 50%)" label={{ value: "Minutes", position: "insideBottom", offset: -4, fontSize: 11, fontFamily: "Lexend" }} />
              <YAxis tick={{ fontSize: 11, fontFamily: "Lexend" }} stroke="hsl(240, 8%, 50%)" domain={[0, 100]} />
              <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid hsl(214, 20%, 92%)", fontFamily: "Lexend", fontSize: 12 }} />
              <ReferenceLine y={70} stroke="hsl(142, 72%, 42%)" strokeDasharray="4 4" label={{ value: "Healthy", position: "right", fontSize: 10, fill: "hsl(142, 72%, 42%)" }} />
              <Area type="monotone" dataKey="focus" stroke="hsl(241, 44%, 42%)" strokeWidth={2} fill="url(#summaryGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>


        {/* Actions */}
        <div className="flex justify-center gap-4">
          <Link to="/student/dashboard">
            <Button variant="outline" size="lg" className="rounded-2xl">
              <Home size={16} className="mr-1.5" /> Dashboard
            </Button>
          </Link>
          <Link to="/student/session">
            <Button variant="hero" size="lg">
              Start Another Session
            </Button>
          </Link>
        </div>
      </div>
    </StudentLayout>
  );
};

export default SessionSummary;
