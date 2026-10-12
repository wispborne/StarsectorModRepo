// Shared browse and top-bar search. Comma-separated groups are alternatives;
// every word within a group must match an individual mod fact.

import { everyOtherName, modName } from './mod_names.js';
import { NICKNAMES } from './nicknames.js';

// --- The clean-up ---

/// Apostrophes, taken out without leaving a gap, so "Amazigh's" is "amazighs".
/// Done before anything else: Unicode would turn "´" into a space and a mark.
const APOSTROPHES = /['’‘´`]/g;
const NOT_A_LETTER_DIGIT_OR_DOT = /[^\p{L}\p{N}.]+/gu;
const ACCENT_MARKS = /\p{M}/gu;
/// A dot with no digit on one side of it. Only "0.98"-style dots are kept.
const LONE_DOT = /(?<!\p{N})\.|\.(?!\p{N})/gu;
const SPACES = /\s+/g;

/// Text reduced to lowercase words with single spaces between them: accents
/// off, apostrophes gone, every other mark a space, and a dot kept only
/// between two digits so a version like "0.98a" survives. Letters of every
/// alphabet are kept.
export function normalize(text) {
  if (text == null) return '';
  return String(text)
    .replace(APOSTROPHES, '')
    // Symbols go before the decomposition, which would turn "™" into "TM".
    .replace(NOT_A_LETTER_DIGIT_OR_DOT, ' ')
    .toLowerCase()
    .normalize('NFKD')
    .replace(ACCENT_MARKS, '')
    .replace(NOT_A_LETTER_DIGIT_OR_DOT, ' ')
    .replace(LONE_DOT, ' ')
    .replace(SPACES, ' ')
    .trim();
}

/// The same text with the spaces taken out, so "shipweapon" can match
/// "Ship/Weapon Pack".
const squash = (cleaned) => cleaned.replace(/ /g, '');

/// A name split where a small letter is followed by a capital, so "GraphicsLib"
/// is also read as "Graphics Lib" and its initials are "gl".
const splitAtCapitals = (text) =>
  String(text || '').replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2');

// --- Spelling distance ---

/// How many single-letter changes turn one word into the other: a letter
/// added, taken away or swapped for another, or two letters next to each
/// other trading places. Stops early and answers `limit + 1` once the answer is
/// sure to be over `limit`.
export function editDistance(a, b, limit = Infinity) {
  a = String(a);
  b = String(b);
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let before = null;
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let smallest = i;
    for (let j = 1; j <= b.length; j++) {
      const change = a[i - 1] === b[j - 1] ? 0 : 1;
      let cost = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + change);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        cost = Math.min(cost, before[j - 2] + 1);
      }
      row.push(cost);
      if (cost < smallest) smallest = cost;
    }
    if (smallest > limit) return limit + 1;
    before = previous;
    previous = row;
  }
  return previous[b.length];
}

// --- What a mod can be found by ---

/// Words too small to count when a name is shortened to its initials, or to
/// stop a run of word starts ("aotd" and "ad" are both Ashes of the Domain).
const STOP_WORDS = new Set(
  ['of', 'the', 'and', 'for', 'a', 'an', 'in', 'on', 'to', 'by', 'or', 'at']);

// Match penalties by field; lower costs rank ahead of incidental matches.
const COST = {
  name: 0,
  namePiece: 10,
  initials: 0,
  person: 0,
  category: 20,
  version: 20,
  summary: 40,
};

/// The kinds of fact that say who or what the mod is. A typed word that hits
/// none of these is the one a close spelling is tried for.
const IDENTITY = new Set(['name', 'namePiece', 'initials', 'person']);

/// Everything worked out for a mod, kept so it is done once per mod. Keyed on
/// the mod itself, because two mods can share a name.
const factsByMod = new WeakMap();

