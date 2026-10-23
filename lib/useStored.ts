"use client";

import { useEffect, useState } from "react";

// state ที่จำค่าไว้ใน localStorage ของเบราว์เซอร์ (รีเฟรชแล้วไม่หาย)
// หมายเหตุ: เก็บแยกตามเครื่อง/เบราว์เซอร์ ยังไม่ซิงก์ข้ามอุปกรณ์ จนกว่าจะย้ายไปฐานข้อมูล
export function useStored<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setValue(JSON.parse(raw) as T);
    } catch {}
    setReady(true);
  }, [key]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value, ready]);

  return [value, setValue] as const;
}
