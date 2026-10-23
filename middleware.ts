import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, authSecret, verifySession } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");

  // กัน CSRF: คำขอที่แก้ข้อมูลต้องมาจากโดเมนเดียวกัน
  if (isApi && req.method !== "GET" && req.method !== "HEAD") {
    const origin = req.headers.get("origin");
    if (origin && new URL(origin).host !== req.headers.get("host")) {
      return NextResponse.json({ error: "คำขอไม่ได้รับอนุญาต" }, { status: 403 });
    }
  }

  const secret = authSecret();
  if (!secret) {
    const msg = "ยังไม่ได้ตั้งค่า AUTH_SECRET (อย่างน้อย 16 ตัวอักษร) จึงปิดการเข้าถึงไว้เพื่อความปลอดภัย";
    return isApi
      ? NextResponse.json({ error: msg }, { status: 503 })
      : new NextResponse(msg, { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  const authed = Boolean(await verifySession(req.cookies.get(COOKIE_NAME)?.value, secret));

  if (pathname === "/login") {
    if (authed) return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  }
  if (pathname === "/api/login") return NextResponse.next();
  if (authed) return NextResponse.next();

  if (isApi) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
