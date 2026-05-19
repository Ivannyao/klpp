# KLPP — onboarding

Браузерная multiplayer party game в стиле Jackbox / «Смехлыст». Хост-экран на ТВ/ПК, игроки на телефонах.

**🌐 Production:** https://klpp.onrender.com/klpp (Render Free, auto-deploy from `main`)
**💻 Source:** https://github.com/Ivannyao/klpp (локально — `C:\IIG\klpp`)

## ⚠️ Sync Protocol (важно для всех AI-агентов)

Над этим репо работают несколько человек/агентов параллельно (Claude Code, Antigravity, ручные правки). Чтобы не было конфликтов и потерянных правок — **всегда** следуй протоколу:

**В начале сессии:**
```bash
git pull origin main --rebase --autostash
```
Так ты получишь изменения от других агентов до того как начнёшь работать.

**В конце сессии (или после каждого осмысленного блока работы):**
```bash
git add -A
git commit -m "<короткое описание что сделал>"
git pull origin main --rebase --autostash   # повтор на случай если за время работы кто-то ещё запушил
git push origin main
```

**Если возник rebase conflict:**
- НЕ паникуй и НЕ делай `git push --force`
- Reшoлвь конфликт: открой файлы с маркерами `<<<<`, `====`, `>>>>`, выбери правильные версии
- `git add <resolved>` + `git rebase --continue`
- Если не уверен — `git rebase --abort` и спроси у человека

**Identity:** установи свою git identity (имя/email) глобально, чтобы коммиты были подписаны корректно:
```bash
git config --global user.name "<твой ник>"
git config --global user.email "<твой email>"
```

Claude Code в этом репо настроен на автоматический pull при старте сессии и автоматический commit+push после каждого ответа (через хуки в `.claude/`). Если ты в другой IDE — делай это руками или настрой свой эквивалент.

## Quick start

```powershell
cd C:\IIG\klpp
node server.js
```

Открыть http://127.0.0.1:3000/klpp в браузере. Нет зависимостей — чистый Node стандартной библиотеки, поэтому `npm install` не нужен (`package.json` есть, но `dependencies` пустой).

Для расшаривания вовне используется `cloudflared` quick-tunnel:

```powershell
# первый раз
Invoke-WebRequest "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile "$env:TEMP\cloudflared.exe"
# запуск
& "$env:TEMP\cloudflared.exe" tunnel --url http://127.0.0.1:3000 --protocol http2 --no-autoupdate
```

Quick-tunnel выдаёт случайный домен `xxx.trycloudflare.com`. Живёт пока процесс жив, после рестарта домен меняется. QUIC у местного провайдера блокируется — обязательно `--protocol http2`.

## Архитектура

**Транспорт:** REST + SSE. Чистый Node `http` (без Express). Клиент держит SSE-подключение на `/api/klpp/room/:id/events` + watchdog: если за 4 сек snapshot не пришёл, стартует polling 1.2с как fallback. При reconnect SSE автоматически отменяет polling.

**Комнаты:** `klppRooms` Map в памяти. ID 4 символа (alphanumeric uppercase). GC раз в 5 минут: пустые старше 30 мин или любые старше 12 часов — удаляются. Rate-limit 10 комнат / 5 минут / IP.

**Авторизация:**
- `hostKey` (Math.random, sessionStorage) — для пауз/завершения с хост-экрана
- Первый зашедший игрок = **owner**, только он может стартовать
- Минимум 3 игрока для старта
- `clientId` в localStorage (`klppClientId`)

**State machine комнаты:**
`lobby → launch → round_intro → answer → vote → vote_result → (next vote_index ИЛИ round_score) → round_intro... → finished`

Переходы автоматические в `tickKlppRoom` (тик-луп каждые 300мс). Хост может только паузить/завершать, играть не может — это by design.

**Settings (`room.settings`):**
- `answerSeconds`, `voteSeconds` — таймеры фаз
- `roundCount` — число раундов (preset 3/5/7, поддерживается 1-12)
- `selfVotingEnabled` — авторы могут голосовать в своей паре
- `anonymousAnswers` — скрывает имена авторов до vote_result
- `doublePointsLastRound` — финальный раунд × 2 (применяется ПОСЛЕ modifier-хуков, поэтому работает поверх любого модификатора)
- `modifierMode`: `off` | `fixed` (все выбранные активны весь матч) | `random` (1 случайный из выбранных в каждый раунд)
- `selectedModifiers: string[]`

## Modifier System

Реестр `KLPP_MODIFIERS` в `server.js`. Каждый модификатор:

```js
{
  id, name, icon, description, minPlayers,
  notImplemented?: bool,  // UI показывает но выбрать нельзя
  validateAnswer(text, ctx),     // hook: вето на /answer (ONE_WORD)
  transformScore(ctx),           // hook: меняет scoring (REVERSE_SCORING, STEAL, COMBO)
  onVoteResolved(room, vote, result)  // hook: после finalize (COMBO трекает streak)
}
```

**Назначение в раунд** делает `klppAssignModifiersToRound(room)` в `setupKlppRound`.

