import { useState, useRef, useEffect, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars, useKeyboardControls } from '@react-three/drei'
import * as THREE from 'three'
import { motion } from 'framer-motion'
import { Zap, User, Edit3, Upload, Twitter, Github } from 'lucide-react'
import {
  auth,
  db,
  storage,
  googleProvider,
  ref as dbRef,
  onValue,
  update,
  sRef,
  uploadBytesResumable,
  getDownloadURL
} from './firebase.js'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut
} from 'firebase/auth'

const hashColor = (str) => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return `hsl(${(hash % 360 + 360) % 360}, 70%, 50%)`
}

const aabbIntersect = (a, b) => {
  return a.min[0] <= b.max[0] && a.max[0] >= b.min[0] &&
         a.min[1] <= b.max[1] && a.max[1] >= b.min[1] &&
         a.min[2] <= b.max[2] && a.max[2] >= b.min[2]
}

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
  )
}

function Building({ position, size = [5, 5, 5] }) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial color="#666" />
    </mesh>
  )
}

function Roads() {
  const ref = useRef()
  useEffect(() => {
    const positions = []
    for (let i = -5; i <= 5; i++) {
      const x = i * 10
      positions.push(new THREE.Vector3(-50, 0.01, x), new THREE.Vector3(50, 0.01, x))
      positions.push(new THREE.Vector3(x, 0.01, -50), new THREE.Vector3(x, 0.01, 50))
    }
    ref.current.geometry.setFromPoints(positions)
  }, [])
  return (
    <lineSegments ref={ref}>
      <bufferGeometry />
      <lineBasicMaterial color="#444" linewidth={3} />
    </lineSegments>
  )
}

function Portal({ position, onEnter }) {
  return (
    <mesh position={position} onPointerDown={onEnter}>
      <ringGeometry args={[1.5, 2.5, 16]} />
      <meshBasicMaterial color="#8B00FF" emissive="#9370DB" emissiveIntensity={0.5} transparent opacity={0.9} />
    </mesh>
  )
}

function Scene({ localPos, otherUsers, buildings, portals, updateUserData }) {
  const { camera } = useThree()
  const controlsRef = useRef()
  const targetVec = useRef(new THREE.Vector3())

  useFrame(() => {
    targetVec.current.set(...localPos)
    if (controlsRef.current) {
      controlsRef.current.target.lerp(targetVec.current, 0.1)
      controlsRef.current.update()
    }
    const camTarget = [localPos[0], localPos[1] + 8, localPos[2] + 15]
    camera.position.lerp(new THREE.Vector3(...camTarget), 0.08)
  })

  return (
    <>
      <color attach="background" args={['#0a0015']} />
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 5]} intensity={1.2} color="#FF1493" />
      <pointLight position={[-10, 5, -5]} intensity={0.8} color="#00FFFF" />
      <Stars radius={80} depth={60} count={8000} factor={4} saturation={0} fade speed={0.5} />
      <Roads />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[200, 200, 100, 100]} />
        <meshLambertMaterial color="#225522" />
      </mesh>
      {buildings.map((b, i) => <Building key={i} position={b.pos} size={b.size} />)}
      {portals.map((p, i) => (
        <Portal
          key={i}
          position={p.pos}
          onEnter={(e) => {
            e.stopPropagation()
            updateUserData({ pos: p.targetPos })
          }}
        />
      ))}
      {Object.entries(otherUsers).map(([uid, data]) => (
        <Avatar key={uid} position={data.pos} color={hashColor(uid)} />
      ))}
      <OrbitControls ref={controlsRef} enablePan={false} enableZoom={true} enableRotate={true} enableDamping dampingFactor={0.05} />
    </>
  )
}

