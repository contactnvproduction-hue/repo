import { redirect } from 'next/navigation'

// L'espace Acquisition a été regroupé dans le menu Sales
export default function AcquisitionRedirect() {
  redirect('/sales')
}
