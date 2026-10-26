// Home: the mods added recently, the categories, then what came out recently.
//
// The release feed is the heart of the page. It is not "threads somebody
// replied to" — it is mods whose version actually moved forward, worked out by
// comparing saved copies of the data over time.

import {
  aiSummaryBanner, buildHash, categoryChips, clear, currentGameVersion, downloadButton, el,
  expandAllButton, formatDay,
  howLongAgo, imageUrlOf, modHref, modList, modName, noteWithMore,
  releaseFeed, thumbnail,
} from '../lib.js';
import {
  copyFiltersButton, filterControls, gameLabelsOf, homeFilters, matchesFilters, modCard,
  rememberedBrowseFilters, savedFilterInUse, savedFiltersMenu, setHomeFilters,
} from './browse.js';
import {
  describeFilters, filterQuery, filtersAreOff, filtersToAddress, noFilters, readFilters,
} from '../filter_set.js';

/// How many recently added mods are loaded into the strip. It shows whole rows
/// of them — one by default, up to three — so this only has to be enough to
/// fill three rows at the widest the page gets.
const RECENT_COUNT = 24;

/// How many rows the strip can be asked to show.
const ROW_CHOICES = [1, 2, 3];
const ROWS_KEY = 'starmodderRecentRows';

function recentRowsPreference() {
  const saved = Number(localStorage.getItem(ROWS_KEY));
  return ROW_CHOICES.includes(saved) ? saved : 1;
}

/// `filtersOpen` keeps the filter bar open when the page is drawn again from
/// inside it.
export async function render(root, parts, { filtersOpen = false } = {}) {
  const [list, feed] = await Promise.all([modList(), releaseFeed()]);
  const mods = list.mods || [];
  const releases = feed.releases || [];
  const byId = new Map(mods.map((mod) => [mod.id, mod]));
  const currentVersion = currentGameVersion(mods);

  // Browse's own state with an empty search, so Home filters by exactly
  // Browse's rules.
  const state = {
    search: '', author: '', ...readFilters(homeFilters(), currentVersion), currentVersion,
  };

  // The sections are drawn again on every change. The bar is drawn once, so
  // its controls keep their place and the keyboard stays where it was.
  const sections = el('div', { class: 'stack' });
  const drawSections = () => {
    sections.querySelector('.strip')?.fitRows?.disconnect();
    clear(sections);
    const off = filtersAreOff(state);
    const keep = (mod) => off || matchesFilters(mod, state);
    // Home's filters go along into Browse, the game version always.
    const linkFilters = filtersToAddress(state);
    sections.append(...[
      recentlyAdded(mods.filter(keep), currentVersion, linkFilters, !off),
      browseByCategory(off ? mods
        : mods.filter((mod) => matchesFilters(mod, { ...state, category: '' })),
      state.category, linkFilters, !off),
      releasesPanel(releases.filter((release) => {
        const mod = byId.get(release.modId);
        // A release whose mod is not on the list cannot be checked against
        // the filters, so it is only shown while nothing is filtered.
        return off || (mod && keep(mod));
      }), byId, releases.length > 0),
    ].filter(Boolean));
  };

  // The mods added recently first, then the categories and the releases.
  clear(root);
  root.append(el('div', { class: 'stack' }, [
    aiSummaryBanner(() => render(root)),
    filterBar(mods, state, currentVersion, filtersOpen, () => {
      setHomeFilters(filterQuery(state, currentVersion));
      drawSections();
    }, (open) => render(root, parts, { filtersOpen: open })),
    sections,
    feedLine(),
  ]));
  drawSections();
}

