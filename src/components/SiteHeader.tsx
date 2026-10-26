import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Box } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";

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
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-bold tracking-tight">
          <span className="grid size-7 place-items-center rounded-md bg-gradient-primary text-primary-foreground">
            <Box className="size-4" />
          </span>
          3DIT
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link to="/sample" className="px-3 py-2 text-muted-foreground hover:text-foreground">
            Viewer
          </Link>
          {session ? (
            <>
              <Link to="/create" className="px-3 py-2 text-muted-foreground hover:text-foreground">
                Create
              </Link>
              <Link to="/library" className="px-3 py-2 text-muted-foreground hover:text-foreground">
                Library
              </Link>
              <Button variant="ghost" size="sm" onClick={signOut}>
                Sign out
              </Button>
            </>
          ) : (
            <Button asChild size="sm">
              <Link to="/auth">Sign in</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
