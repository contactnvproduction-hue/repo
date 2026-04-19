import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Next.js 16: proxy.ts (renamed from middleware.ts) — runs in Node.js runtime by default
// This gives us access to the 'crypto' module (needed by NextAuth JWT verification)

export async function proxy(req: NextRequest) {
  const { nextUrl } = req

  const isAuthPage       = nextUrl.pathname.startsWith('/login')
  const isApiAuthRoute   = nextUrl.pathname.startsWith('/api/auth')
  const isPublicApiRoute = nextUrl.pathname.startsWith('/api/public')
  const isHealthRoute    = nextUrl.pathname === '/api/health'
  const isStaticAsset    = nextUrl.pathname.startsWith('/api/settings/public')

  // Always allow through
  if (isApiAuthRoute || isPublicApiRoute || isHealthRoute || isStaticAsset) {
    return NextResponse.next()
  }

  // Check session via JWT token in cookie
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  })
  const isLoggedIn = !!token

  // Redirect to login if not authenticated
  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', nextUrl))
  }

  // Redirect to dashboard if already logged in and trying to access login
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', nextUrl))
  }

  return NextResponse.next()
}

export const config = {
  // Exclude Next.js internals, static files, and common public assets
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.svg$|.*\\.ico$|.*\\.webp$|.*\\.woff|.*\\.woff2|.*\\.ttf).*)'],
}
