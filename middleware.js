import { NextResponse } from "next/server";

export function middleware(req) {
  const basicAuth = req.headers.get("authorization");

  if (basicAuth) {
    const [user, pwd] = atob(basicAuth.split(" ")[1]).split(":");

    if (user === "admin" && pwd === "secret@654") {
      return NextResponse.next();
    }
  }

  return new Response("Auth required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Secure Area"',
    },
  });
}
