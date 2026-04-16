import { motion } from "framer-motion";
import { TeacherLayout } from "@/components/teacher/TeacherLayout";
import { KpiCard } from "@/components/student/KpiCard";
import { RiskBadge } from "@/components/student/RiskBadge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  Users, Target, AlertTriangle, BookOpen, Play, TrendingUp, ArrowRight, Clock
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from "recharts";

const classFocusData = Array.from({ length: 7 }, (_, i) => ({
  day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i],
  focus: Math.max(50, Math.min(95, 68 + Math.sin(i * 0.7) * 10 + (Math.random() - 0.5) * 8)),
}));

const atRiskStudents = [
  { name: "Yassine B.", score: 35, trend: "down", sessions: 3 },
  { name: "Amira K.", score: 41, trend: "stable", sessions: 5 },
  { name: "Ines H.", score: 52, trend: "up", sessions: 7 },
  { name: "Lina M.", score: 58, trend: "down", sessions: 4 },
];

const recentActivity = [
  { type: "alert", message: "Yassine B. focus dropped below 40% for 5+ minutes", time: "10 min ago" },
  { type: "homework", message: "12 students submitted Chapter 5 Exercises", time: "1 hour ago" },
  { type: "session", message: "Live session ended — 3ème Sciences A", time: "2 hours ago" },
  { type: "alert", message: "Amira K. flagged as at-risk (14-day pattern)", time: "3 hours ago" },
  { type: "homework", message: "Lab Report deadline extended to Apr 18", time: "Yesterday" },
];

const TeacherDashboard = () => {
  return (
    <TeacherLayout>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-8"
      >
        <div>
          <h1 className="font-heading font-extrabold text-2xl text-foreground">
            Teacher Dashboard
          </h1>
          <p className="text-sm text-muted-foreground font-body mt-1">
            3ème Sciences A · Overview for today
          </p>
        </div>
        <Link to="/teacher/live">
          <Button variant="hero" size="lg">
            <Play size={16} className="mr-1.5" /> Start Live Session
          </Button>
        </Link>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard icon={Users} label="Students" value="32" change="+2" borderColor="border-l-primary" />
        <KpiCard icon={Target} label="Avg Focus" value="71%" change="+3%" borderColor="border-l-secondary" />
        <KpiCard icon={AlertTriangle} label="At-Risk" value="4" change="-1" borderColor="border-l-destructive" />
        <KpiCard icon={BookOpen} label="HW Pending" value="8" change="+3" borderColor="border-l-warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Class Focus Trend */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2 bg-card rounded-2xl p-6 border border-border/50 shadow-soft"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-bold text-foreground flex items-center gap-2">
              <TrendingUp size={16} className="text-primary" /> Class Focus Trend
            </h2>
            <span className="text-xs text-muted-foreground font-body">Last 7 days</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={classFocusData}>
              <defs>
                <linearGradient id="teachGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(216, 52%, 55%)" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="hsl(216, 52%, 55%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 92%)" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fontFamily: "Lexend" }} stroke="hsl(240, 8%, 50%)" />
              <YAxis tick={{ fontSize: 11, fontFamily: "Lexend" }} stroke="hsl(240, 8%, 50%)" domain={[0, 100]} />
              <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid hsl(214, 20%, 92%)", fontFamily: "Lexend", fontSize: 12 }} />
              <ReferenceLine y={70} stroke="hsl(142, 72%, 42%)" strokeDasharray="4 4" />
              <Area type="monotone" dataKey="focus" stroke="hsl(216, 52%, 55%)" strokeWidth={2} fill="url(#teachGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* At-Risk Students */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-2xl p-6 border border-border/50 shadow-soft"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-bold text-foreground flex items-center gap-2">
              <AlertTriangle size={16} className="text-destructive" /> At-Risk
            </h2>
            <Link to="/teacher/students" className="text-xs text-primary font-body font-medium hover:underline flex items-center gap-1">
              View All <ArrowRight size={12} />
            </Link>
          </div>
          <div className="space-y-3">
            {atRiskStudents.map((student, i) => (
              <Link
                key={student.name}
                to={`/teacher/students/${i + 1}`}
                className="block"
              >
                <motion.div
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + i * 0.05 }}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-heading font-bold text-xs ${
                      student.score < 50 ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"
                    }`}>
                      {student.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-body font-medium text-foreground">{student.name}</p>
                      <p className="text-[11px] text-muted-foreground font-body">{student.sessions} sessions this week</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-heading font-bold ${
                      student.score >= 80 ? "text-success" : student.score >= 60 ? "text-warning" : "text-destructive"
                    }`}>
                      {student.score}%
                    </span>
                    <RiskBadge tier={student.score < 50 ? "needs-attention" : "moderate"} />
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Recent Activity */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-card rounded-2xl p-6 border border-border/50 shadow-soft"
      >
        <h2 className="font-heading font-bold text-foreground mb-4 flex items-center gap-2">
          <Clock size={16} className="text-primary" /> Recent Activity
        </h2>
        <div className="space-y-3">
          {recentActivity.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 + i * 0.04 }}
              className="flex items-start gap-3 p-3 rounded-xl hover:bg-muted/20 transition-colors"
            >
              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                item.type === "alert" ? "bg-destructive" :
                item.type === "homework" ? "bg-warning" :
                "bg-success"
              }`} />
              <div className="flex-1">
                <p className="text-sm font-body text-foreground">{item.message}</p>
                <p className="text-[11px] text-muted-foreground font-body mt-0.5">{item.time}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </TeacherLayout>
  );
};

export default TeacherDashboard;
