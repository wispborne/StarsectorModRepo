// One mod's own page, at an address built from its permanent id. The id never
// changes, so this address holds even when the mod's thread is renamed by its
// next release.
//
// A part the mod has nothing for is left out entirely rather than drawn empty,
// so a thin page reads as deliberate instead of broken.

import {
  aiSparkle, aiSummaryNote, aiSummaryOf,
  breadcrumbs, clear,
  currentGameVersion, DATA_BASE, downloadButton, el, errorPanel, formatDay,
  favoriteToggle, formatMoment, imageUrlOf, inlinePictures, joinNames,
  setInlinePictures,
  modDetail, modHref, modList, modName, MOD_VERSION_NOTE, neededModsLine,
  NO_DESCRIPTION, pageIcon, picture, showPicture, sourceName, summaryTitle,
  versionStanding, versionStandingNote,
} from '../lib.js';
import { modCard } from './browse.js';

/// How many mods the two strips at the foot of the page show.
const RELATED_COUNT = 6;

/// Plain names for the support links, keyed by the type the scraper works out.
const SUPPORT_NAMES = {
  patreon: 'Patreon',
  kofi: 'Ko-fi',
  paypal: 'PayPal',
  buymeacoffee: 'Buy Me a Coffee',
  liberapay: 'Liberapay',
  subscribestar: 'SubscribeStar',
  boosty: 'Boosty',
  opencollective: 'Open Collective',
  githubsponsors: 'GitHub Sponsors',
  other: 'Support the author',
};

export async function render(root, parts) {
  const id = parts[0];
  if (!id) {
    clear(root).append(errorPanel(new Error('No mod was named in the address.')));
    return;
  }

  let detail;
  try {
    detail = await modDetail(id);
  } catch {
    clear(root).append(el('div', { class: 'notice' }, [
      el('h3', { text: 'No such mod' }),
      el('p', { text: `There is no mod at "${id}". It may have been taken down, `
        + 'or the link may be wrong.' }),
      el('p', {}, [el('a', { href: '#/browse', text: 'Browse every mod →' })]),
    ]));
    return;
  }

  const mod = detail.listing || {};
  const shownName = modName(mod);
  document.title = `${shownName} | Starmodder`;

  // The list is also what the two "more like this" strips at the foot are
  // built from. A page that will not load it still draws everything else.
  let everyMod = [];
  try {
    everyMod = (await modList()).mods || [];
  } catch {
    everyMod = [];
  }
  const currentVersion = currentGameVersion(everyMod);

  clear(root);
  root.append(breadcrumbs([
    { label: 'Browse mods', href: '#/browse' },
    { label: shownName },
  ]));

  // In the order a reader asks: what is it, is it for my game, can I add it to
  // my save, what does it need, how do I get it — then the detail, then where
  // to go next.
  root.append(el('div', { class: 'stack' }, [
    modHeader(mod, detail, shownName, currentVersion),
    needsLine(mod),
    saves(detail),
    sameNameMods(detail),
    description(detail),
    aiSummary(detail),
    gallery(detail),
    downloads(detail),
    changelog(detail),
    releases(detail),
    addons(detail),
    facts(detail),
    moreByTheAuthor(mod, everyMod, currentVersion),
    similarMods(mod, everyMod, currentVersion),
    rawInfo(detail, id),
  ]));
}

