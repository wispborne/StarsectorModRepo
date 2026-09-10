// One person's page: every mod credited to them.
//
// The same person turns up under different spellings across the forum and
// Discord. The merge already folds most of that together; the rest is folded
// here, using the other names each mod says its authors go by. So one page
// covers a person however their name was written.

import {
  breadcrumbs, clear, currentGameVersion, el, joinNames, modList, otherNamesOf,
} from '../lib.js';
import { modGrid, sortMods } from './browse.js';

export async function render(root, parts) {
  const wanted = parts[0];
  // There is no index of authors. A list of everyone, ordered by how many mods
  // they have, is a scoreboard, and a scoreboard rewards publishing more mods
  // rather than better ones. A person's page is reached from a mod that
  // credits them, or from the search box.
  if (!wanted) {
    location.hash = '#/browse';
    return;
  }

  const list = await modList();
  const mods = (list.mods || []).filter((mod) => creditedTo(mod, wanted));

  document.title = `${wanted} | Starmodder`;
  clear(root);
  root.append(breadcrumbs([
    { label: 'Browse mods', href: '#/browse' },
    { label: wanted },
  ]));

  if (!mods.length) {
    root.append(el('div', { class: 'notice' }, [
      el('h3', { text: `Nothing credited to ${wanted}` }),
      el('p', { text: 'No mod here names them. The spelling may have changed, '
        + 'or the mod may have been taken down.' }),
      el('p', {}, [el('a', { href: '#/browse', text: 'Browse every mod →' })]),
    ]));
    return;
  }

  const otherNames = alsoKnownAs(mods, wanted);

  root.append(el('div', { class: 'stack' }, [
    el('div', { class: 'page-head' }, [
      el('h1', { text: bestSpelling(mods, wanted) }),
      el('span', {
        class: 'sub',
        text: `has ${mods.length} mod${mods.length === 1 ? '' : 's'}`,
      }),
      otherNames.length
        ? el('span', {
            class: 'sub',
            text: `Also known as ${joinNames(otherNames)}.`,
          })
        : null,
    ]),
    modGrid(sortMods(mods, 'name'), currentGameVersion(list.mods || [])),
  ]));
}

/// True when this mod names the person, under the spelling asked for or any of
/// the other names its authors are known by.
function creditedTo(mod, name) {
  const wanted = name.toLowerCase();
  return (mod.authors || []).some((author) => author.toLowerCase() === wanted
    || otherNamesOf(mod, author).some((a) => a.toLowerCase() === wanted));
}

/// The spelling to put at the top of the page: the one the mods themselves use,
/// rather than whatever spelling the link happened to carry.
function bestSpelling(mods, asked) {
  const wanted = asked.toLowerCase();
  for (const mod of mods) {
    for (const author of mod.authors || []) {
      if (author.toLowerCase() === wanted) return author;
    }
  }
  // Reached through one of their other names: show the name the mods credit
  // that other name to.
  for (const mod of mods) {
    for (const author of mod.authors || []) {
      if (otherNamesOf(mod, author).some((a) => a.toLowerCase() === wanted)) {
        return author;
      }
    }
  }
  return asked;
}

/// The other names this person goes by, without repeating the one on show.
///
/// Only names belonging to this person count. Someone else credited on the
/// same mod is a co-author, not another name for them: Kaleidoscope credits
/// SirHartley and pixel_rice_bowl, who are two people.
function alsoKnownAs(mods, asked) {
  const shown = bestSpelling(mods, asked).toLowerCase();
  const wanted = asked.toLowerCase();
  const others = new Set();
  for (const mod of mods) {
    for (const author of mod.authors || []) {
      const names = [author, ...otherNamesOf(mod, author)];
      const isThisPerson = names.some((n) => {
        const lower = n.toLowerCase();
        return lower === shown || lower === wanted;
      });
      if (!isThisPerson) continue;
      for (const name of names) {
        if (name.toLowerCase() !== shown) others.add(name);
      }
    }
  }
  return [...others].sort();
}
