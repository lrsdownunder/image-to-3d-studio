import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Box } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/library")({
  head: () => ({
    meta: [
      { title: "Your library — 3DIT" },
      { name: "description", content: "All your 3D models and generation jobs." },
      { property: "og:title", content: "Your library — 3DIT" },
      { property: "og:description", content: "All your 3D models and generation jobs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LibraryPage,
});

function LibraryPage() {
  const models = useQuery({
    queryKey: ["models"],
    queryFn: async () => {
      const { data, error } = await supabase.from("models").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const jobs = useQuery({
    queryKey: ["jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generation_jobs")
        .select("*")
        .neq("status", "done")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Library</h1>
        <Button asChild variant="hero">
          <Link to="/create">New model</Link>
        </Button>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {models.data?.map((m) => (
          <Link
            key={m.id}
            to="/models/$id"
            params={{ id: m.id }}
            className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary"
          >
            <Box className="size-6 text-primary" />
            <h3 className="mt-3 font-semibold">{m.title}</h3>
            <p className="font-mono text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString()}</p>
          </Link>
        ))}
        {models.data?.length === 0 && (
          <p className="text-muted-foreground">No models yet. Finished models will appear here.</p>
        )}
      </div>

      {!!jobs.data?.length && (
        <section className="mt-12">
          <h2 className="text-lg font-semibold">Recent jobs</h2>
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card">
            {jobs.data.map((j) => (
              <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span className="font-mono text-xs text-muted-foreground">{new Date(j.created_at).toLocaleString()}</span>
                <span className="flex-1 truncate text-muted-foreground">{j.error}</span>
                <Badge variant={j.status === "failed" ? "destructive" : "secondary"}>{j.status}</Badge>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
