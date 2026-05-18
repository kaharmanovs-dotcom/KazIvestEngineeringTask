# KazIvestEngineeringTask

Тестовое fullstack: чат с прокси к OpenAI + (усложнёнка) голос в текст через Web Speech API. ТЗ: [Google Doc](https://docs.google.com/document/d/1DaS95vwVQb27_IO_VujcvVm5vK89FPYJIkN_qOx8tp4/edit?tab=t.0).

## Стек (как договорились + что разрешено в ТЗ)

- **Vue 3 + Vite** — фронт. Почему Vite: официально рекомендуют как стандартный билд для Vue, см. [Quick Start](https://vuejs.org/guide/quick-start.html).
- **БЭМ** — классы вида `ai-chat__composer`, `ai-chat__mic--on` и т.д., чтобы по разметке было видно блок/элемент/модификатор ([коротко про БЭМ](https://ru.bem.info/methodology/quick-start/)).
- **Express** — бэкенд, держит `OPENAI_API_KEY` только на сервере (ключ в браузер не светим — это не «паранойя», это нормальная модель для API-ключей). Старт по классике: [Express — установка](https://expressjs.com/en/starter/installing.html).
- **OpenAI Chat Completions** — зовём `https://api.openai.com/v1/chat/completions` через `fetch` на Node 18+ (отдельный SDK не тащил — меньше зависимостей, поведение прозрачное). Формат запроса/ответа как в доке: [Chat Completions](https://platform.openai.com/docs/api-reference/chat/create).
- **Голос** — `SpeechRecognition` / `webkitSpeechRecognition`, потому что в ТЗ прямым текстом разрешили Web Speech API; удобная выжимка по браузерам/ограничениям на MDN: [SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition). Про префикс `webkit` в Chrome часто всплывает в обсуждениях на Stack Overflow, например тут: [webkitSpeechRecognition vs SpeechRecognition](https://stackoverflow.com/questions/23728542/google-chrome-33-beta-speech-recognition-webspeechapi-broken) (да, тред старый, но суть про префиксы до сих пор актуальная в части браузеров).

Про **прокси в dev**: в `client/vite.config.js` настроен `server.proxy` на `127.0.0.1:3000`, чтобы с фронта ходить на `/api/...` без CORS-танцев с бубном (это штатная фича Vite: [server.proxy](https://vitejs.dev/config/server-options.html#server-proxy)).

## Запуск локально

1) **Переменные окружения для сервера**

Скопируй `server/.env.example` → `server/.env` и вставь свой `OPENAI_API_KEY`.

2) **Терминал A — API**

```bash
cd server
npm install
npm run dev
```

3) **Терминал B — фронт**

```bash
cd client
npm install
npm run dev
```

Открой `http://localhost:5173`.

Если вдруг гоняешь **`vite preview`**, прокси из dev-режима не работает как ты ожидаешь — тогда либо подними `SERVE_STATIC` (см. ниже), либо создай `client/.env` из `client/.env.example` и пропиши `VITE_API_BASE_URL=http://localhost:3000`.

## Один процесс на проде (удобно для «дайте потыкать по ссылке»)

```bash
cd client && npm install && npm run build
cd ../server && npm install
set SERVE_STATIC=true
set CLIENT_ORIGIN=http://localhost:3000
node src/index.js
```

На Linux/mac вместо `set` — `export`. После этого UI и API будут с одного порта (например 3000), ключ остаётся на сервере.

## Обработка ошибок / UX

- **Сеть/OpenAI**: сервер пробует распарсить JSON ошибки и отдать человекочитаемое `error` на фронт; на клиенте показываем строку над инпутом.
- **Валидация**: пустые сообщения, слишком длинные тексты, битый JSON — отсекаем с 400, чтобы не гадать «что сломалось».
- **Лоадер**: спиннер на кнопке отправки + «печатает…» точками в ленте, пока ждём ответ.

## Структура репы

- `client/` — Vue 3
- `server/` — Express + прокси к OpenAI

---

*P.S. Если OpenAI ругнётся на биллинг/лимиты — это уже их сторона, но приложение хотя бы нормально покажет текст ошибки, а не белый экран ))*
