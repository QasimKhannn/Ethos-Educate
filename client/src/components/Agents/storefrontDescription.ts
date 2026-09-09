const STOREFRONT_DESCRIPTION_MAX_LENGTH = 76;

const STOREFRONT_DESCRIPTION_OVERRIDES: Record<string, string> = {
  'logo editor agent': 'Create school-safe logo variations.',
  'youtube video finder': 'Find relevant instructional videos and vet them for classroom use.',
};

export const getShortStorefrontDescription = (name: string, description: string) => {
  const normalizedName = name.trim().toLocaleLowerCase();
  const normalizedDescription = description.trim().replace(/\s+/g, ' ');
  const override = STOREFRONT_DESCRIPTION_OVERRIDES[normalizedName];

  if (override != null) {
    return override;
  }

  if (normalizedDescription.length <= STOREFRONT_DESCRIPTION_MAX_LENGTH) {
    return normalizedDescription;
  }

  const shortenedDescription = normalizedDescription
    .slice(0, STOREFRONT_DESCRIPTION_MAX_LENGTH)
    .replace(/\s+\S*$/, '')
    .trim();

  return `${shortenedDescription}…`;
};