/// The top of the page: the mod's picture on one side, and on the other
/// everything a reader needs before they decide — the name, who made it, which
/// game version it is for, whether it can go in an existing save, and the
/// buttons that actually get it.
function modHeader(mod, detail, shownName, currentVersion) {
  const meta = el('div', { class: 'mod-meta' });
  if (mod.modVersion) {
    meta.append(el('span', {
      class: 'badge version', text: mod.modVersion, title: MOD_VERSION_NOTE,
    }));
    // Beside the version, because an update note is about one release.
    const updating = {
      yes: ['save-ok', 'Keeps saves from earlier versions'],
      no: ['save-no', 'Breaks saves from earlier versions'],
      depends: ['', 'Earlier saves: it depends'],
    }[detail.canUpdate];
    if (updating && detail.updateCompatibilityText) {
      meta.append(el('span', {
        class: `badge ${updating[0]}`, text: updating[1],
        title: `The author says: ${detail.updateCompatibilityText}`,
      }));
    }
  }
  if (mod.gameVersion) {
    meta.append(el('span', {
      class: `badge game ${versionStanding(mod, currentVersion) || ''}`.trim(),
      text: `For Starsector ${mod.gameVersion}`,
      title: versionStandingNote(versionStanding(mod, currentVersion)),
    }));
  }
  if (mod.isWorkInProgress) meta.append(el('span', { class: 'badge wip', text: 'Work in progress' }));
  if (mod.isTool) {
    meta.append(el('span', {
      class: 'badge tool', text: 'Tool — runs beside the game',
      title: 'A program you run beside the game, not a mod you load into it.',
    }));
  }
  if (mod.saveCompatible === true) {
    meta.append(el('span', {
      class: 'badge save-ok', text: 'Can be added to an existing save',
      title: 'The author says this can be added to a game already in progress.',
    }));
  } else if (mod.saveCompatible === false) {
    meta.append(el('span', {
      class: 'badge save-no', text: 'New game required',
      title: 'The author says this requires a new game.',
    }));
  }
  // Only a "no" on removing earns a badge: it is the one that costs a save.
  if (detail.canRemove === 'no' && detail.removalCompatibilityText) {
    meta.append(el('span', {
      class: 'badge save-no', text: "Can't be removed later",
      title: `The author says: ${detail.removalCompatibilityText}`,
    }));
  }

  const authors = el('div', { class: 'card-authors' });
  (mod.authors || []).forEach((name, i) => {
    if (i) authors.append(document.createTextNode(', '));
    authors.append(el('a', { href: `#/authors/${encodeURIComponent(name)}`, text: name }));
  });

  const words = el('div', { class: 'mod-head-words' }, [
    el('h1', { text: shownName }),
    // The thread's own title, where it says more than the name does.
    shownName === mod.name
      ? null
      : el('span', { class: 'sub thread-title' }, [
        'Original title: ',
        el('i', { text: mod.name }),
      ]),
    partOfThreadLine(mod),
    (mod.authors || []).length ? authors : null,
    meta,
    howToGetIt(mod, detail),
    supportLinks(detail),
  ]);

  return el('div', { class: 'mod-head' }, [modPicture(mod), words]);
}

/// "Part of <thread>", for a mod that shares a forum thread with others.
///
/// Some threads are several mods at once — "Hartley's Miscellaneous Mods" is
/// four. Those mods have no thread of their own, so without this line four
/// different mods all link the same thread and the page reads as a mistake.
/// Only a mod read out of somebody else's thread carries the title; a mod with
/// its own thread shows nothing here.
function partOfThreadLine(mod) {
  if (!mod.partOfThreadTitle) return null;
  const line = el('div', { class: 'sub part-of' }, [
    document.createTextNode('Part of '),
  ]);
  line.append(mod.forumUrl
    ? el('a', {
        href: mod.forumUrl, target: '_blank', rel: 'noopener nofollow',
        text: mod.partOfThreadTitle,
        title: 'A forum thread with several mods, including this one.',
      })
    : el('span', { text: mod.partOfThreadTitle }));
  line.append(document.createTextNode(', a thread with several mods.'));
  return line;
}

/// The mod's own picture, big, at the top of its page. A mod with none, and one
/// whose picture will not load, both leave the words to fill the width rather
/// than an empty box.
function modPicture(mod) {
  const url = imageUrlOf(mod);
  if (!url) return null;
  const box = el('div', { class: 'mod-head-picture' });
  box.append(picture(url, {
    alt: '',
    whenBroken: () => box.remove(),
  }));
  return box;
}

/// One of the mod's own downloads, in the small shape the shared button reads.
///
/// The list files carry a cut-down download for the cards; a mod's own file
/// carries the whole thing. Both go through one button, so the two can never
/// disagree about what a download is called.
function bestOf(download) {
  return {
    url: download.directUrl || download.url,
    kind: download.kind,
    // A TriOS link is never counted as needing another step: opening it is the
    // point of it. The same rule the builder sorts by.
    needsAnotherStep: download.kind !== 'trios' && Boolean(download.needsAnotherStep),
  };
}

/// Where the mod lives, besides a download, in the order to fall back through.
/// Each says what to call it when it is the only way to get the mod, and what
/// to call it when there is a download as well.
const PLACES = [
  { field: 'forumUrl', alone: 'Get it from the forum thread', also: 'Official Forum' },
  { field: 'discordUrl', alone: 'Get it from Discord', also: 'On Discord' },
];

/// The buttons that get the mod.
///
/// The first is a download where there is one, picked by the same rule the
/// cards and the rows use — the builder has already put the downloads in order,
/// so this takes the first. Nearly 300 mods have no link that goes straight to
/// a file, and their pages used to end in nothing at all — so for those, going
/// to the thread is the first button instead. Either way the thread is on the
/// page, because that is where the author is.
function howToGetIt(mod, detail) {
  const row = el('div', { class: 'mod-actions' });

  const first = (detail.downloads || [])[0];

  if (first) {
    // Every download is listed further down the page, so this one has no need
    // to say how many there are.
    row.append(downloadButton(
      { ...mod, bestDownload: bestOf(first), downloadCount: 1 },
      { big: true },
    ));
  }

  const place = PLACES.find((p) => detail[p.field]);
  if (place) {
    const icon = pageIcon(place.field);
    row.append(el('a', {
      class: `btn btn-big btn-with-icon${first ? '' : ' btn-primary'}`,
      href: detail[place.field],
      rel: 'noopener nofollow',
      target: '_blank',
    }, [
      icon
        ? el('span', { class: 'original-page-icon', html: icon, 'aria-hidden': 'true' })
        : null,
      el('span', { text: first ? place.also : place.alone }),
    ]));
  }

  row.append(favoriteToggle(mod, { wide: true }));
  return row;
}

