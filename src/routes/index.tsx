import { createFileRoute, Link } from "@tanstack/react-router";
import { Camera, Cpu, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import hero from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "3DIT — Turn any photo into a 3D printable model" },
      { name: "description", content: "Upload one photo and 3DIT builds a 3D model you can spin, download as STL, OBJ or GLB, and print." },
      { property: "og:title", content: "3DIT — Turn any photo into a 3D printable model" },
      { property: "og:description", content: "One photo in, a printable 3D model out." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const steps = [
  { icon: Camera, title: "Upload a photo", text: "One clear picture of an object, pet or figure." },
  { icon: Cpu, title: "AI builds the shape", text: "Our own GPU servers rebuild it in 3D." },
  { icon: Printer, title: "Spin, download, print", text: "Get STL for your printer, plus OBJ and GLB." },
];

function Index() {
  return (
    <main className="bg-grid">
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-primary">Image → 3D → Print</p>
          <h1 className="mt-4 text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            Turn any photo into a <span className="text-gradient-primary">printable 3D model</span>.
          </h1>
          <p className="mt-5 max-w-md text-lg text-muted-foreground">
            Drop in a picture. 3DIT rebuilds it as a solid model you can spin around, download and send to your printer.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="hero" size="lg">
              <Link to="/create">Start creating</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/sample">Try the viewer</Link>
            </Button>
          </div>
        </div>
        <img
          src={hero}
          alt="An orange 3D printed fox next to the photo it was made from"
          width={1280}
          height={960}
          className="w-full rounded-2xl border border-border shadow-glow"
        />
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-24 md:grid-cols-3">
        {steps.map((s, i) => (
          <div key={s.title} className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <s.icon className="size-6 text-primary" />
              <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
            </div>
            <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
