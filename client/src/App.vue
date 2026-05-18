<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { useChatApi } from './composables/useChatApi.js';
import { useSpeechToText } from './composables/useSpeechToText.js';

const { sendMessages } = useChatApi();
const speech = useSpeechToText();

const input = ref('');
const messages = ref([]);
const loading = ref(false);
const error = ref('');
const threadEl = ref(null);

const hasThread = computed(() => messages.value.length > 0);

const quickPrompts = [
  'Summarize the difference between REST and GraphQL',
  'Give me a simple dinner recipe with chicken',
  'How do I center a div (asking for a friend)',
];

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
  // system msg опционально — иногда помогает тону, но для тестового не усложняем
  return messages.value.map((m) => ({ role: m.role, content: m.content }));
}

async function submit() {
  error.value = '';
  const draft = input.value.trim();
  if (!draft) return;

  messages.value.push({ role: 'user', content: draft });
  input.value = '';
  loading.value = true;
  await scrollThreadToBottom();

  try {
    const reply = await sendMessages(buildPayload());
    messages.value.push({ role: 'assistant', content: reply });
  } catch (e) {
    messages.value.pop();
    input.value = draft;
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
    await scrollThreadToBottom();
  }
}

function onKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!loading.value) submit();
  }
}

function useQuickPrompt(text) {
  if (loading.value) return;
  input.value = text;
}

function toggleMic() {
  error.value = '';
  if (speech.listening.value) {
    speech.stop();
    return;
  }

  speech.start({
    lang: 'en-US',
    onChunk: (text) => {
      input.value = text;
    },
  });
}

watch(speech.lastError, (v) => {
  if (v) error.value = v;
});
</script>

<template>
  <div class="ai-chat">
    <button type="button" class="ai-chat__logo-btn" aria-label="Chat">
      <span class="ai-chat__logo-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
          <path
            d="M7 10h10M7 14h6"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
          <path
            d="M6 4h12a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-4l-4 3v-3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z"
            stroke="currentColor"
            stroke-width="2"
            stroke-linejoin="round"
          />
        </svg>
      </span>
    </button>

    <main class="ai-chat__main">
      <div v-if="!hasThread" class="ai-chat__hero">
        <p class="ai-chat__hello">Hi there!</p>
        <h1 class="ai-chat__title">What would you like to know?</h1>
        <p class="ai-chat__hint">
          Use one of the most common prompts below or ask your own question
        </p>

        <div class="ai-chat__chips" aria-label="Quick prompts">
          <button
            v-for="(q, idx) in quickPrompts"
            :key="idx"
            type="button"
            class="ai-chat__chip"
            @click="useQuickPrompt(q)"
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
          <div class="ai-chat__msg-label">{{ m.role === 'user' ? 'You' : 'AI' }}</div>
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
      <p v-if="error" class="ai-chat__error" role="alert">{{ error }}</p>

      <form class="ai-chat__composer" @submit.prevent="submit">
        <button
          v-if="speech.supported"
          type="button"
          class="ai-chat__mic"
          :class="{ 'ai-chat__mic--on': speech.listening }"
          :aria-pressed="speech.listening"
          aria-label="Voice input"
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
          placeholder="Ask whatever you want"
          :disabled="loading"
          @keydown="onKeydown"
        />

        <button
          type="submit"
          class="ai-chat__send"
          :disabled="loading || !input.trim()"
          aria-label="Send"
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
</template>

<style scoped>
/* палитра близко к референсу: тёмный синий фон, светлый текст */
:root {
  --ai-bg: #0b1220;
  --ai-panel: #111b2e;
  --ai-text: #f5f7ff;
  --ai-muted: #9fb0d0;
  --ai-line: rgba(255, 255, 255, 0.08);
  --ai-accent: #3b6cf3;
  --ai-accent-2: #2f55d4;
  --ai-danger: #ff7b8a;
}

.ai-chat {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: radial-gradient(1200px 600px at 50% 0%, #132042 0%, var(--ai-bg) 55%);
  color: var(--ai-text);
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;
}

.ai-chat__logo-btn {
  position: fixed;
  top: 18px;
  left: 18px;
  z-index: 2;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: 1px solid var(--ai-line);
  background: rgba(255, 255, 255, 0.04);
  color: var(--ai-text);
  display: grid;
  place-items: center;
  cursor: default;
}

.ai-chat__logo-icon {
  display: grid;
  place-items: center;
  opacity: 0.95;
}

.ai-chat__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 88px 20px 16px;
  width: min(920px, 100%);
  margin: 0 auto;
}

.ai-chat__hero {
  flex: 1;
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
  background: rgba(255, 255, 255, 0.03);
  color: var(--ai-text);
  padding: 10px 12px;
  border-radius: 999px;
  font-size: 13px;
  line-height: 1.25;
  cursor: pointer;
  max-width: min(100%, 420px);
  text-align: left;
}

.ai-chat__chip:hover {
  border-color: rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.05);
}

.ai-chat__thread {
  flex: 1;
  overflow: auto;
  padding: 10px 4px 10px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ai-chat__msg {
  border: 1px solid var(--ai-line);
  background: rgba(255, 255, 255, 0.03);
  border-radius: 16px;
  padding: 12px 12px 12px;
}

.ai-chat__msg--user {
  align-self: flex-end;
  max-width: min(720px, 92%);
  background: rgba(59, 108, 243, 0.12);
  border-color: rgba(59, 108, 243, 0.25);
}

.ai-chat__msg--bot {
  align-self: stretch;
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
  width: min(920px, 100%);
  margin: 0 auto;
  padding: 10px 16px 22px;
}

.ai-chat__error {
  margin: 0 8px 10px;
  color: var(--ai-danger);
  font-size: 13px;
  line-height: 1.35;
}

.ai-chat__composer {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 10px 10px 12px;
  border-radius: 999px;
  border: 1px solid var(--ai-line);
  background: rgba(17, 27, 46, 0.75);
  backdrop-filter: blur(10px);
}

.ai-chat__mic {
  border: 0;
  background: transparent;
  color: var(--ai-muted);
  display: grid;
  place-items: center;
  padding: 6px;
  border-radius: 12px;
  cursor: pointer;
}

.ai-chat__mic:hover {
  color: var(--ai-text);
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
  color: var(--ai-text);
  font-size: 16px;
  min-width: 0;
  padding: 8px 6px;
}

.ai-chat__input::placeholder {
  color: rgba(159, 176, 208, 0.75);
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
</style>
