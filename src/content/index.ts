import { intro } from './intro'
import { shell } from './shell'
import { packages } from './packages'
import { text } from './text'
import { users } from './users'
import { processes } from './processes'
import { services } from './services'
import { network } from './network'
import type { Course, Section } from './types'

// Course registry, in syllabus order (LINUX-COURSE-PLAN.md). A course is registered only once it is authored.
export const COURSES: Record<string, Course> = {
  [intro.id]: intro,
  [shell.id]: shell,
  [packages.id]: packages,
  [text.id]: text,
  [users.id]: users,
  [processes.id]: processes,
  [services.id]: services,
  [network.id]: network,
}

export type { Course, Section }
export { slugOf, allSections } from '@graphlearning/shell'

export function getCourse(id: string): Course | undefined {
  return COURSES[id]
}
