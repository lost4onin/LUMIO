import { useState } from "react";
import { TeacherLayout } from "@/components/teacher/TeacherLayout";
import { RiskBadge } from "@/components/student/RiskBadge";
import { motion } from "framer-motion";
import { Play, Pause, Users, Target, AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

const students = [
  { name: "Ahmed B.", score: 85 },
  { name: "Nour T.", score: 72 },
  { name: "Sami R.", score: 91 },
  { name: "Lina M.", score: 58 },
  { name: "Yassine B.", score: 35 },
  { name: "Amira K.", score: 41 },
  { name: "Mehdi S.", score: 67 },
  { name: "Fatma Z.", score: 79 },
  { name: "Karim D.", score: 88 },
  { name: "Ines H.", score: 52 },
  { name: "Omar J.", score: 94 },
  { name: "Salma A.", score: 61 },
];

const LiveClass = () => {
  const [isLive, setIsLive] = useState(false);

  const avgScore = Math.round(students.reduce((a, s) => a + s.score, 0) / students.length);
  const atRisk = students.filter((s) => s.score < 50).length;

  const getBarColor = (score: number) => {
    if (score >= 70) return "bg-success";
    if (score >= 50) return "bg-warning";
    return "bg-destructive";
  };

  const getTier = (score: number): "low" | "moderate" | "needs-attention" => {
    if (score >= 70) return "low";
    if (score >= 50) return "moderate";
    return "needs-attention";
  };

  return (
    <TeacherLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading font-extrabold text-2xl text-foreground">Live Class Monitor</h1>
            <p className="text-sm text-muted-foreground font-body mt-1">
              {isLive ? "Session in progress — monitoring student focus" : "Start a session to monitor your class in real-time"}
            </p>
          </div>
          <Button
            variant={isLive ? "destructive" : "hero"}
            size="lg"
            onClick={() => setIsLive(!isLive)}
            className="flex items-center gap-2"
          >
            {isLive ? <><Pause size={16} /> End Session</> : <><Play size={16} /> Start Session</>}
          </Button>
        </div>

        {isLive && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-4"
          >
            <div className="bg-card rounded-2xl border border-border/50 p-4 shadow-card text-center">
              <Users size={18} className="text-primary mx-auto mb-2" />
              <p className="font-heading font-extrabold text-2xl text-foreground">{students.length}</p>
              <p className="text-xs text-muted-foreground font-body">Connected</p>
            </div>
            <div className="bg-card rounded-2xl border border-border/50 p-4 shadow-card text-center">
              <Target size={18} className="text-secondary mx-auto mb-2" />
              <p className="font-heading font-extrabold text-2xl text-foreground">{avgScore}%</p>
              <p className="text-xs text-muted-foreground font-body">Avg Focus</p>
            </div>
            <div className="bg-card rounded-2xl border border-border/50 p-4 shadow-card text-center">
              <AlertTriangle size={18} className="text-destructive mx-auto mb-2" />
              <p className="font-heading font-extrabold text-2xl text-foreground">{atRisk}</p>
              <p className="text-xs text-muted-foreground font-body">At Risk</p>
            </div>
            <div className="bg-card rounded-2xl border border-border/50 p-4 shadow-card text-center">
              <Clock size={18} className="text-warning mx-auto mb-2" />
              <p className="font-heading font-extrabold text-2xl text-foreground">24:30</p>
              <p className="text-xs text-muted-foreground font-body">Elapsed</p>
            </div>
          </motion.div>
        )}

        <div>
          <h2 className="font-heading font-bold text-base text-foreground mb-4">
            Student Focus Bars {isLive && <span className="text-xs font-body font-normal text-muted-foreground ml-2">Live</span>}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {students
              .sort((a, b) => a.score - b.score)
              .map((student, i) => (
                <motion.div
                  key={student.name}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="bg-card rounded-xl border border-border/50 p-4 shadow-soft hover:shadow-card transition-shadow"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-heading font-bold text-xs ${
                        student.score >= 70 ? "bg-success/10 text-success" :
                        student.score >= 50 ? "bg-warning/10 text-warning" :
                        "bg-destructive/10 text-destructive"
                      }`}>
                        {student.name.charAt(0)}
                      </div>
                      <span className="text-sm font-body font-medium text-foreground">{student.name}</span>
                    </div>
                    <RiskBadge tier={getTier(student.score)} />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 rounded-full bg-muted/50 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${student.score}%` }}
                        transition={{ duration: 0.8, delay: i * 0.03 }}
                        className={`h-full rounded-full ${
                          student.score >= 80 ? 'bg-success' : student.score >= 60 ? 'bg-warning' : 'bg-destructive'
                        }`}
                      />
                    </div>
                    <span className={`text-xs font-heading font-bold w-8 text-right ${
                      student.score >= 80 ? 'text-success' : student.score >= 60 ? 'text-warning' : 'text-destructive'
                    }`}>{student.score}%</span>
                  </div>
                </motion.div>
              ))}
          </div>
        </div>
      </div>
    </TeacherLayout>
  );
};

export default LiveClass;
