import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AnimatePresence, motion } from "framer-motion";

import { AuthProvider, RequireAuth } from "@/contexts/AuthContext";

// Public pages
import Index from "./pages/Index.tsx";
import Login from "./pages/Login.tsx";
import Signup from "./pages/Signup.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Pricing from "./pages/Pricing.tsx";
import NotFound from "./pages/NotFound.tsx";

// Student pages
import StudentDashboard from "./pages/student/StudentDashboard.tsx";
import LiveSession from "./pages/student/LiveSession.tsx";
import SessionSummary from "./pages/student/SessionSummary.tsx";
import StudentSettings from "./pages/student/StudentSettings.tsx";
import StudentHomework from "./pages/student/StudentHomework.tsx";

// Teacher pages
import TeacherDashboard from "./pages/teacher/TeacherDashboard.tsx";
import LiveClass from "./pages/teacher/LiveClass.tsx";
import TeacherStudents from "./pages/teacher/TeacherStudents.tsx";
import StudentDetail from "./pages/teacher/StudentDetail.tsx";
import TeacherHomework from "./pages/teacher/TeacherHomework.tsx";

// Parent pages
import ParentDashboard from "./pages/parent/ParentDashboard.tsx";
import ParentHomework from "./pages/parent/ParentHomework.tsx";
import ParentSettings from "./pages/parent/ParentSettings.tsx";

// Admin pages
import AdminDashboard from "./pages/admin/AdminDashboard.tsx";
import AdminTeachers from "./pages/admin/AdminTeachers.tsx";
import AdminSettings from "./pages/admin/AdminSettings.tsx";

const queryClient = new QueryClient();

const pageTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.25, ease: "easeInOut" },
};

const AnimatedPage = ({ children }: { children: React.ReactNode }) => (
  <motion.div {...pageTransition}>{children}</motion.div>
);

const AppRoutes = () => {
  const location = useLocation();

  return (
    <>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          {/* Public Routes */}
          <Route path="/" element={<AnimatedPage><Index /></AnimatedPage>} />
          <Route path="/login" element={<AnimatedPage><Login /></AnimatedPage>} />
          <Route path="/signup" element={<AnimatedPage><Signup /></AnimatedPage>} />
          <Route path="/dashboard" element={<AnimatedPage><Dashboard /></AnimatedPage>} />
          <Route path="/pricing" element={<AnimatedPage><Pricing /></AnimatedPage>} />

          {/* Student Routes — requires student login */}
          <Route path="/student/dashboard" element={<RequireAuth allowedRoles={["student"]}><AnimatedPage><StudentDashboard /></AnimatedPage></RequireAuth>} />
          <Route path="/student/session" element={<RequireAuth allowedRoles={["student"]}><AnimatedPage><LiveSession /></AnimatedPage></RequireAuth>} />
          <Route path="/student/session/:id/summary" element={<RequireAuth allowedRoles={["student"]}><AnimatedPage><SessionSummary /></AnimatedPage></RequireAuth>} />
          <Route path="/student/settings" element={<RequireAuth allowedRoles={["student"]}><AnimatedPage><StudentSettings /></AnimatedPage></RequireAuth>} />
          <Route path="/student/homework" element={<RequireAuth allowedRoles={["student"]}><AnimatedPage><StudentHomework /></AnimatedPage></RequireAuth>} />

          {/* Teacher Routes — requires teacher login */}
          <Route path="/teacher/dashboard" element={<RequireAuth allowedRoles={["teacher"]}><AnimatedPage><TeacherDashboard /></AnimatedPage></RequireAuth>} />
          <Route path="/teacher/live" element={<RequireAuth allowedRoles={["teacher"]}><AnimatedPage><LiveClass /></AnimatedPage></RequireAuth>} />
          <Route path="/teacher/students" element={<RequireAuth allowedRoles={["teacher"]}><AnimatedPage><TeacherStudents /></AnimatedPage></RequireAuth>} />
          <Route path="/teacher/students/:id" element={<RequireAuth allowedRoles={["teacher"]}><AnimatedPage><StudentDetail /></AnimatedPage></RequireAuth>} />
          <Route path="/teacher/homework" element={<RequireAuth allowedRoles={["teacher"]}><AnimatedPage><TeacherHomework /></AnimatedPage></RequireAuth>} />

          {/* Parent Routes — requires parent login */}
          <Route path="/parent/dashboard" element={<RequireAuth allowedRoles={["parent"]}><AnimatedPage><ParentDashboard /></AnimatedPage></RequireAuth>} />
          <Route path="/parent/homework" element={<RequireAuth allowedRoles={["parent"]}><AnimatedPage><ParentHomework /></AnimatedPage></RequireAuth>} />
          <Route path="/parent/settings" element={<RequireAuth allowedRoles={["parent"]}><AnimatedPage><ParentSettings /></AnimatedPage></RequireAuth>} />

          {/* Admin Routes — requires admin login */}
          <Route path="/admin/dashboard" element={<RequireAuth allowedRoles={["admin"]}><AnimatedPage><AdminDashboard /></AnimatedPage></RequireAuth>} />
          <Route path="/admin/teachers" element={<RequireAuth allowedRoles={["admin"]}><AnimatedPage><AdminTeachers /></AnimatedPage></RequireAuth>} />
          <Route path="/admin/settings" element={<RequireAuth allowedRoles={["admin"]}><AnimatedPage><AdminSettings /></AnimatedPage></RequireAuth>} />

          {/* Catch-all */}
          <Route path="*" element={<AnimatedPage><NotFound /></AnimatedPage>} />
        </Routes>
      </AnimatePresence>


    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
