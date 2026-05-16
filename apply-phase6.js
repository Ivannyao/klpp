const fs = require('fs');

let html = fs.readFileSync('public/klpp.html', 'utf8');

const newCss = `
.curtain-left, .curtain-right { position: fixed; top: 0; bottom: 0; width: 20vw; background: repeating-linear-gradient(to right, #800000 0%, #b30000 5%, #800000 10%); box-shadow: 0 0 30px rgba(0,0,0,0.9); z-index: 15; transition: transform 1.5s cubic-bezier(0.65, 0, 0.35, 1); pointer-events: none; }
.curtain-left { left: 0; border-right: 8px solid #400; border-bottom-right-radius: 60px; transform: translateX(-100%); }
.curtain-right { right: 0; border-left: 8px solid #400; border-bottom-left-radius: 60px; transform: translateX(100%); }
.curtain-top { position: fixed; top: 0; left: 0; right: 0; height: 12vh; background: repeating-linear-gradient(to right, #800000 0%, #b30000 3%, #800000 6%); border-bottom: 12px solid #ffd700; box-shadow: 0 15px 30px rgba(0,0,0,0.8); z-index: 16; border-radius: 0 0 50% 50% / 0 0 40px 40px; transform: translateY(-100%); transition: transform 1.2s cubic-bezier(0.65, 0, 0.35, 1); pointer-events: none; }
.scoreboard-active .curtain-left { transform: translateX(0); }
.scoreboard-active .curtain-right { transform: translateX(0); }
.scoreboard-active .curtain-top { transform: translateY(0); }
.stage-panel.scoreboard-mode { background: transparent; border: none; box-shadow: none; max-width: 1200px; }
.podium-container { display: flex; align-items: flex-end; justify-content: center; gap: 10px; margin-top: 40px; height: 450px; }
.podium-spot { display: flex; flex-direction: column; align-items: center; width: 220px; animation: slideUp 1s cubic-bezier(0.34, 1.56, 0.64, 1) backwards; }
.podium-spot.first { animation-delay: 0.6s; z-index: 3; }
.podium-spot.second { animation-delay: 0.3s; z-index: 2; }
.podium-spot.third { animation-delay: 0s; z-index: 1; }
.podium-block { width: 100%; border: 6px solid #111; border-bottom: none; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding-top: 20px; font-size: 80px; font-weight: 900; color: #fff; text-shadow: 4px 4px 0 #000; box-shadow: inset 0 10px 20px rgba(255,255,255,0.4), 8px 8px 0 rgba(0,0,0,0.3); }
.podium-spot.first .podium-block { height: 300px; background: linear-gradient(to bottom, #ffd700, #b8860b); }
.podium-spot.second .podium-block { height: 220px; background: linear-gradient(to bottom, #e0e0e0, #909090); }
.podium-spot.third .podium-block { height: 160px; background: linear-gradient(to bottom, #cd7f32, #8b4513); }
.podium-avatar { margin-bottom: 20px; position: relative; }
.podium-spot.first .podium-avatar { transform: scale(1.4); margin-bottom: 40px; }
.podium-score { font-size: 32px; font-weight: 900; background: #111; color: #fff; padding: 5px 15px; border-radius: 20px; border: 4px solid #fff; margin-top: 10px; text-shadow: none; box-shadow: 4px 4px 0 rgba(0,0,0,0.5); }
.podium-name { font-size: 28px; font-weight: 900; color: #fff; text-shadow: 2px 2px 0 #000; background: #111; padding: 4px 12px; border-radius: 12px; margin-bottom: 10px; }
.scoreboard-list { display: flex; flex-wrap: wrap; justify-content: center; gap: 20px; margin-top: 40px; animation: fadeIn 2s ease backwards; animation-delay: 1.2s; }
@keyframes slideUp { from { transform: translateY(100vh); } to { transform: translateY(0); } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.host-round-transition { background: radial-gradient(circle at center, #4b134f, #190a25); box-shadow: inset 0 0 100px #000; }
.host-round-transition__inner { animation: zoomStamp 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
.host-round-transition__label { font-family: "Arial Black", sans-serif; text-shadow: 4px 4px 0 #000; color: #ffcc00; }
.host-round-transition__number { font-family: "Arial Black", sans-serif; text-shadow: 8px 8px 0 #000; color: #fff; }
@keyframes zoomStamp { 0% { transform: scale(3); opacity: 0; } 50% { transform: scale(0.8); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
`;

