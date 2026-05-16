const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "public", "klpp.html");
const jsPath = path.join(__dirname, "public", "klpp-client.js");

let html = fs.readFileSync(htmlPath, "utf-8");
let js = fs.readFileSync(jsPath, "utf-8");

// CSS updates
const voteCSS = `
.stage-panel.vote-mode .vote-author{position:absolute;bottom:-40px;border-radius:50%;border:6px solid #111;background:#fff;width:100px;height:100px;overflow:hidden;box-shadow:4px 4px 0 rgba(0,0,0,0.15);right:-40px;display:flex;align-items:center;justify-content:center}
.stage-panel.vote-mode .vote-card:first-child .vote-author{left:-40px;right:auto}
.stage-panel.vote-mode .vote-tally{position:absolute;top:-40px;border:6px solid #111;border-radius:50%;width:100px;height:100px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:24px;font-weight:900;box-shadow:4px 4px 0 rgba(0,0,0,0.15);color:#ff3333;background:#fff;right:-40px}
.stage-panel.vote-mode .vote-card:first-child .vote-tally{left:-40px;right:auto}
.stage-panel.vote-mode .vote-author span{display:none}
.stage-panel.vote-mode .vote-author .character-avatar{width:100%;height:100%;border:none;box-shadow:none;font-size:48px}
.stage-panel.vote-mode .vote-author .avatar{width:100%;height:100%;font-size:48px}
`;

// Only add if not present
if (!html.includes('.stage-panel.vote-mode .vote-author{position:absolute')) {
  html = html.replace('</style>', voteCSS + '\n</style>');
}

// JS updates
// Hide hostStagePanel during answer phase in renderHost()
js = js.replace(/els\.hostStagePanel\.hidden = inLobby;/g, 'els.hostStagePanel.hidden = inLobby || snap.state === "answer";');

// Re-hide players during vote phase in renderHostPlayers
js = js.replace(/function renderHostPlayers\(snap, layout\)\{/g, "function renderHostPlayers(snap, layout){\n    if(els.hostPlayersLayer) els.hostPlayersLayer.style.display = (snap.state === 'vote' || snap.state === 'vote_result') ? 'none' : '';");

fs.writeFileSync(htmlPath, html);
fs.writeFileSync(jsPath, js);
console.log("Fixes applied successfully.");
