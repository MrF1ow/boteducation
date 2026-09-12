import { redirect } from 'next/navigation'

/**
 * Former school-wide cutoff lock page (#494). Cutoff timestamps are cleared
 * in the PR-01 migration. Anyone who still hits this URL goes home.
 */
export default async function AccessSuspendedPage() {
  redirect('/dashboard/student')
}
