import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Settings, Tag, DatabaseBackup, CheckSquare, Users, MapPin } from 'lucide-react'
import { SettingsForm } from '@/components/settings/SettingsForm'
import { CategoryManager } from '@/components/projects/CategoryManager'
import { DataBackup } from '@/components/settings/DataBackup'
import { TaskCategoryManager } from '@/components/settings/TaskCategoryManager'
import { UserManager } from '@/components/settings/UserManager'
import { SpotManager } from '@/components/settings/SpotManager'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user) return null

  let settings = await prisma.agencySetting.findFirst()
  if (!settings) {
    settings = await prisma.agencySetting.create({ data: { updatedAt: new Date() } })
  }

  const taskCategories = await prisma.taskCategory.findMany({ orderBy: { order: 'asc' } })
  const spots = await (prisma as any).shootingSpot.findMany({ orderBy: [{ city: 'asc' }, { order: 'asc' }] })
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, phone: true, specialty: true, disponible: true, avatar: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  const isAdminOrManager = ['ADMIN', 'MANAGER'].includes(session.user.role)

  return (
    <div className="space-y-8 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Settings size={24} className="text-primary" />
          Paramètres agence
        </h1>
        <p className="text-sm text-nv-text-muted mt-1">Configurez les informations de votre agence</p>
      </div>

      <SettingsForm settings={settings} />

      {/* Gestion des utilisateurs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users size={16} className="text-primary" />
            Accès & Utilisateurs
          </CardTitle>
          <p className="text-sm text-nv-text-muted">Gérez les comptes qui ont accès au dashboard. Chaque utilisateur est aussi membre de l&apos;équipe.</p>
        </CardHeader>
        <CardContent>
          <UserManager
            initialUsers={users.map(u => ({ ...u, createdAt: u.createdAt.toISOString() }))}
            currentUserId={session.user.id}
            isAdmin={isAdminOrManager}
          />
        </CardContent>
      </Card>

      {isAdminOrManager && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Tag size={16} className="text-primary" />
              Catégories de projets
            </CardTitle>
            <p className="text-sm text-nv-text-muted">Créez et gérez vos catégories personnalisées pour organiser vos projets.</p>
          </CardHeader>
          <CardContent>
            <CategoryManager />
          </CardContent>
        </Card>
      )}

      {isAdminOrManager && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckSquare size={16} className="text-primary" />
              Catégories de tâches
            </CardTitle>
            <p className="text-sm text-nv-text-muted">Définissez les colonnes du board de tâches et leurs options (étapes, statuts personnalisés).</p>
          </CardHeader>
          <CardContent>
            <TaskCategoryManager initialCategories={taskCategories} />
          </CardContent>
        </Card>
      )}

      {isAdminOrManager && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin size={16} className="text-primary" />
              Spots de tournage — Formulaire onboarding
            </CardTitle>
            <p className="text-sm text-nv-text-muted">Bibliothèque des lieux proposés aux nouveaux clients dans le formulaire d'onboarding <code className="text-primary text-xs">/onboarding</code>.</p>
          </CardHeader>
          <CardContent>
            <SpotManager initialSpots={spots} />
          </CardContent>
        </Card>
      )}

      {isAdminOrManager && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <DatabaseBackup size={16} className="text-primary" />
              Sauvegarde des données
            </CardTitle>
            <p className="text-sm text-nv-text-muted">Exportez toutes vos données en JSON pour les sécuriser ou les restaurer.</p>
          </CardHeader>
          <CardContent>
            <DataBackup />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
