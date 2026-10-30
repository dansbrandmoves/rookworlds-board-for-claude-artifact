// RookWorlds.board(target, options): the RookWorlds wooden chessboard in any page, made first for Claude artifacts.
// One script tag (dist/board.js from jsDelivr) gives a 3D board with gliding pieces, a move strip, the player's notes
// by move, Stockfish analysis and play on the viewer's own device, and soft wooden sound on request. The wood and the
// piece set come from assets.js beside it; Stockfish from the public `stockfish` package on the same CDN. Docs: README.
import { Chess } from 'chess.js'
import { createBoard3D } from './board3d.js'

const STOCKFISH_URL = 'https://cdn.jsdelivr.net/npm/stockfish@10.0.2/src/stockfish.asm.js'
// where this script was loaded from, so assets.js is found beside it
const BASE = (document.currentScript && document.currentScript.src || '').replace(/[^/]*$/, '')

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src
    s.onload = resolve
    s.onerror = () => reject(new Error('could not load ' + src))
    document.head.appendChild(s)
  })
}
let assetsPromise = null
function assets() {
  assetsPromise = assetsPromise || (window.RookWorldsAssets ? Promise.resolve() : loadScript(BASE + 'assets.js')).then(() => {
    const a = window.RookWorldsAssets
    if (!a) throw new Error('assets.js did not load')
    const out = {}
    for (const k of Object.keys(a)) out[k] = Uint8Array.from(atob(a[k]), (c) => c.charCodeAt(0))
    return out
  })
  return assetsPromise
}

// ── Stockfish on this device (one engine for the page, main thread: artifacts may not start workers) ─────────────
let enginePromise = null
function engine() {
  enginePromise = enginePromise || (async () => {
    if (!window.STOCKFISH) await loadScript(STOCKFISH_URL)
    const sf = window.STOCKFISH()
    const listeners = new Set()
    sf.onmessage = (l) => listeners.forEach((f) => f(typeof l === 'string' ? l : l && l.data))
    const send = (c) => sf.postMessage(c)
    send('uci')
    return { send, listeners, name: 'Stockfish 10' }
  })()
  return enginePromise
}
let engineBusy = Promise.resolve()
/** One search at a playing level (20 = full strength). Scores in White's point of view. */
function search(fen, { ms = 1500, level = 20 } = {}) {
  const job = engineBusy.then(async () => {
    const e = await engine()
    const sign = fen.split(' ')[1] === 'w' ? 1 : -1
    let best = null, info = null
    await new Promise((resolve) => {
      function listen(line) {
        const m = /^info .*depth (\d+) .*score (cp|mate) (-?\d+).* pv (.+)$/.exec(line || '')
        if (m) info = { depth: +m[1], cp: m[2] === 'cp' ? +m[3] * sign : null, mate: m[2] === 'mate' ? +m[3] * sign : null, pv: m[4].trim().split(/\s+/).filter((t) => /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(t)) }
        if ((line || '').startsWith('bestmove')) { e.listeners.delete(listen); best = line.split(/\s+/)[1]; resolve() }
      }
      e.listeners.add(listen)
      setTimeout(() => {
        e.send('setoption name Skill Level value ' + level)
        e.send('position fen ' + fen)
        e.send('go movetime ' + ms)
      }, 30)
    })
    return { best, info }
  })
  engineBusy = job.catch(() => {})
  return job
}

// ── sound: a soft wooden tock made on the fly (no files), off unless asked ──────────────────────────────────────
let audio = null
function tock(capture, check) {
  if (!audio) return
  const t = audio.currentTime
  const hit = (freq, at, peak) => {
    const o = audio.createOscillator(), g = audio.createGain(), f = audio.createBiquadFilter()
    o.type = 'triangle'; o.frequency.setValueAtTime(freq, t + at); o.frequency.exponentialRampToValueAtTime(freq * 0.6, t + at + 0.08)
    f.type = 'lowpass'; f.frequency.value = 1400
    g.gain.setValueAtTime(0.0001, t + at); g.gain.exponentialRampToValueAtTime(peak, t + at + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + at + 0.12)
    o.connect(f).connect(g).connect(audio.destination); o.start(t + at); o.stop(t + at + 0.15)
  }
  hit(210 + Math.random() * 40, 0, 0.35)
  if (capture) hit(150 + Math.random() * 30, 0.04, 0.3)
  if (check) {
    const o = audio.createOscillator(), g = audio.createGain()
    o.frequency.value = 740
    g.gain.setValueAtTime(0.0001, t + 0.06); g.gain.exponentialRampToValueAtTime(0.1, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7)
    o.connect(g).connect(audio.destination); o.start(t + 0.06); o.stop(t + 0.75)
  }
}

