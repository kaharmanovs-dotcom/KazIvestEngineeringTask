import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const HOST = process.env.HOST || '0.0.0.0';
const clientOrigin = process.env.CLIENT_ORIGIN?.trim();

/** localhost + LAN (192.168.x.x, 10.x) для теста с телефона */
const LAN_ORIGIN_RE =
  /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?$/;

function corsOrigin(origin, callback) {
  if (!origin) return callback(null, true);
  if (!clientOrigin) return callback(null, true);
  if (clientOrigin === '*') return callback(null, true);
  if (origin === clientOrigin) return callback(null, true);
  if (process.env.CORS_ALLOW_LAN === 'true' && LAN_ORIGIN_RE.test(origin)) {
    return callback(null, true);
  }
  return callback(new Error(`CORS: origin not allowed (${origin})`));
}

app.use(
  cors({
    origin: corsOrigin,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  }),
);
app.use(express.json({ limit: '256kb' }));

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

function pickUpstreamErrorMessage(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const err = payload.error;
  if (!err) return null;
  if (typeof err === 'string') return err;
  if (typeof err.message === 'string') return err.message;
  return null;
}

/** Бесплатный Groq (лимиты на сайте) или OpenAI - см. server/.env.example */
function resolveLlm() {
  const groqKey = process.env.GROQ_API_KEY?.trim();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const want = (process.env.AI_PROVIDER || '').toLowerCase();

  if (want === 'openai' && openaiKey) {
    return {
      name: 'openai',
      url: OPENAI_URL,
      apiKey: openaiKey,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    };
  }
  if (want === 'groq' && groqKey) {
    return {
      name: 'groq',
      url: GROQ_URL,
      apiKey: groqKey,
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    };
  }
  if (groqKey) {
    return {
      name: 'groq',
      url: GROQ_URL,
      apiKey: groqKey,
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    };
  }
  if (openaiKey) {
    return {
      name: 'openai',
      url: OPENAI_URL,
      apiKey: openaiKey,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    };
  }
  return null;
}

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return 'Нужен массив messages с хотя бы одним сообщением';
  }
  if (messages.length > 40) {
    return 'Слишком длинная история, укороти диалог (лимит на сервере)';
  }
  for (const m of messages) {
    if (!m || typeof m !== 'object') return 'Каждое сообщение должно быть объектом';
    if (m.role !== 'user' && m.role !== 'assistant' && m.role !== 'system') {
      return 'Недопустимый role в сообщении';
    }
    if (typeof m.content !== 'string' || !m.content.trim()) {
      return 'Пустой content недопустим';
    }
    if (m.content.length > 12000) {
      return 'Одно сообщение слишком длинное';
    }
  }
  return null;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/chat', async (req, res) => {
  const llm = resolveLlm();
  if (!llm) {
    return res.status(500).json({
      error:
        'Нет ключа LLM: добавь в server/.env GROQ_API_KEY (бесплатный tier) или OPENAI_API_KEY - см. server/.env.example',
    });
  }

  const { messages } = req.body || {};
  const validationError = validateMessages(messages);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  try {
    const upstream = await fetch(llm.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${llm.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: llm.model,
        messages,
        temperature: 0.7,
      }),
    });

    const raw = await upstream.text();
    let data;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      return res.status(502).json({
        error: `${llm.name}: провайдер вернул не-JSON, попробуй ещё раз чуть позже`,
        details: raw.slice(0, 200),
      });
    }

    if (!upstream.ok) {
      const msg =
        pickUpstreamErrorMessage(data) ||
        `${llm.name} ответил со статусом ${upstream.status}`;
      const status = upstream.status === 401 ? 401 : 502;
      return res.status(status).json({ error: msg });
    }

    const choice = data.choices?.[0]?.message?.content;
    if (typeof choice !== 'string') {
      return res.status(502).json({
        error: `Странный формат ответа (${llm.name}: нет choices[0].message.content)`,
      });
    }

    return res.json({ reply: choice.trim() });
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      error: `Сетевая ошибка при обращении к ${llm.name}`,
      details: e instanceof Error ? e.message : String(e),
    });
  }
});

const serveStatic = process.env.SERVE_STATIC === 'true';
if (serveStatic) {
  const distPath = path.join(__dirname, '../../client/dist');
  if (!fs.existsSync(distPath)) {
    console.warn('SERVE_STATIC=true, но папка client/dist не найдена - сначала npm run build в client');
  } else {
    app.use(express.static(distPath));
    app.use((req, res, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api')) {
        return res.sendFile(path.join(distPath, 'index.html'));
      }
      return next();
    });
  }
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

app.listen(PORT, HOST, () => {
  const llm = resolveLlm();
  const who = llm ? `${llm.name} (${llm.model})` : 'LLM ключ не задан';
  console.log(`API слушает http://${HOST}:${PORT} (chat: POST /api/chat) - ${who}`);
  if (HOST === '0.0.0.0') {
    console.log('  доступ в LAN: http://<твой-IP>:' + PORT);
  }

  const hasGroq = Boolean(process.env.GROQ_API_KEY?.trim());
  const hasOpenai = Boolean(process.env.OPENAI_API_KEY?.trim());
  if (hasOpenai && !hasGroq && llm?.name === 'openai') {
    console.warn(
      '[env] Задан только OPENAI_API_KEY - запросы идут в OpenAI (квота/биллинг). Чтобы бесплатно через Groq, добавь GROQ_API_KEY=gsk_... в server/.env',
    );
  }
});