/// A small row near the main actions for places where readers can support the
/// author. Downloads and the author's original post stay above it because they
/// are the main reasons most readers open this page.
function supportLinks(detail) {
  const support = detail.supportLinks || [];
  if (!support.length) return null;

  return el('div', { class: 'support-row' }, [
    el('span', { class: 'support-label', text: 'Support the author' }),
    el('span', { class: 'support-links' }, support.map((one) => el('a', {
      href: one.url,
      target: '_blank',
      rel: 'noopener nofollow',
      text: SUPPORT_NAMES[one.type] || SUPPORT_NAMES.other,
    }))),
  ]);
}

/// What this mod will not run without, right under the header.
///
/// Nearly every Starsector mod needs LazyLib, MagicLib, GraphicsLib or
/// Nexerelin, and finding that out after the download — from a crash on
/// startup — is the oldest annoyance in Starsector modding.
function needsLine(mod) {
  return neededModsLine('Requires', mod.needs);
}

function downloads(detail) {
  const list = detail.downloads || [];
  if (!list.length) return null;

  const box = el('div', { class: 'download-list' });
  for (const download of list) box.append(downloadRow(download));
  return el('section', { class: 'panel' }, [
    el('h2', { text: list.length === 1 ? 'Download' : 'Every download' }),
    box,
    detail.generatedAt
      ? el('p', {
          class: 'checked-on',
          text: `Last checked ${formatMoment(detail.generatedAt)}.`,
          title: "When these links were last read from the mod's post.",
        })
      : null,
  ]);
}

function downloadRow(download) {
  const label = download.kind === 'mirror' ? 'Mirror'
    : download.kind === 'trios' ? 'Install with TriOS'
      : 'Download';
  return el('div', { class: 'download' }, [
    el('a', {
      class: 'btn btn-primary',
      href: download.directUrl || download.url,
      rel: 'noopener nofollow',
      target: '_blank',
      text: label,
    }),
    download.fileName ? el('span', { class: 'file', text: download.fileName }) : null,
    download.host ? el('span', { class: 'badge', text: download.host }) : null,
    download.needsAnotherStep
      ? el('span', {
          class: 'badge', text: 'Has download page',
          title: "The host's own page opens first; the file comes after that.",
        })
      : null,
  ]);
}

/// The author's description. AI-written words have their own section directly
/// after this one, so the two are never mixed together.
function description(detail) {
  const generated = Boolean(detail.descriptionIsGenerated);
  const formatted = generated ? null : detail.descriptionHtml;
  const text = generated ? null : detail.description;
  const own = Boolean(formatted || text);

  if (!own) {
    return el('section', { class: 'panel' }, [
      el('h2', { text: 'About this mod' }),
      el('p', { class: 'no-description', text: NO_DESCRIPTION }),
    ]);
  }

  // The formatted description is built by the scraper from a short list of safe
  // tags — no scripts, no styles, and pictures written out fresh with nothing
  // but their address and size — so it is put into the page as it arrives,
  // once its pictures have been seen to. Anything else is shown as plain words.
  const body = formatted
    ? postBody(formatted)
    : el('div', { class: 'prose plain', text });

  // A long post would push the screenshots, the downloads and the changelog
  // below the fold, so the description starts cut off, with a line under it
  // that says it can be opened out. The line only appears when there is more
  // to see: a short post is shown whole, with nothing to click.
  const clip = el('div', { class: 'prose-clip' }, [body]);
  const more = el('button', {
    class: 'link-button prose-more',
    type: 'button',
    'aria-expanded': 'false',
  });
  const moreRow = el('p', { class: 'prose-more-row' }, [more]);
  const showAll = () => {
    clip.classList.remove('clipped');
    more.textContent = 'Show less ▴';
    more.setAttribute('aria-expanded', 'true');
  };
  const showSome = () => {
    clip.classList.add('clipped');
    more.textContent = 'Show more ▾';
    more.setAttribute('aria-expanded', 'false');
  };

  // Whether the words overrun the cut-off can only be measured once they are
  // on the page, which is after this function has returned — and it changes
  // as the post's pictures load, since a short post can turn long once its
  // screenshots arrive. So it is measured every time the post changes size,
  // until the reader presses the button and decides for themselves. Starting
  // with the link showing is the safe way round: if the measurement never
  // comes, a reader still has a way to open the post out.
  let readerChose = false;
  const settle = () => {
    if (readerChose || !clip.isConnected) return;
    clip.classList.add('clipped');
    const limit = clip.clientHeight;
    if (limit === 0) return;
    const overruns = body.offsetHeight > limit + 1;
    if (overruns) showSome();
    else clip.classList.remove('clipped');
    moreRow.hidden = !overruns;
  };
  showSome();

  let watcher = null;
  more.addEventListener('click', () => {
    readerChose = true;
    if (watcher) watcher.disconnect();
    if (clip.classList.contains('clipped')) showAll();
    else showSome();
  });
  // While the post is cut off, a click anywhere on it opens it out instead of
  // reaching what was clicked. The reader is looking at a fragment, so a click
  // there means "show me this", not "follow this link" or "play this video".
  // Caught on the way down, so nothing inside the post sees it first.
  clip.addEventListener('click', (e) => {
    if (!clip.classList.contains('clipped')) return;
    e.preventDefault();
    e.stopPropagation();
    readerChose = true;
    if (watcher) watcher.disconnect();
    showAll();
  }, true);
  // Two ways to get the measurement: whenever the browser sizes the post, and
  // a timer a moment after this function returns, for a tab the browser is not
  // drawing (layout is still worked out on demand).
  if (typeof ResizeObserver !== 'undefined') {
    watcher = new ResizeObserver(settle);
    watcher.observe(body);
  }
  setTimeout(settle, 0);

  const section = el('section', { class: 'panel' }, [
    el('div', { class: 'section-head' }, [
      el('h2', { text: 'About this mod' }),
      formatted && /<img\s/i.test(formatted)
        ? picturesSwitch(() => section.replaceWith(description(detail)))
        : null,
    ]),
    clip,
    moreRow,
  ]);
  return section;
}

