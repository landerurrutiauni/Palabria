import { NextResponse, type NextRequest } from "next/server";
import {
  IDENTITY_COOKIE,
  identityCookieOptions,
  identitySecret,
  mintIdentityToken,
  verifyIdentityToken,
} from "@/lib/server/identity-token";

/**
 * Identidad anónima sin registro: si el visitante no tiene una cookie de
 * identidad válida (firmada por el servidor), se le asigna una nueva. La
 * cookie es HttpOnly, SameSite=Lax y Secure en producción.
 */
export function proxy(request: NextRequest) {
  const current = request.cookies.get(IDENTITY_COOKIE)?.value;
  if (verifyIdentityToken(current, identitySecret())) return NextResponse.next();

  const token = mintIdentityToken(identitySecret());
  // Se añade también a la petición para que el servidor la vea ya en esta visita.
  request.cookies.set(IDENTITY_COOKIE, token);
  const response = NextResponse.next({ request: { headers: request.headers } });
  response.cookies.set(IDENTITY_COOKIE, token, identityCookieOptions());
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sounds/|.*\\.(?:svg|png|jpg|webp|ico|woff2?)$).*)"],
};
