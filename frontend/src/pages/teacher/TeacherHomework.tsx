import { useState } from "react";
import { TeacherLayout } from "@/components/teacher/TeacherLayout";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, FileText, Clock, CheckCircle, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Assignment {
  id: number;
  title: string;
  subject: string;
  dueDate: string;
  total: number;
  submitted: number;
  graded: number;
}

const initialAssignments: Assignment[] = [
  { id: 1, title: "Exercice 14 — Fonctions dérivées", subject: "Mathematics", dueDate: "Apr 15", total: 32, submitted: 28, graded: 22 },
  { id: 2, title: "TP Chimie — Réactions acides", subject: "Chemistry", dueDate: "Apr 18", total: 32, submitted: 15, graded: 0 },
  { id: 3, title: "Commentaire composé — Candide", subject: "French", dueDate: "Apr 12", total: 32, submitted: 32, graded: 30 },
  { id: 4, title: "Exercice 8 — Cinématique", subject: "Physics", dueDate: "Apr 20", total: 32, submitted: 5, graded: 0 },
];

const subjects = ["Mathematics", "Physics", "Chemistry", "French", "Arabic Literature", "Biology"];

const TeacherHomework = () => {
  const [assignments, setAssignments] = useState<Assignment[]>(initialAssignments);
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSubject, setNewSubject] = useState("Mathematics");
  const [newDueDate, setNewDueDate] = useState("");

  const handleCreate = () => {
    if (!newTitle.trim() || !newDueDate) return;

    const formatted = new Date(newDueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const newAssignment: Assignment = {
      id: Date.now(),
      title: newTitle.trim(),
      subject: newSubject,
      dueDate: formatted,
      total: 32,
      submitted: 0,
      graded: 0,
    };

    setAssignments((prev) => [newAssignment, ...prev]);
    setShowModal(false);
    setNewTitle("");
    setNewDueDate("");
    toast.success(`"${newAssignment.title}" created!`, {
      description: `Due ${formatted} · ${newSubject}`,
    });
  };

  return (
    <TeacherLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading font-extrabold text-2xl text-foreground">Homework</h1>
            <p className="text-sm text-muted-foreground font-body mt-1">Create and track assignments</p>
          </div>
          <Button variant="hero" size="lg" className="flex items-center gap-2" onClick={() => setShowModal(true)}>
            <Plus size={16} /> New Assignment
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {assignments.map((hw, i) => {
            const pctSubmitted = Math.round((hw.submitted / hw.total) * 100);
            const pctGraded = Math.round((hw.graded / hw.total) * 100);
            const isOverdue = new Date(`2026-${hw.dueDate.replace("Apr ", "04-")}`) < new Date();

            return (
              <motion.div
                key={hw.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-card rounded-2xl border border-border/50 p-6 shadow-card hover:shadow-elevated transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <FileText size={18} className="text-primary" />
                    </div>
                    <div>
                      <h3 className="font-heading font-bold text-sm text-foreground">{hw.title}</h3>
                      <p className="text-xs text-muted-foreground font-body mt-0.5">{hw.subject}</p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 text-xs font-body font-medium px-2 py-1 rounded-lg ${
                    isOverdue ? "bg-destructive/10 text-destructive" : "bg-muted/50 text-muted-foreground"
                  }`}>
                    <Clock size={11} /> {hw.dueDate}
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-body text-muted-foreground flex items-center gap-1">
                        <CheckCircle size={11} /> Submitted
                      </span>
                      <span className="text-xs font-heading font-bold text-foreground">{hw.submitted}/{hw.total}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pctSubmitted}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-body text-muted-foreground flex items-center gap-1">
                        <AlertCircle size={11} /> Graded
                      </span>
                      <span className="text-xs font-heading font-bold text-foreground">{hw.graded}/{hw.total}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                      <div className="h-full rounded-full bg-success" style={{ width: `${pctGraded}%` }} />
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* New Assignment Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/20 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="dark bg-card text-foreground rounded-2xl p-8 shadow-elevated border border-border max-w-lg w-full mx-4"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-heading font-bold text-lg text-foreground">New Assignment</h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-sm font-body">Title</Label>
                  <Input
                    placeholder="e.g. Exercice 15 — Intégrales"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="h-11 rounded-xl font-body bg-muted/30"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-body">Subject</Label>
                  <div className="flex flex-wrap gap-2">
                    {subjects.map((s) => (
                      <button
                        key={s}
                        onClick={() => setNewSubject(s)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-body font-medium transition-all ${
                          newSubject === s
                            ? "bg-primary text-primary-foreground shadow-soft"
                            : "bg-muted/50 text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-body">Due Date</Label>
                  <Input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="h-11 rounded-xl font-body bg-muted/30"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end mt-8">
                <Button variant="outline" onClick={() => setShowModal(false)} className="rounded-xl">
                  Cancel
                </Button>
                <Button
                  variant="hero"
                  onClick={handleCreate}
                  disabled={!newTitle.trim() || !newDueDate}
                  className="rounded-xl"
                >
                  <Plus size={14} className="mr-1.5" /> Create Assignment
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </TeacherLayout>
  );
};

export default TeacherHomework;
