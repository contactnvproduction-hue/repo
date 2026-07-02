// Spots de tournage NVP — seed initial (brief onboarding Noah).
// Créés automatiquement si la table est vide ; modifiables ensuite depuis Paramètres.

export const DEFAULT_SPOTS = [
  {
    name: 'Maria',
    city: 'Nantes',
    category: 'Café / Terrasse',
    description: 'Terrasse style café parisien — extérieur + intérieur.',
    tags: ['terrasse', 'café', 'extérieur', 'intérieur'],
    photos: [] as string[],
    supplement: null as string | null,
    address: null as string | null,
    active: true,
    order: 0,
  },
  {
    name: 'Abbaye de Villeneuve',
    city: 'Nantes',
    category: 'Hôtel / Luxe',
    description: 'Cadre haussmannien, luxe — extérieur + intérieur.',
    tags: ['haussmannien', 'luxe', 'extérieur', 'intérieur'],
    photos: [] as string[],
    supplement: null,
    address: null,
    active: true,
    order: 1,
  },
  {
    name: 'Le Gaulois',
    city: 'Reims',
    category: 'Café / Terrasse',
    description: 'Terrasse extérieure.',
    tags: ['terrasse', 'extérieur'],
    photos: [] as string[],
    supplement: null,
    address: null,
    active: true,
    order: 0,
  },
  {
    name: 'Auburn',
    city: 'Paris',
    category: 'Café / Hôtel',
    description: 'Café intérieur, terrasse extérieure + étage hôtel haut de gamme — mood luxueux, vers Opéra.',
    tags: ['café', 'hôtel', 'luxueux', 'Opéra'],
    photos: [] as string[],
    supplement: null,
    address: null,
    active: true,
    order: 0,
  },
  {
    name: 'Grand Café Capucines',
    city: 'Paris',
    category: 'Café / Terrasse',
    description: 'Café typique parisien, terrasse intérieure.',
    tags: ['café', 'parisien', 'terrasse intérieure'],
    photos: [] as string[],
    supplement: null,
    address: null,
    active: true,
    order: 1,
  },
  {
    name: 'Café Odilon',
    city: 'Paris',
    category: 'Café / Terrasse',
    description: 'Terrasse extérieure, niveau canal (19e).',
    tags: ['terrasse', 'extérieur', 'canal', '19e'],
    photos: [] as string[],
    supplement: null,
    address: null,
    active: true,
    order: 2,
  },
  {
    name: 'Cocoon Space',
    city: 'Paris',
    category: 'Studio',
    description: 'Studio intérieur.',
    tags: ['studio', 'intérieur'],
    photos: [] as string[],
    supplement: 'Supplément possible — à confirmer avec l’équipe NVP',
    address: null,
    active: true,
    order: 3,
  },
]

// Idempotent : ne crée les spots par défaut que si la table est vide
export async function ensureDefaultSpots(db: any): Promise<void> {
  try {
    const count = await db.shootingSpot.count()
    if (count > 0) return
    await db.shootingSpot.createMany({ data: DEFAULT_SPOTS })
  } catch {
    // table pas encore migrée — le build Render fera le db push
  }
}
