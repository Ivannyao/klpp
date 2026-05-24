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
    selectedModifiers: [],
    questionsPerPlayer: 2,
    questionSetId: "default",
    finalRoundType: "final_lash"
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
    lastTransitionRound: 0,
    prevSnapState: "",
    comboStreaks: {},
    devMode: false
  };

  /* ───── Web Audio Sound Engine ───── */
  var klppAudio = (function(){
    var ctx = null;
    var muted = false;

    function getCtx(){
      if(!ctx){
        try{ ctx = new (window.AudioContext || window.webkitAudioContext)(); }catch(e){ return null; }
      }
      // Resume if suspended (browser autoplay policy)
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
      unlock: function(){
        // Call on first user interaction to unlock audio context
        getCtx();
      },
      tick: function(){
        // Short dry tick for countdown
        playTone(880, "square", 0.04, 0.08, 0);
      },
      finalTick: function(){
        // Last 3 ticks - higher pitch
        playTone(1200, "square", 0.06, 0.12, 0);
      },
      roundStart: function(){
        // Rising arpeggio
        playTone(330, "sawtooth", 0.12, 0.1, 0);
        playTone(440, "sawtooth", 0.12, 0.1, 0.1);
        playTone(550, "sawtooth", 0.12, 0.1, 0.2);
        playTone(660, "sawtooth", 0.18, 0.15, 0.3);
      },
      voteStart: function(){
        // Drum roll feel
        playTone(200, "sine", 0.15, 0.12, 0);
        playTone(250, "sine", 0.12, 0.1, 0.15);
        playTone(300, "sine", 0.2, 0.15, 0.28);
      },
      win: function(){
        // Cheerful fanfare
        playTone(523, "triangle", 0.1, 0.15, 0);
        playTone(659, "triangle", 0.1, 0.15, 0.1);
        playTone(784, "triangle", 0.15, 0.15, 0.2);
        playTone(1047, "triangle", 0.25, 0.18, 0.32);
        playNoise(0.3, 0.06, 0.35);
      },
      lose: function(){
        // Sad womp-womp
        playTone(300, "sawtooth", 0.15, 0.1, 0);
        playTone(240, "sawtooth", 0.2, 0.1, 0.15);
        playTone(200, "sawtooth", 0.25, 0.08, 0.3);
      },
      steal: function(){
        // Sneaky staccato
        playTone(800, "sawtooth", 0.05, 0.12, 0);
        playTone(600, "sawtooth", 0.05, 0.1, 0.07);
        playTone(400, "sawtooth", 0.1, 0.15, 0.14);
        playNoise(0.15, 0.08, 0.14);
      },
      combo: function(streak){
        // Higher pitch per streak level
        var base = 440 + streak * 60;
        playTone(base, "triangle", 0.08, 0.12, 0);
        playTone(base * 1.25, "triangle", 0.08, 0.12, 0.09);
        playTone(base * 1.5, "triangle", 0.15, 0.15, 0.18);
      },
      finish: function(){
        // Big ending fanfare
        playTone(392, "triangle", 0.1, 0.14, 0);
        playTone(494, "triangle", 0.1, 0.14, 0.1);
        playTone(588, "triangle", 0.1, 0.14, 0.2);
        playTone(784, "triangle", 0.3, 0.18, 0.3);
        playNoise(0.5, 0.07, 0.35);
        playTone(988, "triangle", 0.25, 0.15, 0.55);
      },
      answerSubmit: function(){
        // Quick soft confirm
        playTone(660, "sine", 0.08, 0.08, 0);
        playTone(880, "sine", 0.1, 0.08, 0.07);
      },
      voteClick: function(){
        // Satisfying click
        playTone(440, "sine", 0.06, 0.1, 0);
      }
    };
  })();

  /* ───── Drunk Mode CSS ───── */
  (function(){
    var styleEl = document.createElement("style");
    styleEl.id = "klpp-dynamic-styles";
    styleEl.textContent = [
      "@keyframes klpp-drunk-wobble {",
      "  0%   { transform: rotate(0deg) translateX(0px); }",
      "  15%  { transform: rotate(-1.5deg) translateX(-3px); }",
      "  30%  { transform: rotate(1deg) translateX(2px); }",
      "  45%  { transform: rotate(-0.8deg) translateX(-2px); }",
      "  60%  { transform: rotate(1.2deg) translateX(3px); }",
      "  75%  { transform: rotate(-1deg) translateX(-1px); }",
      "  100% { transform: rotate(0deg) translateX(0px); }",
      "}",
      "@keyframes klpp-drunk-float {",
      "  0%   { transform: translateY(0px) rotate(0deg); }",
      "  33%  { transform: translateY(-6px) rotate(0.8deg); }",
      "  66%  { transform: translateY(4px) rotate(-0.6deg); }",
      "  100% { transform: translateY(0px) rotate(0deg); }",
      "}",
      "body.drunk-mode { animation: klpp-drunk-wobble 2.2s ease-in-out infinite; transform-origin: center center; }",
      "body.drunk-mode #screenPlayer { animation: klpp-drunk-float 3.5s ease-in-out infinite; }",
      "body.drunk-mode #screenHost { animation: klpp-drunk-float 4s ease-in-out infinite reverse; }",
      "body.drunk-mode input, body.drunk-mode button { filter: hue-rotate(20deg); }",
      "@keyframes klpp-steal-bg { 0%,100%{opacity:0} 15%,85%{opacity:1} }",
      "@keyframes klpp-steal-text {",
      "  0%   { opacity:0; transform: scale(0.5) rotate(-10deg); }",
      "  20%  { opacity:1; transform: scale(1.15) rotate(3deg); }",
      "  80%  { opacity:1; transform: scale(1) rotate(0deg); }",
      "  100% { opacity:0; transform: scale(0.8) rotate(5deg); }",
      "}",
      /* Full-viewport overlay so the steal flash covers any aspect ratio. */
      ".klpp-steal-overlay {",
      "  position:fixed; inset:0; z-index:9999; pointer-events:none;",
      "  background: radial-gradient(ellipse at center, rgba(220,30,0,0.55) 0%, rgba(40,0,0,0.92) 80%);",
      "  display:flex; align-items:center; justify-content:center;",
      "  animation: klpp-steal-bg 1.8s ease-in-out forwards;",
      "}",
      ".klpp-steal-overlay__text {",
      "  font-size: clamp(2rem,8vw,5rem); font-weight:900;",
      "  color:#fff; text-shadow: 0 0 20px #ff4400, 0 0 40px #ff8800;",
      "  padding: 0.3em 0.7em; max-width: 90vw; text-align: center; line-height: 1.1;",
      "  animation: klpp-steal-text 1.8s ease-in-out forwards;",
      "}",
      "@keyframes klpp-combo-pop {",
      "  0%   { opacity:0; transform:scale(0.5) translateY(10px); }",
      "  30%  { opacity:1; transform:scale(1.2) translateY(-4px); }",
      "  70%  { opacity:1; transform:scale(1) translateY(0); }",
      "  100% { opacity:0; transform:scale(0.9) translateY(-8px); }",
      "}",
      ".klpp-combo-badge {",
      "  display:inline-block; padding:0.2em 0.5em; border-radius:12px;",
      "  background: linear-gradient(135deg, #ff6b00, #ff0080);",
      "  color:#fff; font-weight:900; font-size:1.1em;",
      "  animation: klpp-combo-pop 2s ease-in-out forwards;",
      "  box-shadow: 0 0 16px #ff660088;",
      "}"
    ].join("\n");
    document.head.appendChild(styleEl);
  })();

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
    desktopPacksButton: id("desktopPacksButton"),
    mobileJoinButton: id("mobileJoinButton"),
    mobilePacksButton: id("mobilePacksButton"),
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
    hostVoteTimerCircleContainer: id("hostVoteTimerCircleContainer"),
    hostVoteTimerCircle: id("hostVoteTimerCircle"),
    hostVoteTimerLabel: id("hostVoteTimerLabel"),
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
    settingsQuestionsPerPlayer: id("settingsQuestionsPerPlayer"),
    settingsSelfVotingEnabled: id("settingsSelfVotingEnabled"),
    settingsAnonymousAnswers: id("settingsAnonymousAnswers"),
    settingsDoublePointsLastRound: id("settingsDoublePointsLastRound"),
    settingsFinalRoundType: id("settingsFinalRoundType"),
    settingsQuestionSetId: id("settingsQuestionSetId"),
    screenEditor: id("screenEditor"),
    editorDuplicateBtn: id("editorDuplicateBtn"),
    editorTestBtn: id("editorTestBtn"),
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
    playerAbilitySelect: id("playerAbilitySelect"),
    playerAbilityOptions: id("playerAbilityOptions"),
    playerMessage: id("playerMessage"),
    playerList: id("playerList")
  };

  bindEvents();
  populateCharacterEditor();
  loadAvailableModifiers();
  bootFromUrl();

  function id(value){ return document.getElementById(value); }

  function bindEvents(){
    // Unlock audio on first interaction
    document.addEventListener("click", function(){ klppAudio.unlock(); }, {once: true});
    document.addEventListener("touchstart", function(){ klppAudio.unlock(); }, {once: true});

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
    var topInput = id("playerAnswerMemeTop");
    var bottomInput = id("playerAnswerMemeBottom");
    if(topInput){
      topInput.addEventListener("input", function(){
        var preview = id("playerAnswerMemePreviewTop");
        if(preview) preview.textContent = topInput.value.toUpperCase();
      });
    }
    if(bottomInput){
      bottomInput.addEventListener("input", function(){
        var preview = id("playerAnswerMemePreviewBottom");
        if(preview) preview.textContent = bottomInput.value.toUpperCase();
      });
    }
    els.hostPauseButton.addEventListener("click", hostPauseToggle);
    els.hostEndButton.addEventListener("click", hostEnd);
    // Dev mode wiring
    var devBtn = document.getElementById("devLaunchButton");
    if(devBtn) devBtn.addEventListener("click", devLaunch);
    var devSkipPhase = document.getElementById("devSkipPhase");
    if(devSkipPhase) devSkipPhase.addEventListener("click", function(){ devSkip("phase"); });
    var devSkipRound = document.getElementById("devSkipRound");
    if(devSkipRound) devSkipRound.addEventListener("click", function(){ devSkip("round"); });
    var devEndGame = document.getElementById("devEndGame");
    if(devEndGame) devEndGame.addEventListener("click", devEndGameClick);
    els.playerAnswerForm.addEventListener("submit", submitAnswer);
    els.characterNicknameInput.addEventListener("input", onNicknameInput);
    els.characterNicknameInput.addEventListener("blur", flushAvatarUpdate);
    els.backButton.addEventListener("click", goBack);
    window.addEventListener("resize", function(){
      if(state.view === "host" && state.room) renderHost(state.room);
    });
    document.addEventListener("visibilitychange", handleVisibilityChange);

    if(els.desktopPacksButton){
      els.desktopPacksButton.addEventListener("click", function(){
        navigate("editor");
      });
    }
    if(els.mobilePacksButton){
      els.mobilePacksButton.addEventListener("click", function(){
        navigate("editor");
      });
    }
    var searchInput = id("editorSearchInput");
    if(searchInput) {
      searchInput.addEventListener("input", function(){
        renderEditorSetsList();
      });
    }
    
    var editorExitBtn = id("editorExitBtn");
    if(editorExitBtn) editorExitBtn.addEventListener("click", goBack);
    
    var editorSelectSetBtn = id("editorSelectSetBtn");
    if(editorSelectSetBtn) editorSelectSetBtn.addEventListener("click", selectEditorSetForGame);

    var editorSaveBtn = id("editorSaveBtn");
    if(editorSaveBtn) editorSaveBtn.addEventListener("click", saveEditorSet);
    
    var editorDuplicateBtn = id("editorDuplicateBtn");
    if(editorDuplicateBtn) editorDuplicateBtn.addEventListener("click", duplicateEditorSet);
    
    var editorTestBtn = id("editorTestBtn");
    if(editorTestBtn) editorTestBtn.addEventListener("click", testEditorSet);
    
    var editorDeleteBtn = id("editorDeleteBtn");
    if(editorDeleteBtn) editorDeleteBtn.addEventListener("click", deleteEditorSet);
    
    var editorCreateSetBtn = id("editorCreateSetBtn");
    if(editorCreateSetBtn) editorCreateSetBtn.addEventListener("click", createNewSet);
    
    var editorAddMemeBtn = id("editorAddMemeBtn");
    if(editorAddMemeBtn) editorAddMemeBtn.addEventListener("click", editorAddMeme);
    
    var editorExportBtn = id("editorExportBtn");
    if(editorExportBtn) editorExportBtn.addEventListener("click", exportEditorSet);
    
    var editorImportBtn = id("editorImportBtn");
    if(editorImportBtn) editorImportBtn.addEventListener("click", function(){ id("editorImportFile").click(); });
    
    var editorImportFile = id("editorImportFile");
    if(editorImportFile) editorImportFile.addEventListener("change", importEditorSet);

    var editorSetName = id("editorSetName");
    if(editorSetName) {
      editorSetName.addEventListener("input", function() {
        if (state.editorActiveSetId === "") {
          renderEditorSetsList();
        }
        updateEditorChecklist();
      });
    }
    var editorSetDesc = id("editorSetDesc");
    if(editorSetDesc) {
      editorSetDesc.addEventListener("input", updateEditorChecklist);
    }
    var editorTextClassic = id("editorTextClassic");
    if(editorTextClassic) {
      editorTextClassic.addEventListener("input", function() {
        if (state.editorActiveSetId === "") {
          renderEditorSetsList();
        }
        updateEditorChecklist();
      });
    }
    var editorTextReverse = id("editorTextReverse");
    if(editorTextReverse) {
      editorTextReverse.addEventListener("input", updateEditorChecklist);
    }
    var editorTextFinal = id("editorTextFinal");
    if(editorTextFinal) {
      editorTextFinal.addEventListener("input", updateEditorChecklist);
    }

    window.addEventListener("beforeunload", function(e){
      if(state.view === "editor" && isEditorDirty()) {
        e.preventDefault();
        e.returnValue = "У вас есть несохраненные изменения в наборе вопросов. Действительно выйти?";
        return e.returnValue;
      }
    });

    initEditorTabs();
  }

  function bootFromUrl(){
    var params = new URLSearchParams(window.location.search);
    var view = params.get("view") || "home";
    var roomId = sanitizeRoomId(params.get("room") || "");
    var dev = params.get("dev") === "1";
    if(roomId) state.hostKey = sessionStorage.getItem("klppHostKey:" + roomId) || "";
    if(view === "host" && roomId) return navigate("host", roomId, {dev: dev});
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
    // Always strip scoreboard chrome when navigating away from a host view —
    // otherwise body keeps `scoreboard-active` from a previous match and the
    // theatre curtains bleed onto the home menu and lobby screens.
    if(view !== "host"){
      document.body.classList.remove("scoreboard-active");
    }
    state.view = view;
    state.roomId = sanitizeRoomId(roomId || "");
    state.backTarget = options && options.backTarget ? options.backTarget : {view:"home", roomId:""};
    if(options && typeof options.dev === "boolean") state.devMode = options.dev;
    if(view !== "host") state.devMode = false;
    els.screenHome.hidden = view !== "home";
    els.screenSettings.hidden = view !== "settings";
    els.screenHost.hidden = view !== "host";
    els.screenJoin.hidden = view !== "join";
    els.screenPlayer.hidden = view !== "player";
    if(els.screenEditor) els.screenEditor.hidden = view !== "editor";
    els.backButton.hidden = view === "home";
    applyDevModeVisibility();
    syncUrl();

    if(view === "join"){
      els.joinRoomInput.value = state.roomId;
      els.joinNickInput.value = state.nickname;
      els.joinError.textContent = "";
    }
    if(view === "settings"){
      populateQuestionSetsDropdown().then(function(){
        populateSettingsForm(loadSettingsDraft());
      });
      els.hostSettingsStatus.textContent = "";
    }
    if(view === "editor"){
      initEditorView();
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
      if(state.devMode) params.set("dev", "1");
      url += "?" + params.toString();
    }
    history.replaceState(null, "", url);
  }

  function goBack(){
    if(state.view === "editor" && isEditorDirty()) {
      if(!confirm("У вас есть несохраненные изменения. Вы уверены, что хотите выйти?")) return;
    }
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
    var prevState = state.prevSnapState;
    state.room = snap;

    // Drunk mode: toggle body class based on active modifiers
    var activeIds = (snap.activeModifiers || []).map(function(m){ return m && m.id; });
    var isDrunk = activeIds.indexOf("drunk_mode") !== -1 &&
      snap.state !== "lobby" && snap.state !== "launch" && snap.state !== "finished";
    document.body.classList.toggle("drunk-mode", isDrunk);

    // Sound triggers on state transitions
    if(snap.state !== prevState){
      if(snap.state === "round_intro") klppAudio.roundStart();
      else if(snap.state === "vote") klppAudio.voteStart();
      else if(snap.state === "finished") klppAudio.finish();
    }
    state.prevSnapState = snap.state;

    if(state.view === "host") renderHost(snap);
    else if(state.view === "player") renderPlayer(snap);
    startLocalTimerIfNeeded(snap);
  }

  /* ───── Local phase timer ───── */

  function startLocalTimerIfNeeded(snap){
    var hasTimer = snap && snap.phaseEndsAt > 0 && (snap.state === "answer" || snap.state === "vote" || snap.state === "round_intro" || snap.state === "round_score" || snap.state === "vote_result" || snap.state === "launch" || snap.state === "ability_select");
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
    if(els.hostVoteTimerCircleContainer) els.hostVoteTimerCircleContainer.hidden = true;
    // Antigravity-added LED segmented timer wasn't being cleaned up — it stuck
    // around on the lobby screen with a stale countdown like "73". Hide it too.
    var segTimer = document.getElementById("hostSegmentedTimer");
    if(segTimer) segTimer.hidden = true;
  }

  function tickLocalTimer(){
    var snap = state.room;
    if(!snap || !snap.phaseEndsAt){ hideTimers(); return; }
    var remainMs = Math.max(0, snap.phaseEndsAt - Date.now());
    var totalMs = Math.max(1, snap.phaseDurationMs || 1);
    var pct = Math.max(0, Math.min(100, (remainMs / totalMs) * 100));
    var secs = Math.ceil(remainMs / 1000);

    var showOnPlayer = state.view === "player" && (snap.state === "answer" || snap.state === "vote" || snap.state === "ability_select");
    var showOnHost = state.view === "host" && (snap.state === "answer" || snap.state === "vote" || snap.state === "ability_select");

    // Tick sound in last 5 seconds
    if((showOnPlayer || showOnHost) && remainMs > 0 && remainMs <= 5000){
      var tickKey = Math.ceil(remainMs / 1000);
      if(tickKey !== state._lastTickKey){
        state._lastTickKey = tickKey;
        if(tickKey <= 3) klppAudio.finalTick();
        else klppAudio.tick();
      }
    } else {
      state._lastTickKey = null;
    }

    if(showOnPlayer){
      els.playerTimerBar.hidden = false;
      els.playerTimerFill.style.width = pct + "%";
      els.playerTimerFill.classList.toggle("danger", remainMs < 5000);
      els.playerTimerLabel.textContent = secs + " сек";
    } else {
      els.playerTimerBar.hidden = true;
    }
    
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

    } else {
      els.hostStageTimer.hidden = true;
      if(els.hostVoteTimerCircleContainer) els.hostVoteTimerCircleContainer.hidden = true;
      var hostSegmentedTimer = document.getElementById("hostSegmentedTimer");
      if(hostSegmentedTimer) hostSegmentedTimer.hidden = true;
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

  /* ─── DEV MODE ─────────────────────────────────────────────────── */
  async function devLaunch(){
    try{
      var data = await api("/api/klpp/dev/start", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({botCount: 4, settings: loadSettingsDraft()})
      });
      state.hostKey = data.hostKey || "";
      state.devMode = true;
      if(data.room && data.room.id && state.hostKey){
        sessionStorage.setItem("klppHostKey:" + data.room.id, state.hostKey);
      }
      navigate("host", data.room.id, {backTarget:{view:"home", roomId:""}, dev: true});
    }catch(error){
      alert("Dev режим не запустился: " + error.message);
    }
  }

  async function devSkip(kind){
    if(!state.roomId || !state.hostKey) return;
    var times = kind === "round" ? 6 : 1; // round = enough skips to bulldoze through current round
    for(var i = 0; i < times; i += 1){
      try{
        await api("/api/klpp/room/" + encodeURIComponent(state.roomId) + "/dev/skip", {
          method: "POST",
          headers: {"Content-Type":"application/json"},
          body: JSON.stringify({hostKey: state.hostKey})
        });
      }catch(error){ break; }
      // small gap so server tick can settle between phase jumps
      if(kind === "round") await new Promise(function(r){ setTimeout(r, 250); });
    }
  }

  async function devEndGameClick(){
    if(!state.roomId || !state.hostKey) return;
    try{
      await api("/api/klpp/room/" + encodeURIComponent(state.roomId) + "/end", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({hostKey: state.hostKey, showScore: true})
      });
    }catch(error){ /* ignore */ }
  }

  function applyDevModeVisibility(){
    var devBtn = document.getElementById("devLaunchButton");
    var devPanel = document.getElementById("devPanel");
    if(devBtn) devBtn.hidden = state.view !== "home";
    if(devPanel) devPanel.hidden = !(state.view === "host" && state.devMode);
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
    
    var text = "";
    var isMeme = Boolean(snap.viewer.currentAssignment.memeImageUrl);
    
    if(isMeme) {
      var topText = String(id("playerAnswerMemeTop").value || "").trim();
      var bottomText = String(id("playerAnswerMemeBottom").value || "").trim();
      if (!topText && !bottomText) {
        showAnswerHint("Напиши хотя бы один text для мема!", true);
        return;
      }
      text = JSON.stringify({ top: topText, bottom: bottomText });
    } else {
      text = String(els.playerAnswerInput.value || "").trim();
      if(!text){ return; }
      var validation = validateAnswerAgainstActiveModifiers(text);
      if(!validation.ok){
        showAnswerHint(validation.error, true);
        return;
      }
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
      klppAudio.answerSubmit();
      if(isMeme) {
        id("playerAnswerMemeTop").value = "";
        id("playerAnswerMemeBottom").value = "";
        id("playerAnswerMemePreviewTop").textContent = "";
        id("playerAnswerMemePreviewBottom").textContent = "";
      } else {
        els.playerAnswerInput.value = "";
      }
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
    klppAudio.voteClick();
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
    var layout = getHostLayout(snap);
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
    els.hostStagePanel.hidden = inLobby || snap.state === "answer";

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
    checkWaveTransition(snap);

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

  
  var prevHostState = "";
  function checkWaveTransition(snap) {
    if (state.view !== "host") return;
    if (prevHostState === "answer" && (snap.state === "vote" || snap.state === "vote_result")) {
      var wave = document.getElementById("hostWaveTransition");
      if (wave) {
        wave.classList.remove("active");
        wave.style.top = "-120vh";
        wave.style.transition = "none";
        setTimeout(() => {
          wave.style.transition = "top 1.2s cubic-bezier(0.4, 0, 0.2, 1)";
          wave.style.top = "";
          wave.style.top = ""; wave.classList.add("active");
        }, 50);
      }
    }
    prevHostState = snap.state;
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
      var isReverse = snap.currentRound && snap.currentRound.type === "reverse";
      var isBlind = !isReverse && snap.activeModifiers && snap.activeModifiers.some(function(m){ return m && m.id === "blind_round"; });
      if(isReverse) prompt = "❓ Игроки придумывают вопрос к ответу";
      else if(isBlind) prompt = "🙈 Слепой раунд — только подсказка категории";
      else prompt = "Игроки пишут ответы на своих вопросах";
      body = "<p class=\"panel-copy\">Каждый игрок отвечает на свои пары. На большом экране результаты появятся, когда все закончат.</p>";
    } else if(state === "vote" && snap.currentVote){
      var vote = snap.currentVote;
      if(vote.type === "final_lash" || vote.type === "meme_round"){
        prompt = vote.type === "meme_round" ? ("🖼️ Мем-раунд: " + vote.questionText) : ("💀 Смертельный бой: " + vote.questionText);
        body = renderHostFinalVote(vote, snap, false);
      } else {
        var isRev = Boolean(snap.currentVote.isReverse);
        prompt = isRev ? ("❓ Ответ: " + snap.currentVote.questionText) : snap.currentVote.questionText;
        body = renderHostVotePair(snap.currentVote, snap, false);
      }
    } else if(state === "vote_result" && snap.currentVote){
      var vote = snap.currentVote;
      if(vote.type === "final_lash" || vote.type === "meme_round"){
        prompt = vote.type === "meme_round" ? ("🖼️ Мем-раунд: " + vote.questionText) : ("💀 Смертельный бой: " + vote.questionText);
        body = renderHostFinalVote(vote, snap, true);
      } else {
        var isRev = Boolean(snap.currentVote.isReverse);
        prompt = isRev ? ("❓ Ответ: " + snap.currentVote.questionText) : snap.currentVote.questionText;
        body = renderHostVotePair(snap.currentVote, snap, true);
      }
    } else if(state === "round_score" && snap.lastRoundResult){
      prompt = snap.lastRoundResult.title || ("Раунд " + snap.lastRoundResult.roundNumber);
      body = renderHostScoreboard(snap.lastRoundResult.scoreboard, snap);
    } else if(state === "finished"){
      prompt = "Игра закончилась";
      body = renderHostScoreboard((snap.lastRoundResult && snap.lastRoundResult.scoreboard) || snap.scoreboard, snap, true);
    } else if(state === "ability_select" && snap.abilitySelect){
      prompt = "Выбор способностей лидера";
      body = renderHostAbilitySelect(snap);
    } else if(state === "paused"){
      prompt = "Пауза";
      body = "<p class=\"panel-copy\">Хост поставил игру на паузу.</p>";
    }
    
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

    els.hostStagePrompt.textContent = prompt;
    els.hostStageBody.innerHTML = body;
  }

  function renderHostAbilitySelect(snap){
    var options = snap.abilitySelect.options || [];
    var html = '<div class="stage-vote-pair" style="gap:20px; display:flex; justify-content:center;">';
    options.forEach(function(opt){
      var isChosen = snap.abilitySelect.chosen === opt.id;
      html += '<div class="vote-card' + (isChosen ? ' winner' : '') + '" style="flex:1; max-width:320px; text-align:center; padding:30px 20px; border-width:4px; border-radius:24px;' + (isChosen ? ' box-shadow:0 0 30px #ffd700;' : '') + '">' +
        '<div style="font-size:64px; margin-bottom:15px; animation: klpp-drunk-float 3s ease-in-out infinite;">' + escapeHtml(opt.icon) + '</div>' +
        '<h3 style="font-size:22px; margin:0 0 10px; font-weight:900;">' + escapeHtml(opt.name) + '</h3>' +
        '<p style="font-family:Inter,sans-serif; font-size:14px; color:#555; margin:0;">' + escapeHtml(opt.description) + '</p>' +
      '</div>';
    });
    html += '</div>';
    return html;
  }

  function renderHostVotePair(vote, snap, showResult){
    var leftAuthor = lookupPlayer(snap, vote.leftClientId);
    var rightAuthor = lookupPlayer(snap, vote.rightClientId);
    var leftWinner = showResult && vote.result && vote.result.leftPercent > vote.result.rightPercent;
    var rightWinner = showResult && vote.result && vote.result.rightPercent > vote.result.leftPercent;
    var isReverse = Boolean(vote.isReverse);
    var prefix = isReverse
      ? '<p class="panel-copy" style="font-size:0.9em;opacity:0.75;margin-bottom:6px">' +
        '❓ Голосуйте за лучший <strong>вопрос</strong> к этому ответу</p>'
      : '';
    return prefix + '<div class="stage-vote-pair">' +
      voteCardForHost(vote, snap, "left", leftAuthor, showResult, leftWinner, isReverse) +
      voteCardForHost(vote, snap, "right", rightAuthor, showResult, rightWinner, isReverse) +
    '</div>' + (showResult ? renderHostVoteResultLine(vote.result) : '<p class="panel-copy" style="margin-top:10px">Голосуют только зрители. ' + (snap.settings.selfVotingEnabled ? "Авторы тоже." : "Авторы — нет.") + "</p>");
  }

  function voteCardForHost(vote, snap, side, author, showResult, isWinner, isReverse){
    var text = side === "left" ? vote.leftText : vote.rightText;
    var missing = side === "left" ? vote.leftMissing : vote.rightMissing;
    var pct = vote.result ? (side === "left" ? vote.result.leftPercent : vote.result.rightPercent) : null;
    var delta = vote.result ? (side === "left" ? vote.result.leftScoreDelta : vote.result.rightScoreDelta) : null;
    var hideAuthor = vote && vote.anonymous && !showResult;
    var avatarHtml = hideAuthor ? renderAnonymousAvatarHtml() : renderAvatarHtml(author && author.avatar, "sm");
    var authorName = hideAuthor
      ? escapeHtml(side === "left" ? (vote.leftNickname || "Игрок А") : (vote.rightNickname || "Игрок Б"))
      : (author ? escapeHtml(author.nickname) : escapeHtml(side === "left" ? (vote.leftNickname || "Игрок") : (vote.rightNickname || "Игрок")));
    var reverseLabel = isReverse ? '<div style="font-size:0.72em;opacity:0.65;margin-bottom:3px">❓ Вопрос:</div>' : '';
    return '<div class="vote-card' + (isWinner ? " winner" : "") + '">' +
      '<div class="vote-author">' + avatarHtml + '<span>' + authorName + '</span></div>' +
      '<div class="vote-text">' + reverseLabel + (missing ? '<em style="opacity:.7">НЕТ ОТВЕТА</em>' : escapeHtml(text)) + '</div>' +
      (showResult ? '<div class="vote-tally"><span>' + (pct == null ? 0 : pct) + "%</span><span>+" + (delta || 0) + "</span></div>" : "") +
    '</div>';
  }

  function renderAnonymousAvatarHtml(){
    return '<div class="avatar avatar--sm" style="background:#444;color:#fff;display:flex;align-items:center;justify-content:center;border:2px solid #111">?</div>';
  }

  function renderHostFinalVote(vote, snap, showResult) {
    var answers = showResult && vote.result ? vote.result.answers : vote.answers;
    var maxVotes = 0;
    if (showResult && answers.length > 0) {
      maxVotes = answers[0].voteCount;
    }
    
    var html = '<div class="final-lash-grid">';
    
    answers.forEach(function(ans, index){
      if(ans.missing) return;
      
      var isWinner = showResult && maxVotes > 0 && ans.voteCount === maxVotes;
      var cardClass = "final-lash-card" + (isWinner ? " winner" : "");
      
      var avatarHtml = "";
      var authorName = "";
      if (showResult) {
        var player = lookupPlayer(snap, ans.clientId);
        avatarHtml = renderAvatarHtml(player ? player.avatar : null, "sm");
        authorName = player ? escapeHtml(player.nickname) : escapeHtml(ans.nickname);
      } else {
        avatarHtml = renderAnonymousAvatarHtml();
        authorName = escapeHtml(ans.nickname);
      }
      
      var contentHtml = "";
      if (vote.type === "meme_round") {
        var parsedMeme = {top: "", bottom: ""};
        try {
          parsedMeme = JSON.parse(ans.answerText);
        } catch(e) {
          parsedMeme = {top: ans.answerText, bottom: ""};
        }
        contentHtml = renderMemeContainerHtml(vote.memeImageUrl, parsedMeme.top, parsedMeme.bottom);
      } else {
        contentHtml = '<div class="final-lash-text">«' + escapeHtml(ans.answerText) + '»</div>';
      }
      
      var tallyHtml = "";
      if (showResult) {
        var votersText = (ans.voters && ans.voters.length > 0) 
          ? "Голоса: " + ans.voters.map(escapeHtml).join(", ") 
          : "Нет голосов";
        
        tallyHtml = '<div class="final-lash-tally">' +
          '<span>Голосов: ' + ans.voteCount + '</span>' +
          '<span style="color:#28a745; font-weight:900;">+' + ans.scoreDelta + '</span>' +
        '</div>' +
        '<div class="final-lash-voters">' + votersText + '</div>';
      }
      
      html += '<div class="' + cardClass + '">' +
        '<div class="final-lash-author">' + avatarHtml + '<span>' + authorName + '</span></div>' +
        contentHtml +
        tallyHtml +
      '</div>';
    });
    
    html += '</div>';
    
    if (showResult) {
      var isLastRound = (snap.roundIndex || 0) >= (snap.settings.roundCount || 5);
      var doubled = snap.settings.doublePointsLastRound && isLastRound;
      var ptsPerVote = doubled ? 300 : 150;
      html += '<p class="panel-copy" style="margin-top:20px; font-size:15px; font-weight:800;">' +
        'Каждый полученный голос принёс <strong>' + ptsPerVote + ' очков</strong>!' +
      '</p>';
    } else {
      html += '<p class="panel-copy" style="margin-top:20px;">Голосуйте на экранах своих телефонов!</p>';
    }
    
    return html;
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

  function buildLobbySummary(snap){
    var s = snap.settings;
    return '<div class="summary-card">Комната: <strong>' + escapeHtml(snap.id) + '</strong><br>Игроков: <strong>' + snap.players.length + " / минимум " + snap.minPlayersToStart + "</strong><br>Раундов: <strong>" + snap.totalRounds + "</strong></div>" +
      '<div class="summary-card">Ответ: <strong>' + s.answerSeconds + " сек</strong><br>Голос: <strong>" + s.voteSeconds + " сек</strong><br>Своё: <strong>" + (s.selfVotingEnabled ? "можно голосовать" : "нельзя") + "</strong></div>";
  }

  function renderHostPlayers(snap, layout){
    if(els.hostPlayersLayer) els.hostPlayersLayer.style.display = (snap.state === 'vote' || snap.state === 'vote_result') ? 'none' : '';
    var inVote = snap.state === 'vote' || snap.state === 'vote_result';
    if(els.hostPlayersLayer) els.hostPlayersLayer.style.display = inVote ? 'none' : '';
    var layer = els.hostPlayersLayer;
    var existing = {};
    Array.prototype.forEach.call(layer.children, function(node){
      var key = node.getAttribute("data-client-id");
      if(key) existing[key] = node;
    });
    var liveIds = {};
    snap.players.forEach(function(player, index){
      liveIds[player.clientId] = true;
      var trashSpot = index >= layout.fieldSpots.length;
      var fieldIndex = trashSpot ? Math.max(0, index - 1) : index;
      var pos = trashSpot ? layout.lastJoinedSpot : layout.fieldSpots[index % layout.fieldSpots.length];
      var node = existing[player.clientId];
      if(!node){
        node = document.createElement("div");
        node.className = "host-player entering" + (trashSpot ? " trash-player" : "");
        node.setAttribute("data-client-id", player.clientId);
        var finalY = pos.y;
        if (snap.state === "answer" && player.isDoneAnswering) {
          finalY = -25;
        }

        var startX = pos.x + (Math.random() * 26 - 13);
        node.style.setProperty("--start-x", startX + "%");
        node.style.setProperty("--start-y", "-15%");
        node.style.setProperty("--target-x", pos.x + "%");
        node.style.setProperty("--target-y", finalY + "%");
        node.style.setProperty("--target-scale", pos.scale || 1);
        node.style.setProperty("--target-z", Math.round(finalY));
        node.style.left = pos.x + "%";
        node.style.top = finalY + "%";
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
          var finalY = pos.y;
          if (snap.state === "answer" && player.isDoneAnswering) {
            finalY = -25;
          }
          
          node.style.setProperty("--target-x", pos.x + "%");
          node.style.setProperty("--target-y", finalY + "%");
          node.style.setProperty("--target-scale", pos.scale || 1);
          node.style.setProperty("--target-z", Math.round(finalY));
          node.style.left = pos.x + "%";
          node.style.top = finalY + "%";
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
    var hasAbilities = isAnswerPhase && snap.abilitySelect;
    var hasPending = isAnswerPhase && viewer.currentAssignment && !hasAbilities;
    els.playerAnswerForm.hidden = !hasPending;
    els.playerVoteList.hidden = !(stateName === "vote" && viewer.vote);
    els.playerScoreboard.hidden = !(stateName === "round_score" || stateName === "finished" || stateName === "vote_result");
    els.playerAbilitySelect.hidden = !hasAbilities;

    if(inLobby){
      renderPlayerLobby(snap);
    } else if(stateName === "launch" || stateName === "round_intro"){
      renderPlayerInterstitial(snap);
    } else if(isAnswerPhase){
      if(hasAbilities){
        renderPlayerAbilitySelect(snap);
      } else {
        renderPlayerAnswer(snap);
      }
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
    
    // Ability Activation Widget (Option V)
    var abilityDefs = {
      freeze_timer: { name: "Заморозка времени", icon: "❄️", desc: "Добавить +25 секунд к таймеру ответов раунда" },
      reduce_timer: { name: "Сокращение времени", icon: "⚡", desc: "Сократить таймер раунда на 25 секунд" },
      swap_questions: { name: "Обмен вопросами", icon: "🔄", desc: "Обменять текущий вопрос на случайный" },
      join_the_battle: { name: "Вступить в бой", icon: "⚔️", desc: "Получить +50% очков в этом раунде" },
      spy: { name: "Шпионаж", icon: "👁️", desc: "Видеть ответ соперника в реальном времени" }
    };
    var held = viewer.heldAbility;
    var def = abilityDefs[held];
    if (assignment && def) {
      var existing = document.getElementById("playerHeldAbilityWidget");
      if (!existing) {
        existing = document.createElement("div");
        existing.id = "playerHeldAbilityWidget";
        existing.style.cssText = "background:#fffdf5; border:4px solid #ffd447; border-radius:16px; padding:16px; margin-bottom:20px; display:flex; align-items:center; justify-content:space-between; gap:12px; box-shadow:0 6px 12px rgba(0,0,0,0.08);";
        els.playerAnswerForm.insertBefore(existing, els.playerAnswerForm.firstChild);
      }
      existing.innerHTML = 
        '<div style="display:flex; align-items:center; gap:12px;">' +
          '<span style="font-size:32px;">' + escapeHtml(def.icon) + '</span>' +
          '<div>' +
            '<strong style="font-size:16px; display:block; color:#856404; margin-bottom:2px;">' + escapeHtml(def.name) + '</strong>' +
            '<span style="font-size:12px; color:#666;">' + escapeHtml(def.desc) + '</span>' +
          '</div>' +
        '</div>' +
        '<button class="cta small-pill" type="button" id="useAbilityBtn" style="padding:10px 16px; font-size:14px; background:#ffc107; border:3px solid #856404; color:#212529;">ИСПОЛЬЗОВАТЬ</button>';
      
      var useBtn = document.getElementById("useAbilityBtn");
      if (useBtn) {
        useBtn.addEventListener("click", useAbility);
      }
    } else {
      var existing = document.getElementById("playerHeldAbilityWidget");
      if (existing) existing.parentNode.removeChild(existing);
    }

    if(assignment){
      var isReverse = Boolean(assignment.isReverse);
      var isBlind = Boolean(assignment.isBlind);
      if(isReverse){
        els.playerTitle.textContent = "❓ Придумай вопрос";
        els.playerSubtitle.textContent = "Ответ уже есть — придумай к нему смешной вопрос!";
        // Show the punchline prominently as the "prompt"
        els.playerAnswerQuestion.innerHTML =
          '<div style="font-size:0.75em;opacity:0.7;margin-bottom:6px">Готовый ответ:</div>' +
          '<div style="font-size:1.1em;font-weight:700;color:var(--accent,#ffd447)">' + escapeHtml(assignment.questionText) + '</div>';
      } else if(isBlind){
        els.playerTitle.textContent = "🙈 Слепой раунд";
        els.playerSubtitle.textContent = (done + 1) + " из " + total + " — видна только подсказка";
        els.playerAnswerQuestion.innerHTML =
          '<div style="font-size:0.75em;opacity:0.7;margin-bottom:6px">Категория:</div>' +
          '<div style="font-size:2em;font-weight:900;letter-spacing:2px;color:var(--accent,#ffd447)">' + escapeHtml(assignment.displayText) + '</div>';
      } else {
        els.playerTitle.textContent = "Твой вопрос";
        els.playerSubtitle.textContent = (done + 1) + " из " + total;
        els.playerAnswerQuestion.textContent = assignment.questionText;
      }
      
      if (assignment.spyOpponentAnswer) {
        els.playerAnswerMeta.innerHTML = 
          '<div class="klpp-spy-reveal-box">' +
            '<span class="spy-eye">👁️</span> ' +
            '<strong>ШПИОНАЖ:</strong> Твой оппонент ответил:<br>' +
            '<span class="spy-answer-text">«' + escapeHtml(assignment.spyOpponentAnswer) + '»</span>' +
          '</div>';
      } else if (viewer && viewer.activeAbility === "spy") {
        els.playerAnswerMeta.innerHTML = 
          '<div class="klpp-spy-reveal-box pending">' +
            '<span class="spy-eye">👁️</span> ' +
            '<strong>ШПИОНАЖ:</strong> Оппонент ещё придумывает ответ... (как только ответит — он появится здесь)' +
            '</div>';
      } else {
        els.playerAnswerMeta.textContent = "";
      }
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

    if(vote.type === "final_lash" || vote.type === "meme_round"){
      els.playerTitle.textContent = vote.type === "meme_round" ? "Выбери лучший мем!" : "Смертельный бой!";
      els.playerSubtitle.textContent = vote.questionText;
      els.playerCtaRow.innerHTML = "";
      els.playerMessage.hidden = true;
      
      var listHtml = "";
      (vote.answers || []).forEach(function(ans, index){
        if(ans.missing) return;
        
        var isOwn = ans.clientId === state.clientId;
        var isChosen = vote.chosenClientId === ans.clientId || state.lastChosenVote === ans.clientId;
        
        var cardContent = "";
        if(vote.type === "meme_round"){
          var parsedMeme = {top: "", bottom: ""};
          try {
            parsedMeme = JSON.parse(ans.answerText);
          } catch(e) {
            parsedMeme = {top: ans.answerText, bottom: ""};
          }
          cardContent = renderMemeContainerHtml(vote.memeImageUrl, parsedMeme.top, parsedMeme.bottom);
        } else {
          cardContent = '<p style="font-size: 16px; font-weight: 800; margin: 6px 0;">«' + escapeHtml(ans.answerText) + '»</p>';
        }
        
        var label = "Выбрать";
        if(isOwn) {
          label = "Твой ответ";
        } else if(isChosen) {
          label = "Твой голос 👍";
        }
        
        listHtml += '<button class="vote-card" type="button" data-target="' + ans.clientId + '"' + 
          (isChosen ? ' data-chosen="true"' : "") + 
          (isOwn ? " disabled" : "") + 
          (isOwn ? ' style="opacity:0.65; border-style:dashed;"' : "") + '>' +
          '<strong>' + label + '</strong>' +
          cardContent +
        '</button>';
      });
      
      els.playerVoteList.innerHTML = listHtml;
      
      Array.prototype.forEach.call(els.playerVoteList.querySelectorAll("[data-target]"), function(btn){
        if(!btn.disabled) {
          btn.addEventListener("click", function(){
            submitVote(btn.getAttribute("data-target"));
          });
        }
      });
      return;
    }
    var isReverse = Boolean(vote.isReverse);
    if(isReverse){
      els.playerTitle.textContent = "❓ Чей вопрос смешнее?";
      // Show the punchline as subtitle with emphasis
      els.playerSubtitle.innerHTML = '<span style="opacity:0.65;font-size:0.85em">Ответ:</span> <strong>' + escapeHtml(vote.questionText) + '</strong>';
    } else {
      els.playerTitle.textContent = "Кто смешнее?";
      els.playerSubtitle.textContent = vote.questionText;
    }
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
      voteCardForPlayer(vote, "left", leftAuthor, leftChosen, isReverse) +
      voteCardForPlayer(vote, "right", rightAuthor, rightChosen, isReverse);
    Array.prototype.forEach.call(els.playerVoteList.querySelectorAll("[data-target]"), function(btn){
      btn.addEventListener("click", function(){
        submitVote(btn.getAttribute("data-target"));
      });
    });
  }

  function voteCardForPlayer(vote, side, author, chosen, isReverse){
    var text = side === "left" ? vote.leftText : vote.rightText;
    var missing = side === "left" ? vote.leftMissing : vote.rightMissing;
    var target = side === "left" ? vote.leftClientId : vote.rightClientId;
    var label = isReverse ? "Голос за этот вопрос" : "Голос за этого";
    if(!vote.anonymous && author){
      label += " (" + escapeHtml(author.nickname) + ")";
    }
    return '<button class="vote-card" type="button" data-target="' + target + '"' + (chosen ? ' data-chosen="true"' : "") + (missing ? " disabled" : "") + '>' +
      '<strong>' + (missing ? "Не ответил" : label) + '</strong>' +
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
    var myClientId = state.clientId;
    var iAmLeft = r.leftClientId === myClientId;
    var iAmRight = r.rightClientId === myClientId;
    var iWon = (iAmLeft && r.leftPercent > r.rightPercent) || (iAmRight && r.rightPercent > r.leftPercent);
    var iLost = (iAmLeft && r.leftPercent < r.rightPercent) || (iAmRight && r.rightPercent < r.leftPercent);
    var activeIds = (snap.activeModifiers || []).map(function(m){ return m && m.id; });
    var hasSteal = activeIds.indexOf("steal") !== -1;
    var hasCombo = activeIds.indexOf("combo") !== -1;

    // Sound effects
    if(!state._lastVoteResultKey || state._lastVoteResultKey !== vote.pairId){
      state._lastVoteResultKey = vote.pairId;
      if(iAmLeft || iAmRight){
        if(iWon){
          if(hasSteal) klppAudio.steal();
          else if(hasCombo){
            var myStreak = (state.comboStreaks[myClientId] || 0);
            klppAudio.combo(myStreak);
          } else {
            klppAudio.win();
          }
        } else if(iLost){
          klppAudio.lose();
        }
      }
      // Show steal flash for all players (only if steal actually triggered — server set stealAmount > 0)
      if(hasSteal && r.stealAmount > 0){
        showStealFlash(r.leftPercent > r.rightPercent ? r.leftNickname : r.rightNickname, r.stealAmount);
      }
    }

    // Update combo streaks from result
    if(hasCombo && r.leftPercent !== r.rightPercent){
      var winner = r.leftPercent > r.rightPercent ? r.leftClientId : r.rightClientId;
      var loser = r.leftPercent > r.rightPercent ? r.rightClientId : r.leftClientId;
      state.comboStreaks[winner] = (state.comboStreaks[winner] || 0) + 1;
      state.comboStreaks[loser] = 0;
    }

    var leftName = escapeHtml(r.leftNickname);
    var rightName = escapeHtml(r.rightNickname);
    var myStreakHtml = "";
    if(hasCombo && (iAmLeft || iAmRight)){
      var streak = state.comboStreaks[myClientId] || 0;
      if(streak >= 2) myStreakHtml = ' <span class="klpp-combo-badge">🔥×' + streak + '</span>';
    }
    els.playerScoreboard.innerHTML =
      '<div class="score-row' + (r.leftPercent >= r.rightPercent ? " winner" : "") + '">' +
        '<span class="score-name">' + leftName + (iAmLeft ? myStreakHtml : "") + '</span>' +
        '<span class="score-value">' + r.leftPercent + "% · +" + r.leftScoreDelta + "</span>" +
      '</div>' +
      '<div class="score-row' + (r.rightPercent > r.leftPercent ? " winner" : "") + '">' +
        '<span class="score-name">' + rightName + (iAmRight ? myStreakHtml : "") + '</span>' +
        '<span class="score-value">' + r.rightPercent + "% · +" + r.rightScoreDelta + "</span>" +
      '</div>';
    state.lastChosenVote = "";
  }

  function showStealFlash(winnerName, amount){
    var overlay = document.createElement("div");
    overlay.className = "klpp-steal-overlay";
    var text = document.createElement("div");
    text.className = "klpp-steal-overlay__text";
    text.textContent = "🦹 ГРАБЁЖ! " + (winnerName || "") + " крадёт " + (amount ? amount + " очков" : "очки") + "!";
    overlay.appendChild(text);
    document.body.appendChild(overlay);
    setTimeout(function(){
      if(overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 1900);
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

  async function selectAbility(abilityId){
    try {
      await api("/api/klpp/room/" + encodeURIComponent(state.roomId) + "/ability", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          clientId: state.clientId,
          abilityId: abilityId
        })
      });
      klppAudio.click();
    } catch(error) {
      alert("Ошибка при выборе способности: " + (error.message || error));
    }
  }

  async function useAbility(){
    try {
      await api("/api/klpp/room/" + encodeURIComponent(state.roomId) + "/use-ability", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          clientId: state.clientId
        })
      });
      klppAudio.click();
    } catch(error) {
      alert("Ошибка при активации способности: " + (error.message || error));
    }
  }

  function renderPlayerAbilitySelect(snap){
    var viewer = snap.viewer || {};
    var isLeader = Boolean(viewer.isGameLeader);
    var activeIds = (snap.activeModifiers || []).map(function(m){ return m && m.id; });
    var hasParty = activeIds.indexOf("ability_party") !== -1;
    els.playerTitle.textContent = "Выбор способности";
    els.playerSubtitle.textContent = (isLeader || hasParty)
      ? "Выберите суперспособность на этот раунд!"
      : "Лидер выбирает суперспособность на этот раунд...";

    if(!snap.abilitySelect){
      els.playerAbilitySelect.hidden = true;
      els.playerMessage.className = "player-message player-wait";
      els.playerMessage.textContent = "Способность выбрана! Начинаем раунд...";
      els.playerMessage.hidden = false;
      return;
    }

    if(isLeader || hasParty){
      els.playerAbilitySelect.hidden = false;
      els.playerMessage.hidden = true;
      
      var options = snap.abilitySelect.options || [];
      var html = "";
      
      if (snap.abilitySelect.held) {
        var opt = snap.abilitySelect.held;
        var isChosen = snap.abilitySelect.chosen === opt.id;
        html += '<div style="margin-bottom:12px; font-weight:800; font-size:14px; color:#856404; text-transform:uppercase; letter-spacing:1.5px;">Оставить удерживаемую:</div>';
        html += '<button class="vote-card" type="button" style="text-align:left; width:100%; margin-bottom:20px; border-color:#856404; background:#fffdf5;" data-ability-id="' + opt.id + '"' + (isChosen ? ' data-chosen="true"' : '') + '>' +
          '<div style="display:flex; align-items:center; gap:12px;">' +
            '<div style="font-size:32px;">' + escapeHtml(opt.icon) + '</div>' +
            '<div>' +
              '<strong style="font-size:16px; display:block; margin-bottom:4px; color:#856404;">' + escapeHtml(opt.name) + ' (Уже у вас)</strong>' +
              '<span style="font-family:Inter,sans-serif; font-size:13px; color:#666;">' + escapeHtml(opt.description) + '</span>' +
            '</div>' +
          '</div>' +
        '</button>';
        html += '<div style="margin-bottom:12px; font-weight:800; font-size:14px; color:#555; text-transform:uppercase; letter-spacing:1.5px;">Или заменить на новую:</div>';
      }

      options.forEach(function(opt){
        var isChosen = snap.abilitySelect.chosen === opt.id;
        html += '<button class="vote-card" type="button" style="text-align:left; width:100%; margin-bottom:10px;" data-ability-id="' + opt.id + '"' + (isChosen ? ' data-chosen="true"' : '') + '>' +
          '<div style="display:flex; align-items:center; gap:12px;">' +
            '<div style="font-size:32px;">' + escapeHtml(opt.icon) + '</div>' +
            '<div>' +
              '<strong style="font-size:16px; display:block; margin-bottom:4px;">' + escapeHtml(opt.name) + '</strong>' +
              '<span style="font-family:Inter,sans-serif; font-size:13px; color:#555;">' + escapeHtml(opt.description) + '</span>' +
            '</div>' +
          '</div>' +
        '</button>';
      });
      els.playerAbilityOptions.innerHTML = html;

      // Add click handlers
      Array.prototype.forEach.call(els.playerAbilityOptions.querySelectorAll("[data-ability-id]"), function(btn){
        btn.addEventListener("click", function(){
          var abilityId = btn.getAttribute("data-ability-id");
          selectAbility(abilityId);
        });
      });
    } else {
      els.playerAbilitySelect.hidden = true;
      els.playerMessage.className = "player-message player-wait";
      els.playerMessage.hidden = false;
      els.playerMessage.textContent = "Лидер выбирает способность из 3 вариантов...";
      els.playerAbilityOptions.innerHTML = "";
    }
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
      questionsPerPlayer: Number((els.settingsQuestionsPerPlayer && els.settingsQuestionsPerPlayer.value) || KLPP_DEFAULT_SETTINGS.questionsPerPlayer),
      selfVotingEnabled: els.settingsSelfVotingEnabled.checked,
      anonymousAnswers: els.settingsAnonymousAnswers && els.settingsAnonymousAnswers.checked,
      doublePointsLastRound: els.settingsDoublePointsLastRound && els.settingsDoublePointsLastRound.checked,
      modifierMode: (els.settingsModifierMode && els.settingsModifierMode.value) || "off",
      selectedModifiers: state.selectedModifiersDraft.slice(),
      questionSetId: (els.settingsQuestionSetId && els.settingsQuestionSetId.value) || KLPP_DEFAULT_SETTINGS.questionSetId,
      finalRoundType: (els.settingsFinalRoundType && els.settingsFinalRoundType.value) || KLPP_DEFAULT_SETTINGS.finalRoundType
    });
  }

  function populateSettingsForm(settings){
    settings = sanitizeSettings(settings);
    els.settingsAnswerSeconds.value = settings.answerSeconds;
    els.settingsVoteSeconds.value = settings.voteSeconds;
    if(els.settingsRoundCount) els.settingsRoundCount.value = String(settings.roundCount);
    if(els.settingsQuestionsPerPlayer) els.settingsQuestionsPerPlayer.value = String(settings.questionsPerPlayer);
    els.settingsSelfVotingEnabled.checked = Boolean(settings.selfVotingEnabled);
    if(els.settingsAnonymousAnswers) els.settingsAnonymousAnswers.checked = Boolean(settings.anonymousAnswers);
    if(els.settingsDoublePointsLastRound) els.settingsDoublePointsLastRound.checked = Boolean(settings.doublePointsLastRound);
    if(els.settingsModifierMode) els.settingsModifierMode.value = settings.modifierMode || "off";
    if(els.settingsQuestionSetId) els.settingsQuestionSetId.value = settings.questionSetId || "default";
    if(els.settingsFinalRoundType) els.settingsFinalRoundType.value = settings.finalRoundType || "final_lash";
    state.selectedModifiersDraft = (settings.selectedModifiers || []).slice();
    renderModifierChecklist();
  }

  function sanitizeSettings(settings){
    settings = settings || {};
    var mode = ["off","fixed","random"].indexOf(settings.modifierMode) !== -1 ? settings.modifierMode : "off";
    var selected = Array.isArray(settings.selectedModifiers)
      ? settings.selectedModifiers.filter(function(id){ return typeof id === "string" && id.length > 0 && id.length < 40; })
      : [];
    var finalType = ["final_lash", "meme_round", "random"].indexOf(settings.finalRoundType) !== -1 ? settings.finalRoundType : "final_lash";
    var qSetId = typeof settings.questionSetId === "string" ? settings.questionSetId : "default";
    return {
      answerSeconds: clamp(Number(settings.answerSeconds || KLPP_DEFAULT_SETTINGS.answerSeconds), 20, 180),
      voteSeconds: clamp(Number(settings.voteSeconds || KLPP_DEFAULT_SETTINGS.voteSeconds), 15, 120),
      roundCount: clamp(Number(settings.roundCount || KLPP_DEFAULT_SETTINGS.roundCount), 1, 12),
      questionsPerPlayer: clamp(Number(settings.questionsPerPlayer || KLPP_DEFAULT_SETTINGS.questionsPerPlayer), 1, 6),
      selfVotingEnabled: Boolean(settings.selfVotingEnabled),
      anonymousAnswers: Boolean(settings.anonymousAnswers),
      doublePointsLastRound: Boolean(settings.doublePointsLastRound),
      modifierMode: mode,
      selectedModifiers: selected,
      questionSetId: qSetId,
      finalRoundType: finalType
    };
  }

  // leader_abilities and ability_party are mutually exclusive — a round
  // hands abilities to either the leader or to everyone, never both.
  var KLPP_MUTEX_GROUPS = [["leader_abilities", "ability_party"]];

  function klppModifierConflicts(modId){
    var draft = state.selectedModifiersDraft || [];
    for(var i = 0; i < KLPP_MUTEX_GROUPS.length; i += 1){
      var group = KLPP_MUTEX_GROUPS[i];
      if(group.indexOf(modId) === -1) continue;
      for(var j = 0; j < group.length; j += 1){
        if(group[j] !== modId && draft.indexOf(group[j]) !== -1) return group[j];
      }
    }
    return null;
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
      var picked = state.selectedModifiersDraft.indexOf(mod.id) !== -1;
      var conflictPartner = klppModifierConflicts(mod.id);
      var disabled = mod.notImplemented || (!picked && conflictPartner !== null);
      var hint = mod.description || "";
      if(disabled && conflictPartner) hint += " · нельзя вместе с другим из этой группы";
      else if(disabled && mod.notImplemented) hint += " · в следующих итерациях";
      return '<label class="modifier-row" data-disabled="' + (disabled ? "true" : "false") + '">' +
        '<span class="modifier-row__icon">' + escapeHtml(mod.icon || "✨") + '</span>' +
        '<span><span class="modifier-row__name">' + escapeHtml(mod.name) + '</span>' +
        '<div class="modifier-row__hint">' + escapeHtml(hint) + '</div></span>' +
        '<input type="checkbox" data-modifier-id="' + escapeHtml(mod.id) + '"' + (picked ? " checked" : "") + (disabled ? " disabled" : "") + '>' +
      '</label>';
    }).join("") + '</div>';
    Array.prototype.forEach.call(els.settingsModifierList.querySelectorAll("input[data-modifier-id]"), function(input){
      input.addEventListener("change", function(){
        var modId = input.getAttribute("data-modifier-id");
        var idx = state.selectedModifiersDraft.indexOf(modId);
        if(input.checked && idx === -1) state.selectedModifiersDraft.push(modId);
        if(!input.checked && idx !== -1) state.selectedModifiersDraft.splice(idx, 1);
        state.hostSettingsDirty = true;
        // re-render so the mutex partner shows as disabled
        renderModifierChecklist();
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

  function getHostLayout(snap){
    var width = window.innerWidth;
    var isMobile = width <= 760;
    
    var spots = isMobile ? [
      {x: 50, y: 65, scale: 1}, {x: 25, y: 60, scale: 0.9}, {x: 75, y: 60, scale: 0.9},
      {x: 35, y: 75, scale: 1.1}, {x: 65, y: 75, scale: 1.1}, {x: 15, y: 70, scale: 1.0},
      {x: 85, y: 70, scale: 1.0}, {x: 50, y: 82, scale: 1.2}, {x: 20, y: 82, scale: 1.2}
    ] : [
      {x: 50, y: 75, scale: 1.1}, {x: 38, y: 70, scale: 1.0}, {x: 62, y: 70, scale: 1.0},
      {x: 26, y: 78, scale: 1.15}, {x: 74, y: 78, scale: 1.15}, {x: 45, y: 62, scale: 0.9},
      {x: 55, y: 62, scale: 0.9}, {x: 32, y: 58, scale: 0.85}, {x: 68, y: 58, scale: 0.85},
      {x: 85, y: 66, scale: 0.95}, {x: 40, y: 85, scale: 1.2}, {x: 60, y: 85, scale: 1.2}
    ];

    if(snap && snap.state === "answer") {
      var playerCount = Math.max(1, (snap.players && snap.players.length) || 1);
      var gap = Math.min(16, 80 / playerCount);
      var totalWidth = (playerCount - 1) * gap;
      var startX = 50 - (totalWidth / 2);
      spots = [];
      for(var i = 0; i < playerCount; i++){
        spots.push({x: startX + i * gap, y: 86, scale: 0.9});
      }
    }

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

  async function populateQuestionSetsDropdown() {
    if(!els.settingsQuestionSetId) return;
    try {
      var res = await api("/api/klpp/question-sets");
      var sets = res.questionSets || [];
      var currentVal = els.settingsQuestionSetId.value || "default";
      els.settingsQuestionSetId.innerHTML = sets.map(function(s){
        return '<option value="' + escapeHtml(s.id) + '">' + escapeHtml(s.name) + '</option>';
      }).join("");
      els.settingsQuestionSetId.value = currentVal;
    } catch(e) {
      console.error("Failed to load question sets for dropdown", e);
    }
  }

  /* ───── Question Set Editor logic ───── */

  function initEditorTabs() {
    Array.prototype.forEach.call(document.querySelectorAll(".editor-tab-btn"), function(btn){
      btn.addEventListener("click", function(){
        Array.prototype.forEach.call(document.querySelectorAll(".editor-tab-btn"), function(b){ b.classList.remove("active"); });
        Array.prototype.forEach.call(document.querySelectorAll(".editor-pane"), function(p){ p.classList.remove("active"); });
        
        btn.classList.add("active");
        var tabId = btn.getAttribute("data-tab");
        state.editorActiveTab = tabId;
        id("pane-" + tabId).classList.add("active");
      });
    });
  }

  async function initEditorView() {
    state.editorActiveSetId = state.editorActiveSetId || "default";
    state.editorActiveTab = "classic";
    
    var searchInput = id("editorSearchInput");
    if(searchInput) {
      searchInput.value = "";
    }
    
    Array.prototype.forEach.call(document.querySelectorAll(".editor-tab-btn"), function(b){ b.classList.remove("active"); });
    Array.prototype.forEach.call(document.querySelectorAll(".editor-pane"), function(p){ p.classList.remove("active"); });
    
    var classicTab = document.querySelector('.editor-tab-btn[data-tab="classic"]');
    if(classicTab) classicTab.classList.add("active");
    var classicPane = id("pane-classic");
    if(classicPane) classicPane.classList.add("active");
    
    await loadEditorData();
  }

  async function loadEditorData() {
    try {
      id("editorStatusText").textContent = "Загрузка...";
      var res = await api("/api/klpp/question-sets");
      state.editorSets = res.questionSets || [];
      renderEditorSetsList();
      
      var set = state.editorSets.find(function(s){ return s.id === state.editorActiveSetId; });
      if(!set && state.editorSets.length) {
        set = state.editorSets[0];
      }
      if(set) {
        loadSetIntoEditor(set);
      }
      updateSelectSetButtonState();
      id("editorStatusText").textContent = "";
    } catch(e) {
      id("editorStatusText").textContent = "Ошибка загрузки: " + e.message;
    }
  }

  function renderEditorSetsList() {
    var container = id("editorSetsList");
    if(!container) return;
    
    var query = String(id("editorSearchInput") ? id("editorSearchInput").value : "").toLowerCase().trim();
    
    var activeSettings = loadSettingsDraft();
    var selectedSetId = activeSettings.questionSetId || "default";

    var filtered = (state.editorSets || []).filter(function(s){
      if(!query) return true;
      var nameMatch = String(s.name || "").toLowerCase().indexOf(query) !== -1;
      var descMatch = String(s.description || "").toLowerCase().indexOf(query) !== -1;
      return nameMatch || descMatch;
    });

    var items = filtered.map(function(s){
      var active = s.id === state.editorActiveSetId ? " active" : "";
      var isSelectedGame = s.id === selectedSetId ? ' <span class="selected-badge" style="background:#2ecc71; color:#fff; font-size:10px; padding:2px 6px; border-radius:8px; margin-left:6px; font-weight:900;">АКТИВЕН</span>' : '';
      return '<button class="editor-set-item' + active + '" type="button" data-id="' + s.id + '">' +
        '<div style="display:flex; justify-content:space-between; align-items:center; width:100%;">' +
          '<strong>' + escapeHtml(s.name) + '</strong>' +
          isSelectedGame +
        '</div>' +
        '<div style="font-size:11px; opacity:0.75; font-weight:700; margin-top:3px;">Вопросов: ' + (s.questions || []).length + ', мемов: ' + (s.memes || []).length + '</div>' +
      '</button>';
    });

    if (state.editorActiveSetId === "") {
      var draftName = state.editorCurrentSet ? state.editorCurrentSet.name : "Новый набор";
      var draftClassic = id("editorTextClassic") ? id("editorTextClassic").value.split("\n").filter(Boolean).length : 2;
      var draftMemes = state.editorCurrentSet ? (state.editorCurrentSet.memes || []).length : 1;
      var draftHtml = '<button class="editor-set-item active" type="button" data-id="">' +
        '<strong>✨ ' + escapeHtml(draftName) + '</strong>' +
        '<div style="font-size:11px; opacity:0.9; color: #ffaa00; font-weight:700; margin-top:3px;">Черновик (Вопросов: ' + draftClassic + ', мемов: ' + draftMemes + ')</div>' +
      '</button>';
      items.unshift(draftHtml);
    }

    container.innerHTML = items.join("");
    
    Array.prototype.forEach.call(container.querySelectorAll(".editor-set-item"), function(btn){
      btn.addEventListener("click", function(){
        var id = btn.getAttribute("data-id");
        if(id === state.editorActiveSetId) return;
        
        if(isEditorDirty()) {
          if(!confirm("У вас есть несохраненные изменения в текущем наборе. Переключиться без сохранения?")) return;
        }
        
        state.editorActiveSetId = id;
        renderEditorSetsList();
        var set = state.editorSets.find(function(s){ return s.id === id; });
        if(set) loadSetIntoEditor(set);
        else if(id === "" && state.editorCurrentSet) loadSetIntoEditor(state.editorCurrentSet);
        updateSelectSetButtonState();
      });
    });
  }

  function updateSelectSetButtonState() {
    var btn = id("editorSelectSetBtn");
    if(!btn) return;
    var activeSettings = loadSettingsDraft();
    var selectedSetId = activeSettings.questionSetId || "default";
    var isSelected = state.editorActiveSetId === selectedSetId;
    if(isSelected) {
      btn.style.background = "#2ecc71";
      btn.style.color = "#fff";
      btn.innerHTML = "✅ Выбран";
      btn.disabled = true;
    } else {
      btn.style.background = "#ffd93d";
      btn.style.color = "#111";
      btn.innerHTML = "🎮 Выбрать для игры";
      btn.disabled = false;
    }
    if(state.editorActiveSetId === "") {
      btn.style.opacity = "0.5";
      btn.disabled = true;
    } else {
      btn.style.opacity = "1";
    }
  }

  async function selectEditorSetForGame() {
    var setId = state.editorActiveSetId;
    if(!setId) {
      alert("Сначала сохраните набор, чтобы выбрать его для игры!");
      return;
    }
    
    // Save settings draft
    var draft = loadSettingsDraft();
    draft.questionSetId = setId;
    saveSettingsDraft(draft);
    
    // Update settings dropdown if exists
    if(els.settingsQuestionSetId) {
      els.settingsQuestionSetId.value = setId;
    }
    
    // If we have an active room, update settings on the server too!
    if(state.roomId && state.hostKey) {
      try {
        var roomSettings = collectSettingsForm();
        roomSettings.questionSetId = setId;
        await api("/api/klpp/room/" + encodeURIComponent(state.roomId) + "/settings", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({hostKey: state.hostKey, settings: roomSettings})
        });
      } catch(e) {
        console.error("Failed to update active room settings", e);
      }
    }
    
    // Re-render list to update badges
    renderEditorSetsList();
    updateSelectSetButtonState();
    
    id("editorStatusText").textContent = "Набор выбран для игры!";
    setTimeout(function(){ id("editorStatusText").textContent = ""; }, 2500);
  }

  function compileCurrentSet() {
    if(!state.editorCurrentSet) return null;
    var name = String(id("editorSetName") ? id("editorSetName").value : "").trim();
    var desc = String(id("editorSetDesc") ? id("editorSetDesc").value : "").trim();
    var questions = id("editorTextClassic") ? id("editorTextClassic").value.split("\n").map(function(s){ return s.trim(); }).filter(Boolean) : [];
    var reverse = id("editorTextReverse") ? id("editorTextReverse").value.split("\n").map(function(s){ return s.trim(); }).filter(Boolean) : [];
    var finalQs = id("editorTextFinal") ? id("editorTextFinal").value.split("\n").map(function(s){ return s.trim(); }).filter(Boolean) : [];
    
    var compiled = clone(state.editorCurrentSet);
    compiled.name = name;
    compiled.description = desc;
    compiled.questions = questions;
    compiled.reverseAnswers = reverse;
    compiled.finalQuestions = finalQs;
    return compiled;
  }

  function isEditorDirty() {
    if(!state.editorOriginalSet) return false;
    var current = compileCurrentSet();
    if(!current) return false;
    return JSON.stringify(current) !== JSON.stringify(state.editorOriginalSet);
  }

  function updateEditorChecklist() {
    var current = compileCurrentSet();
    if(!current) return;
    
    var classicCount = (current.questions || []).length;
    var reverseCount = (current.reverseAnswers || []).length;
    var finalCount = (current.finalQuestions || []).length;
    var memesCount = (current.memes || []).length;
    
    updateCheckItem("check-classic", classicCount, 6);
    updateCheckItem("check-reverse", reverseCount, 6);
    updateCheckItem("check-final", finalCount, 2);
    updateCheckItem("check-memes", memesCount, 2);
  }

  function updateCheckItem(elementId, current, required) {
    var el = id(elementId);
    if(!el) return;
    var iconEl = el.querySelector(".status-icon");
    var countEl = el.querySelector(".status-count");
    if(current >= required) {
      if(iconEl) iconEl.textContent = "✅";
      if(countEl) countEl.innerHTML = '<span style="color: #2ebd59;">' + current + ' / ' + required + '</span>';
      el.style.opacity = "1";
    } else if(current > 0) {
      if(iconEl) iconEl.textContent = "⚠️";
      if(countEl) countEl.innerHTML = '<span style="color: #ffaa00;">' + current + ' / ' + required + '</span>';
      el.style.opacity = "1";
    } else {
      if(iconEl) iconEl.textContent = "❌";
      if(countEl) countEl.innerHTML = '<span style="color: #ff4d4d;">' + current + ' / ' + required + '</span>';
      el.style.opacity = "0.7";
    }
  }

  function loadSetIntoEditor(set) {
    state.editorCurrentSet = clone(set);
    state.editorOriginalSet = clone(set);
    var isDefault = set.id === "default";
    id("editorTitle").textContent = isDefault ? "Стандартный набор (Только чтение)" : "Редактирование набора";
    id("editorSetName").value = set.name;
    id("editorSetDesc").value = set.description;
    
    id("editorSetName").disabled = isDefault;
    id("editorSetDesc").disabled = isDefault;
    id("editorTextClassic").disabled = isDefault;
    id("editorTextReverse").disabled = isDefault;
    id("editorTextFinal").disabled = isDefault;
    
    id("editorSaveBtn").style.display = isDefault ? "none" : "block";
    if(els.editorDuplicateBtn) {
      els.editorDuplicateBtn.style.display = isDefault ? "block" : "none";
    }
    id("editorDeleteBtn").style.display = isDefault ? "none" : "block";
    id("editorAddMemeBtn").style.display = isDefault ? "none" : "block";

    id("editorTextClassic").value = (set.questions || []).join("\n");
    id("editorTextReverse").value = (set.reverseAnswers || []).join("\n");
    id("editorTextFinal").value = (set.finalQuestions || []).join("\n");
    
    renderEditorMemes(set.memes || [], isDefault);
    updateEditorChecklist();
    updateSelectSetButtonState();
  }

  function renderEditorMemes(memes, disabled) {
    var grid = id("editorMemesGrid");
    if(!grid) return;
    grid.innerHTML = (memes || []).map(function(m, idx){
      var deleteBtn = disabled ? "" : '<button class="delete-meme-btn" type="button" onclick="window.klppDeleteMeme(' + idx + ')">×</button>';
      var disabledAttr = disabled ? " disabled" : "";
      var uploadBtn = disabled ? "" : '<button type="button" class="meme-upload-btn" onclick="window.klppUploadMemeImage(' + idx + ')" style="font-size:11px; font-weight:900; padding:6px 10px; border:2px solid #111; border-radius:10px; background:#ffd93d; color:#111; cursor:pointer; text-transform:uppercase;">📁 Загрузить файл</button>';
      return '<div class="editor-meme-card" data-index="' + idx + '">' +
        deleteBtn +
        '<img class="meme-preview" src="' + escapeHtml(m.url) + '" onerror="this.src=\'data:image/svg+xml;utf8,<svg viewBox=\\\'0 0 100 100\\\' xmlns=\\\'http://www.w3.org/2000/svg\\\'> <rect width=\\\'100\\\' height=\\\'100\\\' fill=\\\'%23eee\\\'/> <text x=\\\'50%\\\' y=\\\'50%\\\' dominant-baseline=\\\'middle\\\' text-anchor=\\\'middle\\\' font-size=\\\'10\\\' fill=\\\'%23999\\\'>Ошибка загрузки</text></svg>\'">' +
        '<label style="display:grid; gap:4px; font-size:11px; text-transform:uppercase; font-weight:900; text-align:left;">Название' +
          '<input type="text" class="meme-name-input" value="' + escapeHtml(m.name) + '" oninput="window.klppUpdateMeme(' + idx + ', \'name\', this.value)"' + disabledAttr + '>' +
        '</label>' +
        '<label style="display:grid; gap:4px; font-size:11px; text-transform:uppercase; font-weight:900; text-align:left;">Ссылка на картинку' +
          '<input type="text" class="meme-url-input" value="' + escapeHtml(m.url) + '" oninput="window.klppUpdateMeme(' + idx + ', \'url\', this.value)"' + disabledAttr + '>' +
        '</label>' +
        uploadBtn +
      '</div>';
    }).join("");
  }

  window.klppDeleteMeme = function(idx) {
    if(!state.editorCurrentSet) return;
    state.editorCurrentSet.memes.splice(idx, 1);
    renderEditorMemes(state.editorCurrentSet.memes, state.editorCurrentSet.id === "default");
    updateEditorChecklist();
  };
  
  window.klppUpdateMeme = function(idx, field, value) {
    if(!state.editorCurrentSet || !state.editorCurrentSet.memes[idx]) return;
    state.editorCurrentSet.memes[idx][field] = value;
    if(field === "url") {
      var card = document.querySelector('.editor-meme-card[data-index="' + idx + '"]');
      if(card) {
        var img = card.querySelector('.meme-preview');
        if(img) img.src = value;
      }
    }
  };

  // Image upload helpers
  var MEME_MAX_WIDTH = 1200;
  var MEME_MAX_HEIGHT = 1200;
  var MEME_JPEG_QUALITY = 0.85;

  function compressImageToJpegBase64(file, callback) {
    var reader = new FileReader();
    reader.onload = function(e) {
      var img = new Image();
      img.onload = function() {
        var w = img.width;
        var h = img.height;
        if(w > MEME_MAX_WIDTH || h > MEME_MAX_HEIGHT) {
          var ratio = Math.min(MEME_MAX_WIDTH / w, MEME_MAX_HEIGHT / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        var canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        var jpegData = canvas.toDataURL("image/jpeg", MEME_JPEG_QUALITY);
        callback(null, jpegData);
      };
      img.onerror = function() {
        callback(new Error("Не удалось прочитать изображение"));
      };
      img.src = e.target.result;
    };
    reader.onerror = function() {
      callback(new Error("Ошибка чтения файла"));
    };
    reader.readAsDataURL(file);
  }

  async function uploadMemeImage(file) {
    return new Promise(function(resolve, reject) {
      compressImageToJpegBase64(file, async function(err, jpegData) {
        if(err) { reject(err); return; }
        try {
          var res = await api("/api/klpp/upload-meme", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ data: jpegData })
          });
          if(res.url) {
            resolve(res.url);
          } else {
            reject(new Error(res.error || "Ошибка загрузки"));
          }
        } catch(e) {
          reject(e);
        }
      });
    });
  }

  window.klppUploadMemeImage = function(idx) {
    if(!state.editorCurrentSet || !state.editorCurrentSet.memes[idx]) return;
    var input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async function() {
      var file = input.files[0];
      if(!file) return;
      if(file.size > 10 * 1024 * 1024) {
        alert("Файл слишком большой (макс. 10MB). Пожалуйста, выберите файл меньшего размера.");
        return;
      }
      var card = document.querySelector('.editor-meme-card[data-index="' + idx + '"]');
      var btn = card ? card.querySelector('.meme-upload-btn') : null;
      if(btn) { btn.textContent = "🔄 Загрузка..."; btn.disabled = true; }
      try {
        var url = await uploadMemeImage(file);
        state.editorCurrentSet.memes[idx].url = url;
        renderEditorMemes(state.editorCurrentSet.memes, state.editorCurrentSet.id === "default");
        id("editorStatusText").textContent = "Изображение загружено!";
        setTimeout(function(){ id("editorStatusText").textContent = ""; }, 2500);
      } catch(e) {
        alert("Ошибка загрузки: " + e.message);
        if(btn) { btn.textContent = "📁 Загрузить файл"; btn.disabled = false; }
      }
    };
    input.click();
  };

  function editorAddMeme() {
    if(!state.editorCurrentSet) return;
    state.editorCurrentSet.memes = state.editorCurrentSet.memes || [];
    var input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async function() {
      var file = input.files[0];
      if(!file) return;
      if(file.size > 10 * 1024 * 1024) {
        alert("Файл слишком большой (макс. 10MB).");
        return;
      }
      id("editorStatusText").textContent = "Загрузка картинки...";
      try {
        var url = await uploadMemeImage(file);
        var name = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ") || "Новый шаблон";
        state.editorCurrentSet.memes.push({ name: name, url: url });
        renderEditorMemes(state.editorCurrentSet.memes, state.editorCurrentSet.id === "default");
        updateEditorChecklist();
        id("editorStatusText").textContent = "Мем-шаблон добавлен!";
        setTimeout(function(){ id("editorStatusText").textContent = ""; }, 2500);
      } catch(e) {
        alert("Ошибка загрузки: " + e.message);
        id("editorStatusText").textContent = "Ошибка";
      }
    };
    input.click();
  }

  function collectSetFromEditor() {
    var set = compileCurrentSet();
    if(!set) return null;
    if(!set.name) {
      alert("Название набора обязательно!");
      return null;
    }
    return set;
  }

  async function saveEditorSet() {
    var set = collectSetFromEditor();
    if(!set) return;

    var classicCount = (set.questions || []).length;
    var reverseCount = (set.reverseAnswers || []).length;
    var finalCount = (set.finalQuestions || []).length;
    var memesCount = (set.memes || []).length;
    
    if(classicCount < 6 || reverseCount < 6 || finalCount < 2 || memesCount < 2) {
      if(!confirm("Внимание: Набор содержит меньше рекомендуемого минимума вопросов/мемов (требуется: 6 обычных, 6 реверсивных, 2 финальных, 2 мема). Для пустых/недостающих раундов игра автоматически использует стандартные вопросы. Сохранить всё равно?")) {
        return;
      }
    }

    try {
      id("editorStatusText").textContent = "Сохранение...";
      var res = await api("/api/klpp/question-sets", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(set)
      });
      state.editorActiveSetId = res.questionSet.id;
      id("editorStatusText").textContent = "Сохранено!";
      setTimeout(function(){ id("editorStatusText").textContent = ""; }, 2000);
      await loadEditorData();
    } catch(e) {
      alert("Ошибка сохранения: " + e.message);
      id("editorStatusText").textContent = "Ошибка";
    }
  }

  async function deleteEditorSet() {
    if(!state.editorActiveSetId || state.editorActiveSetId === "default") {
      if(state.editorActiveSetId === "") {
        if(confirm("Отменить создание нового набора? Все изменения будут потеряны.")) {
          state.editorActiveSetId = "default";
          await loadEditorData();
        }
      }
      return;
    }
    if(!confirm("Вы уверены, что хотите удалить этот набор? Это действие нельзя отменить.")) return;
    try {
      id("editorStatusText").textContent = "Удаление...";
      await api("/api/klpp/question-sets/" + encodeURIComponent(state.editorActiveSetId), {
        method: "DELETE"
      });
      state.editorActiveSetId = "default";
      id("editorStatusText").textContent = "Удалено!";
      setTimeout(function(){ id("editorStatusText").textContent = ""; }, 2000);
      await loadEditorData();
    } catch(e) {
      alert("Ошибка удаления: " + e.message);
      id("editorStatusText").textContent = "Ошибка";
    }
  }

  function createNewSet() {
    if(isEditorDirty()) {
      if(!confirm("У вас есть несохраненные изменения. Создать новый набор без сохранения текущего?")) return;
    }
    var newSet = {
      id: "",
      name: "Новый набор вопросов",
      description: "Созданный пользователем набор",
      questions: [
        "Что скрывают ученые на обратной стороне Луны?",
        "Самая нелепая причина опоздать на свидание."
      ],
      reverseAnswers: [
        "Кусок сыра и старая батарейка.",
        "Оно само лопнуло, честно!"
      ],
      finalQuestions: [
        "Худшее оправдание для опоздания на собственную свадьбу.",
        "Самый глупый вопрос на собеседовании."
      ],
      memes: [
        { name: "Джек-рассел терьер", url: "/klpp-assets/memes/dog.png" }
      ]
    };
    state.editorActiveSetId = "";
    loadSetIntoEditor(newSet);
    id("editorSetName").focus();
  }

  function duplicateEditorSet() {
    if(!state.editorCurrentSet) return;
    if(isEditorDirty()) {
      if(!confirm("У вас есть несохраненные изменения. Создать копию без сохранения текущего?")) return;
    }
    var copy = clone(state.editorCurrentSet);
    copy.id = "";
    copy.name = copy.name + " (Копия)";
    state.editorActiveSetId = "";
    loadSetIntoEditor(copy);
    id("editorSetName").focus();
  }

  async function testEditorSet() {
    if(isEditorDirty()) {
      if(!confirm("Для тестирования набора его необходимо сохранить. Сохранить и запустить тест?")) return;
      await saveEditorSet();
    }
    
    var setId = state.editorActiveSetId;
    if(!setId) {
      alert("Сначала сохраните набор!");
      return;
    }
    
    try {
      id("editorStatusText").textContent = "Запуск теста...";
      var res = await api("/api/klpp/dev/start", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          botCount: 4,
          settings: {
            questionSetId: setId,
            roundCount: 2,
            modifierMode: "off"
          }
        })
      });
      
      state.roomId = res.room.id;
      state.hostKey = res.hostKey;
      localStorage.setItem("klppHostKey_" + res.room.id, res.hostKey);
      state.devMode = true;
      navigate("host", res.room.id);
    } catch(e) {
      alert("Ошибка запуска теста: " + e.message);
      id("editorStatusText").textContent = "Ошибка";
    }
  }

  function exportEditorSet() {
    var set = collectSetFromEditor();
    if(!set) return;
    var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(set, null, 2));
    var dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", "klpp_set_" + set.name.replace(/[^a-zA-Z0-9а-яА-Я]/g, "_") + ".json");
    dlAnchorElem.click();
  }

  function importEditorSet(event) {
    var file = event.target.files[0];
    if(!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var set = JSON.parse(e.target.result);
        if(!set.name) {
          alert("Некорректный JSON: отсутствует название набора (name).");
          return;
        }
        
        var isOverwritingDefault = (state.editorActiveSetId === "default");
        if(isOverwritingDefault) {
          alert("Стандартный набор нельзя перезаписать. Импортировано как новый набор.");
          set.id = "";
          state.editorActiveSetId = "";
        } else {
          if(confirm("Импортировать как новый набор? (Иначе будет перезаписан текущий активный набор)")) {
            set.id = "";
            state.editorActiveSetId = "";
          } else {
            set.id = state.editorActiveSetId;
          }
        }
        
        loadSetIntoEditor(set);
        id("editorStatusText").textContent = "JSON импортирован! Нажмите кнопку Сохранить.";
        updateEditorChecklist();
      } catch(err) {
        alert("Ошибка разбора JSON: " + err.message);
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function renderMemeContainerHtml(imageUrl, topText, bottomText) {
    return '<div class="klpp-meme-container">' +
      '<img class="klpp-meme-image" src="' + escapeHtml(imageUrl) + '">' +
      (topText ? '<div class="klpp-meme-text top">' + escapeHtml(topText.toUpperCase()) + '</div>' : '') +
      (bottomText ? '<div class="klpp-meme-text bottom">' + escapeHtml(bottomText.toUpperCase()) + '</div>' : '') +
    '</div>';
  }

  function escapeHtml(value){
    return String(value == null ? "" : value).replace(/[&<>"']/g, function(char){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char];
    });
  }

  function clone(obj) {
    if (obj === undefined) return undefined;
    return JSON.parse(JSON.stringify(obj));
  }
})();
