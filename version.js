// Comparing versions: which of two is newer.
//
// `compareVersions` is a copy of TriOS's version comparison
// (`lib/models/version.dart` in TriOS, `Version.compareVersions`), so the site
// and the launcher put versions in the same order. Keep the two in step: a fix
// over there belongs here too, and in `lib/site/version_compare.dart`, the
// copy the site's builder uses.
//
// Game versions need one more step first (`compareGameVersions`), because
// Starsector numbers its releases like decimals: 0.65 came out between 0.6 and
// 0.7, and 0.95 after 0.9.
//
// This file imports nothing, so the tests can load it in Node.

const GROUPING = /(\d+|[a-zA-Z]+|[-.]+)/g;
const SEPARATORS = /[\s\-–_]+/g;
const LETTER = /[a-zA-Z]/;

/// Words that mean "not finished yet", earliest first. A version carrying one
/// is older than the same version without it.
const SUFFIX_RANK = Object.fromEntries(
  ['dev', 'prerelease', 'preview', 'pre', 'alpha', 'beta', 'rc'].map((word, i) => [word, i]),
);

const tokens = (text) => text.match(GROUPING) || [];
const isNumber = (part) => /^\d+$/.test(part);

/// Lines the two versions' parts up so they can be compared one by one,
/// filling a gap on one side the way TriOS does.
function lineUp(a, b) {
  const aParts = tokens(a);
  const bParts = tokens(b);
  const aResult = [];
  const bResult = [];

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    let aPart = aParts[i] ?? '';
    let bPart = bParts[i] ?? '';
    const aIsNumber = isNumber(aPart);
    const bIsNumber = isNumber(bPart);
    const aIsLetter = LETTER.test(aPart);
    const bIsLetter = LETTER.test(bPart);

    // A letter against a number: "1.9.g" against "1.9.0" reads the letter as
    // coming after a zero.
    if (aIsLetter && bIsNumber) {
      aResult.push('0');
    } else if (bIsLetter && aIsNumber) {
      bResult.push('0');
    } else if (aPart === '' && bIsNumber) {
      aPart = '0';
    } else if (bPart === '' && aIsNumber) {
      bPart = '0';
    } else if (aPart === '' && bPart === '.') {
      aPart = '.';
    } else if (bPart === '' && aPart === '.') {
      bPart = '.';
    } else if (aPart === '' && bIsLetter) {
      // A letter against nothing is left as it is.
    } else if (bPart === '' && aIsLetter) {
      // A letter against nothing is left as it is.
    } else if (aPart === '' && bPart !== '') {
      aPart = bPart;
    } else if (bPart === '' && aPart !== '') {
      bPart = aPart;
    }

    aResult.push(aPart);
    bResult.push(bPart);
  }
  return [aResult, bResult];
}

/// Negative when [a] is older than [b], positive when it is newer, zero when
/// they are the same. TriOS's rules: numbers are read as numbers, so 1.10 is
/// newer than 1.9; a number beats a letter in the same place; "dev", "pre",
/// "alpha", "beta" and "rc" are older than no marker at all.
export function compareVersions(a, b) {
  a = String(a ?? '');
  b = String(b ?? '');
  if (a === b) return 0;

  const aOriginal = a;
  const bOriginal = b;
  const aPartsOriginal = tokens(a);
  const bPartsOriginal = tokens(b);

  const [aParts, bParts] = lineUp(a.replace(SEPARATORS, '.'), b.replace(SEPARATORS, '.'));

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aPart = aParts[i] ?? '';
    const bPart = bParts[i] ?? '';
    const aIsNumber = isNumber(aPart);
    const bIsNumber = isNumber(bPart);

    if (aIsNumber && bIsNumber) {
      const diff = Number(aPart) - Number(bPart);
      if (diff) return diff > 0 ? 1 : -1;
    } else if (aIsNumber && !bIsNumber) {
      return 1;
    } else if (!aIsNumber && bIsNumber) {
      return -1;
    } else {
      const ai = SUFFIX_RANK[aPart.toLowerCase()];
      const bi = SUFFIX_RANK[bPart.toLowerCase()];
      if (ai !== undefined && bi !== undefined) {
        if (ai !== bi) return ai > bi ? 1 : -1;
      } else if (ai !== undefined) {
        return -1;
      } else if (bi !== undefined) {
        return 1;
      }
      if (aPart !== bPart) return aPart > bPart ? 1 : -1;
    }
  }

  if (aPartsOriginal.length !== bPartsOriginal.length) {
    return aPartsOriginal.length > bPartsOriginal.length ? 1 : -1;
  }
  if (aOriginal !== bOriginal) return aOriginal > bOriginal ? 1 : -1;
  return 0;
}

