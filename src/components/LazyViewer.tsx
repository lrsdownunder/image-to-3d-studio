import { Component, lazy, Suspense, type ComponentProps, type ReactNode } from "react";
import { ClientOnly } from "@tanstack/react-router";
import type ModelViewerType from "./ModelViewer";

const RELOAD_KEY = "3dit-viewer-reloaded";

// After an app update the browser can hold a stale copy of the viewer file, which makes the
// import fail. Reload the page once to pick up the fresh file instead of showing an error page.
const ModelViewer = lazy(() =>
  import("./ModelViewer").then(
    (m) => {
      sessionStorage.removeItem(RELOAD_KEY);
      return m;
    },
    (err) => {
      if (!sessionStorage.getItem(RELOAD_KEY)) {
        sessionStorage.setItem(RELOAD_KEY, "1");
        window.location.reload();
        return new Promise<never>(() => {});
      }
      throw err;
    },
  ),
);

const Fallback = () => (
  <div className="aspect-[4/3] w-full animate-pulse rounded-xl border border-border bg-viewport" />
);

/** Keeps a 3D viewer problem inside the viewer box instead of taking down the whole page. */
class ViewerBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null };
  static override getDerivedStateFromError(error: Error) {
    return { error };
  }
  override componentDidCatch(error: Error) {
    console.error("[3DIT] viewer error:", error);
  }
  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-xl border border-border bg-viewport p-6 text-center">
        <p className="font-medium text-foreground">The 3D view couldn't load.</p>
        <p className="max-w-md font-mono text-xs text-muted-foreground break-words">
          {this.state.error.message}
        </p>
        <button
          type="button"
          className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
      </div>
    );
  }
}

export function LazyViewer(props: ComponentProps<typeof ModelViewerType>) {
  return (
    <ClientOnly fallback={<Fallback />}>
      <ViewerBoundary>
        <Suspense fallback={<Fallback />}>
          <ModelViewer {...props} />
        </Suspense>
      </ViewerBoundary>
    </ClientOnly>
  );
}
