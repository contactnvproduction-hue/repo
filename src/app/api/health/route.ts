import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    const userCount = await prisma.user.count()
    return NextResponse.json({ status: 'ok', db: 'connected', users: userCount, timestamp: new Date().toISOString() })
  } catch (e) {
    return NextResponse.json({ status: 'error', db: 'disconnected' }, { status: 503 })
  }
}
