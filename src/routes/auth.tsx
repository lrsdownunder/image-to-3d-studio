import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Majoto 3D" },
      { name: "description", content: "Sign in to Majoto 3D to create and keep your 3D models." },
      { property: "og:title", content: "Sign in — Majoto 3D" },
      { property: "og:description", content: "Sign in to create 3D models from photos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/create", replace: true });
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) navigate({ to: "/create", replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) toast.success("Check your email to confirm your account.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) toast.error(result.error.message ?? "Google sign-in failed");
  }

  return (
    <main className="mx-auto flex min-h-[80vh] max-w-sm flex-col justify-center px-4">
      <h1 className="text-3xl font-bold tracking-tight">{mode === "in" ? "Welcome back" : "Create your account"}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Your models are saved to your private library.</p>
      <Button variant="outline" className="mt-6" onClick={google}>
        Continue with Google
      </Button>
      <div className="my-4 text-center font-mono text-xs text-muted-foreground">or</div>
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pw">Password</Label>
          <Input id="pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" variant="hero" className="w-full" disabled={busy}>
          {mode === "in" ? "Sign in" : "Sign up"}
        </Button>
      </form>
      <button
        className="mt-4 text-sm text-muted-foreground hover:text-foreground"
        onClick={() => setMode(mode === "in" ? "up" : "in")}
      >
        {mode === "in" ? "New here? Create an account" : "Already have an account? Sign in"}
      </button>
    </main>
  );
}
