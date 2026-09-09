import { createClient } from '@/lib/supabase/server'
import { getCurrentUserId } from '@/lib/supabase/tenant'
import { requireCourseAccess } from '@/lib/services/course-access-guard'
import { redirect, notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { CourseWorkNav } from '@/components/student/course-work-nav'
import BreadcrumbComponent from '@/components/exercises/breadcrumb-component'
import { studentCanReadGrade } from '@/lib/assignments/publish-gate'

interface PageProps {
  params: Promise<{ courseId: string }>
}

export default async function CourseGradesPage({ params }: PageProps) {
  const { courseId } = await params
  const numericCourseId = parseInt(courseId, 10)
  if (!Number.isInteger(numericCourseId)) notFound()

  const supabase = await createClient()
  const userId = await getCurrentUserId()
  if (!userId) redirect('/auth/login')
  await requireCourseAccess(supabase, userId, numericCourseId)

  const t = await getTranslations('studentCourseWork')

  const [
    { data: course },
    { data: assignments },
    { data: submissions },
    { data: grades },
    { data: examRows },
  ] = await Promise.all([
    supabase.from('courses').select('title').eq('course_id', numericCourseId).maybeSingle(),
    supabase
      .from('assignments')
      .select('assignment_id, title, max_score')
      .eq('course_id', numericCourseId)
      .eq('published', true),
    supabase
      .from('submissions')
      .select('submission_id, assignment_id, status')
      .eq('student_id', userId),
    supabase
      .from('grades')
      .select('score, published, submission_id')
      .eq('course_id', numericCourseId)
      .eq('student_id', userId),
    supabase
      .from('exams')
      .select('exam_id, title, exam_scores(score, student_id)')
      .eq('course_id', numericCourseId)
      .eq('status', 'published')
      .eq('exam_scores.student_id', userId),
  ])

  if (!course) notFound()

  const assignmentIds = new Set((assignments ?? []).map((a) => a.assignment_id))
  const submissionByAssignment = new Map(
    (submissions ?? [])
      .filter((s) => assignmentIds.has(s.assignment_id))
      .map((s) => [s.assignment_id, s]),
  )
  const gradeBySubmission = new Map(
    (grades ?? []).map((g) => [g.submission_id, g]),
  )

  const homework = (assignments ?? []).flatMap((assignment) => {
    const submission = submissionByAssignment.get(assignment.assignment_id)
    const grade = submission ? gradeBySubmission.get(submission.submission_id) : undefined
    const visible = grade ? studentCanReadGrade(grade.published) : false
    if (!submission && !visible) return []
    return [
      {
        id: assignment.assignment_id,
        title: assignment.title,
        kind: 'assignment' as const,
        display: visible
          ? t('score', { score: grade?.score ?? 0, max: assignment.max_score })
          : t('pending'),
        published: visible,
      },
    ]
  })

  const exams = (examRows ?? []).flatMap((exam) => {
    const scores = Array.isArray(exam.exam_scores)
      ? exam.exam_scores
      : exam.exam_scores
        ? [exam.exam_scores]
        : []
    const mine = scores[0]
    if (!mine) return []
    return [
      {
        id: exam.exam_id,
        title: exam.title,
        kind: 'exam' as const,
        display: String(mine.score),
        published: true,
      },
    ]
  })

  const rows = [...homework, ...exams]

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <BreadcrumbComponent
        links={[
          { href: '/dashboard/student', label: t('nav.course') },
          { href: `/dashboard/student/courses/${courseId}`, label: course.title },
          { href: '#', label: t('nav.grades') },
        ]}
      />
      <CourseWorkNav courseId={courseId} current="grades" />
      <h1 className="text-2xl font-bold tracking-tight">{t('nav.grades')}</h1>
      {rows.length === 0 ? (
        <p className="text-muted-foreground">{t('emptyGrades')}</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {rows.map((row) => (
            <li key={`${row.kind}-${row.id}`} className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="font-medium">{row.title}</p>
                <p className="text-xs text-muted-foreground">
                  {row.kind === 'exam' ? t('exam') : t('assignment')}
                </p>
              </div>
              <p className={row.published ? 'font-semibold' : 'text-muted-foreground'}>
                {row.display}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