/// The same choice as "Pictures in descriptions" in Settings, put beside the
/// description itself, because that is where a reader thinks of it. Only drawn
/// when the post has pictures. Pressing it changes the setting for every mod
/// and redraws the description in place, so the reader stays where they are.
function picturesSwitch(redraw) {
  const on = inlinePictures() !== 'off';
  const button = el('button', {
    class: 'link-button pictures-switch',
    type: 'button',
    text: on ? 'Hide pictures' : 'Show pictures',
    title: 'Changes this for every mod. It is also in Settings.',
  });
  button.addEventListener('click', () => {
    setInlinePictures(on ? 'off' : 'on');
    redraw();
  });
  return button;
}

/// The author's post, with its pictures seen to before any of them loads.
///
/// The post is read into a `<template>` first, because putting it straight into
/// an element — even one not yet on the page — starts every picture in it
/// downloading, and a reader who turned pictures off must not pay for them.
///
/// With pictures on, a picture that will not load is taken out, and a picture
/// that is not a link opens over the page. With them off, each becomes a small
/// "picture" link instead. Either way, a link whose only content was a
/// picture is left with its address in the picture's place, so a badge used as
/// a download button still works.
function postBody(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  const content = template.content;
  const showPictures = inlinePictures() !== 'off';

  // The pictures the viewer steps through, in the order the post has them.
  const viewable = [];
  const open = (image) => showPicture(viewable, viewable.indexOf(image));

  for (const video of [...content.querySelectorAll('a.video-link')]) {
    youTubePreview(video, showPictures);
  }

  for (const img of [...content.querySelectorAll('img')]) {
    // A video's thumbnail was seen to above.
    if (img.closest('a.video-link')) continue;
    const image = {
      url: img.getAttribute('src'),
      caption: img.getAttribute('alt') || null,
    };
    const link = img.closest('a');
    const onlyContentOfLink = Boolean(link)
      && link.textContent.trim() === ''
      && link.querySelectorAll('img').length === 1;

    // What is left of a picture inside a link once the picture is gone.
    const linkWords = () => document.createTextNode(link.getAttribute('href'));

    if (!showPictures) {
      if (link) {
        if (onlyContentOfLink) img.replaceWith(linkWords());
        else img.remove();
        continue;
      }
      viewable.push(image);
      const stand = el('button', {
        class: 'link-button inline-picture-link',
        type: 'button',
        text: 'picture',
        title: image.caption || 'Open this picture',
      });
      stand.addEventListener('click', () => open(image));
      img.replaceWith(stand);
      continue;
    }

    img.addEventListener('error', () => {
      const gone = viewable.indexOf(image);
      if (gone >= 0) viewable.splice(gone, 1);
      if (onlyContentOfLink) img.replaceWith(linkWords());
      else img.remove();
    });
    if (!link) {
      viewable.push(image);
      img.classList.add('inline-picture');
      img.addEventListener('click', () => open(image));
    }
  }

  const body = el('div', { class: 'prose' });
  body.append(content);
  return body;
}

