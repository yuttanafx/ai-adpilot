import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, authConfigured, isValidSession } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");

  if (!authConfigured()) {
    // ตอนพัฒนาในเครื่องปล่อยผ่านได้ แต่บน production ต้องตั้งรหัสผ่านก่อนเสมอ
    if (process.env.NODE_ENV !== "production") return NextResponse.next();
    const msg = "ยังไม่ได้ตั้งค่า APP_PASSWORD ในระบบ จึงปิดการเข้าถึงไว้เพื่อความปลอดภัย";
    return isApi
      ? NextResponse.json({ error: msg }, { status: 503 })
      : new NextResponse(msg, { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  if (pathname === "/login" || pathname === "/api/login") return NextResponse.next();

  if (await isValidSession(req.cookies.get(COOKIE_NAME)?.value)) return NextResponse.next();

  if (isApi) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
