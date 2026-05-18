import { onMounted, ref, watch } from 'vue';

const STORAGE_KEY = 'kazivest-theme';

function readInitial() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* */
  }
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)')?.matches) {
    return 'light';
  }
  return 'dark';
}

export function useTheme() {
  const theme = ref(readInitial());

  function apply(t) {
    theme.value = t === 'light' ? 'light' : 'dark';
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme.value);
    }
    try {
      localStorage.setItem(STORAGE_KEY, theme.value);
    } catch {
      /* private mode */
    }
  }

  function toggle() {
    apply(theme.value === 'dark' ? 'light' : 'dark');
  }

  onMounted(() => {
    document.documentElement.setAttribute('data-theme', theme.value);
  });

  watch(theme, (t) => {
    document.documentElement.setAttribute('data-theme', t);
  });

  return { theme, apply, toggle };
}
