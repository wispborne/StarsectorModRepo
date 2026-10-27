// One mod's own page, at an address built from its permanent id. The id never
// changes, so this address holds even when the mod's thread is renamed by its
// next release.
//
// A part the mod has nothing for is left out entirely rather than drawn empty,
// so a thin page reads as deliberate instead of broken.

import {
  aiOnModPages, aiSparkle, aiSummaryNote, aiSummaryOf, akaText, imageCaption, imageHoverText,
  clear,
  currentGameVersion, DATA_BASE, downloadButton, el, errorPanel, expandAllButton, formatDay,
  favoriteToggle, formatMoment, imageUrlOf, inlinePictures, isMissingFile, joinNames, quickTip,
  setAiOnModPages, setInlinePictures, summaryToShow,
  modDetail, modHref, modList, modName, MOD_VERSION_NOTE,
  NO_DESCRIPTION, pageIcon, picture, reduceMotion, showPicture, summaryTitle,
  takedownButton, versionStanding, versionStandingNote, withSource,
} from '../lib.js';
import { address } from '../address.js';
import { SUPPORT_ICONS } from '../support_icons.js';
import * as notFound from './not_found.js';

// How many rows each of the side column's two short lists shows.
const RELATED_SIDE_COUNT = 5;

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
};

/// What a support link's button says. A site with a name of its own (Patreon,
/// Ko-fi…) is called by it, the same on every mod. Any other is called by the
/// words the model gave it, or failing those by its host — never by one shared
/// word, or a mod with three such links shows three identical buttons.
function supportName(link) {
  if (SUPPORT_NAMES[link.type]) return SUPPORT_NAMES[link.type];
  if (link.label) return link.label;
  try {
    return new URL(link.url).host.replace(/^www\./, '');
  } catch {
    return 'Donate';
  }
}

export async function render(root, parts) {
  const id = parts[0];
  if (!id) {
    clear(root).append(errorPanel(new Error('No mod was named in the address.')));
    return;
  }

  let detail;
  try {
    detail = await modDetail(id);
  } catch (err) {
    // Only a file that is not there means there is no such mod. A dropped
    // connection or a server error says so instead, with its reason.
    if (isMissingFile(err)) {
      notFound.render(root);
    } else {
      clear(root).append(errorPanel(new Error(`This mod could not be loaded: ${err && err.message ? err.message : err}`)));
    }
    return;
  }

  // Taken-down mods have a file that tells us to show the not-found view.
  // The host keeps serving deleted files for up to a week.
  if (detail.gone) {
    notFound.render(root);
    return;
  }

  // An old address whose mod was joined into another: on to that mod's page.
  if (detail.movedTo) {
    address().redirect(modHref(detail.movedTo));
    return;
  }

  // An address that turned out to be a post holding several mods: it keeps
  // its page, which now lists the mods instead of standing for one of them.
  if (detail.collection) {
    await collectionPage(root, detail.collection);
    return;
  }

  const mod = detail.listing || {};
  const shownName = modName(mod);
  document.title = `${shownName} | Starmodder`;

  // The list is also what the side column's "More by" and "Similar mods"
  // lists are built from. A page that will not load it still draws everything else.
  let everyMod = [];
  try {
    everyMod = (await modList()).mods || [];
  } catch {
    everyMod = [];
  }
  const currentVersion = currentGameVersion(everyMod);

  clear(root);
  // A small link back rather than the full breadcrumb trail every other page
  // carries: the nav bar already says where Home and Browse are, and the
  // room is worth more to the cards at the side.
  root.append(el('a', { class: 'back-link', href: '#/browse', text: '‹ Browse mods' }));

  // The gallery drops pictures as they load and turn out not to be
  // screenshots, so its tab's count is a live number.
  const galleryCount = el('span', { class: 'mod-tab-count' });
  const galleryPanel = gallery(detail, (count) => {
    galleryCount.textContent = String(count);
    galleryCount.hidden = !count;
  });

  // Each post sits in a holder that is never swapped out, so a post that
  // redraws itself (pictures on or off) is still the one its tab and its jump
  // link point at.
  const forumPost = holderFor(description(detail), 'post');
  const discordPostPart = holderFor(discordPost(detail), 'discord-post');

  const sections = tabs(id, [
    { label: 'Description', parts: [aiSummary(detail, mod), forumPost, discordPostPart] },
    { label: 'Gallery', countNode: galleryCount, parts: [galleryPanel] },
    // The author's changelog and the releases this site noticed are one
    // question — what changed, and when — so they share a tab.
    { label: 'Recent Updates', parts: [changelog(detail), releases(detail)] },
    { label: 'Add-ons', count: (detail.addons || []).length, parts: [addons(detail)] },
  ]);

  const forumHeading = Boolean(detail.descriptionIsForumPost);
  const header = modHeader(mod, detail, shownName);
  const jumps = jumpLinks(sections, [
    { node: header, text: 'Header' },
    forumPost && { node: forumPost, text: forumHeading ? 'Forum post' : 'About this mod' },
    discordPostPart && { node: discordPostPart, text: 'Discord post' },
  ]);

  // The header above the mod on the left; the side column at the right starts
  // level with the header, so the download card sits beside the mod's name.
  root.append(el('div', { class: 'stack' }, [
    el('div', { class: 'mod-layout' }, [
      header,
      el('div', { class: 'mod-main stack' }, [
        sameNameMods(detail),
        sections,
      ]),
      // One column that stays in view while the post is read: the buttons
      // that get the mod, then everything else about the mod as one panel,
      // then "On this page", which is about the page and not the mod. On a
      // narrow screen the column stands aside (`display: contents`) so the
      // download card can come before the mod and the other cards after it.
      el('div', { class: 'mod-aside' }, [
        el('aside', { class: 'mod-get' }, [howToGetIt(mod, detail)]),
        el('aside', { class: 'mod-side side-merged stack' }, [
          codeAndSupport(detail),
          compatibility(detail, currentVersion),
          facts(detail),
          downloads(detail),
        ]),
        jumps && el('aside', { class: 'mod-jumps' }, [jumps]),
        relatedLists(mod, everyMod, currentVersion),
      ]),
    ]),
    rawInfo(detail, id),
    el('div', {}, [takedownButton()]),
  ]));
}

/// The mod's sections as tabs. A tab with nothing in it is not drawn, and a mod
/// with only one has no tab row at all.
///
/// The open tab is kept in the address as a plain hash after the mod's own
/// path — `mods/<id>/#gallery` — so a link can open a mod on a tab. On a mod's
/// page the route is read from the path alone, so the hash names no page. The
/// first tab is the page as it opens and writes no hash. A move between tabs
/// replaces the address rather than adding to the history, so Back leaves the
/// mod instead of stepping back through its tabs.
///
/// Each tab is a real link to that address, so it can be copied or opened in a
/// new tab. A plain click is kept on this page: the site's link handling would
/// otherwise read `#gallery` on the site's root as a page called "gallery".
function tabs(modId, list) {
  const shown = list
    .map((tab) => ({ ...tab, parts: tab.parts.filter(Boolean), key: tabKey(tab.label) }))
    .filter((tab) => tab.parts.length);
  if (!shown.length) return null;
  if (shown.length === 1) {
    const only = el('div', { class: 'stack' }, shown[0].parts);
    only.openHolding = () => {};
    return only;
  }

  const addressOf = (tab) => (tab === shown[0]
    ? modHref(modId)
    : `${modHref(modId)}#${tab.key}`);

  const bar = el('div', { class: 'mod-tabs', role: 'tablist' });
  const holder = el('div', { class: 'stack' });
  const links = shown.map((tab) => {
    const link = el('a', {
      class: 'mod-tab', role: 'tab', href: addressOf(tab),
    }, [
      tab.label,
      tab.countNode
        || (tab.count ? el('span', { class: 'mod-tab-count', text: String(tab.count) }) : null),
    ]);
    link.addEventListener('click', (e) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      open(tab);
      address().replace(addressOf(tab));
    });
    bar.append(link);
    return link;
  });
  const open = (tab) => {
    shown.forEach((one, i) => {
      links[i].classList.toggle('on', one === tab);
      links[i].setAttribute('aria-selected', String(one === tab));
    });
    holder.replaceChildren(...tab.parts);
  };

  // A hash that names no tab here, or a tab this mod has nothing in, opens
  // the first one.
  const asked = location.hash.replace(/^#/, '');
  open(shown.find((tab) => tab.key === asked) || shown[0]);
  const box = el('div', { class: 'stack' }, [bar, holder]);
  // Opens the tab [part] is on, for a jump link to something on a tab that is
  // not showing.
  box.openHolding = (part) => {
    const tab = shown.find((one) => one.parts.includes(part));
    if (!tab) return;
    open(tab);
    address().replace(addressOf(tab));
  };
  return box;
}