/// A YouTube video in a description: the builder writes a plain link to the
/// video holding its thumbnail. A plain click plays it right there instead,
/// with YouTube's privacy-enhanced player, so nothing of YouTube's player is
/// loaded until the reader asks. A click with a key held, or a middle click,
/// still opens the video on YouTube.
///
/// With pictures turned off, or when the thumbnail will not load, the link
/// reads "Video on YouTube" instead, and no thumbnail is fetched.
function youTubePreview(link, showPictures) {
  const thumb = link.querySelector('img');
  const asWords = () => {
    link.classList.add('as-words');
    link.replaceChildren('▶ Video on YouTube');
  };
  if (!showPictures || !thumb) {
    asWords();
    return;
  }
  thumb.addEventListener('error', asWords);

  let id = null;
  try {
    id = new URL(link.getAttribute('href')).searchParams.get('v');
  } catch {
    // Not an address; it stays a plain link.
  }
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) return;

  link.addEventListener('click', (e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (link.classList.contains('as-words')) return;
    e.preventDefault();
    // The player sits in the same 16:9 box the thumbnail did, so the page
    // does not move. YouTube refuses to play in a frame that sends no
    // referrer at all, so this one sends the site's address and nothing more.
    const player = el('iframe', {
      class: 'video-player',
      src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`,
      title: 'YouTube video',
      allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
      allowfullscreen: '',
      referrerpolicy: 'strict-origin-when-cross-origin',
    });
    link.replaceWith(player);
  });
}

/// The AI paragraph, shown for either enabled summary setting. `aiSummaryOf`
/// also handles older data and leaves this section out when the reader chose
/// "Never".
function aiSummary(detail) {
  const words = aiSummaryOf({
    aiSummary: detail.aiDescription,
    summary: detail.description,
    summaryIsGenerated: Boolean(detail.descriptionIsGenerated),
  });
  if (!words) return null;

  return el('div', { class: 'panel' }, [
    el('div', {
      class: 'summary-block',
      title: summaryTitle({ text: words, generated: true }),
    }, [
      el('div', { class: 'prose plain' }, [
        el('p', {}, [aiSparkle(words), ' ', words]),
      ]),
      aiSummaryNote(),
    ]),
  ]);
}

function gallery(detail) {
  const images = detail.gallery || [];
  if (!images.length) return null;

  // Buttons, badges and small icons are published too, but kept out of the
  // way behind a button, so the section reads as screenshots first.
  const smallCount = images.filter((image) => image.small).length;
  let showSmall = false;

  // A picture that will not load takes its button with it, so the grid holds
  // no empty boxes to click on. A picture that does load opens over the page
  // rather than in a new tab, so a reader can look through the lot and still be
  // where they were. The viewer only steps through the pictures showing.
  const broken = new Set();
  const showing = () => images.filter((image) =>
    !broken.has(image) && (showSmall || !image.small));
  const grid = el('div', { class: 'gallery' });
  const buttons = new Map();
  images.forEach((image) => {
    const button = el('button', {
      class: 'shot',
      title: image.caption || 'Open screenshot',
    });
    button.hidden = Boolean(image.small);
    button.append(picture(image.url, {
      alt: image.caption || '',
      whenBroken: () => {
        button.remove();
        broken.add(image);
      },
    }));
    button.addEventListener('click', () => {
      const list = showing();
      showPicture(list, list.indexOf(image));
    });
    buttons.set(image, button);
    grid.append(button);
  });

  let toggle = null;
  if (smallCount) {
    toggle = el('button', {
      class: 'link-button small-pictures-toggle', type: 'button',
    });
    const label = () => {
      toggle.textContent = showSmall
        ? 'Hide small pictures'
        : `Show ${smallCount} small ${smallCount === 1 ? 'picture' : 'pictures'}`;
      toggle.setAttribute('aria-expanded', String(showSmall));
    };
    label();
    toggle.addEventListener('click', () => {
      showSmall = !showSmall;
      for (const [image, button] of buttons) {
        if (image.small) button.hidden = !showSmall;
      }
      label();
    });
  }

  return el('section', { class: 'panel' }, [
    el('h2', { text: 'Screenshots' }),
    grid,
    toggle ? el('p', { class: 'small-pictures-row' }, [toggle]) : null,
  ]);
}

function changelog(detail) {
  const entries = Object.entries(detail.changelog || {});
  if (!entries.length && !detail.changelogUrl) return null;

  const box = el('div', {});
  entries.forEach(([version, notes], i) => {
    box.append(el('details', { class: 'changelog-entry', open: i === 0 ? '' : null }, [
      el('summary', { text: version }),
      el('pre', { text: notes }),
    ]));
  });
  if (detail.changelogUrl) {
    box.append(el('p', {}, [
      el('a', {
        href: detail.changelogUrl, target: '_blank', rel: 'noopener nofollow',
        text: 'The full changelog →',
      }),
    ]));
  }
  return el('section', { class: 'panel' }, [
    el('h2', { text: 'Changelog' }), box,
  ]);
}

function releases(detail) {
  const list = detail.releases || [];
  if (!list.length) return null;

  const rows = el('div', { class: 'release-list' });
  for (const release of list) {
    rows.append(el('details', { class: release.changelogNotes ? 'release' : 'release no-notes' }, [
      el('summary', {}, [
        el('span', { class: 'badge version', text: release.newVersion }),
        el('span', {
          class: 'release-versions',
          text: release.oldVersion
            ? `from ${release.oldVersion} on ${formatDay(release.seenOn)}`
            : formatDay(release.seenOn),
        }),
      ]),
      release.changelogNotes
        ? el('pre', { class: 'release-notes', text: release.changelogNotes })
        : null,
    ]));
  }
  return el('section', { class: 'panel' }, [
    el('h2', { text: 'Release history' }), rows,
  ]);
}

/// The other downloads on the same thread, in two boxes rather than one.
///
/// They used to share a box headed "Add-ons on the same thread", which told a
/// reader that "Postmodern Carriers Lite" was something to install as well as
/// Postmodern Carriers. It is the same mod cut down, and you install it
/// instead. Anything the extractor called a variant is another build; anything
/// else needs the mod and goes beside it.
function addons(detail) {
  const list = detail.addons || [];
  if (!list.length) return null;

  const versions = list.filter((a) => a.role === 'variant');
  const extras = list.filter((a) => a.role !== 'variant');

  return el('div', { class: 'stack' }, [
    addonBox(extras, 'Add-ons on the same thread', null),
    addonBox(
      versions,
      'Other versions of this mod',
      null,
    ),
  ]);
}

function addonBox(list, heading, note) {
  if (!list.length) return null;

  const box = el('div', { class: 'stack' });
  for (const addon of list) {
    box.append(el('div', {}, [
      el('h3', { text: addon.name }),
      addon.requires
        ? el('div', { class: 'card-authors', text: `Requires ${addon.requires}` })
        : null,
      el('div', { class: 'download-list' }, (addon.downloads || []).map(downloadRow)),
    ]));
  }
  return el('section', { class: 'panel' }, [
    el('h2', { text: heading }),
    note ? el('p', { class: 'card-authors', text: note }) : null,
    box,
  ]);
}

/// The chip for each short answer on saves. "Depends" and "Unknown" get no
/// colour.
const SAVE_ANSWERS = {
  yes: ['save-ok', 'Yes'],
  no: ['save-no', 'No'],
  depends: ['', 'Depends'],
  unknown: ['save-unknown', 'Unknown'],
};

/// Whether the mod can go into a game in progress, and come out of one: a
/// question, a short answer and the author's words, one row each. Both rows
/// are shown once the author has said anything, so a question they never
/// answered reads as "Unknown" rather than vanishing. Updating is left to the
/// badge beside the version, because an update note belongs to one release.
function saves(detail) {
  const questions = [
    ['Add mid-game?', detail.saveCompatibilityText, detail.canAdd],
    ['Remove from game?', detail.removalCompatibilityText, detail.canRemove],
  ];
  if (!questions.some(([, words]) => words)) return null;

  const authors = joinNames((detail.listing || {}).authors || []);
  const quoted = new Set();
  const rows = el('div', { class: 'save-lines' });
  for (const [question, words, answer] of questions) {
    const shown = words ? answer : 'unknown';
    const chip = SAVE_ANSWERS[shown];
    // Where the model copied the same words into both fields, they are quoted
    // on the first row only.
    const quote = words && !quoted.has(words)
      ? el('q', {
          class: 'save-words',
          text: chip ? withoutLeadingAnswer(words, shown) : words,
          title: authors ? `${authors}, in the mod's forum thread` : null,
        })
      : el('span');
    if (words) quoted.add(words);
    rows.append(
      el('span', { class: 'save-question', text: question }),
      chip ? el('span', { class: `badge ${chip[0]}`.trim(), text: chip[1] }) : el('span'),
      quote,
    );
  }

  return el('div', { class: 'save-box' }, [
    el('span', { class: 'needs-label', text: 'Save compatibility' }),
    rows,
  ]);
}

