// Nicknames the search cannot work out for itself.
//
// Most shorthand is already in a mod's name: its start ("nex"), its initials
// ("kol"), the starts of its words run together ("indevo"), or the capitals
// inside one word ("gl" for GraphicsLib). The search finds all of those, and
// the nicknames an author's own post uses arrive on the mod's record as
// `nicknames`. A name goes in here only when none of that finds it — usually
// because the shorthand everyone uses is written nowhere in the mod's name or
// its post.
//
// Keyed by the mod's permanent id, which never changes, so an entry keeps
// pointing at the right mod. Every nickname here scores as the mod's own name
// does. Keep the list short: each entry is a guess about what people type.

export const NICKNAMES = {
  // Starsector+ was "SS+", and SSP is how people still write it.
  starsector: ['ssp'],
  // BRDY is the mod's own prefix, and its fork kept it.
  'blackrock-drive-yards': ['brdy'],
  'blackrock-drive-yards-2': ['brdy'],
  // The rules find "armaa", but Project MISTRAL's own name holds the word
  // "ArmaA" and would come first.
  'arma-armatura': ['armaa'],
};
