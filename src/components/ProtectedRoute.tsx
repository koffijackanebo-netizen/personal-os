import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export default function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">Chargement…</div>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <Outlet />;
}