// Cached terms, full names, name segments and words used for typo matching.
function factsOf(mod) {
  const known = factsByMod.get(mod);
  if (known) return known;

  const terms = new Map();
  const add = (value, cost, kind) => {
    const term = normalize(value);
    if (!term) return;
    const had = terms.get(term);
    if (!had || cost < had.cost) terms.set(term, { term, cost, kind });
  };

  const shown = modName(mod);
  const nicknames = [...(mod.nicknames || []), ...(NICKNAMES[mod.id] || [])];
  const names = [shown, mod.name, ...nicknames].map(normalize).filter(Boolean);
  for (const name of names) {
    add(name, COST.name, 'name');
    add(squash(name), COST.name, 'name');
  }

  const nameWords = [];
  for (const form of new Set([normalize(shown), normalize(splitAtCapitals(shown))])) {
    const words = form.split(' ').filter(Boolean);
    if (!words.length) continue;
    nameWords.push(words);
    for (const word of words) add(word, COST.namePiece, 'namePiece');
    if (words.length < 2) continue;
    // The initials, and again with the little words left out: "Ashes of the
    // Domain" is "aotd" taking every word and "ad" taking only the ones that
    // mean anything, and people write it both ways.
    add(words.map((word) => word[0]).join(''), COST.initials, 'initials');
    const solid = words.filter((word) => !STOP_WORDS.has(word));
    if (solid.length >= 2) add(solid.map((word) => word[0]).join(''), COST.initials, 'initials');
  }
  for (const word of normalize(mod.name).split(' ')) add(word, COST.namePiece, 'namePiece');

  const people = [...(mod.authors || []), ...everyOtherName(mod)].map(normalize).filter(Boolean);
  for (const person of people) {
    add(person, COST.person, 'person');
    add(squash(person), COST.person, 'person');
  }

  for (const category of mod.categories || []) add(category, COST.category, 'category');
  add(mod.gameVersion, COST.version, 'version');
  add(mod.modVersion, COST.version, 'version');
  add(mod.summary, COST.summary, 'summary');

  const closeWords = new Set();
  for (const text of [...names, ...people]) {
    for (const word of text.split(' ')) if (word) closeWords.add(word);
  }

  const facts = { terms: [...terms.values()], names, nameWords, closeWords: [...closeWords] };
  factsByMod.set(mod, facts);
  return facts;
}

/// Everything about a mod a search can match: each fact its own term, cleaned
/// up, with what a match on it costs.
export function searchTerms(mod) {
  return factsOf(mod).terms;
}

// --- How well one typed word answers ---

/// How well one fact answers a typed word: the fact being exactly the word,
/// starting with it, having a word inside it that starts with it, or holding
/// it somewhere. Below zero when it does not answer at all.
function scoreTerm(tag, wanted) {
  let score;
  if (tag.term === wanted) score = 100;
  else if (tag.term.startsWith(wanted)) score = 80;
  else if (tag.term.includes(` ${wanted}`)) score = 70;
  else if (tag.term.includes(wanted)) score = 50;
  else return -1;
  // Typing a mod's initials exactly is naming it, near enough: as good as a
  // name that starts with what was typed.
  if (score === 100 && tag.kind === 'initials') score += 40;
  return score - tag.cost;
}

/// A run of word starts scores below any match on the name's own words, so a
/// mod whose name really holds the letters always comes first.
const WORD_STARTS_SCORE = 45;

/// A close spelling of a name scores below every exact match on a name or a
/// person, and above a word found mid-way through a summary.
const CLOSE_SCORES = [null, 38, 34];

const HAS_DIGIT = /\p{N}/u;
const ONLY_LETTERS = /^\p{L}+$/u;

