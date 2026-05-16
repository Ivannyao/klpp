const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "public", "klpp.html");
const jsPath = path.join(__dirname, "public", "klpp-client.js");

let html = fs.readFileSync(htmlPath, "utf-8");
let js = fs.readFileSync(jsPath, "utf-8");

// 1. Fix sunburst and timer position, remove iframe and add video tag
html = html.replace(/\.sunburst-bg\{.*?\}/, ".sunburst-bg{position:fixed;left:50%;top:50%;width:180vmax;height:180vmax;transform:translate(-50%,-50%);z-index:0;background:repeating-conic-gradient(from -10deg,#fff 0deg 14deg,#d1d1d1 14deg 28deg);animation:spin-rays 90s linear infinite}");
html = html.replace(/\.vote-timer-circle\{.*?\}/, ".vote-timer-circle{position:fixed;bottom:40px;left:50%;transform:translateX(-50%);width:140px;height:140px;background:#fff;border-radius:50%;border:8px solid #111;padding:10px;box-shadow:8px 8px 0 rgba(0,0,0,0.15);z-index:20}");

const videoHtml = `
          <video id="answerVideo" autoplay loop muted playsinline style="position:absolute; width:100%; height:100%; object-fit:cover;">
            <source src="/klpp-assets/ocean.mp4" type="video/mp4">
          </video>
`;
html = html.replace(/<iframe id="answerIframe".*?<\/iframe>/, videoHtml);

// 2. JS Updates

// Host Lobby Layout - Update coordinates to avoid overlap on bottom-left and improve spacing
const newLayout = `var spots = isMobile ? [
      {x: 50, y: 65, scale: 1}, {x: 25, y: 60, scale: 0.9}, {x: 75, y: 60, scale: 0.9},
      {x: 35, y: 75, scale: 1.1}, {x: 65, y: 75, scale: 1.1}, {x: 15, y: 70, scale: 1.0},
      {x: 85, y: 70, scale: 1.0}, {x: 50, y: 82, scale: 1.2}, {x: 20, y: 82, scale: 1.2}
    ] : [
      {x: 50, y: 75, scale: 1.1}, {x: 38, y: 70, scale: 1.0}, {x: 62, y: 70, scale: 1.0},
      {x: 26, y: 78, scale: 1.15}, {x: 74, y: 78, scale: 1.15}, {x: 45, y: 62, scale: 0.9},
      {x: 55, y: 62, scale: 0.9}, {x: 32, y: 58, scale: 0.85}, {x: 68, y: 58, scale: 0.85},
      {x: 85, y: 66, scale: 0.95}, {x: 40, y: 85, scale: 1.2}, {x: 60, y: 85, scale: 1.2}
    ];`;
js = js.replace(/var spots = isMobile \? \[.*?\] : \[.*?\];/s, newLayout);

// Hide hostStagePanel in answer mode
js = js.replace(/els\.hostStagePanel\.hidden = inLobby;/, "els.hostStagePanel.hidden = inLobby || inAnswer;");

// Hide players layer during vote
js = js.replace(/function renderHostPlayers\(snap, layout\)\{/, "function renderHostPlayers(snap, layout){\n    var inVote = snap.state === 'vote' || snap.state === 'vote_result';\n    if(els.hostPlayersLayer) els.hostPlayersLayer.style.display = inVote ? 'none' : '';");

// Re-write vote card rendering to include avatars and tallies
const voteCardRegex = /meta\.push\('<div class="stage-vote-pair">'\);\s*meta\.push\('<div class="vote-card">'\s*\+\s*\(leftMissing \? .*?\) \+ '<\/div>'\);\s*meta\.push\('<div class="vote-card">'\s*\+\s*\(rightMissing \? .*?\) \+ '<\/div>'\);\s*meta\.push\('<\/div>'\);/s;

const newVoteCardLogic = `
      var leftAuthor = lookupPlayer(snap, vote.leftClientId);
      var rightAuthor = lookupPlayer(snap, vote.rightClientId);
      var showAuthors = (snap.settings && !snap.settings.anonymousAnswers) || state === "vote_result";
      
      var leftAvatarHtml = showAuthors && leftAuthor ? '<div class="vote-author">' + renderAvatarHtml(leftAuthor.avatar, "md") + '</div>' : '';
      var rightAvatarHtml = showAuthors && rightAuthor ? '<div class="vote-author">' + renderAvatarHtml(rightAuthor.avatar, "md") + '</div>' : '';
      
      var leftTally = state === "vote_result" ? '<div class="vote-tally">' + vote.result.leftPercent + '%</div>' : '';
      var rightTally = state === "vote_result" ? '<div class="vote-tally">' + vote.result.rightPercent + '%</div>' : '';

      meta.push('<div class="stage-vote-pair">');
      meta.push('<div class="vote-card">' + (leftMissing ? '<span class="vote-text missing">(НЕТ ОТВЕТА)</span>' : '<span class="vote-text">' + escapeHtml(vote.leftText) + '</span>') + leftAvatarHtml + leftTally + '</div>');
      meta.push('<div class="vote-card">' + (rightMissing ? '<span class="vote-text missing">(НЕТ ОТВЕТА)</span>' : '<span class="vote-text">' + escapeHtml(vote.rightText) + '</span>') + rightAvatarHtml + rightTally + '</div>');
      meta.push('</div>');
`;

if (voteCardRegex.test(js)) {
  js = js.replace(voteCardRegex, newVoteCardLogic);
} else {
  console.log("Could not find vote card regex");
}

fs.writeFileSync(htmlPath, html);
fs.writeFileSync(jsPath, js);
console.log("Fixed!");
