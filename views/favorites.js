// The mods a reader has favorited, and a link that shares them.
//
// Favorites are kept in the reader's own browser. Sharing puts every id in the
// address, so a shared list needs no account and no server.
//
// The page shows one of two things and says which: the reader's own favorites,
// or somebody else's that they followed a link to.
//
// The mods are drawn with Browse's own cards and rows, so a mod looks the same
// here as everywhere else, and its ☆ is how it comes off the list.

import {
  breadcrumbs, clear, currentGameVersion, el, favorites, favoritesHref, go,
  hashQuery, modList, setFavorites, viewToggle, watchFavorites,
} from '../lib.js';
import { modGrid, modRows } from './browse.js';

/// Cards or rows. Kept apart from Browse's choice: a short list of favorites
/// and a list of a thousand mods are read differently.
const VIEW_KEY = 'starmodderFavoritesView';

/// What was there before "Clear all" was pressed, so the page can offer to put
/// it back. Held only until the page is drawn again.
let clearedIds = null;

/// The watch on the reader's favorites, so unstarring a mod takes it off the
/// page. Only one is ever held, and it lets go once the reader leaves.
let stopWatching = null;

/// Rows unless the reader picked cards: a list of favorites is something to
/// scan and download from, and rows show more of it at once.
function savedView() {
  try {
    return localStorage.getItem(VIEW_KEY) === 'grid' ? 'grid' : 'rows';
  } catch {
    return 'rows';
  }
}

function saveView(which) {
  try { localStorage.setItem(VIEW_KEY, which); } catch { /* still works, just not kept */ }
}

export async function render(root) {
  const shared = (hashQuery().get('ids') || '').split(',').filter(Boolean);
  const mine = !shared.length;
  const ids = mine ? favorites() : shared;

  const list = await modList();
  const all = list.mods || [];
  const byId = new Map(all.map((mod) => [mod.id, mod]));
  const currentVersion = currentGameVersion(all);

  // Every change redraws the whole page from storage, so the list, the count
  // and what the list still requires can never disagree. The reader stays where
  // they were scrolled to.
  const redraw = () => {
    const at = window.scrollY;
    render(root).then(() => window.scrollTo(0, at));
  };

  if (stopWatching) stopWatching();
  stopWatching = null;
  if (mine) {
    const route = location.hash;
    stopWatching = watchFavorites(() => {
      // Left this page: let go rather than redraw some other page.
      if (location.hash !== route || !root.isConnected) {
        if (stopWatching) stopWatching();
        stopWatching = null;
        return;
      }
      redraw();
    });
  }

  // A list can name a mod that has since been taken down. Saying so is better
  // than quietly dropping it and leaving the reader to wonder.
  const found = ids.map((id) => byId.get(id)).filter(Boolean);
  const missing = ids.filter((id) => !byId.has(id));

  document.title = mine ? 'Favorites | Starmodder' : 'Shared favorites | Starmodder';
  clear(root);
  root.append(breadcrumbs([{ label: mine ? 'Favorites' : 'Shared favorites' }]));

  const undo = mine ? undoClearLine() : null;
  clearedIds = null;

  // The heading says which list this is, so it says it once and stops there.
  const title = el('h1', { text: mine ? 'Favorites' : 'Shared favorites' });

  if (!ids.length) {
    root.append(el('div', { class: 'stack' }, [
      el('div', { class: 'page-head' }, [title]),
      undo,
      nothingYet(),
    ]));
    return;
  }

  let view = savedView();
  const lists = el('div', { class: 'stack' });
  const drawLists = () => {
    clear(lists);
    lists.append(drawMods(found, view, currentVersion));
    if (missing.length) lists.append(goneNow(missing));
    const required = everythingItRequires(found, byId, view, currentVersion, mine);
    if (required) lists.append(required);
  };

  // The heading and its count on the left; what can be done with the list on
  // the right. On a phone the buttons drop under the heading.
  const head = el('div', { class: 'fav-head' }, [
    el('div', { class: 'page-head' }, [
      title,
      el('div', { class: 'sub', text: countLine(found, missing) }),
    ]),
    el('div', { class: 'fav-actions' }, [
      ...actions(mine, found, missing),
      viewToggle(() => view, (which) => { view = which; saveView(which); drawLists(); }),
    ]),
  ]);

  drawLists();
  root.append(el('div', { class: 'stack' }, [head, undo, lists]));
}

function drawMods(mods, view, currentVersion) {
  return view === 'rows' ? modRows(mods, currentVersion) : modGrid(mods, currentVersion);
}

