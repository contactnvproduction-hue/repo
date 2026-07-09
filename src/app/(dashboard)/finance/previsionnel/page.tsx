import { redirect } from 'next/navigation'

// Le prévisionnel (CA contracté + trésorerie) est regroupé dans Sales
export default function PrevisionnelRedirect() {
  redirect('/sales')
}
