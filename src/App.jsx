import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import {
  auth,
  db,
  onAuthStateChanged,
  signInAnonymously,
  ref,
  onValue,
  set
} from './firebase.js';
import Chat from './components/Chat.jsx';
import Studio from './components/Studio.jsx';

const hashColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return `hsl(${(hash % 360 + 360) % 360}, 70%, 50%)`;
};

function Avatar({ position, color }) {
  return (
    <group position={position}>
      <mesh position={[0, 1, 0]}>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh>
        <capsuleGeometry args={[0.25, 1.2, 4, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

function Building({ position, size = [5, 5, 5] }) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial color="#666" />
    </mesh>
  );
}

function Roads() {
  const ref = useRef();
  useEffect(() => {
    const positions = [];
    for (let i = -5; i <= 5; i++) {
      const x = i * 10;
      positions.push(new THREE.Vector3(-50, 0.01, x), new THREE.Vector3(50, 0.01, x));
      positions.push(new THREE.Vector3(x, 0.01, -50), new THREE.Vector3(x, 0.01, 50));
    }
    ref.current.geometry.setFromPoints(positions);
  }, []);
  return (
    <lineSegments ref={ref}>
      <bufferGeometry />
      <lineBasicMaterial color="#444" linewidth={8} />
    </lineSegments>
  );
}

function Portal({ position, color }) {
  return (
    <mesh position={position}>
      <ringGeometry args={[1.5, 2.5, 16]} />
      <meshBasicMaterial color={color} emissive={color} emissiveIntensity={0.5} transparent opacity={0.9} />
    </mesh>
  );
}

function Scene({ scene, users, uid, locked, updatePos, setScene }) {
  const controlsRef = useRef();
  const { camera } = useThree();
  const keysRef = useRef({});
  const frontRef = useRef(new THREE.Vector3());
  const rightRef = useRef(new THREE.Vector3());
  const lastUpdateRef = useRef(0);
  const speed = 15;
  const playerHalfSize = 0.4;
  const eyeHeight = 1.7;

  const worldData = {
    world: {
      groundColor: '#228B22',
      buildings: [
        { pos: [-20, 5, -20], size: [10, 10, 10] },
        { pos: [20, 4, -10], size: [8, 8, 8] },
        { pos: [0, 6, 30], size: [12, 12, 12] },
        { pos: [-30, 3, 20], size: [6, 6, 6] },
        { pos: [25, 7, 0], size: [10, 14, 10] },
        { pos: [-10, 4, -30], size: [7, 8, 7] },
        { pos: [35, 5, 25], size: [9, 10, 9] },
        { pos: [-25, 3, -10], size: [5, 6, 5] },
      ],
      portals: [
        {
          pos: new THREE.Vector3(0, 2, 15),
          targetScene: 'lobby',
          enterPos: new THREE.Vector3(0, eyeHeight, -8),
          color: 0x00ffff,
        },
      ],
    },
    lobby: {
      groundColor: '#333',
      buildings: [
        { pos: new THREE.Vector3(0, 5, -10), size: [20, 10, 1] },
        { pos: new THREE.Vector3(0, 5, 10), size: [20, 10, 1] },
        { pos: new THREE.Vector3(-10, 5, 0), size: [1, 10, 20] },
        { pos: new THREE.Vector3(10, 5, 0), size: [1, 10, 20] },
        { pos: new THREE.Vector3(0, 10, 0), size: [20, 1, 20] },
        { pos: new THREE.Vector3(-4, 3, -4), size: [1, 6, 1] },
        { pos: new THREE.Vector3(4, 3, 4), size: [1, 6, 1] },
      ],
      portals: [
        {
          pos: new THREE.Vector3(0, 2, -15),
          targetScene: 'world',
          enterPos: new THREE.Vector3(0, eyeHeight, 8),
          color: 0xff00ff,
        },
      ],
    },
  }[scene];

  useEffect(() => {
    const handleKey = (e, down) => {
      keysRef.current[e.code] = down;
    };
    document.addEventListener('keydown', (e) => handleKey(e, true));
    document.addEventListener('keyup', (e) => handleKey(e, false));
    return () => {
      document.removeEventListener('keydown');
      document.removeEventListener('keyup');
    };
  }, []);

  useFrame((state, delta) => {
    if (!locked || !controlsRef.current) return;

    // Update direction vectors
    const yaw = camera.rotation.y;
    frontRef.current.set(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).normalize();
    frontRef.current.y = 0;
    frontRef.current.normalize();
    rightRef.current.set(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).normalize();
    rightRef.current.y = 0;
    rightRef.current.normalize();

    const direction = new THREE.Vector3();
    const moveSpeed = speed * delta;
    if (keysRef.current.KeyW) direction.add(frontRef.current.clone().multiplyScalar(moveSpeed));
    if (keysRef.current.KeyS) direction.sub(frontRef.current.clone().multiplyScalar(moveSpeed));
    if (keysRef.current.KeyA) direction.sub(rightRef.current.clone().multiplyScalar(moveSpeed));
    if (keysRef.current.KeyD) direction.add(rightRef.current.clone().multiplyScalar(moveSpeed));

    if (direction.length() === 0) return;

    const newPos = camera.position.clone().add(direction);
    newPos.y = eyeHeight;

    // Collision check
    let collides = false;
    for (const building of worldData.buildings) {
      const bHalf = new THREE.Vector3(...building.size).multiplyScalar(0.5);
      const bMin = building.pos.clone().sub(bHalf);
      const bMax = building.pos.clone().add(bHalf);
      const pHalf = new THREE.Vector3(playerHalfSize, eyeHeight / 2, playerHalfSize);
      const pMin = newPos.clone().sub(pHalf);
      const pMax = newPos.clone().add(pHalf);
      if (pMax.x > bMin.x && pMin.x < bMax.x &&
          pMax.z > bMin.z && pMin.z < bMax.z &&
          pMax.y > bMin.y && pMin.y < bMax.y) {
        collides = true;
        break;
      }
    }

    if (!collides) {
      camera.position.copy(newPos);
    }

    // Throttled position update
    const now = performance.now();
    if (now - lastUpdateRef.current > 100) {
      lastUpdateRef.current = now;
      updatePos({ x: camera.position.x, y: camera.position.y, z: camera.position.z });
    }

    // Portal check
    for (const portal of worldData.portals) {
      if (camera.position.distanceTo(portal.pos) < 2.5) {
        camera.position.copy(portal.enterPos);
        setScene(portal.targetScene);
        updatePos({ x: portal.enterPos.x, y: portal.enterPos.y, z: portal.enterPos.z }, portal.targetScene);
        break;
      }
    }
  });

  return (
    <>
      <PointerLockControls ref={controlsRef} />
      <color attach="background" args={scene === 'world' ? ['#87CEEB'] : ['#111']} />
      <fog args={['black', 20, 100]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
      {scene === 'lobby' && (
        <>
          <pointLight position={[0, 10, 0]} intensity={2} color="#ff00ff" />
          <pointLight position={[0, 10, 0]} intensity={2} color="#00ffff" />
        </>
      )}
      <Stars radius={80} depth={50} count={5000} factor={4} />
      <Roads />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[100, 100]} />
        <meshLambertMaterial color={worldData.groundColor} />
      </mesh>
      {worldData.buildings.map((b, i) => (
        <Building key={i} position={b.pos} size={b.size} />
      ))}
      {worldData.portals.map((p, i) => (
        <Portal key={i} position={p.pos} color={p.color} />
      ))}
      {Object.entries(users).map(([uId, data]) =>
        uId !== uid && data?.scene === scene && data.pos && (
          <Avatar
            key={uId}
            position={[data.pos.x, data.pos.y || 0, data.pos.z]}
            color={hashColor(uId)}
          />
        )
      )}
    </>
  );
}

export default function App() {
  const [locked, setLocked] = useState(false);
  const [scene, setScene] = useState('world');
  const [isStudio, setIsStudio] = useState(false);
  const [users, setUsers] = useState({});
  const [uid, setUid] = useState(null);

  const updatePos = useCallback((newPos, newScene) => {
    if (uid) {
      set(ref(db, `users/${uid}`), {
        pos: newPos,
        scene: newScene || scene,
      }).catch(console.error);
    }
  }, [uid, scene]);

  useEffect(() => {
    signInAnonymously(auth).catch(console.error);

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUid(user.uid);
        const usersRef = ref(db, 'users');
        const unsubUsers = onValue(usersRef, (snap) => {
          setUsers(snap.val() || {});
        });
        // Cleanup on unmount
        return unsubUsers;
      }
    });

    const handlePointerLock = () => {
      setLocked(!!document.pointerLockElement);
    };
    document.addEventListener('pointerlockchange', handlePointerLock);
    return () => {
      document.removeEventListener('pointerlockchange', handlePointerLock);
      unsubAuth();
    };
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Canvas onClick={() => document.body.requestPointerLock()} camera={{ fov: 75, position: [0, 1.7, 0] }}>
        <Scene
          scene={scene}
          users={users}
          uid={uid}
          locked={locked}
          updatePos={updatePos}
          setScene={setScene}
        />
      </Canvas>
      <div style={{
        position: 'absolute',
        top: 20,
        left: 20,
        color: 'white',
        fontSize: '18px',
        background: 'rgba(0,0,0,0.5)',
        padding: '20px',
        borderRadius: '8px',
        pointerEvents: 'none',
        zIndex: 100,
      }}>
        {!locked ? (
          <>
            <div style={{ fontSize: '24px', marginBottom: '10px' }}>Click to Play</div>
            <div>WASD: Move</div>
            <div>Mouse: Look</div>
            <div>Portals: Enter Lobby</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: '24px', marginBottom: '10px' }}>
              {scene.toUpperCase()}
            </div>
            <div>ESC: Unlock</div>
          </>
        )}
      </div>
    </div>
  );
}