// The mods a reader has favorited, and a link that shares them.
//
// Favorites are kept in the reader's own browser. Sharing puts every id in the
// address, so a shared list needs no account and no server.
//
// The page shows one of two things and says which: the reader's own favorites,
// or somebody else's that they followed a link to.

import {
  breadcrumbs, clear, downloadButton, el, favorites, favoritesHref, go,
  hashQuery, imageUrlOf, joinNames, modHref, modList, modName, neededModsLine,
  setFavorites, thumbnail, toggleFavorite,
} from '../lib.js';

export async function render(root) {
  const shared = (hashQuery().get('ids') || '').split(',').filter(Boolean);
  const mine = !shared.length;
  const ids = mine ? favorites() : shared;

  document.title = mine ? 'Favorites | Starmodder' : 'Shared favorites | Starmodder';
  clear(root);
  root.append(breadcrumbs([{ label: mine ? 'Favorites' : 'Shared favorites' }]));

  const list = await modList();
  const byId = new Map((list.mods || []).map((mod) => [mod.id, mod]));

  // A list can name a mod that has since been taken down. Saying so is better
  // than quietly dropping it and leaving the reader to wonder.
  const found = ids.map((id) => byId.get(id)).filter(Boolean);
  const missing = ids.filter((id) => !byId.has(id));

  // The heading says which list this is, so it says it once and stops there.
  const head = el('div', { class: 'page-head' }, [
    el('h1', { text: mine ? 'Favorites' : 'Shared favorites' }),
  ]);

  if (!ids.length) {
    root.append(el('div', { class: 'stack' }, [head, nothingYet()]));
    return;
  }

  const rows = el('div', { class: 'stack' });
  const drawRows = () => {
    clear(rows);
    for (const mod of found) rows.append(favoriteRow(mod, mine, drawRows));
    if (missing.length) rows.append(goneNow(missing));
  };
  drawRows();

  root.append(el('div', { class: 'stack' }, [
    head,
    actions(root, mine, found, missing),
    el('div', { class: 'result-line', text: countLine(found, missing) }),
    rows,
    everythingItNeeds(found),
  ]));
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
function actions(root, mine, found, missing) {
  const ids = [...found.map((m) => m.id), ...missing];
  const row = el('div', { class: 'search-row' });

  const share = el('button', { class: 'btn btn-primary', text: 'Copy URL' });
  share.addEventListener('click', async () => {
    const link = location.origin + location.pathname + favoritesHref(ids);
    try {
      await navigator.clipboard.writeText(link);
      share.textContent = 'Copied';
      setTimeout(() => { share.textContent = 'Copy URL'; }, 1600);
    } catch {
      // Some browsers will not hand over the clipboard. Showing the reader the
      // link so they can copy it themselves is better than saying nothing.
      share.replaceWith(el('input', {
        class: 'search-box', type: 'text', value: link, readonly: 'readonly',
      }));
    }
  });
  row.append(share);

  if (mine) {
    const empty = el('button', { class: 'btn', text: 'Clear favorites' });
    empty.addEventListener('click', () => {
      setFavorites([]);
      render(root);
    });
    row.append(empty);
  } else {
    const take = el('button', { class: 'btn', text: 'Make these my favorites' });
    take.addEventListener('click', () => {
      setFavorites(ids);
      go('#/favorites');
    });
    row.append(take);
  }
  return row;
}

/// One favorited mod: enough to install it without opening its page, and a link
/// there for when that is not enough.
///
/// One download button, the same as every other list on the site, and it rides
/// on the list record, so a row costs no request of its own.
function favoriteRow(mod, mine, redraw) {
  const links = el('div', { class: 'fav-links' }, [
    downloadButton(mod),
  ]);

  const row = el('div', { class: 'fav-row' }, [
    thumbnail(imageUrlOf(mod), 'row-thumb'),
    el('div', { class: 'row-main' }, [
      el('a', { class: 'row-title', href: modHref(mod.id), text: modName(mod) }),
      el('div', {
        class: 'row-sub',
        text: [
          joinNames(mod.authors), mod.modVersion, mod.gameVersion,
          (mod.downloadCount || 0) > 1 ? `${mod.downloadCount} downloads` : null,
        ].filter(Boolean).join(' · '),
      }),
    ]),
    links,
  ]);

  if (mine) {
    const out = el('button', {
      class: 'btn', text: 'Remove',
      'aria-label': `Remove ${modName(mod)} from favorites`,
    });
    out.addEventListener('click', () => {
      toggleFavorite(mod.id);
      redraw();
    });
    row.append(out);
  }
  return row;
}

/// Everything the favorited mods need that is not itself favorited. It is the
/// one thing a shared list nearly always gets wrong — the person who built it
/// already had LazyLib, so they never thought to put it in.
function everythingItNeeds(found) {
  const listed = new Set(found.map((mod) => mod.id));
  const wanted = new Map();
  for (const mod of found) {
    for (const needed of mod.needs || []) {
      if (needed.id && listed.has(needed.id)) continue;
      wanted.set(needed.id || needed.name, needed);
    }
  }
  if (!wanted.size) return null;

  return el('section', { class: 'stack' }, [
    el('h2', { text: 'These also need' }),
    neededModsLine('Not favorited', [...wanted.values()]),
  ]);
}

function nothingYet() {
  return el('div', { class: 'notice' }, [
    el('h3', { text: 'No favorites yet' }),
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
