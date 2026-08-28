// Shared helpers for the public site: building DOM, reading the address, and
// fetching the published data files.
//
// There is no server behind this site. Every page is drawn in the browser from
// files fetched off the same origin the pages came from, and nothing here can
// change anything.

// --- Where the data comes from ---

/// The folder the published data files sit in, relative to this page.
///
/// It is a relative path on purpose: the site is served from whatever folder it
/// was copied into, and everything it asks for comes from its own origin. No
/// GitHub, no other host, no cross-origin permission needed.
///
/// The published files sit next to this page, because the publish job copies
/// the site's own files into the same folder as the data. Opening the page with
/// `?data=sample` reads the hand-written examples in `sample-data/` instead,
/// which is how the site is looked at straight out of the repo. There is no
/// falling back: a missing file says so rather than quietly showing examples.
export const DATA_BASE =
  new URLSearchParams(location.search).get('data') === 'sample'
    ? './sample-data/'
    : './';

const cache = new Map();

/// Fetches one published file, keeping the answer for the rest of the visit.
/// The mod list is a megabyte or so and every page wants it, so it is fetched
/// once.
export async function data(name) {
  if (cache.has(name)) return cache.get(name);
  const wanted = fetchJson(DATA_BASE + name);
  cache.set(name, wanted);
  try {
    return await wanted;
  } catch (err) {
    cache.delete(name); // So a failed fetch can be tried again.
    throw err;
  }
}

async function fetchJson(url) {
  const res = await fetch(url, { credentials: 'omit' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

/// Every mod, as `mods.json` holds it.
export function modList() {
  return data('mods.json');
}

/// The release feed, as `updates.json` holds it.
export function releaseFeed() {
  return data('updates.json');
}

/// One mod's own file, fetched when its page opens. Kept for the rest of the
/// visit like everything else, so going back to a mod does not fetch it again.
export function modDetail(id) {
  return data(`mods/${encodeURIComponent(id)}.json`);
}

// --- Building the page ---

/// Builds an element. `attrs` may include `class`, `text`, `html`, `onclick`,
/// and any other attribute. `children` is a flat list of nodes and strings.
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2), v);
    } else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

/// A picture that steps out of the way when its link is dead.
///
/// The pictures are wherever the mod's author put them, and plenty of those
/// links have since gone — a Discord attachment whose signature ran out, an
/// Imgur post taken down. The browser's broken-image icon in the middle of a
/// card looks worse than no picture at all, so a picture that will not load is
/// removed, or swapped for whatever [whenBroken] puts in its place.
export function picture(url, opts = {}) {
  const { className = null, alt = '', title = null, whenBroken = null } = opts;
  const img = el('img', {
    class: className, src: url, alt, title, loading: 'lazy',
  });
  img.addEventListener('error', () => {
    if (whenBroken) whenBroken(img);
    else img.remove();
  });
  return img;
}

export function clear(node) {
  node.replaceChildren();
  return node;
}

export function loading() {
  return el('div', { class: 'loading', text: 'Loading…' });
}

export function errorPanel(err) {
  return el('div', { class: 'notice error' }, [
    el('h3', { text: 'Something went wrong' }),
    el('p', { text: String(err && err.message ? err.message : err) }),
  ]);
}

/// A trail of links across the top of a page. Home is put in front for you; the
/// last crumb is the page you are on and is plain text.
export function breadcrumbs(trail = []) {
  const full = [{ label: 'Home', href: '#/home' }, ...trail];
  const nav = el('nav', { class: 'breadcrumbs', 'aria-label': 'Breadcrumb' });
  full.forEach((crumb, i) => {
    if (i) nav.append(el('span', { class: 'crumb-sep', text: '›' }));
    const isLast = i === full.length - 1;
    nav.append(!isLast && crumb.href
      ? el('a', { class: 'crumb', href: crumb.href, text: crumb.label })
      : el('span', { class: 'crumb crumb-current', text: crumb.label }));
  });
  return nav;
}

// --- The address bar ---

/// Reads the path part of `#/foo/bar?x=1` into ['foo','bar'].
export function hashParts() {
  const h = location.hash.replace(/^#\/?/, '').split('?')[0];
  return h.length ? h.split('/').map(decodeURIComponent) : [];
}

/// The query part of the current hash, as URLSearchParams.
export function hashQuery() {
  const i = location.hash.indexOf('?');
  return new URLSearchParams(i >= 0 ? location.hash.slice(i + 1) : '');
}

/// Builds a hash from path parts and a params object, leaving out empty values
/// so the address stays short.
export function buildHash(parts, params = {}) {
  const path = parts.map(encodeURIComponent).join('/');
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === '') continue;
    q.set(k, String(v));
  }
  const qs = q.toString();
  return `#/${path}${qs ? '?' + qs : ''}`;
}

export function go(hash) {
  location.hash = hash;
}

/// Changes the address without adding a history entry or redrawing the page. A
/// list calls this as its search, filters and page change, so a reload or a
/// bookmark brings the same list back without every keystroke piling up in the
/// back button.
export function replaceHash(hash) {
  history.replaceState(null, '', hash);
}

// --- The AI summaries setting ---

const AI_COOKIE = 'starmodderAiSummaries';

/// The three choices, the same three TriOS offers and in the same order:
/// prefer the AI summary, use it only where the author wrote nothing, or
/// never show it.
export const AI_SUMMARY_MODES = ['always', 'whenMissing', 'never'];