/// [part] inside a holder that stays put, with an id a jump link can find.
/// Null when there is no part.
function holderFor(part, id) {
  if (!part) return null;
  return el('div', { class: 'jump-target', id: `section-${id}` }, [part]);
}

/// "On this page": a link back up to the header and to each post, so a
/// reader can reach the Discord post under a long forum post in one press.
///
/// It is drawn the way other sites draw a table of contents, so it does not
/// read as a second list of links out: quiet words with no icons, down a thin
/// line, and the part of the page being read is lit on that line.
///
/// These are buttons, not `#` links: on this site the hash picks the page, so
/// a hash link to a section would be read as a page of that name.
function jumpLinks(sections, entries) {
  const kept = entries.filter((entry) => entry && entry.text);
  if (!kept.length) return null;
  const buttons = kept.map(({ node, text }) => {
    const button = el('button', { class: 'link-button jump-link', type: 'button', text });
    button.addEventListener('click', () => {
      if (!node.isConnected && sections) sections.openHolding(node);
      const smooth = !reduceMotion();
      node.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
    });
    return button;
  });
  const list = el('div', { class: 'jump-list' }, buttons);
  litWhileRead(list, kept.map((entry) => entry.node), buttons);
  return el('section', { class: 'panel side-card' }, [
    el('h2', { class: 'side-heading', text: 'On this page' }),
    list,
  ]);
}

/// Lights the button for the part of the page being read: the last part
/// whose top has gone above a line a little below the top bar. Nothing is lit
/// before the first part reaches that line, and the last part is lit once the
/// page has been scrolled as far as it goes, since a short last part may never
/// reach it.
/// A part in a tab that is not showing is skipped. The watch stops itself
/// once the list has left the page.
function litWhileRead(list, nodes, buttons) {
  const line = 140;
  let waiting = false;
  let shown = false;
  const update = () => {
    waiting = false;
    if (!list.isConnected) {
      // The list is built before it is put on the page, so only a list that
      // has been on the page and left it is finished with.
      if (shown) {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
      }
      return;
    }
    shown = true;
    let lit = -1;
    nodes.forEach((node, i) => {
      if (node.isConnected && node.getBoundingClientRect().top <= line) lit = i;
    });
    const atFoot = window.scrollY > 0 && window.innerHeight + window.scrollY
      >= document.documentElement.scrollHeight - 2;
    if (atFoot) {
      for (let i = nodes.length - 1; i >= 0; i--) {
        if (nodes[i].isConnected) { lit = i; break; }
      }
    }
    buttons.forEach((button, i) => button.classList.toggle('lit', i === lit));
  };
  const onScroll = () => {
    if (waiting) return;
    waiting = true;
    requestAnimationFrame(update);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  requestAnimationFrame(update);
}

/// A tab's name as it is written in the address: "Recent Updates" is
/// `recent-updates`.
function tabKey(label) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// The game version is not here: the Compatibility card at the side has it.
function modHeader(mod, detail, shownName) {
  const chips = el('div', { class: 'mod-meta' });
  if (mod.modVersion) {
    chips.append(el('span', {
      class: 'badge version', text: mod.modVersion, title: MOD_VERSION_NOTE,
    }));
  }
  if (mod.isWorkInProgress) chips.append(el('span', { class: 'badge wip', text: 'Work in progress' }));
  if (mod.isTool) {
    chips.append(el('span', {
      class: 'badge tool', text: 'Tool',
      title: 'A separate program, such as a launcher or mod editor.',
    }));
  }
  for (const category of mod.categories || []) {
    chips.append(el('span', { class: 'badge', text: category }));
  }

  const byline = el('div', { class: 'mod-byline' });
  if ((mod.authors || []).length) {
    const authors = el('span', { class: 'mod-authors' }, ['by ']);
    mod.authors.forEach((name, i) => {
      if (i) authors.append(document.createTextNode(', '));
      authors.append(quickTip(
        el('a', { href: `#/authors/${encodeURIComponent(name)}`, text: name }),
        akaText(mod, name),
      ));
    });
    byline.append(authors);
  }
  byline.append(chips);

  return el('div', { class: 'mod-head' }, [
    headPicture(mod),
    el('div', { class: 'mod-head-words' }, [
      el('h1', { text: shownName }),
      // The thread's own title, where it says more than the name does.
      shownName === mod.name
        ? null
        : el('span', { class: 'sub thread-title' }, [
          'Original title: ',
          el('i', { text: mod.name }),
        ]),
      partOfThreadLine(mod),
      el('div', { class: 'mod-summary-slot' }, [headSummary(mod)]),
      byline,
    ]),
  ]);
}

function headSummary(mod) {
  let summary = summaryToShow(mod);
  if (summary?.generated && aiOnModPages() === 'hide') {
    summary = !mod.summaryIsGenerated && mod.summary
      ? { text: mod.summary, generated: false }
      : null;
  }
  if (!summary) return null;
  return el('p', {
    class: 'mod-summary',
    title: summaryTitle(summary),
  }, [summary.generated ? aiSparkle(summary.text) : null,
    summary.generated ? ' ' : null, summary.text]);
}

function headPicture(mod) {
  const url = imageUrlOf(mod);
  if (!url) return null;
  const box = el('button', {
    class: 'mod-head-picture', type: 'button', title: 'Open the picture',
  });
  box.append(picture(url, { alt: '', whenBroken: () => box.remove() }));
  box.addEventListener('click', () => showPicture([{ url, caption: null }], 0));
  return box;
}

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
  line.append(document.createTextNode(', a thread with multiple mods.'));
  return line;
}

// Adapt a full download to the shared button’s compact download shape.
function bestOf(download) {
  return {
    url: download.directUrl || download.url,
    kind: download.kind,
    // A TriOS link is never counted as needing another step: opening it is the
    // point of it. The same rule the builder sorts by.
    needsAnotherStep: download.kind !== 'trios' && Boolean(download.needsAnotherStep),
  };
}

const PLACES = [
  { field: 'forumUrl', alone: 'Forum thread', also: 'Forum' },
  { field: 'discordUrl', alone: 'Discord', also: 'Discord' },
];

