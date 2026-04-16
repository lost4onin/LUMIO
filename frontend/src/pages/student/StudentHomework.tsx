import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { StudentLayout } from "@/components/student/StudentLayout";
import { Button } from "@/components/ui/button";
import { BookOpen, Upload, CheckCircle2, Clock, AlertCircle, X, FileUp } from "lucide-react";
import { toast } from "sonner";

type Status = "pending" | "submitted" | "graded";

interface Assignment {
  id: number;
  title: string;
  subject: string;
  due: string;
  status: Status;
  grade: number | null;
}

const initialAssignments: Assignment[] = [
  { id: 1, title: "Chapter 5 Exercises", subject: "Mathematics", due: "Apr 15, 2026", status: "pending", grade: null },
  { id: 2, title: "Lab Report: Motion", subject: "Physics", due: "Apr 14, 2026", status: "submitted", grade: null },
  { id: 3, title: "Essay: Modern Poetry", subject: "Arabic Literature", due: "Apr 12, 2026", status: "graded", grade: 88 },
  { id: 4, title: "Cell Structure Diagram", subject: "Biology", due: "Apr 10, 2026", status: "graded", grade: 72 },
  { id: 5, title: "Equation Practice Set", subject: "Mathematics", due: "Apr 8, 2026", status: "graded", grade: 95 },
];

const statusConfig = {
  pending: { label: "Pending", icon: Clock, className: "text-warning bg-warning/10 border-warning/20" },
  submitted: { label: "Submitted", icon: CheckCircle2, className: "text-secondary bg-secondary/10 border-secondary/20" },
  graded: { label: "Graded", icon: CheckCircle2, className: "text-success bg-success/10 border-success/20" },
};

const StudentHomework = () => {
  const [assignments, setAssignments] = useState<Assignment[]>(initialAssignments);
  const [submitDialogId, setSubmitDialogId] = useState<number | null>(null);
  const [fileName, setFileName] = useState<string>("");

  const handleSubmit = (id: number) => {
    setAssignments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: "submitted" as Status } : a))
    );
    setSubmitDialogId(null);
    setFileName("");
    const hw = assignments.find((a) => a.id === id);
    toast.success(`"${hw?.title}" submitted successfully!`, {
      description: "Your teacher will be notified.",
    });
  };

  const handleFileSelect = () => {
    // Simulate file selection
    const fakeNames = ["homework_ch5.pdf", "assignment_draft.docx", "solution.pdf", "report.pdf"];
    setFileName(fakeNames[Math.floor(Math.random() * fakeNames.length)]);
  };

  const activeDialog = assignments.find((a) => a.id === submitDialogId);

  return (
    <StudentLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading font-extrabold text-2xl text-foreground">Homework</h1>
          <p className="text-sm text-muted-foreground font-body mt-1">
            {assignments.filter(a => a.status === "pending").length} assignments pending
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {assignments.map((hw, i) => {
          const status = statusConfig[hw.status];
          const StatusIcon = status.icon;
          return (
            <motion.div
              key={hw.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card rounded-2xl p-5 border border-border/50 shadow-soft flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center">
                  <BookOpen size={16} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-body font-medium text-foreground">{hw.title}</p>
                  <p className="text-xs text-muted-foreground font-body">{hw.subject} · Due {hw.due}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {hw.grade !== null && (
                  <div className="text-right">
                    <p className={`text-sm font-heading font-bold ${
                      hw.grade >= 80 ? "text-success" : hw.grade >= 60 ? "text-warning" : "text-destructive"
                    }`}>
                      {hw.grade}%
                    </p>
                    <p className="text-[10px] text-muted-foreground font-body">Grade</p>
                  </div>
                )}

                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-body font-medium border ${status.className}`}>
                  <StatusIcon size={12} />
                  {status.label}
                </span>

                {hw.status === "pending" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl text-xs"
                    onClick={() => { setSubmitDialogId(hw.id); setFileName(""); }}
                  >
                    <Upload size={12} className="mr-1" /> Submit
                  </Button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Submit Dialog */}
      <AnimatePresence>
        {activeDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/20 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setSubmitDialogId(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="dark bg-card text-foreground rounded-2xl p-8 shadow-elevated border border-border max-w-md w-full mx-4"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-heading font-bold text-lg text-foreground">Submit Homework</h3>
                <button
                  onClick={() => setSubmitDialogId(null)}
                  className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mb-6">
                <p className="text-sm font-body font-medium text-foreground">{activeDialog.title}</p>
                <p className="text-xs text-muted-foreground font-body mt-0.5">{activeDialog.subject} · Due {activeDialog.due}</p>
              </div>

              {/* File Upload Area */}
              <div
                onClick={handleFileSelect}
                className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors mb-6"
              >
                {fileName ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileUp size={16} className="text-success" />
                    <span className="text-sm font-body font-medium text-foreground">{fileName}</span>
                    <CheckCircle2 size={14} className="text-success" />
                  </div>
                ) : (
                  <>
                    <Upload size={24} className="text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm font-body text-muted-foreground">Click to select a file</p>
                    <p className="text-[11px] font-body text-muted-foreground mt-1">PDF, DOCX, or images up to 10MB</p>
                  </>
                )}
              </div>

              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setSubmitDialogId(null)} className="rounded-xl">
                  Cancel
                </Button>
                <Button
                  variant="hero"
                  onClick={() => handleSubmit(activeDialog.id)}
                  disabled={!fileName}
                  className="rounded-xl"
                >
                  <Upload size={14} className="mr-1.5" /> Submit
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </StudentLayout>
  );
};

export default StudentHomework;
