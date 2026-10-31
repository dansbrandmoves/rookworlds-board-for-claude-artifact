// The RookWorlds wooden board in 3D: maple and rosewood squares on a rosewood frame, boxwood and ebony pieces on oak
// grain, warm studio light, nothing else. The piece set and the wood come as bytes from assets.js (no image URL and no
// fetch, so it draws inside a Claude artifact's rules); images are decoded with createImageBitmap.
import {
  ACESFilmicToneMapping, AmbientLight, BoxGeometry, CanvasTexture, Color, DirectionalLight, Group, Mesh,
  MeshStandardMaterial, PCFSoftShadowMap, PerspectiveCamera, PlaneGeometry, PMREMGenerator, RepeatWrapping, Scene,
  Plane, Raycaster, SRGBColorSpace, Texture, Vector2, Vector3, WebGLRenderer,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

// the web app's measures (Board3D.tsx)
const BOARD_ELEV = 0.30
const INLAY_HALF = 4.07
const FRAME_HALF = 4.75
const PIECE_BASE = BOARD_ELEV + 0.02
const PIECE_SCALE = 17.3
const KNIGHT_FACE = Math.PI
const PIECE_NODES = { p: 'piece_pawn_white_01', r: 'piece_rook_white_01', n: 'piece_knight_white_01', b: 'piece_bishop_white_01', q: 'piece_queen_white', k: 'piece_king_white' }
const GOLD = '#E8B33E'

/** A texture from bytes already on the page (assets.js), decoded without any image URL. */
async function texture(bytes, srgb) {
  const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }))
  const t = new Texture(bmp)
  t.wrapS = t.wrapT = RepeatWrapping
  if (srgb) t.colorSpace = SRGBColorSpace
  t.needsUpdate = true
  return t
}
const wood = async (assets, name) => {
  const [map, normalMap, roughnessMap] = await Promise.all([
    texture(assets[name + '_diff'], true), texture(assets[name + '_nor_gl'], false), texture(assets[name + '_rough'], false),
  ])
  return { map, normalMap, roughnessMap }
}
function cfg(t, { rot = 0, repeat = 1 } = {}) {
  const c = t.clone()
  c.center.set(0.5, 0.5)
  c.rotation = rot
  c.repeat.set(repeat, repeat)
  c.needsUpdate = true
  return c
}
const material = (tex, tint, rough, opts) => new MeshStandardMaterial({
  map: cfg(tex.map, opts), normalMap: cfg(tex.normalMap, opts), roughnessMap: cfg(tex.roughnessMap, opts),
  color: new Color(tint), roughness: rough, metalness: 0,
})

/** a square's centre on the board, the side to play at the bottom */
function squareXZ(sq, side) {
  const f = sq.charCodeAt(0) - 97, r = +sq[1] - 1
  return side === 'black' ? [3.5 - f, r - 3.5] : [f - 3.5, 3.5 - r]
}

/** one rank or file letter, set into the frame the way the web app does it: a plain sans-serif, small, in a soft
 *  maple tone that sits in the wood rather than on it (the owner, 2026-10-30: the serif letters were too distracting) */
function label(text) {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  g.fillStyle = 'rgba(226, 204, 160, 0.78)'
  g.font = '500 58px Inter, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text, 64, 68)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  const m = new Mesh(new PlaneGeometry(0.42, 0.42), new MeshStandardMaterial({ map: t, transparent: true, roughness: 0.95, depthWrite: false }))
  m.rotation.x = -Math.PI / 2
  return m
}

/**
 * Make the board in `host` (a block element). Resolves to { show(fen, last, side), resize(), dispose() }, or rejects
 * when this device or chat cannot draw it (no WebGL, an asset refused): the caller keeps the flat board then.
 */