// Downloads are already sorted by the builder. Offer a plain download
// below a TriOS link for readers who do not use TriOS.
function howToGetIt(mod, detail) {
  const list = detail.downloads || [];
  const { first, plain } = topDownloads(list);
  const card = el('section', { class: 'panel side-card get-it' });
  // When the links were last read from the post, on hover over the download
  // buttons rather than a line of its own.
  const checked = detail.generatedAt
    ? `Links last checked ${formatMoment(detail.generatedAt)}`
    : null;

  if (first) {
    const main = downloadButton(
      { ...mod, bestDownload: bestOf(first), downloadCount: 1 },
      { big: true },
    );
    main.classList.add('btn-solid');
    if (checked) main.title = checked;
    card.append(main);
  }

  // Everything but the main button shares one row of smaller buttons, so the
  // card stays short.
  const row = el('div', { class: 'get-it-row' });
  if (plain) row.append(plainDownloadButton(plain, checked));
  const place = PLACES.find((p) => detail[p.field]);
  if (place) {
    const icon = pageIcon(place.field);
    const button = el('a', {
      class: `btn btn-with-icon${first ? '' : ' btn-big'}`,
      href: detail[place.field],
      rel: 'noopener nofollow',
      target: '_blank',
    }, [
      icon
        ? el('span', { class: 'original-page-icon', html: icon, 'aria-hidden': 'true' })
        : null,
      el('span', { text: first ? place.also : place.alone }),
    ]);
    if (first) {
      row.append(button);
    } else {
      button.classList.add('btn-solid');
      card.append(button);
    }
  }
  const favorite = favoriteToggle(mod, { wide: true });
  favorite.classList.remove('btn-big');
  row.append(favorite);
  card.append(row);
  return card;
}

/// The source code, the license and the support links, in a card of their
/// own at the top of the side. The source code row is always there, so the
/// card always is.
function codeAndSupport(detail) {
  const support = supportLinks(detail);
  return el('section', { class: 'panel side-card' }, [
    el('h2', { class: 'side-heading', text: 'Links' }),
    el('div', { class: 'side-facts' }, [
      // The code and the license it is shared under are one question — can I
      // look at it and reuse it — so they share a row. The license is its
      // short name, with the author's own wording on hover.
      sideFact('Source code', el('span', { class: 'code-and-license' }, [
        detail.license
          ? el('span', {
              class: 'license-name',
              text: shortLicenseName(detail.license),
              title: `License: ${detail.license}`,
            })
          : null,
        sourceCodeStatus(detail),
      ]), { beside: true }),
      support ? sideFact('Support the author', support, { beside: true }) : null,
      linksOut(detail),
    ].filter(Boolean)),
  ]);
}

/// Plain names for the places a mod's code is kept, by host.
const CODE_HOSTS = {
  'github.com': 'GitHub',
  'gitlab.com': 'GitLab',
  'bitbucket.org': 'Bitbucket',
  'codeberg.org': 'Codeberg',
  'sourceforge.net': 'SourceForge',
};

/// Where the mod's code is kept, named by its host with a green code icon.
/// Sharing the code lets other modders learn from it, fix it, and keep it
/// alive after the author moves on. A mod with no link gets a quiet grey note
/// rather than a warning: data-only mods have no code, and many mods ship
/// their code inside the download, where we cannot see it.
function sourceCodeStatus(detail) {
  const url = detail.sourceCodeUrl;
  let host = '';
  try {
    host = new URL(url).host.replace(/^www\./, '');
  } catch {
    return el('span', {
      class: 'badge source-missing',
      title: "The author's *forum post* has no link to the mod's code. "
        + 'The code may be inside the download, or the mod may be closed source.',
      text: 'Not linked',
    });
  }
  // GitHub gets its own mark; every other host the plain code icon.
  const github = host === 'github.com';
  return el('a', {
    class: 'badge source-link',
    href: url, target: '_blank', rel: 'noopener nofollow',
    title: url,
  }, [
    el('span', {
      class: 'original-page-icon',
      html: github ? GITHUB_MARK : CODE_ICON,
      'aria-hidden': 'true',
    }),
    CODE_HOSTS[host] || host,
  ]);
}

// GitHub's own mark, copied unchanged from its Octicons set (mark-github-16,
// MIT licence). GitHub's brand rules allow it as a link to a project but not
// redrawn or recoloured: it is drawn solid, in the badge's colour, which is the
// page's text colour and so the white or black the rules ask for
// (`.badge.source-link` in style.css).
const GITHUB_MARK = '<svg viewBox="0 0 16 16" width="1em" height="1em" fill="currentColor" '
  + 'focusable="false" aria-hidden="true">'
  + '<path d="M6.766 11.328c-2.063-.25-3.516-1.734-3.516-3.656 0-.781.281-1.625.75-2.188'
  + '-.203-.515-.172-1.609.063-2.062.625-.078 1.468.25 1.968.703.594-.187 1.219-.281 '
  + '1.985-.281.765 0 1.39.094 1.953.265.484-.437 1.344-.765 1.969-.687.218.422.25 '
  + '1.515.046 2.047.5.593.766 1.39.766 2.203 0 1.922-1.453 3.375-3.547 3.64.531.344.89 '
  + '1.094.89 1.954v1.625c0 .468.391.734.86.547C13.781 14.359 16 11.53 16 8.03 16 3.61 '
  + '12.406 0 7.984 0 3.563 0 0 3.61 0 8.031a7.88 7.88 0 0 0 5.172 7.422c.422.156.828-.125'
  + '.828-.547v-1.25c-.219.094-.5.156-.75.156-1.031 0-1.64-.562-2.078-1.609-.172-.422-.36'
  + '-.672-.719-.719-.187-.015-.25-.093-.25-.187 0-.188.313-.328.625-.328.453 0 .844.281 '
  + '1.25.86.313.452.64.655 1.031.655s.641-.14 1-.5c.266-.265.47-.5.657-.656"/></svg>';

/// A license's usual short name, read from however the author wrote it: the
/// full name, a short code, or a link to the license's own page. A license in
/// the author's own words has no short name, so it reads "Own license"; a
/// link to a license file we cannot read reads "Licensed".
function shortLicenseName(text) {
  const t = text.trim();
  const version = (/(?:version|v|-|\s)\s*(\d(?:\.\d)?)\b/i.exec(t) || [])[1];
  const withVersion = (name) => (version ? `${name} ${version}` : name);
  if (/unlicense/i.test(t)) return 'Unlicense';
  if (/\bMIT\b/.test(t)) return 'MIT';
  if (/apache/i.test(t)) return withVersion('Apache');
  if (/\bMPL\b|mozilla public/i.test(t)) return withVersion('MPL');
  if (/\bLGPL|lesser general public/i.test(t)) return withVersion('LGPL');
  if (/\bAGPL|affero/i.test(t)) return withVersion('AGPL');
  if (/\bGPL|general public license/i.test(t)) return withVersion('GPL');
  if (/\bEUPL\b/.test(t)) return withVersion('EUPL');
  if (/\bBSD\b/.test(t)) return 'BSD';
  if (/\bCC0\b|publicdomain\/zero/i.test(t)) return 'CC0';
  const cc = creativeCommonsName(t);
  if (cc) return cc;
  if (/^https?:\/\/\S+$/.test(t)) return 'Licensed';
  return 'Own license';
}

/// "CC BY-NC-SA 4.0" from a Creative Commons license however it is written:
/// the code, the words, or the link to creativecommons.org.
function creativeCommonsName(t) {
  const link = /creativecommons\.org\/licenses\/([a-z-]+)\/(\d\.\d)/i.exec(t);
  if (link) return `CC ${link[1].toUpperCase()} ${link[2]}`;
  if (!/\bCC\b|creative\s*commons/i.test(t)) return null;
  const number = (/\b(\d\.\d)\b/.exec(t) || [])[1];
  const code = /\bBY(?:-(?:NC|SA|ND))*\b/i.exec(t);
  let name = code ? code[0].toUpperCase() : null;
  if (!name) {
    const parts = /attrib/i.test(t) ? ['BY'] : [];
    if (/non-?\s*commercial/i.test(t)) parts.push('NC');
    if (/share-?\s*alike/i.test(t)) parts.push('SA');
    if (/no-?\s*deriv/i.test(t)) parts.push('ND');
    // A post that only says "Creative Commons" does not say which one.
    if (!parts.length) return 'Creative Commons';
    name = parts.join('-');
  }
  return [`CC ${name}`, number].filter(Boolean).join(' ');
}

