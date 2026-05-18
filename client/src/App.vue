<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import Toast from 'primevue/toast';
import ConfirmDialog from 'primevue/confirmdialog';
import { useConfirm } from 'primevue/useconfirm';
import { useChatApi } from './composables/useChatApi.js';
import { useChatSessions } from './composables/useChatSessions.js';
import { useNotify } from './composables/useNotify.js';
import { useSpeechToText } from './composables/useSpeechToText.js';
import { useTheme } from './composables/useTheme.js';

const { sendMessages } = useChatApi();
const speech = useSpeechToText();
const notify = useNotify();
const confirm = useConfirm();
const { theme, toggle: toggleTheme } = useTheme();
const {
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
} = useChatSessions();

init();

const input = ref('');
const loading = ref(false);
const threadEl = ref(null);
const sidebarOpen = ref(false);

const isDark = computed(() => theme.value === 'dark');

const quickPrompts = [
  'Хочу узнать больше о компании Каз Инвест Инжиниринг',
  'Расскажи мне о Казахстане?',
  'Топ 10 больших IT компаний Казахстана',
];

const messages = computed(() => activeSession.value?.messages ?? []);
const hasThread = computed(() => messages.value.length > 0);

async function scrollThreadToBottom() {
  await nextTick();
  const el = threadEl.value;
  if (!el) return;
  el.scrollTop = el.scrollHeight;
}

watch(
  () => messages.value.length,
  () => {
    scrollThreadToBottom();
  },
);

function buildPayload() {
  const s = activeSession.value;
  if (!s) return [];
  return s.messages.map((m) => ({ role: m.role, content: m.content }));
}

async function sendUserMessageAndReply(draftRaw) {
  const s = activeSession.value;
  if (!s || loading.value) return;
  const draft = String(draftRaw || '').trim();
  if (!draft) return;

  s.messages.push({ role: 'user', content: draft });
  maybeSetTitleFromMessage(s, draft);
  touchSession(s);
  input.value = '';

  loading.value = true;
  await scrollThreadToBottom();

  try {
    const reply = await sendMessages(buildPayload());
    s.messages.push({ role: 'assistant', content: reply });
    touchSession(s);
  } catch (e) {
    s.messages.pop();
    input.value = draft;
    notify.error(e instanceof Error ? e.message : String(e), 'Не удалось отправить');
  } finally {
    loading.value = false;
    await scrollThreadToBottom();
  }
}

async function submit() {
  await sendUserMessageAndReply(input.value);
}

async function sendPreset(text) {
  if (loading.value) return;
  await sendUserMessageAndReply(text);
}

function closeSidebar() {
  sidebarOpen.value = false;
}

function openSidebar() {
  sidebarOpen.value = true;
}

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value;
}

function startNewChat() {
  speech.stop({ mode: 'abort' });
  input.value = '';
  createSession();
  closeSidebar();
}

function pickSession(id) {
  speech.stop({ mode: 'abort' });
  input.value = '';
  selectSession(id);
  closeSidebar();
}

function removeSession(id) {
  const session = sortedSessions.value.find((s) => s.id === id);
  const title = session ? sessionDisplayTitle(session) : 'этот чат';

  confirm.require({
    header: 'Удалить чат?',
    message: `«${title}» и вся переписка будут удалены. Это нельзя отменить.`,
    icon: 'pi pi-trash',
    rejectLabel: 'Отмена',
    acceptLabel: 'Удалить',
    rejectProps: {
      label: 'Отмена',
      severity: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: 'Удалить',
      severity: 'danger',
    },
    accept: () => {
      speech.stop({ mode: 'abort' });
      input.value = '';
      deleteSession(id);
    },
  });
}

function onKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!loading.value) submit();
  }
}

function toggleMic() {
  if (loading.value) return;

  if (speech.listening.value) {
    // второй тап - стоп, текст уже в поле, отправляем
    speech.stop({ mode: 'finalize' });
    return;
  }

  speech.start({
    lang: 'ru-RU',
    onChunk: (text) => {
      input.value = text;
    },
    onDone: async (text) => {
      const draft = text.trim();
      if (!draft) {
        notify.warn('Не расслышал текст - попробуй ещё раз', 'Голосовой ввод');
        return;
      }
      input.value = draft;
      await sendUserMessageAndReply(draft);
    },
  });
}