/// The bar near the top of Home, under the AI summaries banner, that holds its
/// filters. It always starts shut,
/// naming the filters that are on, or the saved filter they match.
///
/// `onChange` runs after a control changes `state`. `redraw` draws the whole
/// page again, for the changes that replace every filter at once: Clear, Copy
/// from Browse and picking a saved filter. None of them changes what Browse
/// remembers. It is given whether the bar is open, so the bar stays as it was.
function filterBar(mods, state, currentVersion, open, onChange, redraw) {
  const gameLabel = gameLabelsOf(mods);
  const words = el('span', { class: 'home-filters-words' });
  const clearAll = el('button', { type: 'button', class: 'link-button', text: 'Clear' });
  clearAll.addEventListener('click', (event) => {
    // The button sits in the bar's heading, which would open the bar too.
    event.preventDefault();
    setHomeFilters(filterQuery(noFilters(), currentVersion));
    redraw(bar.open);
  });
  const replaceWith = (query) => {
    setHomeFilters(filterQuery(readFilters(query, currentVersion), currentVersion));
    redraw(bar.open);
  };

  const current = () => filterQuery(state, currentVersion);
  const saved = savedFiltersMenu(current, replaceWith, currentVersion, { gameLabel });
  const drawWords = () => {
    const off = filtersAreOff(state);
    const match = off ? null : savedFilterInUse(current(), currentVersion);
    words.textContent = off ? '' : match ? match.name : describeFilters(state, gameLabel);
    clearAll.hidden = off;
  };
  const controls = filterControls(mods, state, () => {
    drawWords();
    saved.refresh();
    onChange();
  }, { categories: 'dropdown' });

  const copy = copyFiltersButton('Copy filters from Browse page',
    'Use Browse’s filters on Home. Browse’s filters stay the same.',
    () => replaceWith(rememberedBrowseFilters(currentVersion)));

  drawWords();
  const bar = el('details', { class: 'panel home-filters' }, [
    el('summary', { class: 'home-filters-head' }, [
      el('span', { class: 'home-filters-title' }, [
        el('span', { class: 'home-filters-icon', html: FILTER_ICON }), 'Filters',
      ]),
      words, clearAll,
    ]),
    el('div', { class: 'filters' }, [
      copy,
      controls.gameDropdown,
      controls.categoryDropdown,
      controls.requiresDropdown,
      controls.postedOnDropdown,
      controls.switches,
      controls.aiMenu,
      saved.node,
    ]),
  ]);
  bar.open = open;
  return bar;
}

// Tabler icon (MIT): filter.
const FILTER_ICON = tablerIcon('<path d="M4 4h16v2.172a2 2 0 0 1 -.586 1.414l-4.414 4.414'
  + 'v7l-6 2v-8.5l-4.48 -4.928a2 2 0 0 1 -.52 -1.345v-2.227z"/>');

function tablerIcon(paths) {
  return '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" '
    + 'stroke="currentColor" stroke-width="2" stroke-linecap="round" '
    + 'stroke-linejoin="round" focusable="false" aria-hidden="true">'
    + paths + '</svg>';
}

/// Said in place of a section whose every entry the filters hid, so an empty
/// section never looks like missing data.
function allHidden() {
  return el('p', { class: 'all-hidden', text: 'Everything is hidden by your filters.' });
}

/// Offers a feed subscription even before any releases have been recorded.
function feedLine() {
  return el('p', { class: 'feed-note' }, [
    el('a', { href: 'updates.xml', text: 'Subscribe to the release feed' }),
    el('span', { text: ' in your feed reader.' }),
  ]);
}

/// The categories, as a small table under the recently added mods. It is the
/// front door for a reader who does not know what they are looking for yet.
///
/// `mods` are the mods every filter but the category lets through, so each
/// count is what picking that category would show. `filtering` says whether
/// any filter is on.
function browseByCategory(mods, chosen, linkFilters, filtering) {
  const chips = categoryChips(mods, { chosen, linkParams: linkFilters });
  if (!chips && !filtering) return null;

  return el('section', { class: 'stack' }, [
    el('h2', { class: 'section-title', text: 'Browse by category' }),
    chips || allHidden(),
    el('a', { href: buildHash(['browse'], linkFilters), text: 'See all →' }),
  ]);
}

