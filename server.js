const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC_URL = normalizePublicUrl(process.env.PUBLIC_URL || process.env.BASE_URL || process.env.RENDER_EXTERNAL_URL || "");
const TRUST_PROXY = process.env.TRUST_PROXY !== "false";
const PUBLIC_DIR = path.join(__dirname, "public");

const klppRooms = new Map();

const KLPP_STARTER_QUESTIONS = [
  "Самая странная вещь, которую можно услышать в школьной столовой.",
  "Худшее имя для супергероя, который спасает мир от скуки.",
  "Что точно не стоит говорить, если тебя поймали спящим на работе?",
  "Неудачный слоган для очень дешёвого ресторана.",
  "Самая подозрительная надпись на двери лифта.",
  "Чем можно объяснить, что кот опять смотрит в пустой угол?",
  "Худший подарок, который можно получить на первом свидании.",
  "Что мог бы кричать очень уставший петух в 6 утра?",
  "Новый вид спорта, который никто не просил, но он уже есть.",
  "Фраза, после которой становится ясно, что ремонт пошёл не по плану.",
  "Чего точно не должно быть в гороскопе на сегодня?",
  "Самый плохой пароль в мире.",
  "Что можно случайно сказать вместо свадебной клятвы?",
  "Неудачное название для детского лагеря.",
  "Что скажет холодильник, если наконец научится разговаривать?",
  "Самая нелепая причина опоздать на онлайн-созвон.",
  "Название для магазина, в который страшно заходить, но очень хочется.",
  "Что мог бы написать динозавр в резюме?",
  "Самое неубедительное алиби в истории человечества.",
  "Надпись на упаковке, после которой ты точно это не купишь.",
  "Самое странное правило, которое могла бы ввести школьная учительница.",
  "Чем можно случайно напугать соседей в 3 часа ночи.",
  "Какой суперсилы точно никто не хотел бы.",
  "Самое нелепое, что можно купить за последние деньги.",
  "Что должен ответить таксист, когда вы спрашиваете «мы скоро?»",
  "Самая дурацкая причина бросить курить.",
  "Как мог бы выглядеть худший тимбилдинг в истории.",
  "Что нельзя писать в новогоднем письме Деду Морозу взрослому.",
  "Самый плохой подарок коллеге, которого ты ненавидишь.",
  "Что точно не стоит говорить родителям невесты на первой встрече.",
  "Самый бесполезный совет от старшего поколения.",
  "Что мог бы сказать твой телефон, если бы умел жаловаться.",
  "Самая странная татуировка, которую можно сделать в трезвом виде.",
  "Что точно не должно быть на меню в ресторане высокой кухни.",
  "Самое смешное оправдание, чтобы не идти на свадьбу друга.",
  "Чему можно учить детей, чтобы их потом ненавидели взрослые.",
  "Что мог бы кричать капитан тонущего корабля, если бы был интровертом.",
  "Какое имя точно не стоит давать своей собаке.",
  "Самая неуместная фраза в момент признания в любви.",
  "Что мог бы написать любитель кошек в дневнике после неудачного дня.",
  "Самый странный экспонат, который можно встретить в современном музее.",
  "Какое название точно не подойдёт для энергетика.",
  "Что бы сказала твоя мама, увидев твой первый набросок в детском саду.",
  "Самая бесполезная функция нового смартфона.",
  "Что мог бы написать утюг, если бы вёл блог.",
  "Самая дурацкая идея для стартапа на миллион долларов.",
  "Что точно не стоит говорить полицейскому, когда он остановил.",
  "Самая странная вещь, которую можно увидеть в чужом холодильнике.",
  "Какой звук точно не должна издавать машина.",
  "Что мог бы написать кофе на чашке, если бы умел отвечать.",
  "Самая позорная причина уволиться с первой работы.",
  "Что бы сказал твой холодильник, открывшийся ночью.",
  "Худший слоган для предвыборной кампании в детском саду.",
  "Самое идиотское изобретение для кота.",
  "Чем можно объяснить странный запах в маршрутке.",
  "Какое последнее слово точно не стоит говорить экзаменатору.",
  "Самый нелепый повод записаться к психотерапевту.",
  "Что точно не должно быть напечатано на футболке учителя.",
  "Самая странная вещь, которую можно найти на даче у бабушки.",
  "Худший ник для онлайн-знакомств.",
  "Какой тост точно не стоит произносить на дне рождения тёщи.",
  "Самое бесполезное приложение, которое всё равно скачали миллионы.",
  "Чем заменить будильник, если хочешь возненавидеть утро.",
  "Какое объявление точно не приведёт клиентов в стоматологию.",
  "Самая странная просьба коллеги в Slack в 3 часа ночи.",
  "Что нельзя сказать первому свиданию, заказав сложное блюдо.",
  "Самый нелепый сценарий новогоднего корпоратива.",
  "Что бы сказал твой кот, если бы вёл подкаст про людей.",
  "Какая фамилия точно не подойдёт для главного героя боевика.",
  "Самая странная вещь, которую можно купить в дьюти-фри.",
  "Что точно не должно быть в инструкции к пылесосу.",
  "Самый плохой совет, который ты слышал от соседа сверху.",
  "Какая поза для йоги точно не выйдет в инстаграм-альбом.",
  "Что бы написал в дневнике человек, переживший знакомство с тёщей.",
  "Самое неуместное напоминание от Google Calendar.",
  "Какая фраза точно не успокоит плачущего ребёнка в самолёте.",
  "Самый странный товар, который рекламирует звезда из 90-х.",
  "Что нельзя кричать на стадионе во время важного матча.",
  "Самая идиотская причина, из-за которой опоздал на собеседование.",
  "Что мог бы сказать робот-пылесос, застрявший под диваном.",
  "Самая странная татуировка, которую ты заметил у учителя.",
  "Худший слоган для службы доставки еды.",
  "Какое сообщение точно не пишут бывшему в три часа ночи.",
  "Самая нелепая просьба от пассажира таксисту.",
  "Что точно не должно быть в подарочном наборе на 8 марта.",
  "Самый странный лот на аукционе б/у вещей.",
  "Какая фраза точно не подойдёт для пожелания на свадьбу.",
  "Самая дурацкая причина блокировки в социальной сети.",
  "Что мог бы написать в резюме человек без скиллов.",
  "Самая странная фраза, услышанная в общественной бане.",
  "Какой совет точно не приведёт к успеху в стартапе.",
  "Самое нелепое название книги по самопомощи.",
  "Что точно не стоит говорить, когда ты пришёл занять денег.",
  "Самая странная вещь, которую можно увидеть в окне напротив.",
  "Худший комментарий под чужой фотографией с пляжа.",
  "Самый нелепый способ объяснить, почему ты опоздал на свидание.",
  "Что бы написал на надгробии человек с чёрным юмором.",
  "Самая идиотская причина, из-за которой соседи вызвали полицию.",
  "Какая фраза точно не успокоит таможенника.",
  "Самый странный совет от твоей бабушки в детстве.",
  "Что мог бы сказать гриб, если бы его собирали.",
  "Самое неловкое сообщение, отправленное в общий чат вместо личного.",
  "Какая мелодия точно не подходит в качестве рингтона на похороны.",
  "Самое странное правило в подъезде многоквартирного дома.",
  "Что точно не должно быть в гимне вашей компании.",
  "Самый плохой выбор фильма для первого свидания.",
  "Какой пункт точно не входит в идеальное утро.",
  "Самое странное условие в брачном договоре.",
  "Что нельзя сделать на видеосвязи с начальником.",
  "Самая глупая причина пожаловаться в книгу жалоб.",
  "Что мог бы написать в отзыве человек, проспавший весь сеанс.",
  "Самая дурацкая идея для тематической вечеринки.",
  "Какой вопрос точно не задают на собеседовании в Google."
];

// Pool of ready-made punchlines for reverse_round modifier.
// Players see the answer and have to write a funny question for it.
const KLPP_REVERSE_ANSWERS = [
  "Потому что он был на диете.",
  "Три зубочистки и надежда.",
  "Оно само началось в 3 часа ночи.",
  "Дедушка сказал, что так надо.",
  "Это был кот.",
  "Просто добавь воды.",
  "Именно поэтому я и ушёл из цирка.",
  "Никто не виноват — просто пятница.",
  "Я просто хотел тост.",
  "Официально это называется 'инновация'.",
  "Это была не моя корова.",
  "Восемь лет психологии не подготовили меня к этому.",
  "Он плакал, но продолжал.",
  "Технически это не запрещено.",
  "Оказалось, это была не дверь.",
  "Я думал, так у всех.",
  "Это была последняя банка сгущёнки.",
  "Справка от врача прилагается.",
  "Так всегда заканчиваются хорошие истории.",
  "Потому что гравитация — это условность.",
  "Сосед тоже так думал.",
  "И тут выяснилось, что кнопка лифта не работает.",
  "Главное — уверенность в голосе.",
  "Ещё три минуты — и был бы рекорд.",
  "Это была чужая собака.",
  "Таможня не одобрила.",
  "Позвоните маме — она знает.",
  "В инструкции этого не было.",
  "Я больше так не буду.",
  "Наука пока не объяснила."
];

const DATA_DIR = path.join(__dirname, "data");
const QUESTION_SETS_FILE = path.join(DATA_DIR, "question_sets.json");

// Default memes to include in standard set
const KLPP_DEFAULT_MEMES = [
  { name: "Джек-рассел терьер", url: "/klpp-assets/memes/dog.png" },
  { name: "Удивлённый рыжий кот", url: "/klpp-assets/memes/cat.png" }
];

// Epically funny prompts for final round
const KLPP_STARTER_FINAL_QUESTIONS = [
  "Самое неподходящее место для романтического признания.",
  "Что кричит водитель маршрутки, пролетая сквозь пространственно-временной портал?",
  "Худший способ потратить миллиард долларов за один день.",
  "Название для автобиографии человека, который совершил все ошибки в жизни.",
  "Самая глупая суперсила для суперзлодея.",
  "Что на самом деле написано мелким шрифтом в пользовательском соглашении?",
  "Какая фраза точно разрушит любое собеседование в первые 5 секунд?",
  "Чего бы вы никогда не хотели увидеть в качестве начинки для пирога?",
  "Самый нелепый повод начать Третью мировую войну.",
  "Что скажет инопланетянин, если его первым контактом на Земле станет гопник?",
  "Какая реклама на билборде точно заставит водителей остановиться посреди трассы?",
  "Идеальное название для фильма ужасов про работу в офисе.",
  "Что снится вашему коту, когда он дёргает лапками во сне?",
  "Самый дурацкий совет от бизнес-коуча в соцсетях.",
  "Что кричит парашютист, если понял, что забыл надеть парашют, но хочет казаться крутым?"
];

function initQuestionSetsDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  let sets = [];
  if (fs.existsSync(QUESTION_SETS_FILE)) {
    try {
      sets = JSON.parse(fs.readFileSync(QUESTION_SETS_FILE, "utf8"));
    } catch (e) {
      console.error("Error reading question sets, recreating...", e);
    }
  }
  let defaultSet = sets.find(s => s.id === "default");
  if (!defaultSet) {
    defaultSet = {
      id: "default",
      name: "Стандартный набор",
      description: "Оригинальные вопросы, ответы для реверса, финальные вопросы и шаблоны мемов.",
      questions: KLPP_STARTER_QUESTIONS,
      reverseAnswers: KLPP_REVERSE_ANSWERS,
      finalQuestions: KLPP_STARTER_FINAL_QUESTIONS,
      memes: KLPP_DEFAULT_MEMES
    };
    sets.unshift(defaultSet);
    fs.writeFileSync(QUESTION_SETS_FILE, JSON.stringify(sets, null, 2), "utf8");
  }
  return sets;
}

function loadQuestionSets() {
  return initQuestionSetsDb();
}

function saveQuestionSet(set) {
  const sets = loadQuestionSets();
  if (!set.id) {
    set.id = "set_" + Math.random().toString(36).slice(2, 12);
  }
  set.questions = Array.isArray(set.questions) ? set.questions.filter(q => typeof q === "string" && q.trim()) : [];
  set.reverseAnswers = Array.isArray(set.reverseAnswers) ? set.reverseAnswers.filter(a => typeof a === "string" && a.trim()) : [];
  set.finalQuestions = Array.isArray(set.finalQuestions) ? set.finalQuestions.filter(q => typeof q === "string" && q.trim()) : [];
  set.memes = Array.isArray(set.memes) ? set.memes.filter(m => m && typeof m.name === "string" && typeof m.url === "string") : [];

  const index = sets.findIndex(s => s.id === set.id);
  if (index !== -1) {
    if (set.id === "default") {
      set.name = "Стандартный набор";
      set.description = "Оригинальные вопросы, ответы для реверса, финальные вопросы и шаблоны мемов.";
    }
    sets[index] = set;
  } else {
    sets.push(set);
  }
  fs.writeFileSync(QUESTION_SETS_FILE, JSON.stringify(sets, null, 2), "utf8");
  return set;
}

function deleteQuestionSet(id) {
  if (id === "default") return false;
  const sets = loadQuestionSets();
  const index = sets.findIndex(s => s.id === id);
  if (index === -1) return false;
  sets.splice(index, 1);
  fs.writeFileSync(QUESTION_SETS_FILE, JSON.stringify(sets, null, 2), "utf8");
  return true;
}

initQuestionSetsDb();

// Grammar hint categories for blind_round. Each rule is a regex+label pair
// applied in order — first match wins. Hints are written so the player can
// guess the answer shape without seeing the actual question.
const KLPP_BLIND_HINT_RULES = [
  // PHRASES — things you SAY / SHOULDN'T say / write / shout
  { re: /\b(не\s+стоит|нельзя|не\s+надо|не\s+должен)\s+(сказать|говорить|кричать|произнес|написать|написа|пис)/, label: "ФРАЗА 💬 (что сказать?)" },
  { re: /\bчто\s+(мог[а-я]*|можно|нельзя|точно|бы)\s+(сказать|кричать|написать|произнес|ответ)/, label: "ФРАЗА 💬 (что сказать?)" },
  { re: /\b(тост|слоган|пожелание|клятв|алиби|оправдание|совет|комментарий|реплик|сообщение|надпись|объявление|отзыв)/, label: "ФРАЗА 💬 (что сказать или написать?)" },
  { re: /\bчто\s+(скажет|написал|напишет)/, label: "ФРАЗА 💬 (что сказать?)" },
  // NAMES & TITLES — слоганы, названия, имена, ники
  { re: /\b(название|нелепое\s+название|имя|ник|фамил[ия])\b/, label: "НАЗВАНИЕ 🏷️ (как назвать?)" },
  // PEOPLE — кто, личности
  { re: /\b(кто|чей|чьё|чья)\b/, label: "ЛИЧНОСТЬ 🙋 (кого?)" },
  { re: /\b(сосед|таксист|учитель|коллег|тёщ|родител|капитан|полицейск|инструктор|тренер|психотерапевт|стилист)/, label: "ЛИЧНОСТЬ 🙋 (кого?)" },
  // PLACES
  { re: /\b(где|куда|откуда|место|магазин|музей|лагерь|ресторан|кухн|столов|подъезд|маршрут|стадион|вечеринк|корпоратив)/, label: "МЕСТО 📍 (где?)" },
  // OBJECTS
  { re: /\b(подарок|вещь|предмет|товар|экспонат|татуировк|пароль|функция|меню|лот|приложение|изобретение|инструмент|подарочн|сценарий|идея)/, label: "ПРЕДМЕТ 📦 (что?)" },
  // ACTIONS
  { re: /\b(что\s+(делать|сделать)|сделать|сделал|изобрест|записаться|сходить|купить|съесть|включить)/, label: "ДЕЙСТВИЕ 🏃 (что сделать?)" },
  // REASONS / CAUSES
  { re: /\b(причина|повод|почему|зачем|из-за\s+чего|потому|объясн)/, label: "ПРИЧИНА 🤔 (почему?)" },
  // EVENTS
  { re: /\b(событие|правил|произош|случил|тимбилдинг|свидание|свадьб|новогодн)/, label: "СОБЫТИЕ ⚡ (что произошло?)" },
  // SOUND / NOISE
  { re: /\b(звук|мелоди|рингтон|пение|крик)/, label: "ЗВУК 🔊 (как звучит?)" }
];

