const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "public", "klpp.html");
const jsPath = path.join(__dirname, "public", "klpp-client.js");

let html = fs.readFileSync(htmlPath, "utf-8");
let js = fs.readFileSync(jsPath, "utf-8");

// --- Update HTML ---

// Add video bg and segmented timer
const newHtmlContent = `
        <img class="host-trash" src="/klpp-assets/lobby/trash.png" alt="">
        <img class="host-cloud" src="/klpp-assets/lobby/room-cloud.png" alt="">
        <div class="host-scene-overlay" id="hostSceneOverlay"></div>
        <div class="video-bg" id="hostAnswerVideo" hidden>
          <iframe id="answerIframe" src="https://www.youtube.com/embed/75deCkdo6DY?autoplay=1&mute=1&controls=0&loop=1&playlist=75deCkdo6DY&vq=hd1080" frameborder="0" allow="autoplay; encrypted-media"></iframe>
          <div class="video-overlay"></div>
        </div>
        <div class="sunburst-bg" id="hostVoteSunburst" hidden></div>
        
        <div class="segmented-timer" id="hostSegmentedTimer" hidden>
          <span id="hostSegmentedTimerLabel">00</span>
        </div>

        <div class="answer-phase-text" id="hostAnswerText" hidden>
          Игроки отвечают на своих устройствах
        </div>

        <div class="wave-transition" id="hostWaveTransition"></div>

        <div class="host-qr-card"><img id="qrImage" alt="QR код для входа"></div>
`;

html = html.replace(/<img class="host-trash".*?alt="QR код для входа"><\/div>/s, newHtmlContent);

// Add voting specific markup if needed, we'll use stage-panel for vote too but style it differently.
// Wait, we need the stage-panel to be transparent during vote phase.

const voteCss = `
.sunburst-bg{position:fixed;inset:0;z-index:0;background:repeating-conic-gradient(from -10deg,#fff 0deg 14deg,#d1d1d1 14deg 28deg);animation:spin-rays 90s linear infinite}
.video-bg{position:absolute;inset:0;z-index:0;overflow:hidden;background:#000}
.video-bg iframe{position:absolute;top:50%;left:50%;width:100vw;height:56.25vw;min-height:100vh;min-width:177.77vh;transform:translate(-50%,-50%);pointer-events:none}
.video-overlay{position:absolute;inset:0;background:linear-gradient(to bottom, rgba(135,206,235,0.2), rgba(0,0,0,0.2))}
.segmented-timer{position:absolute;top:60px;left:60px;z-index:15;font-family:monospace, Courier;font-size:54px;font-weight:900;color:#ff3333;background:#111;padding:12px 30px;border:6px solid #444;border-radius:12px;box-shadow:inset 0 0 10px rgba(0,0,0,0.8), 6px 8px 0 rgba(0,0,0,0.3);letter-spacing:4px}
.answer-phase-text{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:15;font-size:52px;font-weight:900;color:#fff;text-shadow:3px 3px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;text-align:center;width:80%}
.wave-transition{position:fixed;left:0;right:0;top:-120vh;height:120vh;background:url('data:image/svg+xml;utf8,<svg viewBox="0 0 1440 320" xmlns="http://www.w3.org/2000/svg"><path fill="%230099ff" d="M0,160L48,176C96,192,192,224,288,213.3C384,203,480,149,576,144C672,139,768,181,864,197.3C960,213,1056,203,1152,186.7C1248,171,1344,149,1392,138.7L1440,128L1440,0L1392,0C1344,0,1248,0,1152,0C1056,0,960,0,864,0C768,0,672,0,576,0C480,0,384,0,288,0C192,0,96,0,48,0L0,0Z"></path></svg>') bottom center / 100vw auto no-repeat, #0099ff;z-index:900;transition:top 1.2s cubic-bezier(0.4, 0, 0.2, 1);pointer-events:none}
.wave-transition.active{top:100vh}

.vote-timer-circle{top:auto;bottom:-120px;width:140px;height:140px;background:#fff;border-radius:50%;border:8px solid #111;padding:10px;box-shadow:8px 8px 0 rgba(0,0,0,0.15)}
.vt-progress{stroke:#ff3333}
.stage-panel.vote-mode{background:transparent;border:none;box-shadow:none;top:8vh;width:95vw;max-width:1100px}
.stage-panel.vote-mode .stage-prompt{font-size:64px;color:#000;text-shadow:none;margin-bottom:60px;font-weight:900;font-family:Arial Black, sans-serif;background:#fff;padding:20px 40px;border:6px solid #111;display:inline-block;border-radius:24px;box-shadow:8px 8px 0 rgba(0,0,0,0.15)}
.stage-panel.vote-mode .stage-vote-pair{gap:80px}
.stage-panel.vote-mode .vote-card{background:#fff;border:6px solid #111;border-radius:0;box-shadow:8px 8px 0 rgba(0,0,0,0.15);padding:40px;min-height:220px;position:relative;display:flex;align-items:center;justify-content:center}
.stage-panel.vote-mode .vote-text{font-size:38px;font-weight:900}
.stage-panel.vote-mode .vote-author{position:absolute;bottom:-40px;right:-40px;border-radius:50%;border:6px solid #111;background:#fff;width:100px;height:100px;overflow:hidden;box-shadow:4px 4px 0 rgba(0,0,0,0.15)}
.stage-panel.vote-mode .vote-card:first-child .vote-author{left:-40px;right:auto}
.stage-panel.vote-mode .vote-tally{position:absolute;top:-40px;right:-40px;background:#fff;border:6px solid #111;border-radius:50%;width:100px;height:100px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:24px;font-weight:900;box-shadow:4px 4px 0 rgba(0,0,0,0.15);color:#ff3333}
.stage-panel.vote-mode .vote-card:first-child .vote-tally{left:-40px;right:auto}
.stage-panel.vote-mode .vote-author span{display:none}
.stage-panel.vote-mode .vote-author .character-avatar{width:100%;height:100%;border:none;box-shadow:none;font-size:48px}
`;

