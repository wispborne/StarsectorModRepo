// A set of filters: the game version, the category, the requires choice, where
// the mod was posted, the four switches, the AI use filter and the post dates. Browse, Home
// and saved filters all use it.
//
// A set is written in Browse's own address format (`game=…&only=…&ai=…`), so
// a set can go straight into a Browse link and a saved filter can be read
// with the same code as an address. A set with no `game` means the current
// release, whichever release that is when the set is read. That is how a
// saved filter made on the current release keeps up with game updates.
//
// No DOM, no storage and no imports beyond two other DOM-free modules, so
// Node can load it for the tests. Callers pass strings in and store the
// strings they get back.

import {
  AI_HIDE, AI_PRESETS, aiFilterFromAddress, aiFilterIsOn, aiFilterOff, aiFilterToAddress,
} from './ai_filter.js';
import { gameVersionFamily } from './version.js';

/// The game version filter's two choices that are not a release: every mod,
/// and the mods that do not say which release they are for.
export const ANY_GAME = 'any';
export const NO_GAME = 'none';
/// The requires choice for mods that need nothing else.
export const NO_REQUIREMENTS = '__none__';
export const ONLY = 'only';
export const NOT = 'not';

/// The switches, each a plain yes-or-no question about one field. Each has
/// three states: off, on (keep the mods that answer yes) and "not" (keep the
/// mods that answer no). A press moves to the next state. `notLabel` and
/// `notTitle` are what the switch says in the "not" state, and `keepWhenNot`,
/// where there is one, decides "not" in place of "everything `keep` turns away".
export const SWITCHES = [
  {
    key: 'download',
    label: 'Has a download',
    title: 'Only mods with a link that goes straight to a file.',
    notLabel: 'No direct download',
    notTitle: 'Only mods with no link that goes straight to a file.',
    keep: (mod) => mod.hasDirectDownload === true,
  },
  {
    key: 'source',
    label: 'Source code linked',
    title: 'Only mods with publicly available source code.',
    notLabel: 'No source code linked',
    notTitle: 'Only mods with no link to their source code.',
    keep: (mod) => mod.sourceIsPublic === true,
  },
  {
    key: 'addable',
    label: 'Safe to add mid-game',
    title: 'Only mods the author says are safe to add mid-game.',
    notLabel: 'Not safe to add mid-game',
    notTitle: 'Only mods the author says are not safe to add mid-game.',
    keep: (mod) => mod.saveCompatible === true,
    // Most mods never say. "Not" means the author said no, not that nobody
    // said anything.
    keepWhenNot: (mod) => mod.saveCompatible === false,
  },
  {
    key: 'nowip',
    label: 'Hide works in progress',
    title: 'Hide mods marked as unfinished in their thread.',
    notLabel: 'Only works in progress',
    notTitle: 'Only mods marked as unfinished in their thread.',
    keep: (mod) => mod.isWorkInProgress !== true,
  },
];

/// Where a mod was posted, for the "From" filter. The mod index is the
/// forum's own list of mods (today's, not the old posts for past game
/// versions), so it is a smaller part of "any forum thread".
export const POSTED_ON = [
  {
    key: 'index',
    label: 'Forum: mod index',
    title: 'Only mods the forum\'s mod index lists.',
    keep: (mod) => mod.onModIndex === true,
  },
  {
    key: 'forum',
    label: 'Forum: any thread',
    title: 'Only mods with a forum thread, listed on the mod index or not.',
    keep: (mod) => (mod.sources || []).includes('forum'),
  },
  {
    key: 'discord',
    label: 'Discord',
    title: 'Only mods posted on the Starsector Discord.',
    keep: (mod) => (mod.sources || []).includes('discord'),
  },
];

/// Whether a mod was posted where the filter asks. An empty choice keeps every mod.
export function postedOn(mod, from) {
  const option = POSTED_ON.find((each) => each.key === from);
  return !option || option.keep(mod);
}

/// The date filters. Each keeps the mods whose day falls between a first and
/// a last day, both included, and either end can be left open. A mod with no
/// day is left out while the filter is on: nobody can say it is in the range.
/// Days are `YYYY-MM-DD`, so comparing the text compares the days.
export const DATE_FILTERS = [
  {
    key: 'posted',
    label: 'Posted',
    dayOf: (mod) => mod.addedOn,
  },
  {
    key: 'edited',
    label: 'Last edited',
    // A post that was never edited counts from the day it was posted.
    dayOf: (mod) => mod.editedOn || mod.addedOn,
  },
];

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/// The date filters with nothing picked.
export function noDates() {
  return Object.fromEntries(DATE_FILTERS.map((option) => [option.key, { from: '', to: '' }]));
}

/// The date filters as the address names them: `postedfrom=…&postedto=…`.
/// Anything that is not a day is dropped.
export function datesFromAddress(query) {
  const dates = noDates();
  for (const option of DATE_FILTERS) {
    for (const end of ['from', 'to']) {
      const day = query.get(option.key + end) || '';
      if (DAY.test(day)) dates[option.key][end] = day;
    }
  }
  return dates;
}