if (!html.includes('.podium-container')) {
  html = html.replace('</style>', newCss + '\n</style>');
  html = html.replace('<div class="wave-transition" id="hostWaveTransition"></div>', 
    '<div class="wave-transition" id="hostWaveTransition"></div>\n' +
    '        <div class="curtain-left"></div>\n' +
    '        <div class="curtain-right"></div>\n' +
    '        <div class="curtain-top"></div>'
  );
  fs.writeFileSync('public/klpp.html', html);
}

let js = fs.readFileSync('public/klpp-client.js', 'utf8');

const newScoreboardFn = `
  function renderHostScoreboard(scoreboard, snap, isFinal){
    if(!scoreboard || !scoreboard.length) return "";
    var sorted = scoreboard.slice().sort(function(a,b){ return b.score - a.score; });
    var top3 = sorted.slice(0, 3);
    var rest = sorted.slice(3);
    var podiumHtml = '<div class="podium-container">';
    var displayOrder = [1, 0, 2];
    displayOrder.forEach(function(idx) {
      if(top3[idx]) {
        var item = top3[idx];
        var player = lookupPlayer(snap, item.clientId);
        var avatarHtml = renderAvatarHtml(player && player.avatar, "md");
        var placeClass = idx === 0 ? "first" : (idx === 1 ? "second" : "third");
        podiumHtml += '<div class="podium-spot ' + placeClass + '">' +
          '<div class="podium-name">' + escapeHtml(item.nickname) + '</div>' +
          '<div class="podium-avatar">' + avatarHtml + '</div>' +
          '<div class="podium-block">' + (idx + 1) + '<div class="podium-score">' + (item.score || 0) + '</div></div>' +
        '</div>';
      }
    });
    podiumHtml += '</div><div class="scoreboard-list">';
    rest.forEach(function(item) {
      var player = lookupPlayer(snap, item.clientId);
      var avatarHtml = renderAvatarHtml(player && player.avatar, "sm");
      podiumHtml += '<div class="score-row">' + avatarHtml + '<span class="score-name">' + escapeHtml(item.nickname) + '</span><span class="score-value">' + (item.score || 0) + '</span></div>';
    });
    return podiumHtml + '</div>';
  }
`;

if (!js.includes('function renderHostScoreboard(scoreboard, snap, isFinal){\n    if(!scoreboard || !scoreboard.length) return "";\n    var sorted')) {
  js = js.replace(/function renderHostScoreboard[\s\S]*?return '<div class="stage-scoreboard">' \+ rows \+ "<\/div>";\s*\}/, newScoreboardFn.trim());
}

const stateChecks = `
    var isScoreboard = state === "round_score" || state === "finished";
    if (isScoreboard) {
      document.body.classList.add("scoreboard-active");
      els.hostStagePanel.classList.add("scoreboard-mode");
      if(els.hostStagePrompt) els.hostStagePrompt.style.display = "none";
    } else {
      document.body.classList.remove("scoreboard-active");
      els.hostStagePanel.classList.remove("scoreboard-mode");
      if(els.hostStagePrompt) els.hostStagePrompt.style.display = "";
    }
`;

if (!js.includes('document.body.classList.add("scoreboard-active");')) {
  js = js.replace(/els\.hostStagePrompt\.textContent = prompt;/, stateChecks + '\n    els.hostStagePrompt.textContent = prompt;');
}

fs.writeFileSync('public/klpp-client.js', js);
console.log("Phase 6 applied successfully!");
