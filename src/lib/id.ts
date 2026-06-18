/** Generate a stable, collision-resistant id for a new day or exercise. */
export function makeId(prefix = 'ex'): string {
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.abs(hashString(String(performance.now()))).toString(36)
  return `${prefix}_${uuid}`
}

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return h
}
