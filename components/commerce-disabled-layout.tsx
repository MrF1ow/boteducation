import { redirect } from 'next/navigation'

/** Commerce routes stay in the tree for this PR but never render. */
export default function CommerceDisabledLayout() {
  redirect('/dashboard')
}
