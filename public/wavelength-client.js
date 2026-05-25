/* Wavelength client — iteration 1 (scaffolding only).
   Owns: navigation between screens, setup form, room create/join, SSE sync.
   Does NOT yet: spectrum gameplay, clue input, guessing, scoring.
*/
(function(){
  var DEFAULT_SETTINGS = {roundCount: 5, mode: "host", topicMode: "preset"};
  var ROUND_PRESETS = [3, 5, 7, 10];

  /* ───── Web Audio Sound Engine ───── */
  var waveAudio = (function(){
    var ctx = null;
    var muted = false;

    function getCtx(){
      if(!ctx){
        try{ ctx = new (window.AudioContext || window.webkitAudioContext)(); }catch(e){ return null; }
      }
      if(ctx.state === "suspended") ctx.resume().catch(function(){});
      return ctx;
    }

    function playTone(frequency, type, duration, volume, delay, fadeOut){
      var c = getCtx();
      if(!c || muted) return;
      var osc = c.createOscillator();
      var gain = c.createGain();
      osc.connect(gain);
      gain.connect(c.destination);
      osc.type = type || "sine";
      osc.frequency.setValueAtTime(frequency, c.currentTime + (delay || 0));
      gain.gain.setValueAtTime(volume || 0.15, c.currentTime + (delay || 0));
      if(fadeOut !== false){
        gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + (delay || 0) + duration);
      }
      osc.start(c.currentTime + (delay || 0));
      osc.stop(c.currentTime + (delay || 0) + duration);
    }

    function playNoise(duration, volume, delay){
      var c = getCtx();
      if(!c || muted) return;
      var bufSize = c.sampleRate * duration;
      var buf = c.createBuffer(1, bufSize, c.sampleRate);
      var data = buf.getChannelData(0);
      for(var i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
      var src = c.createBufferSource();
      var gain = c.createGain();
      var filter = c.createBiquadFilter();
      src.buffer = buf;
      filter.type = "bandpass";
      filter.frequency.value = 400;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(c.destination);
      gain.gain.setValueAtTime(volume || 0.08, c.currentTime + (delay || 0));
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + (delay || 0) + duration);
      src.start(c.currentTime + (delay || 0));
      src.stop(c.currentTime + (delay || 0) + duration);
    }

    return {
      unlock: function(){ getCtx(); },
      tick: function(){ playTone(880, "square", 0.04, 0.05, 0); },
      finalTick: function(){ playTone(1200, "square", 0.06, 0.08, 0); },
      roundStart: function(){
        playTone(330, "sine", 0.15, 0.1, 0);
        playTone(440, "sine", 0.15, 0.1, 0.1);
        playTone(550, "sine", 0.15, 0.1, 0.2);
        playTone(660, "sine", 0.25, 0.15, 0.3);
      },
      clueSubmitted: function(){
        playTone(523, "triangle", 0.15, 0.1, 0);
        playTone(659, "triangle", 0.15, 0.1, 0.08);
        playTone(784, "triangle", 0.25, 0.12, 0.16);
      },
      guessSubmitted: function(){
        playTone(587.33, "sine", 0.08, 0.08, 0);
        playTone(880, "sine", 0.12, 0.1, 0.06);
      },
      reveal: function(){
        playTone(220, "sawtooth", 0.4, 0.08, 0);
        playTone(277.18, "sawtooth", 0.4, 0.08, 0.05);
        playTone(329.63, "sawtooth", 0.4, 0.08, 0.1);
        playTone(440, "sawtooth", 0.6, 0.12, 0.15);
        playNoise(0.5, 0.05, 0.2);
      },
      finish: function(){
        playTone(523.25, "triangle", 0.12, 0.12, 0);
        playTone(659.25, "triangle", 0.12, 0.12, 0.1);
        playTone(784, "triangle", 0.12, 0.12, 0.2);
        playTone(1046.5, "triangle", 0.35, 0.15, 0.3);
        playNoise(0.6, 0.06, 0.35);
      },
      click: function(){ playTone(600, "sine", 0.03, 0.05, 0); }
    };
  })();

  var lastTickTime = 0;
  var lastTickVal = -1;
  function playSliderTick(){
    var now = Date.now();
    var val = Number(id("guesserGuessSlider").value);
    if(now - lastTickTime > 70 && Math.abs(val - lastTickVal) >= 1){
      waveAudio.click();
      lastTickTime = now;
      lastTickVal = val;
    }
  }

  function id(s){ return document.getElementById(s); }
  function getClientId(){
    var k = localStorage.getItem("waveClientId");
    if(!k){ k = "w-" + Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4); localStorage.setItem("waveClientId", k); }
    return k;
  }
  function esc(v){ return String(v == null ? "" : v).replace(/[&<>"']/g, function(c){ return ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]; }); }
  function sanitizeRoomId(v){ return String(v || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0,8); }

  var state = {
    view: "home",
    roomId: "",
    hostKey: "",
    clientId: getClientId(),
    nickname: localStorage.getItem("waveNickname") || "",
    settingsDraft: Object.assign({}, DEFAULT_SETTINGS),
    room: null,
    sse: null,
    pollTimer: null
  };

  var els = {
    screenHome: id("screenHome"),
    screenSetup: id("screenSetup"),
    screenHostLobby: id("screenHostLobby"),
    screenJoin: id("screenJoin"),
    screenPlayerLobby: id("screenPlayerLobby"),
    screenHostPlay: id("screenHostPlay"),
    screenPlayerPlay: id("screenPlayerPlay"),
    screenFinished: id("screenFinished"),
    homePlayButton: id("homePlayButton"),
    setupCreateButton: id("setupCreateButton"),
    setupJoinButton: id("setupJoinButton"),
    setupRoundRow: id("setupRoundRow"),
    setupNicknameStep: id("setupNicknameStep"),
    setupNickInput: id("setupNickInput"),
    lobbyRoomCode: id("lobbyRoomCode"),
    lobbyQrImage: id("lobbyQrImage"),
    lobbyStatus: id("lobbyStatus"),
    lobbyPlayersList: id("lobbyPlayersList"),
    lobbyPlayersTitle: id("lobbyPlayersTitle"),
    lobbyStartButton: id("lobbyStartButton"),
    lobbyStartHint: id("lobbyStartHint"),
    lobbyCopyButton: id("lobbyCopyButton"),
    joinCodeInput: id("joinCodeInput"),
    joinNickInput: id("joinNickInput"),
    joinSubmitButton: id("joinSubmitButton"),
    joinError: id("joinError"),
    playerLobbyTitle: id("playerLobbyTitle"),
    playerLobbySubtitle: id("playerLobbySubtitle"),
    playerLobbyChips: id("playerLobbyChips"),
    playerLobbyRoomCode: id("playerLobbyRoomCode"),
    playerLobbyCopyButton: id("playerLobbyCopyButton"),
    playerLobbyStartButton: id("playerLobbyStartButton"),
    playerLobbyStartHint: id("playerLobbyStartHint"),
    toast: id("toast")
  };

  init();

  function init(){
    renderSetupForm();
    bindEvents();
    bootFromUrl();
    
    // Unlock Web Audio context on first user interaction
    document.addEventListener("click", function(){ waveAudio.unlock(); }, {once: true});
    document.addEventListener("touchstart", function(){ waveAudio.unlock(); }, {once: true});
  }

  function bindEvents(){
    els.homePlayButton.addEventListener("click", function(){ waveAudio.click(); navigate("setup"); });
    els.setupCreateButton.addEventListener("click", function(){ waveAudio.click(); createRoom(); });
    els.setupJoinButton.addEventListener("click", function(){ waveAudio.click(); navigate("join"); });
    els.lobbyCopyButton.addEventListener("click", function(){ waveAudio.click(); copyJoinLink(); });
    els.lobbyStartButton.addEventListener("click", function(){ waveAudio.click(); startGame(); });
    els.playerLobbyCopyButton.addEventListener("click", function(){ waveAudio.click(); copyJoinLink(); });
    els.playerLobbyStartButton.addEventListener("click", function(){ waveAudio.click(); startGame(); });
    els.joinSubmitButton.addEventListener("click", function(){ waveAudio.click(); submitJoin(); });
    els.joinCodeInput.addEventListener("input", function(){
      els.joinCodeInput.value = sanitizeRoomId(els.joinCodeInput.value);
    });
    
    id("psychicSubmitButton").addEventListener("click", function(){ waveAudio.click(); submitClue(); });
    id("guesserSubmitButton").addEventListener("click", function(){ waveAudio.click(); submitGuess(); });
    id("finishedRestartButton").addEventListener("click", function(){ waveAudio.click(); restartGame(); });
    
    id("guesserGuessSlider").addEventListener("input", function(){
      var val = this.value;
      id("guesserGuessVal").textContent = val;
      setDialPointer("guesserPointer", val, 100);
      playSliderTick();
    });

    document.addEventListener("visibilitychange", function(){
      if(["host-lobby", "player-lobby", "host-play", "player-play", "finished"].indexOf(state.view) !== -1){
        if(document.hidden) stopPolling(); else connectLive();
      }
    });
  }

  function bootFromUrl(){
    var p = new URLSearchParams(window.location.search);
    var view = p.get("view") || "home";
    var room = sanitizeRoomId(p.get("room") || "");
    if(view === "join" && room){ navigate("join"); els.joinCodeInput.value = room; return; }
    if(view === "host" && room){ state.roomId = room; state.hostKey = sessionStorage.getItem("waveHostKey:" + room) || ""; navigate("host-lobby"); return; }
    if(view === "player" && room){ state.roomId = room; navigate("player-lobby"); return; }
    navigate("home");
  }

  function navigate(view){
    teardownLive();
    state.view = view;
    [els.screenHome, els.screenSetup, els.screenHostLobby, els.screenJoin, els.screenPlayerLobby, els.screenHostPlay, els.screenPlayerPlay, els.screenFinished].forEach(function(s){
      if(s) s.hidden = true;
    });
    if(view === "home") els.screenHome.hidden = false;
    else if(view === "setup") els.screenSetup.hidden = false;
    else if(view === "host-lobby"){ els.screenHostLobby.hidden = false; if(state.roomId) connectLive(); }
    else if(view === "join") els.screenJoin.hidden = false;
    else if(view === "player-lobby"){ els.screenPlayerLobby.hidden = false; if(state.roomId) connectLive(); }
    else if(view === "host-play"){ els.screenHostPlay.hidden = false; if(state.roomId) connectLive(); }
    else if(view === "player-play"){ els.screenPlayerPlay.hidden = false; if(state.roomId) connectLive(); }
    else if(view === "finished"){ els.screenFinished.hidden = false; if(state.roomId) connectLive(); }
    syncUrl();
  }

  function syncUrl(){
    var u = "/wavelength";
    if(state.view !== "home"){
      var q = new URLSearchParams();
      if(state.view === "host-lobby" || state.view === "host-play"){ q.set("view","host"); if(state.roomId) q.set("room", state.roomId); }
      else if(state.view === "player-lobby" || state.view === "player-play" || state.view === "finished"){ q.set("view","player"); if(state.roomId) q.set("room", state.roomId); }
      else if(state.view === "join") q.set("view","join");
      
      var skipSync = state.view === "setup";
      if(!skipSync){
        u += "?" + q.toString();
      }
    }
    history.replaceState(null, "", u);
  }

  /* ───── Setup form ───── */

  function renderSetupForm(){
    // Mode cards
    var modeCards = document.querySelectorAll("[data-setup-mode]");
    modeCards.forEach(function(card){
      var m = card.getAttribute("data-setup-mode");
      card.classList.toggle("is-active", state.settingsDraft.mode === m);
      card.addEventListener("click", function(){
        state.settingsDraft.mode = m;
        renderSetupForm();
      });
    });
    // Topic cards
    var topicCards = document.querySelectorAll("[data-setup-topic]");
    topicCards.forEach(function(card){
      var t = card.getAttribute("data-setup-topic");
      card.classList.toggle("is-active", state.settingsDraft.topicMode === t);
      card.addEventListener("click", function(){
        state.settingsDraft.topicMode = t;
        renderSetupForm();
      });
    });
    // Rounds
    els.setupRoundRow.innerHTML = ROUND_PRESETS.map(function(n){
      var active = state.settingsDraft.roundCount === n ? " is-active" : "";
      return '<button type="button" class="round-pill' + active + '" data-round="' + n + '">' + n + '</button>';
    }).join("");
    Array.prototype.forEach.call(els.setupRoundRow.querySelectorAll("[data-round]"), function(btn){
      btn.addEventListener("click", function(){
        state.settingsDraft.roundCount = Number(btn.getAttribute("data-round"));
        renderSetupForm();
      });
    });

    var showNick = state.settingsDraft.mode === "direct";
    els.setupNicknameStep.hidden = !showNick;
    if(showNick && !els.setupNickInput.value && state.nickname){
      els.setupNickInput.value = state.nickname;
    }
  }

  /* ───── Room create / join ───── */

  function createRoom(){
    var nick = "";
    if(state.settingsDraft.mode === "direct"){
      nick = String(els.setupNickInput.value || "").trim();
      if(!nick){
        showToast("Введи свой ник, чтобы начать игру.");
        return;
      }
      state.nickname = nick;
      localStorage.setItem("waveNickname", nick);
    }

    api("/api/wave/rooms", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({settings: state.settingsDraft})})
      .then(function(data){
        state.roomId = data.room.id;
        state.hostKey = data.hostKey || "";
        if(state.hostKey) sessionStorage.setItem("waveHostKey:" + state.roomId, state.hostKey);
        state.room = data.room;

        if(state.settingsDraft.mode === "direct"){
          return api("/api/wave/room/" + encodeURIComponent(state.roomId) + "/join", {
            method: "POST",
            headers: {"Content-Type":"application/json"},
            body: JSON.stringify({clientId: state.clientId, nickname: nick})
          }).then(function(joinData){
            state.nickname = joinData.player.nickname;
            state.room = joinData.room;
            navigate("player-lobby");
          });
        } else {
          navigate("host-lobby");
        }
      })
      .catch(function(err){
        showToast("Не получилось создать комнату: " + (err.message || ""));
      });
  }

  function submitJoin(){
    els.joinError.textContent = "";
    var room = sanitizeRoomId(els.joinCodeInput.value);
    var nick = String(els.joinNickInput.value || "").trim();
    if(!room || !nick){ els.joinError.textContent = "Нужны код и ник."; return; }
    api("/api/wave/room/" + encodeURIComponent(room) + "/join", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({clientId: state.clientId, nickname: nick})
    }).then(function(data){
      state.roomId = room;
      state.nickname = data.player.nickname;
      localStorage.setItem("waveNickname", state.nickname);
      state.room = data.room;
      navigate("player-lobby");
    }).catch(function(err){
      els.joinError.textContent = err.message || "Не удалось войти.";
    });
  }

  function startGame(){
    var body = {clientId: state.clientId, hostKey: state.hostKey};
    api("/api/wave/room/" + encodeURIComponent(state.roomId) + "/start", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(body)
    }).then(function(data){
      state.room = data.room;
    }).catch(function(err){
      showToast("Не удалось запустить игру: " + (err.message || ""));
    });
  }

  function submitClue(){
    var clue = String(id("psychicClueInput").value || "").trim();
    if(!clue){ showToast("Введи подсказку."); return; }
    
    var body = {clientId: state.clientId, clue: clue};
    if(state.room.settings.topicMode === "player_creates"){
      var left = String(id("psychicCustomOppositeLeft").value || "").trim();
      var right = String(id("psychicCustomOppositeRight").value || "").trim();
      if(!left || !right){ showToast("Заполни стороны спектра."); return; }
      body.left = left;
      body.right = right;
    }
    
    api("/api/wave/room/" + encodeURIComponent(state.roomId) + "/submit-clue", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(body)
    }).then(function(){
      id("psychicClueInput").value = "";
      id("psychicCustomOppositeLeft").value = "";
      id("psychicCustomOppositeRight").value = "";
    }).catch(function(err){
      showToast("Ошибка: " + (err.message || ""));
    });
  }

  function submitGuess(){
    var val = Number(id("guesserGuessSlider").value);
    api("/api/wave/room/" + encodeURIComponent(state.roomId) + "/submit-guess", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({clientId: state.clientId, value: val})
    }).then(function(){
      id("guesserControlsBlock").hidden = true;
      id("guesserSubmittedMessage").hidden = false;
    }).catch(function(err){
      showToast("Ошибка: " + (err.message || ""));
    });
  }

  function restartGame(){
    var body = {clientId: state.clientId, hostKey: state.hostKey};
    api("/api/wave/room/" + encodeURIComponent(state.roomId) + "/restart", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(body)
    }).catch(function(err){
      showToast("Не удалось сбросить игру: " + (err.message || ""));
    });
  }

  /* ───── SSE + render ───── */

  function connectLive(){
    teardownLive();
    if(document.hidden || !state.roomId) return;
    fetchRoomOnce();
    if(typeof EventSource !== "undefined"){
      try {
        var url = "/api/wave/room/" + encodeURIComponent(state.roomId) + "/events?clientId=" + encodeURIComponent(state.clientId);
        var es = new EventSource(url);
        state.sse = es;
        es.onmessage = function(evt){
          try {
            var msg = JSON.parse(evt.data);
            if(msg && msg.type === "snapshot" && msg.room){
              stopPolling();
              handleSnapshot(msg.room);
            }
          } catch(e){}
        };
        es.onerror = function(){ if(state.sse && state.sse.readyState === EventSource.CLOSED){ state.sse = null; startPollFallback(); } };
        setTimeout(function(){ if(!state.room && state.roomId) startPollFallback(); }, 4000);
        return;
      } catch(e){}
    }
    startPollFallback();
  }

  function startPollFallback(){
    stopPolling();
    if(document.hidden) return;
    state.pollTimer = setInterval(fetchRoomOnce, 1500);
  }

  function stopPolling(){
    if(state.pollTimer){ clearInterval(state.pollTimer); state.pollTimer = null; }
  }

  function teardownLive(){
    stopPolling();
    if(state.sse){ try { state.sse.close(); } catch(e){}; state.sse = null; }
  }

  function fetchRoomOnce(){
    if(!state.roomId) return;
    api("/api/wave/room/" + encodeURIComponent(state.roomId) + "?clientId=" + encodeURIComponent(state.clientId))
      .then(function(data){ if(data && data.room) handleSnapshot(data.room); })
      .catch(function(err){
        if(err && err.status === 404 && (state.view === "player-lobby" || state.view === "player-play")){
          showToast("Комната закрылась. Введи код заново.");
          navigate("join");
        }
      });
  }

  function handleSnapshot(snap){
    state.room = snap;

    // Trigger sounds on state transitions
    var prevState = state.prevSnapState;
    if(snap.state !== prevState){
      if(snap.state === "round_intro") waveAudio.roundStart();
      else if(snap.state === "guess") waveAudio.clueSubmitted();
      else if(snap.state === "reveal") waveAudio.reveal();
      else if(snap.state === "finished") waveAudio.finish();
    }
    state.prevSnapState = snap.state;

    // Countdown ticking sounds
    var prevTimer = state.prevTimerRemaining;
    if(snap.phaseTimerRemaining !== prevTimer && ["clue_input", "guess"].indexOf(snap.state) !== -1){
      if(snap.phaseTimerRemaining > 0 && snap.phaseTimerRemaining <= 5){
        waveAudio.finalTick();
      } else if(snap.phaseTimerRemaining > 0 && snap.phaseTimerRemaining <= 10 && snap.phaseTimerRemaining % 2 === 0){
        waveAudio.tick();
      }
    }
    state.prevTimerRemaining = snap.phaseTimerRemaining;
    
    if(snap.state !== "lobby"){
      if(snap.state === "finished"){
        if(state.view !== "finished") navigate("finished");
      } else {
        if(state.view === "host-lobby" || state.view === "host-play"){
          if(state.view !== "host-play") navigate("host-play");
        } else if(state.view === "player-lobby" || state.view === "player-play"){
          if(state.view !== "player-play") navigate("player-play");
        }
      }
    } else {
      if(state.view === "host-play" || state.view === "finished"){
        navigate("host-lobby");
      } else if(state.view === "player-play" || state.view === "finished"){
        navigate("player-lobby");
      }
    }

    if(snap.settings && snap.settings.mode === "direct" && state.view === "host-play"){
      navigate("player-play");
      return;
    }
    if(snap.settings && snap.settings.mode === "direct" && state.view === "host-lobby"){
      navigate("player-lobby");
      return;
    }
    
    if(state.view === "host-lobby") renderHostLobby(snap);
    else if(state.view === "player-lobby") renderPlayerLobby(snap);
    else if(state.view === "host-play") renderHostPlay(snap);
    else if(state.view === "player-play") renderPlayerPlay(snap);
    else if(state.view === "finished") renderFinished(snap);
  }

  function renderHostLobby(snap){
    els.lobbyRoomCode.textContent = snap.id;
    var joinUrl = window.location.origin + "/wavelength?view=join&room=" + snap.id;
    var qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=" + encodeURIComponent(joinUrl);
    if(els.lobbyQrImage.getAttribute("src") !== qrUrl){
      els.lobbyQrImage.src = qrUrl;
      els.lobbyQrImage.alt = "QR для входа в " + snap.id;
    }
    els.lobbyPlayersTitle.textContent = "Игроки (" + snap.players.length + ")";
    els.lobbyPlayersList.innerHTML = snap.players.map(function(p){
      var initial = (p.nickname || "?").charAt(0).toUpperCase();
      return '<div class="player-chip">' +
        '<div class="player-chip__avatar">' + esc(initial) + '</div>' +
        '<div class="player-chip__name">' + esc(p.nickname) + '</div>' +
        (p.isOwner ? '<div class="player-chip__owner">Owner</div>' : '') +
      '</div>';
    }).join("");
    var canStart = snap.players.length >= snap.minPlayersToStart;
    els.lobbyStartButton.disabled = !canStart;
    if(canStart){
      els.lobbyStartHint.textContent = "Жми «Начать игру» когда все на местах.";
      els.lobbyStatus.textContent = "Готовы. Жди старта от owner'a.";
    } else {
      var need = snap.minPlayersToStart - snap.players.length;
      els.lobbyStartHint.textContent = "Нужно ещё " + need + " " + (need === 1 ? "игрок" : (need < 5 ? "игрока" : "игроков")) + ".";
      els.lobbyStatus.textContent = "Ждём игроков… Поделись QR-кодом или ссылкой.";
    }
  }

  function renderPlayerLobby(snap){
    var v = snap.viewer || {};
    els.playerLobbyTitle.textContent = v.isOwner ? "Ты OWNER, " + (v.nickname || "") : "Ты в лобби";
    var minP = snap.minPlayersToStart || 3;
    var have = snap.players.length;
    if(have < minP){
      els.playerLobbySubtitle.textContent = "Комната " + snap.id + " · ждём ещё " + (minP - have) + " игроков";
    } else {
      els.playerLobbySubtitle.textContent = "Комната " + snap.id + " · все на месте, ждём старта от OWNER'а";
    }

    els.playerLobbyRoomCode.textContent = snap.id;
    if(v.isOwner){
      els.playerLobbyStartButton.hidden = false;
      els.playerLobbyStartHint.hidden = false;
      var canStart = snap.players.length >= minP;
      els.playerLobbyStartButton.disabled = !canStart;
      if(canStart){
        els.playerLobbyStartHint.textContent = "Жми «Начать игру», когда все на местах.";
      } else {
        var need = minP - have;
        els.playerLobbyStartHint.textContent = "Нужно ещё " + need + " " + (need === 1 ? "игрок" : (need < 5 ? "игрока" : "игроков")) + ".";
      }
    } else {
      els.playerLobbyStartButton.hidden = true;
      els.playerLobbyStartHint.hidden = true;
    }

    els.playerLobbyChips.innerHTML = snap.players.map(function(p){
      var initial = (p.nickname || "?").charAt(0).toUpperCase();
      var youTag = p.clientId === v.clientId ? ' style="background:rgba(34,225,255,.15);border:1px solid rgba(34,225,255,.3)"' : '';
      return '<div class="player-chip"' + youTag + '>' +
        '<div class="player-chip__avatar">' + esc(initial) + '</div>' +
        '<div class="player-chip__name">' + esc(p.nickname) + (p.clientId === v.clientId ? " (ты)" : "") + '</div>' +
        (p.isOwner ? '<div class="player-chip__owner">Owner</div>' : '') +
      '</div>';
    }).join("");
  }

  function renderHostPlay(snap){
    id("hostRoundIndex").textContent = "Раунд " + (snap.roundIndex + 1) + " из " + snap.settings.roundCount;
    id("hostTimer").textContent = snap.phaseTimerRemaining;
    
    var cr = snap.currentRound || {};
    id("hostOppositeLeft").textContent = cr.opposites ? cr.opposites[0] : "Лево";
    id("hostOppositeRight").textContent = cr.opposites ? cr.opposites[1] : "Право";
    
    var title = "";
    if(snap.state === "round_intro") title = "Раунд " + (snap.roundIndex + 1) + " · Встречайте!";
    else if(snap.state === "clue_input") title = "Ход загадывающего (" + (cr.psychicNickname || "") + ")";
    else if(snap.state === "guess") title = "Время угадывать!";
    else if(snap.state === "reveal") title = "Раскрытие спектра!";
    else if(snap.state === "round_score") title = "Счёт раунда!";
    id("hostPhaseTitle").textContent = title;
    
    var bubble = id("hostClueBubble");
    if(snap.state !== "round_intro" && snap.state !== "clue_input" && cr.clue){
      bubble.removeAttribute("hidden");
      id("hostClueText").textContent = cr.clue;
    } else {
      bubble.setAttribute("hidden", "true");
    }
    
    var wedges = id("hostTargetWedges");
    var isReveal = ["reveal", "round_score"].indexOf(snap.state) !== -1;
    if(isReveal && cr.targetCenter !== null){
      wedges.removeAttribute("hidden");
      id("hostWedge2").setAttribute("d", getWedgePath(120, 120, 100, cr.targetCenter, 24));
      id("hostWedge3").setAttribute("d", getWedgePath(120, 120, 100, cr.targetCenter, 16));
      id("hostWedge4").setAttribute("d", getWedgePath(120, 120, 100, cr.targetCenter, 4));
      setDialPointer("hostTargetLine", cr.targetCenter, 100);
    } else {
      wedges.setAttribute("hidden", "true");
    }
    
    var group = id("hostGuessesGroup");
    group.innerHTML = "";
    if(isReveal){
      snap.players.forEach(function(p){
        if(p.clientId === cr.psychicClientId) return;
        var val = cr.guesses[p.clientId];
        if(val === undefined) return;
        
        var rad = Math.PI * (1 - val / 100);
        var x = 120 + 95 * Math.cos(rad);
        var y = 120 - 95 * Math.sin(rad);
        
        var dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        dot.setAttribute("cx", x);
        dot.setAttribute("cy", y);
        dot.setAttribute("r", "5");
        dot.setAttribute("fill", "var(--neon-cyan)");
        dot.setAttribute("stroke", "#fff");
        dot.setAttribute("stroke-width", "1.5");
        group.appendChild(dot);
        
        var txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
        txt.setAttribute("x", x);
        txt.setAttribute("y", y - 8);
        txt.setAttribute("text-anchor", "middle");
        txt.setAttribute("fill", "#fff");
        txt.setAttribute("font-size", "9px");
        txt.setAttribute("font-weight", "900");
        txt.textContent = (p.nickname || "?").slice(0, 3).toUpperCase();
        group.appendChild(txt);
      });
    }
    
    id("hostGuessStatusList").innerHTML = snap.players.map(function(p){
      var isPsy = p.clientId === cr.psychicClientId;
      var hasG = cr.hasGuessed && cr.hasGuessed[p.clientId];
      var cls = "player-chip-sm" + (isPsy ? " psychic" : (hasG ? " done" : ""));
      var tag = isPsy ? " 🔮 Психик" : (hasG ? " ✅ Готов" : " ⏳ Думает");
      return '<div class="' + cls + '">' + esc(p.nickname) + tag + '</div>';
    }).join("");
  }

  function renderPlayerPlay(snap){
    var gGroup = id("guesserGuessesGroup");
    if(gGroup) gGroup.innerHTML = "";

    id("playerRoundIndex").textContent = "Раунд " + (snap.roundIndex + 1) + " из " + snap.settings.roundCount;
    id("playerTimer").textContent = snap.phaseTimerRemaining;
    
    var cr = snap.currentRound || {};
    var isPsychic = snap.viewer.clientId === cr.psychicClientId;
    
    var divPsychic = id("playerViewPsychic");
    var divGuesser = id("playerViewGuesser");
    var divWaiting = id("playerViewGenericWaiting");
    
    divPsychic.hidden = true;
    divGuesser.hidden = true;
    divWaiting.hidden = true;
    
    if(snap.state === "round_intro"){
      divWaiting.hidden = false;
      id("playerGenericWaitingTitle").textContent = "Приготовьтесь!";
      id("playerGenericWaitingSubtitle").textContent = isPsychic 
        ? "В этом раунде ТЫ загадываешь! Готовься увидеть спектр."
        : "Загадывает " + cr.psychicNickname + ". Ждём его подсказку.";
      id("playerGenericWaitingList").innerHTML = "";
    }
    else if(snap.state === "clue_input"){
      if(isPsychic){
        divPsychic.hidden = false;
        id("psychicWedge2").setAttribute("d", getWedgePath(120, 120, 100, cr.targetCenter, 24));
        id("psychicWedge3").setAttribute("d", getWedgePath(120, 120, 100, cr.targetCenter, 16));
        id("psychicWedge4").setAttribute("d", getWedgePath(120, 120, 100, cr.targetCenter, 4));
        setDialPointer("psychicTargetLine", cr.targetCenter, 100);
        
        var customBlock = id("psychicCustomOppositesBlock");
        var oppositesDisplay = id("psychicOppositesDisplay");
        if(snap.settings.topicMode === "player_creates"){
          customBlock.hidden = false;
          oppositesDisplay.hidden = true;
        } else {
          customBlock.hidden = true;
          oppositesDisplay.hidden = false;
          id("psychicOppositeLeft").textContent = cr.opposites[0];
          id("psychicOppositeRight").textContent = cr.opposites[1];
        }
      } else {
        divWaiting.hidden = false;
        id("playerGenericWaitingTitle").textContent = "Загадыватель думает";
        id("playerGenericWaitingSubtitle").textContent = cr.psychicNickname + " придумывает подсказку для спектра...";
        id("playerGenericWaitingList").innerHTML = "";
      }
    }
    else if(snap.state === "guess"){
      if(isPsychic){
        divWaiting.hidden = false;
        id("playerGenericWaitingTitle").textContent = "Команда думает";
        id("playerGenericWaitingSubtitle").textContent = "Твоя подсказка: «" + cr.clue + "». Ждём догадки команды.";
        renderGuessStatusList(snap, cr);
      } else {
        var myGuess = cr.guesses[snap.viewer.clientId];
        if(myGuess !== undefined){
          divWaiting.hidden = false;
          id("playerGenericWaitingTitle").textContent = "Выбор сделан";
          id("playerGenericWaitingSubtitle").textContent = "Твоя догадка: " + myGuess + "%. Ждём остальных игроков.";
          renderGuessStatusList(snap, cr);
        } else {
          divGuesser.hidden = false;
          id("guesserControlsBlock").hidden = false;
          id("guesserSubmittedMessage").hidden = true;
          id("guesserPhaseTitle").textContent = "Время угадывать!";
          id("guesserClueText").textContent = cr.clue;
          id("guesserOppositeLeft").textContent = cr.opposites[0];
          id("guesserOppositeRight").textContent = cr.opposites[1];
          id("guesserTargetWedges").setAttribute("hidden", "true");
          
          var slider = id("guesserGuessSlider");
          id("guesserGuessVal").textContent = slider.value;
          setDialPointer("guesserPointer", slider.value, 100);
        }
      }
    }
    else if(snap.state === "reveal"){
      divGuesser.hidden = false;
      id("guesserControlsBlock").hidden = true;
      id("guesserSubmittedMessage").hidden = true;
      id("guesserPhaseTitle").textContent = isPsychic ? "Раскрытие спектра!" : "Результаты раунда!";
      id("guesserClueText").textContent = cr.clue;
      id("guesserOppositeLeft").textContent = cr.opposites[0];
      id("guesserOppositeRight").textContent = cr.opposites[1];
      
      var gWedges = id("guesserTargetWedges");
      gWedges.removeAttribute("hidden");
      id("guesserWedge2").setAttribute("d", getWedgePath(120, 120, 100, cr.targetCenter, 24));
      id("guesserWedge3").setAttribute("d", getWedgePath(120, 120, 100, cr.targetCenter, 16));
      id("guesserWedge4").setAttribute("d", getWedgePath(120, 120, 100, cr.targetCenter, 4));
      setDialPointer("guesserTargetLine", cr.targetCenter, 100);
      
      var finalGuess = isPsychic ? 50 : (cr.guesses[snap.viewer.clientId] || 50);
      setDialPointer("guesserPointer", finalGuess, 100);

      // Render other players' guesses as dots on the guesser dial!
      if(gGroup){
        gGroup.innerHTML = "";
        snap.players.forEach(function(p){
          if(p.clientId === cr.psychicClientId) return;
          if(p.clientId === snap.viewer.clientId) return;
          var val = cr.guesses[p.clientId];
          if(val === undefined) return;
          
          var rad = Math.PI * (1 - val / 100);
          var x = 120 + 95 * Math.cos(rad);
          var y = 120 - 95 * Math.sin(rad);
          
          var dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          dot.setAttribute("cx", x);
          dot.setAttribute("cy", y);
          dot.setAttribute("r", "5");
          dot.setAttribute("fill", "var(--neon-pink)");
          dot.setAttribute("stroke", "#fff");
          dot.setAttribute("stroke-width", "1.5");
          gGroup.appendChild(dot);
          
          var txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
          txt.setAttribute("x", x);
          txt.setAttribute("y", y - 8);
          txt.setAttribute("text-anchor", "middle");
          txt.setAttribute("fill", "#fff");
          txt.setAttribute("font-size", "9px");
          txt.setAttribute("font-weight", "900");
          txt.textContent = (p.nickname || "?").slice(0, 3).toUpperCase();
          gGroup.appendChild(txt);
        });
      }
    }
    else if(snap.state === "round_score"){
      divWaiting.hidden = false;
      id("playerGenericWaitingTitle").textContent = "Счёт раунда";
      
      var scoresHtml = snap.players.map(function(p){
        var pts = cr.roundScores ? cr.roundScores[p.clientId] : 0;
        var diffLabel = "";
        if(p.clientId !== cr.psychicClientId){
          var g = cr.guesses[p.clientId];
          diffLabel = g !== undefined ? " (" + g + "%)" : " (нет ответа)";
        } else {
          diffLabel = " (Психик)";
        }
        return '<div class="player-chip">' +
          '<div class="player-chip__avatar">' + p.nickname.charAt(0).toUpperCase() + '</div>' +
          '<div class="player-chip__name">' + esc(p.nickname) + diffLabel + '</div>' +
          '<div class="player-chip__owner" style="background:var(--neon-cyan)">+' + pts + '</div>' +
        '</div>';
      }).join("");
      
      id("playerGenericWaitingSubtitle").textContent = "Результаты набора очков в этом раунде:";
      id("playerGenericWaitingList").innerHTML = '<div style="display:grid;gap:8px;width:100%">' + scoresHtml + '</div>';
    }
  }

  function renderGuessStatusList(snap, cr){
    id("playerGenericWaitingList").innerHTML = snap.players.map(function(p){
      var isPsy = p.clientId === cr.psychicClientId;
      var hasG = cr.hasGuessed && cr.hasGuessed[p.clientId];
      var cls = "player-chip-sm" + (isPsy ? " psychic" : (hasG ? " done" : ""));
      var tag = isPsy ? " 🔮 Психик" : (hasG ? " ✅ Готов" : " ⏳ Думает");
      return '<div class="' + cls + '">' + esc(p.nickname) + tag + '</div>';
    }).join("");
  }

  function renderFinished(snap){
    var sorted = snap.players.slice().sort(function(a, b){ return (b.score || 0) - (a.score || 0); });
    var podium = id("finishedPodium");
    podium.innerHTML = "";
    
    if(sorted[1]) podium.appendChild(createPodiumStep(sorted[1], 2));
    if(sorted[0]) podium.appendChild(createPodiumStep(sorted[0], 1));
    if(sorted[2]) podium.appendChild(createPodiumStep(sorted[2], 3));
    
    id("finishedRankingsList").innerHTML = sorted.map(function(p, idx){
      return '<div class="player-chip">' +
        '<div class="player-chip__avatar">' + p.nickname.charAt(0).toUpperCase() + '</div>' +
        '<div class="player-chip__name">' + (idx + 1) + '. ' + esc(p.nickname) + '</div>' +
        '<div class="player-chip__owner">' + (p.score || 0) + ' pts</div>' +
      '</div>';
    }).join("");
    
    var btn = id("finishedRestartButton");
    var hint = id("finishedRestartHint");
    if(snap.viewer.isOwner){
      btn.removeAttribute("hidden");
      hint.setAttribute("hidden", "true");
    } else {
      btn.setAttribute("hidden", "true");
      hint.removeAttribute("hidden");
    }
  }

  function createPodiumStep(player, rank){
    var step = document.createElement("div");
    step.className = "podium-step";
    
    var name = document.createElement("div");
    name.style.fontSize = "12px";
    name.style.marginBottom = "5px";
    name.style.maxWidth = "80px";
    name.style.overflow = "hidden";
    name.style.textOverflow = "ellipsis";
    name.style.whiteSpace = "nowrap";
    name.textContent = player.nickname;
    
    var bar = document.createElement("div");
    bar.className = "podium-bar podium-" + rank;
    bar.textContent = rank === 1 ? "🥇" : (rank === 2 ? "🥈" : "🥉");
    
    var score = document.createElement("div");
    score.style.fontSize = "11px";
    score.style.marginTop = "5px";
    score.textContent = (player.score || 0) + " pts";
    
    step.appendChild(name);
    step.appendChild(bar);
    step.appendChild(score);
    return step;
  }

  function copyJoinLink(){
    if(!state.room) return;
    var url = window.location.origin + "/wavelength?view=join&room=" + state.room.id;
    if(navigator.clipboard){
      navigator.clipboard.writeText(url).then(function(){ showToast("Ссылка скопирована"); }).catch(function(){ showToast(url); });
    } else {
      showToast(url);
    }
  }

  function getWedgePath(cx, cy, r, centerPct, widthPct) {
    var half = widthPct / 2;
    var startPct = Math.max(0, centerPct - half);
    var endPct = Math.min(100, centerPct + half);
    var a1 = Math.PI * (1 - startPct / 100);
    var a2 = Math.PI * (1 - endPct / 100);
    var x1 = cx + r * Math.cos(a1);
    var y1 = cy - r * Math.sin(a1);
    var x2 = cx + r * Math.cos(a2);
    var y2 = cy - r * Math.sin(a2);
    return "M " + cx + " " + cy + " L " + x1 + " " + y1 + " A " + r + " " + r + " 0 0 1 " + x2 + " " + y2 + " Z";
  }

  function setDialPointer(lineId, valuePct, L) {
    var line = id(lineId);
    if(!line) return;
    var rad = Math.PI * (1 - valuePct / 100);
    var x = 120 + L * Math.cos(rad);
    var y = 120 - L * Math.sin(rad);
    line.setAttribute("x2", x);
    line.setAttribute("y2", y);
  }

  /* ───── Helpers ───── */

  function api(url, opts){
    return fetch(url, opts).then(function(r){
      return r.text().then(function(txt){
        var data;
        try { data = txt ? JSON.parse(txt) : {}; } catch(e){ data = {}; }
        if(!r.ok || data.ok === false){
          var err = new Error(data.error || r.statusText || "Ошибка запроса");
          err.status = r.status;
          throw err;
        }
        return data;
      });
    });
  }

  var toastTimer;
  function showToast(text){
    els.toast.textContent = text;
    els.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ els.toast.classList.remove("show"); }, 2400);
  }
})();
