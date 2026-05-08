import { Link } from "@tanstack/react-router";
import { User, LogIn } from "lucide-react";
import logo from "@/assets/logo.jpg";
import { useAuth } from "@/hooks/use-auth";

const links = [
  { to: "/music", label: "MusicHUB" },
  { to: "/jokes", label: "JokesHUB" },
  { to: "/tools", label: "ToolHUB" },
] as const;

export function NavBar() {
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border">
      <nav className="max-w-7xl mx-auto flex items-center justify-between px-5 sm:px-8 h-16">
        <Link to="/" className="flex items-center gap-2 group">
          <img src={logo} alt="0G-PORTAL" className="h-9 w-9 rounded-md object-cover ring-1 ring-[oklch(0.72_0.22_245/0.5)]" />
          <span className="font-[Montserrat] font-black text-lg sm:text-xl tracking-tight text-metallic">
            0G-PORTAL
          </span>
        </Link>
        <ul className="flex items-center gap-1 sm:gap-2">
          {links.map((l) => (
            <li key={l.to}>
              <Link
                to={l.to}
                className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-muted-foreground hover:text-gold transition-colors rounded-md"
                activeProps={{ className: "px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-gold rounded-md bg-secondary" }}
              >
                {l.label}
              </Link>
            </li>
          ))}
          <li>
            {user ? (
              <Link
                to="/profile"
                className="ml-1 inline-flex items-center gap-2 btn-glass-blue px-3 sm:px-4 py-2 rounded-md text-xs uppercase tracking-[0.2em] font-bold text-white"
              >
                <User className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Vault</span>
              </Link>
            ) : (
              <Link
                to="/auth"
                className="ml-1 inline-flex items-center gap-2 btn-glass-blue px-3 sm:px-4 py-2 rounded-md text-xs uppercase tracking-[0.2em] font-bold text-white"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Join the Syndicate</span>
                <span className="sm:hidden">Join</span>
              </Link>
            )}
          </li>
        </ul>
      </nav>
    </header>
  );
}