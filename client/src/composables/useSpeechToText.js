import { ref } from 'vue';

/**
 * SpeechRecognition - браузерный API, в Chrome часто висит как webkitSpeechRecognition.
 * MDN: https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition
 */

let recGen = 0;

function detectMobile() {
  if (typeof navigator === 'undefined') return false;
  return (
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    (typeof window !== 'undefined' && window.matchMedia?.('(max-width: 768px)')?.matches)
  );
}

export function useSpeechToText() {
  const listening = ref(false);
  const supported = ref(false);
  const lastError = ref('');
  const isMobile = ref(detectMobile());

  const Recognition =
    typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  if (Recognition) supported.value = true;

  let recognition = null;
  let sessionTranscript = '';
  let userRequestedFinalize = false;
  let doneFired = false;
  let finalizeTimer = null;
  let activeOnDone = null;
  let activeOnChunk = null;

  function clearFinalizeTimer() {
    if (finalizeTimer) {
      clearTimeout(finalizeTimer);
      finalizeTimer = null;
    }
  }

  function fireDone() {
    if (doneFired || !userRequestedFinalize) return;
    const text = sessionTranscript.trim();
    doneFired = true;
    userRequestedFinalize = false;
    clearFinalizeTimer();
    if (text && typeof activeOnDone === 'function') {
      activeOnDone(text);
    }
  }

  /**
   * @param {{ mode?: 'finalize' | 'abort' }} [opts]
   */
  function stop(opts = {}) {
    const mode = opts.mode === 'abort' ? 'abort' : 'finalize';

    if (mode === 'abort') {
      recGen += 1;
      userRequestedFinalize = false;
      doneFired = true;
      clearFinalizeTimer();
    } else {
      userRequestedFinalize = true;
      doneFired = false;
      // на мобилках onend иногда приходит с задержкой или не приходит
      clearFinalizeTimer();
      finalizeTimer = setTimeout(fireDone, 600);
    }

    if (!recognition) {
      listening.value = false;
      if (mode === 'finalize') fireDone();
      return;
    }

    const r = recognition;
    recognition = null;
    try {
      r.stop();
    } catch {
      /* уже остановлено */
    }
    listening.value = false;

  }

  /**
   * onChunk - текст в поле (можно проверить перед отправкой)
   * onDone - только когда пользователь сам нажал «стоп» (второй тап по микрофону)
   */
  function start({ lang = 'ru-RU', onChunk, onDone } = {}) {
    lastError.value = '';
    if (!Recognition) {
      lastError.value = 'Браузер без Web Speech API (попробуй Chrome / Edge на Android)';
      return;
    }

    stop({ mode: 'abort' });
    const myGen = recGen;

    sessionTranscript = '';
    userRequestedFinalize = false;
    doneFired = false;
    activeOnDone = onDone;
    activeOnChunk = onChunk;

    let skipAutoDone = false;
    const useContinuous = isMobile.value;

    recognition = new Recognition();
    recognition.lang = lang;
    recognition.interimResults = true;
    // на телефоне иначе браузер сам рвёт сессию через пару секунд
    recognition.continuous = useContinuous;

    recognition.onstart = () => {
      listening.value = true;
    };

    recognition.onerror = (ev) => {
      listening.value = false;
      if (ev.error === 'no-speech') {
        lastError.value = '';
        skipAutoDone = true;
        return;
      }
      if (ev.error === 'aborted') {
        skipAutoDone = true;
        return;
      }
      skipAutoDone = true;
      lastError.value = ev.message || ev.error || 'speech error';
    };

    recognition.onend = () => {
      listening.value = false;
      if (myGen !== recGen) return;

      const t = sessionTranscript.trim();
      if (t && activeOnChunk) activeOnChunk(t, true);

      if (skipAutoDone) return;

      // авто-onend без тапа «стоп» - только текст в инпут, без отправки
      if (userRequestedFinalize) {
        fireDone();
      }
    };

    recognition.onresult = (event) => {
      let all = '';
      for (let i = 0; i < event.results.length; i += 1) {
        all += event.results[i][0].transcript;
      }
      sessionTranscript = all;
      const last = event.results[event.results.length - 1];
      if (activeOnChunk) activeOnChunk(all, last?.isFinal === true);
    };

    try {
      recognition.start();
    } catch (e) {
      listening.value = false;
      lastError.value = e instanceof Error ? e.message : String(e);
    }
  }

  return { supported, listening, lastError, isMobile, start, stop };
}