**Готовые модификаторы:**
- `one_word` — сервер валидирует одно слово, клиент показывает подсказку в реальном времени.
- `reverse_scoring` — меняет местами начисление очков (очки получает худший ответ).
- `steal` — победитель крадет 25% очков у соперника (с визуальной вспышкой кражи).
- `combo` — победы подряд дают бонус +25% за каждую серию (визуальный индикатор серии 🔥×N).
- `reverse_round` — игрокам показывается готовый ответ, и они должны придумать к нему смешной вопрос.
- `blind_round` — игрокам виден только тип ответа (подсказка), но не сам вопрос.
- `drunk_mode` — интерфейс начинает качаться и плыть (CSS wobble-анимация на body).
- `ability_party` — вечеринка способностей, все игроки могут выбрать способность.
- `leader_abilities` — способности лидера, игрок с наибольшим счетом получает способности.

**Заглушек (`notImplemented`) в системе не осталось.**

## Файлы

| Файл | Что |
|---|---|
| `server.js` | Весь сервер. Modifier registry, state machine, SSE broadcast, sanitize settings |
| `public/klpp.html` | Все экраны: home, settings, host, join, player. Inline `<style>` ~700 строк CSS |
| `public/klpp-client.js` | Весь клиент: state machine, SSE, render-функции, character editor, modifier checklist, anonymous-aware vote-карточки, round transition |
| `public/klpp-assets/` | Картинки лобби и иконки |
| `render.yaml` | Blueprint для деплоя на Render (free plan) |

## Что готово

- ✅ Главное меню (desktop + mobile, два разных layout с word-jitter анимациями)
- ✅ Host лобби: QR + код комнаты, игроки на холме, smart fly-from-sky анимация (diff-render)
- ✅ Settings UI: 7 полей + modifier checklist с описаниями
- ✅ Character editor на mobile (color + face emoji, live sync через debounce 250мс)
- ✅ Owner-only START button с проверкой 3+ игроков
- ✅ Полный игровой цикл: answer → vote → vote_result → round_score → finished
- ✅ Round-robin пары (C(n,2) пар на раунд)
- ✅ Round transition screen (чёрный «РАУНД N» + бейджи модификаторов)
- ✅ Anonymous mode: «Игрок А/Б» в фазе vote, раскрытие в vote_result
- ✅ Double points last round (поверх модификаторов)
- ✅ ONE_WORD modifier (server + client realtime validation)
- ✅ REVERSE_SCORING modifier
- ✅ Reconnect (SSE auto + polling fallback)
- ✅ Visibility-based polling pause
- ✅ Pause/resume (хост, hostKey-gated, сохраняет remaining timer)
- ✅ 404 на player view → редирект на /join
- ✅ Cinematic Host Redesign (Lobby, Answer phase with video bg, Voting phase, Scoreboard with curtains, Round intro)
- ✅ Wave transition between Answer and Vote phases.
- ✅ Fixed ReferenceError in klpp-client.js and CSS z-index conflicts.
- ✅ **Итерация 2 (модификаторы):** Включены `steal`, `combo`, `drunk_mode` (CSS-анимация качающегося интерфейса, аудио-эффекты, отображение серий и кражи очков).
- ✅ **Итерация 3 (сложные модификаторы):** Реализованы `reverse_round` (придумывание вопросов к готовым ответам) и `blind_round` (выдача грамматических подсказок вместо вопросов).
- ✅ **Итерация 4: Способности лидера и Вечеринка способностей (Вариант В):**
  - ✅ **Инвентарь способностей (Held Abilities):** При выборе суперспособность сохраняется в `heldAbility` и не тратится автоматически.
  - ✅ **Ручная активация способностей:** Игрок имеет виджет активации над формой ввода ответа, активирующий способность in `activeAbility` в любой момент фазы ответов.
  - ✅ **Интерактивные суперспособности:** «Заморозка времени» (+25с), «Сокращение времени» (до 20с), «Обмен вопросами», «Вступить в бой» (+50% очков) и «Шпионаж» (реальное время).
  - ✅ **Умный выбор и перенос:** Непотраченная способность переносится на следующий раунд (предлагается «Оставить текущую» + 2 новых на замену). Потраченная способность сгорает и открывает 3 новых случайных варианта.
- ✅ **Итерация 5 (host screen redesign):** Кинематографичное лобби, фаза ответов с улетающими иконками, фаза голосования с круговым таймером, подиум с занавесом на экране результатов.
- ✅ **Багфикс:** Исправлено падение сервера при совместном использовании нескольких очковых модификаторов (в `klppRunModifierHook` теперь корректно передаются свойства `room` и `vote` для всей цепочки модификаторов).

## Что осталось

На данный момент все запланированные итерации (1-5) полностью реализованы и интегрированы. Система готова к тестированию и дальнейшим пожеланиям по новым функциям.

## Известные ограничения

- `hostKey` через `Math.random()` (не crypto) — для шуточной party-игры приемлемо
- localStorage `clientId` общий между вкладками одного домена — две вкладки = один игрок
- QR-код тянется с внешнего `api.qrserver.com` (single point of failure, в РФ может блокироваться)
- Cloudflared quick-tunnel периодически умирает — нужно перезапускать
- Pikuco-редактор удалён полностью; `/editor` отдаёт 404

## E2E проверка

Backend проверяется через PowerShell скрипт — создание комнаты, 3 join'а, owner-only `/start`, full round-robin до `finished` state. Если что-то крашится — посмотреть консоль node + DevTools на клиенте.
