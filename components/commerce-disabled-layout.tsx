import { redirect } from 'next/navigation'

/** Commerce URLs redirect to /dashboard. Catch-all pages never render. */
export default function CommerceDisabledLayout() {
  redirect('/dashboard')
}