const KLPP_BLIND_HINT_DEFAULT = "ОТВЕТ 🎯 (что-нибудь смешное)";

function klppBlindHintForQuestion(questionText){
  const t = String(questionText || "").toLowerCase();
  for(let i = 0; i < KLPP_BLIND_HINT_RULES.length; i += 1){
    if(KLPP_BLIND_HINT_RULES[i].re.test(t)) return KLPP_BLIND_HINT_RULES[i].label;
  }
  return KLPP_BLIND_HINT_DEFAULT;
}

function klppGetRoomQuestionSet(room) {
  const sets = loadQuestionSets();
  const set = sets.find(s => s.id === (room.settings && room.settings.questionSetId)) || sets.find(s => s.id === "default");
  return set;
}

function takeKlppReverseAnswers(room, count){
  const set = klppGetRoomQuestionSet(room);
  const pool = (set && set.reverseAnswers && set.reverseAnswers.length) ? set.reverseAnswers.slice() : KLPP_REVERSE_ANSWERS.slice();
  const used = room.reverseAnswerHistory || [];
  const unused = pool.filter(function(a){ return used.indexOf(a) === -1; });
  let source = unused.length >= count ? unused : unused.concat(pool.filter(function(a){ return unused.indexOf(a) === -1; }));
  const picked = shuffleKlpp(source).slice(0, count);
  if(!room.reverseAnswerHistory) room.reverseAnswerHistory = [];
  picked.forEach(function(a){ if(room.reverseAnswerHistory.indexOf(a) === -1) room.reverseAnswerHistory.push(a); });
  return picked;
}

const KLPP_DEFAULT_SETTINGS = Object.freeze({
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
});

const KLPP_ROUND_COUNT_PRESETS = [3, 5, 7];
const KLPP_ROUND_COUNT_MIN = 1;
const KLPP_ROUND_COUNT_MAX = 12;
const KLPP_QUESTIONS_PER_PLAYER_MIN = 1;
const KLPP_QUESTIONS_PER_PLAYER_MAX = 6;

function klppMinPlayersForSettings(settings){
  // Each player needs (questionsPerPlayer) distinct opponents in a round,
  // so min players is questionsPerPlayer + 1. Also keep an absolute floor of 3 for fun.
  const q = (settings && settings.questionsPerPlayer) || KLPP_DEFAULT_SETTINGS.questionsPerPlayer;
  return Math.max(3, q + 1);
}

const KLPP_LAUNCH_MS = 2400;
const KLPP_ROUND_INTRO_MS = 3200;
const KLPP_VOTE_REVEAL_MS = 2000;
const KLPP_VOTE_RESULT_MS = 3200;
const KLPP_ROUND_SCORE_MS = 5200;
const KLPP_NO_ANSWER_TEXT = "(НЕТ ОТВЕТА)";