/// What the reader picked, defaulting to "whenMissing".
export function aiSummaryMode() {
  const saved = readCookie(AI_COOKIE);
  if (AI_SUMMARY_MODES.includes(saved)) return saved;
  // The setting used to be a plain on/off, so a reader who turned it off
  // before keeps that choice. "on" was the same as "whenMissing" is now.
  if (saved === 'off') return 'never';
  return 'whenMissing';
}

/// Remembers the reader's choice for a year, so it holds between visits.
export function setAiSummaryMode(mode) {
  const year = 365 * 24 * 60 * 60;
  document.cookie =
    `${AI_COOKIE}=${mode}; path=/; max-age=${year}; SameSite=Lax`;
}

function readCookie(name) {
  for (const part of document.cookie.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

// --- The spacing setting ---

/// "dense" (the default) or "comfortable". Dense keeps less room between and
/// around things; nothing else about the page changes size.
export const SPACINGS = ['dense', 'comfortable'];
const SPACING_KEY = 'starmodderSpacing';

export function spacingPreference() {
  const saved = localStorage.getItem(SPACING_KEY);
  return SPACINGS.includes(saved) ? saved : 'dense';
}

/// Remembers the choice and applies it to the page straight away. The style
/// sheet reads it off `data-spacing` on the root element, so no page has to be
/// redrawn. (index.html applies the saved choice before the first paint too,
/// so a reader who picked Comfortable never sees the dense page flash first.)
export function setSpacingPreference(spacing) {
  localStorage.setItem(SPACING_KEY, spacing);
  applySpacing();
}

export function applySpacing() {
  document.documentElement.dataset.spacing = spacingPreference();
}

// --- Which of a mod's two pictures to show ---

/// "post" (the default) shows the picture from the author's forum post;
/// "announcement" shows the one from the Discord or Nexus post the mod was
/// announced in. Most mods only have one picture, and those look the same
/// either way.
export const IMAGE_CHOICES = ['post', 'announcement'];
const IMAGE_KEY = 'starmodderPicture';

export function imageChoice() {
  const saved = localStorage.getItem(IMAGE_KEY);
  return IMAGE_CHOICES.includes(saved) ? saved : 'post';
}

export function setImageChoice(choice) {
  localStorage.setItem(IMAGE_KEY, choice);
}

/// The picture to show for a mod, or null when it has none.
///
/// `announcementImageUrl` is only published where it differs from `imageUrl`,
/// so a reader who asked for the announcement picture reads that one first and
/// falls back to the only picture the mod has.
export function imageUrlOf(mod) {
  if (!mod) return null;
  if (imageChoice() === 'announcement') {
    return mod.announcementImageUrl || mod.imageUrl || null;
  }
  return mod.imageUrl || null;
}

/// The summary to show for a mod, or null when there is nothing to show.
///
/// Two blocks of words may be on offer: the author's own, and the sentence an
/// AI wrote from the post. Which one wins is the reader's choice — the AI
/// sentence first, the author's first, or the AI summary not at all. The
/// answer says which was picked, so a card can mark AI words as AI.
export function summaryToShow(mod) {
  if (!mod) return null;
  const own = mod.summaryIsGenerated ? null : mod.summary;
  const ai = aiSummaryOf(mod);
  const inOrder = aiSummaryMode() === 'always'
    ? [[ai, true], [own, false]]
    : [[own, false], [ai, true]];
  for (const [text, generated] of inOrder) {
    if (!text) continue;
    // The one that lost, where it was the AI's and the reader asked for AI
    // words only when the author wrote none. Some of those author summaries
    // are a pasted line that says nothing about the mod, so the AI sentence is
    // put on hover rather than thrown away. A reader who asked for no AI words
    // at all never gets one: `aiSummaryOf` has already returned nothing.
    const aiAside = !generated && ai && ai !== text ? ai : null;
    return { text, generated, aiAside };
  }
  return null;
}

/// What the words of a summary say on hover: who wrote them where an AI did,
/// and the AI's own sentence where the author's words are being shown instead.
/// Null when there is nothing worth saying.
export function summaryTitle(summary) {
  if (!summary) return null;
  if (summary.generated) {
    return summary.text
      ? `${summary.text}\n\n${AI_SUMMARY_TITLE}`
      : AI_SUMMARY_TITLE;
  }
  return summary.aiAside ? `AI summary: ${summary.aiAside}` : null;
}

/// The AI summary for a mod, or null when there is none or the reader has
/// them off. Data published before `aiSummary` existed only carries the AI
/// sentence as the summary itself, which is what the second half reads.
export function aiSummaryOf(mod) {
  if (aiSummaryMode() === 'never') return null;
  return mod.aiSummary || (mod.summaryIsGenerated ? mod.summary : null) || null;
}

/// What stands in for a description a mod does not have — either because
/// nobody wrote one, or because the only one was written by an AI and the
/// reader has those turned off.
export const NO_DESCRIPTION = 'No description… yet!';

// A four-pointed sparkle, drawn here rather than fetched, since the site loads
// nothing from anywhere else. It takes the colour of the words around it.
const SPARKLE_SVG = '<svg viewBox="0 0 16 16" width="1em" height="1em" '
  + 'fill="currentColor" focusable="false"><path d="M8 0.6 9.5 5.6 14.5 7.1 '
  + '9.5 8.6 8 13.6 6.5 8.6 1.5 7.1 6.5 5.6Z"/><path d="M13 10.4 13.7 12.3 '
  + '15.6 13 13.7 13.7 13 15.6 12.3 13.7 10.4 13 12.3 12.3Z"/></svg>';

/// What the sparkle says on hover, and what the words beside it say on hover
/// too — a reader is at least as likely to point at the sentence as at the
/// 12-pixel star in front of it.
export const AI_SUMMARY_TITLE = "Written by an AI from the mod's post. "
  + 'Change this under Summaries in settings.';

/// The little sparkle that marks words an AI wrote, shown just before them.
/// It takes the colour of those words, says where they came from on hover, and
/// is hidden from a screen reader — the line under the description says the
/// same thing in words.
export function aiSparkle(summary = null) {
  return el('span', {
    class: 'ai-spark',
    html: SPARKLE_SVG,
    'aria-hidden': 'true',
    title: summaryTitle(summary ? { text: summary, generated: true } : null)
      || AI_SUMMARY_TITLE,
  });
}

/// The line under an AI-written summary saying where the words came from. Dim
/// and small: it is a note about the words, not part of them.
export function aiSummaryNote() {
  return el('p', { class: 'ai-note', text: 'Summary generated by AI' });
}

/// A small picture that leaves an empty box of the same size behind when its
/// link is dead, so the rows and cards around it stay lined up.
///
/// Nearly every picture on the site is one of these: the mod's own picture, a
/// row's thumbnail, a release's thumbnail, a search suggestion's. They are all
/// links somebody else put in a post years ago, so a fair few are gone.
export function thumbnail(url, className) {
  const blank = () => el('div', { class: className });
  if (!url) return blank();
  return picture(url, {
    className,
    whenBroken: (img) => img.replaceWith(blank()),
  });
}

/// Where the page was scrolled to when the reader left it.
///
/// The router notes this before it empties the page for the next view. It has
/// to be read at that moment: emptying the page leaves nothing to scroll, so
/// the browser says the position is zero from then on, and a view that asked
/// after the fact would only ever get zero back.
let scrollWhenLeft = 0;

export function notePageScroll() {
  scrollWhenLeft = window.scrollY;
}

export function pageScrollWhenLeft() {
  return scrollWhenLeft;
}

/// Set by a view that has put the page where it wants it, so the router leaves
/// it alone instead of scrolling to the top over the top of it. Only Browse
/// does this, and only when it is putting a reader back where they were.
let scrollPlacedByView = false;

export function noteScrollPlaced() {
  scrollPlacedByView = true;
}

/// True when a view placed the page since the last time this was asked. Asking
/// clears it, so it only ever counts for the page it was set on.
export function takeScrollPlaced() {
  const placed = scrollPlacedByView;
  scrollPlacedByView = false;
  return placed;
}

/// Opens a screenshot over the page, with the rest of them a keypress away.
///
/// A raw image in a new tab loses the reader their place and gives them a
/// browser tab to close; this keeps them where they were. Escape or a click on
/// the backdrop closes it, and the arrow keys move between pictures.
///
/// [images] is the list of `{url, caption}` still on the page, and [at] is
/// which one to open first.
export function showPicture(images, at = 0) {
  if (!images || !images.length) return;

  let showing = Math.max(0, Math.min(at, images.length - 1));
  // Where the keyboard was before this opened, so closing it puts the reader
  // back on the very screenshot they picked.
  const cameFrom = document.activeElement;

  const shot = el('img', { class: 'big-picture-shot', alt: '' });
  const caption = el('div', { class: 'big-picture-caption' });
  const counter = el('div', { class: 'big-picture-counter' });

  const close = el('button', {
    class: 'big-picture-close', text: '×', title: 'Close (Esc)',
    'aria-label': 'Close',
  });
  const back = el('button', {
    class: 'big-picture-step back', text: '‹', title: 'Previous (←)',
    'aria-label': 'Previous screenshot',
  });
  const forward = el('button', {
    class: 'big-picture-step forward', text: '›', title: 'Next (→)',
    'aria-label': 'Next screenshot',
  });

  const box = el('div', {
    class: 'big-picture', role: 'dialog', 'aria-modal': 'true',
    'aria-label': 'Screenshot',
  }, [
    el('div', { class: 'big-picture-middle' }, [shot]),
    el('div', { class: 'big-picture-foot' }, [caption, counter]),
    close,
    images.length > 1 ? back : null,
    images.length > 1 ? forward : null,
  ]);

  const draw = () => {
    const image = images[showing];
    shot.src = image.url;
    shot.alt = image.caption || '';
    caption.textContent = image.caption || '';
    counter.textContent =
      images.length > 1 ? `${showing + 1} of ${images.length}` : '';
  };

  const step = (by) => {
    showing = (showing + by + images.length) % images.length;
    draw();
  };

  const shut = () => {
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('hashchange', shut);
    document.body.classList.remove('picture-open');
    box.remove();
    if (cameFrom && cameFrom.focus) cameFrom.focus();
  };

  function onKey(e) {
    if (e.key === 'Escape') shut();
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
    else return;
    e.preventDefault();
  }

  // A click on the picture itself must not close it — only one past the edges.
  box.addEventListener('click', (e) => { if (e.target === box) shut(); });
  close.addEventListener('click', shut);
  back.addEventListener('click', () => step(-1));
  forward.addEventListener('click', () => step(1));
  document.addEventListener('keydown', onKey);
  // The back button is a way out of this too. Without it the picture would sit
  // over whatever page the reader landed on next.
  window.addEventListener('hashchange', shut);

  draw();
  document.body.classList.add('picture-open');
  document.body.append(box);
  close.focus();
}

/// A note above a list, saying in a sentence or two where the list came from,
/// with a button that opens the long answer in a box over the page.
///
/// The short version has to be on the page — a reader who never presses
/// anything should still know the list can be wrong. The long version is
/// behind a press because it is five paragraphs, and five paragraphs above
/// every visit to the front page is somebody else's page.
export function noteWithMore(shortText, { title, paragraphs, moreLabel }) {
  const more = el('button', {
    type: 'button', class: 'note-more', text: moreLabel || 'More about this',
  });
  more.addEventListener('click', () => openInfoDialog(title, paragraphs));

  return el('div', { class: 'list-note' }, [
    el('p', {}, [el('span', { text: `${shortText} ` }), more]),
  ]);
}

/// The box that note opens: a heading, some paragraphs, and a way out.
///
/// It is a real `<dialog>`, so Escape closes it and the keyboard stays inside
/// it, and it is thrown away on closing rather than left in the page — nothing
/// here is worth keeping between presses.
export function openInfoDialog(title, paragraphs) {
  // Where the keyboard was before this opened, so closing it puts the reader
  // back on the button they pressed.
  const cameFrom = document.activeElement;

  const close = el('button', {
    type: 'button', class: 'info-close', text: '×', 'aria-label': 'Close',
  });
  const dialog = el('dialog', { class: 'info-dialog' }, [
    el('div', { class: 'info-inner' }, [
      el('div', { class: 'info-head' }, [el('h2', { text: title }), close]),
      ...paragraphs.map((text) => el('p', { class: 'about-line', text })),
    ]),
  ]);

  // Closing means taking it out of the page, not only shutting it. Every way
  // out goes through here, and it is safe to call twice.
  const shut = () => {
    window.removeEventListener('hashchange', shut);
    if (dialog.open) dialog.close();
    dialog.remove();
    if (cameFrom && cameFrom.focus) cameFrom.focus();
  };

  close.addEventListener('click', shut);
  // A click on the dimmed page behind the box closes it, the same way the
  // settings box works. The box itself is the dialog's one child, so a click
  // on the dialog element and nowhere inside that child is the backdrop.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) shut();
  });
  // Escape is the browser's own way out. It is caught here rather than through
  // the dialog's `close` event, which not every browser sends.
  dialog.addEventListener('cancel', shut);
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') shut();
  });
  // The back button is a way out of this too, or the box would sit over
  // whatever page the reader landed on next.
  window.addEventListener('hashchange', shut);

  document.body.append(dialog);
  dialog.showModal();
  close.focus();
}

