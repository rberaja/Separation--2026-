/**
 * Addresses are reported differently by the Groups workbook and AppFolio.
 * Keep the matching conservative: a shared street name alone is not enough
 * when both values identify different street numbers.
 */
const canonicalText = (value: string) => value
  .toLocaleUpperCase()
  .replace(/\b(\d+)(?:ST|ND|RD|TH)\b/g, '$1')
  .replace(/\bAVENUE\b/g, 'AVE')
  .replace(/\bSTREET\b/g, 'ST')
  .replace(/\bBOULEVARD\b/g, 'BLVD')
  .replace(/\bDRIVE\b/g, 'DR')
  .replace(/\bROAD\b/g, 'RD')
  .replace(/\bNORTH\b/g, 'N')
  .replace(/\bSOUTH\b/g, 'S')
  .replace(/\bEAST\b/g, 'E')
  .replace(/\bWEST\b/g, 'W');

/** AppFolio's legacy label for the Menores Ave 40-unit property. */
const canonicalAlias = (value: string) => {
  const compact = value.replace(/[^A-Z0-9]/g, '');
  return compact.includes('MENORES112533') ? 'MENORESAVE40UNITS' : compact;
};

export const propertyKey = (value: string) => canonicalAlias(canonicalText(value));

const ADDRESS_NOISE = new Set(['AVE', 'ST', 'BLVD', 'DR', 'RD', 'CT', 'WAY', 'N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW', 'FL', 'MIAMI', 'GABLES', 'DISTRICT', 'UNIT', 'UNITS']);
function addressParts(value: string) {
  const tokens = canonicalText(value)
    .replace(/([A-Z])(\d)/g, '$1 $2')
    .replace(/(\d)([A-Z])/g, '$1 $2')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return {
    // AppFolio appends the city/state/ZIP to some labels. A ZIP is location
    // context, not the address number used to establish property identity.
    numbers: new Set(tokens.filter((token) => /^\d+$/.test(token) && token.length !== 5)),
    words: new Set(tokens.filter((token) => /^[A-Z]+$/.test(token) && token.length >= 4 && !ADDRESS_NOISE.has(token))),
  };
}

export function propertyMatches(left: string, right: string) {
  const leftKey = propertyKey(left);
  const rightKey = propertyKey(right);
  if (!leftKey || !rightKey) return false;
  if (leftKey === rightKey) return true;
  const [shorter, longer] = leftKey.length <= rightKey.length ? [leftKey, rightKey] : [rightKey, leftKey];
  if (shorter.length >= 8 && longer.includes(shorter)) return true;

  const leftParts = addressParts(left);
  const rightParts = addressParts(right);
  const sharedWords = [...leftParts.words].filter((word) => rightParts.words.has(word));
  if (!sharedWords.length) return false;
  const sharedNumbers = [...leftParts.numbers].filter((number) => rightParts.numbers.has(number));
  if (leftParts.numbers.size && rightParts.numbers.size) return sharedNumbers.length > 0;

  // A report sometimes omits a street number entirely (for example, Santillane).
  // Only accept a distinctive shared name in that case.
  return sharedWords.some((word) => word.length >= 8);
}