function clone(value){
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function sendJson(res, statusCode, payload){
  res.writeHead(statusCode, {"Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store"});
  res.end(JSON.stringify(payload));
}

function parseBody(req){
  return new Promise(function(resolve, reject){
    let raw = "";
    req.on("data", function(chunk){
      raw += chunk;
      if(raw.length > 8 * 1024 * 1024){
        reject(new Error("Body too large"));
        req.destroy();
      }
    });
    req.on("end", function(){
      if(!raw){
        resolve({});
        return;
      }
      try{
        resolve(JSON.parse(raw));
      }catch(error){
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function contentType(filePath){
  const ext = path.extname(filePath).toLowerCase();
  switch(ext){
    case ".html": return "text/html; charset=utf-8";
    case ".js": return "application/javascript; charset=utf-8";
    case ".css": return "text/css; charset=utf-8";
    case ".json": return "application/json; charset=utf-8";
    case ".svg": return "image/svg+xml";
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".webp": return "image/webp";
    default: return "application/octet-stream";
  }
}

function sanitizeKlppRoomId(raw){
  return String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

function randomKlppRoomId(){
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for(let i = 0; i < 4; i += 1){
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function randomKlppHostKey(){
  return Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 8);
}

function blankKlppSettings(){
  return clone(KLPP_DEFAULT_SETTINGS);
}

function sanitizeKlppSettings(input){
  const raw = Object.assign({}, KLPP_DEFAULT_SETTINGS, clone(input || {}));
  const modifierMode = ["off", "fixed", "random"].indexOf(raw.modifierMode) !== -1 ? raw.modifierMode : "off";
  let selectedModifiers = Array.isArray(raw.selectedModifiers)
    ? raw.selectedModifiers.filter(function(id){ return typeof id === "string" && id.length > 0 && id.length < 40; }).slice(0, 16)
    : [];
  // leader_abilities & ability_party are mutually exclusive — a round can give
  // abilities to the leader OR throw an ability party, not both. If the host
  // accidentally selected both, keep whichever was listed first.
  const idxLeader = selectedModifiers.indexOf("leader_abilities");
  const idxParty  = selectedModifiers.indexOf("ability_party");
  if(idxLeader !== -1 && idxParty !== -1){
    const drop = idxLeader < idxParty ? "ability_party" : "leader_abilities";
    selectedModifiers = selectedModifiers.filter(function(id){ return id !== drop; });
  }
  const finalRoundType = ["final_lash", "meme_round", "random"].indexOf(raw.finalRoundType) !== -1 ? raw.finalRoundType : "final_lash";
  const questionSetId = typeof raw.questionSetId === "string" ? raw.questionSetId : "default";

  return {
    answerSeconds: Math.max(20, Math.min(180, Number(raw.answerSeconds) || KLPP_DEFAULT_SETTINGS.answerSeconds)),
    voteSeconds: Math.max(15, Math.min(120, Number(raw.voteSeconds) || KLPP_DEFAULT_SETTINGS.voteSeconds)),
    selfVotingEnabled: Boolean(raw.selfVotingEnabled),
    anonymousAnswers: Boolean(raw.anonymousAnswers),
    roundCount: Math.max(KLPP_ROUND_COUNT_MIN, Math.min(KLPP_ROUND_COUNT_MAX, Number(raw.roundCount) || KLPP_DEFAULT_SETTINGS.roundCount)),
    doublePointsLastRound: Boolean(raw.doublePointsLastRound),
    modifierMode: modifierMode,
    selectedModifiers: selectedModifiers,
    questionsPerPlayer: Math.max(KLPP_QUESTIONS_PER_PLAYER_MIN, Math.min(KLPP_QUESTIONS_PER_PLAYER_MAX, Number(raw.questionsPerPlayer) || KLPP_DEFAULT_SETTINGS.questionsPerPlayer)),
    questionSetId: questionSetId,
    finalRoundType: finalRoundType
  };
}

function ensureKlppRoom(room){
  if(!room.settings) room.settings = blankKlppSettings();
  room.settings = sanitizeKlppSettings(room.settings);
  if(!room.scoreboard) room.scoreboard = {};
  if(!room.history) room.history = [];
  if(!room.currentRound) room.currentRound = null;
  if(!room.questionHistory) room.questionHistory = [];
  if(!room.pairHistory) room.pairHistory = [];
  if(typeof room.roundIndex !== "number") room.roundIndex = 0;
  if(typeof room.phaseStartedAt !== "number") room.phaseStartedAt = 0;
  if(!room.lastRoundResult) room.lastRoundResult = null;
  if(!room.pauseMeta) room.pauseMeta = null;
  if(typeof room.endedWithoutScore !== "boolean") room.endedWithoutScore = false;
  if(!room.combo) room.combo = {};
  if(!room.playerHeldAbilities) room.playerHeldAbilities = {};
  if(!room.playerActiveAbilities) room.playerActiveAbilities = {};
  return room;
}

// =========================================================================
// MODIFIER SYSTEM
// =========================================================================
// Each modifier defines: id, display meta, requirements, and optional hooks.
// Hooks (all optional):
//   validateAnswer(text, ctx) -> {ok:bool, error?:string}
//   transformScore({leftPercent, rightPercent, leftBase, rightBase, room, vote}) -> {left, right}
//   onRoundEnd(room, roundResult)        // mutate room.combo etc.
// Anything currently marked `notImplemented:true` is a stub for the UI to list
// it but the game refuses to activate it (see klppValidateModifierList).
// =========================================================================
const KLPP_MODIFIERS = {
  one_word: {
    id: "one_word",
    name: "Одно слово",
    icon: "💬",
    description: "Можно написать только одно слово",
    minPlayers: 2,
    validateAnswer: function(text){
      const trimmed = String(text || "").trim();
      const tokens = trimmed ? trimmed.split(/\s+/) : [];
      if(tokens.length > 1){
        return {ok: false, error: "Только одно слово"};
      }
      return {ok: true};
    }
  },
  reverse_scoring: {
    id: "reverse_scoring",
    name: "Очки худшему",
    icon: "🔄",
    description: "Очки получает худший ответ",
    minPlayers: 2,
    transformScore: function(ctx){
      // Swap base scores. Missing answers (auto-100/0) also swap, which is correct:
      // if your opponent did not answer, you "win" by default at 0, so they take all.
      return {left: ctx.rightBase, right: ctx.leftBase};
    }
  },
  steal: {
    id: "steal",
    name: "Грабёж",
    icon: "🦹",
    description: "Победитель крадёт очки у соперника, чем убедительнее победа — тем больше",
    minPlayers: 2,
    skipInRound1: true,            // never appears in round 1 (nothing to steal yet)
    transformScore: function(ctx){
      // Tie — no steal.
      if(ctx.leftPercent === ctx.rightPercent) return {left: ctx.leftBase, right: ctx.rightBase};
      const winnerSide = ctx.leftPercent > ctx.rightPercent ? "left" : "right";
      const loserSide  = winnerSide === "left" ? "right" : "left";
      const winnerId   = ctx.vote[winnerSide + "ClientId"];
      const loserId    = ctx.vote[loserSide + "ClientId"];
      const loserBank  = ctx.room.scoreboard[loserId] || 0;
      // Nothing to steal if opponent has 0 points yet — leave base deltas alone.
      if(loserBank <= 0) return {left: ctx.leftBase, right: ctx.rightBase};
      // Decisiveness: 51% → tiny steal, 100% → up to 30% of loser's bank.
      // (winnerPct - 50) / 50 = 0..1, multiplied by max ratio.
      const winnerPct = winnerSide === "left" ? ctx.leftPercent : ctx.rightPercent;
      const decisiveness = Math.max(0, (winnerPct - 50) / 50);
      const stealRatio  = decisiveness * 0.3;
      const stolen      = Math.round(loserBank * stealRatio);
      return {
        left:  winnerSide === "left"  ? ctx.leftBase + stolen  : ctx.leftBase - stolen,
        right: winnerSide === "right" ? ctx.rightBase + stolen : ctx.rightBase - stolen,
        stealAmount: stolen,
        stealWinnerId: winnerId,
        stealLoserId: loserId
      };
    }
  },
  combo: {
    id: "combo",
    name: "Комбо",
    icon: "🔥",
    description: "Победы подряд дают бонус +25% за каждую серию",
    minPlayers: 2,
    transformScore: function(ctx){
      const combo = ctx.room.combo || {};
      const leftStreak = Number(combo[ctx.vote.leftClientId] || 0);
      const rightStreak = Number(combo[ctx.vote.rightClientId] || 0);
      const leftMult = 1 + Math.max(0, leftStreak) * 0.25;
      const rightMult = 1 + Math.max(0, rightStreak) * 0.25;
      return {
        left: Math.round(ctx.leftBase * leftMult),
        right: Math.round(ctx.rightBase * rightMult)
      };
    },
    onVoteResolved: function(room, vote, result){
      room.combo = room.combo || {};
      if(result.leftPercent > result.rightPercent){
        room.combo[vote.leftClientId] = (room.combo[vote.leftClientId] || 0) + 1;
        room.combo[vote.rightClientId] = 0;
      } else if(result.rightPercent > result.leftPercent){
        room.combo[vote.rightClientId] = (room.combo[vote.rightClientId] || 0) + 1;
        room.combo[vote.leftClientId] = 0;
      }
    }
  },
  reverse_round: {id:"reverse_round", name:"Раунд наоборот", icon:"❓", description:"Видишь только ответ — придумай к нему вопрос!", minPlayers:2},
  blind_round: {id:"blind_round", name:"Слепой раунд", icon:"🙈", description:"Виден только тип ответа, но не сам вопрос", minPlayers:2},
  drunk_mode: {id:"drunk_mode", name:"Пьяный режим", icon:"🍺", description:"Интерфейс начинает шататься и плыть", minPlayers:2},
  ability_party: {id:"ability_party", name:"Вечеринка способностей", icon:"🎉", description:"Каждый игрок может выбрать способность для себя в начале раунда", minPlayers:3},
  leader_abilities: {id:"leader_abilities", name:"Способности лидера", icon:"👑", description:"Лидер получает способности после раунда", minPlayers:3}
};

function klppListAvailableModifiers(){
  return Object.keys(KLPP_MODIFIERS).map(function(id){
    const def = KLPP_MODIFIERS[id];
    return {
      id: def.id,
      name: def.name,
      icon: def.icon,
      description: def.description || "",
      minPlayers: def.minPlayers || 2,
      notImplemented: Boolean(def.notImplemented)
    };
  });
}

function klppValidateModifierList(ids, playerCount){
  return (ids || []).filter(function(id){
    const def = KLPP_MODIFIERS[id];
    return def && !def.notImplemented && playerCount >= (def.minPlayers || 2);
  });
}

function klppAssignModifiersToRound(room){
  const settings = room.settings;
  if(!settings || settings.modifierMode === "off") return [];
  const playerCount = (room.players || []).length;
  let pool = klppValidateModifierList(settings.selectedModifiers, playerCount);
  if(!pool.length) return [];
  // Drop modifiers that don't make sense in round 1 (e.g. steal — nothing
  // to steal yet because every player still has 0 points).
  const roundNumber = (room.roundIndex || 0) + 1;
  if(roundNumber <= 1){
    pool = pool.filter(function(id){
      const def = KLPP_MODIFIERS[id];
      return !(def && def.skipInRound1);
    });
    if(!pool.length) return [];
  }
  if(settings.modifierMode === "fixed") return pool.slice();
  // random mode: 1 random per round
  return [pool[Math.floor(Math.random() * pool.length)]];
}

function klppActiveModifiersForRound(room){
  const cur = room.currentRound;
  if(!cur || !Array.isArray(cur.modifiers)) return [];
  return cur.modifiers.map(function(id){
    const def = KLPP_MODIFIERS[id];
    return def ? {id: def.id, name: def.name, icon: def.icon, description: def.description || ""} : null;
  }).filter(Boolean);
}

function klppRoundHasModifier(room, id){
  const cur = room.currentRound;
  return Boolean(cur && Array.isArray(cur.modifiers) && cur.modifiers.indexOf(id) !== -1);
}

function klppRunModifierHook(room, hookName, payload){
  const cur = room.currentRound;
  if(!cur || !Array.isArray(cur.modifiers)) return payload;
  let result = payload;
  cur.modifiers.forEach(function(id){
    const def = KLPP_MODIFIERS[id];
    if(def && typeof def[hookName] === "function"){
      const next = def[hookName](result || {}, room);
      if(next){
        if(hookName === "transformScore"){
          result.leftBase = typeof next.left === "number" ? next.left : result.leftBase;
          result.rightBase = typeof next.right === "number" ? next.right : result.rightBase;
          result.left = result.leftBase;
          result.right = result.rightBase;
        } else {
          result = next;
        }
      }
    }
  });
  return result;
}

function shuffleKlpp(list){
  const copy = list.slice();
  for(let i = copy.length - 1; i > 0; i -= 1){
    const j = Math.floor(Math.random() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

function unorderedKlppPairKey(a, b){
  return [a, b].sort().join("::");
}

function listKlppPlayers(room){
  return room.players.slice().sort(function(a, b){ return a.joinedAt - b.joinedAt; });
}

function buildKlppQuestionPool(){
  return KLPP_STARTER_QUESTIONS.slice();
}

function takeKlppRoundQuestions(room, count){
  const set = klppGetRoomQuestionSet(room);
  const pool = (set && set.questions && set.questions.length) ? set.questions.slice() : KLPP_STARTER_QUESTIONS.slice();
  const keepHistory = Math.floor(pool.length * 0.7);
  if((room.questionHistory || []).length > keepHistory){
    room.questionHistory = room.questionHistory.slice(-keepHistory);
  }
  const unused = pool.filter(function(text){ return room.questionHistory.indexOf(text) === -1; });
  let source;
  if(unused.length >= count){
    source = unused;
  } else {
    source = unused.slice();
    const extra = shuffleKlpp(pool.filter(function(text){ return source.indexOf(text) === -1; })).slice(0, count - source.length);
    source = source.concat(extra);
  }
  const picked = shuffleKlpp(source).slice(0, count);
  picked.forEach(function(text){
    if(room.questionHistory.indexOf(text) === -1) room.questionHistory.push(text);
  });
  return picked;
}

function takeKlppFinalQuestions(room, count) {
  const set = klppGetRoomQuestionSet(room);
  const pool = (set && set.finalQuestions && set.finalQuestions.length) ? set.finalQuestions.slice() : KLPP_STARTER_FINAL_QUESTIONS.slice();
  return shuffleKlpp(pool).slice(0, count);
}

function takeKlppMemes(room, count) {
  const set = klppGetRoomQuestionSet(room);
  const pool = (set && set.memes && set.memes.length) ? set.memes.slice() : KLPP_DEFAULT_MEMES.slice();
  return shuffleKlpp(pool).slice(0, count);
}

// Build a k-regular graph on `players` (each node gets exactly k edges).
// Greedy: shuffle players, fill opponents, prefer pairs absent from `history`.
// Returns array of {baseKey, players:[a,b]} or null if it failed to converge.
function klppTryBuildRoundPairs(players, k, history){
  const order = shuffleKlpp(players);
  const counts = {};
  order.forEach(function(p){ counts[p] = 0; });
  const used = Object.create(null);
  const pairs = [];

  for(let i = 0; i < order.length; i += 1){
    const p = order[i];
    while(counts[p] < k){
      // Eligible opponents: not self, not yet at quota, not already paired with p
      const eligible = order.filter(function(q){
        if(q === p) return false;
        if(counts[q] >= k) return false;
        return !used[unorderedKlppPairKey(p, q)];
      });
      if(!eligible.length) return null;
      // Prefer pairs absent from history
      const fresh = eligible.filter(function(q){ return history.indexOf(unorderedKlppPairKey(p, q)) === -1; });
      const stale = eligible.filter(function(q){ return history.indexOf(unorderedKlppPairKey(p, q)) !== -1; });
      const ordered = shuffleKlpp(fresh).concat(shuffleKlpp(stale));
      const q = ordered[0];
      const key = unorderedKlppPairKey(p, q);
      used[key] = true;
      pairs.push({baseKey: key, players: [p, q]});
      counts[p] += 1;
      counts[q] += 1;
    }
  }
  // Sanity check: everyone got exactly k
  for(let i = 0; i < order.length; i += 1){
    if(counts[order[i]] !== k) return null;
  }
  return pairs;
}

function generateKlppPairs(room){
  const players = listKlppPlayers(room).map(function(player){ return player.clientId; });
  const n = players.length;
  if(n < 2) return [];
  let k = Math.max(1, Math.min(KLPP_QUESTIONS_PER_PLAYER_MAX, (room.settings && room.settings.questionsPerPlayer) || KLPP_DEFAULT_SETTINGS.questionsPerPlayer));
  // k must be < n (you can't play more than n-1 distinct opponents). Clamp down.
  if(k > n - 1) k = n - 1;
  // For a k-regular graph to exist, n*k must be even. If not, drop k by 1.
  if((n * k) % 2 !== 0) k = Math.max(1, k - 1);

  // Try a few times with history-awareness
  for(let attempt = 0; attempt < 80; attempt += 1){
    const tried = klppTryBuildRoundPairs(players, k, room.pairHistory || []);
    if(tried){
      tried.forEach(function(item){
        if((room.pairHistory || []).indexOf(item.baseKey) === -1) room.pairHistory.push(item.baseKey);
      });
      return shuffleKlpp(tried);
    }
  }
  // Fallback without history awareness
  for(let attempt = 0; attempt < 40; attempt += 1){
    const tried = klppTryBuildRoundPairs(players, k, []);
    if(tried){
      tried.forEach(function(item){
        if((room.pairHistory || []).indexOf(item.baseKey) === -1) room.pairHistory.push(item.baseKey);
      });
      return shuffleKlpp(tried);
    }
  }
  // Last resort: cyclic neighbour ring (always converges for any k ≤ n-1 if n*k is even)
  const pairs = [];
  const used = Object.create(null);
  for(let i = 0; i < n; i += 1){
    for(let d = 1; d <= k; d += 1){
      const j = (i + d) % n;
      const key = unorderedKlppPairKey(players[i], players[j]);
      if(!used[key]){
        used[key] = true;
        pairs.push({baseKey: key, players: [players[i], players[j]]});
      }
    }
  }
  pairs.forEach(function(item){
    if((room.pairHistory || []).indexOf(item.baseKey) === -1) room.pairHistory.push(item.baseKey);
  });
  return shuffleKlpp(pairs);
}

function setupKlppRound(room){
  ensureKlppRoom(room);
  
  // Consume activeAbility and save it for this round
  room.roundActiveAbility = room.activeAbility || null;
  room.activeAbility = null;

  if(room.roundIndex >= room.settings.roundCount){
    room.currentRound = null;
    room.state = "finished";
    room.phaseStartedAt = Date.now();
    return;
  }
  const nextRoundNumber = room.roundIndex + 1;
  const isFinalRound = (nextRoundNumber === room.settings.roundCount);

  if(isFinalRound){
    const finalType = room.settings.finalRoundType || "final_lash";
    let selectedFinalType = finalType;
    if(finalType === "random"){
      selectedFinalType = Math.random() > 0.5 ? "final_lash" : "meme_round";
    }

    const assignmentsByPlayer = {};
    listKlppPlayers(room).forEach(function(player){
      assignmentsByPlayer[player.clientId] = [];
    });

    let roundPairs = [];
    let introText = "";

    if(selectedFinalType === "meme_round"){
      const memes = takeKlppMemes(room, 1);
      const meme = memes[0] || KLPP_DEFAULT_MEMES[0];
      const pairId = "meme-lash";
      const baseAssignment = {
        pairId: pairId,
        questionText: meme.name,
        memeImageUrl: meme.url,
        hintText: null,
        opponentClientId: null,
        answerText: "",
        submittedAt: 0,
        status: "pending"
      };
      listKlppPlayers(room).forEach(function(player){
        assignmentsByPlayer[player.clientId].push(clone(baseAssignment));
      });
      roundPairs = [{
        pairId: pairId,
        questionText: meme.name,
        memeImageUrl: meme.url,
        hintText: null,
        players: listKlppPlayers(room).map(function(p){ return p.clientId; }),
        baseKey: "meme-lash"
      }];
      introText = "Финальный раунд: МЕМ-РАУНД! Придумай смешной текст к картинке.";
    } else {
      const prompts = takeKlppFinalQuestions(room, 1);
      const promptText = prompts[0] || "Самое неподходящее место для романтического признания.";
      const pairId = "final-lash";
      const baseAssignment = {
        pairId: pairId,
        questionText: promptText,
        hintText: null,
        opponentClientId: null,
        answerText: "",
        submittedAt: 0,
        status: "pending"
      };
      listKlppPlayers(room).forEach(function(player){
        assignmentsByPlayer[player.clientId].push(clone(baseAssignment));
      });
      roundPairs = [{
        pairId: pairId,
        questionText: promptText,
        hintText: null,
        players: listKlppPlayers(room).map(function(p){ return p.clientId; }),
        baseKey: "final-lash"
      }];
      introText = "Финальный раунд: СМЕРТЕЛЬНЫЙ БОЙ! Один вопрос для всех.";
    }

    Object.keys(assignmentsByPlayer).forEach(function(clientId){
      assignmentsByPlayer[clientId].forEach(function(item, index){
        item.order = index;
      });
    });

    room.currentRound = {
      type: selectedFinalType,
      roundNumber: nextRoundNumber,
      pairs: roundPairs,
      assignmentsByPlayer: assignmentsByPlayer,
      voteQueue: [],
      currentVoteIndex: 0,
      introText: introText,
      modifiers: []
    };
    room.roundIndex = nextRoundNumber;
    room.lastRoundResult = null;
    room.endedWithoutScore = false;
    return;
  }

  const pairs = generateKlppPairs(room);
  const modifiers = klppAssignModifiersToRound(room);
  const isReverse = modifiers.indexOf("reverse_round") !== -1;
  const isBlind = modifiers.indexOf("blind_round") !== -1;

  // Pick prompts: reverse_round uses punchlines, classic uses questions
  let prompts;
  if(isReverse){
    prompts = takeKlppReverseAnswers(room, pairs.length);
  } else {
    prompts = takeKlppRoundQuestions(room, pairs.length);
  }

  const assignmentsByPlayer = {};
  listKlppPlayers(room).forEach(function(player){
    assignmentsByPlayer[player.clientId] = [];
  });
  const roundPairs = pairs.map(function(pair, index){
    const promptText = prompts[index] || (isReverse ? KLPP_REVERSE_ANSWERS[index % KLPP_REVERSE_ANSWERS.length] : KLPP_STARTER_QUESTIONS[index % KLPP_STARTER_QUESTIONS.length]);
    const hintText = (!isReverse && isBlind) ? klppBlindHintForQuestion(promptText) : null;
    const pairId = "r" + nextRoundNumber + "-p" + (index + 1);
    const a = pair.players[0];
    const b = pair.players[1];
    const baseAssignment = {pairId: pairId, questionText: promptText, hintText: hintText, opponentClientId: null, answerText: "", submittedAt: 0, status: "pending"};
    assignmentsByPlayer[a].push(Object.assign({}, baseAssignment, {opponentClientId: b}));
    assignmentsByPlayer[b].push(Object.assign({}, baseAssignment, {opponentClientId: a}));
    return {pairId: pairId, questionText: promptText, hintText: hintText, players: [a, b], baseKey: pair.baseKey};
  });
  Object.keys(assignmentsByPlayer).forEach(function(clientId){
    assignmentsByPlayer[clientId] = shuffleKlpp(assignmentsByPlayer[clientId]).map(function(item, index){
      item.order = index;
      return item;
    });
  });

  // Apply swap_questions ability if active
  if(room.roundActiveAbility === "swap_questions"){
    const playerIds = Object.keys(assignmentsByPlayer);
    if(playerIds.length >= 2){
      const playerA = playerIds[0];
      const playerB = playerIds[1];
      const listA = assignmentsByPlayer[playerA] || [];
      const listB = assignmentsByPlayer[playerB] || [];
      if(listA.length > 0 && listB.length > 0){
        // Swap their first assignment's promptText/hintText
        const tempQ = listA[0].questionText;
        const tempH = listA[0].hintText;
        listA[0].questionText = listB[0].questionText;
        listA[0].hintText = listB[0].hintText;
        listB[0].questionText = tempQ;
        listB[0].hintText = tempH;
        // Also swap the promptText/hintText in roundPairs
        const pairA = roundPairs.find(function(p){ return p.pairId === listA[0].pairId; });
        const pairB = roundPairs.find(function(p){ return p.pairId === listB[0].pairId; });
        if(pairA && pairB){
          const pTempQ = pairA.questionText;
          const pTempH = pairA.hintText;
          pairA.questionText = pairB.questionText;
          pairA.hintText = pairB.hintText;
          pairB.questionText = pTempQ;
          pairB.hintText = pTempH;
        }
      }
    }
  }

  let introText = "Обычный раунд";
  if(isReverse) introText = "Раунд наоборот: придумай вопрос к ответу!";
  else if(isBlind) introText = "Слепой раунд: только подсказка — без вопроса!";

  room.currentRound = {
    type: isReverse ? "reverse" : "classic",
    roundNumber: nextRoundNumber,
    pairs: roundPairs,
    assignmentsByPlayer: assignmentsByPlayer,
    voteQueue: [],
    currentVoteIndex: 0,
    introText: introText,
    modifiers: modifiers
  };
  room.roundIndex = nextRoundNumber;
  room.lastRoundResult = null;
  room.endedWithoutScore = false;
}

function setKlppState(room, nextState){
  room.state = nextState;
  room.phaseStartedAt = Date.now();
  
  if(nextState === "answer"){
    room.playerActiveAbilities = {};
    room.playerAbilitiesSelect = {};
    room.playerHeldAbilities = room.playerHeldAbilities || {};

    const activeMods = room.currentRound ? (room.currentRound.modifiers || []) : [];
    const hasParty = activeMods.indexOf("ability_party") !== -1;
    const hasLeader = activeMods.indexOf("leader_abilities") !== -1;

    if(hasParty || hasLeader){
      const ALL_ABILITIES = [
        {id: "freeze_timer", name: "Заморозка времени", icon: "❄️", description: "Добавляет +25 секунд к таймеру ответов этого раунда"},
        {id: "reduce_timer", name: "Сокращение времени", icon: "⚡", description: "Сокращает таймер ответов этого раунда на 25 секунд"},
        {id: "swap_questions", name: "Обмен вопросами", icon: "🔄", description: "Случайно меняет твой вопрос с соперником"},
        {id: "join_the_battle", name: "Вступить в бой", icon: "⚔️", description: "Вы получаете +50% к очкам за свои ответы в этом раунде"},
        {id: "spy", name: "Шпионаж", icon: "👁️", description: "Вы видите ответ своего оппонента в реальном времени во время фазы ответов"}
      ];

      const players = listKlppPlayers(room);
      players.forEach(function(player){
        const clientId = player.clientId;
        const isLeader = clientId === klppGetLeaderClientId(room);
        const shouldGetSelect = hasParty || (hasLeader && isLeader);
        
        if (shouldGetSelect){
          const held = room.playerHeldAbilities[clientId];
          if (held) {
            const heldDef = ALL_ABILITIES.find(function(a){ return a.id === held; });
            const others = ALL_ABILITIES.filter(function(a){ return a.id !== held; });
            room.playerAbilitiesSelect[clientId] = {
              options: shuffleKlpp(others).slice(0, 2),
              held: heldDef || null,
              chosen: null
            };
          } else {
            room.playerAbilitiesSelect[clientId] = {
              options: shuffleKlpp(ALL_ABILITIES).slice(0, 3),
              held: null,
              chosen: null
            };
          }
        }
      });
    }
  }
}

function startKlppGame(room){
  ensureKlppRoom(room);
  room.settings = sanitizeKlppSettings(room.settings);
  room.scoreboard = {};
  listKlppPlayers(room).forEach(function(player){
    room.scoreboard[player.clientId] = 0;
  });
  room.history = [];
  room.questionHistory = [];
  room.pairHistory = [];
  room.roundIndex = 0;
  room.currentRound = null;
  room.lastRoundResult = null;
  room.pauseMeta = null;
  room.startedAt = Date.now();
  setupKlppRound(room);
  setKlppState(room, "launch");
}

function getKlppAllAssignments(room){
  const currentRound = room.currentRound;
  if(!currentRound) return [];
  return Object.keys(currentRound.assignmentsByPlayer || {}).reduce(function(list, clientId){
    return list.concat((currentRound.assignmentsByPlayer[clientId] || []).map(function(assignment){
      return Object.assign({clientId: clientId}, assignment);
    }));
  }, []);
}

function areKlppAnswersComplete(room){
  const assignments = getKlppAllAssignments(room);
  return assignments.length > 0 && assignments.every(function(item){ return item.status !== "pending"; });
}

function fillKlppMissingAnswers(room){
  if(!room.currentRound) return;
  Object.keys(room.currentRound.assignmentsByPlayer || {}).forEach(function(clientId){
    (room.currentRound.assignmentsByPlayer[clientId] || []).forEach(function(assignment){
      if(assignment.status === "pending"){
        assignment.status = "missed";
        assignment.answerText = KLPP_NO_ANSWER_TEXT;
        assignment.submittedAt = 0;
      }
    });
  });
}

function buildKlppVoteQueue(room){
  if(!room.currentRound) return;

  if(room.currentRound.type === "final_lash" || room.currentRound.type === "meme_round"){
    const pair = room.currentRound.pairs[0];
    const answers = listKlppPlayers(room).map(function(player){
      const assList = room.currentRound.assignmentsByPlayer[player.clientId] || [];
      const ass = assList.find(function(item){ return item.pairId === pair.pairId; });
      return {
        clientId: player.clientId,
        nickname: player.nickname,
        avatar: player.avatar,
        answerText: ass && ass.status === "answered" ? ass.answerText : KLPP_NO_ANSWER_TEXT,
        missing: !ass || ass.status !== "answered"
      };
    });

    room.currentRound.voteQueue = [{
      pairId: pair.pairId,
      type: room.currentRound.type,
      questionText: pair.questionText,
      memeImageUrl: pair.memeImageUrl || null,
      answers: shuffleKlpp(answers),
      votes: {},
      result: null
    }];
    room.currentRound.currentVoteIndex = 0;
    return;
  }

  room.currentRound.voteQueue = room.currentRound.pairs.map(function(pair){
    const firstId = pair.players[0];
    const secondId = pair.players[1];
    const firstAssignment = (room.currentRound.assignmentsByPlayer[firstId] || []).find(function(item){ return item.pairId === pair.pairId; });
    const secondAssignment = (room.currentRound.assignmentsByPlayer[secondId] || []).find(function(item){ return item.pairId === pair.pairId; });
    const sides = Math.random() > 0.5 ? [
      {clientId: firstId, assignment: firstAssignment},
      {clientId: secondId, assignment: secondAssignment}
    ] : [
      {clientId: secondId, assignment: secondAssignment},
      {clientId: firstId, assignment: firstAssignment}
    ];
    return {
      pairId: pair.pairId,
      questionText: pair.questionText,
      leftClientId: sides[0].clientId,
      rightClientId: sides[1].clientId,
      leftText: sides[0].assignment ? sides[0].assignment.answerText : KLPP_NO_ANSWER_TEXT,
      rightText: sides[1].assignment ? sides[1].assignment.answerText : KLPP_NO_ANSWER_TEXT,
      leftMissing: !sides[0].assignment || sides[0].assignment.status === "missed",
      rightMissing: !sides[1].assignment || sides[1].assignment.status === "missed",
      votes: {},
      result: null
    };
  });
  room.currentRound.currentVoteIndex = 0;
}

function getKlppCurrentVote(room){
  if(!room.currentRound || !room.currentRound.voteQueue || !room.currentRound.voteQueue.length) return null;
  return room.currentRound.voteQueue[room.currentRound.currentVoteIndex] || null;
}

function listKlppEligibleVoters(room, vote){
  const playerIds = listKlppPlayers(room).map(function(player){ return player.clientId; });
  if(vote.type === "final_lash" || vote.type === "meme_round"){
    return playerIds;
  }
  if(room.settings.selfVotingEnabled) return playerIds;
  return playerIds.filter(function(clientId){
    return clientId !== vote.leftClientId && clientId !== vote.rightClientId;
  });
}

function finalizeKlppVote(room){
  const vote = getKlppCurrentVote(room);
  if(!vote || vote.result) return;

  const isLastRound = (room.roundIndex || 0) >= (room.settings.roundCount || 5);
  const nameMap = new Map(listKlppPlayers(room).map(function(player){ return [player.clientId, player.nickname]; }));

  if(vote.type === "final_lash" || vote.type === "meme_round"){
    const voteCounts = {};
    const voterMap = {};
    vote.answers.forEach(function(ans){
      voteCounts[ans.clientId] = 0;
      voterMap[ans.clientId] = [];
    });

    Object.keys(vote.votes || {}).forEach(function(voterId){
      const targetId = vote.votes[voterId];
      if(voteCounts[targetId] !== undefined){
        voteCounts[targetId] += 1;
        voterMap[targetId].push(nameMap.get(voterId) || "Игрок");
      }
    });

    const votePointsPerVote = (room.settings.doublePointsLastRound && isLastRound) ? 300 : 150;

    const answersResult = vote.answers.map(function(ans){
      let scoreDelta = voteCounts[ans.clientId] * votePointsPerVote;
      if(ans.missing){
        scoreDelta = 0;
      }
      room.scoreboard[ans.clientId] = Math.max(0, (room.scoreboard[ans.clientId] || 0) + scoreDelta);

      return {
        clientId: ans.clientId,
        nickname: ans.nickname,
        avatar: ans.avatar,
        answerText: ans.answerText,
        missing: ans.missing,
        voteCount: voteCounts[ans.clientId],
        voters: voterMap[ans.clientId],
        scoreDelta: scoreDelta
      };
    }).sort(function(a, b){
      return b.voteCount - a.voteCount;
    });

    vote.result = {
      type: vote.type,
      questionText: vote.questionText,
      memeImageUrl: vote.memeImageUrl,
      answers: answersResult,
      doublePoints: Boolean(room.settings.doublePointsLastRound && isLastRound)
    };

    setKlppState(room, "vote_result");
    return;
  }

  const eligibleVoters = listKlppEligibleVoters(room, vote);
  let leftVotes = 0;
  let rightVotes = 0;
  let leftPercent = 0;
  let rightPercent = 0;
  let autoReason = "";
  if(vote.leftMissing && !vote.rightMissing){
    rightPercent = 100;
    autoReason = "left-missed";
  }else if(!vote.leftMissing && vote.rightMissing){
    leftPercent = 100;
    autoReason = "right-missed";
  }else if(vote.leftMissing && vote.rightMissing){
    autoReason = "both-missed";
  }else{
    Object.keys(vote.votes || {}).forEach(function(voterId){
      if(vote.votes[voterId] === vote.leftClientId) leftVotes += 1;
      if(vote.votes[voterId] === vote.rightClientId) rightVotes += 1;
    });
    const totalVotes = leftVotes + rightVotes;
    if(totalVotes === 0){
      leftPercent = 50;
      rightPercent = 50;
      autoReason = eligibleVoters.length ? "no-votes" : "no-eligible-voters";
    }else{
      leftPercent = Math.round((leftVotes / totalVotes) * 100);
      rightPercent = Math.max(0, 100 - leftPercent);
    }
  }
  let leftBase = leftPercent * 10;
  let rightBase = rightPercent * 10;
  const transformed = klppRunModifierHook(room, "transformScore", {
    leftPercent: leftPercent,
    rightPercent: rightPercent,
    leftBase: leftBase,
    rightBase: rightBase,
    room: room,
    vote: vote
  });
  let leftScoreDelta = transformed && typeof transformed.left === "number" ? transformed.left : leftBase;
  let rightScoreDelta = transformed && typeof transformed.right === "number" ? transformed.right : rightBase;
  if(room.settings.doublePointsLastRound && isLastRound){
    leftScoreDelta *= 2;
    rightScoreDelta *= 2;
  }
  if(room.playerActiveAbilities){
    if(room.playerActiveAbilities[vote.leftClientId] === "join_the_battle"){
      leftScoreDelta = Math.round(leftScoreDelta * 1.5);
    }
    if(room.playerActiveAbilities[vote.rightClientId] === "join_the_battle"){
      rightScoreDelta = Math.round(rightScoreDelta * 1.5);
    }
  }
  room.scoreboard[vote.leftClientId] = Math.max(0, (room.scoreboard[vote.leftClientId] || 0) + leftScoreDelta);
  room.scoreboard[vote.rightClientId] = Math.max(0, (room.scoreboard[vote.rightClientId] || 0) + rightScoreDelta);
  vote.result = {
    leftClientId: vote.leftClientId,
    rightClientId: vote.rightClientId,
    leftNickname: nameMap.get(vote.leftClientId) || "Игрок",
    rightNickname: nameMap.get(vote.rightClientId) || "Игрок",
    leftVotes: leftVotes,
    rightVotes: rightVotes,
    leftPercent: leftPercent,
    rightPercent: rightPercent,
    leftScoreDelta: leftScoreDelta,
    rightScoreDelta: rightScoreDelta,
    doublePoints: Boolean(room.settings.doublePointsLastRound && isLastRound),
    modifierIds: (room.currentRound && room.currentRound.modifiers) ? room.currentRound.modifiers.slice() : [],
    stealAmount: (transformed && typeof transformed.stealAmount === "number") ? transformed.stealAmount : 0,
    stealWinnerId: (transformed && transformed.stealWinnerId) || "",
    stealLoserId: (transformed && transformed.stealLoserId) || "",
    leftVoters: Object.keys(vote.votes || {}).filter(function(voterId){ return vote.votes[voterId] === vote.leftClientId; }).map(function(voterId){ return nameMap.get(voterId) || "Игрок"; }),
    rightVoters: Object.keys(vote.votes || {}).filter(function(voterId){ return vote.votes[voterId] === vote.rightClientId; }).map(function(voterId){ return nameMap.get(voterId) || "Игрок"; }),
    autoReason: autoReason
  };
  // Modifier hook: notify resolved vote (e.g. combo streak tracking)
  if(room.currentRound && Array.isArray(room.currentRound.modifiers)){
    room.currentRound.modifiers.forEach(function(id){
      const def = KLPP_MODIFIERS[id];
      if(def && typeof def.onVoteResolved === "function"){
        try{ def.onVoteResolved(room, vote, vote.result); }catch(error){ /* keep state stable */ }
      }
    });
  }
  setKlppState(room, "vote_result");
}

function finalizeKlppRound(room){
  const currentRound = room.currentRound;
  if(!currentRound){
    setKlppState(room, "finished");
    return;
  }
  const deltaByClient = {};
  currentRound.voteQueue.forEach(function(item){
    if(!item.result) return;
    deltaByClient[item.result.leftClientId] = (deltaByClient[item.result.leftClientId] || 0) + (item.result.leftScoreDelta || 0);
    deltaByClient[item.result.rightClientId] = (deltaByClient[item.result.rightClientId] || 0) + (item.result.rightScoreDelta || 0);
  });
  const scoreboard = listKlppPlayers(room).map(function(player){
    return {
      clientId: player.clientId,
      nickname: player.nickname,
      score: room.scoreboard[player.clientId] || 0,
      delta: deltaByClient[player.clientId] || 0
    };
  }).sort(function(a, b){ return b.score - a.score || a.nickname.localeCompare(b.nickname, "ru"); });
  room.lastRoundResult = {
    roundNumber: currentRound.roundNumber,
    title: "Раунд " + currentRound.roundNumber,
    pairResults: currentRound.voteQueue.map(function(item){ return clone(item.result); }).filter(Boolean),
    scoreboard: scoreboard,
    modifiers: klppActiveModifiersForRound(room),
    isFinalRound: room.roundIndex >= room.settings.roundCount
  };
  room.history.push(clone(room.lastRoundResult));
  if(room.roundIndex >= room.settings.roundCount){
    setKlppState(room, "finished");
    return;
  }
  setKlppState(room, "round_score");
}

function moveKlppToNextVoteOrScore(room){
  if(!room.currentRound){
    finalizeKlppRound(room);
    return;
  }
  if(room.currentRound.currentVoteIndex + 1 < room.currentRound.voteQueue.length){
    room.currentRound.currentVoteIndex += 1;
    setKlppState(room, "vote");
    return;
  }
  finalizeKlppRound(room);
}

function beginKlppVoting(room){
  fillKlppMissingAnswers(room);
  buildKlppVoteQueue(room);
  if(!room.currentRound || !room.currentRound.voteQueue.length){
    finalizeKlppRound(room);
    return;
  }
  setKlppState(room, "vote");
}

function tickKlppRoom(room){
  ensureKlppRoom(room);
  if(room.state === "paused" || room.state === "lobby" || !room.phaseStartedAt) return room;
  // Drive bots BEFORE the phase-transition checks so their answers/votes
  // are counted in the same tick that flips us into the next phase.
  klppRunBotAutoplay(room);
  const now = Date.now();
  const elapsed = now - room.phaseStartedAt;
  if(room.state === "launch" && elapsed >= KLPP_LAUNCH_MS){
    setKlppState(room, "round_intro");
  }else if(room.state === "round_intro" && elapsed >= KLPP_ROUND_INTRO_MS){
    setKlppState(room, "answer");
  }else if(room.state === "answer"){
    if(areKlppAnswersComplete(room) || elapsed >= room.settings.answerSeconds * 1000){
      beginKlppVoting(room);
    }
  }else if(room.state === "vote"){
    const currentVote = getKlppCurrentVote(room);
    if(!currentVote){
      finalizeKlppRound(room);
      return room;
    }
    const revealDone = elapsed >= KLPP_VOTE_REVEAL_MS;
    const eligibleVoters = listKlppEligibleVoters(room, currentVote);
    const voteCount = Object.keys(currentVote.votes || {}).length;
    if(currentVote.leftMissing || currentVote.rightMissing){
      if(revealDone) finalizeKlppVote(room);
    }else if((revealDone && elapsed >= KLPP_VOTE_REVEAL_MS + room.settings.voteSeconds * 1000) || (eligibleVoters.length && voteCount >= eligibleVoters.length)){
      finalizeKlppVote(room);
    }
  }else if(room.state === "vote_result" && elapsed >= KLPP_VOTE_RESULT_MS){
    moveKlppToNextVoteOrScore(room);
  }else if(room.state === "round_score" && elapsed >= KLPP_ROUND_SCORE_MS){
    setupKlppRound(room);
    setKlppState(room, "round_intro");
  }
  return room;
}



function pauseKlppRoom(room){
  if(room.state === "paused"){
    const meta = room.pauseMeta || {state: "lobby", pauseStartedAt: Date.now(), phaseStartedAt: Date.now()};
    room.state = meta.state;
    room.phaseStartedAt = Date.now() - (meta.pauseStartedAt - meta.phaseStartedAt);
    room.pauseMeta = null;
    return;
  }
  room.pauseMeta = {
    state: room.state,
    pauseStartedAt: Date.now(),
    phaseStartedAt: room.phaseStartedAt
  };
  room.state = "paused";
}

function endKlppRoom(room, showScore){
  room.pauseMeta = null;
  room.endedWithoutScore = !showScore;
  if(showScore){
    room.lastRoundResult = {
      roundNumber: room.roundIndex,
      title: "Игра завершена досрочно",
      pairResults: room.lastRoundResult && room.lastRoundResult.pairResults ? room.lastRoundResult.pairResults : [],
      fastBonus: null,
      scoreboard: listKlppPlayers(room).map(function(player){
        return {
          clientId: player.clientId,
          nickname: player.nickname,
          score: room.scoreboard[player.clientId] || 0,
        isDoneAnswering: room.state === "answer" && klppViewerAssignments(room, player.clientId).length > 0 && klppViewerAssignments(room, player.clientId).filter(function(item){ return item.status !== "pending"; }).length === klppViewerAssignments(room, player.clientId).length
        };
      }).sort(function(a, b){ return b.score - a.score || a.nickname.localeCompare(b.nickname, "ru"); })
    };
  }
  setKlppState(room, "finished");
}

function klppPhaseDurationMs(room){
  const state = room.state;
  if(state === "launch") return KLPP_LAUNCH_MS;
  if(state === "round_intro") return KLPP_ROUND_INTRO_MS;
  if(state === "answer") {
    let base = room.settings.answerSeconds * 1000;
    if(room.roundActiveAbility === "freeze_timer") base += 25000;
    if(room.roundActiveAbility === "reduce_timer") base = Math.max(20000, base - 25000);
    return base;
  }
  if(state === "vote"){
    const vote = getKlppCurrentVote(room);
    if(vote && (vote.leftMissing || vote.rightMissing)) return KLPP_VOTE_REVEAL_MS;
    return KLPP_VOTE_REVEAL_MS + room.settings.voteSeconds * 1000;
  }
  if(state === "vote_result") return KLPP_VOTE_RESULT_MS;
  if(state === "round_score") return KLPP_ROUND_SCORE_MS;
  if(state === "ability_select") return 10000;
  return 0;
}

function klppPhaseEndsAt(room){
  const duration = klppPhaseDurationMs(room);
  if(!duration || !room.phaseStartedAt) return 0;
  return room.phaseStartedAt + duration;
}

function klppCountPendingAnswers(room){
  if(!room.currentRound) return 0;
  return getKlppAllAssignments(room).filter(function(item){ return item.status === "pending"; }).length;
}

function klppCountTotalAssignments(room){
  if(!room.currentRound) return 0;
  return getKlppAllAssignments(room).length;
}

function klppViewerAssignments(room, clientId){
  if(!room.currentRound || !clientId) return [];
  const isBlind = Array.isArray(room.currentRound.modifiers) && room.currentRound.modifiers.indexOf("blind_round") !== -1;
  const isReverse = room.currentRound.type === "reverse";
  const list = room.currentRound.assignmentsByPlayer[clientId] || [];
  return list.map(function(item){
    return {
      pairId: item.pairId,
      questionText: item.questionText,
      // In answer phase: blind_round hides question, reverse_round shows punchline (questionText already is the punchline)
      displayText: (isBlind && item.hintText) ? item.hintText : item.questionText,
      hintText: item.hintText || null,
      isBlind: Boolean(isBlind && item.hintText),
      isReverse: isReverse,
      opponentClientId: item.opponentClientId,
      status: item.status,
      answerText: item.status === "answered" ? item.answerText : "",
      submittedAt: item.submittedAt || 0,
      order: item.order || 0
    };
  });
}

function klppViewerCurrentAssignment(room, clientId){
  if(room.state !== "answer" || !clientId) return null;
  const isBlind = Array.isArray(room.currentRound && room.currentRound.modifiers) && room.currentRound.modifiers.indexOf("blind_round") !== -1;
  const isReverse = room.currentRound && room.currentRound.type === "reverse";
  const list = room.currentRound ? (room.currentRound.assignmentsByPlayer[clientId] || []) : [];
  const pending = list.find(function(item){ return item.status === "pending"; });
  if(!pending) return null;

  let spyOpponentAnswer = null;
  const hasSpy = room.playerActiveAbilities && room.playerActiveAbilities[clientId] === "spy";
  if (hasSpy) {
    const opponentId = pending.opponentClientId;
    const opponentAssignments = room.currentRound ? (room.currentRound.assignmentsByPlayer[opponentId] || []) : [];
    const opponentItem = opponentAssignments.find(function(item){ return item.pairId === pending.pairId; });
    if (opponentItem && opponentItem.status === "answered") {
      spyOpponentAnswer = opponentItem.answerText;
    }
  }

  return {
    pairId: pending.pairId,
    questionText: pending.questionText,
    displayText: (isBlind && pending.hintText) ? pending.hintText : pending.questionText,
    memeImageUrl: pending.memeImageUrl || null,
    hintText: pending.hintText || null,
    isBlind: Boolean(isBlind && pending.hintText),
    isReverse: isReverse,
    opponentClientId: pending.opponentClientId,
    order: pending.order || 0,
    spyOpponentAnswer: spyOpponentAnswer
  };
}

function klppHideAuthorsNow(room, vote, viewerClientId){
  const isSpy = room.roundActiveAbility === "spy" && viewerClientId && viewerClientId === room.roundActiveAbilityUser;
  return Boolean(room.settings && room.settings.anonymousAnswers && room.state === "vote" && (!vote || !vote.result) && !isSpy);
}

function klppViewerVote(room, clientId, players){
  if(room.state !== "vote" || !clientId) return null;
  const vote = getKlppCurrentVote(room);
  if(!vote) return null;
  const eligible = listKlppEligibleVoters(room, vote);

  if(vote.type === "final_lash" || vote.type === "meme_round"){
    const chosenClientId = vote.votes ? (vote.votes[clientId] || "") : "";
    const anonymizedAnswers = vote.answers.map(function(ans, index){
      return {
        clientId: ans.clientId,
        nickname: `Игрок ${index + 1}`,
        avatar: null,
        answerText: ans.answerText,
        missing: ans.missing
      };
    });

    return {
      pairId: vote.pairId,
      type: vote.type,
      questionText: vote.questionText,
      memeImageUrl: vote.memeImageUrl,
      answers: anonymizedAnswers,
      chosenClientId: chosenClientId,
      isAuthor: true,
      canVote: true
    };
  }

  const isAuthor = clientId === vote.leftClientId || clientId === vote.rightClientId;
  const canVote = eligible.indexOf(clientId) !== -1;
  const hideAuthors = klppHideAuthorsNow(room, vote, clientId);
  return {
    pairId: vote.pairId,
    questionText: vote.questionText,
    leftClientId: vote.leftClientId,
    rightClientId: vote.rightClientId,
    leftText: vote.leftText,
    rightText: vote.rightText,
    leftMissing: Boolean(vote.leftMissing),
    rightMissing: Boolean(vote.rightMissing),
    anonymous: hideAuthors,
    chosenClientId: vote.votes ? (vote.votes[clientId] || "") : "",
    isAuthor: isAuthor,
    canVote: canVote
  };
}

function klppSerializeCurrentRound(room, nameMap){
  if(!room.currentRound) return null;
  const pendingAnswers = klppCountPendingAnswers(room);
  const totalAnswers = klppCountTotalAssignments(room);
  return {
    roundNumber: room.currentRound.roundNumber,
    introText: room.currentRound.introText || "",
    totalPairs: (room.currentRound.pairs || []).length,
    pendingAnswers: pendingAnswers,
    totalAnswers: totalAnswers,
    voteIndex: room.currentRound.currentVoteIndex || 0,
    voteTotal: (room.currentRound.voteQueue || []).length
  };
}

function klppSerializeCurrentVote(room, nameMap){
  if(room.state !== "vote" && room.state !== "vote_result") return null;
  const vote = getKlppCurrentVote(room);
  if(!vote) return null;
  const eligible = listKlppEligibleVoters(room, vote);
  const votesGiven = Object.keys(vote.votes || {}).filter(function(voter){ return eligible.indexOf(voter) !== -1; }).length;

  if(vote.type === "final_lash" || vote.type === "meme_round"){
    const hideNow = !vote.result;
    const serializedAnswers = vote.answers.map(function(ans, index){
      return {
        clientId: hideNow ? `anon_${index}` : ans.clientId,
        nickname: hideNow ? `Игрок ${index + 1}` : ans.nickname,
        avatar: hideNow ? null : clone(ans.avatar || null),
        answerText: ans.answerText,
        missing: ans.missing
      };
    });

    return {
      pairId: vote.pairId,
      type: vote.type,
      questionText: vote.questionText,
      memeImageUrl: vote.memeImageUrl,
      answers: serializedAnswers,
      votesGiven: votesGiven,
      eligibleVoters: eligible.length,
      voteIndex: room.currentRound.currentVoteIndex || 0,
      voteTotal: (room.currentRound.voteQueue || []).length,
      result: vote.result ? clone(vote.result) : null
    };
  }

  const hideAuthors = klppHideAuthorsNow(room, vote, null);
  const isReverse = room.currentRound && room.currentRound.type === "reverse";
  return {
    pairId: vote.pairId,
    questionText: vote.questionText,
    isReverse: Boolean(isReverse),
    reverseLabel: isReverse ? "🎯 Готовый ответ" : null,
    leftClientId: vote.leftClientId,
    rightClientId: vote.rightClientId,
    leftNickname: hideAuthors ? "Игрок А" : (nameMap.get(vote.leftClientId) || "Игрок"),
    rightNickname: hideAuthors ? "Игрок Б" : (nameMap.get(vote.rightClientId) || "Игрок"),
    anonymous: hideAuthors,
    leftText: vote.leftText,
    rightText: vote.rightText,
    leftMissing: Boolean(vote.leftMissing),
    rightMissing: Boolean(vote.rightMissing),
    eligibleVoters: eligible.length,
    votesGiven: votesGiven,
    voteIndex: room.currentRound.currentVoteIndex || 0,
    voteTotal: (room.currentRound.voteQueue || []).length,
    result: vote.result ? clone(vote.result) : null
  };
}

function serializeKlppRoom(room, req){
  ensureKlppRoom(room);
  const players = listKlppPlayers(room);
  const leaderClientId = players[0] ? players[0].clientId : "";
  const lastJoinedClientId = players.length ? players[players.length - 1].clientId : "";
  const origin = publicOrigin(req);
  const viewerClientId = String(requestUrl(req).searchParams.get("clientId") || "").trim();
  const viewerPlayer = players.find(function(player){ return player.clientId === viewerClientId; }) || null;
  const nameMap = new Map(players.map(function(player){ return [player.clientId, player.nickname]; }));
  const scoreboard = players.map(function(player){
    return {
      clientId: player.clientId,
      nickname: player.nickname,
      avatar: clone(player.avatar || null),
      score: room.scoreboard[player.clientId] || 0,
      isLeader: player.clientId === leaderClientId
    };
  }).sort(function(a, b){ return b.score - a.score || a.nickname.localeCompare(b.nickname, "ru"); });

  const pausedState = room.state === "paused" && room.pauseMeta ? String(room.pauseMeta.state || "") : "";
  const visibleState = room.state === "paused" && room.pauseMeta ? String(room.pauseMeta.state || "lobby") : room.state;
  const hostControls = {
    canPause: room.state !== "lobby" && room.state !== "finished" && room.state !== "paused",
    canResume: room.state === "paused",
    canEnd: room.state !== "lobby" && room.state !== "finished"
  };
  const viewerAssignments = klppViewerAssignments(room, viewerClientId);
  const answeredCount = viewerAssignments.filter(function(item){ return item.status !== "pending"; }).length;
  const minPlayers = klppMinPlayersForSettings(room.settings);
  const canStart = room.state === "lobby"
    && players.length >= minPlayers
    && Boolean(viewerPlayer)
    && viewerPlayer.clientId === leaderClientId;

  return {
    id: room.id,
    state: room.state,
    visibleState: visibleState,
    isPaused: room.state === "paused",
    pausedState: pausedState,
    endedWithoutScore: Boolean(room.endedWithoutScore),
    createdAt: room.createdAt,
    startedAt: room.startedAt || null,
    phaseStartedAt: room.phaseStartedAt || 0,
    phaseEndsAt: klppPhaseEndsAt(room),
    phaseDurationMs: klppPhaseDurationMs(room),
    serverTime: Date.now(),
    leaderClientId: leaderClientId,
    lastJoinedClientId: lastJoinedClientId,
    minPlayersToStart: minPlayers,
    joinUrl: origin + "/klpp?view=join&room=" + room.id,
    settings: clone(room.settings),
    roundIndex: room.roundIndex || 0,
    totalRounds: room.settings.roundCount,
    isLastRound: (room.roundIndex || 0) >= room.settings.roundCount,
    activeModifiers: klppActiveModifiersForRound(room),
    activeAbility: room.activeAbility || null,
    roundActiveAbility: room.roundActiveAbility || null,
    abilitySelect: (room.state === "answer" && room.playerAbilitiesSelect && room.playerAbilitiesSelect[viewerClientId] && !room.playerAbilitiesSelect[viewerClientId].chosen && (Date.now() - room.phaseStartedAt < 10000)) ? clone(room.playerAbilitiesSelect[viewerClientId]) : null,
    players: players.map(function(player, index){
      const playerAssignments = klppViewerAssignments(room, player.clientId);
      const playerAnsweredCount = playerAssignments.filter(function(item){ return item.status !== "pending"; }).length;
      const isDoneAnswering = room.state === "answer" && playerAssignments.length > 0 && playerAnsweredCount === playerAssignments.length;
      return {
        clientId: player.clientId,
        nickname: player.nickname,
        avatar: clone(player.avatar || null),
        joinedAt: player.joinedAt,
        isLeader: player.clientId === leaderClientId,
        isLastJoined: player.clientId === lastJoinedClientId,
        order: index,
        score: room.scoreboard[player.clientId] || 0,
        isDoneAnswering: isDoneAnswering,
        isBot: Boolean(player.isBot)
      };
    }),
    scoreboard: scoreboard,
    currentRound: klppSerializeCurrentRound(room, nameMap),
    currentVote: klppSerializeCurrentVote(room, nameMap),
    lastRoundResult: clone(room.lastRoundResult),
    viewer: {
      clientId: viewerClientId,
      nickname: viewerPlayer ? viewerPlayer.nickname : "",
      avatar: viewerPlayer ? clone(viewerPlayer.avatar || null) : null,
      isLeader: Boolean(viewerPlayer && viewerPlayer.clientId === leaderClientId),
      isGameLeader: Boolean(viewerPlayer && viewerPlayer.clientId === klppGetLeaderClientId(room)),
      activeAbility: (room.playerActiveAbilities && room.playerActiveAbilities[viewerClientId]) || null,
      heldAbility: (room.playerHeldAbilities && room.playerHeldAbilities[viewerClientId]) || null,
      canStart: canStart,
      answeredCount: answeredCount,
      totalAssignments: viewerAssignments.length,
      currentAssignment: klppViewerCurrentAssignment(room, viewerClientId),
      assignments: viewerAssignments,
      vote: klppViewerVote(room, viewerClientId, players)
    },
    hostControls: hostControls
  };
}
function hasKlppHostAccess(room, body){
  const hostKey = String((body && body.hostKey) || "").trim();
  return Boolean(hostKey && room.hostKey && hostKey === room.hostKey);
}

function hasKlppLeaderAccess(room, body){
  const firstPlayer = listKlppPlayers(room)[0];
  return Boolean(firstPlayer && firstPlayer.clientId === String((body && body.clientId) || "").trim());
}

function klppGetLeaderClientId(room) {
  const players = listKlppPlayers(room);
  if (!players.length) return "";
  const sorted = players.slice().sort(function(a, b) {
    const scoreA = room.scoreboard[a.clientId] || 0;
    const scoreB = room.scoreboard[b.clientId] || 0;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return a.joinedAt - b.joinedAt;
  });
  return sorted[0] ? sorted[0].clientId : "";
}

function klppSwapQuestions(room, targetClientId){
  if(!room.currentRound || !room.currentRound.assignmentsByPlayer) return;
  const assignmentsByPlayer = room.currentRound.assignmentsByPlayer;
  const roundPairs = room.currentRound.pairs || [];
  
  const playerA = targetClientId || Object.keys(assignmentsByPlayer)[0];
  const listA = assignmentsByPlayer[playerA] || [];
  if (!listA.length) return;
  
  const assignmentA = listA[0];
  let assignmentB = null;
  let playerB = null;
  const playerIds = Object.keys(assignmentsByPlayer);
  for (let i = 0; i < playerIds.length; i++) {
    const pid = playerIds[i];
    if (pid !== playerA) {
      const listB = assignmentsByPlayer[pid] || [];
      const item = listB.find(function(a){ return a.pairId !== assignmentA.pairId; });
      if (item) {
        assignmentB = item;
        playerB = pid;
        break;
      }
    }
  }
  
  if (assignmentA && assignmentB && playerB) {
    const tempQ = assignmentA.questionText;
    const tempH = assignmentA.hintText;
    
    assignmentA.questionText = assignmentB.questionText;
    assignmentA.hintText = assignmentB.hintText;
    assignmentB.questionText = tempQ;
    assignmentB.hintText = tempH;
    
    const opponentA = assignmentA.opponentClientId;
    const oppListA = assignmentsByPlayer[opponentA] || [];
    const oppAssignmentA = oppListA.find(function(item){ return item.pairId === assignmentA.pairId; });
    if (oppAssignmentA) {
      oppAssignmentA.questionText = assignmentA.questionText;
      oppAssignmentA.hintText = assignmentA.hintText;
    }
    
    const opponentB = assignmentB.opponentClientId;
    const oppListB = assignmentsByPlayer[opponentB] || [];
    const oppAssignmentB = oppListB.find(function(item){ return item.pairId === assignmentB.pairId; });
    if (oppAssignmentB) {
      oppAssignmentB.questionText = assignmentB.questionText;
      oppAssignmentB.hintText = assignmentB.hintText;
    }
    
    const pairA = roundPairs.find(function(p){ return p.pairId === assignmentA.pairId; });
    const pairB = roundPairs.find(function(p){ return p.pairId === assignmentB.pairId; });
    if (pairA && pairB) {
      const pTempQ = pairA.questionText;
      const pTempH = pairA.hintText;
      pairA.questionText = pairB.questionText;
      pairA.hintText = pairB.hintText;
      pairB.questionText = pTempQ;
      pairB.hintText = pTempH;
    }
  }
}

function listLanHosts(){
  const interfaces = os.networkInterfaces();
  const hosts = [];
  Object.keys(interfaces).forEach(function(name){
    (interfaces[name] || []).forEach(function(entry){
      if(entry && entry.family === "IPv4" && !entry.internal){
        hosts.push(entry.address);
      }
    });
  });
  return hosts;
}

function normalizePublicUrl(raw){
  let value = String(raw || "").trim();
  if(!value) return "";
  if(!/^https?:\/\//i.test(value)){
    value = "https://" + value;
  }
  try{
    const parsed = new URL(value);
    const pathname = parsed.pathname && parsed.pathname !== "/" ? parsed.pathname.replace(/\/+$/g, "") : "";
    return parsed.origin + pathname;
  }catch(error){
    return "";
  }
}

function firstHeaderValue(value){
  if(Array.isArray(value)){
    value = value[0];
  }
  return String(value || "").split(",")[0].trim();
}

function localHostWithPort(hostname){
  const normalizedHost = (hostname === "0.0.0.0" || hostname === "::") ? "127.0.0.1" : String(hostname || "127.0.0.1");
  const hasPort = /:\d+$/.test(normalizedHost);
  if(hasPort || PORT === 80 || PORT === 443){
    return normalizedHost;
  }
  return normalizedHost + ":" + PORT;
}

function requestProtocol(req){
  if(PUBLIC_URL){
    return new URL(PUBLIC_URL).protocol.replace(":", "");
  }
  const headers = req && req.headers ? req.headers : {};
  if(TRUST_PROXY){
    const forwardedProto = firstHeaderValue(headers["x-forwarded-proto"]);
    if(forwardedProto){
      return forwardedProto;
    }
    const forwardedSsl = firstHeaderValue(headers["x-forwarded-ssl"]);
    if(forwardedSsl.toLowerCase() === "on"){
      return "https";
    }
  }
  return req && req.socket && req.socket.encrypted ? "https" : "http";
}

function requestHost(req){
  if(PUBLIC_URL){
    return new URL(PUBLIC_URL).host;
  }
  const headers = req && req.headers ? req.headers : {};
  if(TRUST_PROXY){
    const forwardedHost = firstHeaderValue(headers["x-forwarded-host"]);
    if(forwardedHost){
      return forwardedHost;
    }
  }
  const directHost = firstHeaderValue(headers.host);
  return directHost || localHostWithPort(HOST);
}

function publicOrigin(req){
  if(PUBLIC_URL){
    return PUBLIC_URL;
  }
  return requestProtocol(req) + "://" + requestHost(req);
}

function requestUrl(req){
  return new URL(req && req.url ? req.url : "/", publicOrigin(req));
}

function preferredHost(req){
  return requestHost(req);
}

function createKlppRoom(){
  let id = randomKlppRoomId();
  while(klppRooms.has(id)){
    id = randomKlppRoomId();
  }
  const room = {
    id: id,
    hostKey: randomKlppHostKey(),
    state: "lobby",
    createdAt: Date.now(),
    startedAt: null,
    players: [],
    settings: blankKlppSettings(),
    scoreboard: {},
    roundIndex: 0,
    currentRound: null,
    history: [],
    lastRoundResult: null,
    questionHistory: [],
    pairHistory: [],
    phaseStartedAt: 0,
    pauseMeta: null,
    endedWithoutScore: false
  };
  klppRooms.set(id, room);
  return room;
}

function getKlppRoom(rawRoomId){
  const roomId = sanitizeKlppRoomId(rawRoomId);
  const room = roomId ? klppRooms.get(roomId) || null : null;
  return room ? ensureKlppRoom(room) : null;
}

const KLPP_ROOM_EMPTY_TTL_MS = 30 * 60 * 1000;
const KLPP_ROOM_MAX_TTL_MS = 12 * 60 * 60 * 1000;
const KLPP_ROOM_GC_INTERVAL_MS = 5 * 60 * 1000;

function closeKlppRoomConnections(room){
  if(!room || !room.sseClients) return;
  room.sseClients.forEach(function(client){
    try{ client.res.end(); }catch(error){}
  });
  room.sseClients.clear();
}

function gcKlppRooms(){
  const now = Date.now();
  klppRooms.forEach(function(room, id){
    const createdAt = Number(room.createdAt) || 0;
    const ageMs = now - createdAt;
    const hasPlayers = Array.isArray(room.players) && room.players.length > 0;
    const hasListeners = room.sseClients && room.sseClients.size > 0;
    if(ageMs >= KLPP_ROOM_MAX_TTL_MS){
      closeKlppRoomConnections(room);
      klppRooms.delete(id);
      return;
    }
    if(!hasPlayers && !hasListeners && ageMs >= KLPP_ROOM_EMPTY_TTL_MS){
      klppRooms.delete(id);
    }
  });
}

setInterval(gcKlppRooms, KLPP_ROOM_GC_INTERVAL_MS).unref();

const KLPP_ROOM_RATELIMIT_WINDOW_MS = 5 * 60 * 1000;
const KLPP_ROOM_RATELIMIT_MAX = 10;
const klppRoomCreationLog = new Map();

function clientIp(req){
  if(TRUST_PROXY){
    const fwd = firstHeaderValue(req && req.headers && req.headers["x-forwarded-for"]);
    if(fwd) return fwd;
  }
  return (req && req.socket && req.socket.remoteAddress) || "unknown";
}

function tryRateLimitRoomCreation(ip){
  const now = Date.now();
  const list = klppRoomCreationLog.get(ip) || [];
  const recent = list.filter(function(t){ return now - t < KLPP_ROOM_RATELIMIT_WINDOW_MS; });
  if(recent.length >= KLPP_ROOM_RATELIMIT_MAX){
    klppRoomCreationLog.set(ip, recent);
    return false;
  }
  recent.push(now);
  klppRoomCreationLog.set(ip, recent);
  return true;
}

setInterval(function(){
  const now = Date.now();
  klppRoomCreationLog.forEach(function(list, ip){
    const recent = list.filter(function(t){ return now - t < KLPP_ROOM_RATELIMIT_WINDOW_MS; });
    if(recent.length === 0) klppRoomCreationLog.delete(ip);
    else klppRoomCreationLog.set(ip, recent);
  });
}, KLPP_ROOM_RATELIMIT_WINDOW_MS).unref();

const KLPP_AVATAR_COLORS = ["#ff6b6b","#ffd93d","#6bcb77","#4d96ff","#b388ff","#ff9f1c","#ff6f91","#00c2a8"];
const KLPP_AVATAR_FACES = ["smile","cool","nerd","sleepy","clown","alien","robot","mustache"];

function sanitizeKlppAvatar(input, fallback){
  const base = fallback || {};
  const raw = input || {};
  const color = KLPP_AVATAR_COLORS.indexOf(String(raw.color || "")) !== -1
    ? String(raw.color)
    : (KLPP_AVATAR_COLORS.indexOf(base.color) !== -1 ? base.color : KLPP_AVATAR_COLORS[Math.floor(Math.random() * KLPP_AVATAR_COLORS.length)]);
  const face = KLPP_AVATAR_FACES.indexOf(String(raw.face || "")) !== -1
    ? String(raw.face)
    : (KLPP_AVATAR_FACES.indexOf(base.face) !== -1 ? base.face : KLPP_AVATAR_FACES[Math.floor(Math.random() * KLPP_AVATAR_FACES.length)]);
  return {color: color, face: face};
}

function upsertKlppPlayer(room, clientId, nickname, avatar, options){
  const safeClientId = String(clientId || "").trim().slice(0, 80);
  const safeNickname = String(nickname || "").trim().slice(0, 32) || "Игрок";
  const isBot = Boolean(options && options.isBot);
  let player = room.players.find(function(item){ return item.clientId === safeClientId; });
  if(player){
    player.nickname = safeNickname;
    if(avatar) player.avatar = sanitizeKlppAvatar(avatar, player.avatar);
    player.lastSeenAt = Date.now();
    if(isBot) player.isBot = true;
    return player;
  }
  player = {
    clientId: safeClientId,
    nickname: safeNickname,
    avatar: sanitizeKlppAvatar(avatar),
    joinedAt: Date.now(),
    lastSeenAt: Date.now(),
    isBot: isBot
  };
  room.players.push(player);
  room.players.sort(function(a, b){ return a.joinedAt - b.joinedAt; });
  return player;
}

// Pool of canned bot answers so the game looks alive in dev mode.
const KLPP_BOT_ANSWERS = [
  "котик в свитере", "капибара", "тёща с метлой", "сосед сверху",
  "пельмени без сметаны", "Wi-Fi 56kbps", "понедельник", "налоговая",
  "Олег Винник в спортзале", "пингвин в шапке", "запах подъезда",
  "бабушка с шваброй", "Bluetooth наушники у уха", "осенний депресс",
  "директор школы в роликах", "забытая микроволновка", "электричка в Бологое"
];
function klppRandomBotAnswer(){
  return KLPP_BOT_ANSWERS[Math.floor(Math.random() * KLPP_BOT_ANSWERS.length)];
}

// Bot autoplay: drives pending answers + votes for any isBot player while the
// game is running. Called from tickKlppRoom every 300ms.
function klppRunBotAutoplay(room){
  if(!room || !room.players) return;
  const now = Date.now();
  const elapsed = now - (room.phaseStartedAt || now);

  // ANSWER PHASE — bots fill in their pending assignments after a ~1.2s delay
  if(room.state === "answer" && room.currentRound && elapsed > 1200){
    const assignmentsByPlayer = room.currentRound.assignmentsByPlayer || {};
    room.players.forEach(function(p){
      if(!p.isBot) return;
      const list = assignmentsByPlayer[p.clientId] || [];
      list.forEach(function(assignment){
        if(assignment.status !== "pending") return;
        const stagger = (assignment.order || 0) * 900 + Math.random() * 600;
        if(elapsed < 1200 + stagger) return;
        
        if(room.currentRound.type === "meme_round"){
          const topText = klppRandomBotAnswer();
          const bottomText = klppRandomBotAnswer();
          assignment.answerText = JSON.stringify({top: topText, bottom: bottomText});
        } else {
          assignment.answerText = klppRandomBotAnswer();
        }
        
        assignment.submittedAt = Date.now();
        assignment.status = "answered";
      });
    });
  }

  // VOTE PHASE — bots cast a random vote after reveal animation finishes
  if(room.state === "vote" && room.currentRound && elapsed > KLPP_VOTE_REVEAL_MS + 800){
    const vote = getKlppCurrentVote(room);
    if(vote){
      const eligible = listKlppEligibleVoters(room, vote);
      room.players.forEach(function(p){
        if(!p.isBot) return;
        if(eligible.indexOf(p.clientId) === -1) return;
        if(vote.votes && vote.votes[p.clientId]) return; // already voted
        
        if(vote.type === "final_lash" || vote.type === "meme_round"){
          const eligibleAnswers = vote.answers.filter(function(a){ return a.clientId !== p.clientId && !a.missing; });
          if(eligibleAnswers.length > 0){
            const chosen = eligibleAnswers[Math.floor(Math.random() * eligibleAnswers.length)];
            vote.votes = vote.votes || {};
            vote.votes[p.clientId] = chosen.clientId;
          }
        } else {
          const leftValid = !vote.leftMissing;
          const rightValid = !vote.rightMissing;
          let target;
          if(leftValid && !rightValid) target = vote.leftClientId;
          else if(rightValid && !leftValid) target = vote.rightClientId;
          else target = Math.random() < 0.5 ? vote.leftClientId : vote.rightClientId;
          vote.votes = vote.votes || {};
          vote.votes[p.clientId] = target;
        }
      });
    }
  }
}

function buildKlppSnapshot(room, viewerClientId){
  const fakeReq = {
    headers: {host: ""},
    socket: {encrypted: false},
    url: "/api/klpp/room/" + room.id + (viewerClientId ? "?clientId=" + encodeURIComponent(viewerClientId) : "")
  };
  return serializeKlppRoom(room, fakeReq);
}

function broadcastKlppRoom(room){
  if(!room || !room.sseClients || !room.sseClients.size) return;
  room.sseClients.forEach(function(client){
    try{
      const snapshot = buildKlppSnapshot(room, client.clientId || "");
      client.res.write("data: " + JSON.stringify({type: "snapshot", room: snapshot}) + "\n\n");
    }catch(error){
      // res closed mid-write; cleanup happens via req.close handler
    }
  });
}

function ensureKlppSseSet(room){
  if(!room.sseClients) room.sseClients = new Set();
  return room.sseClients;
}

const KLPP_TICK_INTERVAL_MS = 300;

function klppGlobalTick(){
  klppRooms.forEach(function(room){
    if(room.state === "lobby" || room.state === "finished" || room.state === "paused") return;
    const prevState = room.state;
    const prevVoteIndex = room.currentRound ? room.currentRound.currentVoteIndex : -1;
    const prevRoundIndex = room.roundIndex;
    tickKlppRoom(room);
    const changed = prevState !== room.state
      || (room.currentRound && room.currentRound.currentVoteIndex !== prevVoteIndex)
      || room.roundIndex !== prevRoundIndex;
    if(changed) broadcastKlppRoom(room);
  });
}

setInterval(klppGlobalTick, KLPP_TICK_INTERVAL_MS).unref();

function serveStatic(req, res, pathname){
  let relativePath = pathname === "/" || pathname === "/klpp" ? "/klpp.html" : pathname;
  if(relativePath === "/editor" || relativePath === "/pikuco_tree_editor_live.html" || relativePath === "/live_sync.js"){
    sendJson(res, 404, {error: "Removed"});
    return;
  }
  relativePath = decodeURIComponent(relativePath);
  let filePath = path.normalize(path.join(PUBLIC_DIR, relativePath));
  if(!filePath.startsWith(PUBLIC_DIR)){
    sendJson(res, 403, {error: "Forbidden"});
    return;
  }
  if(fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()){
    filePath = path.join(filePath, "index.html");
  }
  fs.readFile(filePath, function(error, buffer){
    if(error){
      sendJson(res, 404, {error: "Not found"});
      return;
    }
    res.writeHead(200, {"Content-Type": contentType(filePath), "Cache-Control": "no-store"});
    res.end(buffer);
  });
}

const server = http.createServer(async function(req, res){
  const routeUrl = requestUrl(req);
  const pathname = routeUrl.pathname;

  if(req.method === "GET" && pathname === "/api/health"){
    sendJson(res, 200, {ok: true});
    return;
  }

  if(req.method === "GET" && pathname === "/api/klpp/config"){
    const lanHosts = listLanHosts();
    sendJson(res, 200, {
      ok: true,
      origin: publicOrigin(req),
      host: preferredHost(req),
      hosts: lanHosts,
      lanHosts: lanHosts,
      publicUrl: PUBLIC_URL
    });
    return;
  }

  // ─── MEME IMAGE UPLOAD ─────────────────────────────────────────────
  // POST /api/klpp/upload-meme
  // Accepts JSON { data: "base64-jpeg-string" }
  // Client-side Canvas converts any image to JPEG before sending.
  // Server validates JPEG header, enforces 512KB limit, saves to uploads/.
  if(req.method === "POST" && pathname === "/api/klpp/upload-meme"){
    try {
      const body = await parseBody(req);
      const b64 = String(body.data || "");
      if(!b64) {
        sendJson(res, 400, {ok: false, error: "Нет данных изображения"});
        return;
      }
      // Strip optional data URI prefix
      const raw = b64.replace(/^data:image\/[a-z+]+;base64,/, "");
      const buf = Buffer.from(raw, "base64");

      // Validate size (max 512KB)
      if(buf.length > 512 * 1024) {
        sendJson(res, 400, {ok: false, error: "Изображение слишком большое (макс. 512KB после сжатия)"});
        return;
      }
      if(buf.length < 100) {
        sendJson(res, 400, {ok: false, error: "Слишком маленький файл — вероятно повреждён"});
        return;
      }

      // Validate JPEG magic bytes: FF D8 FF
      if(buf[0] !== 0xFF || buf[1] !== 0xD8 || buf[2] !== 0xFF) {
        sendJson(res, 400, {ok: false, error: "Файл не является валидным JPEG"});
        return;
      }

      // Ensure uploads dir exists
      const uploadsDir = path.join(PUBLIC_DIR, "klpp-assets", "memes", "uploads");
      if(!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, {recursive: true});
      }

      // Count existing uploads — hard cap at 200 files to prevent abuse
      const existingFiles = fs.readdirSync(uploadsDir).filter(f => f.endsWith(".jpg"));
      if(existingFiles.length >= 200) {
        sendJson(res, 400, {ok: false, error: "Достигнут лимит загруженных изображений (200). Удалите старые."});
        return;
      }

      // Generate random filename
      const filename = "meme_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8) + ".jpg";
      const filePath = path.join(uploadsDir, filename);
      fs.writeFileSync(filePath, buf);

      const url = "/klpp-assets/memes/uploads/" + filename;
      sendJson(res, 200, {ok: true, url: url, size: buf.length});
    } catch(error) {
      sendJson(res, 400, {ok: false, error: error.message});
    }
    return;
  }

  if(req.method === "GET" && pathname === "/api/klpp/question-sets"){
    sendJson(res, 200, {ok: true, questionSets: loadQuestionSets()});
    return;
  }

  if(req.method === "POST" && pathname === "/api/klpp/question-sets"){
    try{
      const body = await parseBody(req);
      if(!body.name){
        sendJson(res, 400, {ok: false, error: "Название набора обязательно"});
        return;
      }
      const saved = saveQuestionSet(body);
      sendJson(res, 200, {ok: true, questionSet: saved});
    }catch(error){
      sendJson(res, 400, {ok: false, error: error.message});
    }
    return;
  }

  const klppDeleteSetMatch = pathname.match(/^\/api\/klpp\/question-sets\/([^/]+)$/);
  if(req.method === "DELETE" && klppDeleteSetMatch){
    try{
      const id = klppDeleteSetMatch[1];
      const success = deleteQuestionSet(id);
      if(success){
        sendJson(res, 200, {ok: true});
      }else{
        sendJson(res, 400, {ok: false, error: "Не удалось удалить набор (возможно, это стандартный набор)"});
      }
    }catch(error){
      sendJson(res, 400, {ok: false, error: error.message});
    }
    return;
  }

  if(req.method === "GET" && pathname === "/api/klpp/modifiers"){
    sendJson(res, 200, {ok: true, modifiers: klppListAvailableModifiers(), roundCountPresets: KLPP_ROUND_COUNT_PRESETS});
    return;
  }

  if(req.method === "POST" && pathname === "/api/klpp/rooms"){
    if(!tryRateLimitRoomCreation(clientIp(req))){
      sendJson(res, 429, {ok: false, error: "Слишком много новых комнат с этого устройства. Подожди пару минут."});
      return;
    }
    const room = createKlppRoom();
    sendJson(res, 200, {ok: true, room: serializeKlppRoom(room, req), hostKey: room.hostKey});
    return;
  }

  // ─── DEV MODE ──────────────────────────────────────────────────────
  // POST /api/klpp/dev/start
  // Creates a room, fills it with bots, starts the game. Returns roomId +
  // hostKey so the caller can navigate to host view and pause/skip from UI.
  // Body (all optional): {botCount: 3..6, settings: {...}}
  if(req.method === "POST" && pathname === "/api/klpp/dev/start"){
    try{
      if(!tryRateLimitRoomCreation(clientIp(req))){
        sendJson(res, 429, {ok: false, error: "Слишком часто. Подожди немного."});
        return;
      }
      const body = await parseBody(req);
      const botCount = Math.max(3, Math.min(8, Number(body.botCount) || 3));
      const room = createKlppRoom();
      if(body.settings) room.settings = sanitizeKlppSettings(Object.assign({}, room.settings, body.settings));
      const botNames = ["Robo-Лёха", "Бот-Маша", "ИИ-Витя", "Гена-Skynet", "Нейро-Зина", "GPT-Семён", "АвтоТаня", "Бот-Анон"];
      const botColors = ["#ff6b6b","#4d96ff","#6bcb77","#ffd93d","#b388ff","#ff9f1c","#ff6f91","#00c2a8"];
      const botFaces = ["smile","cool","nerd","sleepy","clown","alien","robot","mustache"];
      for(let i = 0; i < botCount; i += 1){
        upsertKlppPlayer(room, "bot-" + room.id.toLowerCase() + "-" + i, botNames[i % botNames.length], {color: botColors[i % botColors.length], face: botFaces[i % botFaces.length]}, {isBot: true});
      }
      startKlppGame(room);
      broadcastKlppRoom(room);
      sendJson(res, 200, {ok: true, room: serializeKlppRoom(room, req), hostKey: room.hostKey});
    }catch(error){
      sendJson(res, 400, {ok: false, error: error.message});
    }
    return;
  }

  // POST /api/klpp/room/:id/dev/skip
  // Fast-forwards the current phase: pretend the timer fully expired,
  // fill any missing answers, finalize current vote, advance to the next
  // phase. hostKey-gated so randos can't grief a live match.
  const klppDevSkipMatch = pathname.match(/^\/api\/klpp\/room\/([^/]+)\/dev\/skip$/);
  if(req.method === "POST" && klppDevSkipMatch){
    try{
      const room = getKlppRoom(klppDevSkipMatch[1]);
      if(!room){ sendJson(res, 404, {ok: false, error: "Room not found"}); return; }
      const body = await parseBody(req);
      if(!hasKlppHostAccess(room, body)){
        sendJson(res, 403, {ok: false, error: "Только хост может скипать фазы"});
        return;
      }
      switch(room.state){
        case "launch":       setKlppState(room, "round_intro"); break;
        case "round_intro":  setKlppState(room, "answer"); break;
        case "answer":       beginKlppVoting(room); break;
        case "vote":         finalizeKlppVote(room); break;
        case "vote_result":  moveKlppToNextVoteOrScore(room); break;
        case "round_score":  setupKlppRound(room); setKlppState(room, "round_intro"); break;
        default: break;
      }
      broadcastKlppRoom(room);
      sendJson(res, 200, {ok: true, room: serializeKlppRoom(room, req)});
    }catch(error){
      sendJson(res, 400, {ok: false, error: error.message});
    }
    return;
  }

  const klppRoomMatch = pathname.match(/^\/api\/klpp\/room\/([^/]+)$/);
  if(req.method === "GET" && klppRoomMatch){
    const room = getKlppRoom(klppRoomMatch[1]);
    if(!room){
      sendJson(res, 404, {ok: false, error: "Room not found"});
      return;
    }
    sendJson(res, 200, {ok: true, room: serializeKlppRoom(room, req)});
    return;
  }

  const klppJoinMatch = pathname.match(/^\/api\/klpp\/room\/([^/]+)\/join$/);
  if(req.method === "POST" && klppJoinMatch){
    try{
      const room = getKlppRoom(klppJoinMatch[1]);
      if(!room){
        sendJson(res, 404, {ok: false, error: "Room not found"});
        return;
      }
      const body = await parseBody(req);
      if(!String(body.clientId || "").trim()){
        sendJson(res, 400, {ok: false, error: "Missing clientId"});
        return;
      }
      if(room.state !== "lobby"){
        const existing = room.players.find(function(p){ return p.clientId === String(body.clientId || "").trim(); });
        if(!existing){
          sendJson(res, 409, {ok: false, error: "Игра уже идёт, дождитесь окончания"});
          return;
        }
      }
      const player = upsertKlppPlayer(room, body.clientId, body.nickname, body.avatar);
      broadcastKlppRoom(room);
      sendJson(res, 200, {ok: true, player: clone(player), room: serializeKlppRoom(room, req)});
    }catch(error){
      sendJson(res, 400, {ok: false, error: error.message});
    }
    return;
  }

  const klppAvatarMatch = pathname.match(/^\/api\/klpp\/room\/([^/]+)\/avatar$/);
  if(req.method === "POST" && klppAvatarMatch){
    try{
      const room = getKlppRoom(klppAvatarMatch[1]);
      if(!room){
        sendJson(res, 404, {ok: false, error: "Room not found"});
        return;
      }
      const body = await parseBody(req);
      const clientId = String(body.clientId || "").trim();
      const player = room.players.find(function(p){ return p.clientId === clientId; });
      if(!player){
        sendJson(res, 403, {ok: false, error: "Unknown player"});
        return;
      }
      if(typeof body.nickname === "string"){
        const safeNickname = body.nickname.trim().slice(0, 32);
        if(safeNickname) player.nickname = safeNickname;
      }
      if(body.avatar){
        player.avatar = sanitizeKlppAvatar(body.avatar, player.avatar);
      }
      player.lastSeenAt = Date.now();
      broadcastKlppRoom(room);
      sendJson(res, 200, {ok: true, player: clone(player), room: serializeKlppRoom(room, req)});
    }catch(error){
      sendJson(res, 400, {ok: false, error: error.message});
    }
    return;
  }

  const klppSettingsMatch = pathname.match(/^\/api\/klpp\/room\/([^/]+)\/settings$/);
  if(req.method === "POST" && klppSettingsMatch){
    try{
      const room = getKlppRoom(klppSettingsMatch[1]);
      if(!room){
        sendJson(res, 404, {ok: false, error: "Room not found"});
        return;
      }
      const body = await parseBody(req);
      const isHost = hasKlppHostAccess(room, body);
      const isLeader = hasKlppLeaderAccess(room, body);
      if(!isHost && !isLeader){
        sendJson(res, 403, {ok: false, error: "Только хост или owner-игрок могут менять настройки"});
        return;
      }
      if(room.state !== "lobby"){
        sendJson(res, 409, {ok: false, error: "Настройки можно менять только в лобби"});
        return;
      }
      room.settings = sanitizeKlppSettings(body.settings);
      broadcastKlppRoom(room);
      sendJson(res, 200, {ok: true, room: serializeKlppRoom(room, req)});
    }catch(error){
      sendJson(res, 400, {ok: false, error: error.message});
    }
    return;
  }

  const klppStartMatch = pathname.match(/^\/api\/klpp\/room\/([^/]+)\/start$/);
  if(req.method === "POST" && klppStartMatch){
    try{
      const room = getKlppRoom(klppStartMatch[1]);
      if(!room){
        sendJson(res, 404, {ok: false, error: "Room not found"});
        return;
      }
      const body = await parseBody(req);
      if(!hasKlppLeaderAccess(room, body)){
        sendJson(res, 403, {ok: false, error: "Только owner-игрок может начать"});
        return;
      }
      if(room.state !== "lobby"){
        sendJson(res, 409, {ok: false, error: "Игра уже идёт"});
        return;
      }
      const needPlayers = klppMinPlayersForSettings(room.settings);
      if(room.players.length < needPlayers){
        sendJson(res, 409, {ok: false, error: "Нужно минимум " + needPlayers + " игроков"});
        return;
      }
      startKlppGame(room);
      broadcastKlppRoom(room);
      sendJson(res, 200, {ok: true, room: serializeKlppRoom(room, req)});
    }catch(error){
      sendJson(res, 400, {ok: false, error: error.message});
    }
    return;
  }

  const klppAnswerMatch = pathname.match(/^\/api\/klpp\/room\/([^/]+)\/answer$/);
  if(req.method === "POST" && klppAnswerMatch){
    try{
      const room = getKlppRoom(klppAnswerMatch[1]);
      if(!room){
        sendJson(res, 404, {ok: false, error: "Room not found"});
        return;
      }
      tickKlppRoom(room);
      if(room.state !== "answer"){
        sendJson(res, 409, {ok: false, error: "Фаза ответов уже закрылась"});
        return;
      }
      const body = await parseBody(req);
      const clientId = String(body.clientId || "").trim();
      const text = String(body.text || "").trim();
      const pairId = String(body.pairId || "").trim();
      if(!clientId || !room.players.find(function(player){ return player.clientId === clientId; })){
        sendJson(res, 403, {ok: false, error: "Unknown player"});
        return;
      }
      if(!text){
        sendJson(res, 400, {ok: false, error: "Пустой ответ"});
        return;
      }
      // Modifier validation hook (e.g. ONE_WORD): all active modifiers can veto
      const activeMods = (room.currentRound && room.currentRound.modifiers) || [];
      for(let i = 0; i < activeMods.length; i += 1){
        const def = KLPP_MODIFIERS[activeMods[i]];
        if(def && typeof def.validateAnswer === "function"){
          const verdict = def.validateAnswer(text, {room: room, clientId: clientId});
          if(verdict && verdict.ok === false){
            sendJson(res, 400, {ok: false, error: verdict.error || "Ответ не подходит"});
            return;
          }
        }
      }
      const assignments = room.currentRound && room.currentRound.assignmentsByPlayer[clientId] ? room.currentRound.assignmentsByPlayer[clientId] : [];
      const assignment = pairId
        ? assignments.find(function(item){ return item.pairId === pairId; })
        : assignments.find(function(item){ return item.status === "pending"; });
      if(!assignment){
        sendJson(res, 409, {ok: false, error: "Нет такого вопроса"});
        return;
      }
      if(assignment.status !== "pending"){
        sendJson(res, 409, {ok: false, error: "Ответ уже принят"});
        return;
      }
      assignment.answerText = text.slice(0, 220);
      assignment.submittedAt = Date.now();
      assignment.status = "answered";
      tickKlppRoom(room);
      broadcastKlppRoom(room);
      sendJson(res, 200, {ok: true, room: serializeKlppRoom(room, req)});
    }catch(error){
      sendJson(res, 400, {ok: false, error: error.message});
    }
    return;
  }

  const klppVoteMatch = pathname.match(/^\/api\/klpp\/room\/([^/]+)\/vote$/);
  if(req.method === "POST" && klppVoteMatch){
    try{
      const room = getKlppRoom(klppVoteMatch[1]);
      if(!room){
        sendJson(res, 404, {ok: false, error: "Room not found"});
        return;
      }
      tickKlppRoom(room);
      if(room.state !== "vote"){
        sendJson(res, 409, {ok: false, error: "Голосование уже закрылось"});
        return;
      }
      const body = await parseBody(req);
      const clientId = String(body.clientId || "").trim();
      const targetClientId = String(body.targetClientId || "").trim();
      if(!clientId || !room.players.find(function(player){ return player.clientId === clientId; })){
        sendJson(res, 403, {ok: false, error: "Unknown player"});
        return;
      }
      const currentVote = getKlppCurrentVote(room);
      if(!currentVote){
        sendJson(res, 409, {ok: false, error: "Голосование уже закрылось"});
        return;
      }
      const pairId = String(body.pairId || "").trim();
      if(pairId && pairId !== currentVote.pairId){
        sendJson(res, 409, {ok: false, error: "Этот вопрос уже сменился"});
        return;
      }
      if(currentVote.type === "final_lash" || currentVote.type === "meme_round"){
        if(!currentVote.answers.some(function(a){ return a.clientId === targetClientId; })){
          sendJson(res, 400, {ok: false, error: "Неизвестный кандидат"});
          return;
        }
        if(clientId === targetClientId){
          sendJson(res, 400, {ok: false, error: "Нельзя голосовать за самого себя"});
          return;
        }
      } else {
        if(targetClientId !== currentVote.leftClientId && targetClientId !== currentVote.rightClientId){
          sendJson(res, 400, {ok: false, error: "Неизвестный кандидат"});
          return;
        }
        const eligibleVoters = listKlppEligibleVoters(room, currentVote);
        if(eligibleVoters.indexOf(clientId) === -1){
          sendJson(res, 403, {ok: false, error: "Ты не можешь голосовать в этом вопросе"});
          return;
        }
      }
      currentVote.votes = currentVote.votes || {};
      currentVote.votes[clientId] = targetClientId;
      tickKlppRoom(room);
      broadcastKlppRoom(room);
      sendJson(res, 200, {ok: true, room: serializeKlppRoom(room, req)});
    }catch(error){
      sendJson(res, 400, {ok: false, error: error.message});
    }
    return;
  }

function klppCanPlayerSelectAbility(room, clientId) {
  if (room.state !== "answer") return false;
  
  const activeMods = room.currentRound ? (room.currentRound.modifiers || []) : [];
  const hasParty = activeMods.indexOf("ability_party") !== -1;
  const hasLeader = activeMods.indexOf("leader_abilities") !== -1;
  
  if (hasParty) return true;
  if (hasLeader) {
    return clientId === klppGetLeaderClientId(room);
  }
  return false;
}

  const klppAbilityMatch = pathname.match(/^\/api\/klpp\/room\/([^/]+)\/ability$/);
  if(req.method === "POST" && klppAbilityMatch){
    try{
      const room = getKlppRoom(klppAbilityMatch[1]);
      if(!room){
        sendJson(res, 404, {ok: false, error: "Room not found"});
        return;
      }
      if(room.state !== "answer"){
        sendJson(res, 409, {ok: false, error: "Не та фаза"});
        return;
      }
      const elapsed = Date.now() - room.phaseStartedAt;
      if(elapsed > 10000){
        sendJson(res, 409, {ok: false, error: "Время выбора способности истекло"});
        return;
      }
      const body = await parseBody(req);
      const reqClientId = String(body.clientId || "").trim();
      
      if (!klppCanPlayerSelectAbility(room, reqClientId)) {
        sendJson(res, 403, {ok: false, error: "Вы не можете выбирать способность сейчас"});
        return;
      }
      
      const abilityId = String(body.abilityId || "").trim();
      const selectObj = room.playerAbilitiesSelect[reqClientId];
      if(!selectObj){
        sendJson(res, 400, {ok: false, error: "Нет доступных опций"});
        return;
      }
      const isOption = selectObj.options.some(function(o){ return o.id === abilityId; });
      const isHeld = selectObj.held && selectObj.held.id === abilityId;
      if(!isOption && !isHeld){
        sendJson(res, 400, {ok: false, error: "Недопустимый выбор"});
        return;
      }
      
      selectObj.chosen = abilityId;
      room.playerHeldAbilities = room.playerHeldAbilities || {};
      room.playerHeldAbilities[reqClientId] = abilityId;
      
      broadcastKlppRoom(room);
      sendJson(res, 200, {ok: true, room: serializeKlppRoom(room, req)});
    }catch(error){
      sendJson(res, 400, {ok: false, error: error.message});
    }
    return;
  }

  const klppUseAbilityMatch = pathname.match(/^\/api\/klpp\/room\/([^/]+)\/use-ability$/);
  if(req.method === "POST" && klppUseAbilityMatch){
    try{
      const room = getKlppRoom(klppUseAbilityMatch[1]);
      if(!room){
        sendJson(res, 404, {ok: false, error: "Room not found"});
        return;
      }
      if(room.state !== "answer"){
        sendJson(res, 409, {ok: false, error: "Не та фаза"});
        return;
      }
      const body = await parseBody(req);
      const reqClientId = String(body.clientId || "").trim();
      
      room.playerHeldAbilities = room.playerHeldAbilities || {};
      const heldAbility = room.playerHeldAbilities[reqClientId];
      if(!heldAbility){
        sendJson(res, 400, {ok: false, error: "У вас нет удерживаемой способности"});
        return;
      }
      
      // Move from held to active (spent)
      room.playerActiveAbilities = room.playerActiveAbilities || {};
      room.playerActiveAbilities[reqClientId] = heldAbility;
      delete room.playerHeldAbilities[reqClientId];
      
      // Apply instant effects
      if(heldAbility === "freeze_timer"){
        room.phaseDurationMs += 25000;
        if(room.phaseEndsAt) room.phaseEndsAt += 25000;
      } else if(heldAbility === "reduce_timer"){
        const elapsedSec = (Date.now() - room.phaseStartedAt) / 1000;
        if(elapsedSec < 20){
          room.phaseDurationMs = 20000;
          room.phaseEndsAt = room.phaseStartedAt + 20000;
        }
      } else if(heldAbility === "swap_questions"){
        klppSwapQuestions(room, reqClientId);
      }
      
      broadcastKlppRoom(room);
      sendJson(res, 200, {ok: true, room: serializeKlppRoom(room, req)});
    }catch(error){
      sendJson(res, 400, {ok: false, error: error.message});
    }
    return;
  }

  const klppPauseMatch = pathname.match(/^\/api\/klpp\/room\/([^/]+)\/pause$/);
  if(req.method === "POST" && klppPauseMatch){
    try{
      const room = getKlppRoom(klppPauseMatch[1]);
      if(!room){
        sendJson(res, 404, {ok: false, error: "Room not found"});
        return;
      }
      const body = await parseBody(req);
      if(!hasKlppHostAccess(room, body)){
        sendJson(res, 403, {ok: false, error: "Только хост может ставить паузу"});
        return;
      }
      pauseKlppRoom(room);
      broadcastKlppRoom(room);
      sendJson(res, 200, {ok: true, room: serializeKlppRoom(room, req)});
    }catch(error){
      sendJson(res, 400, {ok: false, error: error.message});
    }
    return;
  }

  const klppEndMatch = pathname.match(/^\/api\/klpp\/room\/([^/]+)\/end$/);
  if(req.method === "POST" && klppEndMatch){
    try{
      const room = getKlppRoom(klppEndMatch[1]);
      if(!room){
        sendJson(res, 404, {ok: false, error: "Room not found"});
        return;
      }
      const body = await parseBody(req);
      if(!hasKlppHostAccess(room, body)){
        sendJson(res, 403, {ok: false, error: "Только хост может закончить игру"});
        return;
      }
      endKlppRoom(room, body.showScore !== false);
      broadcastKlppRoom(room);
      sendJson(res, 200, {ok: true, room: serializeKlppRoom(room, req)});
    }catch(error){
      sendJson(res, 400, {ok: false, error: error.message});
    }
    return;
  }

  const klppEventsMatch = pathname.match(/^\/api\/klpp\/room\/([^/]+)\/events$/);
  if(req.method === "GET" && klppEventsMatch){
    const room = getKlppRoom(klppEventsMatch[1]);
    if(!room){
      sendJson(res, 404, {ok: false, error: "Room not found"});
      return;
    }
    const viewerClientId = String(routeUrl.searchParams.get("clientId") || "").trim();
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no"
    });
    res.write("retry: 2000\n\n");
    const clients = ensureKlppSseSet(room);
    const client = {res: res, clientId: viewerClientId};
    clients.add(client);
    res.write("data: " + JSON.stringify({type: "snapshot", room: buildKlppSnapshot(room, viewerClientId)}) + "\n\n");
    const keepAlive = setInterval(function(){
      try{ res.write(": ping " + Date.now() + "\n\n"); }catch(error){}
    }, 15000);
    keepAlive.unref();
    const cleanup = function(){
      clearInterval(keepAlive);
      clients.delete(client);
      try{ res.end(); }catch(error){}
    };
    req.on("close", cleanup);
    req.on("error", cleanup);
    return;
  }

  if(req.method === "GET"){
    serveStatic(req, res, pathname);
    return;
  }

  sendJson(res, 405, {error: "Method not allowed"});
});

server.listen(PORT, HOST, function(){
  console.log("KLPP server running on http://localhost:" + PORT);
});
