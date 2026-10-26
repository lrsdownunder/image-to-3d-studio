import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LazyViewer } from "@/components/LazyViewer";

export const Route = createFileRoute("/_authenticated/models/$id")({
  head: () => ({
    meta: [
      { title: "Model — 3DIT" },
      { name: "description", content: "View and download your 3D model." },
      { property: "og:title", content: "Model — 3DIT" },
      { property: "og:description", content: "View and download your 3D model." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ModelPage,
});

async function sign(path: string | null) {
  if (!path) return undefined;
  const { data } = await supabase.storage.from("models").createSignedUrl(path, 60 * 60);
  return data?.signedUrl;
}

function ModelPage() {
  const { id } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["model", id],
    queryFn: async () => {
      const { data: m, error } = await supabase.from("models").select("*").eq("id", id).single();
      if (error) throw error;
      const [glb, obj, stl] = await Promise.all([sign(m.glb_path), sign(m.obj_path), sign(m.stl_path)]);
      return { model: m, urls: { glb, obj, stl } };
    },
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {error && <p className="text-destructive">This model could not be found.</p>}
      {data && (
        <>
          <h1 className="text-3xl font-bold tracking-tight">{data.model.title}</h1>
          {data.model.face_count && (
            <p className="font-mono text-xs text-muted-foreground">{data.model.face_count.toLocaleString()} faces</p>
          )}
          <div className="mt-6">
            {data.urls.glb ? (
              <LazyViewer glbUrl={data.urls.glb} downloads={data.urls} fileName={data.model.title} />
            ) : (
              <p className="text-muted-foreground">No preview file for this model.</p>
            )}
          </div>
        </>
      )}
    </main>
  );
}
