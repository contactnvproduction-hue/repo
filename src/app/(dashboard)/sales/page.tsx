import { redirect } from 'next/navigation'

// La page Sales a été dissociée en vraies pages : le pipeline closing, la compta,
// les contrats, la répartition CA et le contenu ont chacun leur route (menu latéral).
export default function SalesPage() {
  redirect('/sales/closing')
}
