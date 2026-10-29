// Changelog: what changed on the website, newest first.
//
// `changelog.json` is written from git by the release workflow: one entry for
// each commit that changed the website, so nobody has to keep this page up to
// date by hand. Like `version.json` it is part of the site, not of the data, so
// it is fetched by hand and `?data=sample` does not send it to `sample-data/`.

import { clear, el, errorPanel, formatDay, SITE_CODE_URL } from '../lib.js';

/// A commit title longer than this is a whole paragraph (older commits were
/// written that way), so it is shown as words, not as a heading.
const LONGEST_HEADING = 120;

// Tabler's "mood-sad-squint" (MIT), copied in as path data.
const WARNING_ICON = '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" '
  + 'stroke="currentColor" stroke-width="2" stroke-linecap="round" '
  + 'stroke-linejoin="round" focusable="false" aria-hidden="true">'
  + '<path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/>'
  + '<path d="M14.5 16.05a3.5 3.5 0 0 0 -5 0"/>'
  + '<path d="M8.5 11.5l1.5 -1.5l-1.5 -1.5"/>'
  + '<path d="M15.5 11.5l-1.5 -1.5l1.5 -1.5"/></svg>';

export async function render(root) {
  document.title = 'Changelog | Starmodder';
  let entries;
  try {
    const res = await fetch('./changelog.json', { credentials: 'omit' });
    if (!res.ok) throw new Error('No changelog.');
    entries = await res.json();
    if (!Array.isArray(entries)) throw new Error('Unable to load changelog.');
  } catch (err) {
    clear(root).append(errorPanel(err));
    return;
  }

  clear(root);
  root.append(el('div', { class: 'stack' }, [
    el('div', { class: 'page-head' }, [
      el('h1', { text: 'Changelog' }),
      el('p', { class: 'changelog-warning' }, [
        el('span', { class: 'warning-icon', html: WARNING_ICON }),
        el('span', { text: 'Warning: the changelog is all AI slop.' }),
      ]),
    ]),
    ...byDay(entries).map(([day, list]) => el('section', { class: 'panel changelog-day' }, [
      el('h2', { text: formatDay(day) || day }),
      ...list.map(entry),
    ])),
  ]));
}

/// Entries grouped by day, keeping their order.
function byDay(entries) {
  const days = new Map();
  for (const item of entries) {
    if (!item || !item.title) continue;
    const day = item.date || '';
    if (!days.has(day)) days.set(day, []);
    days.get(day).push(item);
  }
  return [...days];
}

function entry(item) {
  const long = item.title.length > LONGEST_HEADING;
  const commit = el('a', {
    text: item.commit,
    href: `${SITE_CODE_URL}/commit/${item.commit}`,
    target: '_blank',
    rel: 'nofollow noopener',
  });
  return el('article', { class: 'changelog-entry' }, [
    long ? el('p', { text: item.title }) : el('h3', { text: item.title }),
    ...paragraphs(item.body || ''),
    el('p', { class: 'changelog-build' }, [`v${item.build} · `, commit]),
  ]);
}

/// A commit message is wrapped at a fixed width, so a single line break is
/// only a wrap and a blank line starts a new paragraph. A block where every
/// line starts with "- " or "* " is a list.
function paragraphs(body) {
  return body.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean)
    .map((block) => {
      const lines = block.split('\n').map((line) => line.trim());
      if (lines.every((line) => /^[-*] /.test(line))) {
        return el('ul', {}, lines.map((line) => el('li', { text: line.slice(2) })));
      }
      return el('p', { text: lines.join(' ') });
    });
}