/// The best score a plain word or a quoted phrase gets against a mod. Exact
/// matching first; then, for a plain word, the two looser ways in.
function scoreWord(facts, wanted, { loose }) {
  let best = -1;
  let hitsIdentity = false;
  for (const tag of facts.terms) {
    const score = scoreTerm(tag, wanted);
    if (score < 0) continue;
    if (score > best) best = score;
    if (IDENTITY.has(tag.kind)) hitsIdentity = true;
  }
  if (!loose) return best;

  if (best < WORD_STARTS_SCORE && builtFromWordStarts(wanted, facts.nameWords)) {
    best = WORD_STARTS_SCORE;
  }
  if (!hitsIdentity) {
    const close = closeSpelling(wanted, facts.closeWords);
    if (close > best) best = close;
  }
  return best;
}

/// True when the typed word can be built from the starts of words standing
/// next to each other in a name, in order, little words skipped where needed:
/// "indevo" is Ind-ustrial Evo-lution, "kol" is K-nights O-f L-udd.
///
/// Two limits keep ordinary words out, both measured on the real mod list:
/// three letters or more, and either every piece is one letter or every piece
/// but the last is two letters or more. Without the second, "faction" found
/// Fleet Action History ("f" + "action").
function builtFromWordStarts(wanted, nameWords) {
  if (wanted.length < 3 || !ONLY_LETTERS.test(wanted)) return false;
  for (const words of nameWords) {
    if (words.length < 2) continue;
    const fits = (at, from, pieces) => {
      if (at === wanted.length) {
        if (pieces.length < 2) return false;
        return pieces.every((size) => size === 1)
          || pieces.slice(0, -1).every((size) => size >= 2);
      }
      for (let i = from; i < words.length; i++) {
        const word = words[i];
        for (let size = Math.min(word.length, wanted.length - at); size >= 1; size--) {
          if (word.startsWith(wanted.slice(at, at + size))
            && fits(at + size, i + 1, [...pieces, size])) return true;
        }
        if (!STOP_WORDS.has(word)) break;
      }
      return false;
    };
    for (let first = 0; first < words.length; first++) {
      if (fits(0, first, [])) return true;
    }
  }
  return false;
}

/// The score for a word spelled almost like one in a name or a person's name,
/// or -1. Only for words of five letters or more with no digits, and only
/// where the first letter is right, which almost every typo keeps — without
/// that, "faction" is one letter from "action". One mistake is allowed in a
/// word of five to seven letters, two from eight letters up. A word is also
/// compared with the start of each longer word, so a half-typed word with a
/// mistake in it is still found.
function closeSpelling(wanted, words) {
  if (wanted.length < 5 || HAS_DIGIT.test(wanted)) return -1;
  const allowed = wanted.length >= 8 ? 2 : 1;
  let fewest = allowed + 1;
  for (const word of words) {
    if (word[0] !== wanted[0]) continue;
    fewest = Math.min(fewest, editDistance(wanted, word, allowed));
    if (word.length > wanted.length) {
      fewest = Math.min(fewest, editDistance(wanted, word.slice(0, wanted.length), allowed));
    }
    if (fewest === 1) break;
  }
  return fewest >= 1 && fewest <= allowed ? CLOSE_SCORES[fewest] : -1;
}

// --- Asking about one field ---

/// The fields a reader can ask about by name, as in `author:Wisp`. Each gives
/// back the values to look in.
///
/// Only fields the list file really carries are here. The mod's full
/// description is not one of them: it lives in the mod's own file, which the
/// browse page never fetches, so `description:` would quietly match nothing.
/// An unknown name is not an error — it falls through to an ordinary search,
/// so a mod whose name has a colon in it can still be searched for.
const FIELDS = {
  name: (mod) => [mod.name, mod.displayName],
  author: (mod) => [...(mod.authors || []), ...everyOtherName(mod)],
  category: (mod) => mod.categories || [],
  version: (mod) => [mod.gameVersion],
  gameversion: (mod) => [mod.gameVersion],
  modversion: (mod) => [mod.modVersion],
  source: (mod) => mod.sources || [],
  url: (mod) => [mod.forumUrl, mod.discordUrl,
    mod.bestDownload && mod.bestDownload.url],
  summary: (mod) => [mod.summary],
};
// The plural reads as naturally as the singular, so both are accepted.
FIELDS.authors = FIELDS.author;
FIELDS.categories = FIELDS.category;
FIELDS.sources = FIELDS.source;

