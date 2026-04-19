import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

// Prisma v7: requires driver adapter
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Démarrage du seed...')

  // ─── NETTOYAGE ────────────────────────────────────────────────────────────
  await prisma.notification.deleteMany()
  await prisma.document.deleteMany()
  await prisma.expense.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.invoiceLine.deleteMany()
  await prisma.invoice.deleteMany()
  await prisma.quoteLine.deleteMany()
  await prisma.quote.deleteMany()
  await prisma.onboardingStep.deleteMany()
  await prisma.projectComment.deleteMany()
  await prisma.task.deleteMany()
  await prisma.projectMember.deleteMany()
  await prisma.project.deleteMany()
  await prisma.projectCategory.deleteMany()
  await prisma.clientInteraction.deleteMany()
  await prisma.client.deleteMany()
  await prisma.objective.deleteMany()
  await prisma.agencySetting.deleteMany()
  await prisma.user.deleteMany()

  console.log('🗑️  Données existantes supprimées')

  // ─── PARAMÈTRES AGENCE ────────────────────────────────────────────────────
  await prisma.agencySetting.create({
    data: {
      name: 'New Vision Production',
      email: 'contact@newvision.fr',
      phone: '06 12 34 56 78',
      address: '12 rue de la Paix, 75001 Paris',
      siret: '123 456 789 00010',
      tvaNumber: 'FR12345678900',
      defaultVatRate: 20,
      invoicePrefix: 'FAC',
      quotePrefix: 'DEV',
      invoiceCounter: 10,
      quoteCounter: 8,
      bankDetails: 'IBAN: FR76 1234 5678 9012 3456 7890 123\nBIC: BNPAFRPPXXX\nBanque BNP Paribas',
      cgv: 'Paiement à 30 jours. Tout retard de paiement entraîne des pénalités de 3x le taux légal. Escompte pour paiement anticipé : 0%.',
    },
  })
  console.log('⚙️  Paramètres agence créés')

  // ─── UTILISATEURS ─────────────────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash('newvision2024', 12)

  const admin = await prisma.user.create({
    data: {
      name: 'Noah Rapharin',
      email: 'admin@newvision.fr',
      password: hashedPassword,
      role: 'ADMIN',
      specialty: 'Direction & Réalisation',
      phone: '06 12 34 56 78',
      disponible: true,
    },
  })

  const manager = await prisma.user.create({
    data: {
      name: 'Sarah Martin',
      email: 'sarah@newvision.fr',
      password: hashedPassword,
      role: 'MANAGER',
      specialty: 'Production & Coordination',
      phone: '06 23 45 67 89',
      disponible: true,
    },
  })

  const videoaste = await prisma.user.create({
    data: {
      name: 'Lucas Dubois',
      email: 'lucas@newvision.fr',
      password: hashedPassword,
      role: 'VIDÉASTE',
      specialty: 'Vidéaste & Cadreur',
      phone: '06 34 56 78 90',
      disponible: true,
    },
  })

  const monteur = await prisma.user.create({
    data: {
      name: 'Emma Blanc',
      email: 'emma@newvision.fr',
      password: hashedPassword,
      role: 'MONTEUR',
      specialty: 'Montage & Motion Design',
      phone: '06 45 67 89 01',
      disponible: false,
    },
  })

  const photographe = await prisma.user.create({
    data: {
      name: 'Thomas Leroy',
      email: 'thomas@newvision.fr',
      password: hashedPassword,
      role: 'PHOTOGRAPHE',
      specialty: 'Photographie & Retouche',
      phone: '06 56 78 90 12',
      disponible: true,
    },
  })

  const commercial = await prisma.user.create({
    data: {
      name: 'Julie Moreau',
      email: 'julie@newvision.fr',
      password: hashedPassword,
      role: 'COMMERCIAL',
      specialty: 'Commercial & Relations clients',
      phone: '06 67 89 01 23',
      disponible: true,
    },
  })

  console.log('👥 Utilisateurs créés')

  // ─── CLIENTS ──────────────────────────────────────────────────────────────
  const client1 = await prisma.client.create({
    data: {
      name: 'Alexandre Fontaine',
      company: 'TechCorp Solutions',
      email: 'alex.fontaine@techcorp.fr',
      phone: '01 23 45 67 89',
      address: '45 avenue des Champs-Élysées, 75008 Paris',
      siret: '987 654 321 00011',
      type: 'ENTREPRISE',
      status: 'ACTIF',
      source: 'LINKEDIN',
      notes: 'Client VIP. Projets récurrents trimestriels. Budget annuel ~50k€.',
    },
  })

  const client2 = await prisma.client.create({
    data: {
      name: 'Marie Dupont',
      company: 'Studio Créatif',
      email: 'marie@studiocreativ.fr',
      phone: '06 78 90 12 34',
      address: '8 rue des Artistes, 69001 Lyon',
      type: 'AGENCE',
      status: 'ACTIF',
      source: 'RECOMMANDATION',
      notes: 'Agence créative partenaire. Travaux en sous-traitance réguliers.',
    },
  })

  const client3 = await prisma.client.create({
    data: {
      name: 'Pierre Laurent',
      company: 'Laurent & Associés',
      email: 'pierre.laurent@avocat.fr',
      phone: '01 34 56 78 90',
      address: '15 rue du Palais, 75004 Paris',
      type: 'ENTREPRISE',
      status: 'ACTIF',
      source: 'BOUCHE_A_OREILLE',
    },
  })

  const client4 = await prisma.client.create({
    data: {
      name: 'Sophie Chen',
      email: 'sophie.chen@gmail.com',
      phone: '06 89 01 23 45',
      type: 'PARTICULIER',
      status: 'PROSPECT',
      source: 'INSTAGRAM',
      notes: 'Mariage prévu en juin. Contactée via Instagram.',
    },
  })

  const client5 = await prisma.client.create({
    data: {
      name: 'Romain Petit',
      company: 'Startup Connect',
      email: 'romain@startupconnect.io',
      phone: '07 12 34 56 78',
      address: '3 rue de l\'Innovation, 33000 Bordeaux',
      type: 'ENTREPRISE',
      status: 'PROSPECT',
      source: 'GOOGLE',
    },
  })

  const client6 = await prisma.client.create({
    data: {
      name: 'Isabelle Renard',
      company: 'Renard Events',
      email: 'isa@renard-events.fr',
      phone: '06 90 12 34 56',
      address: '22 boulevard des Festivals, 06000 Nice',
      type: 'AGENCE',
      status: 'EN_PAUSE',
      source: 'RECOMMANDATION',
      notes: 'En pause depuis janvier. Reprendre contact en Q2.',
    },
  })

  console.log('🤝 Clients créés')

  // ─── INTERACTIONS ─────────────────────────────────────────────────────────
  await prisma.clientInteraction.createMany({
    data: [
      { clientId: client1.id, type: 'réunion', content: 'Réunion de cadrage pour le clip corporate Q2. Budget validé à 12 000€ HT.' },
      { clientId: client1.id, type: 'email', content: 'Envoi du brief créatif et validation de la direction artistique.' },
      { clientId: client1.id, type: 'appel', content: 'Point avancement post-tournage. Client satisfait des rushes.' },
      { clientId: client2.id, type: 'réunion', content: 'Présentation du portfolio et discussion partenariat long terme.' },
      { clientId: client2.id, type: 'email', content: 'Envoi du contrat cadre de sous-traitance.' },
      { clientId: client3.id, type: 'appel', content: 'Premier contact. Besoin d\'une vidéo de présentation cabinet.' },
      { clientId: client4.id, type: 'email', content: 'Premier échange. Demande de devis pour mariage en juin.' },
    ],
  })

  console.log('💬 Interactions créées')

  // ─── CATÉGORIES PROJETS ───────────────────────────────────────────────────
  const catCorporate = await prisma.projectCategory.create({ data: { name: 'Vidéo Corporate', color: '#2563eb', order: 0 } })
  const catClip = await prisma.projectCategory.create({ data: { name: 'Clip Musical', color: '#7c3aed', order: 1 } })
  const catPhoto = await prisma.projectCategory.create({ data: { name: 'Shooting Photo', color: '#db2777', order: 2 } })
  const catReportage = await prisma.projectCategory.create({ data: { name: 'Reportage', color: '#059669', order: 3 } })
  const catMariage = await prisma.projectCategory.create({ data: { name: 'Mariage', color: '#e8b84b', order: 4 } })
  const catEvent = await prisma.projectCategory.create({ data: { name: 'Événement', color: '#f97316', order: 5 } })

  console.log('🏷️  Catégories créées')

  // ─── PROJETS ──────────────────────────────────────────────────────────────
  const today = new Date()
  const addDays = (d: Date, days: number) => new Date(d.getTime() + days * 86400000)

  const project1 = await prisma.project.create({
    data: {
      clientId: client1.id,
      categoryId: catCorporate.id,
      title: 'Clip Corporate TechCorp Q2',
      type: 'VIDEO_CORPORATE',
      status: 'EN_POST_PRODUCTION',
      description: 'Vidéo institutionnelle 3 minutes présentant les nouvelles solutions SaaS de TechCorp. Ton moderne et dynamique, motion design intégré.',
      startDate: addDays(today, -30),
      deadline: addDays(today, 15),
      budget: 12000,
      revisionsMax: 3,
      revisionsUsed: 1,
    },
  })

  const project2 = await prisma.project.create({
    data: {
      clientId: client2.id,
      categoryId: catPhoto.id,
      title: 'Shooting Photo Studio Créatif',
      type: 'SHOOTING_PHOTO',
      status: 'BRIEF_REÇU',
      description: 'Shooting photo pour nouvelle collection automne-hiver. 2 jours de tournage, 50 photos finales retouchées.',
      startDate: addDays(today, 5),
      deadline: addDays(today, 25),
      budget: 3500,
      revisionsMax: 2,
      revisionsUsed: 0,
    },
  })

  const project3 = await prisma.project.create({
    data: {
      clientId: client3.id,
      categoryId: catCorporate.id,
      title: 'Vidéo Présentation Cabinet Laurent',
      type: 'VIDEO_CORPORATE',
      status: 'EN_VALIDATION',
      description: 'Vidéo de présentation du cabinet d\'avocats. Interviews des associés, visite des locaux.',
      startDate: addDays(today, -45),
      deadline: addDays(today, -5),
      budget: 5500,
      revisionsMax: 2,
      revisionsUsed: 2,
      deliveryLink: 'https://drive.google.com/example/validation',
    },
  })

  const project4 = await prisma.project.create({
    data: {
      clientId: client1.id,
      categoryId: catReportage.id,
      title: 'Reportage Salon Tech Paris',
      type: 'REPORTAGE',
      status: 'LIVRÉ',
      description: 'Couverture complète du salon TechParis 2024. Vidéo événementielle + photos.',
      startDate: addDays(today, -90),
      deadline: addDays(today, -60),
      budget: 8000,
      revisionsMax: 1,
      revisionsUsed: 0,
      deliveryLink: 'https://wetransfer.com/delivered/techparis2024',
    },
  })

  console.log('📂 Projets créés')

  // ─── MEMBRES PROJETS ──────────────────────────────────────────────────────
  await prisma.projectMember.createMany({
    data: [
      { projectId: project1.id, userId: admin.id, role: 'Réalisateur' },
      { projectId: project1.id, userId: videoaste.id, role: 'Vidéaste' },
      { projectId: project1.id, userId: monteur.id, role: 'Monteur' },
      { projectId: project2.id, userId: photographe.id, role: 'Photographe principal' },
      { projectId: project2.id, userId: manager.id, role: 'Chef de projet' },
      { projectId: project3.id, userId: videoaste.id, role: 'Vidéaste' },
      { projectId: project3.id, userId: monteur.id, role: 'Monteur' },
      { projectId: project4.id, userId: admin.id, role: 'Réalisateur' },
      { projectId: project4.id, userId: videoaste.id, role: 'Vidéaste' },
      { projectId: project4.id, userId: photographe.id, role: 'Photographe' },
    ],
  })

  // ─── ONBOARDING STEPS ─────────────────────────────────────────────────────
  await prisma.onboardingStep.createMany({
    data: [
      { projectId: project1.id, label: 'Brief créatif signé', completed: true, completedAt: addDays(today, -28), order: 1 },
      { projectId: project1.id, label: 'Acompte 50% reçu', completed: true, completedAt: addDays(today, -25), order: 2 },
      { projectId: project1.id, label: 'Tournage J1 effectué', completed: true, completedAt: addDays(today, -20), order: 3 },
      { projectId: project1.id, label: 'Tournage J2 effectué', completed: true, completedAt: addDays(today, -19), order: 4 },
      { projectId: project1.id, label: 'V1 montage envoyé', completed: true, completedAt: addDays(today, -10), order: 5 },
      { projectId: project1.id, label: 'Corrections V2 intégrées', completed: false, order: 6 },
      { projectId: project1.id, label: 'Validation finale client', completed: false, order: 7 },
      { projectId: project1.id, label: 'Livraison & facture solde', completed: false, order: 8 },

      { projectId: project2.id, label: 'Brief shooting reçu', completed: true, completedAt: addDays(today, -2), order: 1 },
      { projectId: project2.id, label: 'Moodboard validé', completed: false, order: 2 },
      { projectId: project2.id, label: 'Localisation repérée', completed: false, order: 3 },
      { projectId: project2.id, label: 'Tournage J1', completed: false, order: 4 },
      { projectId: project2.id, label: 'Tournage J2', completed: false, order: 5 },
      { projectId: project2.id, label: 'Retouches livrées', completed: false, order: 6 },
    ],
  })

  // ─── COMMENTAIRES PROJETS ─────────────────────────────────────────────────
  await prisma.projectComment.createMany({
    data: [
      { projectId: project1.id, content: 'Le client souhaite ajouter une scène en extérieur avec drone. À budgéter.', authorName: 'Sarah Martin' },
      { projectId: project1.id, content: 'V1 envoyée. Corrections : raccourcir intro de 10s, changer musique partie 2.', authorName: 'Emma Blanc' },
      { projectId: project3.id, content: 'Validation en attente. Rappel envoyé par email le ' + new Date().toLocaleDateString('fr-FR'), authorName: 'Julie Moreau' },
    ],
  })

  console.log('📋 Steps onboarding & commentaires créés')

  // ─── TÂCHES ───────────────────────────────────────────────────────────────
  await prisma.task.createMany({
    data: [
      {
        projectId: project1.id,
        assignedToId: monteur.id,
        createdById: admin.id,
        title: 'Intégrer les corrections V2 du clip TechCorp',
        description: 'Raccourcir l\'intro de 10s, remplacer la musique de la partie 2 par la piste fournie.',
        priority: 'URGENTE',
        status: 'EN_COURS',
        dueDate: addDays(today, 3),
      },
      {
        projectId: project1.id,
        assignedToId: admin.id,
        createdById: manager.id,
        title: 'Exporter masters + livrables TechCorp',
        description: 'Export H264 web + ProRes master + sous-titres. Vérifier le color grading final.',
        priority: 'HAUTE',
        status: 'A_FAIRE',
        dueDate: addDays(today, 8),
      },
      {
        projectId: project2.id,
        assignedToId: photographe.id,
        createdById: manager.id,
        title: 'Préparer le matériel pour le shooting',
        description: 'Vérifier batteries, objectifs, flashs. Charger tout le matériel la veille.',
        priority: 'HAUTE',
        status: 'A_FAIRE',
        dueDate: addDays(today, 4),
      },
      {
        projectId: project3.id,
        assignedToId: manager.id,
        createdById: admin.id,
        title: 'Relancer client cabinet Laurent pour validation',
        description: 'La V1 est en attente de validation depuis 5 jours. Appeler + email.',
        priority: 'URGENTE',
        status: 'EN_COURS',
        dueDate: addDays(today, 1),
      },
      {
        assignedToId: commercial.id,
        createdById: admin.id,
        title: 'Envoyer proposition à Sophie Chen (mariage)',
        description: 'Préparer devis détaillé pour couverture mariage : vidéo + photo, 2 jours.',
        priority: 'NORMALE',
        status: 'A_FAIRE',
        dueDate: addDays(today, 5),
      },
      {
        assignedToId: commercial.id,
        createdById: manager.id,
        title: 'Qualifier le prospect Startup Connect',
        description: 'Prendre RDV visio avec Romain Petit. Comprendre besoins, timeline, budget.',
        priority: 'NORMALE',
        status: 'A_FAIRE',
        dueDate: addDays(today, 7),
      },
      {
        assignedToId: admin.id,
        createdById: admin.id,
        title: 'Mettre à jour la page Instagram',
        description: 'Publier les extraits du reportage Salon Tech. Prévoir 3 posts + 1 reel.',
        priority: 'BASSE',
        status: 'A_FAIRE',
        dueDate: addDays(today, 14),
      },
      {
        projectId: project1.id,
        assignedToId: videoaste.id,
        createdById: admin.id,
        title: 'Organiser les rushes et les sous-dossiers',
        description: 'Classer tous les rushes dans la structure de dossiers projet. Sauvegarde sur NAS.',
        priority: 'NORMALE',
        status: 'TERMINÉE',
        dueDate: addDays(today, -15),
      },
    ],
  })

  console.log('✅ Tâches créées')

  // ─── OBJECTIFS ────────────────────────────────────────────────────────────
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  const startOfYear = new Date(today.getFullYear(), 0, 1)
  const endOfYear = new Date(today.getFullYear(), 11, 31)
  const startOfQ2 = new Date(today.getFullYear(), 3, 1)
  const endOfQ2 = new Date(today.getFullYear(), 5, 30)

  await prisma.objective.createMany({
    data: [
      {
        userId: admin.id,
        title: 'CA mensuel avril',
        category: 'CA',
        period: 'MENSUEL',
        targetValue: 20000,
        currentValue: 0,
        unit: '€',
        startDate: startOfMonth,
        endDate: endOfMonth,
        status: 'EN_COURS',
      },
      {
        userId: admin.id,
        title: 'CA annuel 2024',
        category: 'CA',
        period: 'ANNUEL',
        targetValue: 180000,
        currentValue: 0,
        unit: '€',
        startDate: startOfYear,
        endDate: endOfYear,
        status: 'EN_COURS',
      },
      {
        userId: commercial.id,
        title: 'Nouveaux clients Q2',
        category: 'NOUVEAUX_CLIENTS',
        period: 'TRIMESTRIEL',
        targetValue: 5,
        currentValue: 0,
        unit: 'clients',
        startDate: startOfQ2,
        endDate: endOfQ2,
        status: 'EN_COURS',
      },
      {
        userId: admin.id,
        title: 'Projets livrés ce mois',
        category: 'PROJETS_LIVRÉS',
        period: 'MENSUEL',
        targetValue: 4,
        currentValue: 0,
        unit: 'projets',
        startDate: startOfMonth,
        endDate: endOfMonth,
        status: 'EN_COURS',
      },
    ],
  })

  console.log('🎯 Objectifs créés')

  // ─── DEVIS ────────────────────────────────────────────────────────────────
  const quote1 = await prisma.quote.create({
    data: {
      clientId: client1.id,
      projectId: project1.id,
      number: 'DEV-2024-001',
      status: 'ACCEPTÉ',
      issueDate: addDays(today, -35),
      expiryDate: addDays(today, -5),
      totalHT: 10000,
      totalTVA: 2000,
      totalTTC: 12000,
      notes: 'Devis accepté par email le ' + addDays(today, -30).toLocaleDateString('fr-FR'),
      cgv: 'Acompte de 50% à la commande. Solde à la livraison.',
      lines: {
        createMany: {
          data: [
            { description: 'Réalisation clip corporate 3 min (2 jours tournage)', quantity: 1, unitPrice: 5000, vatRate: 20, total: 5000, order: 1 },
            { description: 'Post-production : montage, colorimétrie, étalonnage', quantity: 1, unitPrice: 3000, vatRate: 20, total: 3000, order: 2 },
            { description: 'Motion design & habillage graphique', quantity: 1, unitPrice: 1500, vatRate: 20, total: 1500, order: 3 },
            { description: 'Mixage audio & musicale', quantity: 1, unitPrice: 500, vatRate: 20, total: 500, order: 4 },
          ],
        },
      },
    },
  })

  const quote2 = await prisma.quote.create({
    data: {
      clientId: client2.id,
      projectId: project2.id,
      number: 'DEV-2024-002',
      status: 'ENVOYÉ',
      issueDate: addDays(today, -3),
      expiryDate: addDays(today, 27),
      totalHT: 2917,
      totalTVA: 583,
      totalTTC: 3500,
      notes: 'Devis envoyé par email. En attente de réponse.',
      lines: {
        createMany: {
          data: [
            { description: 'Shooting photo 2 jours (50 photos finales)', quantity: 2, unitPrice: 1200, vatRate: 20, total: 2400, order: 1 },
            { description: 'Retouche et post-traitement photos', quantity: 50, unitPrice: 10, vatRate: 20, total: 500, order: 2 },
            { description: 'Livraison galerie en ligne haute résolution', quantity: 1, unitPrice: 17, vatRate: 20, total: 17, order: 3 },
          ],
        },
      },
    },
  })

  const quote3 = await prisma.quote.create({
    data: {
      clientId: client4.id,
      number: 'DEV-2024-003',
      status: 'BROUILLON',
      issueDate: today,
      expiryDate: addDays(today, 30),
      totalHT: 4167,
      totalTVA: 833,
      totalTTC: 5000,
      notes: 'Brouillon en cours de préparation pour mariage juin 2024.',
      lines: {
        createMany: {
          data: [
            { description: 'Couverture vidéo mariage (ceremony + soirée)', quantity: 1, unitPrice: 2500, vatRate: 20, total: 2500, order: 1 },
            { description: 'Film souvenir 5-7 min monté', quantity: 1, unitPrice: 1000, vatRate: 20, total: 1000, order: 2 },
            { description: 'Shooting photo mariage (journée complète)', quantity: 1, unitPrice: 667, vatRate: 20, total: 667, order: 3 },
          ],
        },
      },
    },
  })

  console.log('📋 Devis créés')

  // ─── FACTURES ─────────────────────────────────────────────────────────────
  // Facture acompte projet TechCorp (50% de 12 000€)
  const invoice1 = await prisma.invoice.create({
    data: {
      clientId: client1.id,
      projectId: project1.id,
      quoteId: quote1.id,
      number: 'FAC-2024-001',
      type: 'ACOMPTE',
      status: 'PAYÉE',
      issueDate: addDays(today, -30),
      dueDate: addDays(today, -15),
      totalHT: 5000,
      totalTVA: 1000,
      totalTTC: 6000,
      amountPaid: 6000,
      notes: 'Acompte 50% - Clip corporate TechCorp Q2',
      cgv: 'Acompte de 50% à la commande.',
      lines: {
        createMany: {
          data: [
            { description: 'Acompte 50% - Clip corporate TechCorp Q2 (DEV-2024-001)', quantity: 1, unitPrice: 5000, vatRate: 20, total: 5000, order: 1 },
          ],
        },
      },
      payments: {
        create: {
          amount: 6000,
          date: addDays(today, -28),
          method: 'VIREMENT',
          reference: 'VIR-20240315-001',
          confirmed: true,
          notes: 'Virement reçu sous 48h',
        },
      },
    },
  })

  // Facture pour le cabinet Laurent (projet livré)
  const invoice2 = await prisma.invoice.create({
    data: {
      clientId: client3.id,
      projectId: project3.id,
      number: 'FAC-2024-002',
      type: 'TOTALE',
      status: 'EN_RETARD',
      issueDate: addDays(today, -20),
      dueDate: addDays(today, -5),
      totalHT: 4583,
      totalTVA: 917,
      totalTTC: 5500,
      amountPaid: 0,
      notes: 'Facture solde - Vidéo présentation cabinet. RELANCE EFFECTUÉE.',
      lines: {
        createMany: {
          data: [
            { description: 'Réalisation vidéo présentation cabinet (2j tournage)', quantity: 1, unitPrice: 2500, vatRate: 20, total: 2500, order: 1 },
            { description: 'Post-production & montage (3 min)', quantity: 1, unitPrice: 1500, vatRate: 20, total: 1500, order: 2 },
            { description: 'Sous-titrage & habillage', quantity: 1, unitPrice: 583, vatRate: 20, total: 583, order: 3 },
          ],
        },
      },
    },
  })

  // Facture projet Salon Tech (payée)
  const invoice3 = await prisma.invoice.create({
    data: {
      clientId: client1.id,
      projectId: project4.id,
      number: 'FAC-2024-003',
      type: 'TOTALE',
      status: 'PAYÉE',
      issueDate: addDays(today, -55),
      dueDate: addDays(today, -40),
      totalHT: 6667,
      totalTVA: 1333,
      totalTTC: 8000,
      amountPaid: 8000,
      notes: 'Reportage Salon Tech Paris 2024 - Livrée et payée.',
      lines: {
        createMany: {
          data: [
            { description: 'Couverture vidéo événement 2 jours (1 vidéaste + 1 photographe)', quantity: 2, unitPrice: 2000, vatRate: 20, total: 4000, order: 1 },
            { description: 'Montage vidéo événementielle 5 min', quantity: 1, unitPrice: 1500, vatRate: 20, total: 1500, order: 2 },
            { description: 'Sélection et retouche 80 photos', quantity: 80, unitPrice: 14.6, vatRate: 20, total: 1167, order: 3 },
          ],
        },
      },
      payments: {
        create: {
          amount: 8000,
          date: addDays(today, -38),
          method: 'VIREMENT',
          reference: 'VIR-20240201-002',
          confirmed: true,
        },
      },
    },
  })

  // Facture partiellement payée
  const invoice4 = await prisma.invoice.create({
    data: {
      clientId: client2.id,
      number: 'FAC-2024-004',
      type: 'TOTALE',
      status: 'PARTIELLEMENT_PAYÉE',
      issueDate: addDays(today, -10),
      dueDate: addDays(today, 20),
      totalHT: 2500,
      totalTVA: 500,
      totalTTC: 3000,
      amountPaid: 1000,
      notes: 'Acompte partiel reçu. Solde attendu à la livraison.',
      lines: {
        createMany: {
          data: [
            { description: 'Création motion design intro/outro (15s chacun)', quantity: 2, unitPrice: 800, vatRate: 20, total: 1600, order: 1 },
            { description: 'Pack de transitions personnalisées', quantity: 1, unitPrice: 900, vatRate: 20, total: 900, order: 2 },
          ],
        },
      },
      payments: {
        create: {
          amount: 1000,
          date: addDays(today, -8),
          method: 'VIREMENT',
          reference: 'VIR-20240405-001',
          confirmed: true,
          notes: 'Acompte 1/3',
        },
      },
    },
  })

  console.log('💶 Factures créées')

  // ─── DÉPENSES ─────────────────────────────────────────────────────────────
  const months = [0, 1, 2, 3]
  const expenseData = []
  for (const m of months) {
    const d = new Date(today.getFullYear(), today.getMonth() - m, 1)
    expenseData.push(
      { category: 'LOGICIELS' as const, amount: 299, date: new Date(d.getFullYear(), d.getMonth(), 3), description: 'Adobe Creative Cloud (mensuel)' },
      { category: 'LOGICIELS' as const, amount: 29, date: new Date(d.getFullYear(), d.getMonth(), 3), description: 'Frame.io abonnement équipe' },
      { category: 'LOYER' as const, amount: 1200, date: new Date(d.getFullYear(), d.getMonth(), 1), description: 'Loyer studio mensuel' },
      { category: 'ASSURANCE' as const, amount: 180, date: new Date(d.getFullYear(), d.getMonth(), 5), description: 'Assurance matériel & RC pro' },
    )
  }
  expenseData.push(
    { category: 'MATÉRIEL' as const, amount: 3499, date: addDays(today, -25), description: 'Achat Sony FX3 objectif 24-70mm' },
    { category: 'MATÉRIEL' as const, amount: 890, date: addDays(today, -45), description: 'DJI Mini 4 Pro - drone compact' },
    { category: 'FREELANCES' as const, amount: 800, date: addDays(today, -12), description: 'Prestation coloriste freelance (projet TechCorp)' },
    { category: 'DÉPLACEMENTS' as const, amount: 145, date: addDays(today, -8), description: 'Frais déplacement Bordeaux (repérage)' },
    { category: 'MARKETING' as const, amount: 350, date: addDays(today, -20), description: 'Campagne Google Ads avril' },
    { category: 'FORMATION' as const, amount: 490, date: addDays(today, -60), description: 'Formation DaVinci Resolve avancé' },
  )
  await prisma.expense.createMany({ data: expenseData })

  console.log('💸 Dépenses créées')

  // ─── DOCUMENTS ────────────────────────────────────────────────────────────
  await prisma.document.createMany({
    data: [
      { clientId: client1.id, projectId: project1.id, uploadedById: manager.id, name: 'Brief créatif TechCorp Q2.pdf', type: 'BRIEF', url: '/uploads/brief-techcorp-q2.pdf', size: 245000, mimeType: 'application/pdf' },
      { clientId: client1.id, projectId: project1.id, uploadedById: admin.id, name: 'Contrat prestation TechCorp.pdf', type: 'CONTRAT', url: '/uploads/contrat-techcorp.pdf', size: 128000, mimeType: 'application/pdf' },
      { clientId: client1.id, projectId: project4.id, uploadedById: admin.id, name: 'Livrable - Salon Tech Paris 2024.mp4', type: 'LIVRABLE', url: 'https://wetransfer.com/delivered/techparis2024', size: 0, mimeType: 'video/mp4' },
      { clientId: client2.id, projectId: project2.id, uploadedById: manager.id, name: 'Moodboard shooting automne.pdf', type: 'CHARTE_GRAPHIQUE', url: '/uploads/moodboard-shooting.pdf', size: 3200000, mimeType: 'application/pdf' },
      { clientId: client3.id, projectId: project3.id, uploadedById: commercial.id, name: 'Bon de commande Cabinet Laurent.pdf', type: 'BON_DE_COMMANDE', url: '/uploads/bc-cabinet-laurent.pdf', size: 98000, mimeType: 'application/pdf' },
    ],
  })

  console.log('📄 Documents créés')

  // ─── NOTIFICATIONS ────────────────────────────────────────────────────────
  await prisma.notification.createMany({
    data: [
      { userId: admin.id, type: 'FACTURE_EN_RETARD', title: 'Facture en retard', message: 'La facture FAC-2024-002 (Cabinet Laurent) est en retard de 5 jours. Montant : 5 500 €', link: '/invoices', read: false },
      { userId: admin.id, type: 'DEADLINE_APPROCHE', title: 'Deadline approche', message: 'Le projet "Clip Corporate TechCorp Q2" arrive à échéance dans 15 jours.', link: `/projects/${project1.id}`, read: false },
      { userId: admin.id, type: 'DEVIS_ACCEPTÉ', title: 'Devis accepté !', message: 'Le devis DEV-2024-001 a été accepté par TechCorp Solutions. Projet démarré.', link: '/quotes', read: true },
      { userId: admin.id, type: 'PAIEMENT_REÇU', title: 'Paiement reçu', message: 'Paiement de 6 000 € reçu pour la facture FAC-2024-001 (TechCorp - Acompte).', link: '/invoices', read: true },
      { userId: monteur.id, type: 'TÂCHE_ASSIGNÉE', title: 'Nouvelle tâche assignée', message: 'Vous avez une nouvelle tâche urgente : "Intégrer les corrections V2 du clip TechCorp". Deadline dans 3 jours.', link: '/tasks', read: false },
      { userId: commercial.id, type: 'TÂCHE_ASSIGNÉE', title: 'Nouvelle tâche assignée', message: 'Tâche : "Envoyer proposition à Sophie Chen (mariage)". À faire avant le ' + addDays(today, 5).toLocaleDateString('fr-FR'), link: '/tasks', read: false },
      { userId: manager.id, type: 'ONBOARDING_INCOMPLET', title: 'Onboarding incomplet', message: 'Le projet "Shooting Photo Studio Créatif" a des étapes d\'onboarding non complétées.', link: `/projects/${project2.id}`, read: false },
    ],
  })

  console.log('🔔 Notifications créées')

  // ─── RÉSUMÉ ───────────────────────────────────────────────────────────────
  console.log('\n✨ Seed terminé avec succès !\n')
  console.log('═══════════════════════════════════════')
  console.log('  COMPTES DE CONNEXION')
  console.log('═══════════════════════════════════════')
  console.log('  Admin     : admin@newvision.fr')
  console.log('  Manager   : sarah@newvision.fr')
  console.log('  Vidéaste  : lucas@newvision.fr')
  console.log('  Monteur   : emma@newvision.fr')
  console.log('  Photo     : thomas@newvision.fr')
  console.log('  Commercial: julie@newvision.fr')
  console.log('  Mot de passe : newvision2024')
  console.log('═══════════════════════════════════════\n')
}

main()
  .catch((e) => {
    console.error('❌ Erreur seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