function datesToAddress(dates) {
  const values = {};
  for (const option of DATE_FILTERS) {
    values[`${option.key}from`] = dates?.[option.key]?.from || '';
    values[`${option.key}to`] = dates?.[option.key]?.to || '';
  }
  return values;
}

/// Whether any date filter is on.
export function datesAreOn(dates) {
  return DATE_FILTERS.some((option) => dates?.[option.key]?.from || dates?.[option.key]?.to);
}

/// Whether a mod's days fall where the date filters ask.
export function inDates(mod, dates) {
  for (const option of DATE_FILTERS) {
    const { from, to } = dates?.[option.key] || {};
    if (!from && !to) continue;
    const day = option.dayOf(mod);
    if (!day) return false;
    if (from && day < from) return false;
    if (to && day > to) return false;
  }
  return true;
}

/// The date filters that are on, a few words each: "Posted 2024-01-01 to
/// 2025-06-30", "Last edited since 2026-01-01".
function datesInWords(dates) {
  const words = [];
  for (const option of DATE_FILTERS) {
    const { from, to } = dates?.[option.key] || {};
    if (from && to) words.push(`${option.label} ${from} to ${to}`);
    else if (from) words.push(`${option.label} since ${from}`);
    else if (to) words.push(`${option.label} up to ${to}`);
  }
  return words;
}

/// The address keys a set is written with, in the order they are written.
/// `older` and `hideai` are only read, from old links.
const SET_KEYS = ['game', 'category', 'needs', 'from', 'only', 'not', 'ai', 'aiparts',
  'ailevel', 'aioptional',
  ...DATE_FILTERS.flatMap((option) => [`${option.key}from`, `${option.key}to`])];

const asQuery = (query) =>
  query instanceof URLSearchParams ? query : new URLSearchParams(query || '');

/// The switches as the address names them: `only=a,b` and `not=c`. A key in
/// both counts as "only".
export function switchesFromAddress(query) {
  const picked = new Map();
  for (const state of [NOT, ONLY]) {
    for (const key of (query.get(state) || '').split(',')) {
      if (SWITCHES.some((option) => option.key === key)) picked.set(key, state);
    }
  }
  return picked;
}

/// The switch keys in one state, joined for the address. Written in the
/// switches' own order, so the same switches always give the same address.
export function switchKeysIn(switches, wanted) {
  return SWITCHES.filter((option) => switches.get(option.key) === wanted)
    .map((option) => option.key).join(',');
}

/// The game version the address asks for. With none named, the page opens on
/// the current release: nineteen pages of A-to-Z over every game release anyone
/// ever built for is not a list anybody reads.
export function gameFromAddress(query, currentVersion) {
  const asked = query.get('game');
  if (asked === ANY_GAME || asked === NO_GAME) return asked;
  // The filter works on the number a game release shares, so a link saved back
  // when it held a full spelling ("0.98a") still finds the same mods.
  if (asked) return gameVersionFamily(asked);
  // Links from before the current release was picked by default asked for
  // every release with `older=1`.
  if (query.get('older') === '1' || !currentVersion) return ANY_GAME;
  return currentVersion;
}

/// Reads a set from a query string or URLSearchParams. Anything that is not a
/// filter (the search, the sort, the page) is ignored.
export function readFilters(query, currentVersion) {
  const q = asQuery(query);
  return {
    game: gameFromAddress(q, currentVersion),
    // "Miscellaneous" was called "Everything else" once, and links to it
    // were shared under that name.
    category: q.get('category') === 'Everything else'
      ? 'Miscellaneous' : (q.get('category') || ''),
    needs: q.get('needs') || '',
    from: POSTED_ON.some((option) => option.key === q.get('from')) ? q.get('from') : '',
    switches: switchesFromAddress(q),
    ai: aiFilterFromAddress(q),
    dates: datesFromAddress(q),
  };
}

/// A set as address values, for `buildHash`. Empty values are left for the
/// caller to drop. The current release is left out, because a missing `game`
/// means the current release; pass no `currentVersion` to always write it.
export function filtersToAddress(filters, currentVersion = null) {
  return {
    game: currentVersion && filters.game === currentVersion ? '' : filters.game,
    category: filters.category,
    needs: filters.needs,
    from: filters.from,
    only: switchKeysIn(filters.switches, ONLY),
    not: switchKeysIn(filters.switches, NOT),
    ...aiFilterToAddress(filters.ai),
    ...datesToAddress(filters.dates),
  };
}

/// A set as the string that is stored, with its keys always in one order.
export function filterQuery(filters, currentVersion) {
  const values = filtersToAddress(filters, currentVersion);
  const out = new URLSearchParams();
  for (const key of SET_KEYS) {
    if (values[key]) out.set(key, values[key]);
  }
  return out.toString();
}

