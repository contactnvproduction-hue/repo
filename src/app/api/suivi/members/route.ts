import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Public — no auth needed (used by the external form page)
export async function GET() {
  const users = await prisma.user.findMany({
    where: { includeInSuivi: true },
    select: { id: true, name: true, role: true },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(users)
}