function plainDownloadButton(download, checked) {
  const extension = /\.(zip|7z|rar|jar|tar\.gz|exe)$/i.exec(download.fileName || '');
  const label = download.needsAnotherStep ? 'Download page'
    : extension ? `Download .${extension[1].toLowerCase()}` : 'Download';
  return el('a', {
    class: 'btn btn-with-icon',
    href: download.directUrl || download.url,
    rel: 'noopener nofollow',
    target: '_blank',
    title: [download.fileName, checked].filter(Boolean).join('\n') || null,
  }, [
    el('span', { class: 'original-page-icon', html: DOWNLOAD_ICON, 'aria-hidden': 'true' }),
    el('span', { text: label }),
  ]);
}

// Tabler download icon.
const DOWNLOAD_ICON = '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" '
  + 'stroke="currentColor" stroke-width="2" stroke-linecap="round" '
  + 'stroke-linejoin="round" focusable="false" aria-hidden="true">'
  + '<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2"/>'
  + '<path d="M7 11l5 5l5 -5"/><path d="M12 4l0 12"/></svg>';

/// Where readers can support the author, as one line at the foot of the
/// download card: near the moment a reader decides the mod is worth having,
/// without a card of its own or competing with the download itself.
function supportLinks(detail) {
  const support = detail.supportLinks || [];
  if (!support.length) return null;

  // A known platform shows its own logo before its name; any other link is
  // just its name.
  return el('span', { class: 'support-links' }, support.map((one) => el('a', {
      href: one.url,
      target: '_blank',
      rel: 'noopener nofollow',
      title: one.url,
    }, [
      SUPPORT_ICONS[one.type]
        ? el('span', { class: 'support-icon', html: SUPPORT_ICONS[one.type], 'aria-hidden': 'true' })
        : null,
      supportName(one),
    ])));
}

/// The downloads the buttons at the top of the side already offer: the first
/// one, and the first plain download where the first is a TriOS link. Read by
/// both [howToGetIt] and [downloads], so the two can never disagree.
function topDownloads(list) {
  const first = list[0];
  const plain = first?.kind === 'trios' ? list.find((d) => d.kind !== 'trios') : null;
  return { first, plain };
}

/// Every download the buttons at the top do not already offer — a mirror,
/// another build, a second file. Not drawn when the buttons cover them all,
/// which is most mods.
function downloads(detail) {
  const list = detail.downloads || [];
  const { first, plain } = topDownloads(list);
  const rest = list.filter((d) => d !== first && d !== plain);
  if (!rest.length) return null;

  const box = el('div', { class: 'side-downloads' });
  for (const download of rest) box.append(downloadRow(download));
  return el('section', { class: 'panel side-card' }, [
    el('h2', { class: 'side-heading', text: rest.length === 1 ? 'Other download' : 'Other downloads' }),
    box,
  ]);
}

function downloadRow(download) {
  // The file's name where we know it, then the link's own words from the post
  // (or the name the AI gave it). The words after that are ours, and
  // "Download" is only used where the link gets you the file.
  const label = download.kind === 'trios' ? 'Install with TriOS'
    : download.fileName || download.label
      || (download.needsAnotherStep ? 'Download page'
        : download.kind === 'mirror' ? 'Mirror' : 'Download');
  const where = download.url ? `${download.url}` : "...something";
  return el('div', { class: 'download' }, [
    el('a', {
      class: 'download-name',
      href: download.directUrl || download.url,
      rel: 'noopener nofollow',
      target: '_blank',
      text: label,
      title: download.needsAnotherStep
        ? `Opens ${where}`
        : (download.kind === 'mirror' ? 'A mirror of the main download.' : null),
    }),
    download.host ? el('span', { class: 'badge', text: download.host }) : null,
  ]);
}

// Author text only; generated descriptions are shown by aiSummary.
function description(detail, { collapsed = false } = {}) {
  const generated = Boolean(detail.descriptionIsGenerated);
  const formatted = generated ? null : detail.descriptionHtml;
  const text = generated ? null : detail.description;
  const own = Boolean(formatted || text);

  if (!own) {
    // The Discord post below is the author's own words, so "no description"
    // would not be true.
    if (detail.discordPostHtml) return null;
    return el('section', { class: 'panel' }, [
      el('h2', { text: 'About this mod' }),
      el('p', { class: 'no-description', text: NO_DESCRIPTION }),
    ]);
  }

  // descriptionHtml is sanitized by the builder; plain descriptions use textContent.
  const forum = Boolean(detail.descriptionIsForumPost);
  const body = formatted
    ? postBody(formatted, forum ? (image) => withSource(image, 'forum', detail) : undefined)
    : el('div', { class: 'prose plain', text });
  continuedOnTheForum(body, detail.forumUrl);

  const state = { collapsed };
  const section = foldingPost({
    heading: forum ? 'Forum post' : 'About this mod',
    icon: forum ? pageIcon('forumUrl') : null,
    body,
    state,
    switches: [
      formatted && /<img\s/i.test(formatted)
        ? picturesSwitch(() => section.replaceWith(description(detail, state)))
        : null,
    ],
  });
  return section;
}

/// The mod's Discord post. Its markdown was turned into tags when the site was
/// built, and the same sanitizer as a forum post has been over it.
function discordPost(detail) {
  if (!detail.discordPostHtml) return null;
  return foldingPost({
    heading: 'Discord post',
    icon: pageIcon('discordUrl'),
    body: postBody(detail.discordPostHtml, (image) => withSource(image, 'discord', detail)),
    state: { collapsed: false },
    switches: [],
  });
}

/// A post under its heading, with a "Collapse" link that folds a long one to a
/// short preview. [state] carries whether it is folded, so a post that redraws
/// itself keeps the reader's choice.
function foldingPost({ heading, icon, body, state, switches }) {
  const clip = el('div', { class: `prose-clip${state.collapsed ? ' clipped' : ''}` }, [body]);
  const fold = el('button', { class: 'post-switch', type: 'button' });
  const label = () => {
    setSwitch(fold, state.collapsed ? EXPAND_ICON : COLLAPSE_ICON,
      state.collapsed ? 'Expand' : 'Collapse');
    fold.setAttribute('aria-expanded', String(!state.collapsed));
  };
  label();
  fold.addEventListener('click', () => {
    state.collapsed = !state.collapsed;
    clip.classList.toggle('clipped', state.collapsed);
    label();
  });
  // Images can change the post height after it is attached.
  const head = el('div', { class: 'section-head' }, [
    el('h2', { class: 'post-heading' }, [
      icon ? el('span', { class: 'original-page-icon', html: icon, 'aria-hidden': 'true' }) : null,
      heading,
    ]),
    el('span', { class: 'post-switches' }, [...switches.filter(Boolean), fold]),
  ]);
  // A press anywhere on the heading strip folds the post too, the same as
  // "Collapse". Not a press on one of its buttons, which do their own thing,
  // and not the end of selecting the heading's words. The button stays the
  // way in for a keyboard.
  //
  // Whether the press came from a button is read from the path it travelled,
  // fixed when it started. Asking the pressed element for its button does not
  // work: "Collapse" swaps its own words as it is pressed, so by the time the
  // press reaches the strip the pressed word has left the page, has no button
  // round it, and the strip would fold the post straight back.
  head.addEventListener('click', (e) => {
    const fromAButton = e.composedPath().some((node) => node.tagName === 'BUTTON' || node.tagName === 'A');
    if (fold.hidden || fromAButton) return;
    if (String(getSelection?.() || '').trim()) return;
    fold.click();
  });

  const settle = () => {
    if (!clip.isConnected) return;
    const preview = parseFloat(getComputedStyle(body).fontSize) * PREVIEW_LINES;
    fold.hidden = body.offsetHeight <= preview + 1;
    // Only a post that can fold says so with the pointer.
    head.classList.toggle('foldable', !fold.hidden);
  };
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(settle).observe(body);
  setTimeout(settle, 0);

  // The heading sits in a strip of its own with a line under it, and the post
  // in the panel's usual padding below.
  return el('section', { class: 'panel post-panel' }, [
    head,
    el('div', { class: 'post-body' }, [clip]),
  ]);
}