watch(speech.lastError, (v) => {
  if (v) notify.warn(v, 'Голосовой ввод');
});
</script>

<template>
  <div class="ai-app">
    <Toast position="top-right" :breakpoints="{ '768px': { width: '92vw', right: '4vw' } }" />
    <ConfirmDialog :draggable="false" />

    <div
      class="ai-chat"
      :class="[`ai-chat--${theme}`, { 'ai-chat--sidebar-open': sidebarOpen }]"
    >
    <button
      v-if="sidebarOpen"
      type="button"
      class="ai-chat__overlay"
      aria-label="Закрыть меню"
      @click="closeSidebar"
    />

    <aside
      class="ai-chat__sidebar"
      :class="{ 'ai-chat__sidebar--open': sidebarOpen }"
      aria-label="Список чатов"
    >
      <div class="ai-chat__side-head">
        <span class="ai-chat__side-title">Чаты</span>
        <button type="button" class="ai-chat__side-close" aria-label="Закрыть" @click="closeSidebar">
          ×
        </button>
      </div>
      <button type="button" class="ai-chat__new-chat" @click="startNewChat">Новый чат</button>
      <ul class="ai-chat__sessions">
        <li
          v-for="s in sortedSessions"
          :key="s.id"
          class="ai-chat__session"
          :class="{ 'ai-chat__session--active': s.id === activeId }"
        >
          <button type="button" class="ai-chat__session-open" @click="pickSession(s.id)">
            <span class="ai-chat__session-title">{{ sessionDisplayTitle(s) }}</span>
          </button>
          <button
            type="button"
            class="ai-chat__session-del"
            aria-label="Удалить чат"
            title="Удалить"
            @click.stop="removeSession(s.id)"
          >
            ×
          </button>
        </li>
      </ul>
    </aside>

    <div class="ai-chat__shell">
      <header class="ai-chat__navbar">
        <button
          type="button"
          class="ai-chat__burger"
          aria-label="Меню чатов"
          :aria-expanded="sidebarOpen"
          @click="toggleSidebar"
        >
          <span /><span /><span />
        </button>
        <span class="ai-chat__brand">KazInvest · AI</span>
        <button
          type="button"
          class="ai-chat__theme-btn"
          :aria-label="isDark ? 'Светлая тема' : 'Тёмная тема'"
          @click="toggleTheme"
        >
          <svg v-if="isDark" viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="2" />
            <path
              d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
          <svg v-else viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
            <path
              d="M21 14.5A8.5 8.5 0 0 1 9.5 3 7 7 0 1 0 21 14.5Z"
              stroke="currentColor"
              stroke-width="2"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </header>

      <div class="ai-chat__workspace">
      <main class="ai-chat__main">
        <div v-if="!hasThread" class="ai-chat__hero">
          <p class="ai-chat__hello">Привет!</p>
          <h1 class="ai-chat__title">О чём хочешь узнать?</h1>
          <p class="ai-chat__hint">
            Нажми на вопрос ниже - он сразу отправится - или напиши свой
          </p>

          <div class="ai-chat__chips" aria-label="Быстрые вопросы">
            <button
              v-for="(q, idx) in quickPrompts"
              :key="idx"
              type="button"
              class="ai-chat__chip"
              :disabled="loading"
              @click="sendPreset(q)"
            >
              {{ q }}
            </button>
          </div>
        </div>

        <div v-else ref="threadEl" class="ai-chat__thread" aria-live="polite">
          <div
            v-for="(m, idx) in messages"
            :key="idx"
            class="ai-chat__msg"
            :class="m.role === 'user' ? 'ai-chat__msg--user' : 'ai-chat__msg--bot'"
          >
            <div class="ai-chat__msg-label">{{ m.role === 'user' ? 'Ты' : 'ИИ' }}</div>
            <div class="ai-chat__msg-body">{{ m.content }}</div>
          </div>
          <div v-if="loading" class="ai-chat__typing" aria-busy="true">
            <span class="ai-chat__dot" />
            <span class="ai-chat__dot" />
            <span class="ai-chat__dot" />
          </div>
        </div>
      </main>

      <div class="ai-chat__footer">
        <p v-if="speech.listening" class="ai-chat__voice-hint" role="status">
          <span class="ai-chat__voice-pulse" aria-hidden="true" />
          Идёт запись… Проверь текст ниже и нажми
          <strong>микрофон ещё раз</strong>
          - отправим сразу
        </p>

        <form class="ai-chat__composer" @submit.prevent="submit">
          <button
            v-if="speech.supported"
            type="button"
            class="ai-chat__mic"
            :class="{ 'ai-chat__mic--on': speech.listening }"
            :aria-pressed="speech.listening"
            :aria-label="
              speech.listening ? 'Остановить запись и отправить' : 'Начать голосовой ввод'
            "
            @click="toggleMic"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
              <path
                d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Z"
                stroke="currentColor"
                stroke-width="2"
                stroke-linejoin="round"
              />
              <path
                d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
          </button>

          <input
            v-model="input"
            class="ai-chat__input"
            type="text"
            name="prompt"
            autocomplete="off"
            :placeholder="
              speech.listening ? 'Говорите…' : 'Спроси что угодно…'
            "
            :disabled="loading"
            @keydown="onKeydown"
          />

          <button
            type="submit"
            class="ai-chat__send"
            :disabled="loading || !input.trim()"
            aria-label="Отправить"
          >
            <span v-if="loading" class="ai-chat__spinner" aria-hidden="true" />
            <svg v-else viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
              <path
                d="M5 12h12M13 6l6 6-6 6"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </form>
      </div>
      </div>
    </div>
  </div>
  </div>