function Player({ localPos, setLocalPos, buildings, updateUserData, throttleRef }) {
  const keys = useRef({})
  const speed = 12

  useEffect(() => {
    const handleKeyDown = (e) => { keys.current[e.code] = true }
    const handleKeyUp = (e) => { keys.current[e.code] = false }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keyup', handleKeyUp)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  useFrame((state, delta) => {
    let dx = 0
    let dz = 0
    if (keys.current.KeyW || keys.current.ArrowUp) dz -= delta * speed
    if (keys.current.KeyS || keys.current.ArrowDown) dz += delta * speed
    if (keys.current.KeyA || keys.current.ArrowLeft) dx -= delta * speed
    if (keys.current.KeyD || keys.current.ArrowRight) dx += delta * speed

    const newPos = [localPos[0] + dx, 0, localPos[2] + dz]

    const playerBox = {
      min: [newPos[0] - 0.4, 0, newPos[2] - 0.4],
      max: [newPos[0] + 0.4, 2, newPos[2] + 0.4]
    }

    const collides = buildings.some((b) => {
      const bBox = {
        min: [b.pos[0] - b.size[0] / 2, 0, b.pos[2] - b.size[2] / 2],
        max: [b.pos[0] + b.size[0] / 2, b.size[1], b.pos[2] + b.size[2] / 2]
      }
      return aabbIntersect(playerBox, bBox)
    })

    if (!collides) {
      setLocalPos(newPos)
      const now = performance.now()
      if (now - throttleRef.current > 150) {
        updateUserData({ pos: newPos })
        throttleRef.current = now
      }
    }
  })

  return null
}

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [localPos, setLocalPos] = useState([0, 0, 0])
  const [points, setPoints] = useState(0)
  const [bio, setBio] = useState('')
  const [urls, setUrls] = useState({})
  const [avatar, setAvatar] = useState('')
  const [otherUsers, setOtherUsers] = useState({})
  const [profileOpen, setProfileOpen] = useState(false)
  const [loginMode, setLoginMode] = useState('login')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const throttleRef = useRef(0)

  const buildings = [
    { pos: [-20, 5, -20], size: [10, 10, 10] },
    { pos: [20, 4, -10], size: [8, 8, 8] },
    { pos: [0, 6, 30], size: [12, 12, 12] },
    { pos: [-30, 3, 20], size: [6, 6, 6] },
    { pos: [25, 7, 0], size: [10, 14, 10] },
    { pos: [-10, 4, -30], size: [7, 8, 7] },
    { pos: [35, 5, 25], size: [9, 10, 9] },
    { pos: [-25, 3, -10], size: [5, 6, 5] },
  ]

  const portals = [
    { pos: [40, 0.5, 0], targetPos: [-40, 0, 0] },
    { pos: [-40, 0.5, 0], targetPos: [40, 0, 0] },
  ]

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
      if (u) {
        const userPath = `users/${u.uid}`
        const userUnsub = onValue(dbRef(db, userPath), (snap) => {
          const data = snap.val() || {}
          setPoints(data.points || 0)
          setBio(data.bio || '')
          setUrls(data.urls || {})
          setAvatar(data.avatar || '')
          if (data.pos) setLocalPos(data.pos)
        })

        const othersUnsub = onValue(dbRef(db, 'users'), (snap) => {
          const data = snap.val() || {}
          const others = {}
          Object.entries(data).forEach(([uid2, d]) => {
            if (uid2 !== u.uid && d?.pos) {
              others[uid2] = d
            }
          })
          setOtherUsers(others)
        })

        return () => {
          userUnsub()
          othersUnsub()
        }
      }
    })
    return unsubscribeAuth
  }, [])

  const updateUserData = useCallback((updates) => {
    if (!user) return
    const now = performance.now()
    if (now - throttleRef.current < 200) return
    throttleRef.current = now
    update(dbRef(db, `users/${user.uid}`), updates).catch(console.error)
  }, [user])

  const earnPoints = () => {
    const newPoints = points + Math.floor(Math.random() * 50 + 10)
    setPoints(newPoints)
    updateUserData({ points: newPoints })
  }

  const saveProfile = () => {
    updateUserData({ bio, urls, points, pos: localPos, ...(avatar && { avatar }) })
    setProfileOpen(false)
  }

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0]
    if (!file || !user) return
    setUploading(true)
    setError('')
    const path = `avatars/${user.uid}`
    const storRef = sRef(storage, path)
    const task = uploadBytesResumable(storRef, file)
    task.on(
      'state_changed',
      null,
      (err) => {
        setError(err.message)
        setUploading(false)
      },
      async () => {
        const url = await getDownloadURL(storRef)
        setAvatar(url)
        updateUserData({ avatar: url })
        setUploading(false)
      }
    )
  }

  const doLogin = () => {
    setError('')
    signInWithEmailAndPassword(auth, email, pw).catch((err) => setError(err.message))
  }

  const doRegister = () => {
    if (pw !== confirmPw) {
      setError('Passwords do not match')
      return
    }
    setError('')
    createUserWithEmailAndPassword(auth, email, pw).catch((err) => setError(err.message))
  }

  const doGoogle = () => {
    setError('')
    signInWithPopup(auth, googleProvider).catch((err) => setError(err.message))
  }

  const doLogout = () => signOut(auth)

  if (loading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-gradient-to-br from-black via-purple-900/20 to-blue-900/20">
        <div className="neon-text text-4xl font-vcr">Loading Reakt World...</div>
      </div>
    )
  }

  return (
    <div className="w-screen h-screen overflow-hidden relative">
      <Canvas
        camera={{ fov: 65 }}
        gl={{
          antialias: false,
          powerPreference: 'low-power',
          alpha: false
        }}
        className="neon-glow"
      >
        <Scene
          localPos={localPos}
          otherUsers={otherUsers}
          buildings={buildings}
          portals={portals}
          updateUserData={updateUserData}
        />
        {user && (
          <Player
            localPos={localPos}
            setLocalPos={setLocalPos}
            buildings={buildings}
            updateUserData={updateUserData}
            throttleRef={throttleRef}
          />
        )}
      </Canvas>
      {/* Points & Controls UI */}
      <motion.div
        className="fixed top-8 right-8 z-50 flex flex-col items-end gap-4 p-6 backdrop-blur-md bg-black/30 rounded-2xl border border-pink-neon/50 neon-glow"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        {user ? (
          <>
            <div className="neon-text text-5xl font-vcr leading-none">
              {points.toLocaleString()}
              <div className="text-2xl font-orbitron opacity-80 mt-[-10px]">PTS</div>
            </div>
            <motion.button
              className="btn-neon text-xl px-8 py-4 w-full"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              onClick={earnPoints}
            >
              Earn Points
              <Zap className="ml-3 w-6 h-6 inline animate-pulse" />
            </motion.button>
            <div className="flex gap-2">
              <motion.button
                className="btn-neon text-base px-6 py-3 flex-1"
                whileHover={{ scale: 1.05 }}
                onClick={() => setProfileOpen(true)}
              >
                <User className="w-5 h-5 mr-2" />
                Profile
              </motion.button>
              <motion.button
                className="bg-red-600/80 hover:bg-red-500 border-red-500/80 text-red-200 px-6 py-3 rounded-xl font-bold uppercase tracking-wider"
                whileHover={{ scale: 1.05 }}
                onClick={doLogout}
              >
                Logout
              </motion.button>
            </div>
            <div className="text-xs uppercase tracking-widest font-vcr opacity-60 text-cyan-neon text-right">
              WASD Move | Mouse Orbit | Click Portals
            </div>
          </>
        ) : (
          <div className="text-4xl neon-text font-vcr mb-4">Join Reakt</div>
        )}
      </motion.div>

      {/* Auth Form */}
      {!user && (
        <motion.div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div className="bg-black/70 p-12 rounded-3xl border-4 border-pink-neon/50 backdrop-blur-xl w-96 neon-glow max-w-md mx-4">
            <div className="text-4xl neon-text mb-8 text-center font-vcr uppercase tracking-widest">Reakt World</div>
            <div className="flex bg-black/50 rounded-2xl overflow-hidden mb-6">
              <button
                className={`flex-1 p-4 font-vcr uppercase tracking-wider transition-all ${loginMode === 'login' ? 'bg-gradient-to-r from-pink-neon to-cyan-neon text-black shadow-lg shadow-pink-neon/50' : 'bg-gray-900/50 hover:bg-gray-800'}`}
                onClick={() => setLoginMode('login')}
              >
                Login
              </button>
              <button
                className={`flex-1 p-4 font-vcr uppercase tracking-wider transition-all ${loginMode === 'register' ? 'bg-gradient-to-r from-pink-neon to-cyan-neon text-black shadow-lg shadow-pink-neon/50' : 'bg-gray-900/50 hover:bg-gray-800'}`}
                onClick={() => setLoginMode('register')}
              >
                Register
              </button>
            </div>
            <input
              className="w-full p-5 bg-black/60 border-2 border-pink-neon/40 rounded-2xl mb-4 text-lg placeholder-gray-400 focus:border-cyan-neon focus:outline-none transition-all neon-glow"
              placeholder="crustorjerry@gmail.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="w-full p-5 bg-black/60 border-2 border-pink-neon/40 rounded-2xl mb-6 text-lg placeholder-gray-400 focus:border-cyan-neon focus:outline-none transition-all neon-glow"
              placeholder="Password"
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
            />
            {loginMode === 'register' && (
              <input
                className="w-full p-5 bg-black/60 border-2 border-pink-neon/40 rounded-2xl mb-6 text-lg placeholder-gray-400 focus:border-cyan-neon focus:outline-none transition-all neon-glow"
                placeholder="Confirm Password"
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
              />
            )}
            <motion.button
              className="w-full btn-neon text-xl py-5 mb-4 font-vcr uppercase tracking-wider shadow-2xl"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={loginMode === 'login' ? doLogin : doRegister}
            >
              {loginMode === 'login' ? 'Enter World' : 'Create Account'}
            </motion.button>
            <motion.button
              className="w-full bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white py-4 px-8 rounded-2xl font-bold uppercase tracking-wider shadow-lg shadow-red-500/50 transition-all"
              whileHover={{ scale: 1.02 }}
              onClick={doGoogle}
            >
              <svg className="w-5 h-5 inline mr-2" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/></svg>
              Continue with Google
            </motion.button>
            {error && (
              <motion.div
                className="mt-6 p-4 bg-red-500/20 border-2 border-red-500/50 rounded-xl text-red-200 text-center font-bold"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {error}
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}

      {/* Profile Modal */}
      {user && profileOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-lg"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => setProfileOpen(false)}
        >
          <motion.div
            className="bg-black/70 p-10 rounded-3xl border-4 border-cyan-neon/50 backdrop-blur-xl w-96 max-h-[85vh] overflow-y-auto neon-glow mx-4 relative"
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl neon-text font-vcr uppercase tracking-wider">Your Profile</h2>
              <button
                className="p-3 hover:scale-110 transition-all"
                onClick={() => setProfileOpen(false)}
              >
                <Edit3 className="w-7 h-7 text-cyan-neon" />
              </button>
            </div>
            <div className="text-center mb-8">
              <div className="relative mx-auto mb-6">
                {avatar ? (
                  <img
                    src={avatar}
                    alt="Avatar"
                    className="w-32 h-32 rounded-full mx-auto border-4 border-gradient-to-r from-pink-neon to-cyan-neon shadow-2xl"
                  />
                ) : (
                  <div className="w-32 h-32 bg-gradient-to-br from-pink-neon/30 to-cyan-neon/30 rounded-full mx-auto flex items-center justify-center text-4xl font-bold border-4 border-pink-neon/50 shadow-xl">
                    👤
                  </div>
                )}
                <label className="btn-neon absolute -bottom-4 left-1/2 transform -translate-x-1/2 px-6 py-3 text-sm cursor-pointer shadow-lg">
                  <Upload className="w-5 h-5 inline mr-2" />
                  Update
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                  />
                </label>
              </div>
              {uploading && <div className="text-cyan-neon font-bold animate-pulse">Uploading...</div>}
            </div>
            <textarea
              className="w-full p-5 bg-black/60 border-2 border-pink-neon/40 rounded-2xl mb-6 h-28 resize-vertical text-lg placeholder-gray-400 focus:border-cyan-neon focus:outline-none neon-glow"
              placeholder="Tell us about yourself (max 500 chars)..."
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 500))}
            />
            <div className="grid grid-cols-1 gap-4 mb-8">
              <input
                className="p-5 bg-black/60 border-2 border-pink-neon/40 rounded-2xl text-lg placeholder-gray-400 focus:border-cyan-neon neon-glow"
                placeholder="Twitter / X"
                value={urls.twitter || ''}
                onChange={(e) => setUrls({ ...urls, twitter: e.target.value })}
              />
              <input
                className="p-5 bg-black/60 border-2 border-pink-neon/40 rounded-2xl text-lg placeholder-gray-400 focus:border-cyan-neon neon-glow"
                placeholder="GitHub"
                value={urls.github || ''}
                onChange={(e) => setUrls({ ...urls, github: e.target.value })}
              />
              <input
                className="p-5 bg-black/60 border-2 border-pink-neon/40 rounded-2xl text-lg placeholder-gray-400 focus:border-cyan-neon neon-glow"
                placeholder="Website / Linktree"
                value={urls.website || ''}
                onChange={(e) => setUrls({ ...urls, website: e.target.value })}
              />
            </div>
            <motion.button
              className="w-full bg-gradient-to-r from-cyan-neon to-lime-neon text-black py-6 px-8 rounded-2xl font-vcr text-xl uppercase tracking-widest shadow-2xl hover:shadow-cyan-neon/50 transition-all font-bold"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={saveProfile}
              disabled={uploading}
            >
              Save & Enter World
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}