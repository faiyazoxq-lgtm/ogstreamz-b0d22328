import { Link } from "@tanstack/react-router";

const links = [
  { to: "/music", label: "MusicHUB" },
  { to: "/jokes", label: "JokesHUB" },
  { to: "/tools", label: "ToolHUB" },
] as const;

export function NavBar() {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border">
      <nav className="max-w-7xl mx-auto flex items-center justify-between px-5 sm:px-8 h-16">
        <Link to="/" className="flex items-center gap-2 group">
          <span className="font-[Montserrat] font-black text-lg sm:text-xl tracking-tight">
            0G<span className="text-gradient-gold">-STREAMZ</span>
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
        </ul>
      </nav>
    </header>
  );
}