/// The author's words with a leading "Yes." or "No." taken off when the chip
/// beside them already says it, so the answer is not read twice.
function withoutLeadingAnswer(words, answer) {
  if (answer !== 'yes' && answer !== 'no') return words;
  const rest = words.replace(new RegExp(`^${answer}\\b[\\s.,!:;\u2014-]*`, 'i'), '');
  if (!rest || rest === words) return words;
  return rest[0].toUpperCase() + rest.slice(1);
}

/// The links out and the license. The whole box is left out when the mod has
/// none of them. Support links sit near the main actions instead.
function facts(detail) {
  const rows = [];
  const link = (label, url, text) => {
    if (!url) return;
    rows.push([label, el('a', {
      href: url, target: '_blank', rel: 'noopener nofollow', text: text || url,
    })]);
  };

  link('Forum thread', detail.forumUrl, 'On the Starsector forum');
  link('Discord', detail.discordUrl, 'On Discord');
  link('Source code', detail.sourceCodeUrl);
  if (detail.license) rows.push(['License', el('span', { text: detail.license })]);
  const listing = detail.listing || {};
  if ((listing.categories || []).length) {
    rows.push(['Category', el('span', { text: joinNames(listing.categories) })]);
  }
  // What each source actually called it, which is not always what the site
  // does. Left out when it says nothing the line above did not.
  const raw = detail.rawCategories || [];
  if (raw.length && joinNames(raw) !== joinNames(listing.categories || [])) {
    rows.push(['Original categories', el('span', {
      class: 'dim', text: joinNames(raw),
      title: 'The original categories on the forum and/or Discord.',
    })]);
  }
  if ((listing.sources || []).length) {
    rows.push(['Found on',
      el('span', { text: joinNames(listing.sources.map(sourceName)) })]);
  }

  if (!rows.length) return null;

  const facts = el('dl', { class: 'fact-list' });
  for (const [label, value] of rows) {
    facts.append(el('dt', { text: label }), el('dd', {}, [value]));
  }
  return el('section', { class: 'panel' }, [
    el('h2', { text: 'Details' }), facts,
  ]);
}

