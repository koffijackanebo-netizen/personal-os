import { NavLink, Outlet } from "react-router-dom";
import {
  Home,
  Target,
  FolderKanban,
  ListChecks,
  Repeat,
  Moon,
  Timer,
  MessageCircle,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

const NAV = [
  { to: "/", label: "Aujourd'hui", icon: Home, end: true },
  { to: "/goals", label: "Objectifs", icon: Target },
  { to: "/projects", label: "Projets", icon: FolderKanban },
  { to: "/tasks", label: "Tâches", icon: ListChecks },
  { to: "/habits", label: "Habitudes", icon: Repeat },
  { to: "/review", label: "Revue", icon: Moon },
  { to: "/deep-work", label: "Deep Work", icon: Timer },
  { to: "/assistant", label: "Assistant", icon: MessageCircle },
];

export default function Layout() {
  const { signOut } = useAuth();

  return (
    <div className="flex min-h-dvh bg-background">
      {/* Sidebar — desktop */}
      <aside className="hidden w-56 shrink-0 flex-col border-r bg-card md:flex">
        <div className="px-4 py-5">
          <p className="text-sm font-semibold tracking-tight">Personal OS</p>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-2">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-2">
          <button
            onClick={() => signOut()}
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </button>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-1 flex-col">
        {/* Topbar — mobile */}
        <header className="flex items-center justify-between border-b bg-card px-4 py-3 md:hidden">
          <p className="text-sm font-semibold tracking-tight">Personal OS</p>
          <button onClick={() => signOut()} className="text-muted-foreground">
            <LogOut className="h-4 w-4" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8 md:py-8">
            <Outlet />
          </div>
        </main>

        {/* Bottom nav — mobile */}
        <nav className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t bg-card md:hidden">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px]",
                  isActive ? "text-primary" : "text-muted-foreground",
                )
              }
            >
              <Icon className="h-5 w-5" />
              <span className="truncate">{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
