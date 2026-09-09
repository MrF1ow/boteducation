export function studentCanReadGrade(published: boolean): boolean {
  return published
}

export function publishedOnWrite(autoPublishEnabled: boolean): boolean {
  return autoPublishEnabled
}

export function parseAutoPublishSetting(raw: unknown): boolean {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return false
  }
  return 'enabled' in raw && raw.enabled === true
}
