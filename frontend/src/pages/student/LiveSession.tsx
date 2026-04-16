import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useNavigate, Link } from "react-router-dom";
import { Square, Coffee, Play, Minus, Plus, RotateCcw } from "lucide-react";

const PRESETS = [15, 25, 30, 45, 60];

const LiveSession = () => {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"setup" | "active" | "paused">("setup");
  const [totalMinutes, setTotalMinutes] = useState(25);
  const [remaining, setRemaining] = useState(25 * 60);
  const [showConfirm, setShowConfirm] = useState(false);

  // Countdown timer
  useEffect(() => {
    if (phase !== "active") return;
    if (remaining <= 0) {
      // Timer finished
      navigate("/student/session/1/summary", { state: { durationSeconds: totalMinutes * 60 } });
      return;
    }
    const interval = setInterval(() => setRemaining((r) => r - 1), 1000);
    return () => clearInterval(interval);
  }, [phase, remaining, navigate]);

  // ESC to end
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase !== "setup") setShowConfirm(true);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const progress = phase === "setup" ? 0 : 1 - remaining / (totalMinutes * 60);
  const circumference = 2 * Math.PI * 140;
  const strokeDashoffset = circumference - progress * circumference;

  const startSession = useCallback(() => {
    setRemaining(totalMinutes * 60);
    setPhase("active");
  }, [totalMinutes]);

  const togglePause = () => {
    setPhase((p) => (p === "active" ? "paused" : "active"));
  };

  const handleEnd = () => {
    setPhase("setup");
    navigate("/student/session/1/summary", { state: { durationSeconds: totalMinutes * 60 - remaining } });
  };

  const adjustTime = (delta: number) => {
    setTotalMinutes((m) => Math.max(5, Math.min(120, m + delta)));
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center relative">
      {/* Minimal top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-8 py-4">
        <Link to="/student/dashboard" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-gradient-primary rounded-lg flex items-center justify-center">
            <img src="/assets/Logos/logo icon/lumio icon white.png" alt="Lumio" className="w-5 h-5 object-contain" />
          </div>
          <span className="font-heading font-bold text-sm text-foreground">lumio</span>
        </Link>
        {phase !== "setup" && (
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-body">
            <span className={`w-2 h-2 rounded-full ${phase === "active" ? "bg-success animate-pulse" : "bg-warning"}`} />
            {phase === "active" ? "Session Active" : "Paused"}
          </div>
        )}
      </div>

      {/* Setup phase */}
      {phase === "setup" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center"
        >
          <h2 className="font-heading font-extrabold text-2xl text-foreground mb-2">
            Set your study timer
          </h2>
          <p className="text-sm text-muted-foreground font-body mb-10">
            How long do you want to focus?
          </p>

          {/* Time picker */}
          <div className="flex items-center gap-6 mb-8">
            <button
              onClick={() => adjustTime(-5)}
              className="w-12 h-12 rounded-xl bg-muted/40 hover:bg-muted/60 flex items-center justify-center text-foreground transition-colors"
            >
              <Minus size={20} />
            </button>
            <div className="text-center">
              <span className="font-heading font-extrabold text-7xl tabular-nums text-foreground">
                {totalMinutes}
              </span>
              <p className="text-sm text-muted-foreground font-body mt-1">minutes</p>
            </div>
            <button
              onClick={() => adjustTime(5)}
              className="w-12 h-12 rounded-xl bg-muted/40 hover:bg-muted/60 flex items-center justify-center text-foreground transition-colors"
            >
              <Plus size={20} />
            </button>
          </div>

          {/* Quick presets */}
          <div className="flex gap-2 mb-10">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setTotalMinutes(p)}
                className={`px-4 py-2 rounded-xl text-sm font-body font-medium transition-all ${
                  totalMinutes === p
                    ? "bg-primary text-primary-foreground shadow-soft"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
                }`}
              >
                {p}m
              </button>
            ))}
          </div>

          <Button variant="hero" size="xl" onClick={startSession}>
            <Play size={18} className="mr-2" /> Start Focusing
          </Button>
        </motion.div>
      )}

      {/* Active / Paused phase */}
      {phase !== "setup" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center"
        >
          {/* Timer ring */}
          <div className="relative flex items-center justify-center mb-10">
            <svg width="320" height="320" viewBox="0 0 320 320" className="transform -rotate-90">
              {/* Background ring */}
              <circle
                cx="160" cy="160" r="140"
                fill="none"
                stroke="hsl(var(--border))"
                strokeWidth="6"
                opacity={0.4}
              />
              {/* Progress ring */}
              <motion.circle
                cx="160" cy="160" r="140"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                animate={{ strokeDashoffset }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                opacity={0.8}
              />
            </svg>

            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.p
                key={remaining}
                className="font-heading font-extrabold text-6xl text-foreground tabular-nums"
              >
                {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
              </motion.p>
              <p className="text-sm font-body text-muted-foreground mt-2">
                {phase === "paused" ? "Paused — take a break ☕" : "Stay focused"}
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4">
            {/* Pause / Resume with coffee icon */}
            <Button
              variant="outline"
              size="lg"
              onClick={togglePause}
              className="rounded-2xl gap-2"
            >
              {phase === "paused" ? (
                <>
                  <Play size={16} /> Resume
                </>
              ) : (
                <>
                  <Coffee size={16} /> Pause
                </>
              )}
            </Button>

            {/* End Session */}
            <Button
              variant="outline"
              size="lg"
              onClick={() => setShowConfirm(true)}
              className="rounded-2xl border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground gap-2"
            >
              <Square size={14} /> End Session
            </Button>
          </div>

          <p className="text-xs text-muted-foreground font-body mt-4">Press ESC to end</p>
        </motion.div>
      )}

      {/* Confirm dialog */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/20 backdrop-blur-sm flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-card rounded-2xl p-8 shadow-elevated border border-border max-w-sm text-center"
            >
              <h3 className="font-heading font-bold text-lg text-foreground mb-2">End session?</h3>
              <p className="text-sm text-muted-foreground font-body mb-6">
                You've studied for {Math.floor((totalMinutes * 60 - remaining) / 60)} min {(totalMinutes * 60 - remaining) % 60}s. Your session data will be saved.
              </p>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={() => setShowConfirm(false)} className="rounded-xl">
                  Continue
                </Button>
                <Button variant="destructive" onClick={handleEnd} className="rounded-xl">
                  End Session
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LiveSession;
