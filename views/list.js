// A mod list the reader builds, keeps and shares.
//
// Starsector players trade mod lists constantly, and until now doing that meant
// pasting names into Discord. Ticking mods here builds one, and the whole list
// travels in the address — no account, no server, nothing kept about anybody.
//
// Two things this page shows, and it says plainly which: the reader's own list,
// or somebody else's that they followed a link to.

import {
  breadcrumbs, clear, downloadButton, el, hashQuery, joinNames, listHref,
  modHref, modList, modName, myList, neededModsLine, setMyList, thumbnail,
  toggleInMyList,
} from '../lib.js';

export async function render(root) {
  const shared = (hashQuery().get('ids') || '').split(',').filter(Boolean);
  const mine = !shared.length;
  const ids = mine ? myList() : shared;

  document.title = mine ? 'My mod list | Starmodder' : 'A mod list | Starmodder';
  clear(root);
  root.append(breadcrumbs([{ label: mine ? 'My list' : 'A shared list' }]));

  const list = await modList();
  const byId = new Map((list.mods || []).map((mod) => [mod.id, mod]));

  // A list can name a mod that has since been taken down. Saying so is better
  // than quietly dropping it and leaving the reader to wonder.
  const found = ids.map((id) => byId.get(id)).filter(Boolean);
  const missing = ids.filter((id) => !byId.has(id));

  const head = el('div', { class: 'page-head' }, [
    el('h1', { text: mine ? 'My mod list' : 'A shared mod list' }),
    el('span', {
      class: 'sub',
      text: mine
        ? 'Kept in this browser and nowhere else. Nothing about it is sent '
          + 'anywhere.'
        : 'Somebody built this list and shared the link with you.',
    }),
  ]);

  if (!ids.length) {
    root.append(el('div', { class: 'stack' }, [head, nothingYet()]));
    return;
  }

  const rows = el('div', { class: 'stack' });
  const drawRows = () => {
    clear(rows);
    for (const mod of found) rows.append(listRow(mod, mine, drawRows));
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
  if (!missing.length) return `${start} in the list.`;
  return `${start} in the list, and ${missing.length} that ${
    missing.length === 1 ? 'is' : 'are'} no longer here.`;
}

/// What a reader can do with the list they are looking at.
function actions(root, mine, found, missing) {
  const ids = [...found.map((m) => m.id), ...missing];
  const row = el('div', { class: 'search-row' });

  const share = el('button', { class: 'btn btn-primary', text: 'Copy the link' });
  share.addEventListener('click', async () => {
    const link = location.origin + location.pathname + listHref(ids);
    try {
      await navigator.clipboard.writeText(link);
      share.textContent = 'Copied';
      setTimeout(() => { share.textContent = 'Copy the link'; }, 1600);
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
    const empty = el('button', { class: 'btn', text: 'Empty the list' });
    empty.addEventListener('click', () => {
      setMyList([]);
      render(root);
    });
    row.append(empty);
  } else {
    const take = el('button', { class: 'btn', text: 'Make this my list' });
    take.addEventListener('click', () => {
      setMyList(ids);
      location.hash = '#/list';
    });
    row.append(take);
  }
  return row;
}

/// One mod in the list: enough to install it without opening its page, and a
/// link there for when that is not enough.
///
/// One download button, the same as every other list on the site. It used to
/// draw one button per download, so a mod offering a file, a mirror and an
/// archive of old versions filled its row with three buttons all saying much
/// the same thing. It also fetched every listed mod's own file to find them;
/// the winning download now rides on the list record, so a row costs nothing.
function listRow(mod, mine, redraw) {
  const links = el('div', { class: 'list-links' }, [
    downloadButton(mod),
  ]);

  const row = el('div', { class: 'list-row' }, [
    thumbnail(mod.imageUrl, 'row-thumb'),
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
      'aria-label': `Take ${modName(mod)} out of my list`,
    });
    out.addEventListener('click', () => {
      toggleInMyList(mod.id);
      redraw();
    });
    row.append(out);
  }
  return row;
}

/// Everything the listed mods need that is not itself in the list. It is the
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
    neededModsLine('Not in the list', [...wanted.values()]),
  ]);
}

function nothingYet() {
  return el('div', { class: 'notice' }, [
    el('h3', { text: 'Nothing in the list yet' }),
    el('p', {
      text: 'Every mod has a "+" on its card. Tick the ones you want and they '
        + 'gather here, ready to share as one link.',
    }),
    el('p', {}, [el('a', { href: '#/browse', text: 'Browse every mod →' })]),
  ]);
}

function goneNow(missing) {
  return el('div', { class: 'notice' }, [
    el('h3', {
      text: `${missing.length} mod${missing.length === 1 ? '' : 's'} not here `
        + 'any more',
    }),
    el('p', {
      text: 'These were in the list but this site no longer has them: '
        + missing.join(', '),
    }),
  ]);
}
