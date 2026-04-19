import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { stepId, completed } = await req.json()

  const step = await prisma.onboardingStep.update({
    where: { id: stepId },
    data: { completed, completedAt: completed ? new Date() : null },
  })
  return NextResponse.json(step)
}
