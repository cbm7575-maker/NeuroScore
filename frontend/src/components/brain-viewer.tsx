"use client";

import { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

const NETWORKS = [
  "Visual",
  "Auditory",
  "Attention",
  "Salience",
  "Default Mode",
] as const;

const NETWORK_RGB: Record<string, [number, number, number]> = {
  Visual: [0.545, 0.361, 0.965],
  Auditory: [0.024, 0.714, 0.831],
  Attention: [0.961, 0.62, 0.043],
  Salience: [0.937, 0.267, 0.267],
  "Default Mode": [0.133, 0.773, 0.369],
};

const BASE: [number, number, number] = [0.075, 0.075, 0.13];

function classifyVertex(x: number, y: number, z: number): number {
  const r = Math.sqrt(x * x + y * y + z * z);
  if (r === 0) return 4;
  const nx = x / r;
  const ny = y / r;
  const nz = z / r;

  if (nz < -0.5) return 0;
  if (Math.abs(nx) > 0.55 && ny < 0.15) return 1;
  if (nz > 0.35 && ny > -0.2) return 2;
  if (nz > 0.1 && Math.abs(nx) < 0.45 && ny <= -0.2) return 3;
  return 4;
}

function BrainMesh({ scores }: { scores: Record<string, number> }) {
  const meshRef = useRef<THREE.Mesh>(null);

  const { geometry, networkIndices } = useMemo(() => {
    const geo = new THREE.SphereGeometry(1, 64, 48);
    const pos = geo.attributes.position;
    const v = new THREE.Vector3();
    const indices: number[] = [];

    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);

      v.x *= 0.65;
      v.y *= 0.75;
      v.z *= 0.9;

      const topFactor = Math.max(0, v.y) / 0.75;
      v.y -= Math.exp(-v.x * v.x * 40) * 0.12 * topFactor;

      const r = v.length();
      if (r > 0) {
        const n1 =
          Math.sin(v.x * 18 + 0.5) *
          Math.cos(v.y * 14) *
          Math.sin(v.z * 16 + 1.0);
        const n2 = Math.sin(v.x * 25 + 2.1) * Math.cos(v.z * 20 - 0.7);
        v.multiplyScalar(1 + (n1 * 0.015 + n2 * 0.008) / r);
      }

      pos.setXYZ(i, v.x, v.y, v.z);
      indices.push(classifyVertex(v.x, v.y, v.z));
    }

    geo.computeVertexNormals();
    const colors = new Float32Array(pos.count * 3);
    colors.fill(0.1);
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    return { geometry: geo, networkIndices: indices };
  }, []);

  useEffect(() => {
    const attr = geometry.attributes.color as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;

    for (let i = 0; i < networkIndices.length; i++) {
      const net = NETWORKS[networkIndices[i]];
      const t = Math.max(0, Math.min(1, (scores[net] ?? 0) / 100));
      const col = NETWORK_RGB[net] || BASE;

      arr[i * 3] = BASE[0] + (col[0] - BASE[0]) * t;
      arr[i * 3 + 1] = BASE[1] + (col[1] - BASE[1]) * t;
      arr[i * 3 + 2] = BASE[2] + (col[2] - BASE[2]) * t;
    }

    attr.needsUpdate = true;
  }, [scores, geometry, networkIndices]);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.12;
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshStandardMaterial
        vertexColors
        roughness={0.55}
        metalness={0.1}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

interface BrainViewerProps {
  scores: Record<string, number>;
}

export default function BrainViewer({ scores }: BrainViewerProps) {
  return (
    <Canvas camera={{ position: [0, 0.4, 2.2], fov: 45 }}>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
      <directionalLight position={[-3, 2, -3]} intensity={0.3} />
      <BrainMesh scores={scores} />
      <OrbitControls enablePan={false} minDistance={1.5} maxDistance={4} />
    </Canvas>
  );
}