/// The other mods on the site that carry this one's name.
///
/// Dozens of names here belong to more than one mod. Some are a mod's own older
/// thread, which often holds the last build that ran on an older game version.
/// Some are a fork that kept the name of the mod it forked, which is often the
/// only build that runs on the current one. Some are two people who happened to
/// pick the same name. All three are worth keeping, so the site keeps them all
/// and says which is which instead of choosing for the reader.
///
/// The day each thread was last posted on leads the facts, because it is the
/// one that separates a live thread from an archive. Everything else about a
/// pair like this is either the same on both or missing.
function sameNameMods(detail) {
  const others = detail.sameNameMods || [];
  if (!others.length) return null;

  const rows = el('div', { class: 'mod-rows' });
  for (const other of others) {
    const saidAbout = [
      (other.authors || []).length ? `by ${joinNames(other.authors)}` : null,
      other.threadLastPostOn
        ? `thread last posted ${formatDay(other.threadLastPostOn)}`
        : null,
      other.gameVersion ? `for Starsector ${other.gameVersion}` : null,
      other.modVersion ? `version ${other.modVersion}` : null,
    ].filter(Boolean);

    // A page here where we have one, and the forum thread where we do not.
    const inner = other.id
      ? el('a', { class: 'row-inner', href: modHref(other.id) })
      : el('a', {
          class: 'row-inner', href: other.url,
          target: '_blank', rel: 'noopener nofollow',
        });
    inner.append(el('div', { class: 'row-main' }, [
      el('div', { class: 'row-title', text: other.title }),
      saidAbout.length
        ? el('div', { class: 'row-sub', text: saidAbout.join(' · ') })
        : null,
    ]));
    rows.append(el('div', { class: 'mod-row' }, [inner]));
  }

  const many = others.length > 1;
  return el('section', { class: 'panel name-share' }, [
    el('h3', { text: `Note: ${many ? 'other mods have' : 'another mod has'} the same name` }),
    el('p', {
      class: 'sub',
      text: `${many ? 'Each' : 'It'} may be an older thread for this mod, a fork `
        + 'of it, or a different mod altogether.',
    }),
    rows,
  ]);
}

/// The rest of this person's mods, at the foot, so the page leads somewhere
/// instead of stopping.
function moreByTheAuthor(mod, everyMod, currentVersion) {
  const people = new Set((mod.authors || []).map((a) => a.toLowerCase()));
  if (!people.size) return null;

  const theirs = everyMod.filter((other) => other.id !== mod.id
    && (other.authors || []).some((a) => people.has(a.toLowerCase())));
  if (!theirs.length) return null;

  const who = (mod.authors || []).length === 1 ? mod.authors[0] : 'these authors';
  return el('section', { class: 'stack' }, [
    el('h2', { text: `More by ${who}` }),
    strip(theirs, currentVersion),
  ]);
}

