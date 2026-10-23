"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// state ที่ซิงก์กับเซิร์ฟเวอร์ แยกตามผู้ใช้ (ใช้ได้ข้ามอุปกรณ์)
export function useStored<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/state?key=" + encodeURIComponent(key))
      .then(async (r) => {
        if (r.status === 401) {
          window.location.href = "/login";
          return null;
        }
        return r.ok ? ((await r.json()) as { value: T | null }) : null;
      })
      .then((d) => {
        if (cancelled) return;
        if (d && d.value !== null) setValue(d.value);
        setReady(true);
      })
      .catch(() => !cancelled && setReady(true));
    return () => {
      cancelled = true;
    };
  }, [key]);

  const save = useCallback(
    (v: T) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        fetch("/api/state", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ key, value: v }),
          keepalive: true,
        }).catch(() => {});
      }, 400);
    },
    [key],
  );

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const v = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        save(v);
        return v;
      });
    },
    [save],
  );

  return [value, set, ready] as const;
}
