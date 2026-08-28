// What the site's search matches on.
//
// Both the browse page and the box in the bar at the top use this, so a search
// that finds a mod in one finds it in the other.
//
// Every mod gets a list of terms — its name, the words in its name, the first
// letters of those words, the people credited, its categories, its summary and
// its versions. A typed word matches when it sits inside one of those terms.
// Checking each fact on its own is the point: running them all into one long
// string lets the end of a category run into the start of an author's name and
// match something nobody typed.

import { everyOtherName, modName } from './lib.js';

/// The terms already worked out for a mod. Keyed on the mod itself, because two
/// mods can share a name and the list is fetched once and used everywhere.
const termsByMod = new WeakMap();

/// A name reduced to lowercase words with a dash between them: "Ship/Weapon
/// Pack" becomes "ship-weapon-pack". Splitting that on the dashes is how the
/// separate words, and the first letters of them, are found.
function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/// Words too small to count when a name is shortened to its initials.
const STOP_WORDS = new Set(
  ['of', 'the', 'and', 'for', 'a', 'an', 'in', 'on', 'to', 'by', 'or', 'at']);

/// How much worse a match on this fact is than a match on the mod's name.
///
/// A mod called "Nexerelin" should come above one whose category happens to
/// hold the letters somebody typed. These are the numbers taken off the score
/// so that happens: the name and the people credited cost nothing, the pieces
/// of a name cost a little, a category or a version costs more, and the
/// summary — a paragraph, where a stray match means least — costs most.
const COST = {
  name: 0,
  namePiece: 10,
  initials: 0,
  person: 0,
  category: 20,
  version: 20,
  summary: 30,
};

/// Everything about a mod a search can match: each fact its own term,
/// lowercased, with what a match on it costs.
///
/// The pieces and the initials come from the name as shown, not the thread
/// title — a title carries "[0.98a]" and a date, whose first letters are noise.
/// The title itself is still a term, so someone searching an old spelling of a
/// name still finds the mod.
export function searchTerms(mod) {
  const already = termsByMod.get(mod);
  if (already) return already;

  const terms = [];
  const add = (value, cost) => {
    const term = String(value || '').trim().toLowerCase();
    if (term) terms.push({ term, cost });
  };

  const shown = modName(mod);
  add(shown, COST.name);
  add(mod.name, COST.name);

  const words = slugify(shown).split('-').filter(Boolean);
  for (const word of words) add(word, COST.namePiece);
  if (words.length) {
    add(slugify(shown), COST.namePiece);
    add(words.map((word) => word[0]).join(''), COST.initials);
    // The initials again with the little words left out. "Ashes of the
    // Domain" is "aotd" taking every word and "ad" taking only the ones that
    // mean anything, and people write it both ways.
    const solid = words.filter((word) => !STOP_WORDS.has(word));
    if (solid.length && solid.length !== words.length) {
      add(solid.map((word) => word[0]).join(''), COST.initials);
    }
  }

  for (const author of mod.authors || []) add(author, COST.person);
  for (const other of everyOtherName(mod)) add(other, COST.person);
  for (const category of mod.categories || []) add(category, COST.category);
  add(mod.summary, COST.summary);
  add(mod.gameVersion, COST.version);
  add(mod.modVersion, COST.version);

  const seen = new Set();
  const unique = [];
  for (const tag of terms) {
    const key = `${tag.term}:${tag.cost}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(tag);
  }
  termsByMod.set(mod, unique);
  return unique;
}

/// How well one of a mod's terms answers what was typed. An exact match beats
/// a term that starts with it, which beats a term that merely holds it. Below
/// zero means it does not answer at all.
function scoreTerm(tag, wanted) {
  if (tag.term === wanted) return 100 - tag.cost;
  if (tag.term.startsWith(wanted)) return 75 - tag.cost;
  if (tag.term.includes(wanted)) return 50 - tag.cost;
  return -1;
}

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

/// How well a mod answers one typed term, or below zero when it does not.
///
/// `key:value` asks about one field; anything else is looked for across
/// everything the mod is known by, and the best-answering fact decides.
export function scoreOfTerm(mod, term) {
  const colon = term.indexOf(':');
  if (colon > 0) {
    const field = FIELDS[term.slice(0, colon).trim().toLowerCase()];
    const wanted = term.slice(colon + 1).trim();
    if (field && wanted) {
      const hit = field(mod).some(
        (value) => String(value || '').toLowerCase().includes(wanted));
      return hit ? FIELD_SCORE : -1;
    }
  }
  let best = -1;
  for (const tag of searchTerms(mod)) {
    const score = scoreTerm(tag, term);
    if (score > best) best = score;
  }
  return best;
}

/// True when a mod answers one typed term.
export function matchesTerm(mod, term) {
  return scoreOfTerm(mod, term) >= 0;
}

/// Splits what the reader typed into the groups to look for and the groups to
/// leave out.
///
/// Commas separate the groups, and a leading minus means "not this one". A
/// plus inside a group joins terms that must all match. A minus or a plus with
/// nothing either side of it is ignored rather than emptying the list.
export function readSearch(text) {
  const wanted = [];
  const unwanted = [];
  for (const raw of String(text || '').split(',')) {
    const group = raw.trim().toLowerCase();
    if (!group) continue;
    const leaveOut = group.startsWith('-');
    const terms = (leaveOut ? group.slice(1) : group)
      .split('+').map((term) => term.trim()).filter(Boolean);
    // A minus or a plus on its own is somebody halfway through typing, not a
    // search for a hyphen. The list holds still until there is something to
    // look for.
    if (!terms.length) continue;
    (leaveOut ? unwanted : wanted).push(terms);
  }
  return { wanted, unwanted };
}

/// How well a mod answers the whole search, or below zero when it should not
/// be listed at all.
///
/// Commas mean any of these, not all of them: "faction, portrait" shows both
/// kinds. A plus is the other way about — every term joined by one has to
/// match, so "hartley + abuse" finds only what answers both, and their scores
/// are added, because a mod answering both terms answers better than one
/// scraping past each. A group with a minus in front takes mods back out
/// again, and beats a group that put them in. Typing only minus groups starts
/// from every mod. Where several groups let a mod in, the best-answering one
/// speaks for it.
export function scoreOfSearch(mod, text) {
  const { wanted, unwanted } = readSearch(text);
  if (!wanted.length && !unwanted.length) return 0;

  const scoreGroup = (group) => {
    let total = 0;
    for (const term of group) {
      const score = scoreOfTerm(mod, term);
      if (score < 0) return -1;
      total += score;
    }
    return total;
  };

  if (unwanted.some((group) => scoreGroup(group) >= 0)) return -1;
  if (!wanted.length) return 0;

  let best = -1;
  for (const group of wanted) {
    const score = scoreGroup(group);
    if (score > best) best = score;
  }
  return best;
}

/// True when a mod should be listed.
export function matchesSearch(mod, text) {
  return scoreOfSearch(mod, text) >= 0;
}
