import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import AuthPage from "@/pages/AuthPage";
import DashboardPage from "@/pages/DashboardPage";
import GoalsPage from "@/pages/GoalsPage";
import ProjectsPage from "@/pages/ProjectsPage";
import TasksPage from "@/pages/TasksPage";
import HabitsPage from "@/pages/HabitsPage";
import ReviewPage from "@/pages/ReviewPage";
import DeepWorkPage from "@/pages/DeepWorkPage";
import AssistantPage from "@/pages/AssistantPage";
import FinancePage from "@/pages/FinancePage";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/goals" element={<GoalsPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/habits" element={<HabitsPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/deep-work" element={<DeepWorkPage />} />
            <Route path="/finance" element={<FinancePage />} />
            <Route path="/assistant" element={<AssistantPage />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  );
}