// Keep in step with `.prose-clip.clipped` in style.css.
const PREVIEW_LINES = 14;

/// A post's switch as an icon and a few words.
function setSwitch(button, icon, words) {
  button.replaceChildren(
    el('span', { class: 'post-switch-icon', html: icon, 'aria-hidden': 'true' }),
    el('span', { text: words }),
  );
}

// Tabler chevrons-up, chevrons-down, photo and photo-off icons.
const SWITCH_SVG = '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" '
  + 'stroke="currentColor" stroke-width="2" stroke-linecap="round" '
  + 'stroke-linejoin="round" focusable="false" aria-hidden="true">';
const COLLAPSE_ICON = `${SWITCH_SVG}<path d="M7 11l5 -5l5 5"/><path d="M7 17l5 -5l5 5"/></svg>`;
const EXPAND_ICON = `${SWITCH_SVG}<path d="M7 7l5 5l5 -5"/><path d="M7 13l5 5l5 -5"/></svg>`;
const PICTURES_ICON = `${SWITCH_SVG}<path d="M15 8h.01"/>`
  + '<path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12z"/>'
  + '<path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5"/>'
  + '<path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3"/></svg>';
const PICTURES_OFF_ICON = `${SWITCH_SVG}<path d="M15 8h.01"/>`
  + '<path d="M7 3h11a3 3 0 0 1 3 3v11m-.856 3.099a2.991 2.991 0 0 1 -2.144 .901h-12a3 3 0 0 1 -3 -3v-12c0 -.845 .349 -1.608 .91 -2.153"/>'
  + '<path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5"/>'
  + '<path d="M16.33 12.338c.574 -.054 1.155 .166 1.67 .662l3 3"/><path d="M3 3l18 18"/></svg>';

/// A post too long to publish whole ends with a "…" paragraph (the builder's
/// cap, `maxDescriptionLength`). That is turned into a link to the thread, so
/// the reader is told where the rest is rather than left at a dot-dot-dot.
function continuedOnTheForum(body, forumUrl) {
  const last = body.lastElementChild;
  if (!forumUrl || !last || last.tagName !== 'P' || last.textContent.trim() !== '…') return;
  last.replaceChildren(el('a', {
    href: forumUrl, target: '_blank', rel: 'noopener nofollow',
    text: 'Continued on the forum →',
  }));
}

function picturesSwitch(redraw) {
  const on = inlinePictures() !== 'off';
  const button = el('button', {
    class: 'post-switch',
    type: 'button',
    title: 'Applies to all mod descriptions. Also available in Settings.',
  });
  setSwitch(button, on ? PICTURES_OFF_ICON : PICTURES_ICON,
    on ? 'Hide pictures' : 'Show pictures');
  button.addEventListener('click', () => {
    setInlinePictures(on ? 'off' : 'on');
    redraw();
  });
  return button;
}

// Parse in a template so hidden pictures do not start downloading.
// Preserve image-only links as text when removing their pictures.
// [describe] adds what the viewer shows about each picture, such as its post.
function postBody(html, describe = (image) => image) {
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
    const image = describe({
      url: img.getAttribute('src'),
      caption: img.getAttribute('alt') || null,
    });
    const link = img.closest('a');
    const onlyContentOfLink = Boolean(link)
      && link.textContent.trim() === ''
      && link.querySelectorAll('img').length === 1;
    // A picture linked to a bigger copy of itself, or to a picture host's
    // page for it, opens in the viewer like a picture with no link.
    const linksToPicture = onlyContentOfLink
      && isPictureAddress(link.getAttribute('href'));

    // What is left of a picture inside a link once the picture is gone.
    const linkWords = () => document.createTextNode(link.getAttribute('href'));

    if (!showPictures) {
      if (link && !linksToPicture) {
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
      (linksToPicture ? link : img).replaceWith(stand);
      continue;
    }

    img.addEventListener('error', () => {
      const gone = viewable.indexOf(image);
      if (gone >= 0) viewable.splice(gone, 1);
      if (onlyContentOfLink) img.replaceWith(linkWords());
      else img.remove();
    });
    if (!link || linksToPicture) {
      viewable.push(image);
      img.classList.add('inline-picture');
      img.addEventListener('click', (e) => {
        // A click with Ctrl, Shift or the like still follows the link.
        if (link && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) return;
        e.preventDefault();
        open(image);
      });
    }
  }

  const body = el('div', { class: 'prose' });
  body.append(content);
  return body;
}

/// Sites whose page for a picture shows that picture and little else.
const PICTURE_HOSTS = [
  'imgur.com', 'ibb.co', 'imgbb.com', 'postimages.org', 'postimage.org',
  'postimg.cc', 'postimg.org', 'flic.kr', 'flickr.com', 'gyazo.com',
  'imgbox.com', 'photobucket.com', 'prnt.sc', 'prntscr.com',
];

/// Whether a link goes to a picture: a picture file, or a picture host's page.
/// An album or gallery holds more than the one picture, so it stays a link.
function isPictureAddress(href) {
  let url;
  try {
    url = new URL(href);
  } catch {
    return false;
  }
  if (/\.(png|jpe?g|gif|webp|bmp)$/i.test(url.pathname)) return true;
  const host = url.hostname.replace(/^www\./, '');
  if (!PICTURE_HOSTS.some((name) => host === name || host.endsWith(`.${name}`))) {
    return false;
  }
  return !/\/(a|gallery|albums?|sets)(\/|$)/i.test(url.pathname);
}

// Load the YouTube player only on an unmodified click.
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

function aiSummary(detail, mod) {
  const words = aiSummaryOf({
    aiSummary: detail.aiDescription,
    summary: detail.description,
    summaryIsGenerated: Boolean(detail.descriptionIsGenerated),
  });
  if (!words) return null;

  const shown = aiOnModPages() !== 'hide';
  let section = null;
  const flip = () => {
    setAiOnModPages(shown ? 'hide' : 'show');
    section.replaceWith(aiSummary(detail, mod));
    // The line under the name follows the same choice.
    const slot = document.querySelector('.mod-summary-slot');
    if (slot) slot.replaceChildren(...[headSummary(mod)].filter(Boolean));
  };
  const toggle = el('button', {
    class: 'link-button ai-switch',
    type: 'button',
    text: shown ? 'Hide AI summaries' : 'Show AI summary',
    title: 'Applies to all mod pages.',
  });
  toggle.addEventListener('click', flip);

  if (!shown) {
    section = el('p', { class: 'ai-hidden-row' }, [
      aiSparkle(), ' ', toggle,
    ]);
    return section;
  }

  section = el('div', { class: 'panel' }, [
    el('div', {
      class: 'summary-block',
      title: summaryTitle({ text: words, generated: true }),
    }, [
      el('div', { class: 'prose plain' }, [
        el('p', {}, [aiSparkle(words), ' ', words]),
      ]),
      el('div', { class: 'ai-foot' }, [aiSummaryNote(), toggle]),
    ]),
  ]);
  return section;
}

