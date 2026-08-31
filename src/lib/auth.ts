import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './db'
import { UserRole } from '@prisma/client'

const DEV_SESSION = process.env.DEV_MOCK_DB === 'true' ? {
  user: { id: 'dev', name: 'Noah Rapharin', email: 'admin@newvision.fr', role: 'ADMIN' as UserRole, roles: ['COMMERCIAL'] as string[], avatar: null },
  expires: '2099-01-01',
} : null

const { auth: _auth, handlers, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Mot de passe', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        })

        if (!user) return null

        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.password
        )

        if (!passwordMatch) return null

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          roles: (user as any).roles ?? [],
          avatar: user.avatar,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id ?? ''
        token.role = (user as any).role
        token.roles = (user as any).roles ?? []
        // Avatar NOT stored in JWT — base64 images make the token too large,
        // causing NextAuth to chunk it across multiple cookies (.0, .1, ...),
        // which breaks getToken() in the middleware. Fetched from DB in layout instead.
      }
      // Rafraîchit le rôle depuis la base à chaque requête → un changement de rôle
      // (ou le rattrapage Noah) est pris en compte immédiatement, sans reconnexion.
      if (token.id) {
        try {
          const db: any = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { email: true, name: true, role: true, roles: true } as any,
          })
          if (db) {
            let role: string = db.role
            let roles: string[] = Array.isArray(db.roles) ? db.roles : []
            // Noah Rapharin : toujours ADMIN (principal) + COMMERCIAL (additionnel)
            const isNoah = db.email === 'nrapharin@gmail.com' || /rapharin/i.test(db.name || '')
            if (isNoah && (role !== 'ADMIN' || !roles.includes('COMMERCIAL'))) {
              roles = Array.from(new Set([...roles, ...(role !== 'ADMIN' && role !== 'COMMERCIAL' ? [role] : []), 'COMMERCIAL'])).filter(r => r !== 'ADMIN')
              await prisma.user.update({ where: { id: token.id as string }, data: { role: 'ADMIN', roles } as any }).catch(() => {})
              role = 'ADMIN'
            }
            token.role = role as UserRole
            token.roles = roles
          }
        } catch { /* base indisponible : on garde le token existant */ }
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as UserRole
        session.user.roles = (token.roles as string[]) ?? []
        session.user.avatar = null
      }
      return session
    },
  },
})

export const auth = DEV_SESSION ? async () => DEV_SESSION : _auth
export { handlers, signIn, signOut }
