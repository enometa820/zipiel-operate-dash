"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";

function safeParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// SSR 안전 localStorage 훅 — useSyncExternalStore 기반(effect-setState 없이 lint-clean).
// 서버/하이드레이션은 initial, 클라는 저장값. 같은 탭 갱신은 수동 storage 이벤트로 전파.
export function useLocalStorage<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const cache = useRef<{ raw: string | null; val: T }>({ raw: null, val: initial });

  const subscribe = useCallback(
    (cb: () => void) => {
      const handler = (e: StorageEvent) => {
        if (e.key === null || e.key === key) cb();
      };
      window.addEventListener("storage", handler);
      return () => window.removeEventListener("storage", handler);
    },
    [key]
  );

  const getSnapshot = useCallback((): T => {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      /* 접근 불가 무시 */
    }
    if (raw !== cache.current.raw) {
      cache.current = { raw, val: raw != null ? safeParse(raw, initial) : initial };
    }
    return cache.current.val;
  }, [key, initial]);

  const getServerSnapshot = useCallback((): T => initial, [initial]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setValue = useCallback(
    (v: T | ((p: T) => T)) => {
      const next = typeof v === "function" ? (v as (p: T) => T)(getSnapshot()) : v;
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* 용량 초과 등 무시 */
      }
      // 같은 탭 구독자에게도 알림(브라우저 storage 이벤트는 다른 탭만 발화)
      window.dispatchEvent(new StorageEvent("storage", { key }));
    },
    [key, getSnapshot]
  );

  return [value, setValue];
}
