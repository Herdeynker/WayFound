import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isTestFixtureHeader, testAuthHeader } from "@/lib/auth/test-fixture";

const protectedPrefixes = ["/dashboard", "/settings", "/consent"];

function isProtectedPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  );
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const testFixture = isTestFixtureHeader(request.headers.get(testAuthHeader));

  // Playwright's fixture is a controlled static shell only; production never sets this flag.
  if (testFixture) return response;

  const hasAuthCookie = request.cookies
    .getAll()
    .some(({ name }) => name.startsWith("sb-") && name.includes("auth-token"));
  if (isProtectedPath(request.nextUrl.pathname) && !hasAuthCookie) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(login);
  }

  if (!url || !key) {
    if (isProtectedPath(request.nextUrl.pathname) && !testFixture) {
      return NextResponse.redirect(new URL("/login?error=configuration", request.url));
    }
    return response;
  }

  const client = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values: Array<{ name: string; value: string; options: CookieOptions }>) {
        values.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });
  const { data } = await client.auth.getUser();
  if (isProtectedPath(request.nextUrl.pathname) && !data.user && !testFixture) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/settings/:path*", "/consent/:path*"],
};