</template>

<style scoped>
/* тёмная тема (основная область) */
.ai-app {
  height: 100%;
  overflow: hidden;
}

.ai-chat--dark {
  --ai-bg: #141c28;
  --ai-bg-grad: #1a2838;
  --ai-text: #f0f4fa;
  --ai-muted: #9aa8bc;
  --ai-line: rgba(255, 255, 255, 0.09);
  --ai-surface: rgba(255, 255, 255, 0.04);
  --ai-composer-bg: rgba(20, 28, 40, 0.9);
  --ai-accent: #5b8def;
  --ai-accent-2: #3d6fd4;
  --ai-danger: #ff8a9a;
  --ai-bot-bg: rgba(255, 255, 255, 0.1);
  --ai-bot-border: rgba(255, 255, 255, 0.14);
  --ai-bot-text: #ffffff;
  --ai-bot-label: #c5d8f5;
  --ai-user-bg: rgba(91, 141, 239, 0.16);
  --ai-user-border: rgba(91, 141, 239, 0.32);
  --ai-navbar-bg: rgba(20, 28, 40, 0.85);
  --ai-overlay: rgba(0, 0, 0, 0.55);
  --ai-input-bg: #1e2a3d;
  --ai-input-text: #f2f6fc;
  --ai-input-placeholder: #9aa8bc;
  /* сайдбар - тёмный #263248 */
  --ai-sidebar-bg: #263248;
  --ai-sidebar-text: #eef2f8;
  --ai-sidebar-muted: #9aa8be;
  --ai-sidebar-line: rgba(255, 255, 255, 0.1);
  --ai-sidebar-hover: rgba(255, 255, 255, 0.06);
  --ai-sidebar-active: rgba(91, 141, 239, 0.22);
  --ai-sidebar-active-border: rgba(123, 168, 255, 0.45);
  --ai-sidebar-scroll-thumb: rgba(255, 255, 255, 0.28);
  --ai-sidebar-scroll-track: rgba(255, 255, 255, 0.06);
  --ai-sidebar-del-hover: rgba(255, 120, 140, 0.12);
}

