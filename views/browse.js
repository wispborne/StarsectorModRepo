// Browse: every mod, with search, filters and sorting.
//
// The whole mod list is fetched once and searched in the browser, which is why
// `mods.json` is kept small. What the reader is looking at — the search text,
// the filters, the sort order and the page — rides in the address, so a link to
// a filtered list brings back the same list.

import {
  aiSparkle, aiSummaryBanner, aiSummaryNote, buildHash, categoryChips, clear,
  countedAcross,
  currentGameVersion, downloadButton, el, favoriteToggle,
  formatDay, gameVersionFamily, gameVersions, hashQuery, howLongAgo,
  imageUrlOf, isDiscordOnly, joinNames, modHref, modList, modName,
  MOD_VERSION_NOTE,
  NO_DESCRIPTION, pager, quickTip, pageSizePreference, picture, replaceHash,
  fullAiSummaryOnHover, searchHelpField, summaryTitle,
  summaryToShow,
  versionStanding, versionStandingNote, viewToggle,
} from '../lib.js';
import {
  AI_AREAS, AI_GROUPS, AI_HIDE, AI_LEVELS, AI_ONLY, aiFilterFromAddress,
  aiFilterIsOn, aiFilterOff, aiFilterToAddress, countedAreas, keepsForAi,
} from '../ai_filter.js';
import { compileSearch } from '../search.js';

const VIEW_KEY = 'starmodderView';
/// Where the filters sit: in a column at the left (the default) or across
/// the top.
const LAYOUT_KEY = 'starmodderBrowseLayout';
const FILTERS_KEY = 'starmodderBrowseFilters';
const PANELS_KEY = 'starmodderFilterPanels';
const NO_REQUIREMENTS = '__none__';
/// The game version filter's two choices that are not a release: every mod,
/// and the mods that do not say which release they are for.
const ANY_GAME = 'any';
const NO_GAME = 'none';

