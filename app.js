// The router. Every page has its own address, so a link to a mod, an author or
// a filtered list can be shared and comes back the same.
//
// Nothing here talks to a server. Every view draws itself from the published
// files, fetched off this site's own origin.

import {
  aiSummaryMode, buildHash, clear, el, errorPanel, formatDay,
  formatMoment, applySpacing, go, hashParts, imageChoice, imageUrlOf, loading,
  modHref, modList, modName, myList,
  preparePageScroll, restorePageScroll, searchHelpField, setAiSummaryMode,
  setImageChoice,
  setSpacingPreference, spacingPreference,
  thumbnail, watchMyList,
} from './lib.js';
import { scoreOfTerm } from './search.js';
import * as home from './views/home.js';
import * as browse from './views/browse.js';
import * as mod from './views/mod.js';
import * as author from './views/author.js';
import * as about from './views/about.js';
import * as list from './views/list.js';

/// Where this site's code lives. The commit in the footer links into it, so
/// a bug report can name the exact build.
const REPO_URL = 'https://github.com/wispborne/Mod_Repo_Scraper';

const NAV = [
  { route: 'home', label: 'Home' },
  { route: 'browse', label: 'Browse mods' },
  { route: 'authors', label: 'People' },
  { route: 'list', label: 'My list' },
  { route: 'about', label: 'About' },
];

const ROUTES = {
  home: (root, parts) => home.render(root, parts),
  browse: (root, parts) => browse.render(root, parts),
  mods: (root, parts) => mod.render(root, parts),
  authors: (root, parts) => author.render(root, parts),
  about: (root, parts) => about.render(root, parts),
  list: (root, parts) => list.render(root, parts),
};

/// How many mods the search box suggests as you type.
const SUGGESTION_COUNT = 5;

/// How many people it suggests alongside them.
const PEOPLE_SUGGESTION_COUNT = 3;

/// Drops the last nav's watch on the list, so redrawing the nav on every page
/// does not leave a pile of them all writing into elements that have gone.
let stopWatchingList = null;

function renderNav(viewId) {
  const nav = document.getElementById('nav');
  clear(nav);
  if (stopWatchingList) stopWatchingList();
  stopWatchingList = null;

  for (const item of NAV) {
    const link = el('a', {
      href: `#/${item.route}`,
      class: item.route === viewId ? 'active' : '',
      text: item.label,
    });
    // How many mods are in the reader's list, so they can see one is building
    // up without going to look.
    if (item.route === 'list') {
      const count = el('span', { class: 'nav-count' });
      const draw = (ids) => {
        count.textContent = ids.length ? String(ids.length) : '';
        count.hidden = !ids.length;
      };
      draw(myList());
      stopWatchingList = watchMyList(draw);
      link.append(count);
    }
    nav.append(link);
  }
}

async function route() {
  // Before anything is cleared, so the view being left can still find out where
  // its reader had got to.
  const savedScroll = preparePageScroll(location.hash || '#/home');

  const parts = hashParts();
  const viewId = parts[0] || 'home';
  renderNav(viewId);
  document.title = 'Starmodder 4: Starsector mods';

  const root = document.getElementById('app');
  clear(root).append(loading());

  const handler = ROUTES[viewId];
  if (!handler) {
    clear(root).append(errorPanel(new Error(`There is no page called "${viewId}".`)));
    window.scrollTo(0, 0);
    return;
  }
  try {
    await handler(root, parts.slice(1));
  } catch (err) {
    clear(root).append(errorPanel(err));
    console.error(err);
  }

  // A new page starts at its top, unless it was just put back where the reader
  // left it. Without this, going from the foot of Home to Browse lands halfway
  // down Browse.
  //
  // It happens after the page is drawn, not before, so the reader does not see
  // the old page jump while the new one loads.
  if (!restorePageScroll(savedScroll)) window.scrollTo(0, 0);
}

/// Says when the data on show was last collected. It is on every page, at the
/// foot, so a reader can tell at a glance how fresh what they are reading is.
async function showFreshness() {
  const line = document.getElementById('freshness');
  if (!line) return;
  try {
    const list = await modList();
    if (!list || !list.generatedAt) return;
    line.textContent = `Data collected ${formatMoment(list.generatedAt)}`;
    line.title = new Date(list.generatedAt).toString();
  } catch {
    // If the data would not load, the page itself already says so.
  }
}

