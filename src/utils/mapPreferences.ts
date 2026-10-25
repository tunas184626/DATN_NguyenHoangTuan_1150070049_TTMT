export type MapExperience = 'normal' | 'focus'
export const MAP_EXPERIENCE_KEY = 'webgis-map-experience-v1'

export function readMapExperience(): MapExperience {
  try { return localStorage.getItem(MAP_EXPERIENCE_KEY) === 'focus' ? 'focus' : 'normal' }
  catch { return 'normal' }
}

