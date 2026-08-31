// Gestion des rôles multiples. `role` = rôle principal (privilège le plus haut) ;
// `roles` = rôles additionnels (ex : un ADMIN aussi COMMERCIAL). Les rôles effectifs
// sont l'union des deux.
export function effectiveRoles(u: { role?: string | null; roles?: string[] | null }): string[] {
  return [u.role, ...(u.roles ?? [])].filter(Boolean) as string[]
}

export function hasRole(u: { role?: string | null; roles?: string[] | null }, r: string): boolean {
  return effectiveRoles(u).includes(r)
}

// Filtre Prisma pour retrouver les utilisateurs ayant un rôle donné (principal OU additionnel)
export function userHasRoleWhere(role: string) {
  return { OR: [{ role: role as any }, { roles: { has: role } }] }
}
