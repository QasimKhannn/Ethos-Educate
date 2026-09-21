const INITIALISMS = new Set(['ai', 'api', 'csv', 'docx', 'html', 'json', 'mp3', 'pdf', 'url']);

const normaliseWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();

const formatWord = (word: string): string => {
  const lowerCaseWord = word.toLowerCase();
  if (INITIALISMS.has(lowerCaseWord)) {
    return lowerCaseWord.toUpperCase();
  }

  return `${lowerCaseWord.charAt(0).toUpperCase()}${lowerCaseWord.slice(1)}`;
};

/** Presents a tool identifier as a readable fallback when a provider has not supplied a title. */
export const formatToolDisplayName = (value: string): string => {
  const normalisedValue = normaliseWhitespace(value);
  const looksLikeIdentifier =
    /[._-]/.test(normalisedValue) || /[a-z0-9][A-Z]/.test(normalisedValue);
  if (!looksLikeIdentifier) {
    return normalisedValue;
  }

  const readableValue = normaliseWhitespace(
    normalisedValue.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[._-]+/g, ' '),
  );

  if (!readableValue) {
    return value;
  }

  return readableValue.split(' ').map(formatWord).join(' ');
};

/** Removes parameter documentation intended for an API client, not an educator choosing a tool. */
export const formatToolDescription = (value: string): string =>
  normaliseWhitespace(
    value.split(/\s*(?:args?|arguments?|inputs?|parameters?|input schema)\s*:/i)[0],
  );
