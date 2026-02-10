import { useState, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import { motion } from 'framer-motion'
import { Zap } from 'lucide-react'

function Dog({ position = [0, 0, 0], speed = 1 }) {
  const groupRef = useRef(null)
  const timeRef = useRef(0)

  useFrame((state, delta) => {
    if (!groupRef.current) return
    timeRef.current += delta * speed
    const t = timeRef.current
    // Rotate and bob
    groupRef.current.rotation.y = t * 0.3
    groupRef.current.position.y = Math.sin(t * 2) * 0.1 + position[1]
    // Simple walk forward
    groupRef.current.position.x = Math.sin(t * 0.5) * 3 + position[0]
    groupRef.current.position.z = Math.cos(t * 0.5) * 3 + position[2]
  })

  return (
    <group ref={groupRef} position={position}>
      {/* Body */}
      <mesh position={[0, 0.4, 0]}>
        <capsuleGeometry args={[0.25, 0.5, 4, 8]} />
        <meshStandardMaterial color="#8B4513" emissive="#FF1493" emissiveIntensity={0.2} roughness={0.3} metalness={0.1} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.9, 0.5]}>
        <sphereGeometry args={[0.22, 8, 8]} />
        <meshStandardMaterial color="#A0522D" emissive="#FF1493" emissiveIntensity={0.1} />
      </mesh>
      {/* Legs */}
      {[[-0.12, 0.1, -0.2], [0.12, 0.1, -0.2], [-0.12, 0.1, 0.2], [0.12, 0.1, 0.2]].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]}>
          <cylinderGeometry args={[0.06, 0.06, 0.35, 6]} />
          <meshStandardMaterial color="#654321" />
        </mesh>
      ))}
      {/* Tail */}
      <mesh position={[0.35, 0.6, 0]}>
        <coneGeometry args={[0.04, 0.25, 4]} />
        <meshStandardMaterial color="#FF69B4" emissive="#FF1493" emissiveIntensity={0.4} />
      </mesh>
      {/* Ears */}
      <mesh position={[-0.08, 1.05, 0.6]} rotation={[-0.3, 0, 0]}>
        <tetrahedronGeometry args={[0.12]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      <mesh position={[0.08, 1.05, 0.6]} rotation={[0.3, 0, 0]}>
        <tetrahedronGeometry args={[0.12]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
    </group>
  )
}

function Scene({ numDogs = 25 }) {
  const positions = Array.from({ length: numDogs }, (_, i) => [
    (i % 5 - 2) * 8 + (Math.sin(i) * 2),
    0,
    Math.floor(i / 5) * 8 - 8 + (Math.cos(i) * 2)
  ])

  return (
    <>
      <color attach="background" args={['#0a0015']} />
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 5]} intensity={1.2} color="#FF1493" />
      <pointLight position={[-10, 5, -5]} intensity={0.8} color="#00FFFF" />
      <Stars
        radius={80}
        depth={60}
        count={8000}
        factor={4}
        saturation={0}
        fade
        speed={0.5}
      />
      {positions.map((pos, i) => (
        <Dog
          key={`dog-${i}`}
          position={pos}
          speed={0.8 + (i % 3) * 0.3}
        />
      ))}
      <OrbitControls enablePan={false} enableZoom={true} enableRotate={true} />
    </>
  )
}

export default function App() {
  const [points, setPoints] = useState(1000)

  return (
    <div className="w-screen h-screen overflow-hidden relative">
      <Canvas
        camera={{ position: [0, 8, 25], fov: 65 }}
        gl={{
          antialias: false,
          powerPreference: 'low-power',
          alpha: false
        }}
        shadows
        className="neon-glow"
      >
        <Scene />
      </Canvas>
      {/* Points UI */}
      <motion.div
        className="fixed top-8 right-8 z-50 flex flex-col items-end gap-6 p-6 backdrop-blur-md bg-black/30 rounded-2xl border border-pink-neon/50 neon-glow"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <div className="neon-text text-5xl font-vcr leading-none">
          {points.toLocaleString()}
          <div className="text-2xl font-orbitron opacity-80">PTS</div>
        </div>
        <motion.button
          className="btn-neon text-xl px-8 py-4"
          whileHover={{ scale: 1.1, rotateX: 5 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setPoints((p) => p + Math.floor(Math.random() * 50 + 10))}
        >
          Earn Points
          <Zap className="ml-3 w-6 h-6 inline animate-pulse" />
        </motion.button>
        <div className="text-xs uppercase tracking-widest font-vcr opacity-60 text-cyan-neon">
          Firebase Stub - Local State
        </div>
      </motion.div>
    </div>
  )
}