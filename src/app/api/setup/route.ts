import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

// Emergency password reset — only active when SETUP_TOKEN env var is set on Render.
// Remove SETUP_TOKEN from Render env vars after use.
export async function POST(req: NextRequest) {
  const setupToken = process.env.SETUP_TOKEN
  if (!setupToken) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await req.json()
  const { token, email, newPassword } = body

  if (!token || token !== setupToken) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
  }

  if (!email || !newPassword || newPassword.length < 6) {
    return NextResponse.json({ error: 'email and newPassword (min 6 chars) required' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return NextResponse.json({ error: `No user found with email: ${email}` }, { status: 404 })
  }

  const hashed = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({ where: { email }, data: { password: hashed } })

  return NextResponse.json({ ok: true, message: `Password reset for ${user.name} (${email})` })
}

// List users (emails only) — to help identify the right account
export async function GET(req: NextRequest) {
  const setupToken = process.env.SETUP_TOKEN
  if (!setupToken) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const token = req.nextUrl.searchParams.get('token')
  if (!token || token !== setupToken) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
  }

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true },
    orderBy: { role: 'asc' },
  })

  return NextResponse.json({ users })
}
