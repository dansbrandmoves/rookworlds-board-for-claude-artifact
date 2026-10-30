# rookworlds-board-for-claude-artifact

**What this repository is for, and only for:** the RookWorlds wooden chessboard packaged as ONE public script that a
**Claude artifact** (or any web page) can load from jsDelivr. It exists because Claude artifacts may load scripts only
from public CDNs: they cannot reach rookworlds.com, and Claude cannot write megabytes of wood textures into a chat. So
the board, its pieces and its wood live here, public, and every artifact loads them with one tag.

**What it is NOT:** not the RookWorlds app (that is `dansbrandmoves/rook-worlds-web`, private), not the MCP connector,
not a place for anyone's games, notes or data. Nothing personal ever goes in this repo: an artifact passes its game in
at runtime.

## Use it in an artifact

```html
<script src="https://cdn.jsdelivr.net/gh/dansbrandmoves/rookworlds-board-for-claude-artifact@v1.0.0/dist/board.js"></script>
<div id="board"></div>
<script>
  const board = RookWorlds.board('#board', {
    pgn: '1. e4 c5 2. Nf3 d6 ...',          // or moves: ['e4', 'c5'], or fen: '...'
    side: 'black',                           // whose side is at the bottom
    title: 'DinhoCarinho vs CheckmateTheDay',
    at: '29.Neg3',                           // open here ('start', 'end', a ply, or a move as written)
    notes: { '29.Neg3': 'Here it feels like I have all but won.' },   // by move as written, or by ply
    marks: { '28.Nf1': 'mistake', '29...Nh3+': 'blunder' },
  })
</script>
```

Play against Stockfish instead: `RookWorlds.board('#board', { mode: 'play', side: 'white', level: 6 })`.

### Options
| option | meaning |
|---|---|
| `pgn` / `moves` / `fen` | the game, a list of SAN moves, or a start position (default: the opening position) |
| `side` | `'white'` or `'black'` at the bottom; the player's side in play mode |
| `title` | shown at the top (default: the PGN's players) |
| `at` | where to open: `'start'`, `'end'` (default), a ply number, or a move like `'29...Nh3+'` |
| `notes` | `{ move or ply: text }`, shown under the board on that move, and dotted in the move strip |
| `marks` | `{ move or ply: 'mistake' \| 'blunder' }`, coloured in the move strip |
| `mode` | `'review'` (default) or `'play'` (the viewer plays `side` against Stockfish) |
| `level` | Stockfish's playing strength, 0 to 20 (default 6) |
| `analyse` | `false` hides "Analyse this position" (default shown) |
| `sound` | `true` starts with the wooden sound on (it is otherwise a button) |
| `onMove(info)` | play mode: called after every move with `{ san, fen, pgn }` |

### Returns
`{ goTo(ply), next(), prev(), move(san), fen(), pgn(), flip() }`. `move('e4')` plays the viewer's move in play mode
(Stockfish answers), as a tap would.

## What runs where
- **The board** (`dist/board.js`, ~650KB): three.js, chess.js and the board, one plain script exposing
  `window.RookWorlds`. Pieces glide, the last move is marked in gold, swipe or arrow keys step through a game.
- **The wood and the piece set** (`dist/assets.js`, ~5.5MB, loaded by board.js from beside itself): base64, decoded
  in the page, so nothing needs network or image permissions (artifacts may have neither).
- **Stockfish** (10, pure JavaScript) from the public `stockfish@10.0.2` npm package on jsDelivr, loaded the first time
  it is needed, running on the viewer's own device. Nothing is sent anywhere.

## Build and release
`npm install && npm run build` writes `dist/`, which is committed (jsDelivr serves the repo as it is). Release by
tagging (`v1.0.1` ...) and pointing artifacts at the tag, so an artifact never changes under its owner.

The board's look is the RookWorlds web app's (`components/game/Board3D.tsx` there); its 3D core is shared with the
app's MCP board (`interfaces/mcp/board3d.src.js` there). Change them together.
