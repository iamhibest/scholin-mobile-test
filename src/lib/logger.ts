type Entry = { time: string; level: 'info' | 'error'; message: string };

const entries: Entry[] = [];
const listeners = new Set<() => void>();

function push(level: Entry['level'], message: string) {
  entries.unshift({ time: new Date().toLocaleTimeString(), level, message });
  if (entries.length > 200) {
    entries.pop();
  }
  listeners.forEach(l => l());
}

export const logger = {
  info: (message: string) => push('info', message),
  error: (message: string) => push('error', message),
  all: () => entries,
  clear: () => {
    entries.length = 0;
    listeners.forEach(l => l());
  },
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
