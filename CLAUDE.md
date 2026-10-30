# rookworlds-board-for-claude-artifact

Read README.md first. This repo has ONE purpose: the RookWorlds wooden chessboard as a public script that Claude
artifacts load from jsDelivr (artifacts can only load scripts from public CDNs). It is not the RookWorlds app
(`dansbrandmoves/rook-worlds-web`) and not the MCP connector. Never put personal data, games, notes, keys or app code
here: it is public. `dist/` is committed on purpose (jsDelivr serves it); rebuild with `npm run build` after any change
in `src/`, and release with a new tag. Its 3D core mirrors rook-worlds-web's `interfaces/mcp/board3d.src.js`.