/// `releases` are the ones the filters let through. `anyRecorded` says
/// whether there were any before filtering.
function releasesPanel(releases, byId, anyRecorded) {
  const head = el('div', { class: 'section-head' }, [
    el('h2', { class: 'section-title', text: 'Recent updates' }),
  ]);
  const panel = el('div', { class: 'stack' }, [head]);

  if (!releases.length && anyRecorded) {
    panel.append(allHidden());
    return panel;
  }
  if (!releases.length) {
    panel.append(el('div', { class: 'notice' }, [
      el('h3', { text: 'No releases yet' }),
      el('p', {
        text: 'Nothing has put out a new version since this started keeping '
          + 'track. New releases turn up here as they happen.',
      }),
    ]));
    return panel;
  }

  // Only where there is a list to explain. The empty notice above says what is
  // going on well enough on its own.
  panel.append(releasesNote());

  for (const [day, ofThatDay] of groupByDay(releases)) {
    const list = el('div', { class: 'release-list' });
    for (const release of ofThatDay) list.append(releaseRow(release, byId));
    // A day sits inside "Recent updates", so it is a step down from it. An
    // h2 inside an h2 reads to a screen reader as two things of equal weight.
    panel.append(el('section', { class: 'release-day' }, [
      el('h3', { text: `${formatDay(day)} (${howLongAgo(day)})` }),
      list,
    ]));
  }

  const openAll = expandAllButton(panel, 'details.release:not(.no-notes)',
    { open: 'Show all changelogs', shut: 'Hide all changelogs' });
  if (openAll) head.append(openAll);
  return panel;
}

/// The note above the releases, saying where this list comes from and that it
/// can be wrong.
///
/// A dated list reads as a list of what came out that day, and this is not
/// that: it is what a program noticed, having read a version number out of a
/// forum post, which it sometimes reads wrong. An author checking whether
/// their own mod is listed right needs to know that before writing in to say
/// the site is broken.
///
/// The short version is on the page, because a reader who never presses
/// anything should still know the list can be wrong. The long version is
/// behind a press, because five paragraphs above every visit to the front
/// page is somebody else's page.
function releasesNote() {
  return noteWithMore(
    'Note: this list will contain mistakes. AI is used to read mod version numbers '
      + 'from forum post text; if the version is missing or unclear, it may mistake something else as the version.',
    {
      title: 'How recent updates work',
      moreLabel: 'More about this',
      paragraphs: [
        'The Starsector forum is checked twice a day. A mod appears here only '
          + 'when the version number in its forum post increases. Replies and '
          + 'other activity in the thread do not count.',
        'Only forum data is used for this. Version Checker is not.',
        'AI reads the version number from the author\'s post. It sometimes '
          + 'gets the number wrong. The same new version must appear in two '
          + 'checks in a row before it is listed. Versions older than the last '
          + 'confirmed version are also ignored.',
        'If the thread title includes a version, the version '
          + 'in the post must match it.',
        'The date shown is when this site confirmed the update. It may not be '
          + 'the date when the author released it.',
        'An older confirmed version is required before an update can be reported. '
          + 'This means the first version found for a mod is not listed. A '
          + 'mod without a version number in its post won\'t appear here.',
        'Changelog notes are copied from the author\'s post.',
      ],
    },
  );
}

/// One release. Where the post gave changelog notes for that version, the row
/// opens to show them as the author wrote them. The arrow at the left is what
/// says a row opens, so a row without notes does not get one.
function releaseRow(release, byId) {
  const notes = release.changelogNotes;
  const mod = byId.get(release.modId);
  const shownName = mod ? modName(mod) : release.modName;

  const summary = el('summary', {
    title: notes ? 'Read changelog' : null,
  }, [
    notes ? el('span', { class: 'chevron', text: '›', 'aria-hidden': 'true' }) : null,
    thumbnail(mod && imageUrlOf(mod), 'release-thumb'),
    mod
      ? el('a', { class: 'release-name', href: modHref(release.modId), text: shownName })
      : el('span', { class: 'release-name', text: shownName }),
    el('span', { class: 'badge version', text: release.newVersion }),
    release.oldVersion
      ? el('span', { class: 'release-versions', text: `was ${release.oldVersion}` })
      : null,
    release.gameVersion
      ? el('span', { class: 'badge game', text: release.gameVersion })
      : null,
    updateBadge(release),
    // The whole summary is the fold's own press area, so a download inside it
    // would open the changelog on a stray press. The button stops its own click
    // from reaching the fold, the same way the "+" on a card does.
    mod ? downloadButton(mod) : null,
  ]);

  const row = el('details', { class: notes ? 'release' : 'release no-notes' }, [summary]);
  if (notes) row.append(el('pre', { class: 'release-notes', text: notes }));
  return row;
}

