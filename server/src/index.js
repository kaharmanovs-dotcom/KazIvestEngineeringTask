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

const clientOrigin = process.env.CLIENT_ORIGIN;
app.use(
  cors({
    origin: clientOrigin || true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  }),
);
app.use(express.json({ limit: '256kb' }));

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

function pickOpenAiErrorMessage(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const err = payload.error;
  if (!err) return null;
  if (typeof err === 'string') return err;
  if (typeof err.message === 'string') return err.message;
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
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'На сервере не задан OPENAI_API_KEY — см. server/.env.example',
    });
  }

  const { messages } = req.body || {};
  const validationError = validateMessages(messages);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  try {
    const upstream = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
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
        error: 'OpenAI вернул не-JSON, попробуй ещё раз чуть позже',
        details: raw.slice(0, 200),
      });
    }

    if (!upstream.ok) {
      const msg =
        pickOpenAiErrorMessage(data) ||
        `OpenAI ответил со статусом ${upstream.status}`;
      const status = upstream.status === 401 ? 401 : 502;
      return res.status(status).json({ error: msg });
    }

    const choice = data.choices?.[0]?.message?.content;
    if (typeof choice !== 'string') {
      return res.status(502).json({
        error: 'Странный формат ответа от OpenAI (нет choices[0].message.content)',
      });
    }

    return res.json({ reply: choice.trim() });
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      error: 'Сетевая ошибка при обращении к OpenAI',
      details: e instanceof Error ? e.message : String(e),
    });
  }
});

const serveStatic = process.env.SERVE_STATIC === 'true';
if (serveStatic) {
  const distPath = path.join(__dirname, '../../client/dist');
  if (!fs.existsSync(distPath)) {
    console.warn('SERVE_STATIC=true, но папка client/dist не найдена — сначала npm run build в client');
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

app.listen(PORT, () => {
  console.log(`API слушает :${PORT} (chat: POST /api/chat)`);
});