/// Only the filters from a query, dropping the search, the sort, the shuffle
/// and the page. Old spellings are read and written in today's form.
export function keepFilters(query, currentVersion) {
  return filterQuery(readFilters(query, currentVersion), currentVersion);
}

/// Whether two queries hold the same filters. Key order does not matter, the
/// current release matches a query with no `game`, and an AI filter that
/// hides nothing matches none.
export function sameFilters(a, b, currentVersion) {
  return comparable(a, currentVersion) === comparable(b, currentVersion);
}

function comparable(query, currentVersion) {
  const filters = readFilters(query, currentVersion);
  if (!aiFilterIsOn(filters.ai)) filters.ai = aiFilterOff();
  return filterQuery(filters, currentVersion);
}

/// Whether a set hides nothing: every game version, and every other filter
/// off. This is how Home starts.
export function filtersAreOff(filters) {
  return filters.game === ANY_GAME && !filters.category && !filters.needs && !filters.from
    && !filters.switches.size && !aiFilterIsOn(filters.ai) && !datesAreOn(filters.dates);
}

/// The set with every filter off.
export function noFilters() {
  return {
    game: ANY_GAME, category: '', needs: '', from: '', switches: new Map(), ai: aiFilterOff(),
    dates: noDates(),
  };
}

/// What the AI use filter is set to, in a few words: "AI use: No AI images".
export function aiFilterWords(filter) {
  if (!aiFilterIsOn(filter)) return 'AI use';
  if (filter.preset !== 'custom') {
    return `AI use: ${AI_PRESETS.find((preset) => preset.key === filter.preset).label}`;
  }
  return filter.mode === AI_HIDE ? 'AI use: hiding' : 'AI use: only';
}

/// The filters that are on, in a few words each: "0.98a · Has a download".
/// `gameLabel` turns a game version's number into the spelling to show.
/// Empty when nothing is on.
export function describeFilters(filters, gameLabel = (family) => family) {
  const words = [];
  if (filters.game === NO_GAME) words.push('No game version listed');
  else if (filters.game && filters.game !== ANY_GAME) words.push(gameLabel(filters.game));
  if (filters.category) words.push(filters.category);
  if (filters.needs === NO_REQUIREMENTS) words.push('Standalone mods only');
  else if (filters.needs) words.push(`Requires ${filters.needs}`);
  const from = POSTED_ON.find((option) => option.key === filters.from);
  if (from) words.push(from.key === 'discord' ? 'From Discord' : from.label);
  for (const option of SWITCHES) {
    const picked = filters.switches.get(option.key);
    if (picked) words.push(picked === NOT ? option.notLabel : option.label);
  }
  if (aiFilterIsOn(filters.ai)) words.push(aiFilterWords(filters.ai));
  words.push(...datesInWords(filters.dates));
  return words.join(' · ');
}

// --- Saved filters ---
//
// The list is JSON: `[{ "name": "…", "filters": "<query>" }]`, in the order
// the reader saved them. Every change returns a new list and leaves the old
// one alone.

/// The saved filters from their stored JSON. Anything unreadable, and any
/// entry that is not a name and a string of filters, is left out.
export function readSavedFilters(json) {
  let parsed;
  try {
    parsed = JSON.parse(json || '[]');
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((entry) => entry && typeof entry.name === 'string' && entry.name.trim()
      && typeof entry.filters === 'string')
    .map((entry) => ({ name: entry.name.trim(), filters: entry.filters }));
}

export function savedFiltersJson(list) {
  return JSON.stringify(list.map(({ name, filters }) => ({ name, filters })));
}

const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

/// The saved filter with this name, ignoring capitals and spaces at the ends.
export function savedNamed(list, name) {
  return list.find((entry) => sameName(entry.name, name)) || null;
}

/// The list with a filter saved under `name`. A filter already saved under
/// that name is replaced where it stands; a new one goes at the end.
export function withSaved(list, name, filters) {
  const entry = { name: name.trim(), filters };
  const at = list.findIndex((each) => sameName(each.name, name));
  if (at < 0) return [...list, entry];
  return list.map((each, i) => (i === at ? entry : each));
}

/// The list without the named filter, and what Undo needs to put it back.
export function withoutSaved(list, name) {
  const index = list.findIndex((each) => sameName(each.name, name));
  if (index < 0) return { list, removed: null };
  return {
    list: list.filter((_, i) => i !== index),
    removed: { entry: list[index], index },
  };
}

/// The list with a deleted filter back where it was. Should one of the same
/// name have been saved since, that one is kept.
export function restoreSaved(list, removed) {
  if (!removed || savedNamed(list, removed.entry.name)) return list;
  const at = Math.min(removed.index, list.length);
  return [...list.slice(0, at), removed.entry, ...list.slice(at)];
}

/// The saved filter that holds exactly these filters, or null.
export function matchingSaved(list, query, currentVersion) {
  return list.find((entry) => sameFilters(entry.filters, query, currentVersion)) || null;
}
