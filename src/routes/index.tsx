import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Box, Download, ImageUp, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Majoto 3D — Your imagination. Another dimension." },
      { name: "description", content: "Turn a photo into a 3D model with Majoto 3D. Preview it in your browser and download STL, OBJ or GLB." },
      { property: "og:title", content: "Majoto 3D — Your imagination. Another dimension." },
      { property: "og:description", content: "Turn a photo into a 3D model." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const steps = [
  { icon: ImageUp, title: "Upload a photo", text: "One clear picture of a single object works best." },
  { icon: Sparkles, title: "Generate your model", text: "Our own AI server rebuilds the object in 3D." },
  { icon: Download, title: "Preview and download", text: "Spin it around, then download STL, OBJ or GLB." },
];

function Index() {
  return (
    <main>
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:grid-cols-2 md:py-24">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-lime px-3 py-1 text-xs font-bold text-accent-foreground">
            Photo → 3D model
          </span>
          <h1 className="mt-5 text-5xl font-bold leading-[1.05] md:text-6xl">
            Your imagination. <span className="text-primary">Another dimension.</span>
          </h1>
          <p className="mt-5 max-w-md text-lg text-muted-foreground">Turn a photo into a 3D model.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="hero" size="lg">
              <Link to="/create">
                Create your first model <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-full">
              <Link to="/sample">Try the viewer</Link>
            </Button>
          </div>
        </div>

        {/* Placeholder: replace with a real photo + generated model pair once a public example is chosen. */}
        <div className="relative grid grid-cols-2 gap-3 rounded-3xl border border-border bg-card p-3 shadow-card">
          <div className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-2xl bg-secondary text-muted-foreground">
            <ImageUp className="size-8" />
            <span className="text-sm font-semibold">Your photo</span>
          </div>
          <div className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-2xl bg-viewport text-viewport-foreground">
            <Box className="size-8 motion-safe:animate-[spin_12s_linear_infinite]" />
            <span className="text-sm font-semibold">Your 3D model</span>
          </div>
          <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            Example placeholder — real before/after coming soon
          </span>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <h2 className="text-3xl font-bold">How it works</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <div
              key={s.title}
              className="rounded-3xl border border-border bg-card p-6 shadow-card transition-transform hover:-translate-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <s.icon className="size-5" />
                </span>
                <span className="font-display text-sm font-semibold text-muted-foreground">Step {i + 1}</span>
              </div>
              <h3 className="mt-5 text-xl font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-viewport p-8 text-viewport-foreground md:flex-row md:items-center md:p-12">
          <div>
            <h2 className="text-3xl font-bold">Got a photo handy?</h2>
            <p className="mt-2 opacity-80">Results vary with the photo — we'll check it and give tips before you generate.</p>
          </div>
          <Button asChild variant="hero" size="lg">
            <Link to="/create">Create your first model</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
