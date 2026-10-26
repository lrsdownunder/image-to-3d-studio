import { createFileRoute } from "@tanstack/react-router";
import { LazyViewer } from "@/components/LazyViewer";

export const Route = createFileRoute("/sample")({
  head: () => ({
    meta: [
      { title: "3D viewer preview — 3DIT" },
      { name: "description", content: "Try the 3DIT viewer: spin, zoom, wireframe and STL/OBJ/GLB download with a sample shape." },
      { property: "og:title", content: "3D viewer preview — 3DIT" },
      { property: "og:description", content: "Spin, zoom and download a sample 3D shape." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SamplePage,
});

function SamplePage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Viewer preview</h1>
      <p className="mt-2 text-muted-foreground">
        Drag to spin, scroll to zoom. This is a built-in sample shape so you can test the viewer and downloads — your own models will open here the same way.
      </p>
      <div className="mt-6">
        <LazyViewer fileName="3dit-sample" />
      </div>
    </main>
  );
}