/// The switches, each a plain yes-or-no question about one field. Each has
/// three states: off, on (keep the mods that answer yes) and "not" (keep the
/// mods that answer no). A press moves to the next state. `notLabel` and
/// `notTitle` are what the switch says in the "not" state, and `keepWhenNot`,
/// where there is one, decides "not" in place of "everything `keep` turns away".
const SWITCHES = [
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
const ONLY = 'only';
const NOT = 'not';

// Checkbox marks from Tabler. All three are present; style.css shows the
// current state. A dash means some boxes in the group are checked.
const TRI_BOX_MARKS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" '
  + 'stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" '
  + 'focusable="false"><path class="mark-on" d="M5 12.5l4.5 4.5L19 7.5"/>'
  + '<path class="mark-not" d="M7 7l10 10M17 7 7 17"/>'
  + '<path class="mark-some" d="M6 12h12"/></svg>';
// Dot for the selected radio button.
const RADIO_MARK = '<svg viewBox="0 0 24 24" focusable="false">'
  + '<circle class="mark-on" cx="12" cy="12" r="5" fill="currentColor"/></svg>';

/// The switches as the address names them: `only=a,b` and `not=c`. A key in
/// both counts as "only".
function switchesFromAddress(query) {
  const picked = new Map();
  for (const state of [NOT, ONLY]) {
    for (const key of (query.get(state) || '').split(',')) {
      if (SWITCHES.some((option) => option.key === key)) picked.set(key, state);
    }
  }
  return picked;
}

const switchKeysIn = (switches, wanted) =>
  [...switches].filter(([, state]) => state === wanted).map(([key]) => key).join(',');

const SORTS = [
  // Only offered while there is something typed, and picked for the reader
  // when there is: a list of what answers best is the point of searching.
  { key: 'relevance', label: 'Best match', onlyWhenSearching: true },
  { key: 'current', label: 'Current version first' },
  { key: 'name', label: 'Name' },
  { key: 'newest', label: 'Newest' },
  { key: 'updated', label: 'Recently updated' },
  { key: 'random', label: 'Random' },
];

/// A new number to shuffle by. The shuffle is worked out from it rather than
/// drawn fresh each time, so turning a page or changing a filter keeps the same
/// order, and it rides in the address so a link brings back the same shuffle.
function newSeed() {
  return Math.floor(Math.random() * 0x7fffffff) + 1;
}

// A shared address supplies the whole selection. An ordinary Browse visit
// picks up the last selection, starting on the first page.
function browseQuery(query) {
  if (query.size) return query;
  try {
    const saved = new URLSearchParams(localStorage.getItem(FILTERS_KEY) || '');
    saved.delete('page');
    return saved;
  } catch {
    return query;
  }
}

function rememberFilters(hash) {
  const query = new URLSearchParams(hash.split('?')[1] || '');
  query.delete('page');
  try {
    localStorage.setItem(FILTERS_KEY, query.toString());
  } catch {
    // The address still keeps the selection when storage is unavailable.
  }
}

/// Drops the saved search text, keeping every other filter. The "Browse mods"
/// entry at the top calls this, so pressing it opens Browse with an empty
/// search box, as a fresh visit would.
export function forgetSearch() {
  try {
    const saved = new URLSearchParams(localStorage.getItem(FILTERS_KEY) || '');
    saved.delete('q');
    if (saved.get('sort') === 'relevance') saved.delete('sort');
    localStorage.setItem(FILTERS_KEY, saved.toString());
  } catch {
    // Without storage nothing was saved, so there is nothing to forget.
  }
}

export async function render(root, parts) {
  const list = await modList();
  const mods = list.mods || [];
  const currentVersion = currentGameVersion(mods);

  const query = browseQuery(hashQuery());
  const state = {
    search: query.get('q') || '',
    game: gameFromAddress(query, currentVersion),
    needs: query.get('needs') || '',
    // "Miscellaneous" was called "Everything else" once, and links to it
    // were shared under that name.
    category: query.get('category') === 'Everything else'
      ? 'Miscellaneous' : (query.get('category') || ''),
    author: query.get('author') || '',
    sort: SORTS.some((s) => s.key === query.get('sort')) ? query.get('sort')
      : ((query.get('q') || '') ? 'relevance' : 'current'),
    seed: Number(query.get('seed')) || newSeed(),
    switches: switchesFromAddress(query),
    ai: aiFilterFromAddress(query),
    page: Math.max(0, Number(query.get('page')) || 0),
    pageSize: pageSizePreference(),
    view: localStorage.getItem(VIEW_KEY) === 'rows' ? 'rows' : 'grid',
    currentVersion,
  };

  clear(root);

  const head = el('div', { class: 'page-head' }, [
    el('h1', { text: `Browse ${mods.length} mods` }),
  ]);
  const layout = savedLayout();
  const controls = el('div', { class: 'stack' });
  const side = el('aside', { class: 'browse-filters', 'aria-label': 'Filters' });
  const results = el('div', { class: 'stack' });

  // The count is read out as it changes, so it has to be the same node from
  // one draw to the next. A new node arriving with its words already in it is
  // announced by nothing. It is made here, before anything draws, because a
  // `const` cannot be reached from a function that runs above it.
  const countLine = el('div', { class: 'result-line', role: 'status' });
  const aiBanner = aiSummaryBanner(() => render(root, parts));
  root.append(layout === 'side'
    ? el('div', { class: 'stack' }, [
      aiBanner,
      head,
      el('div', { class: 'browse-split' }, [
        side,
        el('div', { class: 'stack browse-main' }, [controls, results]),
      ]),
    ])
    : el('div', { class: 'stack' }, [aiBanner, head, controls, results]));

  // The controls are drawn once and left alone; only the results are redrawn as
  // the reader types, so the search box never loses what is in it or where the
  // cursor sits. Swapping the layout draws the whole page again, from the
  // address, which already holds everything the reader had picked.
  drawControls({ top: controls, side, layout }, mods, state, () => {
    state.page = 0;
    saveState(state);
    drawResults(results, mods, state);
  }, (which) => {
    try {
      localStorage.setItem(LAYOUT_KEY, which);
    } catch {
      // Kept for this visit only.
    }
    render(root, parts);
  });
  drawResults(results, mods, state);

  function saveState(shown) {
    const hash = buildHash(['browse'], {
      q: shown.search,
      // The current release is what the page opens on, so it needs no mention.
      game: shown.game === shown.currentVersion ? '' : shown.game,
      needs: shown.needs,
      category: shown.category,
      author: shown.author,
      sort: shown.sort === 'current' ? '' : shown.sort,
      seed: shown.sort === 'random' ? shown.seed : '',
      only: switchKeysIn(shown.switches, ONLY),
      not: switchKeysIn(shown.switches, NOT),
      ...aiFilterToAddress(shown.ai),
      page: shown.page || '',
    });
    rememberFilters(hash);
    replaceHash(hash);
  }

  function drawResults(into, all, shown) {
    saveState(shown);
    clear(into);

    const matches = sortMods(all.filter((mod) => matchesFilters(mod, shown)),
      sortInUse(shown), shown.currentVersion, shown.search, shown.seed);

    // Widening the game version draws the whole page again, so the game
    // version filter shows the new choice too.
    fillResultLine(countLine, all, matches, shown,
      () => {
        shown.game = ANY_GAME;
        saveState(shown);
        render(root, parts);
      },
      () => {
        shown.ai = aiFilterOff();
        saveState(shown);
        render(root, parts);
      });
    into.append(countLine);

    if (!matches.length) {
      into.append(nothingMatched(() => {
        clearFilters(shown);
        saveState(shown);
        render(root, parts);
      }));
      return;
    }

    const size = shown.pageSize;
    const page = size ? matches.slice(shown.page * size, (shown.page + 1) * size)
      : matches;
    into.append(shown.view === 'grid'
      ? modGrid(page, shown.currentVersion) : modRows(page, shown.currentVersion));
    into.append(pager(shown.page, size, matches.length,
      (to) => { shown.page = to; drawResults(into, all, shown); window.scrollTo(0, 0); },
      (newSize) => { shown.pageSize = newSize; shown.page = 0; drawResults(into, all, shown); }));
  }
}

/// Which sort is really being used.
///
/// "Best match" only means anything while something is typed, so with an empty
/// box it stands aside for the usual order rather than leaving the list in
/// whatever order a scoreless sort would give.
export function sortInUse(state) {
  if (state.sort === 'relevance' && !state.search.trim()) return 'current';
  return state.sort;
}

/// The game version the address asks for. With none named, the page opens on
/// the current release: nineteen pages of A-to-Z over every game release anyone
/// ever built for is not a list anybody reads.
function gameFromAddress(query, currentVersion) {
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

/// The line above the results: how many matched, and — while the list is on
/// the current release — how many other releases would add, with one click to
/// bring them in.
///
/// It fills a line that is already on the page rather than making a new one,
/// because that is what gets it read out.
function fillResultLine(line, all, matches, state, onShowEveryRelease, onAiFilterOff) {
  clear(line);
  line.append(el('span', {
    text: matches.length === all.length
      ? `Showing all ${all.length} mods.`
      : `${matches.length} of ${all.length} mods shown.`,
  }));

  // Show the hidden count even when the filter panel is closed.
  if (aiFilterIsOn(state.ai)) {
    const left = all.filter((mod) => matchesFilters(mod, { ...state, ai: aiFilterOff() })).length
      - matches.length;
    if (left > 0) {
      const off = el('button', { class: 'link-button', text: 'Clear AI filter' });
      off.addEventListener('click', onAiFilterOff);
      line.append(el('span', {
        text: ` ${left} hidden by the AI use filter. `,
      }), off);
    }
  }

  if (!state.currentVersion || state.game !== state.currentVersion) return;

  const added = all.filter((mod) => matchesFilters(mod, { ...state, game: ANY_GAME })).length
    - matches.length;
  if (added <= 0) return;

  const button = el('button', {
    class: 'link-button',
    text: `Include ${added} for other game versions`,
  });
  button.addEventListener('click', onShowEveryRelease);
  line.append(el('span', { text: ' ' }), button);
}

// --- The controls ---

/// The layout the reader last picked, or the filters at the side.
function savedLayout() {
  try {
    return localStorage.getItem(LAYOUT_KEY) === 'top' ? 'top' : 'side';
  } catch {
    return 'side';
  }
}

/// Two buttons: filters along the top, or filters in a column at the side.
function layoutToggle(current, pick) {
  const group = el('div', {
    class: 'view-toggle', role: 'group', 'aria-label': 'Where the filters sit',
  });
  for (const [which, label, title] of [
    ['top', 'Top', 'Filters along the top'],
    ['side', 'Side', 'Filters in a column at the side'],
  ]) {
    const on = current === which;
    const button = el('button', {
      class: `btn btn-with-icon${on ? ' on' : ''}`, title, 'aria-pressed': String(on),
    }, [
      el('span', { class: 'view-icon', html: LAYOUT_ICONS[which] }),
      el('span', { text: label }),
    ]);
    if (!on) button.addEventListener('click', () => pick(which));
    group.append(button);
  }
  return group;
}

// Tabler layout-navbar and layout-sidebar icons.
const LAYOUT_ICONS = {
  top: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" '
    + 'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<path d="M4 6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z"/>'
    + '<path d="M4 9l16 0"/></svg>',
  side: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" '
    + 'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<path d="M4 6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z"/>'
    + '<path d="M9 4l0 16"/></svg>',
};

/// Reads which side panels the reader opened or shut, by heading.
/// For example: `{"Game version": false}`. Untouched panels are left out.
/// They use their default.
function savedPanels() {
  try {
    const saved = JSON.parse(localStorage.getItem(PANELS_KEY) || '{}');
    return saved && typeof saved === 'object' ? saved : {};
  } catch {
    return {};
  }
}

/// A side panel that remembers whether the reader left it open or shut.
/// `open` sets the starting state.
/// `beside` adds controls next to the heading.
function filterPanel(title, body, open, beside = null) {
  const saved = savedPanels()[title];
  const panel = el('details', {
    class: 'panel filter-panel', open: (typeof saved === 'boolean' ? saved : open) ? '' : null,
  }, [
    el('summary', { class: 'filter-panel-head' }, [el('span', { text: title }), beside]),
    body,
  ]);
  // Drawing a panel open also fires `toggle`. Only heading presses count.
  // Otherwise, each default would be saved as the reader's choice.
  let pressed = false;
  panel.querySelector('summary').addEventListener('click', () => { pressed = true; });
  panel.addEventListener('toggle', () => {
    if (!pressed) return;
    pressed = false;
    try {
      localStorage.setItem(PANELS_KEY,
        JSON.stringify({ ...savedPanels(), [title]: panel.open }));
    } catch {
      // Kept for this visit only.
    }
  });
  return panel;
}

/// A list of choices, one of which can be on, each with how many mods it
/// holds. Picking the one that is on turns it off. Drawn like the category
/// table, so the side column's lists all look alike.
function choiceList(entries, chosen, onPick) {
  const list = el('div', { class: 'category-table' });
  for (const { value, label, count } of entries) {
    const on = value === chosen;
    const button = el('button', {
      class: on ? 'category-cell on' : 'category-cell', 'aria-pressed': String(on),
    }, [
      el('span', { class: 'category-name', text: label }),
      el('span', { class: 'category-count', text: String(count) }),
    ]);
    button.addEventListener('click', () => onPick(on ? '' : value));
    list.append(button);
  }
  return list;
}

/// The search box, the categories, the dropdowns and the switches. Along the
/// top they sit in rows above the results. At the side the switches, the
/// categories and the game versions are lists in folding panels, and only the
/// search box, the sort and the view buttons stay above the results.
function drawControls(places, mods, state, onChange, onLayout) {
  const { top, side, layout } = places;
  const atSide = layout === 'side';

  // The category table is redrawn whenever anything else changes, because its counts
  // are of what picking that category would really show. Counting the whole list
  // would have a category read 182 and then hand back 104, since older game
  // versions are left out to begin with.
  const chips = el('div', {});
  const drawChips = () => {
    const wouldMatch = mods.filter(
        (mod) => matchesFilters(mod, { ...state, category: '' }));
    const row = categoryChips(wouldMatch, {
      chosen: state.category,
      onPick: (picked) => { state.category = picked; changed(); },
    });
    clear(chips);
    // Nothing matching means no table to draw. `append` turns a null into the
    // word "null" on the page, so the row has to be checked rather than handed
    // straight over.
    if (row) chips.append(row);
  };
  // At the side the game versions are a list too, counted the same way as the
  // categories: what picking that version would really show.
  const versionsHolder = el('div', {});
  const drawVersions = () => {
    const wouldMatch = mods.filter(
        (mod) => matchesFilters(mod, { ...state, game: ANY_GAME }));
    const entries = gameVersions(wouldMatch)
      .map((v) => ({ value: v.family, label: v.label, count: v.count }));
    const unknown = wouldMatch.filter((mod) => !mod.gameVersion).length;
    if (unknown) entries.push({ value: NO_GAME, label: 'No game version', count: unknown });
    clear(versionsHolder);
    // Turning off the one that is picked shows every release.
    versionsHolder.append(choiceList(entries, state.game,
      (v) => { state.game = v || ANY_GAME; changed(); }));
  };
  // Counts use the mods shown by the other filters. Redraw them with the
  // other controls so they stay up to date.
  const aiHolder = el('div', {});
  const aiMenuLabel = el('span');
  // All and None share the side panel's heading.
  // In the top layout, they share the box's small "AI use" heading.
  const aiAllOrNone = el('span', { class: 'ai-all-none' });
  for (const [label, pick] of [['All', true], ['None', false]]) {
    const button = el('button', {
      type: 'button', class: 'link-button', text: label,
      title: pick ? 'Select all.' : 'Deselect all.',
    });
    button.addEventListener('click', (event) => {
      // Keep the side panel open when All or None is pressed.
      event.preventDefault();
      state.ai.parts = pick ? new Set(AI_AREAS) : new Set();
      changed();
    });
    aiAllOrNone.append(button);
  }
  const aiMenu = el('details', { class: 'ai-filter-menu' }, [
    el('summary', { class: 'btn', title: 'Choose which kinds of AI use to filter by.' },
      [aiMenuLabel]),
    el('div', { class: 'ai-filter-box' }, [
      atSide ? null : el('div', { class: 'ai-filter-box-head' }, [
        el('span', { text: 'AI use' }), aiAllOrNone,
      ]),
      aiHolder,
    ]),
  ]);
  // Align the menu with its button, then shift it to fit on screen.
  aiMenu.addEventListener('toggle', () => {
    if (!aiMenu.open) return;
    const box = aiMenu.querySelector('.ai-filter-box');
    box.style.left = '0px';
    const edge = 16;
    const { left, right } = box.getBoundingClientRect();
    const shift = Math.max(edge - left, Math.min(0, window.innerWidth - edge - right));
    box.style.left = `${shift}px`;
  });
  const drawAiFilter = () => {
    const wouldMatch = mods.filter(
        (mod) => matchesFilters(mod, { ...state, ai: aiFilterOff() }));
    // Restore keyboard focus after redrawing the controls.
    const focused = aiHolder.contains(document.activeElement)
      ? document.activeElement.dataset.focus : null;
    clear(aiHolder);
    aiHolder.append(aiFilterBody(wouldMatch, state.ai, () => changed()));
    if (focused) aiHolder.querySelector(`[data-focus="${focused}"]`)?.focus();
    // Show the current filter in the top button.
    aiMenuLabel.textContent = aiMenuWords(state.ai);
    aiMenu.querySelector('summary').classList.toggle('on', aiFilterIsOn(state.ai));
  };
  const changed = () => {
    drawChips();
    drawAiFilter();
    if (atSide) drawVersions();
    onChange();
  };

  /// The sort in use before a search began, put back when the box is emptied.
  let sortBeforeSearch = null;
  /// Whether the reader picked a sort themselves during this search. Their
  /// choice outranks the automatic switch to Best match.
  let chosenByHand = state.sort !== 'current' && state.sort !== 'relevance';

  const search = el('input', {
    type: 'search',
    class: 'search-box',
    placeholder: 'Search names, authors, categories and descriptions…',
    value: state.search,
  });
  search.addEventListener('input', () => {
    const wasSearching = state.search.trim() !== '';
    state.search = search.value;
    const searchingNow = state.search.trim() !== '';

    // Starting a search sorts by what answers best, because that is the whole
    // point of having typed something. Clearing it puts back the sort that was
    // in use before, so the list a reader had set up is not quietly changed.
    if (searchingNow && !wasSearching && !chosenByHand) {
      sortBeforeSearch = state.sort;
      state.sort = 'relevance';
    } else if (!searchingNow && wasSearching) {
      if (state.sort === 'relevance') state.sort = sortBeforeSearch || 'current';
      chosenByHand = false;
    }
    drawSort();
    changed();
  });

  const views = viewToggle(() => state.view, (which) => {
    state.view = which;
    localStorage.setItem(VIEW_KEY, which);
    changed();
  });

  const versions = gameVersions(mods);
  const needed = neededMods(mods);
  // At the side the panel's heading names the dropdown, so it carries no label.
  const requiresDropdown = dropdown(atSide ? '' : 'Requires',
    [NO_REQUIREMENTS, ...needed], state.needs,
    (v) => { state.needs = v; changed(); },
    {
      anyLabel: '—',
      labels: { [NO_REQUIREMENTS]: 'Standalone (no requirements)' },
    });

  // "Best match" is only in the list while something is typed, so the dropdown
  // is rebuilt whenever that changes rather than drawn once like the others.
  const sortHolder = el('div', { class: 'sort-holder' });
  // Picking Random again from the dropdown does nothing, so a fresh shuffle
  // needs a button of its own. It is made once and only shown or hidden, so
  // choosing a sort never rebuilds the dropdown out from under the reader.
  const shuffleAgain = el('button', { class: 'btn', text: 'Shuffle' });
  shuffleAgain.addEventListener('click', () => {
    state.seed = newSeed();
    changed();
  });
  const showShuffleAgain = () => { shuffleAgain.hidden = state.sort !== 'random'; };
  const drawSort = () => {
    clear(sortHolder);
    const offered = SORTS.filter(
      (s) => !s.onlyWhenSearching || state.search.trim());
    sortHolder.append(dropdown('Sort by', offered.map((s) => s.key), state.sort,
      (v) => {
        state.sort = v || 'current';
        showShuffleAgain();
        // Choosing a sort by hand while searching means it is wanted for this
        // search, so typing on does not snatch the list back to Best match.
        chosenByHand = true;
        changed();
      },
      { anyLabel: null, labels: Object.fromEntries(offered.map((s) => [s.key, s.label])) }));
    sortHolder.append(shuffleAgain);
    showShuffleAgain();
  };
  drawSort();

  // Along the top each switch is a button that lights up; at the side it is a
  // box with its label, the way a list of filters usually reads. Either way a
  // press goes off, then on, then "not", then off again. "Not" shows its own
  // words and a cross, so it never reads as plain on.
  const switches = el('div', { class: atSide ? 'check-list' : 'switches' });
  const addSwitch = (option) => {
    const words = el('span');
    const tick = atSide
      ? el('span', { class: 'tri-box', 'aria-hidden': 'true', html: TRI_BOX_MARKS })
      : null;
    const button = el('button', {
      type: 'button',
      class: atSide ? 'check-row' : 'btn',
    }, [tick, words]);
    const draw = () => {
      const picked = state.switches.get(option.key);
      words.textContent = picked === NOT ? option.notLabel : option.label;
      button.title = `${picked === NOT ? option.notTitle : option.title} `
        + (picked === ONLY ? 'Press again for the opposite.'
          : picked === NOT ? 'Press again to turn this off.' : '');
      button.classList.toggle('on', picked === ONLY);
      button.classList.toggle('not', picked === NOT);
      button.setAttribute('aria-pressed', picked ? 'true' : 'false');
    };
    button.addEventListener('click', () => {
      const picked = state.switches.get(option.key);
      if (!picked) state.switches.set(option.key, ONLY);
      else if (picked === ONLY) state.switches.set(option.key, NOT);
      else state.switches.delete(option.key);
      draw();
      changed();
    });
    draw();
    switches.append(button);
  };

  for (const option of SWITCHES) addSwitch(option);

  const layoutSwitch = layoutToggle(layout, onLayout);
  drawChips();
  drawAiFilter();

  if (atSide) {
    drawVersions();
    top.append(
      el('div', { class: 'search-row' }, [searchHelpField(search)]),
      el('div', { class: 'filters' }, [
        sortHolder, el('span', { class: 'filters-gap' }), views, layoutSwitch,
      ]),
    );
    // On a phone, the column sits above the results. Only the switches start open.
    // Long lists would push the mods down by a screen or more.
    // On any screen, panels keep the state the reader chose.
    const phone = window.matchMedia('(max-width: 900px)').matches;
    side.append(
      filterPanel('Show', switches, true),
      filterPanel('Category', chips, !phone),
      // The list starts on the current release. Few readers change it.
      filterPanel('Game version', versionsHolder, false),
      filterPanel('Requires', requiresDropdown, !phone),
      filterPanel('AI use', aiHolder, !phone, aiAllOrNone),
    );
    return;
  }

  top.append(el('div', { class: 'search-row' }, [searchHelpField(search), views, layoutSwitch]));
  // The categories come before the dropdowns: picking a category is what most
  // readers want first, and a row you can see beats a list you have to open.
  top.append(chips);
  top.append(el('div', { class: 'filters' }, [
    dropdown('Game version', [...versions.map((v) => v.family), NO_GAME],
      state.game === ANY_GAME ? '' : state.game,
      (v) => { state.game = v || ANY_GAME; changed(); },
      {
        labels: {
          ...Object.fromEntries(versions.map((v) => [v.family, `${v.label} (${v.count})`])),
          [NO_GAME]: `No game version (${mods.filter((mod) => !mod.gameVersion).length})`,
        },
      }),
    requiresDropdown,
    sortHolder,
    switches,
    aiMenu,
  ]));
}

/// The two mode buttons sit above the parts, one above the other.
const AI_MODES = [
  [AI_HIDE, "Don't show AI-gen…", 'Hide mods where AI was used for any of the following.'],
  [AI_ONLY, 'Only show AI-gen…', 'Only show mods where AI was used for any of the following.'],
];

const AI_LEVEL_LABELS = {
  made: ['all of the work', null],
  edited: ['some, but edited by a human',
    null],
  any: ['anything at all', null],
};

/// Show the current filter in the top button even when the menu is closed.
function aiMenuWords(filter) {
  if (!aiFilterIsOn(filter)) return 'AI use';
  return filter.mode === AI_HIDE ? 'AI use: hiding' : 'AI use: only';
}

/// Controls for mode, parts, AI use level and optional parts.
/// Counts use `mods`, the mods left after the other filters.
function aiFilterBody(mods, filter, onChange) {
  const body = el('div', { class: 'ai-filter' });
  const set = (change) => { change(); onChange(); };

  const modes = el('div', {
    class: 'view-toggle ai-modes', role: 'group', 'aria-label': 'AI use filter',
  });
  for (const [mode, label, title] of AI_MODES) {
    const on = filter.mode === mode;
    const button = el('button', {
      type: 'button', class: `btn${on ? ' on' : ''}`, title,
      'aria-pressed': String(on), 'data-focus': `mode-${mode}`, text: label,
    });
    button.addEventListener('click', () => set(() => {
      filter.mode = mode;
      // Check all parts when switching to "Only show AI-gen…" with none checked.
      // Otherwise, no mods would be shown.
      if (mode === AI_ONLY && !filter.parts.size) filter.parts = new Set(AI_AREAS);
    }));
    modes.append(button);
  }
  body.append(modes);

  // Count matches for each part using the current level and optional setting.
  const areasOf = new Map(mods.map((mod) => [mod, countedAreas(mod, filter)]));
  const caught = (areas) =>
    mods.filter((mod) => areas.some((area) => areasOf.get(mod).has(area))).length;

  const parts = el('div', { class: 'check-list ai-parts' });
  for (const group of AI_GROUPS) {
    const areas = group.areas.map(([area]) => area);
    const ticked = areas.filter((area) => filter.parts.has(area)).length;
    const state = ticked === areas.length ? 'on' : ticked ? 'some' : '';
    parts.append(aiCheckRow(group.label, caught(areas), state, `group-${group.key}`,
      null,
      () => set(() => {
        for (const area of areas) {
          if (state === 'on') filter.parts.delete(area);
          else filter.parts.add(area);
        }
      })));
    if (areas.length < 2) continue;
    for (const [area, label] of group.areas) {
      const on = filter.parts.has(area);
      parts.append(aiCheckRow(label, caught([area]), on ? 'on' : '', `area-${area}`, null,
        () => set(() => { if (on) filter.parts.delete(area); else filter.parts.add(area); }),
        'ai-part'));
    }
  }
  body.append(parts);

  const levels = el('div', {
    class: 'check-list', role: 'radiogroup', 'aria-label': 'If AI did…',
  });
  for (const level of AI_LEVELS) {
    const [label, title] = AI_LEVEL_LABELS[level.key];
    const on = filter.level === level.key;
    const button = el('button', {
      type: 'button', class: `check-row radio${on ? ' on' : ''}`, role: 'radio',
      'aria-checked': String(on), title, 'data-focus': `level-${level.key}`,
    }, [
      el('span', { class: 'tri-box', 'aria-hidden': 'true', html: RADIO_MARK }),
      el('span', { text: label }),
    ]);
    button.addEventListener('click', () => set(() => { filter.level = level.key; }));
    levels.append(button);
  }
  body.append(aiFilterSection('If AI did…', levels));

  const more = el('div', { class: 'check-list' });
  more.append(aiCheckRow('Ignore if AI content is optional', null,
    filter.skipOptional ? 'on' : '', 'optional',
    'Ignore AI content that isn\'t required, such as an optional portrait pack.',
    () => set(() => { filter.skipOptional = !filter.skipOptional; })));
  body.append(aiFilterSection('Options', more));
  return body;
}

/// Filter section with a heading.
function aiFilterSection(title, content, beside = null) {
  return el('div', { class: 'ai-filter-section' }, [
    el('div', { class: 'ai-filter-head' }, [title ? el('span', { text: title }) : null, beside]),
    content,
  ]);
}

/// Checkbox, label and match count. `state` is `on`, `some`
/// (some boxes in a group are checked) or empty.
function aiCheckRow(label, count, state, focusKey, title, onPress, extraClass = '') {
  const button = el('button', {
    type: 'button',
    class: ['check-row', state, extraClass].filter(Boolean).join(' '),
    'aria-pressed': state === 'some' ? 'mixed' : String(state === 'on'),
    'data-focus': focusKey,
    title,
  }, [
    el('span', { class: 'tri-box', 'aria-hidden': 'true', html: TRI_BOX_MARKS }),
    el('span', { text: label }),
    count == null ? null : el('span', { class: 'check-count', text: String(count) }),
  ]);
  button.addEventListener('click', onPress);
  return button;
}

// Along the top, the AI use filter floats over the results, so a press
// anywhere else shuts it.
document.addEventListener('pointerdown', (event) => {
  for (const menu of document.querySelectorAll('.ai-filter-menu[open]')) {
    if (!menu.contains(event.target)) menu.open = false;
  }
});

function dropdown(label, values, chosen, onPick, opts = {}) {
  const { anyLabel = `Any ${(label || 'value').toLowerCase()}`, labels = {} } = opts;
  const select = el('select');
  if (anyLabel != null) select.append(el('option', { value: '', text: anyLabel }));
  for (const value of values) {
    select.append(el('option', { value, text: labels[value] || value }));
  }
  select.value = values.includes(chosen) ? chosen : (anyLabel != null ? '' : values[0]);
  select.addEventListener('change', () => onPick(select.value));
  return el('label', { class: 'filter-label' }, [
    label ? el('span', { text: label }) : null, select,
  ]);
}

/// Required mods, ordered by how many mods require them.
function neededMods(mods) {
  return countedAcross(mods, (mod) => (mod.needs || []).map((n) => n.name))
    .map(([name]) => name);
}

function clearFilters(state) {
  state.search = '';
  state.game = state.currentVersion || ANY_GAME;
  state.needs = '';
  state.category = '';
  state.author = '';
  state.switches.clear();
  state.ai = aiFilterOff();
  state.page = 0;
}

function nothingMatched(onClear) {
  const button = el('button', { class: 'btn btn-primary', text: 'Clear filters' });
  button.addEventListener('click', onClear);
  return el('div', { class: 'notice' }, [
    el('h3', { text: 'No mods match' }),
    el('p', { text: 'Try fewer search words or clear the filters.' }),
    el('p', { class: 'notice-action' }, [button]),
  ]);
}

// --- Searching, filtering and sorting ---

/// The search being typed, read once. One redraw filters, counts and sorts the
/// same list several times over, so the text is read once when it changes and
/// each mod's score is kept until it changes again.
let lastSearch = { text: null, search: null, scores: new WeakMap() };

/// How well a mod answers what is typed in the box, or below zero when it
/// should not be listed. Every mod answers an empty box.
function searchScore(mod, text) {
  if (lastSearch.text !== text) {
    lastSearch = { text, search: compileSearch(text), scores: new WeakMap() };
  }
  const { search, scores } = lastSearch;
  if (!scores.has(mod)) scores.set(mod, search.score(mod));
  return scores.get(mod);
}

/// True when a mod is built for the game release the site treats as current.
/// A mod that does not say which release it is for is kept — an unknown version
/// is not the same as an old one.
export function isForCurrentGame(mod, currentVersion) {
  if (!currentVersion || !mod.gameVersion) return true;
  return gameVersionFamily(mod.gameVersion) === currentVersion;
}

/// Whether a mod is on the game version the filter is set to.
function onGameVersion(mod, game) {
  if (!game || game === ANY_GAME) return true;
  if (game === NO_GAME) return !mod.gameVersion;
  return Boolean(mod.gameVersion) && gameVersionFamily(mod.gameVersion) === game;
}

export function matchesFilters(mod, state) {
  if (searchScore(mod, state.search) < 0) return false;
  if (!onGameVersion(mod, state.game)) return false;
  if (state.category && !(mod.categories || []).includes(state.category)) return false;
  if (state.needs === NO_REQUIREMENTS) {
    if ((mod.needs || []).length) return false;
  } else if (state.needs
      && !(mod.needs || []).some((n) => n.name === state.needs)) return false;
  if (state.author && !(mod.authors || []).includes(state.author)) return false;
  for (const option of SWITCHES) {
    const picked = state.switches.get(option.key);
    if (picked === ONLY && !option.keep(mod)) return false;
    if (picked === NOT
      && (option.keepWhenNot ? !option.keepWhenNot(mod) : option.keep(mod))) return false;
  }
  return !state.ai || keepsForAi(mod, state.ai);
}

export function sortMods(mods, sort, currentVersion, search = '', seed = 1) {
  const byName = (a, b) =>
    modName(a).localeCompare(modName(b), undefined, { sensitivity: 'base' });
  const newestFirst = (get) => (a, b) => {
    const left = get(a) || '';
    const right = get(b) || '';
    if (left === right) return byName(a, b);
    // A mod with no date sorts last, whichever way round the dates are.
    if (!left) return 1;
    if (!right) return -1;
    return right.localeCompare(left);
  };

  const sorted = [...mods];
  if (sort === 'relevance') {
    // The same scores the filter worked out, so nothing is scored twice.
    sorted.sort((a, b) => searchScore(b, search) - searchScore(a, search)
      || byName(a, b));
  } else if (sort === 'newest') sorted.sort(newestFirst((m) => m.addedOn));
  else if (sort === 'updated') sorted.sort(newestFirst((m) => m.lastReleaseDate));
  else if (sort === 'name') sorted.sort(byName);
  else if (sort === 'random') {
    // Each mod's place comes from its id and the seed alone, so a mod keeps its
    // place relative to the others whichever filters are on.
    const places = new Map(mods.map((mod) => [mod, shufflePlace(mod.id, seed)]));
    sorted.sort((a, b) => places.get(a) - places.get(b) || byName(a, b));
  }
  else {
    // The default: what a reader can use first, then what moved most recently,
    // then by name.
    const byRelease = newestFirst((m) => m.lastReleaseDate);
    sorted.sort((a, b) => {
      const left = isForCurrentGame(a, currentVersion) ? 0 : 1;
      const right = isForCurrentGame(b, currentVersion) ? 0 : 1;
      return left - right || byRelease(a, b);
    });
  }
  return sorted;
}

/// A number from 0 up to 2^32 for one mod under one seed: the same answer every
/// time for the same two, and no pattern between neighbouring ids. FNV-1a over
/// the id, started from the seed, then mixed so similar ids land far apart.
function shufflePlace(id, seed) {
  let hash = (2166136261 ^ seed) >>> 0;
  for (const char of String(id)) {
    hash = Math.imul(hash ^ char.codePointAt(0), 16777619);
  }
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  return (hash ^ (hash >>> 16)) >>> 0;
}

// --- Drawing the mods ---

export function modGrid(mods, currentVersion) {
  const grid = el('div', { class: 'mod-grid' });
  for (const mod of mods) grid.append(modCard(mod, currentVersion));
  return grid;
}

/// Keeps the favorite and download controls outside the card's link to avoid
/// nesting interactive elements. `when` overrides the update date for the
/// Recently added strip.
export function modCard(mod, currentVersion, { when = null } = {}) {
  const summary = summaryToShow(mod);
  const updated = mod.lastReleaseDate
    ? { kind: 'updated', on: mod.lastReleaseDate }
    : null;
  return el('div', { class: 'mod-card' }, [
    el('a', { class: 'card-inner', href: modHref(mod.id) }, [
      // Overlay badges to leave more room for the card text.
      el('div', { class: 'card-picture' }, [
        cardImage(mod),
        el('div', { class: 'card-foot' }, [
          ...badges(mod, currentVersion),
          // How long ago the mod changed, at the right of the badges.
          when || updated ? whenLine(when || updated) : null,
        ]),
      ]),
      el('div', { class: 'card-body' }, [
        // The name and who made it are one thing, held closer together than
        // the card's other lines.
        el('div', { class: 'card-heading' }, [
          el('div', { class: 'card-title', text: modName(mod) }),
          (mod.authors || []).length
            ? el('div', { class: 'card-authors', text: joinNames(mod.authors) })
            : null,
        ]),
        summaryLine(summary),
        categoryLine(mod.categories),
      ]),
    ]),
    favoriteToggle(mod),
    // Under the card's link rather than on top of it: a download is the card's
    // main action, and a 28px circle over a screenshot is no place for it.
    downloadButton(mod),
  ]);
}

/// The same facts a card carries, laid out across the page: picture, name and
/// authors, summary, categories, then the badges and how long ago the mod
/// changed at the right.
export function modRows(mods, currentVersion) {
  const rows = el('div', { class: 'mod-rows' });
  for (const mod of mods) {
    const names = joinNames(mod.authors);
    rows.append(el('div', { class: 'mod-row' }, [
      el('a', { class: 'row-inner', href: modHref(mod.id) }, [
        cardImage(mod, 'row-thumb'),
        el('div', { class: 'row-main' }, [
          el('div', { class: 'row-heading' }, [
            el('span', { class: 'row-title', text: modName(mod) }),
            names ? el('span', { class: 'row-authors', text: names }) : null,
          ]),
          summaryLine(summaryToShow(mod)),
          categoryLine(mod.categories),
        ]),
        el('div', { class: 'row-side' }, [
          el('div', { class: 'row-badges' }, badges(mod, currentVersion)),
          mod.lastReleaseDate
            ? whenLine({ kind: 'updated', on: mod.lastReleaseDate })
            : null,
        ]),
      ]),
      favoriteToggle(mod),
      downloadButton(mod),
    ]));
  }
  return rows;
}

/// The picture on a card or row. A mod with none, and a mod whose picture will
/// not load, both get a plain box with the first letter of the name in it —
/// which tells the reader more than the words "no picture" did, and keeps the
/// grid even.
function cardImage(mod, className = 'card-image') {
  const initial = () => el('div', {
    class: `${className} placeholder`,
    text: (modName(mod).trim()[0] || '?').toUpperCase(),
    'aria-hidden': 'true',
  });
  const url = imageUrlOf(mod);
  if (!url) return initial();
  return picture(url, {
    className,
    whenBroken: (img) => img.replaceWith(initial()),
  });
}

function badges(mod, currentVersion) {
  const out = [];
  if (mod.modVersion) {
    out.push(el('span', {
      class: 'badge version', text: mod.modVersion,
      title: MOD_VERSION_NOTE,
    }));
  }
  if (mod.gameVersion) {
    const standing = versionStanding(mod, currentVersion);
    out.push(el('span', {
      class: `badge game ${standing || ''}`.trim(),
      text: mod.gameVersion,
      title: versionStandingNote(standing),
    }));
  }
  if (mod.isWorkInProgress) out.push(el('span', { class: 'badge wip', text: 'WIP' }));
  if (mod.isTool) {
    out.push(el('span', {
      class: 'badge tool', text: 'Tool',
      title: 'A separate program, such as a launcher or mod editor.',
    }));
  }
  if (isDiscordOnly(mod)) {
    out.push(el('span', {
      class: 'badge discord', text: 'Discord only',
      title: 'This mod was posted on Discord, not on the forum.',
    }));
  }
  return out;
}

// The icon on the date: a clock with an arrow running back round it,
// anticlockwise (Tabler's history shape, mirrored). The same icon whether the
// date is when the mod was updated or when it was added; the hover text says
// which.
const WHEN_ICON = '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" '
  + 'stroke="currentColor" stroke-width="2" stroke-linecap="round" '
  + 'stroke-linejoin="round" focusable="false" aria-hidden="true">'
  + '<path d="M12 8v4l2 2"/><path d="M20.95 11a9 9 0 1 0-.5 4m.5 5v-5h-5"/></svg>';
const WHEN_WORDS = { updated: 'Updated', added: 'Added' };

/// "3 days ago", with an icon saying what happened then. The word "Updated" or
/// "Added" is left to the icon and the hover text.
function whenLine({ kind, on }) {
  const ago = howLongAgo(on);
  if (!ago) return null;
  return el('span', {
    class: 'card-when',
    title: `${WHEN_WORDS[kind]} ${formatDay(on)}`,
  }, [
    el('span', { class: 'when-icon', html: WHEN_ICON }),
    ago[0].toUpperCase() + ago.slice(1),
  ]);
}

/// The mod's categories as one line of badges at the foot of a card. Those
/// that do not fit are folded into a "+2" badge, which names them on hover.
///
/// How much fits is only known once the card is on the page and laid out, and
/// changes with the page's width, so the line measures itself whenever its own
/// width changes.
function categoryLine(categories) {
  const names = categories || [];
  if (!names.length) return null;
  const chips = names.map((name) => el('span', { class: 'badge', text: name }));
  const more = el('span', { class: 'badge category-more', hidden: true });
  const line = el('div', { class: 'card-categories' }, [...chips, more]);
  quickTip(more, () => names.filter((_, i) => chips[i].hidden).join(', '));

  const fit = () => {
    for (const chip of chips) chip.hidden = false;
    more.hidden = true;
    const overflowing = () => line.scrollWidth > line.clientWidth;
    if (!overflowing()) return;
    more.hidden = false;
    // Always keep the first one: a lone "+3" says nothing at a glance.
    let shown = chips.length;
    do {
      chips[--shown].hidden = true;
      const hidden = names.slice(shown);
      more.textContent = `+${hidden.length}`;
      more.setAttribute('aria-label', `Also: ${hidden.join(', ')}`);
    } while (shown > 1 && overflowing());
  };
  new ResizeObserver(fit).observe(line);
  return line;
}

/// The summary on a card. An AI-written one is marked with a sparkle just
/// before the words, and a mod with no summary at all says so rather than
/// leaving a gap where every other card has a line.
function summaryLine(summary) {
  const generated = Boolean(summary?.generated);
  const words = el('div', {
    class: summary ? 'card-summary' : 'card-summary none',
    // The same words the sparkle carries, on the whole sentence: a reader is
    // far more likely to point at the words than at the star in front of them.
    // An author's own summary has no hover text.
    title: summaryTitle(summary),
  }, [
    generated ? aiSparkle(summary.text) : null,
    generated ? ' ' : null,
    summary?.text || NO_DESCRIPTION,
  ]);
  if (!generated) return words;
  fullAiSummaryOnHover(words, summary);
  return el('div', { class: 'summary-block' }, [words, aiSummaryNote()]);
}