/// A field asked about by name answers as well as a mod's own name does, so
/// `author:Wisp` puts Wisp's mods at the top.
const FIELD_SCORE = 100;

// --- Reading what was typed ---

/// Splits text at a character, except inside double quotes.
function splitOutsideQuotes(text, isBreak) {
  const parts = [];
  let current = '';
  let quoted = false;
  for (const ch of text) {
    if (ch === '"') quoted = !quoted;
    if (!quoted && isBreak(ch)) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts;
}

/// A quote with no closing mark runs to the end of its comma group, so the
/// missing mark is put there.
function closeOpenQuote(text) {
  if ((text.match(/"/g) || []).length % 2 === 0) return text;
  const open = text.lastIndexOf('"');
  const comma = text.indexOf(',', open);
  return comma < 0 ? `${text}"` : `${text.slice(0, comma)}"${text.slice(comma)}`;
}

const FIELD_TERM = /^([a-z]+):(.*)$/is;

/// One piece of a group, read as what it asks for. Gives back a list, because
/// a plain word that clean-up turns into several ("seeker-unidentified") is
/// several words.
function readPiece(piece) {
  const leaveOut = piece.startsWith('-');
  const body = leaveOut ? piece.slice(1) : piece;
  if (!body) return [];

  if (body.startsWith('"')) {
    const phrase = normalize(body.slice(1).replace(/"$/, ''));
    return phrase ? [{ kind: 'phrase', value: phrase, leaveOut }] : [];
  }

  const asField = FIELD_TERM.exec(body);
  if (asField) {
    const field = FIELDS[asField[1].toLowerCase()];
    const value = normalize(asField[2].replace(/^"|"$/g, ''));
    if (field && value) return [{ kind: 'field', field, value, leaveOut }];
  }

  const cleaned = normalize(body);
  if (!cleaned) return [];
  // A word to leave out that cleans to several stays one thing to leave out.
  if (leaveOut) return [{ kind: 'phrase', value: cleaned, leaveOut }];
  return cleaned.split(' ').map((word) => ({ kind: 'word', value: word, leaveOut }));
}

/// Splits what the reader typed into comma groups, each a list of things to
/// look for and things to leave out. Commas inside quotes are part of the
/// phrase. A plus means the same as a space. A minus, a plus or a quote with
/// nothing to go with it is ignored rather than emptying the list.
export function readSearch(text) {
  const groups = [];
  for (const raw of splitOutsideQuotes(closeOpenQuote(String(text || '')), (ch) => ch === ',')) {
    const wanted = [];
    const unwanted = [];
    for (const piece of splitOutsideQuotes(raw, (ch) => /\s|\+/.test(ch))) {
      for (const part of readPiece(piece.trim())) {
        (part.leaveOut ? unwanted : wanted).push(part);
      }
    }
    if (wanted.length || unwanted.length) groups.push({ wanted, unwanted });
  }
  return groups;
}

// --- Scoring a whole search ---

/// How well a mod answers one thing a group asks for, or below zero.
function scorePart(mod, facts, part) {
  if (part.kind === 'field') {
    return part.field(mod).some((value) => normalize(value).includes(part.value))
      ? FIELD_SCORE : -1;
  }
  // Nothing loose is tried for a word to leave out: a guess must never take a
  // mod off the list.
  return scoreWord(facts, part.value, { loose: part.kind === 'word' && !part.leaveOut });
}

/// The bonus a group earns for naming the mod: most when its words are the
/// mod's whole name (or a nickname), less when a name starts with them, less
/// again when they sit in order somewhere inside it.
function nameBonus(facts, group) {
  const typed = group.wanted.filter((part) => part.kind === 'word').map((part) => part.value);
  if (!typed.length) return 0;
  const joined = typed.join(' ');
  const squashed = squash(joined);
  let bonus = 0;
  for (const name of facts.names) {
    if (name === joined || squash(name) === squashed) return 60;
    if (name.startsWith(joined)) bonus = Math.max(bonus, 40);
    else if (name.includes(joined)) bonus = Math.max(bonus, 30);
  }
  return bonus;
}

/// A typed search, read once and then put to each mod.
///
/// - `isEmpty`: true when there is nothing to look for, and every mod answers.
/// - `hasWanted`: true when at least one group looks for something, rather than
///   only leaving mods out.
/// - `score(mod)`: how well the mod answers, or below zero when it should not
///   be listed.
///
/// Commas mean any of these: where several groups let a mod in, the best one
/// speaks for it. Within a group every word has to match and their scores are
/// added. A word with a minus in front narrows its own group; a group made only
/// of minus words takes mods out of the whole list. Typing only minus words
/// starts from every mod.
export function compileSearch(text) {
  const groups = readSearch(text);
  const looking = groups.filter((group) => group.wanted.length);
  const leaving = groups.filter((group) => !group.wanted.length);
  const isEmpty = groups.length === 0;

  const score = (mod) => {
    if (isEmpty) return 0;
    const facts = factsOf(mod);
    for (const group of leaving) {
      if (group.unwanted.some((part) => scorePart(mod, facts, part) >= 0)) return -1;
    }
    if (!looking.length) return 0;

    let best = -1;
    for (const group of looking) {
      if (group.unwanted.some((part) => scorePart(mod, facts, part) >= 0)) continue;
      let total = 0;
      for (const part of group.wanted) {
        const partScore = scorePart(mod, facts, part);
        if (partScore < 0) {
          total = -1;
          break;
        }
        total += partScore;
      }
      if (total < 0) continue;
      total += nameBonus(facts, group);
      if (total > best) best = total;
    }
    return best;
  };

  return { isEmpty, hasWanted: looking.length > 0, groups, score };
}

/// The mods that answer a search, best first. Ties go by name, then id, so
/// the order never changes between two runs of the same search. With nothing
/// to look for, the mods come back in the order given, for the caller to sort.
/// The list passed in is never changed.
export function searchMods(mods, text) {
  const search = compileSearch(text);
  if (search.isEmpty) return [...mods];
  return mods
    .map((mod) => ({ mod, score: search.score(mod) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score
      || modName(a.mod).localeCompare(modName(b.mod))
      || String(a.mod.id).localeCompare(String(b.mod.id)))
    .map((entry) => entry.mod);
}

/// The mods to suggest under the box at the top: the first few of exactly what
/// Browse would list for the same search. Nothing until there is something to
/// look for and at least two letters or digits of it.
export function suggestMods(mods, text, count) {
  if (!compileSearch(text).hasWanted || tooLittleTyped(text)) return [];
  return searchMods(mods, text).slice(0, count);
}

/// True when fewer than two letters or digits have been typed, which is too
/// little to suggest anything worth reading — mods or people.
const tooLittleTyped = (text) =>
  normalize(text).replace(/[^\p{L}\p{N}]/gu, '').length < 2;

// Suggest matching authors in alphabetical order.
export function peopleMatching(mods, text, count) {
  if (tooLittleTyped(text)) return [];
  const asks = compileSearch(text).groups
    .map((group) => group.wanted
      .filter((part) => part.kind !== 'field')
      .map((part) => part.value))
    .filter((values) => values.length);
  if (!asks.length) return [];

  const found = new Map();
  for (const mod of mods) {
    for (const name of mod.authors || []) {
      const cleaned = normalize(name);
      if (!cleaned || found.has(cleaned)) continue;
      const squashed = squash(cleaned);
      const holds = (value) => cleaned.includes(value) || squashed.includes(squash(value));
      if (asks.some((values) => values.every(holds))) found.set(cleaned, { name });
    }
  }
  return [...found.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, count);
}