/// What the author says about updating to this release, as a small badge with
/// their own words on hover. Only drawn where the post has a note for this
/// version and a plain answer was read off it.
function updateBadge(release) {
  const words = release.updateCompatibilityText;
  const kind = {
    yes: ['save-ok', 'Save compatible update'],
    no: ['save-no', 'Breaks existing saves'],
    depends: ['', 'Existing saves: it depends'],
  }[release.canUpdate];
  if (!words || !kind) return null;
  return el('span', {
    class: `badge ${kind[0]}`.trim(),
    text: kind[1],
    title: `The author says: ${words}`,
  });
}

/// The releases split into days, newest day first. The feed is already in that
/// order, so this only has to group.
function groupByDay(releases) {
  const days = new Map();
  for (const release of releases) {
    if (!days.has(release.seenOn)) days.set(release.seenOn, []);
    days.get(release.seenOn).push(release);
  }
  return [...days.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

/// A short strip of the mods added most recently, near the top of the page.
/// It is what keeps the page worth reading while the release feed is still
/// filling up.
///
/// `mods` are the mods the filters let through, so the strip is filtered
/// first and then cut to the newest. `filtering` says whether any filter is on.
function recentlyAdded(mods, currentVersion, linkFilters, filtering) {
  const newest = mods
    .filter((mod) => mod.addedOn)
    .sort((a, b) => b.addedOn.localeCompare(a.addedOn))
    .slice(0, RECENT_COUNT);

  if (!newest.length && !filtering) return null;

  const strip = el('div', { class: 'strip' });
  for (const mod of newest) {
    strip.append(modCard(mod, currentVersion, {
      when: { kind: 'added', on: mod.addedOn },
    }));
  }

  // The strip shows whole rows. How many cards make a row depends on how wide
  // the page is, so it is read off the grid itself, again whenever the page
  // changes width — a row and a half of cards looks like a mistake.
  let rows = recentRowsPreference();
  const fit = () => {
    const columns = getComputedStyle(strip).gridTemplateColumns.split(' ').length;
    const shown = columns * rows;
    [...strip.children].forEach((card, i) => { card.hidden = i >= shown; });
  };
  // Once as soon as the strip is on the page (the caller appends it right
  // after this returns), then again whenever its width changes. The observer
  // alone is not enough: it does not report until the page is next drawn,
  // which in a background tab can be a long while.
  setTimeout(fit, 0);
  strip.fitRows = new ResizeObserver(fit);
  strip.fitRows.observe(strip);

  // The picker beside the heading: "1 · 2 · 3 rows". Small on purpose — it is
  // a way to see a little more, not a feature of its own.
  const picker = el('span', { class: 'rows-pick', role: 'group', 'aria-label': 'How many rows to show' });
  const buttons = ROW_CHOICES.map((n) => {
    const button = el('button', {
      type: 'button', class: n === rows ? 'on' : '', text: String(n),
      'aria-pressed': n === rows ? 'true' : 'false',
      title: `Show ${n} row${n === 1 ? '' : 's'}`,
    });
    button.addEventListener('click', () => {
      rows = n;
      localStorage.setItem(ROWS_KEY, String(n));
      for (const b of buttons) {
        b.classList.toggle('on', b === button);
        b.setAttribute('aria-pressed', b === button ? 'true' : 'false');
      }
      fit();
    });
    return button;
  });
  picker.append(...buttons, el('span', { class: 'rows-word', text: 'rows' }));

  return el('section', { class: 'stack' }, [
    el('div', { class: 'section-head' }, [
      el('h2', { class: 'section-title', text: 'Recently added' }),
      picker,
    ]),
    newest.length ? strip : allHidden(),
    el('a', { href: buildHash(['browse'], { ...linkFilters, sort: 'newest' }), text: 'See all →' }),
  ]);
}