/// The count, said plainly.
function countLine(found, missing) {
  const one = found.length === 1;
  const start = `${found.length} mod${one ? '' : 's'}`;
  if (!missing.length) return `${start} favorited.`;
  return `${start} favorited, and ${missing.length} that ${
    missing.length === 1 ? 'is' : 'are'} no longer here.`;
}

/// What a reader can do with the favorites they are looking at.
function actions(mine, found, missing) {
  const ids = [...found.map((m) => m.id), ...missing];

  const share = el('button', { class: 'btn btn-primary', text: 'Copy link' });
  share.addEventListener('click', async () => {
    const link = location.origin + location.pathname + favoritesHref(ids);
    try {
      await navigator.clipboard.writeText(link);
      share.textContent = 'Copied';
      setTimeout(() => { share.textContent = 'Copy link'; }, 1600);
    } catch {
      // Some browsers will not hand over the clipboard. Showing the reader the
      // link so they can copy it themselves is better than saying nothing.
      share.replaceWith(el('input', {
        class: 'search-box', type: 'text', value: link, readonly: 'readonly',
      }));
    }
  });

  if (mine) {
    // Clearing takes effect at once and the page offers to undo it, rather
    // than asking "are you sure?" first.
    const empty = el('button', { class: 'btn', text: 'Clear all' });
    empty.addEventListener('click', () => {
      clearedIds = ids;
      setFavorites([]);
    });
    return [share, empty];
  }

  // Adds to the reader's own favorites rather than replacing them, so
  // following somebody's link can never wipe out a list of your own.
  const own = new Set(favorites());
  const toAdd = ids.filter((id) => !own.has(id));
  const take = el('button', {
    class: 'btn',
    text: toAdd.length ? 'Add all to my favorites' : 'All in my favorites',
    disabled: toAdd.length ? null : 'disabled',
  });
  take.addEventListener('click', () => {
    setFavorites([...own, ...toAdd]);
    go('#/favorites');
  });
  return [take, share];
}

/// The line that offers to put back favorites cleared a moment ago.
function undoClearLine() {
  if (!clearedIds || !clearedIds.length) return null;
  const ids = clearedIds;
  const button = el('button', { class: 'link-button', text: 'Undo' });
  button.addEventListener('click', () => setFavorites(ids));
  return el('div', { class: 'fav-undo' }, [
    el('span', {
      text: `Cleared ${ids.length} favorite${ids.length === 1 ? '' : 's'}. `,
    }),
    button,
  ]);
}

/// Everything the favorited mods require that is not itself favorited. It is
/// the one thing a shared list nearly always gets wrong — the person who built
/// it already had LazyLib, so they never thought to put it in.
///
/// A required mod this site has a page for is drawn like the favorites above,
/// so it can be downloaded or starred from here. One the site has no page for
/// is named on a line underneath.
function everythingItRequires(found, byId, view, currentVersion, mine) {
  const listed = new Set(found.map((mod) => mod.id));
  const wanted = new Map();
  for (const mod of found) {
    for (const needed of mod.needs || []) {
      if (needed.id && listed.has(needed.id)) continue;
      wanted.set(needed.id || needed.name, needed);
    }
  }
  if (!wanted.size) return null;

  const known = [];
  const unknown = [];
  for (const needed of wanted.values()) {
    const mod = needed.id && byId.get(needed.id);
    if (mod) known.push(mod);
    else unknown.push(needed.name);
  }

  // On the reader's own list, one press stars every required mod this site
  // has a page for. A shared list is somebody else's, so it is left alone.
  const head = el('div', { class: 'section-head' }, [
    el('h2', { text: 'Also required' }),
  ]);
  if (mine && known.length) {
    const all = el('button', { class: 'btn', text: 'Favorite all' });
    all.addEventListener('click', () => {
      setFavorites([...favorites(), ...known.map((mod) => mod.id)]);
    });
    head.append(all);
  }

  return el('section', { class: 'stack' }, [
    head,
    known.length ? drawMods(known, view, currentVersion) : null,
    unknown.length
      ? el('p', {
          class: 'result-line',
          text: `With no page on this site: ${unknown.join(', ')}.`,
        })
      : null,
  ]);
}

function nothingYet() {
  return el('div', { class: 'notice' }, [
    el('h3', { text: 'No favorites yet' }),
    el('p', { text: 'Press the ☆ on any mod to add it here.' }),
    el('p', {}, [el('a', { href: '#/browse', text: 'Browse every mod →' })]),
  ]);
}

function goneNow(missing) {
  return el('div', { class: 'notice' }, [
    el('h3', {
      text: `${missing.length} mod${missing.length === 1 ? '' : 's'} not here `
        + 'any more',
    }),
    el('p', { text: missing.join(', ') }),
  ]);
}
