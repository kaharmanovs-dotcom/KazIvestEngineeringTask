import { useToast } from 'primevue/usetoast';

/** Всплывающие уведомления через PrimeVue Toast */
export function useNotify() {
  const toast = useToast();

  function error(detail, summary = 'Ошибка') {
    const text = detail == null ? '' : String(detail).trim();
    if (!text) return;
    toast.add({
      severity: 'error',
      summary,
      detail: text,
      life: 6000,
    });
  }

  function warn(detail, summary = 'Внимание') {
    const text = detail == null ? '' : String(detail).trim();
    if (!text) return;
    toast.add({
      severity: 'warn',
      summary,
      detail: text,
      life: 5000,
    });
  }

  function success(detail, summary = 'Готово') {
    const text = detail == null ? '' : String(detail).trim();
    if (!text) return;
    toast.add({
      severity: 'success',
      summary,
      detail: text,
      life: 3500,
    });
  }

  return { error, warn, success };
}