/* светлая тема */
.ai-chat--light {
  --ai-bg: #eef2f7;
  --ai-bg-grad: #e2e9f3;
  --ai-text: #1c2836;
  --ai-muted: #5c6b7f;
  --ai-line: rgba(38, 50, 72, 0.12);
  --ai-surface: #ffffff;
  --ai-composer-bg: #ffffff;
  --ai-accent: #3d6fd4;
  --ai-accent-2: #2f57b8;
  --ai-danger: #d64558;
  --ai-bot-bg: #ffffff;
  --ai-bot-border: rgba(38, 50, 72, 0.12);
  --ai-bot-text: #1a2433;
  --ai-bot-label: #5c6b7f;
  --ai-user-bg: rgba(61, 111, 212, 0.12);
  --ai-user-border: rgba(61, 111, 212, 0.28);
  --ai-navbar-bg: rgba(255, 255, 255, 0.92);
  --ai-overlay: rgba(28, 40, 56, 0.35);
  --ai-input-bg: #ffffff;
  --ai-input-text: #1a2433;
  --ai-input-placeholder: #5c6b7f;
  /* сайдбар - светлый, в тон основной области */
  --ai-sidebar-bg: #ffffff;
  --ai-sidebar-text: #1c2836;
  --ai-sidebar-muted: #5c6b7f;
  --ai-sidebar-line: rgba(38, 50, 72, 0.1);
  --ai-sidebar-hover: rgba(38, 50, 72, 0.05);
  --ai-sidebar-active: rgba(61, 111, 212, 0.12);
  --ai-sidebar-active-border: rgba(61, 111, 212, 0.35);
  --ai-sidebar-scroll-thumb: rgba(38, 50, 72, 0.22);
  --ai-sidebar-scroll-track: rgba(38, 50, 72, 0.06);
  --ai-sidebar-del-hover: rgba(214, 69, 88, 0.1);
}

.ai-chat {
  height: 100%;
  max-height: 100dvh;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  background: radial-gradient(1100px 520px at 50% -10%, var(--ai-bg-grad) 0%, var(--ai-bg) 58%);
  color: var(--ai-text);
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;
}

.ai-chat__overlay {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 90;
  border: 0;
  padding: 0;
  margin: 0;
  background: var(--ai-overlay);
  cursor: pointer;
}

.ai-chat__sidebar {
  width: 280px;
  height: 100%;
  min-height: 0;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 12px;
  border-right: 1px solid var(--ai-sidebar-line);
  background: var(--ai-sidebar-bg);
  color: var(--ai-sidebar-text);
  overflow: hidden;
  z-index: 100;
}

.ai-chat__side-head,
.ai-chat__new-chat {
  flex-shrink: 0;
}

.ai-chat__side-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 4px 0;
  gap: 8px;
}

.ai-chat__side-title {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ai-sidebar-muted);
}

.ai-chat__side-close {
  display: none;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 8px;
  background: var(--ai-sidebar-hover);
  color: var(--ai-sidebar-text);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}

.ai-chat__new-chat {
  border: 1px solid var(--ai-sidebar-active-border);
  background: var(--ai-sidebar-active);
  color: var(--ai-sidebar-text);
  font-size: 14px;
  font-weight: 600;
  padding: 10px 12px;
  border-radius: 12px;
  cursor: pointer;
}

.ai-chat__new-chat:hover {
  background: rgba(91, 141, 239, 0.32);
}

.ai-chat__sessions {
  list-style: none;
  margin: 0;
  padding: 0 4px 0 0;
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
  scrollbar-color: var(--ai-sidebar-scroll-thumb) var(--ai-sidebar-scroll-track);
}

.ai-chat__sessions::-webkit-scrollbar {
  width: 7px;
}

.ai-chat__sessions::-webkit-scrollbar-track {
  background: var(--ai-sidebar-scroll-track);
  border-radius: 4px;
}

.ai-chat__sessions::-webkit-scrollbar-thumb {
  background: var(--ai-sidebar-scroll-thumb);
  border-radius: 4px;
}

.ai-chat__sessions::-webkit-scrollbar-thumb:hover {
  filter: brightness(1.15);
}

.ai-chat__session {
  display: flex;
  align-items: stretch;
  gap: 0;
  border-radius: 10px;
  border: 1px solid transparent;
  background: var(--ai-sidebar-hover);
}

.ai-chat__session--active {
  border-color: var(--ai-sidebar-active-border);
  background: var(--ai-sidebar-active);
}

