import type { Shot, ShotVariation, ShotImage } from '../types'

/** Get the default variation for a shot (or first variation, or null) */
export function getDefaultVariation(shot: Shot): ShotVariation | null {
  const vars = shot.variations ?? []
  return vars.find((v) => v.is_default) ?? vars[0] ?? null
}

/**
 * Get the display image for a shot, preferring the default variation's image,
 * then any variation with an image, then falling back to legacy images array.
 */
export function getShotDisplayImage(shot: Shot): ShotImage | null {
  // Try default variation's image
  const defaultVar = getDefaultVariation(shot)
  if (defaultVar?.image) return defaultVar.image

  // Try first variation with an image
  const withImage = (shot.variations ?? []).find((v) => v.image)
  if (withImage?.image) return withImage.image

  // Legacy fallback: primary image from images array
  return shot.images?.find((i) => i.is_primary) ?? shot.images?.[0] ?? null
}
