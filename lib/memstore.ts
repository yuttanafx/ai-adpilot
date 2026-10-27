// ที่เก็บข้อมูลจำลองที่เลียนแบบ API ของ Firestore เฉพาะส่วนที่แอปใช้ — สำหรับพัฒนาในเครื่องโดยไม่ต้องมี Firebase เท่านั้น
// (ไม่ใช้ใน production) เก็บลงไฟล์ .data/dev-store.json เพื่อให้ข้อมูลไม่หายเมื่อรีสตาร์ต
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

type Data = Record<string, unknown>;
const FILE = "./.data/dev-store.json";

const err = (code: number, msg: string) => Object.assign(new Error(msg), { code });

type Snap = { id: string; exists: boolean; data: () => Data | undefined; ref: unknown };
type Query = {
  where: (f: string, op: string, v: unknown) => Query;
  orderBy: (f: string) => Query;
  limit: (n: number) => Query;
  get: () => Promise<{ empty: boolean; docs: Snap[]; size: number }>;
};

export function createMemoryDb() {
  const store = new Map<string, Data>();
  try {
    if (existsSync(FILE)) for (const [k, v] of Object.entries(JSON.parse(readFileSync(FILE, "utf8")))) store.set(k, v as Data);
  } catch {
    /* เริ่มใหม่ */
  }
  const save = () => {
    try {
      mkdirSync("./.data", { recursive: true });
      writeFileSync(FILE, JSON.stringify(Object.fromEntries(store)));
    } catch {
      /* ไม่เป็นไร */
    }
  };

  const snap = (path: string): Snap => {
    const d = store.get(path);
    return { id: path.split("/").pop()!, exists: d !== undefined, data: () => (d ? structuredClone(d) : undefined), ref: docRef(path) };
  };
  const docsIn = (colPath: string): Snap[] =>
    [...store.keys()].filter((k) => k.startsWith(colPath + "/") && !k.slice(colPath.length + 1).includes("/")).map(snap);

  type Filter = { f: string; v: unknown };
  const query = (load: () => Snap[], filters: Filter[] = [], order?: string, lim?: number): Query => ({
    where: (f: string, _op: string, v: unknown) => query(load, [...filters, { f, v }], order, lim),
    orderBy: (f: string) => query(load, filters, f, lim),
    limit: (n: number) => query(load, filters, order, n),
    get: async () => {
      let docs: Snap[] = load().filter((d) => filters.every((x) => (d.data() as Data)[x.f] === x.v));
      if (order) docs = [...docs].sort((a: Snap, b: Snap) => String((a.data() as Data)[order] ?? "").localeCompare(String((b.data() as Data)[order] ?? "")));
      if (lim !== undefined) docs = docs.slice(0, lim);
      return { empty: docs.length === 0, docs, size: docs.length };
    },
  });

  function colRef(path: string) {
    return { ...query(() => docsIn(path)), doc: (id: string) => docRef(path + "/" + id) };
  }
  function docRef(path: string) {
    return {
      id: path.split("/").pop()!,
      path,
      get: async () => snap(path),
      set: async (data: Data, opts?: { merge?: boolean }) => {
        store.set(path, opts?.merge ? { ...(store.get(path) ?? {}), ...structuredClone(data) } : structuredClone(data));
        save();
      },
      create: async (data: Data) => {
        if (store.has(path)) throw err(6, "ALREADY_EXISTS");
        store.set(path, structuredClone(data));
        save();
      },
      update: async (data: Data) => {
        if (!store.has(path)) throw err(5, "NOT_FOUND");
        store.set(path, { ...store.get(path)!, ...structuredClone(data) });
        save();
      },
      delete: async () => {
        store.delete(path);
        save();
      },
      collection: (name: string) => colRef(path + "/" + name),
    };
  }

  return {
    collection: (name: string) => colRef(name),
    collectionGroup: (name: string) => query(() => [...store.keys()].filter((k) => k.split("/").length % 2 === 0 && k.split("/").slice(-2, -1)[0] === name).map(snap)),
    recursiveDelete: async (ref: { path: string }) => {
      for (const k of [...store.keys()]) if (k === ref.path || k.startsWith(ref.path + "/")) store.delete(k);
      save();
    },
    settings: () => {},
  };
}
