# KazIvestEngineeringTask

Тестовое fullstack: чат с ИИ (прокси к **Groq** / опционально OpenAI), голосовой ввод, история чатов, светлая и тёмная тема. ТЗ: [Google Doc](https://docs.google.com/document/d/1DaS95vwVQb27_IO_VujcvVm5vK89FPYJIkN_qOx8tp4/edit?tab=t.0).

## Что умеет приложение

- Отправка сообщений в LLM и показ ответа в ленте диалога
- **Несколько чатов** в сайдбаре (localStorage), удаление с подтверждением
- Название чата = **первый вопрос** (длинные обрезаются с `…`)
- **Голосовой ввод** (Web Speech API): на мобилке — запись до второго тапа по микрофону, текст в поле, потом отправка
- **Светлая / тёмная тема** (переключатель в navbar)
- **Адаптив**: на телефоне сайдбар в бургер-меню, скролл только у ленты сообщений
- **Доступ по Wi‑Fi** с другого устройства (`vite --host`, API на `0.0.0.0`)

## Хранение данных (без базы данных)

**Отдельной БД в проекте нет** — ни Postgres, ни MongoDB, ни SQLite на сервере.

| Что | Где хранится |
|-----|----------------|
| История чатов (сообщения, названия) | **localStorage** в браузере, ключ `kazivest-ai-chats-v1` (`client/src/composables/useChatSessions.js`) |
| Светлая / тёмная тема | **localStorage**, ключ `kazivest-theme` |
| API-ключ Groq / OpenAI | только на **сервере** в `server/.env` (локально) или в **Environment** на Render — в git не попадает |

**Бэкенд (Express)** переписку **не сохраняет**: принимает текст → отправляет в Groq/OpenAI → отдаёт ответ. После перезагрузки страницы сервер «не помнит» диалог — помнит только браузер, если не очистили данные сайта.

### Что это значит на практике

- Тот же браузер на том же ПК — чаты остаются после F5.
- Другой браузер, телефон, режим инкогнито — **другая пустая история**.
- Очистка cookies / данных сайта — **всё удалится**.
- После деплоя на Render у каждого пользователя **своя** история в **его** браузере; на сервер ничего не пишется.

Для тестового этого хватило: в ТЗ акцент на чат с ИИ и UX, а не на серверную БД. Если понадобится «чаты с любого устройства» — нужен был бы API + БД на бэке (отдельная задача).

## Стек

| Часть | Технологии |
|--------|------------|
| Фронт | **Vue 3**, **Vite**, **БЭМ** (`ai-chat__…`) |
| UI | **PrimeVue 4** — см. ниже |
| Бэк | **Node.js**, **Express** (без БД, stateless API) |
| LLM | **Groq** (бесплатный tier) или **OpenAI** Chat Completions |
| Данные чатов | **localStorage** (клиент), не сервер |

### Vue 3 + Vite + БЭМ

- Vue: [Quick Start](https://vuejs.org/guide/quick-start.html)
- Vite + proxy на API в dev: [server.proxy](https://vitejs.dev/config/server-options.html#server-proxy)
- БЭМ: [методология](https://ru.bem.info/methodology/quick-start/)

### PrimeVue

Взял **PrimeVue**, потому что в ТЗ нужны нормальные UI-паттерны без велосипеда: всплывающие ошибки и диалог подтверждения.

Что используем из библиотеки ([документация](https://primevue.org/)):

| Компонент / сервис | Зачем |
|--------------------|--------|
| **Toast** + `ToastService` | Ошибки сети, LLM, голоса — красные/жёлтые всплывашки справа сверху, а не строка над инпутом |
| **ConfirmDialog** + `ConfirmationService` | Удаление чата — своё модальное окно вместо системного `confirm()` браузера |
| **Тема Aura** | Стили PrimeVue; тёмный режим синхронизирован с `data-theme="dark"` на `<html>` |

Подключение: `client/src/main.js` — `PrimeVue`, `ToastService`, `ConfirmationService`. Обёртка `useNotify.js` для toast из любого места.

### Express + LLM

- Express: [установка](https://expressjs.com/en/starter/installing.html)
- Ключи **только на сервере** (`server/.env`), в браузер не попадают
- **Groq** — тот же формат, что OpenAI Chat Completions: [Quickstart](https://console.groq.com/docs/quickstart), [ключи](https://console.groq.com/keys)
- **OpenAI** — опция, если есть квота: [Chat Completions](https://platform.openai.com/docs/api-reference/chat/create)
- Приоритет: если задан `GROQ_API_KEY` — идём в Groq; иначе OpenAI (`AI_PROVIDER` в `.env`)

### Голос

- [Web Speech API / SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)
- Лучше всего **Chrome на Android**; на iPhone Safari часто недоступен — ограничение браузера

## Запуск локально

1. Скопируй `server/.env.example` → `server/.env`, вставь **`GROQ_API_KEY`** ([console.groq.com/keys](https://console.groq.com/keys)).

2. **API:**

```bash
cd server
npm install
npm run dev
```

3. **Фронт:**

```bash
cd client
npm install
npm run dev
```

4. Открой **http://localhost:5173**

### Доступ с телефона в Wi‑Fi

В `server/.env`: `HOST=0.0.0.0`, `CORS_ALLOW_LAN=true` (см. example).

1. `npm run dev` в `server` и `client` (Vite с `--host`)
2. `ipconfig` → IPv4, например `192.168.1.10`
3. На телефоне: **http://192.168.1.10:5173**
4. Разреши Node.js в firewall для частной сети

### Один процесс (демо / прод)

```bash
cd client && npm install && npm run build
cd ../server && npm install
set SERVE_STATIC=true
set HOST=0.0.0.0
node src/index.js
```

Linux/mac: `export` вместо `set`. UI + API с одного порта (3000).

### Деплой на Render (бесплатный tier)

1. **Web Services** (не Static Sites — нужен Node для API).
2. Build: `cd client && npm install && npm run build && cd ../server && npm install`
3. Start: `cd server && node src/index.js`
4. Environment: `GROQ_API_KEY`, `SERVE_STATIC=true`, `HOST=0.0.0.0`, `CORS_ALLOW_LAN=true`
5. `PORT` не трогать — Render подставит сам.

Первый заход на free tier может быть медленным (сервис «просыпается»).

## Структура

```
client/
  src/
    App.vue              # UI чата, темы, сайдбар
    composables/
      useChatApi.js      # запросы к /api/chat
      useChatSessions.js # чаты в localStorage
      useNotify.js       # PrimeVue Toast
      useSpeechToText.js # микрофон
      useTheme.js        # светлая/тёмная
server/
  src/index.js           # Express, прокси Groq/OpenAI
```

## Переменные окружения (`server/.env`)

| Переменная | Описание |
|------------|----------|
| `GROQ_API_KEY` | Ключ Groq (рекомендуется для тестового) |
| `GROQ_MODEL` | По умолчанию `llama-3.3-70b-versatile` |
| `OPENAI_API_KEY` | Опционально |
| `AI_PROVIDER` | `groq` \| `openai` (если оба ключа) |
| `HOST` | `0.0.0.0` для LAN |
| `CORS_ALLOW_LAN` | `true` — CORS с IP телефона |
| `SERVE_STATIC` | `true` — отдавать `client/dist` |

---

*P.S. Если Groq ругнётся на лимиты — подожди или заведи новый ключ; OpenAI без оплаты обычно сразу quota ))*