/// Says which build of the site this is: a number that goes up by one with
/// every commit, the commit itself, and the day it was made. It is next to the
/// "data collected" line at the foot, because both are things a reader only
/// wants when something looks wrong — and the commit is the one thing that
/// makes a bug report answerable.
///
/// `version.json` is written by the release workflow, so it is only there in a
/// published copy of the site. Run straight from the repo there is no such
/// file, the fetch fails, and the footer simply carries no version line.
///
/// It is fetched by hand rather than through `data()` because it is part of
/// the site, not part of the published data: `?data=sample` must not send it
/// looking in `sample-data/`, where it would never be.
async function showBuild() {
  const line = document.getElementById('build');
  if (!line) return;
  try {
    const res = await fetch('./version.json', { credentials: 'omit' });
    if (!res.ok) return;
    const build = await res.json();
    if (!build || !build.commit) return;

    const commit = el('a', {
      text: build.commit,
      href: `${REPO_URL}/commit/${build.commit}`,
      rel: 'nofollow noopener',
    });
    line.replaceChildren(`v${build.build} · `, commit, ` · ${build.date}`);
    line.title = `Built from commit ${build.commit} on ${formatDay(build.date)}.`;
  } catch {
    // No version file, or one that would not read. Not worth a word on screen.
  }
}

/// The settings dialog, opened from the bar at the top. It holds the choices
/// that are about the reader rather than about any one page: how much room
/// there is between things, which of a mod's two pictures to show, and whether
/// AI-written summaries are shown at all. Each choice takes effect the moment
/// it is ticked — there is no Save button to find. Changing the pictures or
/// the summaries choice redraws the page underneath, so everything on it
/// changes at once rather than on the next click.
function mountSettings() {
  const open = document.getElementById('open-settings');
  const dialog = document.getElementById('settings');
  if (!open || !dialog) return;
  const close = dialog.querySelector('.settings-close');
  const radios = [...dialog.querySelectorAll('input[name="spacing"]')];
  const aiRadios = [...dialog.querySelectorAll('input[name="ai-summaries"]')];
  const pictureRadios =
    [...dialog.querySelectorAll('input[name="mod-pictures"]')];

  applySpacing();
  open.addEventListener('click', () => {
    const current = spacingPreference();
    for (const radio of radios) radio.checked = radio.value === current;
    const ai = aiSummaryMode();
    for (const radio of aiRadios) radio.checked = radio.value === ai;
    const picture = imageChoice();
    for (const radio of pictureRadios) radio.checked = radio.value === picture;
    dialog.showModal();
  });
  close.addEventListener('click', () => dialog.close());
  // A click on the dimmed page behind the box closes it, as people expect.
  // The box itself is the dialog's one child, so a click on the dialog
  // element and nowhere inside that child is a click on the backdrop.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  for (const radio of radios) {
    radio.addEventListener('change', () => {
      if (radio.checked) setSpacingPreference(radio.value);
    });
  }
  for (const radio of aiRadios) {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      setAiSummaryMode(radio.value);
      route();
    });
  }
  for (const radio of pictureRadios) {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      setImageChoice(radio.value);
      route();
    });
  }
}

/// The search box in the bar at the top, on every page.
///
/// Someone reading one mod's page who wants another used to have to go back to
/// Home or Browse first. Typing here suggests the five best-matching names
/// straight away — the whole mod list is already loaded, so it costs nothing —
/// and Enter opens the first suggestion unless the reader chose another with
/// the arrow keys. A search with no suggestions goes to Browse.
function mountHeaderSearch() {
  const box = document.getElementById('site-search');
  const drop = document.getElementById('search-suggestions');
  if (!box || !drop) return;

  // The panel saying what the search understands, in the room the suggested
  // mods use once there is something to suggest. The holder is noted first
  // because building the field takes the box out of it.
  const holder = box.parentNode;
  holder.insertBefore(searchHelpField(box, { hideWhileTyping: true }), drop);

  let mods = [];
  modList().then((list) => { mods = list.mods || []; }).catch(() => {});

  let activeIndex = -1;
  const suggestionRows = () => [...drop.querySelectorAll('.suggestion')];
  const setActive = (index) => {
    const rows = suggestionRows();
    if (!rows.length) {
      activeIndex = -1;
      box.removeAttribute('aria-activedescendant');
      return;
    }

    activeIndex = (index + rows.length) % rows.length;
    rows.forEach((row, i) => {
      row.setAttribute('aria-selected', i === activeIndex ? 'true' : 'false');
    });
    const active = rows[activeIndex];
    box.setAttribute('aria-activedescendant', active.id);
    active.scrollIntoView({ block: 'nearest' });
  };
  const prepareSuggestions = () => {
    suggestionRows().forEach((row, i) => {
      row.id = `search-suggestion-${i}`;
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', 'false');
      row.addEventListener('mouseenter', () => setActive(i));
    });
    activeIndex = -1;
    box.removeAttribute('aria-activedescendant');
  };
  const hide = () => {
    clear(drop);
    drop.hidden = true;
    box.setAttribute('aria-expanded', 'false');
    activeIndex = -1;
    box.removeAttribute('aria-activedescendant');
  };
  const search = () => {
    hide();
    box.blur();
    go(buildHash(['browse'], { q: box.value.trim() }));
  };

  box.addEventListener('input', () => {
    const wanted = box.value.trim().toLowerCase();
    clear(drop);
    if (wanted.length < 2) { hide(); return; }

    const hits = mods
      .filter((m) => matchStrength(m, wanted) > 0)
      .sort((a, b) => matchStrength(b, wanted) - matchStrength(a, wanted)
        || modName(a).localeCompare(modName(b)))
      .slice(0, SUGGESTION_COUNT);
    const people = peopleMatching(mods, wanted);

    if (!hits.length && !people.length) { hide(); return; }
    if (hits.length) {
      drop.append(el('div', { class: 'suggestion-group', text: 'Mods' }));
      for (const hit of hits) drop.append(suggestion(hit, hide));
    }
    if (people.length) {
      drop.append(el('div', { class: 'suggestion-group', text: 'People' }));
      for (const person of people) drop.append(personSuggestion(person, hide));
    }
    prepareSuggestions();
    drop.hidden = false;
    box.setAttribute('aria-expanded', 'true');
  });

  box.addEventListener('keydown', (e) => {
    const rows = suggestionRows();
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && rows.length) {
      e.preventDefault();
      const firstMove = e.key === 'ArrowDown' ? 0 : rows.length - 1;
      const next = activeIndex < 0
        ? firstMove
        : activeIndex + (e.key === 'ArrowDown' ? 1 : -1);
      setActive(next);
      return;
    }
    if (e.key === 'Enter') {
      const chosen = rows[activeIndex >= 0 ? activeIndex : 0];
      if (chosen) {
        e.preventDefault();
        chosen.click();
      } else {
        search();
      }
    }
    if (e.key === 'Escape') { hide(); box.blur(); }
  });
  box.addEventListener('blur', () => {
    // Late enough for a click on a suggestion to land first.
    setTimeout(hide, 150);
  });

  // "/" puts the cursor in the search box, wherever the reader is on the page,
  // unless they are already typing into something.
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
    const inField = /^(input|textarea|select)$/i.test(e.target.tagName || '');
    if (inField || e.target.isContentEditable) return;
    e.preventDefault();
    box.focus();
    box.select();
  });
}