/// Screenshots first. Buttons, badges and icons are marked `small` when the
/// site is built. Most posts do not say how big a picture is, so each one is
/// also measured once it loads, and hidden if it is too small to be a
/// screenshot or is a thin strip such as a title banner or a divider. Hidden
/// pictures are one button away. [onCount] hears how many screenshots are
/// showing each time that changes.
function gallery(detail, onCount) {
  const images = (detail.gallery || [])
    .map((image) => withSource(image, image.source, detail));
  if (!images.length) {
    onCount(0);
    return null;
  }

  const hidden = new Set(images.filter((image) => image.small));
  const broken = new Set();
  let showHidden = false;
  const buttons = new Map();
  const grid = el('div', { class: 'gallery' });
  const empty = el('p', { class: 'sub', text: "No screenshots in this mod's posts." });
  const toggle = el('button', { class: 'link-button small-pictures-toggle', type: 'button' });

  // The pictures the viewer steps through: the ones on screen.
  const showing = () => images.filter((image) =>
    !broken.has(image) && (showHidden || !hidden.has(image)));

  const redraw = () => {
    for (const [image, button] of buttons) {
      button.hidden = !showHidden && hidden.has(image);
    }
    const hiddenCount = [...hidden].filter((image) => !broken.has(image)).length;
    const screenshots = images.length - broken.size - hiddenCount;
    onCount(screenshots);
    empty.hidden = screenshots > 0;
    toggle.hidden = !hiddenCount;
    toggle.textContent = showHidden
      ? 'Hide small pictures'
      : `Show ${hiddenCount} small ${hiddenCount === 1 ? 'picture' : 'pictures'}`;
    toggle.setAttribute('aria-expanded', String(showHidden));
  };

  images.forEach((image) => {
    const button = el('button', {
      class: 'shot',
      title: imageHoverText(image) || 'Open picture',
    });
    const img = picture(image.url, {
      alt: imageCaption(image),
      whenBroken: () => {
        button.remove();
        broken.add(image);
        redraw();
      },
    });
    img.addEventListener('load', () => {
      if (hidden.has(image) || isScreenshotSized(img.naturalWidth, img.naturalHeight)) return;
      hidden.add(image);
      redraw();
    });
    button.append(img);
    button.addEventListener('click', () => {
      const list = showing();
      showPicture(list, list.indexOf(image));
    });
    buttons.set(image, button);
    grid.append(button);
  });

  const refreshCaptions = () => {
    for (const [image, button] of buttons) {
      const caption = imageCaption(image);
      button.title = imageHoverText(image) || 'Open picture';
      const img = button.querySelector('img');
      if (img) img.alt = caption;
    }
  };
  const captionEvents = new AbortController();
  window.addEventListener('ai-caption-preference-changed', refreshCaptions,
    { signal: captionEvents.signal });
  window.addEventListener('hashchange', () => captionEvents.abort(),
    { once: true, signal: captionEvents.signal });

  toggle.addEventListener('click', () => {
    showHidden = !showHidden;
    redraw();
  });
  redraw();

  // No heading: the tab already says what this is.
  return el('section', { class: 'panel' }, [
    grid,
    empty,
    el('p', { class: 'small-pictures-row' }, [toggle]),
  ]);
}

/// Narrower than this and a picture is a button or an icon, not a screenshot.
/// The same number the site's builder uses where a post gives the width.
const SMALLEST_SCREENSHOT = 200;

/// Whether a loaded picture's real size could be a screenshot: wide enough,
/// tall enough, and not a thin strip many times wider than it is tall.
function isScreenshotSized(width, height) {
  if (!width || !height) return true;
  return width >= SMALLEST_SCREENSHOT && height >= 100 && width / height <= 4.5;
}

/// A section whose entries fold, with a button beside its heading that opens
/// or closes every one of them. The button works on this section alone, and is
/// left out when nothing in it folds.
function foldingPanel(heading, body, foldSelector) {
  return el('section', { class: 'panel' }, [
    el('div', { class: 'section-head' }, [
      el('h2', { text: heading }),
      expandAllButton(body, foldSelector),
    ]),
    body,
  ]);
}

function changelog(detail) {
  const entries = Object.entries(detail.changelog || {});
  const changelogUrl = detail.changelogUrl;
  if (!entries.length && !changelogUrl) return null;

  const box = el('div', {});
  entries.forEach(([version, notes], i) => {
    box.append(el('details', { class: 'changelog-entry', open: i === 0 ? '' : null }, [
      el('summary', { text: version }),
      el('pre', { text: notes }),
    ]));
  });
  if (changelogUrl) {
    box.append(el('p', {}, [
      el('a', {
        href: changelogUrl, target: '_blank', rel: 'noopener nofollow',
        text: 'Full changelog →',
      }),
    ]));
  }
  return foldingPanel('Recent Updates', box, 'details.changelog-entry');
}

