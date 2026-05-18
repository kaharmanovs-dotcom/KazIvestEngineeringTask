# KazIvestEngineeringTask

Меня зовут Шамиль, мне 29 лет. На протяжении 5 лет принимал участие в различных проектах, преимущественно как фронтенд-разработчик, но есть уверенное владение Node.js.

Я не претендую на звание «самый умный разработчик». Просто хочу сказать, что люблю то, чем занимаюсь: когда строю приложение или сайт, чувствую прилив сил - к слову о том, насколько люблю свою профессию. Буду честен: в работе использую ИИ и разные источники вроде Stack Overflow, но прежде чем начал их использовать, прошёл время, когда этих привилегий не было, и мне, как и многим, приходилось всё писать абсолютно от руки и брать знания частично на форумах, частично из книг. По теории скажу честно - это не моя сильная сторона.

У меня есть понимание построения SPA, разных технологий - где какую применять; со временем появилось и видение. Легко контактирую с людьми (ни к кому претензий по жизни не имею). Готов к сложным задачам. Если остались вопросы - смело задавайте, буду рад.

---

## А это у нас инструкция к тому, что я тут натворил

Тестовое fullstack: чат с ИИ (прокси к **Groq** / опционально OpenAI), голосовой ввод, история чатов, светлая и тёмная тема. ТЗ: [Google Doc](https://docs.google.com/document/d/1DaS95vwVQb27_IO_VujcvVm5vK89FPYJIkN_qOx8tp4/edit?tab=t.0).

## Что умеет приложение

- Отправка сообщений в LLM и показ ответа в ленте диалога
- **Несколько чатов** в сайдбаре (localStorage), удаление с подтверждением
- Название чата = **первый вопрос** (длинные обрезаются с `…`)
- **Голосовой ввод** (Web Speech API): на мобилке - запись до второго тапа по микрофону, текст в поле, потом отправка
- **Светлая / тёмная тема** (переключатель в navbar)
- **Адаптив**: на телефоне сайдбар в бургер-меню, скролл только у ленты сообщений

## Хранение данных (без базы данных)

**Отдельной БД в проекте нет** - ни Postgres, ни MongoDB, ни SQLite на сервере.

| Что | Где хранится |
|-----|----------------|
| История чатов (сообщения, названия) | **localStorage** в браузере, ключ `kazivest-ai-chats-v1` (`client/src/composables/useChatSessions.js`) |
| Светлая / тёмная тема | **localStorage**, ключ `kazivest-theme` |
| API-ключ Groq / OpenAI | только на **сервере** в `server/.env` или в **Environment** на Render - в git не попадает |

**Бэкенд (Express)** переписку **не сохраняет**: принимает текст → отправляет в Groq/OpenAI → отдаёт ответ. После перезагрузки страницы сервер «не помнит» диалог - помнит только браузер, если не очистили данные сайта.

### Что это значит на практике

- Тот же браузер на том же ПК - чаты остаются после F5.
- Другой браузер, телефон, режим инкогнито - **другая пустая история**.
- Очистка cookies / данных сайта - **всё удалится**.
- После деплоя на Render у каждого пользователя **своя** история в **его** браузере; на сервер ничего не пишется.

Для тестового этого хватило: в ТЗ акцент на чат с ИИ и UX, а не на серверную БД. Если понадобится «чаты с любого устройства» - нужен был бы API + БД на бэке (отдельная задача).

## Стек

| Часть | Технологии |
|--------|------------|
| Фронт | **Vue 3**, **Vite**, **БЭМ** (`ai-chat__…`) |
| UI | **PrimeVue 4** - см. ниже |
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
| **Toast** + `ToastService` | Ошибки сети, LLM, голоса - красные/жёлтые всплывашки справа сверху, а не строка над инпутом |
| **ConfirmDialog** + `ConfirmationService` | Удаление чата - своё модальное окно вместо системного `confirm()` браузера |
| **Тема Aura** | Стили PrimeVue; тёмный режим синхронизирован с `data-theme="dark"` на `<html>` |

Подключение: `client/src/main.js` - `PrimeVue`, `ToastService`, `ConfirmationService`. Обёртка `useNotify.js` для toast из любого места.

### Express + LLM

- Express: [установка](https://expressjs.com/en/starter/installing.html)
- Ключи **только на сервере** (`server/.env`), в браузер не попадают
- **Groq** - тот же формат, что OpenAI Chat Completions: [Quickstart](https://console.groq.com/docs/quickstart), [ключи](https://console.groq.com/keys)
- **OpenAI** - опция, если есть квота: [Chat Completions](https://platform.openai.com/docs/api-reference/chat/create)
- Приоритет: если задан `GROQ_API_KEY` - идём в Groq; иначе OpenAI (`AI_PROVIDER` в `.env`)

### Голос

- [Web Speech API / SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)
- Лучше всего **Chrome на Android**; на iPhone Safari часто недоступен - ограничение браузера

### Деплой на [Render.com](https://render.com) (бесплатный tier)

Для размещения проекта выбрал **Render.com**: на бесплатном тарифе можно быстро поднять fullstack (и фронт, и Node API) и **протестировать всё по ссылке** - без своего VPS, домена и долгой возни с сервером. Для тестового задания этого достаточно.

1. **Web Services** (не Static Sites - нужен Node для API).
2. Build: `cd client && npm install && npm run build && cd ../server && npm install`
3. Start: `cd server && node src/index.js`
4. Environment: `GROQ_API_KEY`, `SERVE_STATIC=true`, `HOST=0.0.0.0`, `CORS_ALLOW_LAN=true`
5. `PORT` не трогать - Render подставит сам.

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
| `CORS_ALLOW_LAN` | `true` - CORS с IP телефона |
| `SERVE_STATIC` | `true` - отдавать `client/dist` |
