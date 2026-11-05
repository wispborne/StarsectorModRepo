// Reports use `mods.json`, `updates.json` and `conflicts.json`.
// Bars link to matching Browse filters where one exists.
// Readers can use those links to check which mods were counted.
//
// Authors are not ranked by mod count. More mods does not mean better mods.

import {
  buildHash, clear, CONFLICT_KIND_ORDER, CONFLICT_KINDS, conflictPill,
  conflictList, countedAcross, currentGameVersion, el, formatDay,
  gameVersions, modHref, modList, quickTip, releaseFeed, requiredModCounts,
} from '../lib.js';

/// How many required mods the first report lists.
const REQUIRED_SHOWN = 15;

/// How many months the new-mods chart shows before "Show all months".
const RECENT_MONTHS = 24;

/// How many mods the most-releases list shows.
const BUSIEST_SHOWN = 10;

/// How many mods to show under "Most conflicted".
const CONFLICTED_SHOWN = 10;

/// How many mods the conflicts list shows before "Show all".
const CONFLICTS_SHOWN = 10;

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export async function render(root) {
  const [list, feed, conflictFile] = await Promise.all([
    modList(),
    // The other reports work without a release list or a conflict list.
    releaseFeed().catch(() => null),
    conflictList().catch(() => null),
  ]);
  const mods = list.mods || [];
  const releases = (feed && feed.releases) || [];
  const conflicts = (conflictFile && conflictFile.mods) || [];

  document.title = 'Reports | Starmodder';
  clear(root);
  root.append(el('div', { class: 'stack' }, [
    el('div', { class: 'page-head' }, [
      el('h1', { text: 'Reports' }),
    ]),
    report('Dependency use count',
      null,
      requiredReport(mods)),
    report('Mods by game version',
      null,
      gameVersionReport(mods)),
    report('New mods by month',
      null,
      newModsReport(mods)),
    report('Mods by category',
      'Mods can be in more than one category.',
      categoryReport(mods)),
    report('Updates by week',
      releases.length
        ? `Since ${formatDay(oldestDay(releases))}`
        : 'No updates found yet.',
      releases.length ? releaseReport(releases) : null),
    report(`Conflicts (${conflicts.length})`,
      '',
      conflicts.length ? conflictReport(conflicts) : null),
  ]));
}

/// A note under the title only where the title leaves something unclear.
function report(title, about, body) {
  return el('section', { class: 'panel report' }, [
    el('div', { class: 'report-head' }, [
      el('h2', { text: title }),
      about ? el('p', { class: 'report-about', text: about }) : null,
    ]),
    body,
  ]);
}

/// Include all game versions so Browse counts match the bars.
/// Browse otherwise shows only the current game version.
function browseHref(params) {
  return buildHash(['browse'], { game: 'any', ...params });
}

function requiredReport(mods) {
  return barList(requiredModCounts(mods).slice(0, REQUIRED_SHOWN).map((required) => ({
    label: required.name,
    // The name goes to the required mod's own page, where there is one.
    labelHref: required.id ? modHref(required.id) : null,
    count: required.count,
    href: browseHref({ needs: required.name }),
    tip: `${required.count} mod${required.count === 1 ? '' : 's'} need ${required.name}`,
  })));
}

function gameVersionReport(mods) {
  const current = currentGameVersion(mods);
  const rows = gameVersions(mods).map((v) => ({
    label: v.family === current ? `${v.label} (current)` : v.label,
    count: v.count,
    href: browseHref({ game: v.family }),
    on: v.family === current,
  }));
  const none = mods.filter((mod) => !mod.gameVersion).length;
  if (none) {
    rows.push({ label: 'Unknown', count: none, href: browseHref({ game: 'none' }), dim: true });
  }
  return barList(rows);
}

function categoryReport(mods) {
  return barList(countedAcross(mods, (mod) => mod.categories)
    .map(([category, count]) => ({
      label: category, count, href: browseHref({ category }),
    })));
}

