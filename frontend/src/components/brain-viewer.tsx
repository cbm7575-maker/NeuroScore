"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { getBrainSurface, type NetworkScores } from "@/lib/api";

// Network index order: visual(0), auditory(1), language(2), motion(3), default_mode(4)
const NET_RGB: [number, number, number][] = [
  [0.23, 0.51, 0.96],  // visual       — blue
  [0.96, 0.62, 0.04],  // auditory     — amber
  [0.13, 0.77, 0.37],  // language     — green
  [0.94, 0.27, 0.27],  // motion       — red
  [0.66, 0.33, 0.97],  // default_mode — purple
];
const NET_CSS = ["#3b82f6", "#f59e0b", "#22c55e", "#ef4444", "#a855f7"];
const NET_LABELS = ["Visual", "Auditory", "Language", "Motion", "Default Mode"];
const NET_KEYS: (keyof NetworkScores)[] = [
  "visual", "auditory", "language", "motion", "default_mode",
];

export interface BrainMesh {
  /** Flat vertex positions [x0,y0,z0, …], length = nVertices × 3 */
  vertices: Float32Array;
  /** Triangle indices [i0,j0,k0, …], length = nFaces × 3 */
  faces: Uint32Array;
  /** Network assignment per vertex (0–4). Same length as nVertices. */
  networkMap?: Uint8Array;
}

interface BrainViewerProps {
  networkScores?: NetworkScores;
  /** Raw per-frame per-vertex activations (heatmap mode). */
  activations?: Float32Array;
  nVertices?: number;
  currentFrame?: number;
  className?: string;
}

/** Heatmap: blue (0) → cyan → green → yellow → red (1). */
function heatmapColor(t: number, out: THREE.Color): void {
  const c = Math.max(0, Math.min(1, t));
  if (c < 0.25) out.setRGB(0, c / 0.25, 1);
  else if (c < 0.5) out.setRGB(0, 1, 1 - (c - 0.25) / 0.25);
  else if (c < 0.75) out.setRGB((c - 0.5) / 0.25, 1, 0);
  else out.setRGB(1, 1 - (c - 0.75) / 0.25, 0);
}

function buildPlaceholderMeshes(): { meshes: THREE.Mesh[]; networkMap: null } {
  const material = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 25 });
  const meshes = [-0.48, 0.48].map((xOffset) => {
    const geo = new THREE.SphereGeometry(0.58, 48, 32);
    geo.translate(xOffset, 0, 0);
    const nVerts = geo.getAttribute("position").count;
    const colors = new Float32Array(nVerts * 3).fill(0.3);
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return new THREE.Mesh(geo, material.clone());
  });
  return { meshes, networkMap: null };
}

function buildRealMeshes(mesh: BrainMesh): {
  meshes: THREE.Mesh[];
  networkMap: Uint8Array | null;
} {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(mesh.vertices.slice(), 3));
  geo.setIndex(new THREE.BufferAttribute(mesh.faces.slice(), 1));
  geo.computeVertexNormals();

  const nVerts = mesh.vertices.length / 3;
  const colors = new Float32Array(nVerts * 3).fill(0.3);
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 25 });
  return { meshes: [new THREE.Mesh(geo, material)], networkMap: mesh.networkMap ?? null };
}

function applyNetworkColors(
  colorAttr: THREE.BufferAttribute,
  networkMap: Uint8Array,
  scores: NetworkScores,
): void {
  const n = colorAttr.count;
  for (let i = 0; i < n; i++) {
    const netIdx = Math.min(networkMap[i] ?? 4, 4);
    const [r, g, b] = NET_RGB[netIdx];
    const intensity = 0.25 + 0.75 * (scores[NET_KEYS[netIdx]] / 100);
    colorAttr.setXYZ(i, r * intensity, g * intensity, b * intensity);
  }
  colorAttr.needsUpdate = true;
}

