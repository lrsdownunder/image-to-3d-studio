import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { Logo } from "@/components/Logo";

const navLink =
  "rounded-full px-3 py-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground [&.active]:bg-secondary [&.active]:text-foreground";

export function SiteHeader() {
  const { session } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4">
        <Link to="/" aria-label="Majoto 3D home">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1 text-sm font-semibold">
          <Link to="/sample" className={navLink}>
            Viewer
          </Link>
          {session ? (
            <>
              <Link to="/create" className={navLink}>
                Create
              </Link>
              <Link to="/library" className={navLink}>
                Library
              </Link>
              <Button variant="ghost" size="sm" className="rounded-full" onClick={signOut}>
                Sign out
              </Button>
            </>
          ) : (
            <Button asChild size="sm" className="rounded-full">
              <Link to="/auth">Sign in</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
