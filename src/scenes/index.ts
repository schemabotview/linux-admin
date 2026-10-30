import type { SceneModel } from '@graphlearning/graphl-flow'
import { introScenes } from './intro'
import { shellScenes } from './shell'

// Scene registry, grouped by course (one folder each, mirroring src/content). Ids are globally
// unique: a duplicate THROWS rather than letting one course's scene shadow another's.
const GROUPS: Record<string, SceneModel>[] = [introScenes, shellScenes]

export const SCENES: Record<string, SceneModel> = {}
for (const group of GROUPS)
  for (const [id, scene] of Object.entries(group)) {
    if (id in SCENES) throw new Error(`scene id "${id}" is registered twice`)
    SCENES[id] = scene
  }

export function getScene(id: string): SceneModel | undefined {
  return SCENES[id]
}