html = html.replace("</style>", voteCss + "\n</style>");

// Make sure answer iframe gets reset when active
// We will do this in JS.

// --- Update JS ---

js = js.replace(/var trashSpot = .*?;/g, "var trashSpot = index >= layout.fieldSpots.length;");

js = js.replace(/var pos = trashSpot \? layout.lastJoinedSpot : layout.fieldSpots\[.*?\];/g, "var pos = trashSpot ? layout.lastJoinedSpot : layout.fieldSpots[index % layout.fieldSpots.length];");

// Hide UI elements in answer/vote mode
const renderHostStageReplacement = `
    var state = snap.state;
    var inAnswer = state === "answer";
    var inVote = state === "vote" || state === "vote_result";
    
    els.hostStagePanel.classList.toggle("vote-mode", inVote);
    els.hostStagePanel.classList.toggle("answer-mode", inAnswer);
    
    var hostAnswerVideo = document.getElementById("hostAnswerVideo");
    var hostAnswerText = document.getElementById("hostAnswerText");
    var hostVoteSunburst = document.getElementById("hostVoteSunburst");
    var qrCard = document.querySelector(".host-qr-card");
    var roomCode = document.getElementById("hostRoomCode");
    var roomCopy = document.querySelector(".host-room-copy");
    var hostCaption = document.querySelector(".host-caption");
    var hostCloud = document.querySelector(".host-cloud");
    var hostTrash = document.querySelector(".host-trash");

    if (inAnswer) {
      if (hostAnswerVideo) hostAnswerVideo.hidden = false;
      if (hostAnswerText) hostAnswerText.hidden = false;
    } else {
      if (hostAnswerVideo) hostAnswerVideo.hidden = true;
      if (hostAnswerText) hostAnswerText.hidden = true;
    }

    if (inVote) {
      if (hostVoteSunburst) hostVoteSunburst.hidden = false;
    } else {
      if (hostVoteSunburst) hostVoteSunburst.hidden = true;
    }

    var hideLobbyStuff = inAnswer || inVote;
    if (qrCard) qrCard.style.display = hideLobbyStuff ? "none" : "";
    if (roomCode) roomCode.style.display = hideLobbyStuff ? "none" : "";
    if (roomCopy) roomCopy.style.display = hideLobbyStuff ? "none" : "";
    if (hostCaption) hostCaption.style.display = hideLobbyStuff ? "none" : "";
    if (hostCloud) hostCloud.style.display = hideLobbyStuff ? "none" : "";
    if (hostTrash) hostTrash.style.display = hideLobbyStuff ? "none" : "";
`;
js = js.replace(/var state = snap.state;\n\s*els.hostStagePanel.classList.toggle.*?;\n/g, renderHostStageReplacement);
// if the previous replace was cancelled, let's just do a generic replace
js = js.replace(/var state = snap\.state;[\s\S]*?var meta = \[\];/g, renderHostStageReplacement + "\n    var meta = [];");


