import { TeacherLayout } from "@/components/teacher/TeacherLayout";
import { KpiCard } from "@/components/student/KpiCard";
import { RiskBadge } from "@/components/student/RiskBadge";
import { motion } from "framer-motion";
import { Clock, AlertTriangle, TrendingUp, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useParams } from "react-router-dom";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

const thirtyDayData = Array.from({ length: 30 }, (_, i) => ({
  day: i + 1,
  focus: Math.round(45 + Math.random() * 40 + (i > 20 ? 5 : 0)),
}));

const distractions = [
  { type: "Phone usage", pct: 35 },
  { type: "Looking away", pct: 23 },
  { type: "Talking", pct: 20 },
  { type: "Drowsiness", pct: 14 },
  { type: "Other", pct: 8 },
];

const StudentDetail = () => {
  const { id } = useParams();

  return (
    <TeacherLayout>
      <div className="space-y-8">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-4 text-muted-foreground">
            <Link to="/teacher/students"><ArrowLeft size={14} className="mr-1" /> Back to Students</Link>
          </Button>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center font-heading font-extrabold text-primary text-xl">
              Y
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-heading font-extrabold text-2xl text-foreground">Yassine Bouaziz</h1>
                <RiskBadge tier="needs-attention" />
              </div>
              <p className="text-sm text-muted-foreground font-body mt-0.5">3ème Sciences — Group A</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Avg Focus (30d)" value="48%" icon={TrendingUp} change="+5%" borderColor="border-l-destructive" />
          <KpiCard label="Sessions Attended" value="18/22" icon={Clock} change="82%" borderColor="border-l-primary" />
          <KpiCard label="Distraction Events" value="35" icon={AlertTriangle} change="-8" borderColor="border-l-warning" />
          <KpiCard label="Improvement" value="+5%" icon={TrendingUp} change="↑" borderColor="border-l-success" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-2 bg-card rounded-2xl border border-border/50 p-6 shadow-card"
          >
            <h3 className="font-heading font-bold text-base text-foreground mb-1">30-Day Focus Trend</h3>
            <p className="text-xs text-muted-foreground font-body mb-6">Daily average focus score</p>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={thirtyDayData}>
                <defs>
                  <linearGradient id="detailFocus" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(241 44% 42%)" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="hsl(241 44% 42%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(240 8% 50%)' }} />
                <YAxis hide domain={[0, 100]} />
                <Tooltip contentStyle={{ background: 'hsl(0 0% 100%)', border: '1px solid hsl(214 20% 92%)', borderRadius: '12px', fontSize: '12px' }} />
                <Area type="monotone" dataKey="focus" stroke="hsl(241 44% 42%)" strokeWidth={2} fill="url(#detailFocus)" />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card rounded-2xl border border-border/50 p-6 shadow-card"
          >
            <h3 className="font-heading font-bold text-base text-foreground mb-1">Distraction Breakdown</h3>
            <p className="text-xs text-muted-foreground font-body mb-5">Last 30 days</p>
            <div className="space-y-4">
              {distractions.map((d) => (
                <div key={d.type}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-body text-foreground">{d.type}</span>
                    <span className="text-xs font-heading font-bold text-muted-foreground">{d.pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                    <div className={`h-full rounded-full ${
                        d.pct >= 30 ? "bg-destructive" : d.pct >= 20 ? "bg-warning" : "bg-success"
                      }`} style={{ width: `${d.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>


      </div>
    </TeacherLayout>
  );
};

export default StudentDetail;
