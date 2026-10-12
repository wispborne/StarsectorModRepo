// Manual search aliases keyed by permanent mod id. Add only names that
// cannot be derived from the title or found in the author’s post.

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
