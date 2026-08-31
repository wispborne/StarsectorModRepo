// Home: a search box, the mods added recently, the kinds of mod, then what
// came out recently.
//
// The release feed is the heart of the page. It is not "threads somebody
// replied to" — it is mods whose version actually moved forward, worked out by
// comparing saved copies of the data over time.

import {
  buildHash, categoryChips, clear, currentGameVersion, downloadButton, el,
  formatDay, go,
  howLongAgo, imageUrlOf, modHref, modList, modName, noteWithMore,
  releaseFeed, searchHelpField, thumbnail,
} from '../lib.js';
import { modCard } from './browse.js';

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

export async function render(root) {
  const [list, feed] = await Promise.all([modList(), releaseFeed()]);
  const mods = list.mods || [];
  const releases = feed.releases || [];
  const byId = new Map(mods.map((mod) => [mod.id, mod]));
  const currentVersion = currentGameVersion(mods);

  // The search box first, then the mods added recently, then the kinds of mod
  // and the releases.
  clear(root);
  root.append(el('div', { class: 'stack' }, [
    front(),
    recentlyAdded(mods, currentVersion),
    browseByKind(mods),
    releasesPanel(releases, byId),
    feedLine(),
  ]));
}

/// The front of the site: a search box.
///
/// A reader arriving here has one of two things in mind — a mod they can name,
/// or no idea yet. The search box answers the first and the rest of the page
/// answers the second, so between them they cover everybody who arrives.
function front() {
  const box = el('input', {
    type: 'search',
    class: 'search-box',
    placeholder: 'Search for a mod, a person or a kind of mod…',
    'aria-label': 'Search mods',
  });
  const button = el('button', { class: 'btn btn-primary', text: 'Search' });
  const search = () => go(buildHash(['browse'], { q: box.value }));

  box.addEventListener('keydown', (e) => { if (e.key === 'Enter') search(); });
  button.addEventListener('click', search);

  return el('section', { class: 'front' }, [
    el('div', { class: 'search-row' }, [searchHelpField(box), button]),
    el('p', {
      class: 'front-hint',
      text: 'Or press / from anywhere on the site.',
    }),
  ]);
}

/// The line offering the release feed. Feed readers are where a lot of modders
/// and server admins actually live, so this is the one way somebody hears about
/// a release without coming back to look. It is on the page whether or not
/// anything has been released yet — that is exactly when subscribing helps.
function feedLine() {
  return el('p', { class: 'feed-note' }, [
    el('span', { text: 'Would rather be told? ' }),
    el('a', { href: 'updates.xml', text: 'Subscribe to the release feed' }),
    el('span', { text: ' in any feed reader.' }),
  ]);
}

/// The categories, as a row of chips, right under the search box. It is the
/// front door for a reader who does not know what they are looking for yet.
function browseByKind(mods) {
  const chips = categoryChips(mods);
  if (!chips) return null;

  return el('section', { class: 'stack' }, [
    el('h2', { class: 'quiet-heading', text: 'Browse by kind' }),
    chips,
  ]);
}

function releasesPanel(releases, byId) {
  const head = el('div', { class: 'section-head' }, [
    el('h2', { class: 'quiet-heading', text: 'Recent updates' }),
  ]);
  const panel = el('div', { class: 'stack' }, [head]);

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

  const openAll = expandAllChangelogs(panel);
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
        'An older confirmed version is needed before an update can be reported. '
          + 'This means the first version found for a mod is not listed. A '
          + 'mod without a version number in its post won\'t appear here.',
        'Changelog notes are copied from the author\'s post.',
      ],
    },
  );
}

/// One button beside the heading that opens every changelog on the page, and
/// closes them all again once they are open.
///
/// Reading down a day of releases means clicking every row in turn, and there
/// is no way back short of clicking each one again. The label says what a press
/// would do, so nobody has to guess which way it goes.
///
/// Returns null when no release on the page has notes — a button that would do
/// nothing is worse than no button.
function expandAllChangelogs(panel) {
  const foldsIn = () => [...panel.querySelectorAll('details.release:not(.no-notes)')];
  if (!foldsIn().length) return null;

  const button = el('button', {
    type: 'button',
    class: 'expand-all',
  });

  // Read off the page every time rather than kept in a variable: rows are also
  // opened one at a time, and a button that thinks it knows better tells the
  // reader the wrong thing.
  const relabel = () => {
    const folds = foldsIn();
    const allOpen = folds.length > 0 && folds.every((fold) => fold.open);
    button.textContent = allOpen ? 'Hide all changelogs' : 'Show all changelogs';
    button.setAttribute('aria-expanded', allOpen ? 'true' : 'false');
  };

  button.addEventListener('click', () => {
    const folds = foldsIn();
    const open = !folds.every((fold) => fold.open);
    for (const fold of folds) fold.open = open;
    relabel();
  });

  // A fold's own `toggle` event does not travel up the page, so it is caught on
  // the way down instead. Without this, opening the last shut row by hand would
  // leave the button still offering to show them all.
  panel.addEventListener('toggle', relabel, true);

  relabel();
  return button;
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
    // The whole summary is the fold's own press area, so a download inside it
    // would open the changelog on a stray press. The button stops its own click
    // from reaching the fold, the same way the "+" on a card does.
    mod ? downloadButton(mod) : null,
  ]);

  const row = el('details', { class: notes ? 'release' : 'release no-notes' }, [summary]);
  if (notes) row.append(el('pre', { class: 'release-notes', text: notes }));
  return row;
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
function recentlyAdded(mods, currentVersion) {
  const newest = mods
    .filter((mod) => mod.addedOn)
    .sort((a, b) => b.addedOn.localeCompare(a.addedOn))
    .slice(0, RECENT_COUNT);

  if (!newest.length) return null;

  const strip = el('div', { class: 'strip' });
  for (const mod of newest) {
    strip.append(modCard(mod, currentVersion, {
      when: { text: `Added ${howLongAgo(mod.addedOn)}`, on: mod.addedOn },
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
      el('h2', { class: 'quiet-heading', text: 'Recently added' }),
      picker,
    ]),
    strip,
    el('a', { href: buildHash(['browse'], { sort: 'newest' }), text: 'See all →' }),
  ]);
}