function releases(detail) {
  const list = detail.releases || [];
  if (!list.length) return null;

  const rows = el('div', { class: 'release-list' });
  for (const release of list) {
    rows.append(el('details', { class: release.changelogNotes ? 'release' : 'release no-notes' }, [
      el('summary', {}, [
        // The same arrow Home's release rows carry; a row with no notes has
        // none and is pushed along to line up with the rest.
        release.changelogNotes
          ? el('span', { class: 'chevron', text: '›', 'aria-hidden': 'true' })
          : null,
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
  return foldingPanel('Release history', rows, 'details.release:not(.no-notes)');
}

function addons(detail) {
  const list = detail.addons || [];
  if (!list.length) return null;

  const versions = list.filter((a) => a.role === 'variant');
  const extras = list.filter((a) => a.role !== 'variant');

  return el('div', { class: 'stack' }, [
    addonBox(extras, 'Add-ons on the same thread'),
    addonBox(versions, 'Other versions of this mod'),
  ]);
}

function addonBox(list, heading) {
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
    box,
  ]);
}

/// The chip beside each save question. "Maybe" is the author saying it
/// depends: the words under it say on what.
const SAVE_ANSWERS = {
  yes: ['save-ok', 'Yes'],
  no: ['save-no', 'No'],
  depends: ['', 'Maybe'],
  unknown: ['save-unknown', 'Unknown'],
};

// Show unanswered add/remove questions as Unknown. Show update only
// when the author supplied text.
function saves(detail) {
  const questions = [
    ['Add mid-game?', detail.saveCompatibilityText, detail.canAdd, true],
    ['Update mid-game?', detail.updateCompatibilityText, detail.canUpdate, false],
    ['Remove from game?', detail.removalCompatibilityText, detail.canRemove, true],
  ];
  if (!questions.some(([, words]) => words)) return null;

  const authors = joinNames((detail.listing || {}).authors || []);
  const quoted = new Set();
  const rows = el('div', { class: 'save-lines' });
  for (const [question, words, answer, alwaysAsked] of questions) {
    if (!words && !alwaysAsked) continue;
    const shown = words ? answer : 'unknown';
    const chip = SAVE_ANSWERS[shown];
    // Where the model copied the same words into two fields, they are quoted
    // on the first row only.
    const quote = words && !quoted.has(words)
      ? el('q', {
          class: 'save-words',
          text: chip ? withoutLeadingAnswer(words, shown) : words,
          title: authors ? `${authors}, in the mod's forum thread` : null,
        })
      : null;
    if (words) quoted.add(words);
    rows.append(el('div', { class: 'save-line' }, [
      el('div', { class: 'save-ask' }, [
        el('span', { class: 'save-question', text: question }),
        chip
          ? el('span', { class: `badge ${chip[0]}`.trim(), text: chip[1] })
          : null,
      ]),
      quote,
    ]));
  }

  return rows;
}

function withoutLeadingAnswer(words, answer) {
  if (answer !== 'yes' && answer !== 'no') return words;
  const rest = words.replace(new RegExp(`^${answer}\\b[\\s.,!:;\u2014-]*`, 'i'), '');
  if (!rest || rest === words) return words;
  return rest[0].toUpperCase() + rest.slice(1);
}

function sideFact(label, value, { beside = false, labelTitle = null } = {}) {
  return el('div', { class: `side-fact${beside ? ' beside' : ''}` }, [
    el('span', {
      class: `side-label${labelTitle ? ' has-tip' : ''}`, text: label, title: labelTitle,
    }),
    el('div', { class: 'side-value' }, [value]),
  ]);
}

/// The site's categories for the mod. Where the sources named them
/// differently, an "Original categories" button on the label's line shows those
/// names under the site's own. Few readers want them, so they are not shown
/// until asked for.
function categories(names, raw) {
  const pills = categoryPills(names);
  if (!raw) return sideFact('Category', pills);

  const original = el('div', { class: 'original-categories', hidden: '' }, [
    categoryPills(raw, 'original-category'),
  ]);
  const button = el('button', {
    class: 'post-switch side-fact-switch',
    type: 'button',
    'aria-expanded': 'false',
    title: "The categories exactly as the forum's mod index and Discord list "
      + 'them. Starmodder groups those names into its own shorter list.',
    text: 'Original categories',
  });
  button.addEventListener('click', () => {
    original.hidden = !original.hidden;
    button.setAttribute('aria-expanded', String(!original.hidden));
    button.classList.toggle('on', !original.hidden);
  });
  return el('div', { class: 'side-fact' }, [
    el('div', { class: 'side-fact-head' }, [
      el('span', { class: 'side-label', text: 'Category' }),
      button,
    ]),
    el('div', { class: 'side-value' }, [pills, original]),
  ]);
}

/// Categories as the same small pills the header uses.
function categoryPills(names, extra = '') {
  return el('div', { class: 'needs-chips' }, names.map((name) =>
    el('span', { class: `badge ${extra}`.trim(), text: name })));
}

function sideCard(heading, rows) {
  const kept = rows.filter(Boolean);
  if (!kept.length) return null;
  return el('section', { class: 'panel side-card' }, [
    el('h2', { class: 'side-heading', text: heading }),
    el('div', { class: 'side-facts' }, kept),
  ]);
}

/// Other mods as chips, linked to their pages when available. Optional mods
/// use outlined chips instead of filled chips to show they are not required.
function neededChips(mods, optional) {
  const kind = optional ? 'chip needed optional' : 'chip needed';
  return el('div', { class: 'needs-chips' }, mods.map((needed) =>
    needed.id
      ? el('a', { class: kind, href: modHref(needed.id), text: needed.name })
      : el('span', {
          class: `${kind} unknown`, text: needed.name,
          title: 'No page available for this mod.',
        })));
}

function compatibility(detail, currentVersion) {
  const listing = detail.listing || {};
  const needs = (listing.needs || []).length
    ? sideFact('Requires', neededChips(listing.needs, false))
    : null;
  const optional = (detail.optionalNeeds || []).length
    ? sideFact('Optional', neededChips(detail.optionalNeeds, true))
    : null;
  const saveRows = saves(detail);
  return sideCard('Compatibility', [
    listing.gameVersion
      ? sideFact('Game version', el('span', {
          class: `badge game ${versionStanding(listing, currentVersion) || ''}`.trim(),
          text: `Starsector ${listing.gameVersion}`,
          title: versionStandingNote(versionStanding(listing, currentVersion)),
        }), { beside: true })
      : null,
    needs,
    optional,
    saveRows ? el('div', { class: 'side-fact' }, [saveRows]) : null,
  ]);
}

/// The mod's pages elsewhere: its forum thread and its Discord post. They also
/// say where the mod was found, so there is no separate line for that. The site
/// does not link to Nexus Mods.
function linksOut(detail) {
  const links = [
    ['Forum thread', detail.forumUrl, pageIcon('forumUrl')],
    ['Discord', detail.discordUrl, pageIcon('discordUrl')],
    ['Full changelog', detail.changelogUrl, CHANGELOG_ICON],
  ].filter(([, url]) => url);
  if (!links.length) return null;
  return el('div', { class: 'side-link-list' }, links.map(([text, url, icon]) => el('a', {
    href: url, target: '_blank', rel: 'noopener nofollow', title: url,
  }, [
    icon ? el('span', { class: 'original-page-icon', html: icon, 'aria-hidden': 'true' }) : null,
    el('span', { text }),
  ])));
}

// Tabler list-details icon, for the author's own changelog page.
const CHANGELOG_ICON = '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" '
  + 'stroke="currentColor" stroke-width="2" stroke-linecap="round" '
  + 'stroke-linejoin="round" focusable="false" aria-hidden="true">'
  + '<path d="M13 5h8"/><path d="M13 9h5"/><path d="M13 15h8"/><path d="M13 19h5"/>'
  + '<path d="M3 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"/>'
  + '<path d="M3 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"/></svg>';

// Tabler code icon.
const CODE_ICON = '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" '
  + 'stroke="currentColor" stroke-width="2" stroke-linecap="round" '
  + 'stroke-linejoin="round" focusable="false" aria-hidden="true">'
  + '<path d="M7 8l-4 4l4 4"/><path d="M17 8l4 4l-4 4"/><path d="M14 4l-4 16"/></svg>';

function facts(detail) {
  const listing = detail.listing || {};
  // What each source actually called it, which is not always what the site
  // does. Left out when it says nothing the categories line did not.
  const raw = detail.rawCategories || [];
  const rawDiffers = raw.length && joinNames(raw) !== joinNames(listing.categories || []);
  const day = (label, value, title) => (value
    ? sideFact(label, el('span', { text: formatDay(value), title }), { beside: true })
    : null);
  return sideCard('Details', [
    listing.modVersion
      ? sideFact('Mod version', el('span', { text: listing.modVersion, title: MOD_VERSION_NOTE }),
        { beside: true })
      : null,
    (listing.categories || []).length
      ? categories(listing.categories, rawDiffers ? raw : null)
      : null,
    day('Added', listing.addedOn,
      'When the forum thread was posted, or the mod was first seen on Discord.'),
    day('Last release', listing.lastReleaseDate,
      'When this site last noticed a new version.'),
    day('Thread last posted', listing.threadLastPostOn || detail.threadLastPostOn, null),
    aiUseFact(detail.aiUse),
  ]);
}

/// What the author says about using AI tools to make the mod, in plain words
/// with no colour or warning mark: the site reports it and takes no side. The
/// author's own words are on hover. Neither of the two dim answers is "None":
/// "Not checked yet" means the mod's posts have not been read for this (no
/// `aiUse` at all), and "Unknown" means they were read and say nothing (an
/// `aiUse` with no `usesAi`).
function aiUseFact(aiUse) {
  if (!aiUse || aiUse.usesAi == null) {
    return sideFact('AI use', el('span', aiUse
      ? { class: 'dim', text: 'Unknown',
          title: 'No AI use declaration found.' }
      : { class: 'dim', text: 'Not checked yet',
          title: "The mod's posts have not been read for AI use yet." }),
    { beside: true });
  }
  const text = aiUse.usesAi
    ? (aiUse.uses || []).map(aiUseLabel).join(' · ')
    : 'None';
  const value = quickTip(el('span', { class: 'ai-use has-tip', text }),
    () => aiUseTip(aiUse));
  return sideFact('AI use', value, { beside: !aiUse.usesAi });
}

// Keep all reported details in the tooltip, alongside the author's quote.
function aiUseTip(aiUse) {
  const tools = aiUse.tools || [];
  const uses = aiUse.usesAi ? aiUse.uses || [] : [];
  return el('div', { class: 'tip-parts' }, [
    uses.length ? el('div', { class: 'tip-label', text: 'AI use' }) : null,
    uses.length
      ? el('ul', { class: 'tip-uses' }, uses.map((use) => el('li', { text: aiUseSentence(use) })))
      : null,
    tools.length ? el('div', { class: 'tip-label', text: 'Tools used' }) : null,
    tools.length
      ? el('div', { class: 'tip-badges' }, tools.map((tool) => el('span', { class: 'badge', text: tool })))
      : null,
    el('div', { class: 'tip-label', text: 'AI Disclosure' }),
    el('blockquote', { class: 'tip-quote', text: withoutOuterQuotes(aiUse.quote) }),
  ]);
}

/// A quote with the quotation marks around the whole of it taken off. The
/// quote is already set off as a quote, so marks around it are one pair too
/// many.
function withoutOuterQuotes(quote) {
  const match = /^["“”](.*)["“”]$/s.exec(quote.trim());
  return match ? match[1] : quote.trim();
}

// Use the same wording as the tooltip so "edited" clearly means a person changed AI work.
function aiUseLabel(use) {
  const area = use.area[0].toUpperCase() + use.area.slice(1);
  const amount = aiUseAmount(use).join(' ');
  const notes = [amount, use.optional ? 'optional' : null].filter(Boolean);
  return notes.length ? `${area} (${notes.join(', ')})` : area;
}

const AI_USE_HOW = {
  generated: 'AI',
  edited: 'AI with human edits',
  assisted: 'AI-assisted',
};
const AI_USE_EXTENT = { all: 'entirely', most: 'mostly', some: 'partly' };

/// How much and how, such as ["entirely", "AI"]. An amount with no "how" still
/// says "AI", so a row never reads "Code (entirely)".
function aiUseAmount(use) {
  const how = AI_USE_HOW[use.how] ?? (use.extent ? 'AI' : null);
  return [AI_USE_EXTENT[use.extent], how].filter(Boolean);
}

// Leave out any details the author did not give.
function aiUseSentence(use) {
  const area = use.area[0].toUpperCase() + use.area.slice(1);
  const parts = aiUseAmount(use);
  const text = parts.length ? `${area}: ${parts.join(' ')}.` : `${area}.`;
  return use.optional ? `${text} Optional.` : text;
}

// Same-name entries may be older threads, forks, or unrelated mods.
function sameNameMods(detail) {
  const others = detail.sameNameMods || [];
  if (!others.length) return null;

  const rows = el('div', { class: 'mod-rows' });
  for (const other of others) {
    const metadata = [
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
      metadata.length
        ? el('div', { class: 'row-sub', text: metadata.join(' · ') })
        : null,
    ]));
    rows.append(el('div', { class: 'mod-row' }, [inner]));
  }

  const many = others.length > 1;
  return el('section', { class: 'panel name-share' }, [
    el('h3', { text: `${many ? 'Other mods have' : 'Another mod has'} the same name` }),
    el('p', {
      class: 'sub',
      text: `${many ? 'Each' : 'It'} may be an older thread for this mod, a fork `
        + 'of it, or a different mod altogether.',
    }),
    rows,
  ]);
}

/// The author's other mods, newest release first. Empty when the mod credits
/// nobody.
function theAuthorsOtherMods(mod, everyMod) {
  const people = new Set((mod.authors || []).map((a) => a.toLowerCase()));
  if (!people.size) return [];
  return newestFirst(everyMod.filter((other) => other.id !== mod.id
    && (other.authors || []).some((a) => people.has(a.toLowerCase()))));
}

/// Mods by other people that share a category with this one: most shared
/// categories first, then newest release.
function modsLikeThis(mod, everyMod) {
  const shelves = new Set(mod.categories || []);
  if (!shelves.size) return [];

  const people = new Set((mod.authors || []).map((a) => a.toLowerCase()));
  const shared = (other) =>
    (other.categories || []).filter((c) => shelves.has(c)).length;
  const alike = everyMod.filter((other) => other.id !== mod.id
    // Not this person's own mods — those are under "More by".
    && !(other.authors || []).some((a) => people.has(a.toLowerCase()))
    && shared(other) > 0);
  // Stable sorting preserves release order within each category count.
  return newestFirst(alike).sort((a, b) => shared(b) - shared(a));
}

function moreByHeading(mod) {
  return `More by ${(mod.authors || []).length === 1 ? mod.authors[0] : 'these authors'}`;
}

/// "More by" and "Similar mods", as short rows in the side column.
/// Each row is a small picture, the name with its game version at the right,
/// and the mod's summary under the name. "Similar mods" also names the author
/// after the name; under "More by" that would be the same name on every row.
function relatedLists(mod, everyMod, currentVersion) {
  const rows = (mods, { withAuthor = false } = {}) => el('div', { class: 'related-list' }, mods
    .slice(0, RELATED_SIDE_COUNT)
    .map((other) => quickTip(el('a', { class: 'related-row', href: modHref(other.id) }, [
      relatedThumb(other),
      el('span', { class: 'related-words' }, [
        el('span', { class: 'related-top' }, [
          el('span', { class: 'related-name', text: modName(other) }),
          withAuthor && (other.authors || []).length
            ? el('span', { class: 'related-by', text: `by ${joinNames(other.authors)}` })
            : null,
          other.gameVersion
            ? el('span', {
                class: `badge game ${versionStanding(other, currentVersion) || ''}`.trim(),
                text: other.gameVersion,
                title: versionStandingNote(versionStanding(other, currentVersion)),
              })
            : null,
        ]),
        summaryLine(other)
          ? el('span', { class: 'related-sub', text: summaryLine(other) })
          : null,
      ]),
    ]), () => fullText(other))));
  const summaryLine = (other) => summaryToShow(other)?.text || '';
  // The row cuts the name, the author and the summary short, so all three
  // are written out in full on hover.
  const fullText = (other) => [
    modName(other),
    (other.authors || []).length ? `by ${joinNames(other.authors)}` : '',
    summaryLine(other) ? `\n${summaryLine(other)}` : '',
  ].filter(Boolean).join('\n');

  const theirs = theAuthorsOtherMods(mod, everyMod);
  const alike = modsLikeThis(mod, everyMod);
  const parts = [
    theirs.length ? sideCard(moreByHeading(mod), [rows(theirs)]) : null,
    alike.length ? sideCard('Similar mods', [rows(alike, { withAuthor: true })]) : null,
  ].filter(Boolean);
  if (!parts.length) return null;
  return el('aside', { class: 'mod-related side-merged stack' }, parts);
}

/// The mod's picture, small, or its first letter where it has none — the same
/// stand-in the cards use.
function relatedThumb(mod) {
  const initial = () => el('span', {
    class: 'related-thumb placeholder',
    text: (modName(mod).trim()[0] || '?').toUpperCase(),
    'aria-hidden': 'true',
  });
  const url = imageUrlOf(mod);
  if (!url) return initial();
  return picture(url, {
    className: 'related-thumb',
    whenBroken: (img) => img.replaceWith(initial()),
  });
}

// Build the diagnostic view only when first opened.
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

// Render raw HTML strings as text.
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

// Undated releases sort last.
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

/// The page at a Collection's old address: the post's name, where it is, and a
/// card for each mod it holds. Links people shared to this address still lead
/// somewhere useful, and no mod has to pretend to be the whole post.
async function collectionPage(root, collection) {
  const name = collection.name || 'A collection of mods';
  document.title = `${name} | Starmodder`;
  const mods = collection.mods || [];
  let currentVersion = null;
  try {
    currentVersion = currentGameVersion((await modList()).mods || []);
  } catch {
    currentVersion = null;
  }
  const { modGrid } = await import('./browse.js');

  clear(root);
  root.append(el('a', { class: 'back-link', href: '#/browse', text: '‹ Browse mods' }));
  const page = el('div', { class: 'stack' });
  // The heading and the two lines under it are one group; the cards are the
  // next section.
  const intro = el('div', { class: 'stack' });
  intro.append(el('h1', { text: name }));
  intro.append(el('p', {
    text: mods.length === 1
      ? 'This post holds one mod, which has a page of its own.'
      : `This post holds ${mods.length} mods. Each has a page of its own.`,
  }));
  const where = collection.forumUrl || collection.discordUrl;
  if (where) {
    intro.append(el('p', {}, [el('a', {
      href: where, target: '_blank', rel: 'noopener',
      text: collection.forumUrl ? 'The forum thread →' : 'The Discord post →',
    })]));
  }
  page.append(intro);
  if (mods.length) page.append(modGrid(mods, currentVersion));
  root.append(page);
}
