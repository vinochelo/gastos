'use client';

import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial } from '@react-three/drei';
import * as THREE from 'three';

interface MeshRef {
  rotation: THREE.Euler;
  position: THREE.Vector3;
}

function FloatingSphere({ position, color, speed, scale }: { position: [number, number, number], color: string, speed: number, scale: number }) {
  const meshRef = useRef<MeshRef | null>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += speed * 0.01;
      meshRef.current.rotation.y += speed * 0.02;
      meshRef.current.position.y += Math.sin(state.clock.elapsedTime * speed * 0.5 + position[0]) * 0.003;
    }
  });

  return (
    <Float speed={speed * 2} rotationIntensity={speed} floatIntensity={2}>
      <mesh ref={meshRef as React.RefObject<THREE.Mesh>} position={position} scale={scale}>
        <sphereGeometry args={[1, 32, 32]} />
        <MeshDistortMaterial color={color} speed={2} distort={0.4} />
      </mesh>
    </Float>
  );
}

function FloatingBox({ position, color, speed, scale }: { position: [number, number, number], color: string, speed: number, scale: number }) {
  const meshRef = useRef<MeshRef | null>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += speed * 0.015;
      meshRef.current.rotation.z += speed * 0.01;
      meshRef.current.position.y += Math.cos(state.clock.elapsedTime * speed * 0.4 + position[0]) * 0.002;
    }
  });

  return (
    <Float speed={speed * 1.5} rotationIntensity={speed * 1.5} floatIntensity={1.5}>
      <mesh ref={meshRef as React.RefObject<THREE.Mesh>} position={position} scale={scale}>
        <boxGeometry args={[1, 1, 1]} />
        <MeshDistortMaterial color={color} speed={3} distort={0.3} />
      </mesh>
    </Float>
  );
}

function FloatingTorus({ position, color, speed, scale }: { position: [number, number, number], color: string, speed: number, scale: number }) {
  const meshRef = useRef<MeshRef | null>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += speed * 0.008;
      meshRef.current.rotation.y += speed * 0.012;
      meshRef.current.position.y += Math.sin(state.clock.elapsedTime * speed * 0.3 + position[1]) * 0.0025;
    }
  });

  return (
    <Float speed={speed * 1.8} rotationIntensity={speed * 0.8} floatIntensity={2.5}>
      <mesh ref={meshRef as React.RefObject<THREE.Mesh>} position={position} scale={scale}>
        <torusGeometry args={[1, 0.3, 16, 100]} />
        <MeshDistortMaterial color={color} speed={2.5} distort={0.35} />
      </mesh>
    </Float>
  );
}

export default function Scene3D() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-950/20 via-transparent to-pink-950/20" />
      <Canvas camera={{ position: [0, 0, 10], fov: 50 }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 10, 5]} intensity={0.8} />
        <pointLight position={[-10, -10, -5]} intensity={0.4} color="#ec4899" />
        <pointLight position={[10, -5, 5]} intensity={0.3} color="#8b5cf6" />
        
        <FloatingSphere position={[-4, 3, -5]} color="#8b5cf6" speed={1} scale={0.5} />
        <FloatingBox position={[5, -2, -4]} color="#ec4899" speed={1.5} scale={0.4} />
        <FloatingTorus position={[-3, -3, -2]} color="#06b6d4" speed={0.8} scale={0.6} />
        <FloatingSphere position={[3, 4, -6]} color="#f59e0b" speed={1.2} scale={0.35} />
        <FloatingBox position={[-5, 1, -3]} color="#10b981" speed={0.9} scale={0.45} />
        <FloatingTorus position={[4, 2, -5]} color="#ef4444" speed={1.1} scale={0.5} />
        <FloatingSphere position={[0, -4, -3]} color="#a855f7" speed={0.7} scale={0.55} />
        <FloatingBox position={[-2, 0, -6]} color="#14b8a6" speed={1.3} scale={0.3} />
      </Canvas>
    </div>
  );
}
