import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './db'
import { UserRole } from '@prisma/client'

const DEV_SESSION = process.env.DEV_MOCK_DB === 'true' ? {
  user: { id: 'dev', name: 'Noah Rapharin', email: 'admin@newvision.fr', role: 'ADMIN' as UserRole, avatar: null },
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
        // Avatar NOT stored in JWT — base64 images make the token too large,
        // causing NextAuth to chunk it across multiple cookies (.0, .1, ...),
        // which breaks getToken() in the middleware. Fetched from DB in layout instead.
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as UserRole
        session.user.avatar = null
      }
      return session
    },
  },
})

export const auth = DEV_SESSION ? async () => DEV_SESSION : _auth
export { handlers, signIn, signOut }