/// One suggested mod under the search box.
function suggestion(hit, hide) {
  const row = el('a', { class: 'suggestion', href: modHref(hit.id) }, [
    thumbnail(imageUrlOf(hit), 'suggestion-thumb'),
    el('div', { class: 'suggestion-main' }, [
      el('div', { class: 'suggestion-name', text: modName(hit) }),
      (hit.authors || []).length
        ? el('div', { class: 'suggestion-by', text: hit.authors.join(', ') })
        : null,
    ]),
  ]);
  row.addEventListener('click', hide);
  return row;
}

/// The people whose name holds what has been typed, with how many mods each
/// has. Search already covers authors, so this is only to save the reader
/// working out that a name is a person rather than a mod.
function peopleMatching(mods, wanted) {
  const counts = new Map();
  for (const mod of mods) {
    for (const name of mod.authors || []) {
      if (!name.toLowerCase().includes(wanted)) continue;
      const key = name.toLowerCase();
      if (!counts.has(key)) counts.set(key, { name, count: 0 });
      counts.get(key).count += 1;
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, PEOPLE_SUGGESTION_COUNT);
}

/// One suggested person under the search box.
function personSuggestion(person, hide) {
  const row = el('a', {
    class: 'suggestion',
    href: `#/authors/${encodeURIComponent(person.name)}`,
  }, [
    el('div', { class: 'suggestion-thumb person-thumb', 'aria-hidden': 'true' }),
    el('div', { class: 'suggestion-main' }, [
      el('div', { class: 'suggestion-name', text: person.name }),
      el('div', {
        class: 'suggestion-by',
        text: `${person.count} mod${person.count === 1 ? '' : 's'}`,
      }),
    ]),
  ]);
  row.addEventListener('click', hide);
  return row;
}

/// How well a mod answers what has been typed, for putting the suggestions in
/// order. The same scoring the browse page's "Best match" uses, so the two
/// never disagree about which mod answers best.
function matchStrength(mod, wanted) {
  return scoreOfTerm(mod, wanted);
}

/// The skip link at the very top, for anyone moving through the page by
/// keyboard. It cannot be a plain `#app` link — the address bar's hash is what
/// picks the page, so following one would send the router looking for a page
/// called "app".
function mountSkipLink() {
  const link = document.querySelector('.skip-link');
  const main = document.getElementById('app');
  if (!link || !main) return;
  link.addEventListener('click', (e) => {
    e.preventDefault();
    main.focus();
    main.scrollIntoView();
  });
}

window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', () => {
  mountSettings();
  mountHeaderSearch();
  mountSkipLink();
  showFreshness();
  showBuild();
  if (!location.hash) location.hash = '#/home';
  else route();
});
