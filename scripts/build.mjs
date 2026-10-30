// Builds dist/board.js (the board: three.js, chess.js and our code, one plain script exposing window.RookWorlds) and
// dist/assets.js (the piece set and the wood as base64, loaded by board.js from beside itself). `npm run build`.
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'

mkdirSync('dist', { recursive: true })
execFileSync('npx', ['-y', 'esbuild@0.25.11', 'src/index.js', '--bundle', '--minify', '--format=iife', '--global-name=RookWorlds',
  '--target=es2020', '--legal-comments=none', '--outfile=dist/board.js'], { stdio: 'inherit' })

const assets = {}
for (const f of readdirSync('assets')) {
  const key = f.replace(/\.(glb|jpg)$/, '').replace(/_1k$/, '')
  assets[key] = readFileSync(`assets/${f}`).toString('base64')
}
writeFileSync('dist/assets.js', `window.RookWorldsAssets=${JSON.stringify(assets)};\n`)
console.log('dist/assets.js', Object.keys(assets).join(', '), Math.round(readFileSync('dist/assets.js').length / 1024), 'KB')
