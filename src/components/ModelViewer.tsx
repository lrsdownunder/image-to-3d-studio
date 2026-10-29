// Browser-only: import via React.lazy so three.js never runs during SSR.
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import {
  Bounds,
  Center,
  ContactShadows,
  Environment,
  Grid,
  Lightformer,
  OrbitControls,
  useGLTF,
} from "@react-three/drei";
import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type Props = {
  glbUrl?: string;
  /** Download links for a generated model; omit for the sample (exported in-browser). */
  downloads?: { glb?: string | undefined; obj?: string | undefined; stl?: string | undefined };
  fileName?: string;
};

function applyWireframe(root: THREE.Object3D, on: boolean) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((m) => ((m as THREE.MeshStandardMaterial).wireframe = on));
  });
}

/**
 * AI-generated meshes often have some triangles wound the wrong way. With the default
 * one-sided material those faces are invisible, which shows up as dark speckles/holes.
 * Drawing both sides makes the surface look solid regardless of winding.
 */
function showBothSides(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((m) => {
      m.side = THREE.DoubleSide;
      m.needsUpdate = true;
    });
  });
}

function GlbModel({ url, wireframe, onLoad }: { url: string; wireframe: boolean; onLoad: (o: THREE.Object3D) => void }) {
  const { scene } = useGLTF(url);
  useEffect(() => {
    showBothSides(scene);
  }, [scene]);
  useEffect(() => {
    onLoad(scene);
  }, [scene, onLoad]);
  useEffect(() => {
    applyWireframe(scene, wireframe);
  }, [scene, wireframe]);
  return <primitive object={scene} />;
}

function SampleModel({ wireframe, onLoad }: { wireframe: boolean; onLoad: (o: THREE.Object3D) => void }) {
  const ref = useRef<THREE.Mesh>(null);
  useEffect(() => {
    if (ref.current) onLoad(ref.current);
  }, [onLoad]);
  return (
    <mesh ref={ref} castShadow>
      <torusKnotGeometry args={[0.8, 0.28, 220, 32]} />
      <meshStandardMaterial color="#e8803a" roughness={0.55} metalness={0.05} wireframe={wireframe} />
    </mesh>
  );
}

function download(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export default function ModelViewer({ glbUrl, downloads, fileName = "3dit-model" }: Props) {
  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const objectRef = useRef<THREE.Object3D | null>(null);
  const onLoad = useMemo(
    () => (o: THREE.Object3D) => {
      objectRef.current = o;
    },
    [],
  );

  function exportLocal(kind: "glb" | "obj" | "stl") {
    const obj = objectRef.current;
    if (!obj) return;
    if (kind === "stl") {
      const data = new STLExporter().parse(obj, { binary: true }) as DataView;
      download(new Blob([data.buffer as ArrayBuffer], { type: "model/stl" }), `${fileName}.stl`);
    } else if (kind === "obj") {
      download(new Blob([new OBJExporter().parse(obj)], { type: "text/plain" }), `${fileName}.obj`);
    } else {
      new GLTFExporter().parse(
        obj,
        (res) => download(new Blob([res as ArrayBuffer], { type: "model/gltf-binary" }), `${fileName}.glb`),
        () => {},
        { binary: true },
      );
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-border bg-viewport sm:aspect-[4/3]">
        <Canvas shadows dpr={[1, 2]} camera={{ position: [2.5, 1.8, 3], fov: 40 }}>
          <color attach="background" args={["#222222"]} />
          <ambientLight intensity={0.4} />
          <directionalLight position={[4, 6, 3]} intensity={1.6} castShadow />
          <Environment resolution={128}>
            <Lightformer intensity={2} position={[0, 5, 0]} scale={[10, 10, 1]} />
            <Lightformer intensity={1.2} color="#c9bcff" position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 1, 1]} />
            <Lightformer intensity={0.8} position={[5, 1, 1]} rotation-y={-Math.PI / 2} scale={[20, 1, 1]} />
          </Environment>
          <Suspense fallback={null}>
            <Bounds fit clip observe margin={1.3}>
              <Center top>
                {glbUrl ? (
                  <GlbModel url={glbUrl} wireframe={wireframe} onLoad={onLoad} />
                ) : (
                  <SampleModel wireframe={wireframe} onLoad={onLoad} />
                )}
              </Center>
            </Bounds>
          </Suspense>
          <ContactShadows position={[0, 0, 0]} opacity={0.5} scale={8} blur={2.4} far={3} />
          <Grid
            position={[0, -0.001, 0]}
            args={[10, 10]}
            cellColor="#363636"
            sectionColor="#4d4470"
            fadeDistance={12}
            infiniteGrid
          />
          <OrbitControls makeDefault autoRotate={autoRotate} autoRotateSpeed={1.2} enableDamping />
        </Canvas>
        {!glbUrl && (
          <span className="absolute left-3 top-3 rounded-full bg-viewport-foreground/10 px-3 py-1 font-mono text-xs text-viewport-foreground">
            SAMPLE SHAPE — not AI generated
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Switch id="wire" checked={wireframe} onCheckedChange={setWireframe} />
            X
          <div className="flex items-center gap-2">
            <Switch id="spin" checked={autoRotate} onCheckedChange={setAutoRotate} />
            <Label htmlFor="spin">Auto-spin</Label>
          </div>
        </div>
        <div className="flex gap-2">
          {(["stl", "obj", "glb"] as const).map((k) =>
            downloads ? (
              downloads[k] ? (
                <Button key={k} asChild size="sm" variant={k === "stl" ? "default" : "outline"}>
                  <a href={downloads[k]} download={`${fileName}.${k}`}>
                    {k.toUpperCase()}
                  </a>
                </Button>
              ) : null
            ) : (
              <Button key={k} size="sm" variant={k === "stl" ? "default" : "outline"} onClick={() => exportLocal(k)}>
                {k.toUpperCase()}
              </Button>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
