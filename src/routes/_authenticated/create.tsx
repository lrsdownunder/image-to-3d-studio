import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ImageUp, Loader2, PlugZap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createImageTo3DJob, getBackendStatus } from "@/lib/generation.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/create")({
  head: () => ({
    meta: [
      { title: "Create a 3D model — 3DIT" },
      { name: "description", content: "Upload a photo and turn it into a 3D model." },
      { property: "og:title", content: "Create a 3D model — 3DIT" },
      { property: "og:description", content: "Upload a photo and turn it into a 3D model." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CreatePage,
});

type Job = Tables<"generation_jobs">;

function CreatePage() {
  const { userId } = Route.useRouteContext();
  const statusFn = useServerFn(getBackendStatus);
  const createFn = useServerFn(createImageTo3DJob);
  const { data: backend } = useQuery({ queryKey: ["backend-status"], queryFn: () => statusFn() });

  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState<Job | null>(null);

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Live progress for the current job.
  useEffect(() => {
    if (!job?.id) return;
    const channel = supabase
      .channel(`job-${job.id}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "generation_jobs", filter: `id=eq.${job.id}` },
        (payload) => setJob(payload.new as Job),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [job?.id]);

  function pick(f: File | undefined): void {
    if (!f) return;
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) return toast.error("Please use a PNG, JPG or WebP image.");
    if (f.size > 20 * 1024 * 1024) return toast.error("Image must be under 20 MB.");
    setFile(f);
    setJob(null);
  }

  async function generate() {
    if (!file) return;
    setBusy(true);
    try {
      const ext = file.type.split("/")[1].replace("jpeg", "jpg");
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("inputs").upload(path, file, { contentType: file.type });
      if (error) throw error;
      const res = await createFn({ data: { inputPath: path, title: title || undefined } });
      const { data } = await supabase.from("generation_jobs").select("*").eq("id", res.jobId).single();
      setJob(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start generation");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-[1fr_1fr]">
      <section>
        <h1 className="text-3xl font-bold tracking-tight">Image to 3D</h1>
        <p className="mt-2 text-muted-foreground">Best results: one object, plain background, good light.</p>

        {backend && !backend.configured && (
          <Alert className="mt-6 border-warning/40">
            <PlugZap className="size-4 text-warning" />
            <AlertTitle>Generation server not connected yet</AlertTitle>
            <AlertDescription>
              Uploading works, but no 3D model will be made until the TRELLIS.2 server is running on RunPod.
              Meanwhile you can <Link to="/sample" className="text-primary underline">try the viewer</Link>.
            </AlertDescription>
          </Alert>
        )}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            pick(e.dataTransfer.files[0]);
          }}
          className="mt-6 grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-card transition-colors hover:border-primary"
        >
          {preview ? (
            <img src={preview} alt="Selected" className="h-full w-full object-contain" />
          ) : (
            <span className="flex flex-col items-center gap-2 text-muted-foreground">
              <ImageUp className="size-8 text-primary" />
              Drop a photo or click to choose
              <span className="font-mono text-xs">PNG · JPG · WebP · max 20 MB</span>
            </span>
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
        />

        <div className="mt-4 space-y-1">
          <Label htmlFor="title">Name (optional)</Label>
          <Input id="title" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Garden gnome" />
        </div>
        <Button variant="hero" size="lg" className="mt-4 w-full" disabled={!file || busy} onClick={generate}>
          {busy && <Loader2 className="animate-spin" />} Generate 3D model
        </Button>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="font-semibold">Status</h2>
        {!job ? (
          <p className="mt-2 text-sm text-muted-foreground">Your job will appear here.</p>
        ) : (
          <JobStatus job={job} />
        )}
      </section>
    </main>
  );
}

function JobStatus({ job }: { job: Job }) {
  const label = { queued: "Waiting for a GPU", processing: "Building your model", done: "Done", failed: "Didn't work" }[job.status];
  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="font-mono text-muted-foreground">{job.progress}%</span>
      </div>
      <Progress value={job.progress} />
      {job.status === "failed" && <p className="text-sm text-destructive">{job.error}</p>}
      {job.status === "done" && (
        <Button asChild>
          <Link to="/library">Open in library</Link>
        </Button>
      )}
    </div>
  );
}