// Fix tickLocalTimer for segmented timer
const timerReplace = `
    var hostSegmentedTimer = document.getElementById("hostSegmentedTimer");
    var hostSegmentedTimerLabel = document.getElementById("hostSegmentedTimerLabel");

    if(showOnHost){
      if (snap.state === "vote") {
        if(hostSegmentedTimer) hostSegmentedTimer.hidden = true;
        els.hostStageTimer.hidden = true;
        if(els.hostVoteTimerCircleContainer) els.hostVoteTimerCircleContainer.hidden = false;
        var offset = 289 - (289 * (pct / 100));
        if(els.hostVoteTimerCircle) els.hostVoteTimerCircle.style.strokeDashoffset = offset;
        if(els.hostVoteTimerCircle) els.hostVoteTimerCircle.classList.toggle("danger", remainMs < 5000);
        if(els.hostVoteTimerLabel) els.hostVoteTimerLabel.textContent = secs;
      } else if (snap.state === "answer") {
        els.hostStageTimer.hidden = true;
        if(els.hostVoteTimerCircleContainer) els.hostVoteTimerCircleContainer.hidden = true;
        if(hostSegmentedTimer) {
          hostSegmentedTimer.hidden = false;
          hostSegmentedTimerLabel.textContent = secs < 10 ? "0" + secs : secs;
        }
      } else {
        if(hostSegmentedTimer) hostSegmentedTimer.hidden = true;
        if(els.hostVoteTimerCircleContainer) els.hostVoteTimerCircleContainer.hidden = true;
        els.hostStageTimer.hidden = false;
        els.hostStageTimerFill.style.width = pct + "%";
        els.hostStageTimerFill.classList.toggle("danger", remainMs < 5000);
        els.hostStageTimerLabel.textContent = secs + " сек";
      }
`;
js = js.replace(/if\(showOnHost\)\{[\s\S]*?\} else \{[\s\S]*?els\.hostStageTimer\.hidden = true;[\s\S]*?\}/g, timerReplace + "\n    } else {\n      els.hostStageTimer.hidden = true;\n      if(els.hostVoteTimerCircleContainer) els.hostVoteTimerCircleContainer.hidden = true;\n      var hostSegmentedTimer = document.getElementById(\"hostSegmentedTimer\");\n      if(hostSegmentedTimer) hostSegmentedTimer.hidden = true;\n    }");

// Wave transition state check
const transitionReplace = `
    if(state.lastTransitionRound !== roundNumber){
      state.lastTransitionRound = roundNumber;
    }
`;
js = js.replace(/if\(state\.lastTransitionRound !== roundNumber\)\{[\s\S]*?\}/, transitionReplace);

// Handle Wave Transition
const waveJS = `
  var prevHostState = "";
  function checkWaveTransition(snap) {
    if (state.view !== "host") return;
    if (prevHostState === "answer" && snap.state === "vote") {
      var wave = document.getElementById("hostWaveTransition");
      if (wave) {
        wave.classList.remove("active");
        wave.style.top = "-120vh";
        wave.style.transition = "none";
        setTimeout(() => {
          wave.style.transition = "top 1.2s cubic-bezier(0.4, 0, 0.2, 1)";
          wave.classList.add("active");
        }, 50);
      }
    }
    prevHostState = snap.state;
  }
`;
js = js.replace(/function renderRoundTransitionOverlay/, waveJS + "\n  function renderRoundTransitionOverlay");
js = js.replace(/renderRoundTransitionOverlay\(snap\);/, "renderRoundTransitionOverlay(snap);\n    checkWaveTransition(snap);");

fs.writeFileSync(htmlPath, html);
fs.writeFileSync(jsPath, js);
console.log("Successfully applied user designs.");
