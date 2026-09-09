import { redirect } from 'next/navigation'

/** Catch-all commerce pages redirect. Layouts call the same destination. */
export default function CommerceGonePage() {
  redirect('/dashboard')
}
