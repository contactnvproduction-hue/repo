import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Next.js 16: proxy.ts (renamed from middleware.ts) — runs in Node.js runtime by default
// This gives us access to the 'crypto' module (needed by NextAuth JWT verification)

export async function proxy(req: NextRequest) {
  const { nextUrl } = req

  // Dev bypass — aucune auth requise en mode mock
  if (process.env.DEV_MOCK_DB === 'true') {
    if (nextUrl.pathname.startsWith('/login')) {
      return NextResponse.redirect(new URL('/dashboard', nextUrl))
    }
    return NextResponse.next()
  }

  // Render/Cloudflare terminates SSL — check x-forwarded-proto before nextUrl.protocol
  const forwardedProto = req.headers.get('x-forwarded-proto')
  const isSecure = forwardedProto === 'https' || nextUrl.protocol === 'https:'

  const isAuthPage          = nextUrl.pathname.startsWith('/login')
  const isApiAuthRoute      = nextUrl.pathname.startsWith('/api/auth')
  const isPublicApiRoute    = nextUrl.pathname.startsWith('/api/public')
  const isHealthRoute       = nextUrl.pathname === '/api/health'
  const isStaticAsset       = nextUrl.pathname.startsWith('/api/settings/public')
  // Plateforme de signature : page HTML publique + route /contrat/CODE + API contrats
  const isSignaturePage     = nextUrl.pathname === '/nv-signature.html'
  const isContratRoute      = nextUrl.pathname.startsWith('/contrat/')
  const isContractsApi      = nextUrl.pathname.startsWith('/api/contracts')
  // Suivi relances équipe — formulaire public accessible sans compte
  const isSuiviPage         = nextUrl.pathname.startsWith('/suivi')
  const isSuiviApi          = nextUrl.pathname.startsWith('/api/suivi')
  // Pages de partage (plan de tournage, brief client) — liens publics envoyés aux clients
  const isSharePage         = nextUrl.pathname.startsWith('/share/')

  // Always allow through
  if (isApiAuthRoute || isPublicApiRoute || isHealthRoute || isStaticAsset
      || isSignaturePage || isContratRoute || isContractsApi
      || isSuiviPage || isSuiviApi || isSharePage) {
    return NextResponse.next()
  }

  // secureCookie: true → '__Secure-authjs.session-token', false → 'authjs.session-token'
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
    secureCookie: isSecure,
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
