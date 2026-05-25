/* Wavelength client — iteration 1 (scaffolding only).
   Owns: navigation between screens, setup form, room create/join, SSE sync.
   Does NOT yet: spectrum gameplay, clue input, guessing, scoring.
*/
(function(){
  var DEFAULT_SETTINGS = {roundCount: 5, mode: "host", topicMode: "preset"};
  var ROUND_PRESETS = [3, 5, 7, 10];

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
    screenPlay: id("screenPlay"),
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
  }

  function bindEvents(){
    els.homePlayButton.addEventListener("click", function(){ navigate("setup"); });
    els.setupCreateButton.addEventListener("click", createRoom);
    els.setupJoinButton.addEventListener("click", function(){ navigate("join"); });
    els.lobbyCopyButton.addEventListener("click", copyJoinLink);
    els.lobbyStartButton.addEventListener("click", startGame);
    els.playerLobbyCopyButton.addEventListener("click", copyJoinLink);
    els.playerLobbyStartButton.addEventListener("click", startGame);
    els.joinSubmitButton.addEventListener("click", submitJoin);
    els.joinCodeInput.addEventListener("input", function(){
      els.joinCodeInput.value = sanitizeRoomId(els.joinCodeInput.value);
    });
    document.addEventListener("visibilitychange", function(){
      if(state.view === "host-lobby" || state.view === "player-lobby"){
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
    [els.screenHome, els.screenSetup, els.screenHostLobby, els.screenJoin, els.screenPlayerLobby, els.screenPlay].forEach(function(s){ s.hidden = true; });
    if(view === "home") els.screenHome.hidden = false;
    else if(view === "setup") els.screenSetup.hidden = false;
    else if(view === "host-lobby"){ els.screenHostLobby.hidden = false; if(state.roomId) connectLive(); }
    else if(view === "join") els.screenJoin.hidden = false;
    else if(view === "player-lobby"){ els.screenPlayerLobby.hidden = false; if(state.roomId) connectLive(); }
    else if(view === "play") els.screenPlay.hidden = false;
    syncUrl();
  }

  function syncUrl(){
    var u = "/wavelength";
    if(state.view !== "home"){
      var q = new URLSearchParams();
      if(state.view === "host-lobby"){ q.set("view","host"); if(state.roomId) q.set("room", state.roomId); }
      else if(state.view === "player-lobby"){ q.set("view","player"); if(state.roomId) q.set("room", state.roomId); }
      else if(state.view === "join") q.set("view","join");
      if(state.view !== "setup" && state.view !== "play"){
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
    // Iteration 1: start is a no-op (no gameplay yet). Show toast.
    showToast("Геймплей будет в следующей итерации. Лобби уже работает 🎉");
  }

  /* ───── SSE + render ───── */

  function connectLive(){
    teardownLive();
    if(document.hidden || !state.roomId) return;
    // 1) Immediate fetch so UI doesn't sit on placeholders
    fetchRoomOnce();
    // 2) SSE for live updates
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
        if(err && err.status === 404 && state.view === "player-lobby"){
          showToast("Комната закрылась. Введи код заново.");
          navigate("join");
        }
      });
  }

  function handleSnapshot(snap){
    state.room = snap;
    if(snap.settings && snap.settings.mode === "direct" && state.view === "host-lobby"){
      navigate("player-lobby");
      return;
    }
    if(state.view === "host-lobby") renderHostLobby(snap);
    else if(state.view === "player-lobby") renderPlayerLobby(snap);
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

  function copyJoinLink(){
    if(!state.room) return;
    var url = window.location.origin + "/wavelength?view=join&room=" + state.room.id;
    if(navigator.clipboard){
      navigator.clipboard.writeText(url).then(function(){ showToast("Ссылка скопирована"); }).catch(function(){ showToast(url); });
    } else {
      showToast(url);
    }
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