function newModsReport(mods) {
  const counts = new Map();
  for (const mod of mods) {
    const month = (mod.addedOn || '').slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(month)) counts.set(month, (counts.get(month) || 0) + 1);
  }
  if (!counts.size) return null;

  // Include empty months so gaps stay visible.
  const months = [];
  const first = [...counts.keys()].sort()[0];
  const now = new Date();
  const last = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  for (let at = first; at <= last; at = nextMonth(at)) {
    months.push({ key: at, count: counts.get(at) || 0 });
  }

  // The full chart has room for year labels only.
  // Counts appear on hover.
  const columns = (shown) => columnChart(shown.map((m) => {
    const [year, month] = m.key.split('-').map(Number);
    return {
      count: m.count,
      label: MONTH_NAMES[month - 1],
      // The year goes under each January, and under the first column.
      group: month === 1 || m === shown[0] ? String(year) : '',
      tip: `${MONTH_NAMES[month - 1]} ${year}: ${m.count} new mod${m.count === 1 ? '' : 's'}`,
    };
  }), { dense: shown.length > RECENT_MONTHS });

  if (months.length <= RECENT_MONTHS) return columns(months);

  const holder = el('div', {}, [columns(months.slice(-RECENT_MONTHS))]);
  let all = false;
  const toggle = el('button', {
    type: 'button', class: 'link-button report-more',
    text: `Show all since ${first.slice(0, 4)}`,
  });
  toggle.addEventListener('click', () => {
    all = !all;
    clear(holder).append(columns(all ? months : months.slice(-RECENT_MONTHS)));
    toggle.textContent = all
      ? `Show last ${RECENT_MONTHS} months`
      : `Show all since ${first.slice(0, 4)}`;
    // Keep the newest months in view after switching.
    const scroller = holder.querySelector('.report-columns');
    if (scroller) scroller.scrollLeft = scroller.scrollWidth;
  });
  return el('div', { class: 'stack' }, [holder, el('div', {}, [toggle])]);
}

function releaseReport(releases) {
  const counts = new Map();
  for (const release of releases) {
    const week = weekStart(release.seenOn);
    if (week) counts.set(week, (counts.get(week) || 0) + 1);
  }
  const weeks = [];
  const first = [...counts.keys()].sort()[0];
  const last = weekStart(newestDay(releases));
  for (let at = first; at <= last; at = addDays(at, 7)) {
    weeks.push({ key: at, count: counts.get(at) || 0 });
  }

  const chart = columnChart(weeks.map((w, i) => {
    const [year, month, day] = w.key.split('-').map(Number);
    const startsMonth = i === 0 || w.key.slice(0, 7) !== weeks[i - 1].key.slice(0, 7);
    return {
      count: w.count,
      label: String(day),
      group: startsMonth ? `${MONTH_NAMES[month - 1]} ${year}` : '',
      tip: `Week of ${formatDay(w.key)}: ${w.count} update${w.count === 1 ? '' : 's'}`,
    };
  }), { wide: true });

  const byMod = new Map();
  for (const release of releases) {
    const entry = byMod.get(release.modId) || { name: release.modName, count: 0 };
    entry.count += 1;
    byMod.set(release.modId, entry);
  }
  const busiest = [...byMod.entries()]
    .filter(([, entry]) => entry.count > 1)
    .sort((a, b) => b[1].count - a[1].count || a[1].name.localeCompare(b[1].name))
    .slice(0, BUSIEST_SHOWN)
    .map(([id, entry]) => ({
      label: entry.name,
      count: entry.count,
      href: modHref(id),
      tip: `${entry.count} updates`,
    }));

  return el('div', { class: 'stack' }, [
    chart,
    busiest.length ? el('h3', { text: 'Most updates' }) : null,
    busiest.length ? barList(busiest) : null,
  ]);
}

function conflictReport(conflicts) {
  // For each mod named as a conflict, list the mods whose posts name it.
  // Count each mod once even if its post names the same conflict more than once.
  // Only count named mods that have a page.
  // A mod named by only one other mod is left out.
  const named = new Map();
  for (const mod of conflicts) {
    for (const conflict of mod.conflicts) {
      if (!conflict.id) continue;
      const entry = named.get(conflict.id) || { name: conflict.name, by: new Set() };
      entry.by.add(mod.modName);
      named.set(conflict.id, entry);
    }
  }
  const mostNamed = [...named.entries()]
    .filter(([, entry]) => entry.by.size > 1)
    .sort((a, b) => b[1].by.size - a[1].by.size || a[1].name.localeCompare(b[1].name))
    .slice(0, CONFLICTED_SHOWN)
    .map(([id, entry]) => ({
      label: entry.name,
      count: entry.by.size,
      labelHref: modHref(id),
      tip: [...entry.by].join(', '),
    }));

  // Count conflicts by kind.
  // Skip conflicts with no kind.
  // Use the warning colour for the two incompatible kinds of conflict.
  const all = conflicts.flatMap((mod) => mod.conflicts);
  const byKind = CONFLICT_KIND_ORDER
    .map((kind) => ({
      label: CONFLICT_KINDS[kind][0],
      count: all.filter((conflict) => conflict.kind === kind).length,
      tip: CONFLICT_KINDS[kind][1],
      warn: CONFLICT_KINDS[kind][2],
    }))
    .filter((row) => row.count);

  // Show each mod's name before the conflicts named in its own post.
  // Show the author's quote below each conflict.
  const rows = (shown) => el('div', { class: 'conflict-list' }, shown.flatMap((mod) => [
    el('a', { class: 'conflict-mod', href: modHref(mod.modId), text: mod.modName }),
    el('div', { class: 'save-lines' }, mod.conflicts.map((conflict) =>
      el('div', { class: 'save-line' }, [
        conflictPill(conflict),
        el('q', { class: 'save-words', text: conflict.quote }),
      ]))),
  ]));

  let list = rows(conflicts);
  if (conflicts.length > CONFLICTS_SHOWN) {
    const holder = el('div', {}, [rows(conflicts.slice(0, CONFLICTS_SHOWN))]);
    let all = false;
    const toggle = el('button', {
      type: 'button', class: 'link-button report-more',
      text: `Show all ${conflicts.length} mods`,
    });
    toggle.addEventListener('click', () => {
      all = !all;
      clear(holder).append(rows(all ? conflicts : conflicts.slice(0, CONFLICTS_SHOWN)));
      toggle.textContent = all ? `Show first ${CONFLICTS_SHOWN} mods` : `Show all ${conflicts.length} mods`;
    });
    list = el('div', { class: 'stack' }, [holder, el('div', {}, [toggle])]);
  }

  // Each part has a heading above its content.
  const part = (title, body) => el('div', { class: 'conflict-part' }, [
    el('h3', { text: title }), body,
  ]);
  return el('div', { class: 'conflict-report' }, [
    byKind.length ? part('Conflict types', barList(byKind)) : null,
    mostNamed.length ? part('Most conflicted', barList(mostNamed)) : null,
    part('All conflicts', list),
  ]);
}