const CSS = `
.rwb{--gold:#C9A24B;--quiet:#8a8172;font:12px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;color:#e8e2d6;background:#14110c;border-radius:10px;padding:6px 10px 8px;max-width:640px;margin:0 auto;box-sizing:border-box}
.rwb *{box-sizing:border-box}
.rwb button{font:inherit;cursor:pointer;background:none;border:0;color:var(--quiet);padding:2px 5px;border-radius:4px}
.rwb button:hover{color:#e8e2d6}
.rwb button:disabled{opacity:.4}
.rwb-top{display:flex;align-items:baseline;gap:2px;margin-bottom:2px}
.rwb-brand{display:none}
.rwb-title{flex:1;min-width:0;color:#b9b0a1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rwb-turn{color:var(--quiet);white-space:nowrap;margin-right:4px}
.rwb-small.on,.rwb-reset{color:var(--gold)!important}
.rwb-stage{position:relative;width:100%;aspect-ratio:1/.82;border-radius:6px;overflow:hidden;touch-action:pan-y}
.rwb-wait{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--quiet)}
.rwb-nav{display:flex;gap:2px;margin-top:4px;align-items:center}
.rwb-nav button{font-size:13px}
.rwb-first,.rwb-prev,.rwb-next,.rwb-last{font-size:24px!important;line-height:1;color:#e8e2d6!important;padding:4px 12px!important;min-width:44px;border-radius:8px}
.rwb-play .rwb-first,.rwb-play .rwb-last{font-size:12px!important;color:var(--quiet)!important;min-width:0}
.rwb-ply{flex:1;text-align:center;color:#b9b0a1}
.rwb-strip{display:flex;gap:1px;overflow-x:auto;margin-top:4px;padding-bottom:2px;scrollbar-width:none}
.rwb-strip button{flex:none;padding:2px 4px;font-size:11px;color:#9d9485}
.rwb-strip .mistake{color:#e0b860}.rwb-strip .blunder{color:#ef8f84}
.rwb-strip .on{color:var(--gold);box-shadow:inset 0 -1px 0 var(--gold)}
.rwb-strip .noted::after{content:'•';color:var(--gold);margin-left:2px}
.rwb-note{margin-top:6px;padding:6px 10px;border-left:2px solid var(--gold);color:#d8cfbf;white-space:pre-wrap;display:none}
.rwb-note.show{display:block}
.rwb-act{display:block;margin:4px auto 0;color:var(--gold)!important}
.rwb-eval{margin-top:4px;color:var(--gold);font-weight:600;font-size:13px;text-align:center}
.rwb-line,.rwb-status{color:var(--quiet);font-size:10.5px;text-align:center}
`

