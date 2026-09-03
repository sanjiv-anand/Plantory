export type CareTemplate = {
  species: string
  sunlight_description: string
  watering_notes: string
  soil_mix: string
  pot_size: string
}

export const CARE_TEMPLATES: CareTemplate[] = [
  {
    species: 'Monstera deliciosa',
    sunlight_description: 'Bright indirect light; avoid harsh midday sun.',
    watering_notes: 'Water when top 2–3 cm of soil is dry; reduce in winter.',
    soil_mix: 'Peaty, well-draining mix with perlite.',
    pot_size: 'Medium to large',
  },
  {
    species: 'Sansevieria',
    sunlight_description: 'Low to bright indirect light; very tolerant.',
    watering_notes: 'Water every 2–3 weeks; allow soil to dry completely.',
    soil_mix: 'Cactus/succulent mix.',
    pot_size: 'Small to medium',
  },
  {
    species: 'Pothos',
    sunlight_description: 'Medium indirect light; tolerates lower light.',
    watering_notes: 'Water when top half of soil dries out.',
    soil_mix: 'Standard potting mix with drainage.',
    pot_size: 'Small to medium',
  },
  {
    species: 'Basil',
    sunlight_description: 'Full sun, 6+ hours daily.',
    watering_notes: 'Keep soil consistently moist; water daily in hot weather.',
    soil_mix: 'Rich, well-draining herb mix.',
    pot_size: 'Small',
  },
  {
    species: 'Tomato',
    sunlight_description: 'Full sun, 8+ hours daily.',
    watering_notes: 'Deep, consistent watering; avoid wetting foliage.',
    soil_mix: 'Rich compost with good drainage.',
    pot_size: 'Large',
  },
  {
    species: 'Rose',
    sunlight_description: 'Full sun, at least 6 hours.',
    watering_notes: 'Deep watering 2–3 times per week; mulch to retain moisture.',
    soil_mix: 'Loamy, well-draining rose mix.',
    pot_size: 'Large',
  },
  {
    species: 'Succulent',
    sunlight_description: 'Bright light; some direct morning sun.',
    watering_notes: 'Water sparingly when soil is fully dry.',
    soil_mix: 'Gritty succulent/cactus mix.',
    pot_size: 'Small',
  },
  {
    species: 'Fern',
    sunlight_description: 'Indirect light; no direct sun.',
    watering_notes: 'Keep soil evenly moist; mist for humidity.',
    soil_mix: 'Peaty, moisture-retaining mix.',
    pot_size: 'Medium',
  },
]

export function findCareTemplate(species: string): CareTemplate | undefined {
  const normalized = species.trim().toLowerCase()
  if (!normalized) return undefined
  return CARE_TEMPLATES.find(
    (template) =>
      template.species.toLowerCase() === normalized ||
      normalized.includes(template.species.toLowerCase()) ||
      template.species.toLowerCase().includes(normalized),
  )
}
