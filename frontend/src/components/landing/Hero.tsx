import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const [mouse, setMouse] = useState({ x: "50%", y: "50%" });

  const { scrollY } = useScroll();
  const blurOpacity = useTransform(scrollY, [0, 500], [1, 0]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMouse({ x: `${e.clientX}px`, y: `${e.clientY}px` });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative flex flex-col items-center overflow-hidden bg-background"
    >
      {/* Soft background orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[15%] left-[10%] w-[600px] h-[600px] rounded-full bg-primary/5 blur-[140px]" />
        <div className="absolute bottom-[10%] right-[8%] w-[500px] h-[500px] rounded-full bg-secondary/6 blur-[120px]" />
        <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-primary/3 blur-[100px]" />
      </div>

      {/* Full-section blur overlay — lighter, fades on scroll */}
      <motion.div
        className="fixed inset-0 z-30 pointer-events-none"
        style={{
          opacity: blurOpacity,
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          maskImage: `radial-gradient(circle 260px at ${mouse.x} ${mouse.y}, transparent 0%, rgba(0,0,0,0.05) 60%, black 100%)`,
          WebkitMaskImage: `radial-gradient(circle 260px at ${mouse.x} ${mouse.y}, transparent 0%, rgba(0,0,0,0.05) 60%, black 100%)`,
        }}
      />

      {/* ===== ABOVE THE FOLD: Logo + tagline + by unblur ===== */}
      <div className="relative z-20 flex flex-col items-center text-center px-6 min-h-screen justify-center">
        {/* Big Lumio Logo + Name */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex items-center gap-6 sm:gap-8"
        >
          <img
            src="/assets/Logos/logo icon/lumio icon deep violet.png"
            alt="Lumio"
            className="w-36 h-36 sm:w-48 sm:h-48 lg:w-60 lg:h-60 object-contain drop-shadow-lg"
          />
          <h1 className="font-heading font-extrabold text-[7rem] sm:text-[9rem] lg:text-[12rem] tracking-tight text-foreground leading-none select-none">
            lumio
          </h1>
        </motion.div>

        {/* Tagline — tight below logo */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="text-lg sm:text-xl text-muted-foreground font-body max-w-lg mx-auto leading-relaxed mt-3"
        >
          Where every student is{" "}
          <span className="text-gradient font-semibold">seen</span>, every struggle{" "}
          <span className="text-gradient font-semibold">understood</span>
        </motion.p>

        {/* by unblur — premium byline */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0, duration: 0.6, ease: "easeOut" }}
          className="mt-6 flex items-center gap-2"
        >
          <span className="h-px w-8 bg-gradient-to-r from-transparent via-muted-foreground/30 to-transparent" />
          <p className="text-sm font-body tracking-[0.2em] uppercase text-muted-foreground/60">
            by{" "}
            <span
              className="font-semibold tracking-widest"
              style={{
                background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--secondary)), hsl(var(--primary)))",
                backgroundSize: "200% auto",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              unblur
            </span>
          </p>
          <span className="h-px w-8 bg-gradient-to-r from-transparent via-muted-foreground/30 to-transparent" />
        </motion.div>
      </div>

      {/* ===== BELOW THE FOLD: CTAs — first thing visible on scroll ===== */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.6 }}
        className="relative z-20 flex flex-col sm:flex-row items-center justify-center gap-4 py-20"
      >
        <Button variant="hero" size="xl" asChild>
          <Link to="/signup">
            Start Free <ArrowRight className="ml-1" size={18} />
          </Link>
        </Button>
        <Button variant="hero-outline" size="xl" asChild>
          <Link to="/login">Log In</Link>
        </Button>
      </motion.div>

      {/* Scroll fade gradient at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none" />
    </section>
  );
}