function formatTimestamp(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function BrainViewer({
  networkScores,
  activations,
  nVertices = 20_484,
  currentFrame = 0,
  className = "",
}: BrainViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    meshes: THREE.Mesh[];
    networkMap: Uint8Array | null;
    isReal: boolean;
  } | null>(null);
  const colorScratch = useRef(new THREE.Color());

  const [surfaceMesh, setSurfaceMesh] = useState<BrainMesh | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [surfaceLoading, setSurfaceLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [timestamp, setTimestamp] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch real brain surface from the backend
  useEffect(() => {
    getBrainSurface()
      .then((data) => {
        // Merge left + right hemispheres into one flat mesh
        const lCoords = data.left.coords;
        const rCoords = data.right.coords;
        const lFaces = data.left.faces;
        const rFaces = data.right.faces;
        const lMap = data.left.network_map;
        const rMap = data.right.network_map;

        const nL = lCoords.length;
        const nR = rCoords.length;
        const nVerts = nL + nR;

        const vertices = new Float32Array(nVerts * 3);
        for (let i = 0; i < nL; i++) {
          vertices[i * 3] = lCoords[i][0];
          vertices[i * 3 + 1] = lCoords[i][1];
          vertices[i * 3 + 2] = lCoords[i][2];
        }
        for (let i = 0; i < nR; i++) {
          vertices[(nL + i) * 3] = rCoords[i][0];
          vertices[(nL + i) * 3 + 1] = rCoords[i][1];
          vertices[(nL + i) * 3 + 2] = rCoords[i][2];
        }

        const nFacesL = lFaces.length;
        const nFacesR = rFaces.length;
        const faces = new Uint32Array((nFacesL + nFacesR) * 3);
        for (let i = 0; i < nFacesL; i++) {
          faces[i * 3] = lFaces[i][0];
          faces[i * 3 + 1] = lFaces[i][1];
          faces[i * 3 + 2] = lFaces[i][2];
        }
        for (let i = 0; i < nFacesR; i++) {
          faces[(nFacesL + i) * 3] = nL + rFaces[i][0];
          faces[(nFacesL + i) * 3 + 1] = nL + rFaces[i][1];
          faces[(nFacesL + i) * 3 + 2] = nL + rFaces[i][2];
        }

        const networkMap = new Uint8Array(nVerts);
        for (let i = 0; i < nL; i++) networkMap[i] = lMap[i] ?? 4;
        for (let i = 0; i < nR; i++) networkMap[nL + i] = rMap[i] ?? 4;

        setSurfaceMesh({ vertices, faces, networkMap });
      })
      .catch((e) =>
        setLoadError(e instanceof Error ? e.message : "Failed to load brain surface"),
      )
      .finally(() => setSurfaceLoading(false));
  }, []);

  // Build / rebuild Three.js scene whenever the mesh changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const w = container.clientWidth || 600;
    const h = container.clientHeight || 400;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
    // fsaverage5 coordinates are in mm, brain ~120 mm across.
    camera.position.set(0, 20, surfaceMesh ? 230 : 3.2);

    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 0.85);
    key.position.set(60, 100, 60);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x8899ff, 0.25);
    fill.position.set(-60, -40, -60);
    scene.add(fill);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.minDistance = surfaceMesh ? 80 : 1.5;
    controls.maxDistance = surfaceMesh ? 500 : 10;

    const { meshes, networkMap } = surfaceMesh
      ? buildRealMeshes(surfaceMesh)
      : buildPlaceholderMeshes();
    for (const m of meshes) scene.add(m);

    sceneRef.current = { renderer, camera, controls, meshes, networkMap, isReal: !!surfaceMesh };

    // Apply initial network colors if data is already present
    if (surfaceMesh && networkMap && networkScores) {
      const colorAttr = meshes[0].geometry.getAttribute("color") as THREE.BufferAttribute;
      applyNetworkColors(colorAttr, networkMap, networkScores);
    }

    let rafId = 0;
    function animate() {
      rafId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    const ro = new ResizeObserver(() => {
      const nw = container.clientWidth;
      const nh = container.clientHeight;
      if (!nw || !nh) return;
      renderer.setSize(nw, nh);
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
    });
    ro.observe(container);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      controls.dispose();
      for (const m of meshes) {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
  }, [surfaceMesh]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update vertex colors when network scores change (network-color mode)
  useEffect(() => {
    const s = sceneRef.current;
    if (!s?.isReal || !s.networkMap || !networkScores) return;
    const colorAttr = s.meshes[0].geometry.getAttribute("color") as THREE.BufferAttribute;
    applyNetworkColors(colorAttr, s.networkMap, networkScores);
  }, [networkScores]);

  // Update vertex colors when activation frame changes (heatmap mode)
  useEffect(() => {
    const s = sceneRef.current;
    if (!s || !activations || s.networkMap) return; // skip if network-color mode active

    const targetMesh = s.meshes[0];
    const colorAttr = targetMesh.geometry.getAttribute("color") as THREE.BufferAttribute;
    const nVerts = Math.min(colorAttr.count, nVertices);
    const offset = currentFrame * nVertices;

    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < nVerts; i++) {
      const v = activations[offset + i];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const range = max - min || 1;

    const col = colorScratch.current;
    for (let i = 0; i < nVerts; i++) {
      heatmapColor((activations[offset + i] - min) / range, col);
      colorAttr.setXYZ(i, col.r, col.g, col.b);
    }
    colorAttr.needsUpdate = true;
  }, [activations, currentFrame, nVertices]);

  // Playback ticker
  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => setTimestamp((t) => t + 1), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing]);

  const togglePlay = useCallback(() => setPlaying((p) => !p), []);

  const hasNetworkLegend = !!networkScores;

  return (
    <div className={`space-y-3 ${className}`}>
      <div
        className="relative overflow-hidden rounded-xl bg-[var(--bg-secondary)]"
        style={{ height: 360 }}
      >
        {/* Loading state */}
        {surfaceLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
              <p className="text-xs text-[var(--text-secondary)]">Loading brain surface…</p>
            </div>
          </div>
        )}

        {/* Error fallback — still renders placeholder via Three.js canvas */}
        {loadError && (
          <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
            <p className="rounded-md bg-black/60 px-3 py-1 text-xs text-[var(--error)]">
              {loadError}
            </p>
          </div>
        )}

        {/* Three.js canvas target */}
        <div ref={containerRef} className="h-full w-full" />

        {/* Interaction hint */}
        <p className="pointer-events-none absolute left-3 top-3 select-none text-[10px] text-white/30">
          Drag · Scroll · Shift+drag
        </p>

        {/* Timestamp */}
        <div className="pointer-events-none absolute right-3 top-3 rounded-md bg-black/50 px-2 py-1 font-mono text-xs text-white backdrop-blur-sm">
          {formatTimestamp(timestamp)}
        </div>

        {/* Network color legend */}
        {hasNetworkLegend ? (
          <div className="pointer-events-none absolute bottom-3 left-3 space-y-1 rounded-md bg-black/55 px-3 py-2 backdrop-blur-sm">
            {NET_LABELS.map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <div
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: NET_CSS[i] }}
                />
                <span className="text-[11px] text-white/80">{label}</span>
                <span className="ml-auto pl-4 text-[11px] font-medium tabular-nums text-white">
                  {networkScores![NET_KEYS[i]].toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          /* Heatmap legend (raw activation mode) */
          <div className="absolute bottom-3 right-3 flex select-none flex-col items-center gap-1">
            <span className="text-[10px] text-white/40">High</span>
            <div
              className="w-2.5 rounded-sm"
              style={{
                height: 72,
                background:
                  "linear-gradient(to bottom, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff)",
              }}
            />
            <span className="text-[10px] text-white/40">Low</span>
          </div>
        )}
      </div>

      {/* Playback controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--bg-tertiary)] px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] transition-all hover:text-[var(--text-primary)]"
        >
          {playing ? (
            <>
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                <rect x="5" y="4" width="3" height="12" rx="1" />
                <rect x="12" y="4" width="3" height="12" rx="1" />
              </svg>
              Pause
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.3 2.84A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.27l9.344-5.891a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
              Play
            </>
          )}
        </button>

        {timestamp > 0 && (
          <button
            onClick={() => { setPlaying(false); setTimestamp(0); }}
            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
