import { intro } from './intro'
import { shell } from './shell'
import type { Course, Section } from './types'

// Course registry, in syllabus order (LINUX-COURSE-PLAN.md). A course is registered only once it is authored.
export const COURSES: Record<string, Course> = {
  [intro.id]: intro,
  [shell.id]: shell,
}

export type { Course, Section }
export { slugOf, allSections } from '@graphlearning/shell'

export function getCourse(id: string): Course | undefined {
  return COURSES[id]
}
