// Browse AI use filter settings, address keys and matching rules.
//
// Uses only the author's statement. A mod has `usesAi` (true, false, or
// omitted when there is no statement). When true, `aiUses` lists each use's
// `area`, plus `how` and `optional` if stated. Nothing is inferred.
// "Don't show AI-gen…" never hides a mod whose author says nothing about AI.
//
// No DOM and no imports, so Node can load it for the tests.

/// AI use areas grouped in display order. Area names match the data.
export const AI_GROUPS = [
  {
    key: 'art', label: 'Art',
    areas: [
      ['portraits', 'Portraits'],
      ['illustrations', 'Illustrations'],
      ['sprites', 'Sprites'],
      ['icons', 'Icons'],
    ],
  },
  { key: 'sound', label: 'Sound', areas: [['music', 'Music'], ['voice', 'Voice']] },
  {
    key: 'text', label: 'Text',
    areas: [['writing', 'Writing'], ['translation', 'Translation']],
  },
  { key: 'code', label: 'Code', areas: [['code', 'Code']] },
  { key: 'other', label: 'Other', areas: [['other', 'Other']] },
];

/// Every area, in the filter's order.
export const AI_AREAS = AI_GROUPS.flatMap((group) => group.areas.map(([area]) => area));

/// The filter starts in "Don't show AI-gen…" with nothing checked.
/// This hides nothing.
export const AI_HIDE = 'hide';
export const AI_ONLY = 'only';

/// AI use levels. Each includes the levels above it.
/// Stated AI use with no `how` counts at every level.
export const AI_LEVELS = [
  { key: 'made', hows: ['generated'] },
  { key: 'edited', hows: ['generated', 'edited'] },
  { key: 'any', hows: ['generated', 'edited', 'assisted'] },
];

/// Starting settings: "Don't show AI-gen…" with nothing checked.
/// This hides nothing; there is no off button.
export function aiFilterOff() {
  return {
    mode: AI_HIDE,
    parts: new Set(),
    level: 'any',
    skipOptional: false,
  };
}

/// Whether the settings can hide mods.
/// "Only show AI-gen…" with nothing checked hides every mod.
export function aiFilterIsOn(filter) {
  return filter.mode === AI_ONLY || filter.parts.size > 0;
}

/// Read AI use filter settings from the address:
/// `ai=only`, `aiparts=portraits,music`, `ailevel=made|edited` and
/// `aioptional=keep`. Missing keys use their defaults.
/// Old `hideai=portraits,music` links still work.
export function aiFilterFromAddress(query) {
  const filter = aiFilterOff();
  if (query.get('ai') === AI_ONLY) filter.mode = AI_ONLY;
  const asked = (query.get('aiparts') ?? query.get('hideai') ?? '').split(',');
  filter.parts = new Set(AI_AREAS.filter((area) => asked.includes(area)));
  if (AI_LEVELS.some((level) => level.key === query.get('ailevel'))) {
    filter.level = query.get('ailevel');
  }
  filter.skipOptional = query.get('aioptional') === 'keep';
  return filter;
}

/// Write filter settings for the address.
/// Default values use empty strings and add nothing to the address.
export function aiFilterToAddress(filter) {
  return {
    ai: filter.mode === AI_ONLY ? AI_ONLY : '',
    // Use a fixed order so the same settings give the same address.
    aiparts: AI_AREAS.filter((area) => filter.parts.has(area)).join(','),
    ailevel: filter.level !== 'any' ? filter.level : '',
    aioptional: filter.skipOptional ? 'keep' : '',
  };
}

/// Whether a use matches the level and optional settings, regardless of area.
function useCounts(use, filter) {
  if (filter.skipOptional && use.optional) return false;
  if (!use.how) return true;
  const level = AI_LEVELS.find((each) => each.key === filter.level) || AI_LEVELS[2];
  return level.hows.includes(use.how);
}

/// Areas that match the level and optional settings, regardless of checked
/// parts. Empty when the author states no AI use or gives no statement.
export function countedAreas(mod, filter) {
  if (mod.usesAi !== true) return new Set();
  const uses = mod.aiUses?.length ? mod.aiUses : [{ area: 'other' }];
  return new Set(uses.filter((use) => useCounts(use, filter)).map((use) => use.area));
}

/// Whether a mod has matching AI use in any checked part.
export function aiMatches(mod, filter) {
  return [...countedAreas(mod, filter)].some((area) => filter.parts.has(area));
}

/// Whether a mod stays on the list.
export function keepsForAi(mod, filter) {
  if (filter.mode === AI_ONLY) return aiMatches(mod, filter);
  return !aiMatches(mod, filter);
}