export async function createBoard3D(host, assets) {
  const probe = document.createElement('canvas')
  if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) throw new Error('no WebGL')
  const [gltf, oak, rose] = await Promise.all([
    (async () => {
      const loader = new GLTFLoader()
      // the set's own textures are never used (the pieces are dressed in our wood): skip them, so no image URL is made
      loader.register(() => ({ name: 'rookworlds_no_textures', loadTexture: () => Promise.resolve(null) }))
      // the RookWorlds Staunton set (rook-worlds-web docs/concepts/piece-set.md); the Poly Haven set is this repo's git history
      const set = assets.staunton
      return loader.parseAsync(set.buffer.slice(set.byteOffset, set.byteOffset + set.byteLength), '')
    })(),
    wood(assets, 'oak_veneer_01'),
    wood(assets, 'rosewood_veneer1'),
  ])

  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.outputColorSpace = SRGBColorSpace
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFSoftShadowMap
  renderer.domElement.style.display = 'block'
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'
  host.appendChild(renderer.domElement)

  const scene = new Scene()
  const pmrem = new PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environmentIntensity = 0.55
  // the web app's studio light, warm and soft
  scene.add(new AmbientLight('#FFE9D2', 0.40))
  const key = new DirectionalLight('#FFEAC6', 2.2)
  key.position.set(-4, 10, 6)
  key.castShadow = true
  key.shadow.mapSize.set(1024, 1024)
  Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 })
  key.shadow.bias = -0.0004
  key.shadow.radius = 4
  scene.add(key)
  for (const [p, i, c] of [[[7, 5, 5], 0.6, '#F6E3C4'], [[-5, 8, -9], 1.7, '#FFD9A6'], [[6, 7, -8], 1.15, '#FFE2B4']]) {
    const l = new DirectionalLight(c, i)
    l.position.set(...p)
    scene.add(l)
  }

  // the board: rosewood frame, maple inlay, maple and rosewood squares with the grain turning file by file
  const maple = [material(oak, '#F2E6C6', 0.88), material(oak, '#F2E6C6', 0.88, { rot: Math.PI / 2 })]
  const rosewood = [material(rose, '#9C6446', 0.84), material(rose, '#9C6446', 0.84, { rot: Math.PI / 2 })]
  const frameMat = material(rose, '#5A3320', 0.985)
  frameMat.envMapIntensity = 0.15
  const frame = new Mesh(new BoxGeometry(FRAME_HALF * 2, BOARD_ELEV, FRAME_HALF * 2), frameMat)
  frame.position.y = BOARD_ELEV / 2 - 0.01
  frame.receiveShadow = true
  scene.add(frame)
  const inlay = new Mesh(new BoxGeometry(INLAY_HALF * 2, 0.02, INLAY_HALF * 2), maple[0])
  inlay.position.y = BOARD_ELEV - 0.011
  inlay.receiveShadow = true
  scene.add(inlay)
  const squareGeo = new BoxGeometry(1, 0.001, 1)
  const highlight = new MeshStandardMaterial({ color: GOLD, emissive: GOLD, emissiveIntensity: 0.35, transparent: true, opacity: 0.42, depthWrite: false })
  // playing: the piece picked up (strong) and where it may go (a small gold disc)
  const picked = new MeshStandardMaterial({ color: GOLD, emissive: GOLD, emissiveIntensity: 0.6, transparent: true, opacity: 0.6, depthWrite: false })
  const dotGeo = new PlaneGeometry(0.28, 0.28)
  const dotMat = new MeshStandardMaterial({ color: GOLD, emissive: GOLD, emissiveIntensity: 0.7, transparent: true, opacity: 0.85, depthWrite: false })
  const squares = new Group()
  const marks = new Group()
  const labels = new Group()
  scene.add(squares, marks, labels)

  // the pieces: one clone per piece on the board, dressed in boxwood or ebony on oak grain
  const node = (name) => gltf.scene.getObjectByName(name)
  const boxwood = material(oak, '#F3E4BE', 0.50, { repeat: 2.5 })
  boxwood.normalScale = new Vector2(0.35, 0.35)
  const ebony = material(oak, '#211711', 0.30, { repeat: 2.5 })
  ebony.normalScale = new Vector2(0.36, 0.36)
  ebony.envMapIntensity = 1.6
  ebony.emissive = new Color('#2a1c0f')
  ebony.emissiveIntensity = 0.07
  const pieces = new Group()
  scene.add(pieces)

  const camera = new PerspectiveCamera(38, 1, 0.1, 100)
  let side = null

  function layout(s) {
    if (s === side) return
    side = s
    squares.clear()
    labels.clear()
    for (let f = 0; f < 8; f++) for (let r = 0; r < 8; r++) {
      const sq = String.fromCharCode(97 + f) + (r + 1)
      const [x, z] = squareXZ(sq, side)
      const m = new Mesh(squareGeo, (f + r) % 2 ? maple[f % 2] : rosewood[f % 2])
      m.position.set(x, BOARD_ELEV, z)
      m.receiveShadow = true
      squares.add(m)
    }
    const edge = (4 + FRAME_HALF) / 2
    for (let i = 0; i < 8; i++) {
      const file = String.fromCharCode(97 + i), rank = String(i + 1)
      const [fx] = squareXZ(file + '1', side)
      const [, rz] = squareXZ('a' + rank, side)
      const a = label(file); a.position.set(fx, BOARD_ELEV + 0.002, edge); labels.add(a)
      const b = label(rank); b.position.set(-edge, BOARD_ELEV + 0.002, rz); labels.add(b)
    }
  }

  // The camera stands on the player's side at a fixed angle and comes as close as it can while the whole frame and the
  // tops of the far pieces stay in view, whatever the box's shape: the board fills the box (the owner, 2026-10-30).
  const EDGES = []
  for (const x of [-FRAME_HALF, FRAME_HALF]) for (const z of [-FRAME_HALF, FRAME_HALF]) EDGES.push(new Vector3(x, 0, z), new Vector3(x, BOARD_ELEV, z))
  for (const x of [-3.5, 3.5]) EDGES.push(new Vector3(x, 1.9, -3.5)) // a king's top on the far rank
  const TILT = 0.88 // radians above the board: a player's view, every square readable
  const AIM = new Vector3(0, 0, 0.35)
  // the view the player has turned to (drag to turn, pinch or wheel to zoom); resetView() goes back to the player's
  // tilt null: the automatic angle for the box's shape (steeper on a tall phone screen, so the board fills its height)
  let view = { az: 0, tilt: null, zoom: 1 }
  let autoTilt = TILT
  let onView = null
  const turned = () => Math.abs(view.az) > 0.01 || view.tilt != null || Math.abs(view.zoom - 1) > 0.01
  function place(d) {
    const tilt = view.tilt ?? autoTilt
    const c = Math.cos(tilt)
    camera.position.set(AIM.x + d * Math.sin(view.az) * c, AIM.y + d * Math.sin(tilt), AIM.z + d * Math.cos(view.az) * c)
    camera.lookAt(AIM)
    camera.updateMatrixWorld()
    camera.updateProjectionMatrix()
  }
  const fits = (margin) => EDGES.every((p) => { const v = p.clone().project(camera); return Math.abs(v.x) <= margin && Math.abs(v.y) <= margin })
  function frameCamera() {
    const w = host.clientWidth || 400, h = host.clientHeight || 340
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.fov = 36
    autoTilt = Math.max(TILT, Math.min(1.08, TILT + (h / w - 1) * 0.3))
    // the distance is fitted from the player's own side and kept when the board is turned or tilted, so turning never
    // shrinks it; at an angle its corners may run past the edges, as a zoom crops
    const turnedTo = { az: view.az, tilt: view.tilt }
    view.az = 0; view.tilt = null
    let lo = 4, hi = 60
    for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; place(mid); if (fits(0.97)) hi = mid; else lo = mid }
    view.az = turnedTo.az; view.tilt = turnedTo.tilt
    place(hi * view.zoom)
  }

  // turning the board: a drag turns it (sideways) and tilts it (up and down, with a mouse; on a touch screen up and
  // down still scrolls the page), two fingers or the wheel zoom. A drag is never taken for a tap on a square.
  const el = renderer.domElement
  el.style.touchAction = 'pan-y'
  const pointers = new Map()
  let dragged = false, pinch = null
  // the wheel pressed in (a middle-button drag) zooms: up to come closer, down to step back; never the browser's autoscroll
  let wheelDrag = null
  el.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault() })
  el.addEventListener('auxclick', (e) => { if (e.button === 1) e.preventDefault() })
  el.addEventListener('pointerdown', (e) => {
    if (e.button === 1) { e.preventDefault(); wheelDrag = { y: e.clientY, zoom: view.zoom }; el.setPointerCapture?.(e.pointerId); return }
    snapping++ // a new touch stops a snap in progress
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY })
    dragged = false
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: view.zoom } }
  })
  el.addEventListener('pointermove', (e) => {
    if (wheelDrag) {
      view.zoom = Math.max(0.55, Math.min(1.7, wheelDrag.zoom * Math.exp((e.clientY - wheelDrag.y) * 0.006)))
      frameCamera(); draw(); onView && onView(turned())
      return
    }
    const p = pointers.get(e.pointerId)
    if (!p) return
    const dx = e.clientX - p.x, dy = e.clientY - p.y
    p.x = e.clientX; p.y = e.clientY
    if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()]
      view.zoom = Math.max(0.55, Math.min(1.7, pinch.zoom * pinch.d / Math.max(1, Math.hypot(a.x - b.x, a.y - b.y))))
      dragged = true
    } else {
      if (!dragged && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < 7) return
      dragged = true
      view.az -= dx * 0.009
      if (e.pointerType === 'mouse') view.tilt = Math.max(0.3, Math.min(1.45, (view.tilt ?? autoTilt) + dy * 0.006))
    }
    frameCamera(); draw(); onView && onView(turned())
  })
  // letting go after a turn eases the board to the nearest obvious view: either player's side, either side of the
  // board, or a corner (every 45 degrees; the owner, 2026-10-30: "snap to obvious angles")
  const STEP = Math.PI / 4
  let snapping = 0
  function snap() {
    const from = view.az, to = Math.round(view.az / STEP) * STEP
    if (Math.abs(to - from) < 0.001) { view.az = to; onView && onView(turned()); return }
    const t0 = performance.now(), id = ++snapping
    const stepFrame = (now) => {
      if (id !== snapping) return
      const k = Math.min(1, (now - t0) / 260), e = 1 - Math.pow(1 - k, 3)
      view.az = from + (to - from) * e
      frameCamera(); renderer.render(scene, camera)
      if (k < 1) requestAnimationFrame(stepFrame)
      else { view.az = to; onView && onView(turned()) }
    }
    requestAnimationFrame(stepFrame)
  }
  const up = (e) => {
    if (wheelDrag && e.button === 1) { wheelDrag = null; return }
    const wasTurn = pointers.size === 1 && !pinch && dragged
    pointers.delete(e.pointerId)
    if (pointers.size < 2) pinch = null
    if (wasTurn) snap()
  }
  el.addEventListener('pointerup', up)
  el.addEventListener('pointercancel', up)
  el.addEventListener('click', (e) => { if (dragged) { e.stopPropagation(); dragged = false } }, true)
  // the wheel zooms: a trackpad pinch (a wheel with ctrlKey) always, a plain scroll only when wheelZooms (full
  // screen; in a chat, a plain scroll moves the conversation and must never be trapped by the board)
  let wheelZooms = true
  el.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && !wheelZooms) return
    e.preventDefault()
    view.zoom = Math.max(0.55, Math.min(1.7, view.zoom * Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0012))))
    frameCamera(); draw(); onView && onView(turned())
  }, { passive: false })
  function resetView() { view = { az: 0, tilt: null, zoom: 1 }; frameCamera(); draw(); onView && onView(false) }

  let pending = false
  const draw = () => {
    if (pending) return
    pending = true
    requestAnimationFrame(() => { pending = false; renderer.render(scene, camera) })
  }

  // a piece that just moved glides from its old square with a small lift, the way the web app's pieces do
  let glide = null
  function animate(now) {
    if (!glide) return
    const k = Math.min(1, (now - glide.t0) / 320)
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
    glide.obj.position.set(glide.from[0] + (glide.to[0] - glide.from[0]) * e, PIECE_BASE + Math.sin(Math.PI * k) * 0.35, glide.from[1] + (glide.to[1] - glide.from[1]) * e)
    renderer.render(scene, camera)
    if (k < 1) requestAnimationFrame(animate)
    else glide = null
  }

  /** `extra` (playing): { selected: 'e2', targets: ['e3', 'e4'] }. `moved`: the last move was just made (one step
   *  forward or a move played), so its piece glides in. */
  function show(fen, last, s, extra, moved) {
    layout(s === 'black' ? 'black' : 'white')
    pieces.clear()
    const rows = fen.split(' ')[0].split('/')
    glide = null
    rows.forEach((row, ri) => {
      let f = 0
      for (const ch of row) {
        if (/\d/.test(ch)) { f += +ch; continue }
        const sq = String.fromCharCode(97 + f) + (8 - ri)
        f++
        const type = ch.toLowerCase(), white = ch !== type
        const src = node(PIECE_NODES[type])
        if (!src) continue
        const obj = src.clone(true)
        obj.position.set(0, 0, 0)
        obj.rotation.set(0, 0, 0)
        obj.scale.set(1, 1, 1)
        obj.traverse((o) => { if (o.isMesh) { o.material = white ? boxwood : ebony; o.castShadow = true } })
        const g = new Group()
        const [x, z] = squareXZ(sq, side)
        g.position.set(x, PIECE_BASE, z)
        g.scale.setScalar(PIECE_SCALE)
        // knights face the other army
        if (type === 'n') g.rotation.y = (white === (side === 'white')) ? KNIGHT_FACE : KNIGHT_FACE + Math.PI
        g.add(obj)
        pieces.add(g)
        if (moved && last && sq === last.slice(2, 4)) {
          const from = squareXZ(last.slice(0, 2), side)
          g.position.set(from[0], PIECE_BASE, from[1])
          glide = { obj: g, from, to: [x, z], t0: performance.now() }
        }
      }
    })
    marks.clear()
    if (last) for (const sq of [last.slice(0, 2), last.slice(2, 4)]) {
      const m = new Mesh(squareGeo, highlight)
      const [x, z] = squareXZ(sq, side)
      m.position.set(x, BOARD_ELEV + 0.0015, z)
      marks.add(m)
    }
    if (extra && extra.selected) {
      const m = new Mesh(squareGeo, picked)
      const [x, z] = squareXZ(extra.selected, side)
      m.position.set(x, BOARD_ELEV + 0.002, z)
      marks.add(m)
    }
    for (const sq of (extra && extra.targets) || []) {
      const d = new Mesh(dotGeo, dotMat)
      d.rotation.x = -Math.PI / 2
      const [x, z] = squareXZ(sq, side)
      d.position.set(x, BOARD_ELEV + 0.003, z)
      marks.add(d)
    }
    if (glide) requestAnimationFrame(animate)
    else draw()
  }

  /** The square under a point on the page (a tap), or null off the board. */
  const ray = new Raycaster()
  const surface = new Plane(new Vector3(0, 1, 0), -BOARD_ELEV)
  function pick(clientX, clientY) {
    const r = renderer.domElement.getBoundingClientRect()
    ray.setFromCamera(new Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), camera)
    const hit = ray.ray.intersectPlane(surface, new Vector3())
    if (!hit || Math.abs(hit.x) >= 4 || Math.abs(hit.z) >= 4) return null
    const fx = Math.floor(hit.x + 4), rz = Math.floor(hit.z + 4) // 0..7 from the left and from the far side
    const f = side === 'black' ? 7 - fx : fx
    const r8 = side === 'black' ? rz : 7 - rz
    return String.fromCharCode(97 + f) + (r8 + 1)
  }

  /** Where a square's centre is on the page (the inverse of pick), e.g. to check a tap lands where it looks. */
  function screenOf(sq) {
    const [x, z] = squareXZ(sq, side)
    const v = new Vector3(x, BOARD_ELEV, z).project(camera)
    const r = renderer.domElement.getBoundingClientRect()
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }
  }

  frameCamera()
  const onResize = () => { frameCamera(); draw() }
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(onResize) : null
  ro ? ro.observe(host) : window.addEventListener('resize', onResize)
  return {
    show,
    pick,
    resetView,
    /** whether a plain scroll zooms (a pinch always does) */
    setWheelZoom(on) { wheelZooms = !!on },
    /** called with true when the player has turned the view, false when it is back to theirs */
    onViewChange(fn) { onView = fn },
    screenOf,
    resize: onResize,
    dispose() {
      ro ? ro.disconnect() : window.removeEventListener('resize', onResize)
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