/// The line that names the mods something needs, with each one linked where
/// this site has a page for it.
///
/// Both a mod's own page and the reader's list say this, in the same words and
/// the same shape, so they are the same piece of the page.
export function neededModsLine(label, needs) {
  if (!needs || !needs.length) return null;

  // The names sit in one span of their own, so the commas stay against the
  // name in front of them rather than being spaced out as flex children.
  const names = el('span', { class: 'needs-list' });
  needs.forEach((needed, i) => {
    if (i) names.append(document.createTextNode(', '));
    names.append(needed.id
      ? el('a', { class: 'needed', href: modHref(needed.id), text: needed.name })
      : el('span', {
          class: 'needed unknown', text: needed.name,
          title: 'This site has no page for that one.',
        }));
  });

  return el('div', { class: 'needs-line' }, [
    el('span', { class: 'needs-label', text: label }),
    names,
  ]);
}

// --- The reader's own mod list ---

/// Where the reader's list is kept. In their own browser, and nowhere else —
/// there is no server here to keep it on.
const MY_LIST_KEY = 'starmodderMyList';

/// Anyone who wants to know when the list changes. The header count and
/// whatever page is open both watch it.
const listWatchers = new Set();

/// The mod ids in the reader's list, in the order they were added.
export function myList() {
  try {
    const saved = JSON.parse(localStorage.getItem(MY_LIST_KEY) || '[]');
    return Array.isArray(saved) ? saved.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function inMyList(id) {
  return myList().includes(id);
}

/// Puts a whole list in place, dropping anything repeated. Used by "add" and
/// "remove", and by taking somebody else's shared list as your own.
export function setMyList(ids) {
  const kept = [...new Set((ids || []).filter(Boolean))];
  localStorage.setItem(MY_LIST_KEY, JSON.stringify(kept));
  for (const watcher of listWatchers) watcher(kept);
  return kept;
}

/// Adds a mod, or takes it out again if it is already there. Returns whether it
/// is in the list afterwards.
export function toggleInMyList(id) {
  const now = myList();
  const at = now.indexOf(id);
  if (at >= 0) now.splice(at, 1);
  else now.push(id);
  setMyList(now);
  return at < 0;
}

export function watchMyList(fn) {
  listWatchers.add(fn);
  return () => listWatchers.delete(fn);
}

/// The address that shares a list: the ids packed into the hash, so the whole
/// list travels in the link and needs nothing at the other end.
export function listHref(ids) {
  return buildHash(['list'], { ids: (ids || []).join(',') });
}

/// What a download button should say, given the download it would follow.
///
/// The wording matters more here than anywhere else on the site: a reader who
/// presses "Download" and lands on a page asking them to install an app, or on
/// a host's own page with a countdown on it, has been misled by one word.
///
/// The three states a download can be in: a TriOS link, a link straight to a
/// file, and a link to somebody's download page. A mod with no download at all
/// is answered by [downloadButton], which offers the mod's own page instead.
function downloadLabel(best) {
  if (best.kind === 'trios') return 'Install with TriOS';
  return best.needsAnotherStep ? 'Download page' : 'Download';
}

// The original pages a summary card or row can point to. Forum leads when a
// mod was found in more than one place, matching the order on the mod's own
// page. The icons are kept here with the other small site-owned marks so the
// page never fetches an icon from an outside host.
const ORIGINAL_PAGES = [
  {
    field: 'forumUrl', name: 'the Starsector forum', label: 'On the forum',
    icon: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" '
      + 'stroke="currentColor" stroke-width="2" stroke-linecap="round" '
      + 'focusable="false" aria-hidden="true"><circle cx="12" cy="12" r="9"/>'
      + '<path d="M3 12h18M12 3c3 3.3 3 14.7 0 18M12 3c-3 3.3-3 14.7 0 18"/>'
      + '</svg>',
  },
  {
    field: 'discordUrl', name: 'Discord', label: 'On Discord',
    icon: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" '
      + 'stroke="currentColor" stroke-width="2" stroke-linecap="round" '
      + 'stroke-linejoin="round" focusable="false" aria-hidden="true">'
      + '<path d="M7 8.5A6 6 0 0 1 17 8.5l2 7.5-3 2-1.5-2h-5L8 18l-3-2 2-7.5Z"/>'
      + '<circle cx="9.5" cy="12" r="1" fill="currentColor" stroke="none"/>'
      + '<circle cx="14.5" cy="12" r="1" fill="currentColor" stroke="none"/>'
      + '</svg>',
  },
  {
    field: 'nexusUrl', name: 'Nexus Mods', label: 'On Nexus Mods',
    icon: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" '
      + 'stroke="currentColor" stroke-width="2" stroke-linejoin="round" '
      + 'focusable="false" aria-hidden="true"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/>'
      + '<path d="m9 16 6-8M9 8v8M15 8v8"/></svg>',
  },
];

function originalPageOf(mod) {
  return ORIGINAL_PAGES.find((page) => mod[page.field]) || null;
}

function originalPageButton(mod, page) {
  const tooltip = `Open on ${page.name} in a new tab.`;
  const button = el('a', {
    class: 'btn btn-primary original-page-btn',
    href: mod[page.field],
    rel: 'noopener nofollow',
    target: '_blank',
    title: tooltip,
    'aria-label': tooltip,
  }, [
    el('span', { class: 'original-page-icon', html: page.icon, 'aria-hidden': 'true' }),
  ]);
  button.addEventListener('click', (e) => { e.stopPropagation(); });
  return button;
}

/// The one button that gets a mod, for every list on the site.
///
/// A mod can offer a dozen downloads and My List used to draw a button for each
/// one, which asked the reader to choose between four buttons all saying
/// "Download". The builder has already put them in order, so this shows the
/// first — the same thing TriOS's catalog does on a mod's card.
///
/// Where there is both a download and an original forum, Discord or Nexus page,
/// summary cards and rows split the same fixed width between them. The download
/// keeps three quarters and the original-page icon gets one quarter. The large
/// button on the mod's own page stays single because that page already carries
/// the original link beside it.
///
/// A quarter of mods have nothing to download, so the button offers the mod's
/// own place on the web instead — its forum thread, Discord post or Nexus Mods
/// page. A mod with none of those gets no button, because a button that goes
/// nowhere is worse than no button.
export function downloadButton(mod, opts = {}) {
  const { big = false } = opts;
  const best = mod.bestDownload || null;
  const originalPage = originalPageOf(mod);
  const href = best ? best.url : (originalPage ? mod[originalPage.field] : null);
  if (!href) return null;

  const label = best ? downloadLabel(best)
    : originalPage.label;
  const count = mod.downloadCount || 0;
  const button = el('a', {
    class: `btn btn-primary download-btn${big ? ' btn-big' : ''}`,
    href,
    rel: 'noopener nofollow',
    target: '_blank',
    text: label,
    'aria-label': `${label}: ${modName(mod)}`,
    title: count > 1
      ? `${count} downloads. The mod's own page lists them all.`
      : null,
  });
  // On a card and on a row the button sits inside, or on top of, one big link
  // to the mod's page. Without this a press would follow that link as well.
  button.addEventListener('click', (e) => { e.stopPropagation(); });
  if (big || !best || !originalPage) return button;

  return el('span', { class: 'download-actions' }, [
    button,
    originalPageButton(mod, originalPage),
  ]);
}

/// "3 downloads", for the row of small facts a card and a row already carry.
///
/// It is not a link: the card, the row and the mod's name are all already links
/// to the mod's own page, which is where the downloads are listed. Null for a
/// mod with one download or none, which is most of them.
export function downloadCountBadge(mod) {
  const count = mod.downloadCount || 0;
  if (count < 2) return null;
  return el('span', {
    class: 'badge downloads',
    text: `${count} downloads`,
    title: "Mirrors and older versions. The mod's own page lists them all.",
  });
}

/// The button that puts a mod in the reader's list, or takes it out.
///
/// Small and round on a card, where it sits over the picture; wide and worded
/// on the mod's own page, where it stands beside the download. One button
/// either way, so the two can never disagree about what is in the list.
export function listToggle(mod, opts = {}) {
  const { wide = false } = opts;
  const button = el('button', { class: wide ? 'btn btn-big' : 'list-toggle' });

  const draw = () => {
    const inIt = inMyList(mod.id);
    button.classList.toggle('on', inIt);
    button.textContent = wide
      ? (inIt ? '✓ In my list' : '+ Add to my list')
      : (inIt ? '✓' : '+');
    button.title = inIt ? 'Take out of my list' : 'Add to my list';
    button.setAttribute('aria-pressed', String(inIt));
    button.setAttribute('aria-label',
      `${inIt ? 'Take' : 'Add'} ${modName(mod)} ${inIt ? 'out of' : 'to'} my list`);
  };

  button.addEventListener('click', (e) => {
    // On a card the button sits on top of one big link. Without this the click
    // would follow the link as well as tick the box.
    e.preventDefault();
    e.stopPropagation();
    toggleInMyList(mod.id);
    draw();
  });

  draw();
  return button;
}

/// Counts how often each value turns up across the mods, biggest first.
///
/// Biggest first rather than alphabetical, so what a reader's eye lands on is
/// what is worth trying. It also means no list of its own to be kept in step
/// with the builder's.
export function countedAcross(mods, pick) {
  const counts = new Map();
  for (const mod of mods || []) {
    for (const value of pick(mod) || []) {
      if (value) counts.set(value, (counts.get(value) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
}

/// A row of category chips, each with how many mods are on it, each a link to
/// that category on the browse page.
///
/// This is the only way to browse by kind that a reader can actually use. The
/// dropdown it replaces held 26 overlapping names; the site publishes thirteen
/// and shows them all at once.
export function categoryChips(mods, opts = {}) {
  const { chosen = null, onPick = null } = opts;

  const inOrder = countedAcross(mods, (mod) => mod.categories);
  if (!inOrder.length) return null;

  const row = el('div', { class: 'chips' });
  for (const [category, count] of inOrder) {
    const on = category === chosen;
    const chip = el(onPick ? 'button' : 'a', {
      class: on ? 'chip on' : 'chip',
      href: onPick ? null : buildHash(['browse'], { category }),
      'aria-pressed': onPick ? String(on) : null,
      'aria-label': `${category}, ${count} mod${count === 1 ? '' : 's'}`,
    }, [
      el('span', { text: category }),
      el('span', { class: 'chip-count', text: String(count) }),
    ]);
    // A chip that is already on turns itself off, so a reader is never stuck
    // inside one category with no way out but the browser's back button.
    if (onPick) chip.addEventListener('click', () => onPick(on ? '' : category));
    row.append(chip);
  }
  return row;
}

/// A plain name for each place a mod was found.
const SOURCE_NAMES = {
  forum: 'Starsector forum',
  discord: 'Discord',
};

/// True when Discord is the only place this mod was found. Those used to be
/// published under a category called "Discord Only", which said where a mod
/// came from rather than what kind of mod it is.
///
/// A mod with a forum thread never counts, even where Discord is the only
/// place we read it from. A lot of Discord posts link the mod's own forum
/// thread, and telling a reader a mod is "Discord only" while its page offers
/// them the forum thread is simply wrong.
export function isDiscordOnly(mod) {
  const sources = (mod && mod.sources) || [];
  if (mod && mod.forumUrl) return false;
  return sources.length === 1 && sources[0] === 'discord';
}

export function sourceName(source) {
  return SOURCE_NAMES[source] || source;
}

// --- The search box, and the panel saying what it understands ---

/// What the search can do, for the panel that explains it. A name, the thing
/// to type, and an example.
///
/// Only ways the search really has belong here. Offering one it does not — a
/// way of asking for all of several terms at once, say, or naming a field —
/// leaves a reader typing something that quietly matches nothing.
/// Every line is a name, then how it works with something to type. A string is
/// words; a `code` is the letters themselves.
const WAYS_TO_SEARCH = [
  {
    name: 'OR',
    says: ['comma-separated: ', { code: 'faction, portrait' }, ' matches either term'],
  },
  {
    name: 'AND',
    says: ['plus-separated: ', { code: 'hartley + abuse' }, ' must match all terms'],
  },
  {
    name: 'Exclude',
    says: ['prefix with ', { code: '-' }, ' to hide results, e.g. ',
      { code: 'faction, -portrait' }],
  },
  {
    name: 'Acronyms',
    says: ['e.g. ', { code: 'swp' }, ' matches Ship/Weapon Pack'],
  },
  {
    name: 'Versions',
    says: ['e.g. ', { code: '0.98' }, ' matches mods for that release'],
  },
  {
    name: 'Field search',
    says: [{ code: 'key:value' }, ' syntax, e.g. ', { code: 'source:forum' },
      ', ', { code: 'author:Wisp' }, ', ', { code: 'category:weapons' }, ', ',
      { code: 'version:0.97' }],
  },
];

/// A search box with a panel that says what the search understands.
///
/// The panel is shown only while the pointer is over the search field. Focusing
/// the box to type does not open it, so it cannot cover the results just because
/// somebody is using the search.
///
/// `hideWhileTyping` is for the box at the top of every page, where the
/// suggested mods want the same room. Empty box: the panel. Typing: the
/// suggestions.
export function searchHelpField(input, { hideWhileTyping = false } = {}) {
  const panel = el('div', { class: 'search-help' }, [
    el('p', {
      class: 'search-help-lead',
      text: 'Searches mod names, authors, categories, and descriptions.',
    }),
    ...WAYS_TO_SEARCH.map((way) => el('p', {}, [
      el('strong', { text: way.name }),
      ' — ',
      ...way.says.map((bit) => (typeof bit === 'string' ? bit : el('code', { text: bit.code }))),
    ])),
  ]);

  const help = el('span', {
    class: 'search-help-mark',
    text: '?',
    'aria-hidden': 'true',
  });

  const field = el('div', { class: 'search-field' }, [input, help, panel]);

  if (hideWhileTyping) {
    const sync = () => field.classList.toggle('help-off', input.value.trim() !== '');
    input.addEventListener('input', sync);
    sync();
  }
  return field;
}

// --- Names and versions ---

/// The name to show for a mod.
///
/// A thread title carries the game version in brackets, the mod version, dates
/// and sometimes a leading dash. The builder publishes a tidied `displayName`
/// where it differs from the title; where it does not, the title was already
/// the name.
export function modName(mod) {
  return (mod && (mod.displayName || mod.name)) || '';
}

/// The other names one credited person goes by on this mod.
///
/// `otherAuthorNames` is keyed by the name in `authors`, because a mod can
/// credit two people and their other names must not be mixed up together.
export function otherNamesOf(mod, author) {
  const map = (mod && mod.otherAuthorNames) || {};
  const wanted = String(author).toLowerCase();
  for (const [name, others] of Object.entries(map)) {
    if (name.toLowerCase() === wanted) return others || [];
  }
  return [];
}

/// Every other name anyone credited on this mod goes by, in one list. For
/// searching, where it does not matter whose name is whose.
export function everyOtherName(mod) {
  const map = (mod && mod.otherAuthorNames) || {};
  return Object.values(map).flat();
}

/// The address of a mod's own page.
export function modHref(id) {
  return `#/mods/${encodeURIComponent(id)}`;
}

/// The number part of a game version: "0.98a", "0.98" and "0.98a-RC8" all come
/// back as "0.98". It is what the filter groups on, so one game release is one
/// choice rather than three.
export function gameVersionFamily(version) {
  const match = /^\s*v?(\d+(?:\.\d+)*)/.exec(String(version || ''));
  return match ? match[1] : String(version || '').trim();
}

/// Compares two game versions as numbers, so "0.9" comes before "0.98".
export function compareGameVersions(a, b) {
  const left = gameVersionFamily(a).split('.').map(Number);
  const right = gameVersionFamily(b).split('.').map(Number);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (left[i] || 0) - (right[i] || 0);
    if (diff) return diff;
  }
  return 0;
}

/// How few mods a game version can have and still be taken for the current one.
/// A single mod whose version was misread as "9.99" must not push every real
/// mod into "older".
const ENOUGH_MODS_TO_BE_CURRENT = 5;

/// Every game version in the data, grouped into one entry per game release:
/// the number they share, the spelling to show, and how many mods are on it.
/// Highest first.
export function gameVersions(mods) {
  const families = new Map();
  for (const mod of mods || []) {
    const version = mod.gameVersion;
    if (!version) continue;
    const family = gameVersionFamily(version);
    if (!families.has(family)) {
      families.set(family, { family, count: 0, spellings: new Map() });
    }
    const entry = families.get(family);
    entry.count += 1;
    entry.spellings.set(version, (entry.spellings.get(version) || 0) + 1);
  }

  return [...families.values()]
    .map((entry) => ({
      family: entry.family,
      count: entry.count,
      // The spelling most mods use, so "0.98a" wins over one stray "0.98".
      label: [...entry.spellings.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0],
    }))
    .sort((a, b) => compareGameVersions(b.family, a.family));
}

/// The game version the site treats as current: the highest one enough mods
/// are on. Null when the data says nothing useful.
export function currentGameVersion(mods) {
  const found = gameVersions(mods)
    .filter((v) => v.count >= ENOUGH_MODS_TO_BE_CURRENT);
  return found.length ? found[0].family : null;
}

/// Where a reader says something on a mod's page is wrong, or asks for their
/// mod to be taken down. Everything here is collected off other people's posts
/// by a machine, so some of it will be wrong and there has to be one obvious
/// place to say so.
export const PROBLEM_REPORT_BASE =
  'https://github.com/wispborne/StarsectorModRepo/issues/new';

/// How far behind the current game release a mod is: 'current', 'one-behind'
/// or 'old'. Null when either version is unknown.
export function versionStanding(mod, current) {
  if (!current || !mod || !mod.gameVersion) return null;
  const family = gameVersionFamily(mod.gameVersion);
  if (family === current) return 'current';

  // One behind means the last part is one lower — "0.97" against "0.98".
  const a = family.split('.').map(Number);
  const b = current.split('.').map(Number);
  if (a.length === b.length && a.slice(0, -1).join('.') === b.slice(0, -1).join('.')
      && b[b.length - 1] - a[a.length - 1] === 1) {
    return 'one-behind';
  }
  return 'old';
}

/// What a game version badge says on hover, for each standing. Null where
/// there is nothing worth saying.
export function versionStandingNote(standing) {
  if (standing === 'current') return 'Built for the current game release.';
  if (standing === 'one-behind') return 'Built for the game release before this one.';
  if (standing === 'old') return 'Built for an older game release.';
  return null;
}

/// What the version badge beside a mod's name means. The game version badge
/// next to it explains itself, so this one should too.
export const MOD_VERSION_NOTE =
  "The mod's own version, as the author last gave it.";

// --- Dates ---

/// A date written the way a reader reads it: "14 August 2026". Takes either a
/// `YYYY-MM-DD` day or a full timestamp.
///
/// A timestamp is shown in the reader's own time zone, because it names a
/// moment and the reader wants to know when that was for them: data collected
/// at one in the morning UTC was the evening before in America. A bare
/// `YYYY-MM-DD` is a day and nothing else, so it is shown exactly as written —
/// turning it into local time would land it on the day before for every reader
/// west of Greenwich.
export function formatDay(value) {
  const when = readDate(value);
  if (!when) return '';
  return when.toLocaleDateString(undefined, {
    day: 'numeric', month: 'long', year: 'numeric',
    timeZone: isDayOnly(value) ? 'UTC' : undefined,
  });
}

/// A moment written out in full: "24 August 2026 at 20:34", in the reader's
/// own time zone and their own way of writing a date and a clock.
///
/// This is for the two lines that say how fresh what you are reading is. The
/// scraper runs twice a day, so the day on its own leaves a reader wondering
/// whether "today" means this morning or ten minutes ago. A bare `YYYY-MM-DD`
/// has no time in it to show, so it falls back to the day alone.
export function formatMoment(value) {
  if (isDayOnly(value)) return formatDay(value);
  const when = readDate(value);
  if (!when) return '';
  return when.toLocaleString(undefined, {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

/// True for a bare `YYYY-MM-DD`, which names a day rather than a moment.
function isDayOnly(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/// How long ago something was, in plain words: "today", "3 days ago".
export function howLongAgo(value) {
  const when = readDate(value);
  if (!when) return '';
  const days = Math.floor((Date.now() - when.getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  if (months < 24) return `${months} month${months === 1 ? '' : 's'} ago`;
  return `${Math.round(days / 365)} years ago`;
}

function readDate(value) {
  if (!value) return null;
  // A bare `YYYY-MM-DD` is read as that day in UTC, so it never lands on the
  // day before for a reader west of Greenwich.
  const day = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value;
  const when = new Date(day);
  return Number.isNaN(when.getTime()) ? null : when;
}

// --- Lists ---

/// Joins names the way a person would: "a", "a and b", "a, b and c".
export function joinNames(names) {
  const list = (names || []).filter(Boolean);
  if (!list.length) return '';
  if (list.length === 1) return list[0];
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

/// How many rows a page holds. 0 means all of them at once.
export const PAGE_SIZES = [24, 48, 96, 240, 0];
const PAGE_SIZE_KEY = 'starmodderPageSize';
const DEFAULT_PAGE_SIZE = 48;

export function pageSizePreference() {
  // The raw value is checked before it is turned into a number, because an
  // unset setting reads as null and `Number(null)` is 0 — which is a real
  // choice here, meaning "all on one page". A first visit would otherwise draw
  // every mod at once.
  const saved = localStorage.getItem(PAGE_SIZE_KEY);
  if (saved === null || saved === '') return DEFAULT_PAGE_SIZE;
  const size = Number(saved);
  return PAGE_SIZES.includes(size) ? size : DEFAULT_PAGE_SIZE;
}

export function setPageSizePreference(size) {
  localStorage.setItem(PAGE_SIZE_KEY, String(size));
}

/// The row of page buttons, with a box for how many rows a page holds.
export function pager(page, pageSize, total, onPage, onPageSize) {
  const showingAll = !pageSize;
  const pages = showingAll ? 1 : Math.max(1, Math.ceil(total / pageSize));
  const cur = showingAll ? 1 : page + 1;
  const row = el('div', { class: 'pager' });
  const btn = (label, target, disabled) =>
    el('button', {
      class: 'btn',
      text: label,
      disabled: disabled ? 'true' : null,
      onclick: () => onPage(target),
    });

  if (!showingAll) {
    row.append(btn('« First', 0, page <= 0), btn('‹ Prev', page - 1, page <= 0));
  }
  row.append(el('span', {
    class: 'pager-info',
    text: showingAll
      ? `All ${total} on one page`
      : `Page ${cur} of ${pages} (${total} mods)`,
  }));
  if (!showingAll) {
    row.append(btn('Next ›', page + 1, cur >= pages),
      btn('Last »', pages - 1, cur >= pages));
  }

  if (onPageSize) {
    const select = el('select', { class: 'pager-size' });
    for (const size of PAGE_SIZES) {
      select.append(el('option', {
        value: String(size),
        text: size === 0 ? 'All on one page' : `${size} per page`,
      }));
    }
    select.value = String(
      PAGE_SIZES.includes(pageSize) ? pageSize : DEFAULT_PAGE_SIZE);
    select.addEventListener('change', () => {
      const picked = Number(select.value);
      setPageSizePreference(picked);
      onPageSize(picked);
    });
    row.append(el('label', { class: 'pager-size-label' }, [
      el('span', { text: 'Show ' }), select,
    ]));
  }
  return row;
}
