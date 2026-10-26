import { lazy, Suspense, type ComponentProps } from "react";
import { ClientOnly } from "@tanstack/react-router";
import type ModelViewerType from "./ModelViewer";

const ModelViewer = lazy(() => import("./ModelViewer"));

const Fallback = () => (
  <div className="aspect-[4/3] w-full animate-pulse rounded-xl border border-border bg-viewport" />
);

export function LazyViewer(props: ComponentProps<typeof ModelViewerType>) {
  return (
    <ClientOnly fallback={<Fallback />}>
      <Suspense fallback={<Fallback />}>
        <ModelViewer {...props} />
      </Suspense>
    </ClientOnly>
  );
}
