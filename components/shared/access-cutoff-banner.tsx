/**
 * Former access-cutoff countdown (#517). Self-hosted leftover cleanup PR-01
 * dropped the Free cap engine, so this banner must never render a lock.
 */
export async function AccessCutoffBanner() {
  return null
}