/// Other mods on the same shelves, the ones sharing most of them first.
///
/// A mod under "Faction" and "Ship Pack" has more in common with another mod
/// under both than with one that only happens to share "Everything else", so
/// how many categories overlap decides the order and the release date only
/// settles ties. It is still not clever, but it is the difference between a
/// page that ends and a page that leads on.
function similarMods(mod, everyMod, currentVersion) {
  const shelves = new Set(mod.categories || []);
  if (!shelves.size) return null;

  const people = new Set((mod.authors || []).map((a) => a.toLowerCase()));
  const shared = (other) =>
    (other.categories || []).filter((c) => shelves.has(c)).length;
  const alike = everyMod.filter((other) => other.id !== mod.id
    // Not this person's own mods — those have their own strip above.
    && !(other.authors || []).some((a) => people.has(a.toLowerCase()))
    && shared(other) > 0);
  if (!alike.length) return null;

  // Sorted by release date first, then by how much they share, because a sort
  // keeps the order of equal items — so mods sharing the same number of
  // categories come out newest first.
  const ranked = newestFirst(alike).sort((a, b) => shared(b) - shared(a));

  return el('section', { class: 'stack' }, [
    el('h2', { text: 'Similar mods' }),
    strip(ranked, currentVersion, { alreadyOrdered: true }),
  ]);
}

/// A short row of cards, newest first, the same shape Home uses. A caller that
/// has already put the mods in the order it wants says so.
function strip(mods, currentVersion, { alreadyOrdered = false } = {}) {
  const row = el('div', { class: 'strip' });
  const inOrder = alreadyOrdered ? mods : newestFirst(mods);
  for (const mod of inOrder.slice(0, RELATED_COUNT)) {
    row.append(modCard(mod, currentVersion));
  }
  return row;
}

/// The "See raw info" fold at the very foot of the page: everything the site
/// holds about this mod, straight from its published file, laid out field by
/// field. It is for working out why a page looks wrong — a reader never needs
/// it, so it sits closed and quiet under everything else, and its insides are
/// only built the first time somebody opens it.
function rawInfo(detail, id) {
  const fold = el('details', { class: 'raw-info' }, [
    el('summary', { text: 'See raw info' }),
  ]);
  let built = false;
  fold.addEventListener('toggle', () => {
    if (built || !fold.open) return;
    built = true;
    fold.append(rawInfoBody(detail, id));
  });
  return fold;
}

function rawInfoBody(detail, id) {
  const file = `mods/${encodeURIComponent(id)}.json`;
  const copy = el('button', { class: 'btn', text: 'Copy as JSON' });
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(detail, null, 2));
      copy.textContent = 'Copied';
    } catch {
      copy.textContent = 'Could not copy';
    }
    setTimeout(() => { copy.textContent = 'Copy as JSON'; }, 2000);
  });

  return el('div', { class: 'panel raw-info-body' }, [
    el('div', { class: 'raw-info-tools' }, [
      copy,
      el('a', {
        class: 'btn', href: DATA_BASE + file, target: '_blank', rel: 'noopener',
        text: 'Open the file',
        title: `The published file this is read from: ${file}`,
      }),
    ]),
    el('div', { class: 'raw-tree' }, [rawValue(detail)]),
  ]);
}

/// One value from the mod's file, whatever its shape, drawn so it can be read:
/// an object as field names down the left, a list as numbered entries, a long
/// or HTML string as a scrolling block of plain text (never put into the page
/// as markup), an address as a link, and everything else as itself.
function rawValue(value) {
  if (value === null || value === undefined) {
    return el('span', { class: 'raw-none', text: 'nothing' });
  }
  if (Array.isArray(value)) {
    if (!value.length) return el('span', { class: 'raw-none', text: 'empty list' });
    const rows = el('div', { class: 'raw-branch' });
    value.forEach((entry, i) => {
      rows.append(el('span', { class: 'raw-name', text: `${i + 1}.` }),
        el('div', { class: 'raw-cell' }, [rawValue(entry)]));
    });
    return rows;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (!keys.length) return el('span', { class: 'raw-none', text: 'empty' });
    const rows = el('div', { class: 'raw-branch' });
    for (const key of keys) {
      rows.append(el('span', { class: 'raw-name', text: key }),
        el('div', { class: 'raw-cell' }, [rawValue(value[key])]));
    }
    return rows;
  }
  if (typeof value === 'string') {
    if (value.length > 160 || value.includes('\n') || value.includes('<')) {
      return el('pre', { class: 'raw-text', text: value });
    }
    if (/^https?:\/\//.test(value)) {
      return el('a', {
        href: value, target: '_blank', rel: 'noopener nofollow', text: value,
      });
    }
  }
  return el('span', { text: String(value) });
}

/// Most recently released first, then by name. A mod with no release yet sorts
/// last, whichever way round the dates are.
function newestFirst(mods) {
  return [...mods].sort((a, b) => {
    const left = a.lastReleaseDate || '';
    const right = b.lastReleaseDate || '';
    if (left === right) return modName(a).localeCompare(modName(b));
    if (!left) return 1;
    if (!right) return -1;
    return right.localeCompare(left);
  });
}
