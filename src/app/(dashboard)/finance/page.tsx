import { redirect } from 'next/navigation'

// La vue Finance est regroupée dans Sales → onglet Finance
export default function FinanceRedirect() {
  redirect('/sales')
}
