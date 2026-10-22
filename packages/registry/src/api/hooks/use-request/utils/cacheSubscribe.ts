'use client';

type Listener = (data: unknown) => void;
const listeners: Record<string, Listener[]> = {};

/**
 * Trigger cache update to all listeners
 */
const trigger = (key: string, data: unknown): void => {
  if (listeners[key]) {
    listeners[key].forEach((item) => item(data));
  }
};

/**
 * Subscribe to cache changes
 */
const subscribe = (key: string, listener: Listener): (() => void) => {
  if (!listeners[key]) {
    listeners[key] = [];
  }
  listeners[key].push(listener);

  return function unsubscribe() {
    const index = listeners[key]?.indexOf(listener);
    if (index !== undefined && index >= 0) {
      listeners[key]?.splice(index, 1);
    }
  };
};

export {trigger, subscribe};
