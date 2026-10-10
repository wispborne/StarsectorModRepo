// The names a mod and its people are known by.
//
// Kept apart from `lib.js` because it needs nothing from a browser, which is
// what lets the search be loaded and tested in Node. `lib.js` exports these
// again, so the rest of the site imports them from there as it always has.

/// The name to show for a mod.
///
/// A thread title carries the game version in brackets, the mod version, dates
/// and sometimes a leading dash. The builder publishes a tidied `displayName`
/// where it differs from the title; where it does not, the title was already
/// the name.
export function modName(mod) {
  return (mod && (mod.displayName || mod.name)) || '';
}

/// The other names one credited person goes by on this mod.
///
/// `otherAuthorNames` is keyed by the name in `authors`, because a mod can
/// credit two people and their other names must not be mixed up together.
export function otherNamesOf(mod, author) {
  const map = (mod && mod.otherAuthorNames) || {};
  const wanted = String(author).toLowerCase();
  for (const [name, others] of Object.entries(map)) {
    if (name.toLowerCase() === wanted) return others || [];
  }
  return [];
}

/// Every other name anyone credited on this mod goes by, in one list. For
/// searching, where it does not matter whose name is whose.
export function everyOtherName(mod) {
  const map = (mod && mod.otherAuthorNames) || {};
  return Object.values(map).flat();
}
