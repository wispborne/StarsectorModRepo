// Browse: every mod, with search, filters and sorting.
//
// The whole mod list is fetched once and searched in the browser, which is why
// `mods.json` is kept small. What the reader is looking at — the search text,
// the filters, the sort order and the page — rides in the address, so a link to
// a filtered list brings back the same list.

import {
  aiSparkle, aiSummaryNote, breadcrumbs, buildHash, categoryChips, clear,
  countedAcross,
  currentGameVersion, downloadButton, downloadCountBadge, el, listToggle,
  everyOtherName, formatDay, gameVersionFamily, gameVersions, hashQuery, howLongAgo,
  isDiscordOnly, joinNames, modHref, modList, modName, MOD_VERSION_NOTE,
  noteScrollPlaced, NO_DESCRIPTION, pageScrollWhenLeft, pager,
  pageSizePreference, picture, replaceHash, summaryToShow, thumbnail,
  versionStanding, versionStandingNote,
} from '../lib.js';

const VIEW_KEY = 'starmodderView';

/// Where Browse was last scrolled to, so the back button from a mod page lands
/// where the reader left off rather than at the top.
const SCROLL_KEY = 'starmodderBrowseScroll';

/// The address Browse last wrote for itself. The scroll position is filed
/// against it — reading `location.hash` when the reader leaves would give the
/// mod page they are on their way to, not the list they are leaving.
let lastBrowseHash = '';

/// The switches, each a plain yes-or-no question about one field.
const SWITCHES = [
  {
    key: 'save',
    label: 'Save compatible',
    title: 'Only mods the author says can be added to a game already in progress.',
    keep: (mod) => mod.saveCompatible === true,
  },
  {
    key: 'download',
    label: 'Has a download',
    title: 'Only mods with a link that goes straight to a file.',
    keep: (mod) => mod.hasDirectDownload === true,
  },
  {
    key: 'source',
    label: 'Source is public',
    title: 'Only mods whose code is somewhere you can read it.',
    keep: (mod) => mod.sourceIsPublic === true,
  },
  {
    key: 'nowip',
    label: 'Hide works in progress',
    title: 'Leave out mods whose thread marks them as unfinished.',
    keep: (mod) => mod.isWorkInProgress !== true,
  },
];

const SORTS = [
  { key: 'current', label: 'Current version first' },
  { key: 'name', label: 'Name' },
  { key: 'newest', label: 'Newest' },
  { key: 'updated', label: 'Recently updated' },
];

