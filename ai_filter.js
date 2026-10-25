// Browse AI use filter settings, address keys and matching rules.
//
// Uses only the author's statement. A mod has `usesAi` (true, false, or
// omitted when there is no statement). When true, `aiUses` lists each use's
// `area`, plus `how` and `optional` if stated, and `extent` when AI did all
// of that part. Nothing is inferred.
// "Don't show AI-gen…" never hides a mod whose author says nothing about AI.
// "Absolutely no AI" keeps only mods whose author says no AI was used.
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

/// Modes for the Custom preset. "Don't show AI-gen…" with nothing checked
/// hides nothing.
export const AI_HIDE = 'hide';
export const AI_ONLY = 'only';
/// Keeps only mods whose author says no AI was used. Only the "Absolutely no
/// AI" preset uses it. Parts, level and the optional setting do not apply.
export const AI_NONE = 'none';

/// AI use levels. Each includes the levels above it.
/// Stated AI use with no `how` counts at every level.
export const AI_LEVELS = [
  { key: 'made', hows: ['generated'] },
  { key: 'edited', hows: ['generated', 'edited'] },
  { key: 'any', hows: ['generated', 'edited', 'assisted'] },
];

const ART_AREAS = AI_GROUPS.find((group) => group.key === 'art').areas.map(([area]) => area);

/// The presets, in display order. Only Custom shows the other settings.
/// `settings` is what the preset sets on top of the starting filter.
export const AI_PRESETS = [
  { key: 'off', label: 'Show everything' },
  {
    key: 'noai', label: 'No AI', title: 'Show mods with no AI disclosure or no AI.',
    settings: { parts: AI_AREAS },
  },
  {
    key: 'none', label: 'Absolutely no AI',
    title: "Only show mods where the author specifically stated they don't use AI.",
    settings: { mode: AI_NONE },
  },
  { key: 'noimages', label: 'No AI images', settings: { parts: ART_AREAS } },
  {
    key: 'novibecode', label: 'No vibecode', title: 'Hide mods entirely written with AI.',
    // Code that AI wrote all of, with no human edits stated.
    settings: { parts: ['code'], level: 'made', wholeOnly: true },
  },
  { key: 'custom', label: 'Custom' },
];

/// Starting settings: the "No filter" preset, which hides nothing.
/// `wholeOnly` counts a use only when AI did all of that part. Only the
/// "No vibecode" preset sets it.
export function aiFilterOff() {
  return {
    preset: 'off',
    mode: AI_HIDE,
    parts: new Set(),
    level: 'any',
    skipOptional: false,
    wholeOnly: false,
  };
}

/// The filter after picking a preset. Custom starts from the current
/// settings, so a preset can be picked first and then changed.
export function withPreset(filter, key) {
  if (key === 'custom') {
    return {
      ...filter,
      preset: 'custom',
      mode: filter.mode === AI_NONE ? AI_HIDE : filter.mode,
      parts: new Set(filter.parts),
      // Custom has no control for this, so it would hide mods without saying why.
      wholeOnly: false,
    };
  }
  const preset = AI_PRESETS.find((each) => each.key === key);
  if (!preset) return aiFilterOff();
  const settings = preset.settings ?? {};
  return {
    ...aiFilterOff(),
    ...settings,
    preset: key,
    parts: new Set(settings.parts ?? []),
  };
}

/// Whether the settings can hide mods.
/// "Only show AI-gen…" with nothing checked hides every mod.
export function aiFilterIsOn(filter) {
  return filter.mode !== AI_HIDE || filter.parts.size > 0;
}

/// Read AI use filter settings from the address. A preset is `ai=<preset>`.
/// Custom is `ai=custom` or `ai=only`, with `aiparts=portraits,music`,
/// `ailevel=made|edited` and `aioptional=keep`. Missing keys use their
/// defaults. Links from before the presets, with only the Custom keys, open
/// in Custom. Old `hideai=portraits,music` links still work.
export function aiFilterFromAddress(query) {
  const ai = query.get('ai');
  if (AI_PRESETS.some((preset) => preset.key === ai && preset.key !== 'custom')) {
    return withPreset(aiFilterOff(), ai);
  }
  const customKeys = ['aiparts', 'hideai', 'ailevel', 'aioptional'];
  if (ai !== 'custom' && ai !== AI_ONLY && !customKeys.some((key) => query.has(key))) {
    return aiFilterOff();
  }
  const filter = { ...aiFilterOff(), preset: 'custom' };
  if (ai === AI_ONLY) filter.mode = AI_ONLY;
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
  const custom = filter.preset === 'custom';
  return {
    ai: custom ? (filter.mode === AI_ONLY ? AI_ONLY : 'custom')
      : filter.preset !== 'off' ? filter.preset : '',
    // Use a fixed order so the same settings give the same address.
    aiparts: custom ? AI_AREAS.filter((area) => filter.parts.has(area)).join(',') : '',
    ailevel: custom && filter.level !== 'any' ? filter.level : '',
    aioptional: custom && filter.skipOptional ? 'keep' : '',
  };
}

/// Whether a use matches the level and optional settings, regardless of area.
function useCounts(use, filter) {
  if (filter.skipOptional && use.optional) return false;
  if (filter.wholeOnly && use.extent !== 'all') return false;
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
  if (filter.mode === AI_NONE) return mod.usesAi === false;
  if (filter.mode === AI_ONLY) return aiMatches(mod, filter);
  return !aiMatches(mod, filter);
}
