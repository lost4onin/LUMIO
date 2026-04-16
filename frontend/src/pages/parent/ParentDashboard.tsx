import { motion } from "framer-motion";
import { ParentLayout } from "@/components/parent/ParentLayout";
import { KpiCard } from "@/components/student/KpiCard";
import { Target, Clock, CheckCircle2, TrendingUp, User } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from "recharts";

const focusTrend = Array.from({ length: 7 }, (_, i) => ({
  day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i],
  focus: Math.max(50, Math.min(100, 74 + Math.sin(i * 0.9) * 10 + (Math.random() - 0.5) * 6)),
}));

const recentSessions = [
  { subject: "Mathematics", date: "Today, 10:30 AM", duration: "30 min", focus: 85 },
  { subject: "Physics", date: "Today, 8:00 AM", duration: "25 min", focus: 78 },
  { subject: "Arabic Lit.", date: "Yesterday, 6:00 PM", duration: "40 min", focus: 91 },
  { subject: "Biology", date: "Yesterday, 3:00 PM", duration: "20 min", focus: 64 },
];



const ParentDashboard = () => {
  return (
    <ParentLayout>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="font-heading font-extrabold text-2xl text-foreground">
          Welcome back, Fatma 👋
        </h1>
        <p className="text-sm text-muted-foreground font-body mt-1">
          Here's how Ahmed is doing this week
        </p>
      </motion.div>

      {/* Child Summary Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-card rounded-2xl p-5 border border-border/50 shadow-soft mb-6 flex items-center gap-4"
      >
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <User size={20} className="text-primary" />
        </div>
        <div>
          <p className="font-heading font-bold text-foreground">Ahmed Ben Ali</p>
          <p className="text-sm text-muted-foreground font-body">3ème Sciences A · Teacher: Ms. Trabelsi · Last session: 2 hours ago</p>
        </div>
      </motion.div>

      {/* KPI Cards — No risk scores */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <KpiCard icon={Target} label="Avg Focus (7d)" value="78%" change="+5%" borderColor="border-l-primary" />
        <KpiCard icon={Clock} label="Study Time" value="8.5h" change="+1.2h" borderColor="border-l-secondary" />
        <KpiCard icon={CheckCircle2} label="HW Completion" value="87%" change="+4%" borderColor="border-l-success" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Focus Trend Chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2 bg-card rounded-2xl p-6 border border-border/50 shadow-soft"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-bold text-foreground flex items-center gap-2">
              <TrendingUp size={16} className="text-primary" /> Focus Trend
            </h2>
            <div className="flex bg-muted/50 rounded-lg p-0.5">
              <button className="px-3 py-1 text-[11px] font-body font-medium rounded-md bg-card text-foreground shadow-soft">7d</button>
              <button className="px-3 py-1 text-[11px] font-body font-medium text-muted-foreground">30d</button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={focusTrend}>
              <defs>
                <linearGradient id="parentGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(241, 44%, 42%)" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="hsl(241, 44%, 42%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 92%)" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fontFamily: "Lexend" }} stroke="hsl(240, 8%, 50%)" />
              <YAxis tick={{ fontSize: 11, fontFamily: "Lexend" }} stroke="hsl(240, 8%, 50%)" domain={[0, 100]} />
              <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid hsl(214, 20%, 92%)", fontFamily: "Lexend", fontSize: 12 }} />
              <ReferenceLine y={70} stroke="hsl(142, 72%, 42%)" strokeDasharray="4 4" />
              <Area type="monotone" dataKey="focus" stroke="hsl(241, 44%, 42%)" strokeWidth={2} fill="url(#parentGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>


      </div>

      {/* Recent Sessions */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-card rounded-2xl border border-border/50 shadow-soft"
      >
        <div className="p-6 pb-3">
          <h2 className="font-heading font-bold text-foreground">Recent Sessions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left text-xs font-body font-medium text-muted-foreground px-6 py-3 uppercase tracking-wider">Subject</th>
                <th className="text-left text-xs font-body font-medium text-muted-foreground px-6 py-3 uppercase tracking-wider">Date</th>
                <th className="text-left text-xs font-body font-medium text-muted-foreground px-6 py-3 uppercase tracking-wider">Duration</th>
                <th className="text-left text-xs font-body font-medium text-muted-foreground px-6 py-3 uppercase tracking-wider">Focus</th>
              </tr>
            </thead>
            <tbody>
              {recentSessions.map((s, i) => (
                <tr key={i} className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-3.5 text-sm font-body font-medium text-foreground">{s.subject}</td>
                  <td className="px-6 py-3.5 text-sm font-body text-muted-foreground">{s.date}</td>
                  <td className="px-6 py-3.5 text-sm font-body text-muted-foreground">{s.duration}</td>
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-muted/50 overflow-hidden">
                        <div className={`h-full rounded-full ${
                          s.focus >= 80 ? "bg-success" : s.focus >= 60 ? "bg-warning" : "bg-destructive"
                        }`} style={{ width: `${s.focus}%` }} />
                      </div>
                      <span className={`text-sm font-heading font-bold ${
                        s.focus >= 80 ? "text-success" : s.focus >= 60 ? "text-warning" : "text-destructive"
                      }`}>
                        {s.focus}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </ParentLayout>
  );
};

export default ParentDashboard;
