import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

/** Commerce URLs redirect to /dashboard. Catch-all pages never render. */
export default function CommerceDisabledLayout({
  children: _children,
}: {
  children: ReactNode
}) {
  redirect('/dashboard')
}
