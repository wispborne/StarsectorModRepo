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
  if (!wanted) return renderIndex(root);

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
        text: `${mods.length} mod${mods.length === 1 ? '' : 's'}.`,
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

/// Everyone who has a mod here, with how many each has.
///
/// This replaces a dropdown of 589 names on the browse page, which nobody could
/// use. A name is listed once, under the spelling its mods credit; the other
/// spellings a person goes by are folded into that one, so Histidine is one
/// entry and not three.
async function renderIndex(root) {
  const list = await modList();
  const mods = list.mods || [];

  const counts = new Map();
  for (const mod of mods) {
    for (const name of mod.authors || []) {
      const key = name.toLowerCase();
      if (!counts.has(key)) counts.set(key, { name, count: 0 });
      counts.get(key).count += 1;
    }
  }

  const people = [...counts.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  document.title = 'People | Starmodder';
  clear(root);
  root.append(breadcrumbs([{ label: 'People' }]));

  const cloud = el('div', { class: 'people' });
  for (const person of people) {
    cloud.append(el('a', {
      class: 'person',
      href: `#/authors/${encodeURIComponent(person.name)}`,
    }, [
      el('span', { class: 'person-name', text: person.name }),
      el('span', { class: 'person-count', text: String(person.count) }),
    ]));
  }

  root.append(el('div', { class: 'stack' }, [
    el('div', { class: 'page-head' }, [
      el('h1', { text: 'People' }),
      el('span', {
        class: 'sub',
        text: `${people.length} people have a mod here. The ones with the most `
          + 'come first.',
      }),
    ]),
    cloud,
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
