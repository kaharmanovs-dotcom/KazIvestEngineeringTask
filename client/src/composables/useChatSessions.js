import { computed, ref, watch } from 'vue';

const STORAGE_KEY = 'kazivest-ai-chats-v1';

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function defaultTitle() {
  return 'Новый чат';
}

/** короткое имя чата — 3–4 слова хватит, остальное … */
function shortTitle(text, maxWords = 4) {
  const t = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t || t === defaultTitle()) return defaultTitle();
  const words = t.split(' ').filter(Boolean);
  if (words.length <= maxWords) return t;
  return `${words.slice(0, maxWords).join(' ')}…`;
}

export function useChatSessions() {
  const sessions = ref([]);
  const activeId = ref(null);

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.value));
    } catch {
      // квота / приватный режим - тихо, UI всё равно живёт в памяти
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      sessions.value = parsed.filter(
        (s) => s && typeof s.id === 'string' && Array.isArray(s.messages),
      );
      if (sessions.value.length) {
        const sorted = [...sessions.value].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        activeId.value = sorted[0].id;
      }
    } catch {
      sessions.value = [];
    }
  }

  const activeSession = computed(() => sessions.value.find((s) => s.id === activeId.value) || null);

  const sortedSessions = computed(() =>
    [...sessions.value].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)),
  );

  function createSession() {
    const id = uid();
    const session = {
      id,
      title: defaultTitle(),
      updatedAt: Date.now(),
      messages: [],
    };
    sessions.value.push(session);
    activeId.value = id;
    return session;
  }

  function ensureSession() {
    if (!sessions.value.length) {
      createSession();
      return;
    }
    if (!activeId.value || !sessions.value.some((s) => s.id === activeId.value)) {
      activeId.value = sortedSessions.value[0]?.id || null;
    }
  }

  function selectSession(id) {
    if (sessions.value.some((s) => s.id === id)) activeId.value = id;
  }

  function deleteSession(id) {
    const idx = sessions.value.findIndex((s) => s.id === id);
    if (idx === -1) return;
    const wasActive = activeId.value === id;
    sessions.value.splice(idx, 1);
    if (wasActive) {
      const next = [...sessions.value].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
      activeId.value = next ? next.id : null;
      if (!sessions.value.length) createSession();
    }
  }

  /** первый заход: из storage или один пустой чат */
  function init() {
    load();
    if (!sessions.value.length) createSession();
    else ensureSession();
  }

  function touchSession(session) {
    if (!session) return;
    session.updatedAt = Date.now();
  }

  /** название чата = первые слова первого промпта */
  function maybeSetTitleFromMessage(session, userText) {
    if (!session) return;
    const userMsgs = session.messages.filter((m) => m.role === 'user');
    if (userMsgs.length !== 1) return;
    session.title = shortTitle(userText);
  }

  function sessionDisplayTitle(session) {
    if (!session?.title) return defaultTitle();
    return shortTitle(session.title);
  }

  watch(
    sessions,
    () => persist(),
    { deep: true },
  );

  return {
    sessions,
    sortedSessions,
    activeId,
    activeSession,
    init,
    createSession,
    selectSession,
    deleteSession,
    touchSession,
    maybeSetTitleFromMessage,
    sessionDisplayTitle,
    persist,
  };
}