/// Each row has a name, a bar and a count.
/// The bar and count share a link when one is set.
function barList(rows) {
  if (!rows.length) return null;
  const most = Math.max(...rows.map((r) => r.count));
  const list = el('div', { class: 'bar-list' });
  for (const row of rows) {
    // With no page of its own, the name opens the same list the bar does.
    const nameHref = row.labelHref || row.href;
    const name = nameHref
      ? el('a', { class: 'bar-name', href: nameHref, text: row.label })
      : el('span', { class: 'bar-name', text: row.label });
    const fill = el('span', {
      class: ['bar-fill', row.on ? 'on' : '', row.dim ? 'dim' : '', row.warn ? 'warn' : '']
        .filter(Boolean).join(' '),
    });
    fill.style.width = `${Math.max(1, (row.count / most) * 100)}%`;
    const bar = el(row.href ? 'a' : 'span', {
      class: 'bar-link', href: row.href || null,
      'aria-label': `${row.label}: ${row.count}`,
    }, [
      el('span', { class: 'bar-track' }, [fill]),
      el('span', { class: 'bar-count', text: String(row.count) }),
    ]);
    if (row.tip) quickTip(bar, row.tip);
    list.append(name, bar);
  }
  return list;
}

/// Bars run from oldest to newest.
/// Year or month labels mark the start of each group.
/// Wide charts scroll sideways.
function columnChart(columns, { wide = false, dense = false } = {}) {
  const most = Math.max(1, ...columns.map((c) => c.count));
  const chart = el('div', {
    class: ['report-columns', wide ? 'wide' : '', dense ? 'dense' : ''].filter(Boolean).join(' '),
    role: 'img',
  });
  chart.setAttribute('aria-label', columns.map((c) => c.tip).join('; '));
  for (const column of columns) {
    const fill = el('span', { class: 'column-fill' });
    fill.style.height = `${(column.count / most) * 100}%`;
    const cell = el('div', { class: column.group ? 'column starts-group' : 'column' }, [
      el('span', { class: 'column-count', text: column.count ? String(column.count) : '' }),
      el('span', { class: 'column-track' }, [fill]),
      el('span', { class: 'column-label', text: column.label }),
      el('span', { class: 'column-group', text: column.group }),
    ]);
    quickTip(cell, column.tip);
    chart.append(cell);
  }
  // Show the newest bars first.
  requestAnimationFrame(() => { chart.scrollLeft = chart.scrollWidth; });
  return chart;
}

function nextMonth(key) {
  const [year, month] = key.split('-').map(Number);
  return month === 12
    ? `${year + 1}-01`
    : `${year}-${String(month + 1).padStart(2, '0')}`;
}

/// The Monday that starts the week a day falls in, as `yyyy-mm-dd`.
function weekStart(day) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(day || '')) return null;
  const date = new Date(`${day.slice(0, 10)}T00:00:00Z`);
  const back = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - back);
  return date.toISOString().slice(0, 10);
}

function addDays(day, days) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function oldestDay(releases) {
  return releases.map((r) => r.seenOn).filter(Boolean).sort()[0];
}

function newestDay(releases) {
  return releases.map((r) => r.seenOn).filter(Boolean).sort().at(-1);
}