// --- Starsector's own versions ---

/// A game version as the author wrote it, with a missing leading "0." put
/// back: ".98a" is 0.98a, and "97a-RC11" is 0.97a-RC11. Every Starsector
/// release so far is 0.something, so a bare two-digit number can only be one
/// that lost its "0.".
export function repairGameVersion(version) {
  let text = String(version ?? '').trim().replace(/^v\s*\.?\s*/i, '');
  if (text.startsWith('.')) text = `0${text}`;
  if (/^\d{2}(?![\d.])/.test(text)) text = `0.${text}`;
  return fixMistypedRelease(text);
}

/// Known Starsector release numbers. `fixMistypedRelease` checks for typos
/// against this list. Other numbers are left alone unless they match a typo.
/// A game release newer than the list, such as 0.99a, is left alone; the list needs no update for new game versions.
const RELEASES = new Set([
  '0.1', '0.2', '0.3', '0.31', '0.32', '0.33', '0.34', '0.35',
  '0.5', '0.51', '0.52', '0.52.1', '0.53', '0.53.1', '0.54', '0.54.1',
  '0.6', '0.6.1', '0.6.2', '0.65', '0.65.1', '0.65.2',
  '0.7', '0.7.1', '0.7.2', '0.8', '0.8.1', '0.9', '0.9.1',
  '0.95', '0.95.1', '0.96', '0.97', '0.98',
]);

/// Fixes an extra dot ("0.9.8a" is 0.98a), a missing dot ("0.81a" is 0.8.1a),
/// or a letter between numbers ("0.95a.1a" is 0.95.1a).
/// Changes the version only when the fix matches exactly one known release.
function fixMistypedRelease(text) {
  const match = /^(\d+(?:\.\d+)*)(.*)$/.exec(text);
  if (!match) return text;
  const [, number, rest] = match;
  // Check for a letter between numbers first.
  // The number before the letter may also be a known release.
  const lettered = /^([a-z]+)\.(\d+)(.*)$/i.exec(rest);
  if (lettered && RELEASES.has(`${number}.${lettered[2]}`)) {
    return `${number}.${lettered[2]}${lettered[3] || lettered[1]}`;
  }
  if (RELEASES.has(number)) return text;

  const readings = new Set();
  const add = (candidate) => {
    if (RELEASES.has(candidate)) readings.add(candidate);
  };
  const [major, ...others] = number.split('.');
  const minor = others.join('.');
  // Try removing each dot after the first.
  for (let i = 1; i < others.length; i++) {
    add(`${major}.${others.slice(0, i).join('.')}${others.slice(i).join('.')}`);
  }
  // Try adding a dot between digits after the first dot.
  if (others.length === 1) {
    for (let i = 1; i < minor.length; i++) {
      add(`${major}.${minor.slice(0, i)}.${minor.slice(i)}`);
    }
  }
  if (readings.size !== 1) return text;
  return `${[...readings][0]}${rest}`;
}

/// The number part of a game version, which every spelling of one release
/// shares: "0.98a-RC8" and "0.98" are both "0.98".
export function gameVersionFamily(version) {
  const repaired = repairGameVersion(version);
  const match = /^(\d+(?:\.\d+)*)/.exec(repaired);
  return match ? match[1] : repaired;
}

/// A game version rewritten so `compareVersions` puts it in release order.
///
/// The part after the first dot is a decimal, so it is padded on the right to
/// three digits: 0.65 becomes 0.650, which is below 0.7 at 0.700. A missing
/// third part becomes 0, so 0.95a reads as 0.950.0a and sits below 0.95.1a.
/// Anything that is not shaped like a Starsector version is left as written.
function gameVersionInOrder(version) {
  const repaired = repairGameVersion(version);
  const match = /^(\d+)\.(\d{1,3})(?:\.(\d+))?(.*)$/.exec(repaired);
  if (!match) return repaired;
  const [, major, minor, patch = '0', rest] = match;
  return `${major}.${minor.padEnd(3, '0')}.${patch}${rest}`;
}

/// Compares two game versions in release order: negative when [a] came out
/// first.
export function compareGameVersions(a, b) {
  return compareVersions(gameVersionInOrder(a), gameVersionInOrder(b));
}
