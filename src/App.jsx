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
      <meshStandardMaterial color="#000" />
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
      console.log('handleKey', e.code, down);
      e.preventDefault();
      keysRef.current[e.code] = down;
    };
    document.addEventListener('keydown', (e) => handleKey(e, true), { capture: true });
    document.addEventListener('keyup', (e) => handleKey(e, false), { capture: true });
    return () => {
      document.removeEventListener('keydown');
      document.removeEventListener('keyup');
    };
  }, []);

  useEffect(() => {
    if (camera) {
      camera.position.set(0, eyeHeight, 0);
    }
  }, [camera]);

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
    if (keysRef.current.KeyW || keysRef.current.ArrowUp) direction.add(frontRef.current);
    if (keysRef.current.KeyS || keysRef.current.ArrowDown) direction.sub(frontRef.current);
    if (keysRef.current.KeyA || keysRef.current.ArrowLeft) direction.sub(rightRef.current);
    if (keysRef.current.KeyD || keysRef.current.ArrowRight) direction.add(rightRef.current);
    if (direction.lengthSq() === 0) return;
    direction.normalize();
    const moveVec = direction.multiplyScalar(speed * delta);
    const newPos = camera.position.clone().add(moveVec);
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
      controlsRef.current.position.add(moveVec);
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
    &lt;&gt;
      &lt;PointerLockControls ref={controlsRef} /&gt;
      &lt;color attach="background" args={scene === 'world' ? ['#87CEEB'] : ['#111']} /&gt;
      &lt;fog args={['black', 20, 100]} /&gt;
      &lt;ambientLight intensity={0.4} /&gt;
      &lt;directionalLight position={[10, 20, 10]} intensity={1} castShadow /&gt;
      {scene === 'lobby' &amp;&amp; (
        &lt;&gt;
          &lt;pointLight position={[0, 10, 0]} intensity={2} color="#ff00ff" /&gt;
          &lt;pointLight position={[0, 10, 0]} intensity={2} color="#00ffff" /&gt;
        &lt;/&gt;
      )}
      &lt;Stars radius={80} depth={50} count={5000} factor={4} /&gt;
      &lt;Roads /&gt;
      &lt;mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}&gt;
        &lt;planeGeometry args={[100, 100]} /&gt;
        &lt;meshLambertMaterial color={worldData.groundColor} /&gt;
      &lt;/mesh&gt;
      {worldData.buildings.map((b, i) =&gt; (
        &lt;Building key={i} position={b.pos} size={b.size} /&gt;
      ))}
      {worldData.portals.map((p, i) =&gt; (
        &lt;Portal key={i} position={p.pos} color={p.color} /&gt;
      ))}
      {Object.entries(users).map(([uId, data]) =&gt;
        uId !== uid &amp;&amp; data?.scene === scene &amp;&amp; data.pos &amp;&amp; (
          &lt;Avatar
            key={uId}
            position={[data.pos.x, data.pos.y || 0, data.pos.z]}
            color={hashColor(uId)}
          /&gt;
        )
      )}
    &lt;/&gt;
  );
}

export default function App() {
  const [locked, setLocked] = useState(false);
  const [scene, setScene] = useState('world');
  const [isStudio, setIsStudio] = useState(false);
  const [users, setUsers] = useState({});
  const [uid, setUid] = useState(null);

  const updatePos = useCallback((newPos, newScene) =&gt; {
    if (uid) {
      set(ref(db, `users/${uid}`), {
        pos: newPos,
        scene: newScene || scene,
      }).catch(console.error);
    }
  }, [uid, scene]);

  useEffect(() =&gt; {
    signInAnonymously(auth).catch(console.error);

    const unsubAuth = onAuthStateChanged(auth, (user) =&gt; {
      if (user) {
        setUid(user.uid);
        const usersRef = ref(db, 'users');
        const unsubUsers = onValue(usersRef, (snap) =&gt; {
          setUsers(snap.val() || {});
        });
        // Cleanup on unmount
        return unsubUsers;
      }
    });

    const handlePointerLock = () =&gt; {
      setLocked(!!document.pointerLockElement);
    };
    document.addEventListener('pointerlockchange', handlePointerLock);
    return () =&gt; {
      document.removeEventListener('pointerlockchange', handlePointerLock);
      unsubAuth();
    };
  }, []);

  return (
    &lt;div style={{ position: 'fixed', inset: 0 }}&gt;
      &lt;Canvas onClick={() =&gt; document.body.requestPointerLock()} camera={{ fov: 75, position: [0, 1.7, 0] }}&gt;
        &lt;Scene
          scene={scene}
          users={users}
          uid={uid}
          locked={locked}
          updatePos={updatePos}
          setScene={setScene}
        /&gt;
      &lt;/Canvas&gt;
      &lt;div style={{
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
      }}&gt;
        {!locked ? (
          &lt;&gt;
            &lt;div style={{ fontSize: '24px', marginBottom: '10px' }}&gt;Click to Play&lt;/div&gt;
            &lt;div&gt;WASD: Move&lt;/div&gt;
            &lt;div&gt;Mouse: Look&lt;/div&gt;
            &lt;div&gt;Portals: Enter Lobby&lt;/div&gt;
          &lt;/&gt;
        ) : (
          &lt;&gt;
            &lt;div style={{ fontSize: '24px', marginBottom: '10px' }}&gt;
              {scene.toUpperCase()}
            &lt;/div&gt;
            &lt;div&gt;ESC: Unlock&lt;/div&gt;
          &lt;/&gt;
        )}
      &lt;/div&gt;
      {uid &amp;&amp; (
        &lt;div
          style={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            color: 'white',
            background: 'rgba(0,0,0,0.5)',
            padding: '20px',
            borderRadius: '8px',
            zIndex: 100,
          }}
        &gt;
          &lt;Chat uid={uid} /&gt;
        &lt;/div&gt;
      )}
      &lt;div
        style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          color: 'white',
          background: 'rgba(0,0,0,0.5)',
          padding: '20px',
          borderRadius: '8px',
          zIndex: 100,
        }}
      &gt;
        &lt;Studio isStudio={isStudio} setIsStudio={setIsStudio} /&gt;
      &lt;/div&gt;
    &lt;/div&gt;
  );
}