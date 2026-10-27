import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ImageUp, Loader2, PlugZap, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createImageTo3DJob, getBackendStatus } from "@/lib/generation.functions";
import { checkPhoto } from "@/lib/photo-check.functions";
import type { PhotoCheck } from "@/lib/photo-check";
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
  const checkFn = useServerFn(checkPhoto);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [check, setCheck] = useState<PhotoCheck | null>(null);
  const [checking, setChecking] = useState(false);

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

  function pick(f: File | undefined) {
    if (!f) return;
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) {
      toast.error("Please use a PNG, JPG or WebP image.");
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      toast.error("Image must be under 20 MB.");
      return;
    }
    setFile(f);
    setJob(null);
    setUploadedPath(null);
    setCheck(null);
  }

  /** Upload once; reuse the same stored photo for the AI check and the 3D job. */
  async function ensureUploaded(): Promise<string> {
    if (uploadedPath) return uploadedPath;
    if (!file) throw new Error("Choose a photo first");
    const ext = (file.type.split("/")[1] ?? "png").replace("jpeg", "jpg");
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("inputs").upload(path, file, { contentType: file.type });
    if (error) throw error;
    setUploadedPath(path);
    return path;
  }

  async function runCheck() {
    setChecking(true);
    setCheck(null);
    try {
      const path = await ensureUploaded();
      const res = await checkFn({ data: { inputPath: path } });
      if (res.error || !res.result) toast.error(res.error ?? "The AI couldn't check this photo.");
      else setCheck(res.result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not check photo");
    } finally {
      setChecking(false);
    }
  }

  async function generate() {
    if (!file) return;
    setBusy(true);
    try {
      const path = await ensureUploaded();
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
        {backend?.configured && (
          <div className="mt-6 flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm">
            <span
              className={`size-2 rounded-full ${backend.modelLoaded ? "bg-success" : backend.reachable ? "bg-warning" : "bg-destructive"}`}
            />
            {backend.modelLoaded
              ? `AI server ready${backend.gpu ? ` · ${backend.gpu}` : ""}`
              : backend.loading
                ? "AI server is starting up (loading the model)…"
                : backend.error ?? "AI server not ready"}
          </div>
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
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button variant="outline" size="lg" disabled={!file || checking || busy} onClick={runCheck}>
            {checking ? <Loader2 className="animate-spin" /> : <Sparkles />} Check my photo
          </Button>
          <Button variant="hero" size="lg" disabled={!file || busy} onClick={generate}>
            {busy && <Loader2 className="animate-spin" />} Generate 3D model
          </Button>
        </div>
      </section>

      <section className="space-y-6 rounded-xl border border-border bg-card p-6">
        <div>
          <h2 className="font-semibold">Photo check</h2>
          {checking ? (
            <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> The AI is looking at your photo…
            </p>
          ) : check ? (
            <PhotoCheckResult check={check} />
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Tap "Check my photo" for an AI opinion on how well it will turn into a printable model.
            </p>
          )}
        </div>
        <div>
          <h2 className="font-semibold">Status</h2>
          {!job ? (
            <p className="mt-2 text-sm text-muted-foreground">Your job will appear here.</p>
          ) : (
            <JobStatus job={job} />
          )}
        </div>
      </section>
    </main>
  );
}

function PhotoCheckResult({ check }: { check: PhotoCheck }) {
  const tone = { good: "text-success", okay: "text-warning", poor: "text-destructive" }[check.verdict];
  const label = { good: "Great for 3D", okay: "Usable, could be better", poor: "Likely to give a poor model" }[check.verdict];
  return (
    <div className="mt-3 space-y-4 text-sm">
      <div className="flex items-baseline justify-between">
        <span className={`font-semibold ${tone}`}>{label}</span>
        <span className="font-mono text-muted-foreground">{check.score}/100</span>
      </div>
      <Progress value={check.score} />
      <p className="text-muted-foreground">{check.summary}</p>
      {check.strengths.length > 0 && (
        <ul className="space-y-1">
          {check.strengths.map((s) => (
            <li key={s} className="flex gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> {s}
            </li>
          ))}
        </ul>
      )}
      {check.issues.length > 0 && (
        <div>
          <h3 className="mb-1 font-medium">How to improve the photo</h3>
          <ul className="space-y-2">
            {check.issues.map((i) => (
              <li key={i.problem} className="flex gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                <span>
                  {i.problem} <span className="text-muted-foreground">— {i.fix}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {check.print_tips.length > 0 && (
        <div>
          <h3 className="mb-1 font-medium">Printing tips</h3>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            {check.print_tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-muted-foreground">AI advice — it can be wrong. You can still generate either way.</p>
    </div>
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