.ai-chat__session-open {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--ai-sidebar-text);
  text-align: left;
  padding: 10px 8px 10px 10px;
  font-size: 13px;
  line-height: 1.25;
  cursor: pointer;
}

.ai-chat__session-title {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-chat__session-del {
  flex-shrink: 0;
  width: 34px;
  border: 0;
  border-left: 1px solid var(--ai-sidebar-line);
  background: transparent;
  color: var(--ai-sidebar-muted);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  border-radius: 0 10px 10px 0;
}

.ai-chat__session-del:hover {
  color: var(--ai-danger);
  background: var(--ai-sidebar-del-hover);
}

.ai-chat__shell {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.ai-chat__navbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--ai-line);
  background: var(--ai-navbar-bg);
  backdrop-filter: blur(12px);
}

.ai-chat__burger {
  display: none;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  width: 40px;
  height: 40px;
  padding: 8px;
  border: 1px solid var(--ai-line);
  border-radius: 10px;
  background: var(--ai-surface);
  cursor: pointer;
}

.ai-chat__burger span {
  display: block;
  height: 2px;
  border-radius: 2px;
  background: var(--ai-text);
}

.ai-chat__brand {
  flex: 1;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.ai-chat__theme-btn {
  width: 40px;
  height: 40px;
  border: 1px solid var(--ai-line);
  border-radius: 10px;
  background: var(--ai-surface);
  color: var(--ai-text);
  display: grid;
  place-items: center;
  cursor: pointer;
}

.ai-chat__theme-btn:hover {
  border-color: var(--ai-accent);
  color: var(--ai-accent);
}

.ai-chat__workspace {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.ai-chat__main {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 20px 16px 0;
  width: min(920px, 100%);
  margin: 0 auto;
}

.ai-chat__hero {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 10px;
  text-align: center;
  padding: 10px 6px 24px;
}

.ai-chat__hello {
  margin: 0;
  color: var(--ai-text);
  font-size: 18px;
}

.ai-chat__title {
  margin: 0;
  font-size: clamp(28px, 4vw, 44px);
  line-height: 1.1;
  letter-spacing: -0.02em;
}

.ai-chat__hint {
  margin: 6px auto 0;
  max-width: 52ch;
  color: var(--ai-muted);
  font-size: 15px;
  line-height: 1.45;
}

.ai-chat__chips {
  margin-top: 22px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
}

.ai-chat__chip {
  border: 1px solid var(--ai-line);
  background: var(--ai-surface);
  color: var(--ai-text);
  padding: 10px 12px;
  border-radius: 999px;
  font-size: 13px;
  line-height: 1.25;
  cursor: pointer;
  max-width: min(100%, 420px);
  text-align: left;
}

.ai-chat__chip:hover:not(:disabled) {
  border-color: var(--ai-accent);
  background: var(--ai-user-bg);
}

.ai-chat__chip:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.ai-chat__thread {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 10px 4px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  -webkit-overflow-scrolling: touch;
}

.ai-chat__msg {
  border: 1px solid var(--ai-line);
  background: var(--ai-surface);
  border-radius: 16px;
  padding: 12px;
}

.ai-chat__msg--user {
  align-self: flex-end;
  max-width: min(720px, 92%);
  background: var(--ai-user-bg);
  border-color: var(--ai-user-border);
}

.ai-chat__msg--bot {
  align-self: stretch;
  background: var(--ai-bot-bg);
  border-color: var(--ai-bot-border);
  /* box-shadow: 0 8px 28px rgba(0, 0, 0, 0.22); */
}

.ai-chat__msg--bot .ai-chat__msg-label {
  color: var(--ai-bot-label);
}

.ai-chat__msg--bot .ai-chat__msg-body {
  color: var(--ai-bot-text);
  font-weight: 450;
  letter-spacing: 0.01em;
}

.ai-chat__msg-label {
  font-size: 12px;
  color: var(--ai-muted);
  margin-bottom: 6px;
}

.ai-chat__msg-body {
  white-space: pre-wrap;
  line-height: 1.45;
  font-size: 15px;
}

.ai-chat__typing {
  display: flex;
  gap: 6px;
  padding: 10px 6px;
  align-items: center;
}

.ai-chat__dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--ai-muted);
  opacity: 0.35;
  animation: ai-bounce 1.1s infinite ease-in-out;
}

