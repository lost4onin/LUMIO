import { TeacherLayout } from "@/components/teacher/TeacherLayout";
import { RiskBadge } from "@/components/student/RiskBadge";
import { motion } from "framer-motion";
import { Search, TrendingUp, TrendingDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { useState } from "react";

const allStudents = [
  { id: "1", name: "Ahmed Bouaziz", group: "3ème Sc. A", avgFocus: 85, sessions: 20, trend: "up", risk: "low" as const },
  { id: "2", name: "Nour Trabelsi", group: "3ème Sc. A", avgFocus: 72, sessions: 18, trend: "up", risk: "low" as const },
  { id: "3", name: "Sami Riahi", group: "3ème Sc. B", avgFocus: 91, sessions: 22, trend: "up", risk: "low" as const },
  { id: "4", name: "Lina Mansouri", group: "3ème Sc. A", avgFocus: 58, sessions: 17, trend: "down", risk: "moderate" as const },
  { id: "5", name: "Yassine Bouaziz", group: "3ème Sc. A", avgFocus: 38, sessions: 15, trend: "down", risk: "needs-attention" as const },
  { id: "6", name: "Amira Khemiri", group: "3ème Sc. B", avgFocus: 42, sessions: 16, trend: "down", risk: "needs-attention" as const },
  { id: "7", name: "Mehdi Saidi", group: "3ème Sc. A", avgFocus: 67, sessions: 19, trend: "up", risk: "moderate" as const },
  { id: "8", name: "Fatma Zaouali", group: "3ème Sc. B", avgFocus: 79, sessions: 21, trend: "up", risk: "low" as const },
  { id: "9", name: "Karim Dhouib", group: "3ème Sc. A", avgFocus: 88, sessions: 22, trend: "up", risk: "low" as const },
  { id: "10", name: "Ines Hamdi", group: "3ème Sc. B", avgFocus: 52, sessions: 14, trend: "down", risk: "moderate" as const },
];

type RiskFilter = "all" | "needs-attention" | "moderate" | "low";

const TeacherStudents = () => {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<RiskFilter>("all");

  const filtered = allStudents
    .filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
    .filter((s) => filter === "all" || s.risk === filter);

  return (
    <TeacherLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-heading font-extrabold text-2xl text-foreground">Students</h1>
          <p className="text-sm text-muted-foreground font-body mt-1">View and manage all your students</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search students..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 rounded-xl font-body bg-muted/30 border-border"
            />
          </div>
          <div className="flex items-center gap-1.5">
            {([
              { key: "all" as const, label: "All" },
              { key: "needs-attention" as const, label: "High Risk" },
              { key: "moderate" as const, label: "Medium" },
              { key: "low" as const, label: "Low Risk" },
            ]).map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 text-xs font-body font-medium rounded-lg transition-colors ${
                  filter === f.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-card rounded-2xl border border-border/50 shadow-card overflow-hidden"
        >
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left px-6 py-3.5 text-xs font-body font-medium text-muted-foreground uppercase tracking-wider">Student</th>
                <th className="text-left px-6 py-3.5 text-xs font-body font-medium text-muted-foreground uppercase tracking-wider">Group</th>
                <th className="text-left px-6 py-3.5 text-xs font-body font-medium text-muted-foreground uppercase tracking-wider">Avg Focus</th>
                <th className="text-left px-6 py-3.5 text-xs font-body font-medium text-muted-foreground uppercase tracking-wider">Sessions</th>
                <th className="text-left px-6 py-3.5 text-xs font-body font-medium text-muted-foreground uppercase tracking-wider">Risk</th>
                <th className="text-left px-6 py-3.5 text-xs font-body font-medium text-muted-foreground uppercase tracking-wider">Trend</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((student) => (
                <tr key={student.id} className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4">
                    <Link to={`/teacher/students/${student.id}`} className="flex items-center gap-3 group">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-heading font-bold text-xs ${
                        student.risk === "needs-attention" ? "bg-destructive/10 text-destructive" :
                        student.risk === "moderate" ? "bg-warning/10 text-warning" :
                        "bg-success/10 text-success"
                      }`}>
                        {student.name.charAt(0)}
                      </div>
                      <span className="text-sm font-body font-medium text-foreground group-hover:text-primary transition-colors">{student.name}</span>
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm font-body text-muted-foreground">{student.group}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-muted/50 overflow-hidden">
                        <div className={`h-full rounded-full ${
                          student.avgFocus >= 80 ? "bg-success" : student.avgFocus >= 60 ? "bg-warning" : "bg-destructive"
                        }`} style={{ width: `${student.avgFocus}%` }} />
                      </div>
                      <span className={`text-sm font-heading font-bold ${
                        student.avgFocus >= 80 ? "text-success" : student.avgFocus >= 60 ? "text-warning" : "text-destructive"
                      }`}>{student.avgFocus}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-body text-muted-foreground">{student.sessions}</td>
                  <td className="px-6 py-4"><RiskBadge tier={student.risk} /></td>
                  <td className="px-6 py-4">
                    {student.trend === "up" ? (
                      <TrendingUp size={16} className="text-success" />
                    ) : (
                      <TrendingDown size={16} className="text-destructive" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </div>
    </TeacherLayout>
  );
};

export default TeacherStudents;