function plyOfLabel(label, sans) {
  if (typeof label === 'number') return label
  if (/^\d+$/.test(label)) return +label
  const m = String(label).trim().match(/^(\d+)\s*(\.\.\.|…|\.)?\s*([A-Za-z][\w=+#-]*)?/)
  if (!m) return null
  let ply = m[2] === '...' || m[2] === '…' ? 2 * m[1] : 2 * m[1] - 1
  const san = m[3] && m[3].replace(/[+#!?]+$/, '')
  if (san && (sans[ply - 1] || '').replace(/[+#!?]+$/, '') !== san && (sans[2 * m[1] - 1] || '').replace(/[+#!?]+$/, '') === san) ply = 2 * m[1]
  return ply
}
const moveName = (ply, san) => `${Math.ceil(ply / 2)}${ply % 2 ? '.' : '...'}${san}`
const scoreText = (i) => !i ? '' : i.mate != null ? `${i.mate > 0 ? 'White' : 'Black'} mates in ${Math.abs(i.mate)}` : `${i.cp > 0 ? '+' : ''}${(i.cp / 100).toFixed(2)}`

/**
 * Put a RookWorlds board in `target` (an element or a selector). Options (all optional):
 *   pgn | moves (SAN list) | fen   the game, or a position (default: the start)
 *   side: 'white' | 'black'        whose side is at the bottom (and the player's side in play mode)
 *   title                          shown at the top
 *   notes: { '29...Nh3+': 'text', 58: 'text' }   notes by move (as written in the game) or by ply
 *   marks: { '28.Nf1': 'mistake', 57: 'blunder' } moves to colour in the strip
 *   at: ply | 'start' | 'end'      where to open (default: the end)
 *   mode: 'review' | 'play'        play: the viewer plays `side` against Stockfish
 *   level: 0..20                   Stockfish's playing strength (default 6)
 *   analyse: true                  show "Analyse this position" (default true)
 *   sound: true                    start with sound on (it is otherwise a button)
 *   onMove(info)                   called on every move made in play mode: { san, fen, pgn }
 * Drag turns the board (and tilts it, with a mouse), pinch or the wheel zooms; "Reset view" goes back.
 * Returns { goTo(ply), next(), prev(), move(san), fen(), pgn(), flip() }. move('e4') plays the viewer's move in play mode
 * (Stockfish then answers), as a tap would.
 */
export function board(target, opts = {}) {
  const host = typeof target === 'string' ? document.querySelector(target) : target
  if (!host) throw new Error('RookWorlds.board: no element ' + target)
  if (!document.getElementById('rwb-css')) {
    const st = document.createElement('style'); st.id = 'rwb-css'; st.textContent = CSS; document.head.appendChild(st)
  }
  const play = opts.mode === 'play'
  let side = opts.side === 'black' ? 'black' : 'white'
  const level = Math.max(0, Math.min(20, opts.level == null ? 6 : opts.level))

  // the game, as a list of positions
  const base = new Chess(opts.fen || undefined)
  const game = new Chess(opts.fen || undefined)
  if (opts.pgn) game.loadPgn(opts.pgn)
  else if (opts.moves) for (const m of opts.moves) game.move(m)
  const startFen = opts.pgn ? (game.getHeaders().FEN || base.fen()) : base.fen()
  let history = game.history({ verbose: true })
  const frames = () => {
    const out = [{ fen: startFen, san: null, last: null }]
    const g = new Chess(startFen)
    for (const m of history) { g.move(m.san); out.push({ fen: g.fen(), san: m.san, last: m.from + m.to }) }
    return out
  }
  let list = frames()
  const sans = () => list.slice(1).map((f) => f.san)
  const keyed = (obj) => {
    const out = {}
    for (const [k, v] of Object.entries(obj || {})) { const p = plyOfLabel(isNaN(+k) ? k : +k, sans()); if (p != null) out[p] = v }
    return out
  }
  const notes = keyed(opts.notes), marks = keyed(opts.marks)
  let at = play ? list.length - 1 : opts.at === 'start' ? 0 : typeof opts.at === 'number' ? opts.at : opts.at ? (plyOfLabel(opts.at, sans()) ?? list.length - 1) : list.length - 1

  // the page
  host.innerHTML = `<div class="rwb">
    <div class="rwb-top"><span class="rwb-brand">RookWorlds</span><span class="rwb-title"></span><span class="rwb-turn"></span>
      <button class="rwb-small rwb-reset" style="display:none">Reset view</button><button class="rwb-small rwb-sound">Sound</button><button class="rwb-small rwb-flip">Flip</button></div>
    <div class="rwb-stage"><div class="rwb-wait">Setting up the board…</div></div>
    <div class="rwb-nav"><button class="rwb-first">&laquo;</button><button class="rwb-prev">&lsaquo;</button><span class="rwb-ply"></span><button class="rwb-next">&rsaquo;</button><button class="rwb-last">&raquo;</button></div>
    <div class="rwb-strip"></div>
    <div class="rwb-note"></div>
    <button class="rwb-act rwb-analyse">Analyse this position</button>
    <div class="rwb-eval"></div><div class="rwb-line"></div><div class="rwb-status"></div>
  </div>`
  const $ = (c) => host.querySelector('.rwb-' + c)
  $('title').textContent = opts.title || (play ? `You vs Stockfish, level ${level}` : [game.getHeaders().White, game.getHeaders().Black].filter(Boolean).join(' vs '))
  if (opts.analyse === false) $('analyse').style.display = 'none'
  if (play) { host.querySelector('.rwb').classList.add('rwb-play'); $('first').textContent = 'Take back'; $('last').textContent = 'New game'; $('prev').style.display = $('next').style.display = 'none' }

  let three = null, picked = null
  const extra = () => {
    if (!play || !picked) return null
    return { selected: picked, targets: game.moves({ square: picked, verbose: true }).map((m) => m.to) }
  }
  function draw(moved) {
    const f = list[at]
    if (three) three.show(f.fen, f.last, side, extra(), moved)
    $('turn').textContent = (f.fen.split(' ')[1] === 'w' ? 'White' : 'Black') + ' to move'
    $('ply').textContent = at ? moveName(at, f.san) : 'Start'
    const note = notes[at]
    $('note').textContent = note || ''
    $('note').classList.toggle('show', !!note)
    ;[...$('strip').children].forEach((b, k) => b.classList.toggle('on', k + 1 === at))
    const on = $('strip').children[at - 1]
    on && on.scrollIntoView({ block: 'nearest', inline: 'center' })
    $('eval').textContent = ''; $('line').textContent = ''
  }
  function strip() {
    $('strip').innerHTML = ''
    list.forEach((f, i) => {
      if (!i) return
      const b = document.createElement('button')
      b.textContent = (i % 2 ? Math.ceil(i / 2) + '.' : '') + f.san
      if (marks[i]) b.classList.add(marks[i])
      if (notes[i]) b.classList.add('noted')
      b.onclick = () => goTo(i)
      $('strip').appendChild(b)
    })
  }
  function goTo(i) {
    const step = i === at + 1
    at = Math.max(0, Math.min(list.length - 1, i))
    picked = null
    draw(step)
    if (step) { const s = list[at].san || ''; tock(/x/.test(s), /[+#]/.test(s)) }
  }

  // play mode
  const yourTurn = () => (game.turn() === 'w') === (side === 'white')
  function status() {
    if (!play) return
    $('status').textContent = game.isCheckmate() ? (yourTurn() ? 'Checkmate. Stockfish wins.' : 'Checkmate. You win!')
      : game.isDraw() ? 'Draw.' : yourTurn() ? (game.inCheck() ? 'Check! Your move.' : 'Your move.') : 'Stockfish is thinking…'
  }
  function played(mv) {
    history = game.history({ verbose: true }); list = frames(); at = list.length - 1
    strip(); draw(true); tock(!!mv.captured, /[+#]/.test(mv.san)); status()
    opts.onMove && opts.onMove({ san: mv.san, fen: game.fen(), pgn: game.pgn() })
  }
  async function reply() {
    if (!play || game.isGameOver() || yourTurn()) return
    status()
    const { best } = await search(game.fen(), { ms: 300 + level * 60, level })
    if (!best || best === '(none)') return
    played(game.move({ from: best.slice(0, 2), to: best.slice(2, 4), promotion: best[4] || 'q' }))
  }
  function tap(sq) {
    if (!play || game.isGameOver() || !yourTurn()) return
    if (picked) {
      const ok = game.moves({ square: picked, verbose: true }).find((m) => m.to === sq)
      if (ok) { const mv = game.move({ from: picked, to: sq, promotion: 'q' }); picked = null; played(mv); setTimeout(reply, 380); return }
    }
    const p = game.get(sq)
    picked = p && p.color === game.turn() && picked !== sq ? sq : null
    draw(false)
  }

  // controls
  $('first').onclick = () => { if (!play) return goTo(0); game.undo(); if (!yourTurn()) game.undo(); history = game.history({ verbose: true }); list = frames(); at = list.length - 1; strip(); draw(false); status(); reply() }
  $('last').onclick = () => { if (!play) return goTo(list.length - 1); game.reset(); if (opts.fen) game.load(opts.fen); history = []; list = frames(); at = 0; strip(); draw(false); status(); reply() }
  $('prev').onclick = () => goTo(at - 1)
  $('next').onclick = () => goTo(at + 1)
  $('flip').onclick = () => { side = side === 'white' ? 'black' : 'white'; draw(false) }
  $('sound').onclick = () => {
    if (!audio) { try { audio = new (window.AudioContext || window.webkitAudioContext)() } catch { return } }
    else { audio.close(); audio = null }
    $('sound').classList.toggle('on', !!audio)
  }
  if (opts.sound) $('sound').onclick()
  $('analyse').onclick = async () => {
    $('analyse').disabled = true
    $('status').textContent = 'Stockfish is thinking on this device…'
    try {
      const { info } = await search(list[at].fen, { ms: 4000, level: 20 })
      $('eval').textContent = scoreText(info)
      if (info && info.pv.length) {
        const g = new Chess(list[at].fen), out = []
        for (const u of info.pv.slice(0, 8)) { try { out.push(g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || 'q' }).san) } catch { break } }
        $('line').textContent = `Best line: ${out.join(' ')} (depth ${info.depth})`
      }
      $('status').textContent = 'Stockfish 10, on your device.'
    } catch (e) {
      $('status').textContent = 'Stockfish could not run here: ' + (e && e.message || e)
    } finally {
      $('analyse').disabled = false
    }
  }
  host.tabIndex = 0
  host.addEventListener('keydown', (e) => { if (play) return; if (e.key === 'ArrowRight') goTo(at + 1); else if (e.key === 'ArrowLeft') goTo(at - 1) })

  strip(); draw(false); status()
  assets().then((a) => createBoard3D($('stage'), a)).then((b) => {
    three = b
    $('wait').remove()
    $('stage').addEventListener('click', (e) => { const sq = b.pick(e.clientX, e.clientY); if (sq) tap(sq) })
    b.onViewChange((t) => { $('reset').style.display = t ? '' : 'none' })
    $('reset').onclick = () => b.resetView()
    draw(false)
    reply()
  }).catch((e) => { $('wait').textContent = 'The 3D board cannot draw here: ' + (e && e.message || e) })

  return {
    goTo, next: () => goTo(at + 1), prev: () => goTo(at - 1), flip: () => $('flip').onclick(),
    move(san) {
      if (!play || game.isGameOver() || !yourTurn()) return false
      let mv
      try { mv = game.move(san) } catch { return false }
      picked = null; played(mv); setTimeout(reply, 380)
      return true
    },
    fen: () => list[at].fen, pgn: () => game.pgn(),
  }
}