.ai-chat__dot:nth-child(2) {
  animation-delay: 0.12s;
}
.ai-chat__dot:nth-child(3) {
  animation-delay: 0.24s;
}

@keyframes ai-bounce {
  0%,
  80%,
  100% {
    transform: translateY(0);
    opacity: 0.35;
  }
  40% {
    transform: translateY(-4px);
    opacity: 0.95;
  }
}

.ai-chat__footer {
  flex-shrink: 0;
  width: min(920px, 100%);
  margin: 0 auto;
  padding: 10px 16px 22px;
}

.ai-chat__voice-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 8px 10px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--ai-sidebar-active-border);
  background: var(--ai-user-bg);
  color: var(--ai-text);
  font-size: 13px;
  line-height: 1.35;
}

.ai-chat__voice-hint strong {
  color: var(--ai-accent);
}

.ai-chat__voice-pulse {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  border-radius: 999px;
  background: #ff6b8a;
  animation: ai-voice-pulse 1s ease-in-out infinite;
}

@keyframes ai-voice-pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.35);
    opacity: 0.55;
  }
}

.ai-chat__composer {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 10px 10px 12px;
  border-radius: 999px;
  border: 1px solid var(--ai-line);
  background: var(--ai-input-bg);
  color: var(--ai-input-text);
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
}

.ai-chat--dark .ai-chat__composer {
  color-scheme: dark;
}

.ai-chat--light .ai-chat__composer {
  color-scheme: light;
}

.ai-chat__mic {
  border: 0;
  background: transparent;
  color: var(--ai-input-placeholder);
  display: grid;
  place-items: center;
  padding: 6px;
  border-radius: 12px;
  cursor: pointer;
}

.ai-chat__mic:hover {
  color: var(--ai-input-text);
}

.ai-chat__mic--on {
  color: #ffb4c0;
  outline: 2px solid rgba(255, 140, 160, 0.35);
}

.ai-chat__input {
  flex: 1;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--ai-input-text);
  -webkit-text-fill-color: var(--ai-input-text);
  caret-color: var(--ai-accent);
  font-size: 16px;
  min-width: 0;
  padding: 8px 6px;
}

.ai-chat__input::placeholder {
  color: var(--ai-input-placeholder);
  opacity: 1;
  -webkit-text-fill-color: var(--ai-input-placeholder);
}

.ai-chat__input:-webkit-autofill,
.ai-chat__input:-webkit-autofill:hover,
.ai-chat__input:-webkit-autofill:focus {
  -webkit-text-fill-color: var(--ai-input-text);
  box-shadow: 0 0 0 1000px var(--ai-input-bg) inset;
  transition: background-color 99999s ease-out 0s;
}

.ai-chat__send {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  border: 0;
  background: linear-gradient(180deg, var(--ai-accent), var(--ai-accent-2));
  color: white;
  display: grid;
  place-items: center;
  cursor: pointer;
}

.ai-chat__send:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.ai-chat__spinner {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: white;
  animation: ai-spin 0.8s linear infinite;
}

@keyframes ai-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (min-width: 769px) {
  .ai-chat__sidebar {
    position: relative;
    transform: none;
    box-shadow: none;
  }
}

@media (max-width: 768px) {
  .ai-chat__sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: min(300px, 88vw);
    transform: translateX(-105%);
    transition: transform 0.22s ease;
    box-shadow: 8px 0 32px rgba(0, 0, 0, 0.25);
  }

  .ai-chat__sidebar--open {
    transform: translateX(0);
  }

  .ai-chat__side-close {
    display: grid;
    place-items: center;
  }

  .ai-chat__burger {
    display: flex;
  }

  .ai-chat__shell {
    width: 100%;
  }

  .ai-chat__main {
    padding: 12px 12px 8px;
  }

  .ai-chat__footer {
    padding: 8px 12px 16px;
  }

  .ai-chat__title {
    font-size: clamp(24px, 7vw, 32px);
  }

  .ai-chat__chip {
    max-width: 100%;
    border-radius: 14px;
  }
}
</style>
