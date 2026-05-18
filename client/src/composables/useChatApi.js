/**
 * Обёртка над нашим бэком. В dev Vite проксирует /api на express - см. vite.config.js
 * (официально про proxy: https://vitejs.dev/config/server-options.html#server-proxy)
 */
const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export function useChatApi() {
  async function sendMessages(messages) {
    const res = await fetch(`${apiBase}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    });

    let body = null;
    try {
      body = await res.json();
    } catch {
      // если прилетел не json - хоть что-то покажем
    }

    if (!res.ok) {
      const msg = body?.error || `HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }

    if (typeof body?.reply !== 'string') {
      throw new Error('Сервер вернул ответ без поля reply');
    }

    return body.reply;
  }

  return { sendMessages };
}
