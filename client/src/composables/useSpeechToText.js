import { ref } from 'vue';

/**
 * SpeechRecognition — браузерный API, в Chrome часто висит как webkitSpeechRecognition.
 * MDN: https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition
 */
export function useSpeechToText() {
  const listening = ref(false);
  const supported = ref(false);
  const lastError = ref('');

  const Recognition =
    typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  if (Recognition) supported.value = true;

  let recognition = null;

  function stop() {
    if (!recognition) return;
    try {
      recognition.stop();
    } catch {
      // иногда бросает если уже остановлено — не критично
    }
    listening.value = false;
  }

  /**
   * onChunk — потоковый текст (interim + final), чтобы кидать прямо в input
   */
  function start({ lang = 'ru-RU', onChunk } = {}) {
    lastError.value = '';
    if (!Recognition) {
      lastError.value = 'Браузер без Web Speech API (попробуй Chrome / Edge)';
      return;
    }

    stop();
    recognition = new Recognition();
    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => {
      listening.value = true;
    };

    recognition.onerror = (ev) => {
      listening.value = false;
      // no-speech бывает если помолчал — не пугаем юзера как «фатал»
      if (ev.error === 'no-speech') {
        lastError.value = '';
        return;
      }
      lastError.value = ev.message || ev.error || 'speech error';
    };

    recognition.onend = () => {
      listening.value = false;
    };

    recognition.onresult = (event) => {
      let text = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        text += event.results[i][0].transcript;
      }
      if (onChunk) onChunk(text, event.results[event.results.length - 1]?.isFinal === true);
    };

    try {
      recognition.start();
    } catch (e) {
      listening.value = false;
      lastError.value = e instanceof Error ? e.message : String(e);
    }
  }

  return { supported, listening, lastError, start, stop };
}
