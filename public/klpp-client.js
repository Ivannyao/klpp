(function(){
  var KLPP_FACE_EMOJI = {
    smile: "😀", cool: "😎", nerd: "🤓", sleepy: "😴",
    clown: "🤡", alien: "👽", robot: "🤖", mustache: "🥸"
  };
  var KLPP_FACE_ORDER = ["smile","cool","nerd","sleepy","clown","alien","robot","mustache"];
  var KLPP_COLORS = ["#ff6b6b","#ffd93d","#6bcb77","#4d96ff","#b388ff","#ff9f1c","#ff6f91","#00c2a8"];
  var KLPP_DEFAULT_SETTINGS = {
    answerSeconds: 75,
    voteSeconds: 40,
    selfVotingEnabled: false,
    anonymousAnswers: false,
    roundCount: 5,
    doublePointsLastRound: false,
    modifierMode: "off",
    selectedModifiers: []
  };
  var KLPP_ROUND_COUNT_PRESETS = [3, 5, 7];

  var state = {
    view: "home",
    roomId: "",
    hostKey: "",
    clientId: getClientId(),
    nickname: localStorage.getItem("klppNickname") || "",
    avatarDraft: loadAvatarDraft(),
    room: null,
    sse: null,
    pollTimer: null,
    timerInterval: null,
    homeRoleOpen: false,
    hostSettingsDirty: false,
    backTarget: {view:"home", roomId:""},
    pendingSubmit: null,
    lastChosenVote: "",
    availableModifiers: [],
    selectedModifiersDraft: [],
    lastTransitionRound: 0
  };

  var els = {
    screenHome: id("screenHome"),
    screenSettings: id("screenSettings"),
    screenHost: id("screenHost"),
    screenJoin: id("screenJoin"),
    screenPlayer: id("screenPlayer"),
    backButton: id("backButton"),
    desktopPlayButton: id("desktopPlayButton"),
    desktopRoleSplit: id("desktopRoleSplit"),
    desktopPlayerRoleButton: id("desktopPlayerRoleButton"),
    desktopHostRoleButton: id("desktopHostRoleButton"),
    mobilePlayButton: id("mobilePlayButton"),
    mobileRoleSplit: id("mobileRoleSplit"),
    mobilePlayerRoleButton: id("mobilePlayerRoleButton"),
    mobileHostRoleButton: id("mobileHostRoleButton"),
    desktopSettingsButton: id("desktopSettingsButton"),
    mobileJoinButton: id("mobileJoinButton"),
    hostRoomCode: id("hostRoomCode"),
    qrImage: id("qrImage"),
    hostPlayersCount: id("hostPlayersCount"),
    hostPlayersLayer: id("hostPlayersLayer"),
    copyJoinLinkButton: id("copyJoinLinkButton"),
    hostLobbyPanel: id("hostLobbyPanel"),
    hostLobbyCopy: id("hostLobbyCopy"),
    hostLobbySummary: id("hostLobbySummary"),
    hostStagePanel: id("hostStagePanel"),
    hostStageMeta: id("hostStageMeta"),
    hostStagePrompt: id("hostStagePrompt"),
    hostStageTimer: id("hostStageTimer"),
    hostStageTimerFill: id("hostStageTimerFill"),
    hostStageTimerLabel: id("hostStageTimerLabel"),
    hostStageBody: id("hostStageBody"),
    hostControls: id("hostControls"),
    hostPauseButton: id("hostPauseButton"),
    hostEndButton: id("hostEndButton"),
    hostSettingsForm: id("hostSettingsForm"),
    hostSettingsStatus: id("hostSettingsStatus"),
    settingsAnswerSeconds: id("settingsAnswerSeconds"),
    settingsVoteSeconds: id("settingsVoteSeconds"),
    settingsRoundCount: id("settingsRoundCount"),
    settingsModifierMode: id("settingsModifierMode"),
    settingsSelfVotingEnabled: id("settingsSelfVotingEnabled"),
    settingsAnonymousAnswers: id("settingsAnonymousAnswers"),
    settingsDoublePointsLastRound: id("settingsDoublePointsLastRound"),
    settingsModifierList: id("settingsModifierList"),
    hostModifiers: id("hostModifiers"),
    hostRoundTransition: id("hostRoundTransition"),
    hostRoundTransitionNumber: id("hostRoundTransitionNumber"),
    hostRoundTransitionMods: id("hostRoundTransitionMods"),
    playerAnswerHint: id("playerAnswerHint"),
    joinForm: id("joinForm"),
    joinRoomInput: id("joinRoomInput"),
    joinNickInput: id("joinNickInput"),
    joinDemoRoomButton: id("joinDemoRoomButton"),
    joinError: id("joinError"),
    playerStatusBanner: id("playerStatusBanner"),
    playerTitle: id("playerTitle"),
    playerSubtitle: id("playerSubtitle"),
    playerTimerBar: id("playerTimerBar"),
    playerTimerFill: id("playerTimerFill"),
    playerTimerLabel: id("playerTimerLabel"),
    playerCharacterEditor: id("playerCharacterEditor"),
    characterAvatarPreview: id("characterAvatarPreview"),
    characterPreviewName: id("characterPreviewName"),
    characterNicknameInput: id("characterNicknameInput"),
    characterColorOptions: id("characterColorOptions"),
    characterFaceOptions: id("characterFaceOptions"),
    playerCtaRow: id("playerCtaRow"),
    playerAnswerForm: id("playerAnswerForm"),
    playerAnswerQuestion: id("playerAnswerQuestion"),
    playerAnswerMeta: id("playerAnswerMeta"),
    playerAnswerInput: id("playerAnswerInput"),
    playerAnswerSubmit: id("playerAnswerSubmit"),
    playerVoteList: id("playerVoteList"),
    playerScoreboard: id("playerScoreboard"),
    playerMessage: id("playerMessage"),
    playerList: id("playerList")
  };

  bindEvents();
  populateCharacterEditor();
  loadAvailableModifiers();
  bootFromUrl();

  function id(value){ return document.getElementById(value); }

  function bindEvents(){
    els.desktopPlayButton.addEventListener("click", toggleRoleSplit);
    els.mobilePlayButton.addEventListener("click", toggleRoleSplit);
    els.desktopPlayerRoleButton.addEventListener("click", function(){ navigate("join", "", {backTarget:{view:"home", roomId:""}}); });
    els.mobilePlayerRoleButton.addEventListener("click", function(){ navigate("join", "", {backTarget:{view:"home", roomId:""}}); });
    els.desktopHostRoleButton.addEventListener("click", createRoomAndOpenHost);
    els.mobileHostRoleButton.addEventListener("click", createRoomAndOpenHost);
    els.desktopSettingsButton.addEventListener("click", openSettingsScreen);
    els.mobileJoinButton.addEventListener("click", openSettingsScreen);
    els.joinForm.addEventListener("submit", joinRoom);
    els.joinDemoRoomButton.addEventListener("click", createRoomAndOpenHost);
    els.copyJoinLinkButton.addEventListener("click", copyJoinLink);
    els.hostSettingsForm.addEventListener("submit", saveHostSettings);
    els.hostSettingsForm.addEventListener("input", function(){ state.hostSettingsDirty = true; });
    if(els.settingsModifierMode){
      els.settingsModifierMode.addEventListener("change", renderModifierChecklist);
    }
    if(els.playerAnswerInput){
      els.playerAnswerInput.addEventListener("input", validateLocalAnswerInput);
    }
    els.hostPauseButton.addEventListener("click", hostPauseToggle);
    els.hostEndButton.addEventListener("click", hostEnd);
    els.playerAnswerForm.addEventListener("submit", submitAnswer);
    els.characterNicknameInput.addEventListener("input", onNicknameInput);
    els.characterNicknameInput.addEventListener("blur", flushAvatarUpdate);
    els.backButton.addEventListener("click", goBack);
    window.addEventListener("resize", function(){
      if(state.view === "host" && state.room) renderHost(state.room);
    });
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }

  function bootFromUrl(){
    var params = new URLSearchParams(window.location.search);
    var view = params.get("view") || "home";
    var roomId = sanitizeRoomId(params.get("room") || "");
    if(roomId) state.hostKey = sessionStorage.getItem("klppHostKey:" + roomId) || "";
    if(view === "host" && roomId) return navigate("host", roomId);
    if(view === "settings") return navigate("settings", roomId);
    if(view === "join") return navigate("join", roomId);
    if(view === "player" && roomId) return navigate("player", roomId);
    navigate("home");
  }

  function navigate(view, roomId, options){
    teardownLiveConnection();
    state.lastTransitionRound = 0;
    if(els.hostRoundTransition){
      els.hostRoundTransition.classList.remove("active");
      els.hostRoundTransition.hidden = true;
    }
    state.view = view;
    state.roomId = sanitizeRoomId(roomId || "");
    state.backTarget = options && options.backTarget ? options.backTarget : {view:"home", roomId:""};
    els.screenHome.hidden = view !== "home";
    els.screenSettings.hidden = view !== "settings";
    els.screenHost.hidden = view !== "host";
    els.screenJoin.hidden = view !== "join";
    els.screenPlayer.hidden = view !== "player";
    els.backButton.hidden = view === "home";
    syncUrl();

    if(view === "join"){
      els.joinRoomInput.value = state.roomId;
      els.joinNickInput.value = state.nickname;
      els.joinError.textContent = "";
    }
    if(view === "settings"){
      populateSettingsForm(loadSettingsDraft());
      els.hostSettingsStatus.textContent = "";
    }
    if((view === "host" || view === "player") && state.roomId){
      connectLive();
    }
  }

  function syncUrl(){
    var url = "/klpp";
    if(state.view !== "home"){
      var params = new URLSearchParams();
      params.set("view", state.view);
      if(state.roomId) params.set("room", state.roomId);
      url += "?" + params.toString();
    }
    history.replaceState(null, "", url);
  }

  function goBack(){
    navigate(state.backTarget.view || "home", state.backTarget.roomId || "");
  }

  function toggleRoleSplit(){
    state.homeRoleOpen = !state.homeRoleOpen;
    els.desktopRoleSplit.hidden = !state.homeRoleOpen;
    els.mobileRoleSplit.hidden = !state.homeRoleOpen;
  }

  function openSettingsScreen(){
    navigate("settings", state.roomId, {backTarget:{view:"home", roomId:""}});
  }

  /* ───── Live connection (SSE with polling fallback) ───── */

  function connectLive(){
    teardownLiveConnection();
    if(document.hidden){ return; }
    if(!state.roomId) return;
    // 1. Immediate one-shot fetch so UI never hangs on "connecting"
    fetchRoomOnce();
    // 2. Open SSE in parallel for push updates
    if(typeof EventSource !== "undefined"){
      try{
        var sseUrl = "/api/klpp/room/" + encodeURIComponent(state.roomId) + "/events"
          + (state.view === "player" ? "?clientId=" + encodeURIComponent(state.clientId) : "");
        var es = new EventSource(sseUrl);
        state.sse = es;
        state.sseConfirmed = false;
        es.onmessage = function(evt){
          if(!evt.data) return;
          try{
            var msg = JSON.parse(evt.data);
            if(msg && msg.type === "snapshot" && msg.room){
              state.sseConfirmed = true;
              stopPolling();
              handleSnapshot(msg.room);
            }
          }catch(error){ /* ignore */ }
        };
        es.onerror = function(){
          if(!state.sse) return;
          if(state.sse.readyState === EventSource.CLOSED){
            state.sse = null;
            startPollingFallback();
          }
        };
        // 3. Watchdog: if SSE doesn't deliver any snapshot in 4s, run polling alongside
        setTimeout(function(){
          if(state.view !== "host" && state.view !== "player") return;
          if(!state.roomId) return;
          if(state.sseConfirmed) return;
          startPollingFallback();
        }, 4000);
        return;
      }catch(error){ /* fall through to polling */ }
    }
    startPollingFallback();
  }

  function startPollingFallback(){
    stopPolling();
    if(document.hidden) return;
    fetchRoomOnce();
    state.pollTimer = setInterval(fetchRoomOnce, 1200);
  }

  function stopPolling(){
    if(state.pollTimer){
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
  }

  function teardownLiveConnection(){
    if(state.sse){
      try{ state.sse.close(); }catch(error){}
      state.sse = null;
    }
    stopPolling();
    stopLocalTimer();
  }

  function handleVisibilityChange(){
    if(state.view !== "host" && state.view !== "player") return;
    if(!state.roomId) return;
    if(document.hidden){
      teardownLiveConnection();
    } else {
      connectLive();
    }
  }

  async function fetchRoomOnce(){
    if(!state.roomId) return;
    try{
      var suffix = state.view === "player" ? "?clientId=" + encodeURIComponent(state.clientId) : "";
      var data = await api("/api/klpp/room/" + encodeURIComponent(state.roomId) + suffix);
      if(data && data.room) handleSnapshot(data.room);
    }catch(error){
      if(error && error.status === 404){
        handleRoomNotFound();
      }
    }
  }

  function handleRoomNotFound(){
    var lost = state.roomId;
    teardownLiveConnection();
    state.room = null;
    if(state.view === "player"){
      navigate("join", lost, {backTarget:{view:"home", roomId:""}});
      els.joinError.textContent = "Комната " + lost + " закрылась. Введи код ещё раз или создай новую.";
      return;
    }
    if(state.view === "host"){
      alert("Комната " + lost + " закрылась.");
      navigate("home");
    }
  }

  /* ───── Snapshot dispatch ───── */

  function handleSnapshot(snap){
    state.room = snap;
    if(state.view === "host") renderHost(snap);
    else if(state.view === "player") renderPlayer(snap);
    startLocalTimerIfNeeded(snap);
  }

  /* ───── Local phase timer ───── */

  function startLocalTimerIfNeeded(snap){
    var hasTimer = snap && snap.phaseEndsAt > 0 && (snap.state === "answer" || snap.state === "vote" || snap.state === "round_intro" || snap.state === "round_score" || snap.state === "vote_result" || snap.state === "launch");
    if(!hasTimer){
      stopLocalTimer();
      hideTimers();
      return;
    }
    if(!state.timerInterval){
      state.timerInterval = setInterval(tickLocalTimer, 120);
    }
    tickLocalTimer();
  }

  function stopLocalTimer(){
    if(state.timerInterval){
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
  }

  function hideTimers(){
    els.playerTimerBar.hidden = true;
    els.hostStageTimer.hidden = true;
  }

  function tickLocalTimer(){
    var snap = state.room;
    if(!snap || !snap.phaseEndsAt){ hideTimers(); return; }
    var remainMs = Math.max(0, snap.phaseEndsAt - Date.now());
    var totalMs = Math.max(1, snap.phaseDurationMs || 1);
    var pct = Math.max(0, Math.min(100, (remainMs / totalMs) * 100));
    var secs = Math.ceil(remainMs / 1000);

    var showOnPlayer = state.view === "player" && (snap.state === "answer" || snap.state === "vote");
    var showOnHost = state.view === "host" && (snap.state === "answer" || snap.state === "vote");

    if(showOnPlayer){
      els.playerTimerBar.hidden = false;
      els.playerTimerFill.style.width = pct + "%";
      els.playerTimerFill.classList.toggle("danger", remainMs < 5000);
      els.playerTimerLabel.textContent = secs + " сек";
    } else {
      els.playerTimerBar.hidden = true;
    }
    if(showOnHost){
      els.hostStageTimer.hidden = false;
      els.hostStageTimerFill.style.width = pct + "%";
      els.hostStageTimerFill.classList.toggle("danger", remainMs < 5000);
      els.hostStageTimerLabel.textContent = secs + " сек";
    } else {
      els.hostStageTimer.hidden = true;
    }
  }

  /* ───── Host actions ───── */

  async function createRoomAndOpenHost(){
    try{
      var data = await api("/api/klpp/rooms", {method:"POST"});
      state.hostKey = data.hostKey || "";
      if(data.room && data.room.id && state.hostKey){
        sessionStorage.setItem("klppHostKey:" + data.room.id, state.hostKey);
      }
      await applyDraftSettingsToRoom(data.room.id, state.hostKey);
      navigate("host", data.room.id, {backTarget:{view:"home", roomId:""}});
    }catch(error){
      alert("Не получилось создать комнату: " + error.message);
    }
  }

  async function applyDraftSettingsToRoom(roomId, hostKey){
    try{
      await api("/api/klpp/room/" + encodeURIComponent(roomId) + "/settings", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({hostKey: hostKey, settings: loadSettingsDraft()})
      });
    }catch(error){ /* ignore */ }
  }

  async function hostPauseToggle(){
    if(!state.roomId || !state.hostKey) return;
    try{
      await api("/api/klpp/room/" + encodeURIComponent(state.roomId) + "/pause", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({hostKey: state.hostKey})
      });
    }catch(error){ alert(error.message); }
  }

  async function hostEnd(){
    if(!state.roomId || !state.hostKey) return;
    if(!confirm("Закончить игру и показать счёт?")) return;
    try{
      await api("/api/klpp/room/" + encodeURIComponent(state.roomId) + "/end", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({hostKey: state.hostKey, showScore: true})
      });
    }catch(error){ alert(error.message); }
  }

  async function copyJoinLink(){
    if(!state.room || !state.room.joinUrl) return;
    try{
      await navigator.clipboard.writeText(state.room.joinUrl);
      els.copyJoinLinkButton.textContent = "Ссылка скопирована";
      setTimeout(function(){ els.copyJoinLinkButton.textContent = "Копировать ссылку"; }, 1600);
    }catch(error){
      els.copyJoinLinkButton.textContent = state.room.joinUrl;
    }
  }

  /* ───── Player actions ───── */

  async function joinRoom(event){
    event.preventDefault();
    els.joinError.textContent = "";
    var roomId = sanitizeRoomId(els.joinRoomInput.value);
    var nickname = String(els.joinNickInput.value || "").trim();
    if(!roomId || !nickname){
      els.joinError.textContent = "Нужны код комнаты и ник.";
      return;
    }
    try{
      var result = await api("/api/klpp/room/" + encodeURIComponent(roomId) + "/join", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({clientId: state.clientId, nickname: nickname, avatar: state.avatarDraft})
      });
      state.nickname = result.player.nickname;
      if(result.player.avatar){
        state.avatarDraft = {color: result.player.avatar.color, face: result.player.avatar.face};
        saveAvatarDraft(state.avatarDraft);
      }
      localStorage.setItem("klppNickname", state.nickname);
      navigate("player", roomId, {backTarget:{view:"join", roomId:roomId}});
    }catch(error){
      els.joinError.textContent = error.message || "Не получилось войти.";
    }
  }

  async function submitAnswer(event){
    event.preventDefault();
    var snap = state.room;
    if(!snap || !snap.viewer || !snap.viewer.currentAssignment) return;
    var text = String(els.playerAnswerInput.value || "").trim();
    if(!text){ return; }
    var validation = validateAnswerAgainstActiveModifiers(text);
    if(!validation.ok){
      showAnswerHint(validation.error, true);
      return;
    }
    var pairId = snap.viewer.currentAssignment.pairId;
    if(state.pendingSubmit) return;
    state.pendingSubmit = pairId;
    els.playerAnswerSubmit.disabled = true;
    try{
      await api("/api/klpp/room/" + encodeURIComponent(state.roomId) + "/answer", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({clientId: state.clientId, pairId: pairId, text: text})
      });
      els.playerAnswerInput.value = "";
      showAnswerHint("", false);
    }catch(error){
      els.playerAnswerMeta.textContent = error.message || "Не удалось отправить ответ";
    }
    state.pendingSubmit = null;
    els.playerAnswerSubmit.disabled = false;
  }

  function getActiveModifierIds(){
    var snap = state.room;
    if(!snap || !Array.isArray(snap.activeModifiers)) return [];
    return snap.activeModifiers.map(function(m){ return m && m.id; }).filter(Boolean);
  }

  function validateAnswerAgainstActiveModifiers(text){
    var ids = getActiveModifierIds();
    var t = String(text || "").trim();
    if(ids.indexOf("one_word") !== -1){
      var tokens = t ? t.split(/\s+/) : [];
      if(tokens.length > 1) return {ok: false, error: "Этот раунд: только одно слово"};
    }
    return {ok: true};
  }

  function validateLocalAnswerInput(){
    if(!els.playerAnswerInput) return;
    var text = els.playerAnswerInput.value || "";
    var ids = getActiveModifierIds();
    if(ids.indexOf("one_word") !== -1){
      var tokens = text.trim() ? text.trim().split(/\s+/) : [];
      if(tokens.length > 1){
        showAnswerHint("Только одно слово", true);
        if(els.playerAnswerSubmit) els.playerAnswerSubmit.disabled = true;
        return;
      }
      showAnswerHint(tokens.length === 1 ? "Одно слово — ок" : "Введи одно слово", false);
      if(els.playerAnswerSubmit) els.playerAnswerSubmit.disabled = !tokens.length;
      return;
    }
    showAnswerHint("", false);
    if(els.playerAnswerSubmit) els.playerAnswerSubmit.disabled = !text.trim();
  }

  function showAnswerHint(text, isError){
    if(!els.playerAnswerHint) return;
    if(!text){
      els.playerAnswerHint.hidden = true;
      els.playerAnswerHint.textContent = "";
      els.playerAnswerHint.className = "answer-hint";
      return;
    }
    els.playerAnswerHint.hidden = false;
    els.playerAnswerHint.textContent = text;
    els.playerAnswerHint.className = "answer-hint" + (isError ? " error" : "");
  }

  async function submitVote(targetClientId){
    var snap = state.room;
    if(!snap || !snap.viewer || !snap.viewer.vote || !snap.viewer.vote.canVote) return;
    var pairId = snap.viewer.vote.pairId;
    state.lastChosenVote = targetClientId;
    try{
      await api("/api/klpp/room/" + encodeURIComponent(state.roomId) + "/vote", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({clientId: state.clientId, pairId: pairId, targetClientId: targetClientId})
      });
    }catch(error){
      els.playerMessage.textContent = error.message || "Не удалось проголосовать";
    }
  }

  async function startGame(){
    if(!state.roomId) return;
    try{
      await api("/api/klpp/room/" + encodeURIComponent(state.roomId) + "/start", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({clientId: state.clientId})
      });
    }catch(error){
      alert(error.message || "Не удалось начать игру");
    }
  }

  /* ───── Character editor ───── */

  function populateCharacterEditor(){
    els.characterColorOptions.innerHTML = KLPP_COLORS.map(function(color){
      return '<button type="button" class="color-option" data-color="' + color + '" style="background:' + color + '" aria-label="Цвет"></button>';
    }).join("");
    els.characterFaceOptions.innerHTML = KLPP_FACE_ORDER.map(function(face){
      return '<button type="button" class="face-option" data-face="' + face + '" aria-label="Лицо ' + face + '">' + KLPP_FACE_EMOJI[face] + '</button>';
    }).join("");
    els.characterColorOptions.addEventListener("click", onColorPick);
    els.characterFaceOptions.addEventListener("click", onFacePick);
    syncCharacterEditorUi();
  }

  function onColorPick(event){
    var btn = event.target.closest("[data-color]");
    if(!btn) return;
    state.avatarDraft = {color: btn.getAttribute("data-color"), face: state.avatarDraft.face};
    saveAvatarDraft(state.avatarDraft);
    syncCharacterEditorUi();
    flushAvatarUpdate();
  }
  function onFacePick(event){
    var btn = event.target.closest("[data-face]");
    if(!btn) return;
    state.avatarDraft = {color: state.avatarDraft.color, face: btn.getAttribute("data-face")};
    saveAvatarDraft(state.avatarDraft);
    syncCharacterEditorUi();
    flushAvatarUpdate();
  }
  function onNicknameInput(){
    var name = String(els.characterNicknameInput.value || "").trim().slice(0, 20);
    els.characterPreviewName.textContent = name || "Игрок";
  }

  var avatarFlushTimer = null;
  function flushAvatarUpdate(){
    if(state.view !== "player" || !state.roomId) return;
    var nickname = String(els.characterNicknameInput.value || "").trim().slice(0, 20);
    var payload = {
      clientId: state.clientId,
      avatar: state.avatarDraft,
      nickname: nickname || state.nickname || "Игрок"
    };
    if(nickname) state.nickname = nickname;
    localStorage.setItem("klppNickname", state.nickname);
    if(avatarFlushTimer){ clearTimeout(avatarFlushTimer); }
    avatarFlushTimer = setTimeout(function(){
      api("/api/klpp/room/" + encodeURIComponent(state.roomId) + "/avatar", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify(payload)
      }).catch(function(){});
    }, 250);
  }

  function syncCharacterEditorUi(){
    var color = state.avatarDraft.color;
    var face = state.avatarDraft.face;
    Array.prototype.forEach.call(els.characterColorOptions.querySelectorAll("[data-color]"), function(btn){
      var selected = btn.getAttribute("data-color") === color;
      btn.setAttribute("aria-checked", selected ? "true" : "false");
      btn.style.outline = selected ? "3px solid #111" : "none";
      btn.style.outlineOffset = selected ? "3px" : "0";
    });
    Array.prototype.forEach.call(els.characterFaceOptions.querySelectorAll("[data-face]"), function(btn){
      btn.setAttribute("aria-checked", btn.getAttribute("data-face") === face ? "true" : "false");
    });
    paintAvatar(els.characterAvatarPreview, state.avatarDraft);
  }

  function paintAvatar(node, avatar){
    if(!node) return;
    var color = (avatar && avatar.color) || "#ffd447";
    var face = (avatar && avatar.face) || "smile";
    node.style.background = color;
    node.textContent = KLPP_FACE_EMOJI[face] || KLPP_FACE_EMOJI.smile;
  }

  /* ───── Host rendering ───── */

  function renderHost(snap){
    if(!snap) return;
    var layout = getHostLayout();
    els.hostRoomCode.textContent = snap.id;
    els.hostPlayersCount.textContent = formatPlayersCount(snap.players.length);
    var qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=" + encodeURIComponent(snap.joinUrl);
    if(els.qrImage.getAttribute("src") !== qrUrl){
      els.qrImage.src = qrUrl;
      els.qrImage.alt = "QR код для входа в комнату " + snap.id;
    }
    renderHostPlayers(snap, layout);

    var inLobby = snap.state === "lobby";
    els.hostLobbyPanel.hidden = !inLobby;
    els.hostStagePanel.hidden = inLobby;

    if(inLobby){
      els.hostLobbyCopy.textContent = snap.players.length < snap.minPlayersToStart
        ? ("Нужно ещё " + (snap.minPlayersToStart - snap.players.length) + " игроков. Owner стартует с телефона.")
        : "Owner-игрок (первый зашедший) может запускать игру с телефона.";
      els.hostLobbySummary.innerHTML = buildLobbySummary(snap);
    } else {
      renderHostStage(snap);
    }

    renderHostModifierBadges(snap);
    renderRoundTransitionOverlay(snap);

    var canPause = snap.hostControls && snap.hostControls.canPause;
    var canResume = snap.hostControls && snap.hostControls.canResume;
    var canEnd = snap.hostControls && snap.hostControls.canEnd;
    els.hostControls.hidden = !(canPause || canResume || canEnd);
    els.hostPauseButton.textContent = canResume ? "Возобновить" : "Пауза";
    els.hostPauseButton.disabled = !(canPause || canResume);
    els.hostEndButton.disabled = !canEnd;
  }

  function buildModifierBadgeHtml(mod){
    return '<span class="modifier-badge" title="' + escapeHtml(mod.description || "") + '">' +
      '<span class="modifier-badge__icon">' + escapeHtml(mod.icon || "✨") + '</span>' +
      '<span class="modifier-badge__name">' + escapeHtml(mod.name) + '</span>' +
    '</span>';
  }

  function renderHostModifierBadges(snap){
    if(!els.hostModifiers) return;
    var mods = (snap && snap.activeModifiers) || [];
    var inActivePhase = snap && snap.state !== "lobby" && snap.state !== "launch" && snap.state !== "finished";
    if(!mods.length || !inActivePhase){
      els.hostModifiers.hidden = true;
      els.hostModifiers.innerHTML = "";
      return;
    }
    els.hostModifiers.hidden = false;
    els.hostModifiers.innerHTML = mods.map(buildModifierBadgeHtml).join("");
  }

  function renderRoundTransitionOverlay(snap){
    if(!els.hostRoundTransition) return;
    var isIntro = snap && snap.state === "round_intro" && snap.currentRound;
    if(!isIntro){
      els.hostRoundTransition.classList.remove("active");
      els.hostRoundTransition.hidden = true;
      return;
    }
    var roundNumber = snap.currentRound.roundNumber;
    if(state.lastTransitionRound !== roundNumber){
      state.lastTransitionRound = roundNumber;
    }
    els.hostRoundTransitionNumber.textContent = String(roundNumber);
    var mods = snap.activeModifiers || [];
    els.hostRoundTransitionMods.innerHTML = mods.map(buildModifierBadgeHtml).join("");
    els.hostRoundTransition.hidden = false;
    // trigger CSS transition on next frame
    requestAnimationFrame(function(){
      els.hostRoundTransition.classList.add("active");
    });
  }

  function renderHostStage(snap){
    var state = snap.state;
    var meta = [];
    if(snap.currentRound){
      meta.push('<span class="meta-chip">Раунд ' + snap.currentRound.roundNumber + " / " + snap.totalRounds + "</span>");
    }
    if(state === "answer" && snap.currentRound){
      var pending = snap.currentRound.pendingAnswers;
      var total = snap.currentRound.totalAnswers;
      meta.push('<span class="meta-chip">Ответили: ' + (total - pending) + "/" + total + "</span>");
    }
    if((state === "vote" || state === "vote_result") && snap.currentVote){
      meta.push('<span class="meta-chip">Вопрос ' + (snap.currentVote.voteIndex + 1) + " / " + snap.currentVote.voteTotal + "</span>");
    }
    if(snap.isPaused){
      meta.push('<span class="meta-chip">Пауза</span>');
    }
    els.hostStageMeta.innerHTML = meta.join("");

    var prompt = "";
    var body = "";
    if(state === "launch"){
      prompt = "Поехали!";
      body = "<p class=\"panel-copy\">Готовим первый раунд.</p>";
    } else if(state === "round_intro" && snap.currentRound){
      prompt = "Раунд " + snap.currentRound.roundNumber;
      body = "<p class=\"panel-copy\">" + escapeHtml(snap.currentRound.introText || "Поехали!") + "</p>";
    } else if(state === "answer" && snap.currentRound){
      prompt = "Игроки пишут ответы на своих вопросах";
      body = "<p class=\"panel-copy\">Каждый игрок отвечает на свои пары. На большом экране результаты появятся, когда все закончат.</p>";
    } else if(state === "vote" && snap.currentVote){
      prompt = snap.currentVote.questionText;
      body = renderHostVotePair(snap.currentVote, snap, false);
    } else if(state === "vote_result" && snap.currentVote){
      prompt = snap.currentVote.questionText;
      body = renderHostVotePair(snap.currentVote, snap, true);
    } else if(state === "round_score" && snap.lastRoundResult){
      prompt = snap.lastRoundResult.title || ("Раунд " + snap.lastRoundResult.roundNumber);
      body = renderHostScoreboard(snap.lastRoundResult.scoreboard, snap);
    } else if(state === "finished"){
      prompt = "Игра закончилась";
      body = renderHostScoreboard((snap.lastRoundResult && snap.lastRoundResult.scoreboard) || snap.scoreboard, snap, true);
    } else if(state === "paused"){
      prompt = "Пауза";
      body = "<p class=\"panel-copy\">Хост поставил игру на паузу.</p>";
    }
    els.hostStagePrompt.textContent = prompt;
    els.hostStageBody.innerHTML = body;
  }

  function renderHostVotePair(vote, snap, showResult){
    var leftAuthor = lookupPlayer(snap, vote.leftClientId);
    var rightAuthor = lookupPlayer(snap, vote.rightClientId);
    var leftWinner = showResult && vote.result && vote.result.leftPercent > vote.result.rightPercent;
    var rightWinner = showResult && vote.result && vote.result.rightPercent > vote.result.leftPercent;
    return '<div class="stage-vote-pair">' +
      voteCardForHost(vote, snap, "left", leftAuthor, showResult, leftWinner) +
      voteCardForHost(vote, snap, "right", rightAuthor, showResult, rightWinner) +
    '</div>' + (showResult ? renderHostVoteResultLine(vote.result) : '<p class="panel-copy" style="margin-top:10px">Голосуют только зрители. ' + (snap.settings.selfVotingEnabled ? "Авторы тоже." : "Авторы — нет.") + "</p>");
  }

  function voteCardForHost(vote, snap, side, author, showResult, isWinner){
    var text = side === "left" ? vote.leftText : vote.rightText;
    var missing = side === "left" ? vote.leftMissing : vote.rightMissing;
    var pct = vote.result ? (side === "left" ? vote.result.leftPercent : vote.result.rightPercent) : null;
    var delta = vote.result ? (side === "left" ? vote.result.leftScoreDelta : vote.result.rightScoreDelta) : null;
    var hideAuthor = vote && vote.anonymous && !showResult;
    var avatarHtml = hideAuthor ? renderAnonymousAvatarHtml() : renderAvatarHtml(author && author.avatar, "sm");
    var authorName = hideAuthor
      ? escapeHtml(side === "left" ? (vote.leftNickname || "Игрок А") : (vote.rightNickname || "Игрок Б"))
      : (author ? escapeHtml(author.nickname) : escapeHtml(side === "left" ? (vote.leftNickname || "Игрок") : (vote.rightNickname || "Игрок")));
    return '<div class="vote-card' + (isWinner ? " winner" : "") + '">' +
      '<div class="vote-author">' + avatarHtml + '<span>' + authorName + '</span></div>' +
      '<div class="vote-text">' + (missing ? '<em style="opacity:.7">НЕТ ОТВЕТА</em>' : escapeHtml(text)) + '</div>' +
      (showResult ? '<div class="vote-tally"><span>' + (pct == null ? 0 : pct) + "%</span><span>+" + (delta || 0) + "</span></div>" : "") +
    '</div>';
  }

  function renderAnonymousAvatarHtml(){
    return '<div class="avatar avatar--sm" style="background:#444;color:#fff;display:flex;align-items:center;justify-content:center;border:2px solid #111">?</div>';
  }

  function renderHostVoteResultLine(result){
    if(!result) return "";
    if(result.autoReason === "left-missed" || result.autoReason === "right-missed"){
      return '<p class="panel-copy" style="margin-top:10px">Соперник не ответил — победа автоматическая.</p>';
    }
    if(result.autoReason === "no-votes"){
      return '<p class="panel-copy" style="margin-top:10px">Никто не проголосовал — делим очки поровну.</p>';
    }
    if(result.autoReason === "no-eligible-voters"){
      return '<p class="panel-copy" style="margin-top:10px">Голосовать некому. Очки делим поровну.</p>';
    }
    if(result.autoReason === "both-missed"){
      return '<p class="panel-copy" style="margin-top:10px">Оба не ответили. 0 / 0.</p>';
    }
    return "";
  }

  function renderHostScoreboard(scoreboard, snap, isFinal){
    if(!scoreboard || !scoreboard.length) return "";
    var rows = scoreboard.map(function(item, index){
      var winner = index === 0;
      var player = lookupPlayer(snap, item.clientId);
      var avatarHtml = renderAvatarHtml(player && player.avatar, "sm");
      return '<div class="score-row' + (winner && isFinal ? " winner" : "") + '">' +
        avatarHtml +
        '<span class="score-name">' + escapeHtml(item.nickname) + (winner && isFinal ? " 🏆" : "") + '</span>' +
        '<span class="score-value">' + (item.score || 0) + '</span>' +
      '</div>';
    }).join("");
    return '<div class="stage-scoreboard">' + rows + "</div>";
  }

  function buildLobbySummary(snap){
    var s = snap.settings;
    return '<div class="summary-card">Комната: <strong>' + escapeHtml(snap.id) + '</strong><br>Игроков: <strong>' + snap.players.length + " / минимум " + snap.minPlayersToStart + "</strong><br>Раундов: <strong>" + snap.totalRounds + "</strong></div>" +
      '<div class="summary-card">Ответ: <strong>' + s.answerSeconds + " сек</strong><br>Голос: <strong>" + s.voteSeconds + " сек</strong><br>Своё: <strong>" + (s.selfVotingEnabled ? "можно голосовать" : "нельзя") + "</strong></div>";
  }

  function renderHostPlayers(snap, layout){
    var layer = els.hostPlayersLayer;
    var existing = {};
    Array.prototype.forEach.call(layer.children, function(node){
      var key = node.getAttribute("data-client-id");
      if(key) existing[key] = node;
    });
    var liveIds = {};
    snap.players.forEach(function(player, index){
      liveIds[player.clientId] = true;
      var trashSpot = snap.players.length > 1 && player.isLastJoined && !player.isLeader;
      var fieldIndex = trashSpot ? Math.max(0, index - 1) : index;
      var pos = trashSpot ? layout.lastJoinedSpot : layout.fieldSpots[fieldIndex % layout.fieldSpots.length];
      var node = existing[player.clientId];
      if(!node){
        node = document.createElement("div");
        node.className = "host-player entering" + (trashSpot ? " trash-player" : "");
        node.setAttribute("data-client-id", player.clientId);
        var startX = pos.x + (Math.random() * 26 - 13);
        node.style.setProperty("--start-x", startX + "%");
        node.style.setProperty("--start-y", "-15%");
        node.style.setProperty("--target-x", pos.x + "%");
        node.style.setProperty("--target-y", pos.y + "%");
        node.style.setProperty("--target-scale", pos.scale || 1);
        node.style.setProperty("--target-z", Math.round(pos.y));
        node.style.left = pos.x + "%";
        node.style.top = pos.y + "%";
        node.innerHTML =
          (player.isLeader ? '<div class="legend-badge">OWNER</div>' : "") +
          renderAvatarHtml(player.avatar, "host") +
          '<div class="player-tag">' + escapeHtml(player.nickname) + "</div>";
        layer.appendChild(node);
        var clearEntering = function(){
          node.classList.remove("entering");
          node.removeEventListener("animationend", clearEntering);
        };
        node.addEventListener("animationend", clearEntering);
      } else {
        if(!node.classList.contains("entering") && !node.classList.contains("launching")){
          node.style.setProperty("--target-x", pos.x + "%");
          node.style.setProperty("--target-y", pos.y + "%");
          node.style.setProperty("--target-scale", pos.scale || 1);
          node.style.setProperty("--target-z", Math.round(pos.y));
          node.style.left = pos.x + "%";
          node.style.top = pos.y + "%";
        }
        node.classList.toggle("trash-player", trashSpot);
        var tag = node.querySelector(".player-tag");
        if(tag && tag.textContent !== player.nickname) tag.textContent = player.nickname;
        var avatar = node.querySelector(".character-avatar");
        if(avatar) paintAvatar(avatar, player.avatar);
        var legend = node.querySelector(".legend-badge");
        if(player.isLeader && !legend){
          var l = document.createElement("div");
          l.className = "legend-badge";
          l.textContent = "OWNER";
          node.insertBefore(l, node.firstChild);
        } else if(!player.isLeader && legend){
          legend.remove();
        }
      }
    });
    Object.keys(existing).forEach(function(key){
      if(liveIds[key]) return;
      var node = existing[key];
      if(node.classList.contains("launching")) return;
      node.classList.add("launching");
      var fallback;
      var done = function(){
        clearTimeout(fallback);
        node.removeEventListener("animationend", done);
        if(node.parentNode) node.parentNode.removeChild(node);
      };
      node.addEventListener("animationend", done);
      fallback = setTimeout(done, 2600);
    });
  }

  /* ───── Player rendering ───── */

  function renderPlayer(snap){
    if(!snap) return;
    var viewer = snap.viewer || {};
    els.playerStatusBanner.textContent = "Комната " + snap.id;
    renderPlayerList(snap);

    var stateName = snap.state;
    var inLobby = stateName === "lobby";
    els.playerCharacterEditor.hidden = !inLobby;
    if(inLobby){
      syncCharacterEditorFromViewer(viewer);
    }

    var isAnswerPhase = stateName === "answer";
    var hasPending = isAnswerPhase && viewer.currentAssignment;
    els.playerAnswerForm.hidden = !hasPending;
    els.playerVoteList.hidden = !(stateName === "vote" && viewer.vote);
    els.playerScoreboard.hidden = !(stateName === "round_score" || stateName === "finished" || stateName === "vote_result");

    if(inLobby){
      renderPlayerLobby(snap);
    } else if(stateName === "launch" || stateName === "round_intro"){
      renderPlayerInterstitial(snap);
    } else if(isAnswerPhase){
      renderPlayerAnswer(snap);
    } else if(stateName === "vote"){
      renderPlayerVote(snap);
    } else if(stateName === "vote_result"){
      renderPlayerVoteResult(snap);
    } else if(stateName === "round_score"){
      renderPlayerScoreboard(snap, false);
    } else if(stateName === "finished"){
      renderPlayerScoreboard(snap, true);
    } else if(stateName === "paused"){
      els.playerTitle.textContent = "Пауза";
      els.playerSubtitle.textContent = "Хост поставил игру на паузу.";
      els.playerMessage.className = "player-message player-wait";
      els.playerMessage.textContent = "Ждём продолжения.";
      els.playerMessage.hidden = false;
      els.playerCtaRow.innerHTML = "";
    }
  }

  function syncCharacterEditorFromViewer(viewer){
    if(viewer.avatar && (!state.avatarDraft.color || !state.avatarDraft.face)){
      state.avatarDraft = {color: viewer.avatar.color, face: viewer.avatar.face};
      saveAvatarDraft(state.avatarDraft);
    }
    if(viewer.nickname && !els.characterNicknameInput.value){
      els.characterNicknameInput.value = viewer.nickname;
      els.characterPreviewName.textContent = viewer.nickname;
    } else if(!els.characterNicknameInput.value){
      var fallback = state.nickname || viewer.nickname || "Игрок";
      els.characterNicknameInput.value = fallback;
      els.characterPreviewName.textContent = fallback;
    } else {
      els.characterPreviewName.textContent = els.characterNicknameInput.value || "Игрок";
    }
    syncCharacterEditorUi();
  }

  function renderPlayerLobby(snap){
    var viewer = snap.viewer || {};
    var leader = Boolean(viewer.isLeader);
    var enoughPlayers = snap.players.length >= snap.minPlayersToStart;
    els.playerTitle.textContent = leader ? "Ты OWNER" : "Ты в лобби";
    els.playerSubtitle.textContent = leader
      ? "Только ты можешь начать игру. Минимум 3 игрока."
      : "Дожидаемся owner-а — только он стартует.";

    if(leader){
      if(enoughPlayers){
        els.playerCtaRow.innerHTML = '<button class="cta" type="button" id="playerStartButton">Начать игру</button>';
        var btn = document.getElementById("playerStartButton");
        if(btn) btn.addEventListener("click", startGame);
      } else {
        var need = snap.minPlayersToStart - snap.players.length;
        els.playerCtaRow.innerHTML = '<button class="cta" type="button" disabled>Жду игроков (ещё ' + need + ")</button>";
      }
    } else {
      els.playerCtaRow.innerHTML = "";
    }
    els.playerMessage.className = "player-message player-wait";
    els.playerMessage.hidden = false;
    els.playerMessage.textContent = leader
      ? "Покажи QR друзьям, чтоб набралось как минимум 3 игрока."
      : "Пока ждём — собери себе персонажа.";
  }

  function renderPlayerInterstitial(snap){
    els.playerTitle.textContent = snap.state === "launch" ? "Поехали!" : ("Раунд " + (snap.currentRound ? snap.currentRound.roundNumber : ""));
    els.playerSubtitle.textContent = snap.state === "launch" ? "Готовь шутки." : "Сейчас будут вопросы.";
    els.playerCtaRow.innerHTML = "";
    els.playerMessage.className = "player-message player-wait";
    els.playerMessage.hidden = false;
    els.playerMessage.textContent = "Загружаем вопросы.";
  }

  function renderPlayerAnswer(snap){
    var viewer = snap.viewer;
    var assignment = viewer.currentAssignment;
    var total = viewer.totalAssignments || 0;
    var done = Math.min(viewer.answeredCount || 0, total);
    els.playerCtaRow.innerHTML = "";
    if(assignment){
      els.playerTitle.textContent = "Твой вопрос";
      els.playerSubtitle.textContent = (done + 1) + " из " + total;
      els.playerAnswerQuestion.textContent = assignment.questionText;
      els.playerAnswerMeta.textContent = "";
      els.playerMessage.hidden = true;
    } else {
      els.playerTitle.textContent = "Готово";
      els.playerSubtitle.textContent = total > 0 ? ("Сыграл все " + total + (total === 1 ? " вопрос" : (total < 5 ? " вопроса" : " вопросов"))) : "";
      els.playerAnswerForm.hidden = true;
      els.playerMessage.className = "player-message player-started";
      els.playerMessage.hidden = false;
      els.playerMessage.textContent = "Ждём остальных игроков.";
    }
  }

  function renderPlayerVote(snap){
    var viewer = snap.viewer;
    var vote = viewer.vote;
    if(!vote){ els.playerVoteList.innerHTML = ""; return; }
    els.playerTitle.textContent = "Кто смешнее?";
    els.playerSubtitle.textContent = vote.questionText;
    els.playerCtaRow.innerHTML = "";
    if(!vote.canVote){
      els.playerVoteList.innerHTML = '<div class="player-message player-wait">' +
        (vote.isAuthor ? "Это твоя пара — голосуют остальные." : "Ты не можешь голосовать в этом вопросе.") +
        "</div>";
      els.playerMessage.hidden = true;
      return;
    }
    els.playerMessage.hidden = true;
    var leftAuthor = lookupPlayer(snap, vote.leftClientId);
    var rightAuthor = lookupPlayer(snap, vote.rightClientId);
    var leftChosen = vote.chosenClientId === vote.leftClientId || state.lastChosenVote === vote.leftClientId;
    var rightChosen = vote.chosenClientId === vote.rightClientId || state.lastChosenVote === vote.rightClientId;
    els.playerVoteList.innerHTML = "" +
      voteCardForPlayer(vote, "left", leftAuthor, leftChosen) +
      voteCardForPlayer(vote, "right", rightAuthor, rightChosen);
    Array.prototype.forEach.call(els.playerVoteList.querySelectorAll("[data-target]"), function(btn){
      btn.addEventListener("click", function(){
        submitVote(btn.getAttribute("data-target"));
      });
    });
  }

  function voteCardForPlayer(vote, side, author, chosen){
    var text = side === "left" ? vote.leftText : vote.rightText;
    var missing = side === "left" ? vote.leftMissing : vote.rightMissing;
    var target = side === "left" ? vote.leftClientId : vote.rightClientId;
    return '<button class="vote-card" type="button" data-target="' + target + '"' + (chosen ? ' data-chosen="true"' : "") + (missing ? " disabled" : "") + '>' +
      '<strong>' + (missing ? "Не ответил" : "Голос за этого") + '</strong>' +
      '<p>' + (missing ? "(НЕТ ОТВЕТА)" : escapeHtml(text)) + '</p>' +
    '</button>';
  }

  function renderPlayerVoteResult(snap){
    var vote = snap.currentVote;
    els.playerTitle.textContent = "Итоги вопроса";
    els.playerSubtitle.textContent = vote ? vote.questionText : "";
    els.playerCtaRow.innerHTML = "";
    els.playerMessage.hidden = true;
    if(!vote || !vote.result){ els.playerScoreboard.innerHTML = ""; return; }
    var r = vote.result;
    var leftName = escapeHtml(r.leftNickname);
    var rightName = escapeHtml(r.rightNickname);
    els.playerScoreboard.innerHTML =
      '<div class="score-row' + (r.leftPercent >= r.rightPercent ? " winner" : "") + '">' +
        '<span class="score-name">' + leftName + '</span>' +
        '<span class="score-value">' + r.leftPercent + "% · +" + r.leftScoreDelta + "</span>" +
      '</div>' +
      '<div class="score-row' + (r.rightPercent > r.leftPercent ? " winner" : "") + '">' +
        '<span class="score-name">' + rightName + '</span>' +
        '<span class="score-value">' + r.rightPercent + "% · +" + r.rightScoreDelta + "</span>" +
      '</div>';
    state.lastChosenVote = "";
  }

  function renderPlayerScoreboard(snap, isFinal){
    els.playerTitle.textContent = isFinal ? "Итог игры" : "Счёт после раунда";
    els.playerSubtitle.textContent = isFinal
      ? "Сыграно " + snap.totalRounds + " раундов"
      : ("Раунд " + (snap.lastRoundResult ? snap.lastRoundResult.roundNumber : ""));
    els.playerCtaRow.innerHTML = "";
    els.playerMessage.hidden = true;
    var rows = (isFinal ? (snap.lastRoundResult && snap.lastRoundResult.scoreboard) || snap.scoreboard : (snap.lastRoundResult && snap.lastRoundResult.scoreboard) || []);
    els.playerScoreboard.innerHTML = rows.map(function(item, index){
      var winner = index === 0;
      return '<div class="score-row' + (winner && isFinal ? " winner" : "") + '">' +
        '<span class="score-name">' + escapeHtml(item.nickname) + (winner && isFinal ? " 🏆" : "") + '</span>' +
        '<span class="score-value">' + (item.score || 0) + '</span>' +
      '</div>';
    }).join("");
  }

  function renderPlayerList(snap){
    els.playerList.innerHTML = snap.players.map(function(player){
      var tags = [];
      if(player.isLeader) tags.push("OWNER");
      var note = tags.join(" · ") || "в лобби";
      return '<div class="player-list-item">' +
        renderAvatarHtml(player.avatar, "sm") +
        '<strong>' + escapeHtml(player.nickname) + '</strong>' +
        '<span class="player-list-note">' + escapeHtml(note) + '</span>' +
      '</div>';
    }).join("");
  }

  /* ───── Settings form ───── */

  async function saveHostSettings(event){
    event.preventDefault();
    try{
      var settings = collectSettingsForm();
      saveSettingsDraft(settings);
      if(state.roomId && state.hostKey){
        await api("/api/klpp/room/" + encodeURIComponent(state.roomId) + "/settings", {
          method: "POST",
          headers: {"Content-Type":"application/json"},
          body: JSON.stringify({hostKey: state.hostKey, settings: settings})
        });
      }
      state.hostSettingsDirty = false;
      els.hostSettingsStatus.textContent = state.roomId && state.hostKey ? "Настройки сохранены для комнаты." : "Настройки сохранены для новых комнат.";
    }catch(error){
      els.hostSettingsStatus.textContent = error.message;
    }
  }

  function collectSettingsForm(){
    return sanitizeSettings({
      answerSeconds: Number(els.settingsAnswerSeconds.value || KLPP_DEFAULT_SETTINGS.answerSeconds),
      voteSeconds: Number(els.settingsVoteSeconds.value || KLPP_DEFAULT_SETTINGS.voteSeconds),
      roundCount: Number((els.settingsRoundCount && els.settingsRoundCount.value) || KLPP_DEFAULT_SETTINGS.roundCount),
      selfVotingEnabled: els.settingsSelfVotingEnabled.checked,
      anonymousAnswers: els.settingsAnonymousAnswers && els.settingsAnonymousAnswers.checked,
      doublePointsLastRound: els.settingsDoublePointsLastRound && els.settingsDoublePointsLastRound.checked,
      modifierMode: (els.settingsModifierMode && els.settingsModifierMode.value) || "off",
      selectedModifiers: state.selectedModifiersDraft.slice()
    });
  }

  function populateSettingsForm(settings){
    settings = sanitizeSettings(settings);
    els.settingsAnswerSeconds.value = settings.answerSeconds;
    els.settingsVoteSeconds.value = settings.voteSeconds;
    if(els.settingsRoundCount) els.settingsRoundCount.value = String(settings.roundCount);
    els.settingsSelfVotingEnabled.checked = Boolean(settings.selfVotingEnabled);
    if(els.settingsAnonymousAnswers) els.settingsAnonymousAnswers.checked = Boolean(settings.anonymousAnswers);
    if(els.settingsDoublePointsLastRound) els.settingsDoublePointsLastRound.checked = Boolean(settings.doublePointsLastRound);
    if(els.settingsModifierMode) els.settingsModifierMode.value = settings.modifierMode || "off";
    state.selectedModifiersDraft = (settings.selectedModifiers || []).slice();
    renderModifierChecklist();
  }

  function sanitizeSettings(settings){
    settings = settings || {};
    var mode = ["off","fixed","random"].indexOf(settings.modifierMode) !== -1 ? settings.modifierMode : "off";
    var selected = Array.isArray(settings.selectedModifiers)
      ? settings.selectedModifiers.filter(function(id){ return typeof id === "string" && id.length > 0 && id.length < 40; })
      : [];
    return {
      answerSeconds: clamp(Number(settings.answerSeconds || KLPP_DEFAULT_SETTINGS.answerSeconds), 20, 180),
      voteSeconds: clamp(Number(settings.voteSeconds || KLPP_DEFAULT_SETTINGS.voteSeconds), 15, 120),
      roundCount: clamp(Number(settings.roundCount || KLPP_DEFAULT_SETTINGS.roundCount), 1, 12),
      selfVotingEnabled: Boolean(settings.selfVotingEnabled),
      anonymousAnswers: Boolean(settings.anonymousAnswers),
      doublePointsLastRound: Boolean(settings.doublePointsLastRound),
      modifierMode: mode,
      selectedModifiers: selected
    };
  }

  function renderModifierChecklist(){
    if(!els.settingsModifierList) return;
    var mods = state.availableModifiers || [];
    var mode = els.settingsModifierMode ? els.settingsModifierMode.value : "off";
    if(!mods.length || mode === "off"){
      els.settingsModifierList.hidden = true;
      els.settingsModifierList.innerHTML = "";
      return;
    }
    els.settingsModifierList.hidden = false;
    els.settingsModifierList.innerHTML = '<div class="settings-modifier-list">' + mods.map(function(mod){
      var disabled = mod.notImplemented;
      var checked = !disabled && state.selectedModifiersDraft.indexOf(mod.id) !== -1;
      return '<label class="modifier-row" data-disabled="' + (disabled ? "true" : "false") + '">' +
        '<span class="modifier-row__icon">' + escapeHtml(mod.icon || "✨") + '</span>' +
        '<span><span class="modifier-row__name">' + escapeHtml(mod.name) + '</span>' +
        '<div class="modifier-row__hint">' + escapeHtml((mod.description || "") + (disabled ? " · в следующих итерациях" : "")) + '</div></span>' +
        '<input type="checkbox" data-modifier-id="' + escapeHtml(mod.id) + '"' + (checked ? " checked" : "") + (disabled ? " disabled" : "") + '>' +
      '</label>';
    }).join("") + '</div>';
    Array.prototype.forEach.call(els.settingsModifierList.querySelectorAll("input[data-modifier-id]"), function(input){
      input.addEventListener("change", function(){
        var modId = input.getAttribute("data-modifier-id");
        var idx = state.selectedModifiersDraft.indexOf(modId);
        if(input.checked && idx === -1) state.selectedModifiersDraft.push(modId);
        if(!input.checked && idx !== -1) state.selectedModifiersDraft.splice(idx, 1);
        state.hostSettingsDirty = true;
      });
    });
  }

  function loadAvailableModifiers(){
    api("/api/klpp/modifiers").then(function(data){
      state.availableModifiers = (data && data.modifiers) || [];
      renderModifierChecklist();
    }).catch(function(){ /* ignore */ });
  }

  function loadSettingsDraft(){
    try{
      return sanitizeSettings(JSON.parse(localStorage.getItem("klppSettingsDraft") || "{}"));
    }catch(error){
      return sanitizeSettings({});
    }
  }
  function saveSettingsDraft(settings){
    localStorage.setItem("klppSettingsDraft", JSON.stringify(sanitizeSettings(settings)));
  }

  function loadAvatarDraft(){
    try{
      var raw = JSON.parse(localStorage.getItem("klppAvatar") || "{}");
      var color = KLPP_COLORS.indexOf(raw.color) !== -1 ? raw.color : KLPP_COLORS[Math.floor(Math.random() * KLPP_COLORS.length)];
      var face = KLPP_FACE_ORDER.indexOf(raw.face) !== -1 ? raw.face : KLPP_FACE_ORDER[Math.floor(Math.random() * KLPP_FACE_ORDER.length)];
      return {color: color, face: face};
    }catch(error){
      return {color: KLPP_COLORS[0], face: KLPP_FACE_ORDER[0]};
    }
  }
  function saveAvatarDraft(avatar){
    localStorage.setItem("klppAvatar", JSON.stringify(avatar));
  }

  /* ───── Helpers ───── */

  function getHostLayout(){
    var width = window.innerWidth;
    var isMobile = width <= 760;
    
    var spots = isMobile ? [
      {x: 50, y: 65, scale: 1}, {x: 25, y: 60, scale: 0.9}, {x: 75, y: 60, scale: 0.9},
      {x: 35, y: 75, scale: 1.1}, {x: 65, y: 75, scale: 1.1}, {x: 15, y: 70, scale: 1.0},
      {x: 85, y: 70, scale: 1.0}, {x: 50, y: 82, scale: 1.2}, {x: 20, y: 82, scale: 1.2}
    ] : [
      {x: 50, y: 70, scale: 1.05}, {x: 35, y: 65, scale: 0.95}, {x: 65, y: 65, scale: 0.95},
      {x: 20, y: 75, scale: 1.1}, {x: 80, y: 75, scale: 1.1}, {x: 45, y: 56, scale: 0.85},
      {x: 55, y: 56, scale: 0.85}, {x: 10, y: 65, scale: 0.95}, {x: 90, y: 65, scale: 0.95},
      {x: 35, y: 82, scale: 1.15}, {x: 65, y: 82, scale: 1.15}, {x: 15, y: 84, scale: 1.2}
    ];

    return {
      fieldSpots: spots,
      lastJoinedSpot: isMobile ? {x: 85, y: 85, scale: 1.2} : {x: 85, y: 80, scale: 1.2}
    };
  }

  function renderAvatarHtml(avatar, size){
    var color = (avatar && avatar.color) || "#ffd447";
    var face = (avatar && avatar.face) || "smile";
    var cls = "character-avatar";
    if(size === "sm") cls += " sm";
    else if(size === "md") cls += " md";
    return '<div class="' + cls + '" style="background:' + color + '">' + (KLPP_FACE_EMOJI[face] || KLPP_FACE_EMOJI.smile) + "</div>";
  }

  function lookupPlayer(snap, clientId){
    if(!snap || !clientId) return null;
    return (snap.players || []).find(function(p){ return p.clientId === clientId; }) || null;
  }

  function formatPlayersCount(count){
    var mod10 = count % 10;
    var mod100 = count % 100;
    var word;
    if(mod10 === 1 && mod100 !== 11) word = "игрок";
    else if(mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) word = "игрока";
    else word = "игроков";
    return count + " " + word;
  }

  function api(url, options){
    return fetch(url, options).then(async function(response){
      var text = await response.text();
      var data = text ? JSON.parse(text) : {};
      if(!response.ok || data.ok === false){
        var error = new Error(data.error || response.statusText || "Ошибка запроса");
        error.status = response.status;
        throw error;
      }
      return data;
    });
  }

  function sanitizeRoomId(value){
    return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  }

  function getClientId(){
    var key = localStorage.getItem("klppClientId");
    if(!key){
      key = "p-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
      localStorage.setItem("klppClientId", key);
    }
    return key;
  }

  function clamp(value, min, max){
    value = Number.isFinite(value) ? value : min;
    return Math.max(min, Math.min(max, value));
  }

  function escapeHtml(value){
    return String(value == null ? "" : value).replace(/[&<>"']/g, function(char){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char];
    });
  }
})();