export async function render(root, parts) {
  const list = await modList();
  const mods = list.mods || [];
  const currentVersion = currentGameVersion(mods);

  const query = hashQuery();
  const state = {
    search: query.get('q') || '',
    // The filter works on the number a game release shares, so a link saved
    // back when it held a full spelling ("0.98a") still finds the same mods.
    game: query.get('game') ? gameVersionFamily(query.get('game')) : '',
    needs: query.get('needs') || '',
    category: query.get('category') || '',
    author: query.get('author') || '',
    sort: SORTS.some((s) => s.key === query.get('sort')) ? query.get('sort') : 'current',
    switches: new Set((query.get('only') || '').split(',').filter(Boolean)),
    // Older mods are left out to begin with. Nineteen pages of A-to-Z over
    // every game release anyone ever built for is not a list anybody reads.
    olderToo: query.get('older') === '1',
    page: Math.max(0, Number(query.get('page')) || 0),
    pageSize: pageSizePreference(),
    view: localStorage.getItem(VIEW_KEY) === 'rows' ? 'rows' : 'grid',
    currentVersion,
  };

  clear(root);
  root.append(breadcrumbs([{ label: 'Browse mods' }]));

  const head = el('div', { class: 'page-head' }, [
    el('h1', { text: `Browse ${mods.length} mods` }),
  ]);
  const controls = el('div', { class: 'stack' });
  const results = el('div', { class: 'stack' });

  // The count is read out as it changes, so it has to be the same node from
  // one draw to the next. A new node arriving with its words already in it is
  // announced by nothing. It is made here, before anything draws, because a
  // `const` cannot be reached from a function that runs above it.
  const countLine = el('div', { class: 'result-line', role: 'status' });
  root.append(el('div', { class: 'stack' }, [head, controls, results]));

  // The controls are drawn once and left alone; only the results are redrawn as
  // the reader types, so the search box never loses what is in it or where the
  // cursor sits.
  drawControls(controls, mods, state, () => {
    state.page = 0;
    saveState(state);
    drawResults(results, mods, state);
  });
  drawResults(results, mods, state);
  restoreScroll();

  function saveState(shown) {
    lastBrowseHash = buildHash(['browse'], {
      q: shown.search,
      game: shown.game,
      needs: shown.needs,
      category: shown.category,
      author: shown.author,
      sort: shown.sort === 'current' ? '' : shown.sort,
      only: [...shown.switches].join(','),
      older: shown.olderToo ? '1' : '',
      page: shown.page || '',
    });
    replaceHash(lastBrowseHash);
  }

  function drawResults(into, all, shown) {
    saveState(shown);
    clear(into);

    const matches = sortMods(all.filter((mod) => matchesFilters(mod, shown)),
      shown.sort, shown.currentVersion);

    fillResultLine(countLine, all, matches, shown,
      () => { shown.olderToo = true; drawResults(into, all, shown); });
    into.append(countLine);

    if (!matches.length) {
      into.append(nothingMatched(() => {
        clearFilters(shown);
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

/// The line above the results: how many matched, and — when older mods are
/// being left out — how many those are and one click to bring them back.
///
/// It fills a line that is already on the page rather than making a new one,
/// because that is what gets it read out.
function fillResultLine(line, all, matches, state, onShowOlder) {
  clear(line);
  line.append(el('span', {
    text: matches.length === all.length
      ? `Showing all ${all.length} mods.`
      : `${matches.length} of ${all.length} mods match.`,
  }));

  // Nothing is being left out when older mods are already in, when there is no
  // current release to compare against, or when the reader picked a game
  // version themselves — their choice overrules the switch.
  if (state.olderToo || !state.currentVersion || state.game) return;

  const hidden = all.filter((mod) => !isForCurrentGame(mod, state.currentVersion)
    && matchesEverythingElse(mod, state)).length;
  if (!hidden) return;

  const button = el('button', {
    class: 'link-button',
    text: `Include ${hidden} for older game versions`,
  });
  button.addEventListener('click', onShowOlder);
  line.append(el('span', { text: ' ' }), button);
}

// --- The controls ---

function drawControls(into, mods, state, onChange) {
  // The chips are redrawn whenever anything else changes, because their counts
  // are of what picking that chip would really show. Counting the whole list
  // would have a chip read 182 and then hand back 104, since older game
  // versions are left out to begin with.
  const chips = el('div', {});
  const drawChips = () => {
    const wouldMatch = mods.filter(
        (mod) => matchesFilters(mod, { ...state, category: '' }));
    clear(chips).append(categoryChips(wouldMatch, {
      chosen: state.category,
      onPick: (picked) => { state.category = picked; changed(); },
    }));
  };
  const changed = () => {
    drawChips();
    onChange();
  };

  const search = el('input', {
    type: 'search',
    class: 'search-box',
    placeholder: 'Search names, authors, categories and descriptions…',
    value: state.search,
  });
  search.addEventListener('input', () => {
    state.search = search.value;
    changed();
  });

  const viewToggle = el('div', { class: 'view-toggle', role: 'group' });
  const gridBtn = el('button', { class: 'btn', text: 'Cards' });
  const rowsBtn = el('button', { class: 'btn', text: 'Rows' });
  const litView = () => {
    gridBtn.classList.toggle('on', state.view === 'grid');
    rowsBtn.classList.toggle('on', state.view === 'rows');
    gridBtn.setAttribute('aria-pressed', String(state.view === 'grid'));
    rowsBtn.setAttribute('aria-pressed', String(state.view === 'rows'));
  };
  const pickView = (which) => {
    state.view = which;
    localStorage.setItem(VIEW_KEY, which);
    litView();
    changed();
  };
  gridBtn.addEventListener('click', () => pickView('grid'));
  rowsBtn.addEventListener('click', () => pickView('rows'));
  litView();
  viewToggle.append(gridBtn, rowsBtn);

  into.append(el('div', { class: 'search-row' }, [search, viewToggle]));
  into.append(el('p', {
    class: 'search-hint',
    text: 'Several things at once: separate them with commas. Put a minus in '
      + 'front of one to leave those out — "faction, -portrait".',
  }));

  // The chips come before the dropdowns: picking a kind of mod is what most
  // readers want first, and a row you can see beats a list you have to open.
  drawChips();
  into.append(chips);

  const filters = el('div', { class: 'filters' });
  const versions = gameVersions(mods);
  const needed = neededMods(mods);
  filters.append(
    dropdown('Game version', versions.map((v) => v.family), state.game,
      (v) => { state.game = v; changed(); },
      {
        labels: Object.fromEntries(
          versions.map((v) => [v.family, `${v.label} (${v.count})`])),
      }),

    // Left out entirely until some mod says what it needs, so the page never
    // offers a filter that would find nothing.
    ...(needed.length
      ? [dropdown('Needs', needed, state.needs,
          (v) => { state.needs = v; changed(); },
          { anyLabel: 'Needs anything' })]
      : []),
    dropdown('Sort by', SORTS.map((s) => s.key), state.sort,
      (v) => { state.sort = v || 'current'; changed(); },
      { anyLabel: null, labels: Object.fromEntries(SORTS.map((s) => [s.key, s.label])) }),
  );

  const switches = el('div', { class: 'switches' });
  const addSwitch = (label, title, isOn, onToggle) => {
    const button = el('button', {
      class: isOn() ? 'btn on' : 'btn',
      text: label,
      title,
      'aria-pressed': String(isOn()),
    });
    button.addEventListener('click', () => {
      onToggle();
      button.classList.toggle('on', isOn());
      button.setAttribute('aria-pressed', String(isOn()));
      changed();
    });
    switches.append(button);
  };

  if (state.currentVersion) {
    const spelling =
      (versions.find((v) => v.family === state.currentVersion) || {}).label
      || state.currentVersion;
    addSwitch(
      `Current game version only (${spelling})`,
      'Leave out mods built for an older game release.',
      () => !state.olderToo,
      () => { state.olderToo = !state.olderToo; },
    );
  }
  for (const option of SWITCHES) {
    addSwitch(option.label, option.title,
      () => state.switches.has(option.key),
      () => {
        if (state.switches.has(option.key)) state.switches.delete(option.key);
        else state.switches.add(option.key);
      });
  }
  filters.append(switches);
  into.append(filters);
}

function dropdown(label, values, chosen, onPick, opts = {}) {
  const { anyLabel = `Any ${label.toLowerCase()}`, labels = {} } = opts;
  const select = el('select');
  if (anyLabel != null) select.append(el('option', { value: '', text: anyLabel }));
  for (const value of values) {
    select.append(el('option', { value, text: labels[value] || value }));
  }
  select.value = values.includes(chosen) ? chosen : (anyLabel != null ? '' : values[0]);
  select.addEventListener('change', () => onPick(select.value));
  return el('label', { class: 'filter-label' }, [
    el('span', { text: label }), select,
  ]);
}

/// Every mod that some other mod needs, most-needed first. It is a short list —
/// a handful of libraries and Nexerelin cover nearly all of it.
function neededMods(mods) {
  return countedAcross(mods, (mod) => (mod.needs || []).map((n) => n.name))
    .map(([name]) => name);
}

function clearFilters(state) {
  replaceHash(buildHash(['browse']));
  state.search = '';
  state.game = '';
  state.needs = '';
  state.category = '';
  state.author = '';
  state.switches.clear();
  state.olderToo = false;
  state.page = 0;
}

function nothingMatched(onClear) {
  const button = el('button', { class: 'btn btn-primary', text: 'Clear the filters' });
  button.addEventListener('click', onClear);
  return el('div', { class: 'notice' }, [
    el('h3', { text: 'No mods match' }),
    el('p', { text: 'Nothing here matches what you asked for. Try fewer words, '
      + 'or clear the filters and start again.' }),
    el('p', {}, [button]),
  ]);
}

/// Puts the page back where it was left. Browse is the page readers come back
/// to over and over, and landing at the top after every mod is what makes a
/// long list tiring.
///
/// The place is remembered against the address it was left at, so it is only
/// ever put back on the same list. A different search or filter is a different
/// list, and starts at the top.
///
/// The position comes from the router, which noted it before it emptied the
/// page — an emptied page has nowhere to scroll, so asking the browser
/// afterwards only ever gives zero.
function restoreScroll() {
  const remember = () => {
    sessionStorage.setItem(SCROLL_KEY, JSON.stringify({
      hash: lastBrowseHash, at: pageScrollWhenLeft(),
    }));
  };

  let saved = null;
  try {
    saved = JSON.parse(sessionStorage.getItem(SCROLL_KEY) || 'null');
  } catch {
    saved = null;
  }
  if (saved && saved.hash === lastBrowseHash && saved.at > 0) {
    window.scrollTo(0, saved.at);
    noteScrollPlaced();
  }

  window.addEventListener('hashchange', remember, { once: true });
}

// --- Searching, filtering and sorting ---

/// Splits what the reader typed into terms to look for and terms to leave out.
/// Commas separate them; a leading minus means "not this one".
export function readSearch(text) {
  const wanted = [];
  const unwanted = [];
  for (const raw of String(text || '').split(',')) {
    const term = raw.trim().toLowerCase();
    if (!term) continue;
    if (term.startsWith('-')) {
      const without = term.slice(1).trim();
      if (without) unwanted.push(without);
    } else {
      wanted.push(term);
    }
  }
  return { wanted, unwanted };
}

/// Everything about a mod that a search looks at: its name as shown and as the
/// thread wrote it, the people credited and the other names they go by, its
/// categories and its description.
export function searchableText(mod) {
  return [
    mod.name,
    mod.displayName,
    ...(mod.authors || []),
    ...everyOtherName(mod),
    ...(mod.categories || []),
    mod.summary,
  ].filter(Boolean).join(' ').toLowerCase();
}

/// True when a mod should be listed. Every term the reader typed has to match,
/// and any term with a minus in front of it must not.
export function matchesSearch(mod, text) {
  const { wanted, unwanted } = readSearch(text);
  if (!wanted.length && !unwanted.length) return true;
  const haystack = searchableText(mod);
  return wanted.every((term) => haystack.includes(term))
    && !unwanted.some((term) => haystack.includes(term));
}

/// True when a mod is built for the game release the site treats as current.
/// A mod that does not say which release it is for is kept — an unknown version
/// is not the same as an old one.
export function isForCurrentGame(mod, currentVersion) {
  if (!currentVersion || !mod.gameVersion) return true;
  return gameVersionFamily(mod.gameVersion) === currentVersion;
}

/// Everything the filters ask except the current-game-version one. It is what
/// counts how many mods that one switch is hiding.
function matchesEverythingElse(mod, state) {
  if (!matchesSearch(mod, state.search)) return false;
  if (state.game && gameVersionFamily(mod.gameVersion) !== state.game) return false;
  if (state.category && !(mod.categories || []).includes(state.category)) return false;
  if (state.needs
      && !(mod.needs || []).some((n) => n.name === state.needs)) return false;
  if (state.author && !(mod.authors || []).includes(state.author)) return false;
  for (const option of SWITCHES) {
    if (state.switches.has(option.key) && !option.keep(mod)) return false;
  }
  return true;
}

export function matchesFilters(mod, state) {
  if (!matchesEverythingElse(mod, state)) return false;
  // The reader's own choice of game version is the stronger one: picking an
  // older release from the dropdown must not then be overruled by the switch.
  if (!state.olderToo && !state.game
      && !isForCurrentGame(mod, state.currentVersion)) {
    return false;
  }
  return true;
}

export function sortMods(mods, sort, currentVersion) {
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
  if (sort === 'newest') sorted.sort(newestFirst((m) => m.addedOn));
  else if (sort === 'updated') sorted.sort(newestFirst((m) => m.lastReleaseDate));
  else if (sort === 'name') sorted.sort(byName);
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

// --- Drawing the mods ---

export function modGrid(mods, currentVersion) {
  const grid = el('div', { class: 'mod-grid' });
  for (const mod of mods) grid.append(modCard(mod, currentVersion));
  return grid;
}

/// One mod's card.
///
/// The card is a box holding a link that fills it, rather than being a link
/// itself, so the "add to my list" button can sit on top without being a button
/// inside a link — which is not allowed and which browsers handle differently.
/// One mod as a card. [when] replaces the card's usual "Updated …" line — the
/// Recently added strip is about when a mod turned up, not when it last moved.
export function modCard(mod, currentVersion, { when = null } = {}) {
  const summary = summaryToShow(mod);
  const updated = mod.lastReleaseDate
    ? { text: `Updated ${howLongAgo(mod.lastReleaseDate)}`, on: mod.lastReleaseDate }
    : null;
  const whenLine = when || updated;
  return el('div', { class: 'mod-card' }, [
    el('a', { class: 'card-inner', href: modHref(mod.id) }, [
      cardImage(mod),
      el('div', { class: 'card-body' }, [
        el('div', { class: 'card-title', text: modName(mod) }),
        (mod.authors || []).length
          ? el('div', { class: 'card-authors', text: joinNames(mod.authors) })
          : null,
        summaryLine(mod, summary),
        whenLine
          ? el('div', {
              class: 'card-when',
              text: whenLine.text,
              title: whenLine.on ? formatDay(whenLine.on) : null,
            })
          : null,
        el('div', { class: 'card-foot' }, badges(mod, currentVersion)),
      ]),
    ]),
    listToggle(mod),
    // Under the card's link rather than on top of it: a download is the card's
    // main action, and a 28px circle over a screenshot is no place for it.
    downloadButton(mod),
  ]);
}

export function modRows(mods, currentVersion) {
  const rows = el('div', { class: 'mod-rows' });
  for (const mod of mods) {
    const summary = summaryToShow(mod);
    const generated = Boolean(summary) && Boolean(mod.summaryIsGenerated);
    const names = joinNames(mod.authors);
    rows.append(el('div', { class: 'mod-row' }, [
      el('a', { class: 'row-inner', href: modHref(mod.id) }, [
        thumbnail(mod.imageUrl, 'row-thumb'),
        el('div', { class: 'row-main' }, [
          el('div', { class: 'row-title', text: modName(mod) }),
          el('div', { class: 'row-sub' }, [
            names ? `${names} — ` : null,
            generated ? aiSparkle() : null,
            generated ? ' ' : null,
            summary || NO_DESCRIPTION,
          ]),
        ]),
        el('div', { class: 'row-side' }, badges(mod, currentVersion)),
      ]),
      listToggle(mod),
      downloadButton(mod),
    ]));
  }
  return rows;
}

/// The picture on a card. A mod with none, and a mod whose picture will not
/// load, both get a plain box with the first letter of the name in it — which
/// tells the reader more than the words "no picture" did, and keeps the grid
/// even.
function cardImage(mod) {
  const initial = () => el('div', {
    class: 'card-image placeholder',
    text: (modName(mod).trim()[0] || '?').toUpperCase(),
    'aria-hidden': 'true',
  });
  if (!mod.imageUrl) return initial();
  return picture(mod.imageUrl, {
    className: 'card-image',
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
  if (mod.saveCompatible === true) {
    out.push(el('span', {
      class: 'badge save-ok', text: 'Save Compat',
      title: 'The author says this can be added to a game already in progress.',
    }));
  } else if (mod.saveCompatible === false) {
    out.push(el('span', {
      class: 'badge save-no', text: 'New game',
      title: 'The author says this needs a new game.',
    }));
  }
  const downloads = downloadCountBadge(mod);
  if (downloads) out.push(downloads);
  if (isDiscordOnly(mod)) {
    out.push(el('span', {
      class: 'badge discord', text: 'Discord only',
      title: 'This mod was posted on Discord, not on the forum.',
    }));
  }
  return out;
}

/// The summary on a card. An AI-written one is marked with a sparkle just
/// before the words, and a mod with no summary at all says so rather than
/// leaving a gap where every other card has a line.
function summaryLine(mod, summary) {
  const generated = Boolean(summary) && Boolean(mod.summaryIsGenerated);
  const words = el('div', {
    class: summary ? 'card-summary' : 'card-summary none',
  }, [
    generated ? aiSparkle() : null,
    generated ? ' ' : null,
    summary || NO_DESCRIPTION,
  ]);
  if (!generated) return words;
  return el('div', { class: 'summary-block' }, [words, aiSummaryNote()]);
}
