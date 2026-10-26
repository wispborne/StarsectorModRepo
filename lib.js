// Shared helpers for the public site: building DOM, reading the address, and
// fetching the published data files.
//
// There is no server behind this site. Every page is drawn in the browser from
// files fetched off the same origin the pages came from, and nothing here can
// change anything.

import { address } from './address.js';

import { everyOtherName, modName, otherNamesOf } from './mod_names.js';

export { everyOtherName, modName, otherNamesOf };
import {
  compareGameVersions, compareVersions, gameVersionFamily, repairGameVersion,
} from './version.js';

export { compareGameVersions, compareVersions, gameVersionFamily, repairGameVersion };

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

/// A fetch that got an answer, but not the file it wanted. [status] is the
/// answer's status; [notJson] says a successful answer was not JSON, which is
/// what a host that answers a missing file with the front page sends.
export class FetchError extends Error {
  constructor(message, { status = null, notJson = false } = {}) {
    super(message);
    this.status = status;
    this.notJson = notJson;
  }
}

/// True when [err] means the file is not there, rather than that fetching it
/// went wrong: a 404, or a successful answer that is not JSON.
export function isMissingFile(err) {
  return err instanceof FetchError && (err.status === 404 || (err.notJson && err.status < 400));
}

async function fetchJson(url) {
  const res = await fetch(url, { credentials: 'omit' });
  if (!res.ok) throw new FetchError(`${res.status} ${res.statusText} for ${url}`, { status: res.status });
  try {
    return await res.json();
  } catch {
    throw new FetchError(`${url} did not come back as JSON`, { status: res.status, notJson: true });
  }
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
  // Set loading and referrer policy before src starts the request.
  const img = el('img', {
    class: className, alt, title, loading: 'lazy', referrerpolicy: 'no-referrer',
    src: url,
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

// Append to the body to avoid clipping by cards. Read dynamic text on hover.
// `text` may also be a built element, for a tip with parts of its own.
export function quickTip(node, text) {
  node.addEventListener('pointerenter', () => {
    const words = typeof text === 'function' ? text() : text;
    if (!words) return;
    hideQuickTip();
    const tip = words instanceof Node
      ? el('div', { class: 'quick-tip rich', role: 'tooltip' }, [words])
      : el('div', { class: 'quick-tip', role: 'tooltip', text: words });
    document.body.append(tip);
    const at = node.getBoundingClientRect();
    const size = tip.getBoundingClientRect();
    const left = Math.min(
      Math.max(4, at.left + at.width / 2 - size.width / 2),
      window.innerWidth - size.width - 4,
    );
    const above = at.top - size.height - 6;
    tip.style.left = `${left}px`;
    tip.style.top = `${above >= 4 ? above : at.bottom + 6}px`;
    shownTip = tip;
  });
  node.addEventListener('pointerleave', hideQuickTip);
  return node;
}

let shownTip = null;
function hideQuickTip() {
  shownTip?.remove();
  shownTip = null;
}
// Scrolling is caught on the way down, so a tip in a column that scrolls on
// its own (a mod page's side column) goes away too: a scroll event does not
// travel up the page.
for (const event of ['scroll', 'hashchange', 'popstate']) {
  window.addEventListener(event, hideQuickTip, { passive: true, capture: event === 'scroll' });
}

// --- The address bar ---

/// The query part of the current hash, as URLSearchParams. Only the pages that
/// live on the front document carry one, so this reads the hash and nothing
/// else; a mod's page has no hash and no query of its own.
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

/// Goes to a page and draws it, adding one history entry. It never reloads the
/// site, whichever of the two address shapes each page has.
export function go(hash) {
  address().go(hash);
}

/// Changes the address without adding a history entry or redrawing the page. A
/// list calls this as its search, filters and page change, so a reload or a
/// bookmark brings the same list back without every keystroke piling up in the
/// back button.
export function replaceHash(hash) {
  address().replace(hash);
  if (activeScrollKey !== null) activeScrollKey = scrollStorageKey(hash);
}

// --- The AI summaries setting ---

/// Kept in `localStorage` like every other setting. It used to be a cookie
/// under the same name; `savedAiSummaryMode` moves an old one across.
const AI_KEY = 'starmodderAiSummaries';

/// The three choices, the same three TriOS offers and in the same order:
/// prefer the AI summary, use it only where the author wrote nothing, or
/// never show it. The banner and the Settings dialog both draw from this, so
/// they always say the same thing.
export const AI_SUMMARY_CHOICES = [
  { mode: 'always', name: 'Always', note: 'Prefer the consistent, succinct AI summaries.' },
  {
    mode: 'whenMissing', name: 'Only as a fallback',
    note: 'Only show the AI summary if there\'s no human description.',
  },
  { mode: 'never', name: 'Never', note: 'Never ever show AI summaries - humans only!' },
];

export const AI_SUMMARY_MODES = AI_SUMMARY_CHOICES.map((choice) => choice.mode);

/// What the reader picked, defaulting to "whenMissing".
export function aiSummaryMode() {
  const saved = savedAiSummaryMode();
  if (AI_SUMMARY_MODES.includes(saved)) return saved;
  // The setting used to be a plain on/off, so a reader who turned it off
  // before keeps that choice. "on" was the same as "whenMissing" is now.
  if (saved === 'off') return 'never';
  return 'whenMissing';
}

/// Remembers the reader's choice, so it holds between visits.
export function setAiSummaryMode(mode) {
  try {
    localStorage.setItem(AI_KEY, mode);
  } catch {
    // Kept for this visit only.
  }
  window.dispatchEvent(new Event('ai-caption-preference-changed'));
}

/// The saved choice as written, or null. A choice still in the old cookie is
/// copied into `localStorage` and the cookie deleted, so nobody loses it.
function savedAiSummaryMode() {
  let saved = null;
  try {
    saved = localStorage.getItem(AI_KEY);
  } catch {
    // No storage: fall through to the cookie, which may still hold a choice.
  }
  if (saved !== null) return saved;

  const fromCookie = readCookie(AI_KEY);
  if (fromCookie === null) return null;
  try {
    localStorage.setItem(AI_KEY, fromCookie);
    // Only once it is safely moved, or a reader with no storage loses it.
    document.cookie = `${AI_KEY}=; path=/; max-age=0; SameSite=Lax`;
  } catch {
    // No storage: keep reading the cookie.
  }
  return fromCookie;
}

/// The banner at the top of Home and Browse that asks the reader how much AI
/// writing they want, with the same three choices as Settings. The choice in
/// use is marked, and picking another redraws the page through [onPicked] with
/// the banner still there, so the reader sees what each choice does. Only its
/// Hide button takes it away, and that is remembered.
///
/// Returns null once the reader has hidden it.
export function aiSummaryBanner(onPicked) {
  if (aiBannerHidden()) return null;

  const current = aiSummaryMode();
  const choice = ({ mode, name, note }) => {
    const button = el('button', {
      type: 'button', class: 'ai-banner-choice', title: note,
      'aria-pressed': String(mode === current),
    }, [
      el('span', { class: 'choice-name', text: name }),
      el('span', { class: 'choice-note', text: note }),
    ]);
    button.addEventListener('click', () => {
      setAiSummaryMode(mode);
      onPicked();
    });
    return button;
  };
  const hide = el('button', {
    type: 'button', class: 'ai-banner-hide',
    title: 'Hide this. You can still change it in Settings.',
  }, [
    el('span', { class: 'ai-banner-hide-icon', html: HIDE_ICON, 'aria-hidden': 'true' }),
    el('span', { text: 'Hide' }),
  ]);

  const banner = el('section', { class: 'ai-banner', 'aria-labelledby': 'ai-banner-title' }, [
    el('div', { class: 'ai-banner-head' }, [
      el('h2', { id: 'ai-banner-title', text: 'AI-written mod summaries' }),
      hide,
    ]),
    el('p', {
      text: 'Not all mods include a description and some of them are not very useful.'
    }),
    el('p', {
      text: 'You may choose to never see AI-gen summaries, see one only if there\'s no real (human) one, or always see them.',
    }),
    el('div', { class: 'ai-banner-choices' }, AI_SUMMARY_CHOICES.map(choice)),
    el('p', {
      text: 'You can change this again later in Settings. Summaries were generated on personally-owned hardware and not used for training.',
    }),
  ]);
  hide.addEventListener('click', () => {
    try {
      localStorage.setItem(AI_BANNER_KEY, 'hidden');
    } catch {
      // Hidden for this page only.
    }
    banner.remove();
  });
  return banner;
}

const AI_BANNER_KEY = 'starmodderAiBanner';

// Tabler eye-off icon (MIT).
const HIDE_ICON = '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" '
  + 'stroke="currentColor" stroke-width="2" stroke-linecap="round" '
  + 'stroke-linejoin="round" focusable="false" aria-hidden="true">'
  + '<path d="M10.585 10.587a2 2 0 0 0 2.829 2.828"/>'
  + '<path d="M16.681 16.673a8.717 8.717 0 0 1 -4.681 1.327c-3.6 0 -6.6 -2 -9 -6'
  + 'c1.272 -2.12 2.712 -3.678 4.32 -4.674m2.86 -1.146a9.055 9.055 0 0 1 1.82 -.18'
  + 'c3.6 0 6.6 2 9 6c-.666 1.11 -1.379 2.067 -2.138 2.87"/>'
  + '<path d="M3 3l18 18"/></svg>';

function aiBannerHidden() {
  try {
    return localStorage.getItem(AI_BANNER_KEY) === 'hidden';
  } catch {
    return false;
  }
}

function readCookie(name) {
  for (const part of document.cookie.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

// --- The theme setting ---

// Theme ids match style.css. Browser Default follows the browser's colour
// scheme: Independents on dark pages, the light colours on light pages.
export const THEMES = [
  { id: 'browser-default', name: 'Browser Default' },
  // Kept as 'dark' so readers who already picked it keep it.
  { id: 'dark', name: 'TriOS' },
  { id: 'light', name: 'Light' },
  { id: 'sigma', name: 'Sigma' },
  { id: 'redacted', name: '[REDACTED]' },
  { id: 'player', name: 'Player' },
  { id: 'one-dark', name: 'One Dark' },
  { id: 'one-dark-blue', name: 'One Dark Blue' },
  { id: 'independents-light', name: 'Independents' },
  // Kept as 'independents' so readers who already picked it keep the look
  // they picked.
  { id: 'independents', name: 'Independents (Darker)' },
  { id: 'lavender', name: 'Lavender' },
  { id: 'knights-of-ludd', name: 'Knights of Ludd' },
  { id: 'sindrian-diktat', name: 'Sindrian Diktat' },
];
const THEME_KEY = 'starmodderTheme';

export function themePreference() {
  const saved = localStorage.getItem(THEME_KEY);
  return THEMES.some((t) => t.id === saved) ? saved : 'browser-default';
}

// index.html also applies the saved theme before first paint.
export function setThemePreference(theme) {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme();
}

export function applyTheme() {
  const theme = themePreference();
  if (theme === 'browser-default') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
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

// Off replaces inline pictures with links without fetching the images.
export const INLINE_PICTURE_CHOICES = ['on', 'off'];
const INLINE_PICTURES_KEY = 'starmodderInlinePictures';

export function inlinePictures() {
  try {
    const saved = localStorage.getItem(INLINE_PICTURES_KEY);
    return INLINE_PICTURE_CHOICES.includes(saved) ? saved : 'on';
  } catch {
    return 'on';
  }
}

export function setInlinePictures(choice) {
  try {
    localStorage.setItem(INLINE_PICTURES_KEY, choice);
  } catch {
    // Ignore unavailable storage.
  }
}

// --- Animations ---

// "device" (the default) follows the device's reduce motion setting.
// Off stops other animations and keeps each GIF with a .gif address on
// its first frame; a GIF opened in the picture viewer still plays.
export const MOTION_CHOICES = ['device', 'on', 'off'];
const MOTION_KEY = 'starmodderMotion';
const DEVICE_REDUCES_MOTION = matchMedia('(prefers-reduced-motion: reduce)');

export function motionChoice() {
  try {
    const saved = localStorage.getItem(MOTION_KEY);
    return MOTION_CHOICES.includes(saved) ? saved : 'device';
  } catch {
    return 'device';
  }
}

export function setMotionChoice(choice) {
  try {
    localStorage.setItem(MOTION_KEY, choice);
  } catch {
    // Ignore unavailable storage.
  }
  applyMotion();
}

export function reduceMotion() {
  const choice = motionChoice();
  return choice === 'off' || (choice === 'device' && DEVICE_REDUCES_MOTION.matches);
}

// index.html also sets data-motion before first paint.
export function applyMotion() {
  const reduce = reduceMotion();
  if (reduce) document.documentElement.dataset.motion = 'reduce';
  else delete document.documentElement.dataset.motion;
  holdGifsStill(reduce);
}

DEVICE_REDUCES_MOTION.addEventListener('change', () => applyMotion());

// Maps each first-frame canvas to its original GIF image.
const gifOfStill = new WeakMap();
let gifWatch = null;

// One observer handles GIFs anywhere on the page:
// cards, posts, the gallery and Discord posts.
function holdGifsStill(on) {
  if (!on) {
    gifWatch?.disconnect();
    gifWatch = null;
    for (const img of document.querySelectorAll('img[data-gif-waiting]')) {
      delete img.dataset.gifWaiting;
    }
    for (const still of document.querySelectorAll('canvas.still-gif')) {
      const img = gifOfStill.get(still);
      if (img) still.replaceWith(img);
    }
    return;
  }
  if (gifWatch) return;
  gifWatch = new MutationObserver((changes) => {
    for (const change of changes) {
      for (const node of change.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (node.tagName === 'IMG') watchGif(node);
        else for (const img of node.querySelectorAll('img')) watchGif(img);
      }
    }
  });
  gifWatch.observe(document.body, { childList: true, subtree: true });
  for (const img of document.querySelectorAll('img')) watchGif(img);
}

function isGifAddress(src) {
  if (!src) return false;
  try {
    return /\.gif$/i.test(new URL(src, document.baseURI).pathname);
  } catch {
    return false;
  }
}

function watchGif(img) {
  // GIFs opened in the picture viewer still play.
  if ('plays' in img.dataset || !isGifAddress(img.getAttribute('src'))) return;
  if (img.complete && img.naturalWidth) {
    stillFrame(img);
    return;
  }
  // Hide the GIF while loading to prevent visible playback.
  img.dataset.gifWaiting = '';
  img.addEventListener('load', () => stillFrame(img), { once: true });
  img.addEventListener('error', () => delete img.dataset.gifWaiting, { once: true });
}

/// Replace the GIF with a canvas showing its first frame. Drawing an image
/// from another site is allowed; reading the canvas back is blocked,
/// and nothing here reads it. Keep the original image so turning animations on
/// restores it. Forward canvas clicks to the image so images that
/// open the picture viewer still work.
function stillFrame(img) {
  delete img.dataset.gifWaiting;
  if (!img.isConnected || !reduceMotion() || !img.naturalWidth) return;
  const still = document.createElement('canvas');
  still.width = img.naturalWidth;
  still.height = img.naturalHeight;
  try {
    still.getContext('2d').drawImage(img, 0, 0);
  } catch {
    return;
  }
  still.className = img.className;
  still.classList.add('still-gif');
  if (img.title) still.title = img.title;
  if (img.alt) {
    still.setAttribute('role', 'img');
    still.setAttribute('aria-label', img.alt);
  }
  // Image width and height set the display size; on a canvas,
  // those attributes set the pixel dimensions.
  const width = img.getAttribute('width');
  const height = img.getAttribute('height');
  if (width) still.style.width = `${width}px`;
  else if (height) still.style.height = `${height}px`;
  still.addEventListener('click', (e) => {
    const copy = new MouseEvent('click', e);
    if (!img.dispatchEvent(copy)) e.preventDefault();
  });
  gifOfStill.set(still, img);
  img.replaceWith(still);
}

// Whether the "Summary generated by AI" line shows under an AI summary. Hiding
// it leaves the sparkle, so the summary is still marked as AI.
export const AI_NOTE_CHOICES = ['show', 'hide'];
const AI_NOTE_KEY = 'starmodderAiNote';

export function aiNoteChoice() {
  try {
    const saved = localStorage.getItem(AI_NOTE_KEY);
    return AI_NOTE_CHOICES.includes(saved) ? saved : 'show';
  } catch {
    return 'show';
  }
}

export function setAiNoteChoice(choice) {
  try {
    localStorage.setItem(AI_NOTE_KEY, choice);
  } catch {
    // Ignore unavailable storage.
  }
}

// Mod-page AI visibility is independent of the list summary preference.
export const AI_ON_MOD_PAGES_CHOICES = ['show', 'hide'];
const AI_ON_MOD_PAGES_KEY = 'starmodderAiOnModPages';

export function aiOnModPages() {
  try {
    const saved = localStorage.getItem(AI_ON_MOD_PAGES_KEY);
    return AI_ON_MOD_PAGES_CHOICES.includes(saved) ? saved : 'show';
  } catch {
    return 'show';
  }
}

export function setAiOnModPages(choice) {
  try {
    localStorage.setItem(AI_ON_MOD_PAGES_KEY, choice);
  } catch {
    // Ignore unavailable storage.
  }
  window.dispatchEvent(new Event('ai-caption-preference-changed'));
}

// Keep author text available when generated descriptions are hidden.
export function imageCaption(image) {
  const author = image.caption?.trim() || '';
  const ai = image.aiCaption?.trim() || '';
  const mode = aiSummaryMode();
  if (mode === 'never' || aiOnModPages() === 'hide') return author;
  if (ai && (mode === 'always' || !author)) return `AI description: ${ai}`;
  return author;
}

const PICTURE_FITS = {
  good: 'good for a mod card',
  okay: 'okay for a mod card',
  poor: 'poor for a mod card',
};

const PICTURE_KINDS = {
  missing: 'Missing picture notice',
};

/// What the AI saw in a picture besides its description: what kind of
/// picture it is and how well it would do on a mod's card, or that it could
/// not read it. Empty when the reader has turned AI words off.
export function imageAiFacts(image) {
  if (aiSummaryMode() === 'never' || aiOnModPages() === 'hide') return '';
  if (image.aiUnreadable) return 'AI: could not read this picture';
  const parts = [];
  if (image.aiKind) {
    parts.push(PICTURE_KINDS[image.aiKind] || image.aiKind[0].toUpperCase() + image.aiKind.slice(1));
  }
  if (PICTURE_FITS[image.aiFit]) parts.push(PICTURE_FITS[image.aiFit]);
  return parts.length ? `AI: ${parts.join(', ')}` : '';
}

/// A picture's hover text: its caption, then what the AI saw in it.
export function imageHoverText(image) {
  return [imageCaption(image), imageAiFacts(image)].filter(Boolean).join('\n');
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
/// answer says which was picked, so a card can mark AI words as AI, and which
/// mod it is, so the hover text can fetch the AI's longer paragraph.
export function summaryToShow(mod) {
  if (!mod) return null;
  const own = mod.summaryIsGenerated ? null : mod.summary;
  const ai = aiSummaryOf(mod);
  const inOrder = aiSummaryMode() === 'always'
    ? [[ai, true], [own, false]]
    : [[own, false], [ai, true]];
  for (const [text, generated] of inOrder) {
    if (text) return { text, generated, modId: mod.id };
  }
  return null;
}

/// What the words of a summary say on hover: the words themselves and who
/// wrote them, where an AI did. Null for the author's own words — a reader
/// shown no AI summary is shown none on hover either.
export function summaryTitle(summary) {
  if (!summary?.generated) return null;
  return summary.text
    ? `${summary.text}\n\n${AI_SUMMARY_TITLE}`
    : AI_SUMMARY_TITLE;
}

/// Swaps the hover text on an AI summary for the AI's longer paragraph, the
/// first time the pointer rests on it. The list file only carries the one
/// sentence — the paragraph for every mod would take it past its size limit —
/// so the paragraph is read from the mod's own file, which is kept for the
/// rest of the visit. Until it arrives, and for a mod with no paragraph, the
/// hover text stays the sentence. [node] and anything in it with a title of
/// its own (the sparkle) are both changed.
export function fullAiSummaryOnHover(node, summary) {
  if (!summary?.generated || !summary.modId) return node;
  node.addEventListener('pointerenter', async () => {
    let paragraph;
    try {
      paragraph = (await modDetail(summary.modId))?.aiDescription;
    } catch (_) {
      return; // The sentence is still there, so nothing is lost.
    }
    if (!paragraph) return;
    const title = summaryTitle({ text: paragraph, generated: true });
    for (const target of [node, ...node.querySelectorAll('[title]')]) {
      target.title = title;
    }
  }, { once: true });
  return node;
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
/// Nothing when the reader has hidden it in Settings.
export function aiSummaryNote() {
  if (aiNoteChoice() === 'hide') return null;
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

/// Which page's scroll position sessionStorage should file under right now.
let activeScrollKey = null;

function scrollStorageKey(hash) {
  return `starmodderPageScroll:${hash}`;
}

/// Where the page is scrolled to right now, plus how far that is from the
/// bottom — so a page left at its very foot can be put back at the foot even
/// after its height has changed.
function currentScrollPosition() {
  const at = window.scrollY;
  const bottom = document.documentElement.scrollHeight - window.innerHeight;
  return { at, fromBottom: Math.max(0, bottom - at) };
}

/// Saves the current position under the current key. Remembering the position
/// is a convenience; storage that is full or switched off must not stop the
/// page from working.
function saveScrollPosition(position) {
  if (activeScrollKey === null) return;
  try {
    sessionStorage.setItem(activeScrollKey, JSON.stringify(position));
  } catch { /* keep going without it */ }
}

// The browser also remembers a scroll position per history entry and puts it
// back on Back/Forward — a beat after the router has already placed the page,
// and often with a stale value, since the browser records the position at its
// own moments. This code covers every case the browser would, so the native
// handling is switched off. The one job it was doing for us — restoring after
// a reload — is kept by saving the position as the page is left for good;
// routing never fires pagehide, so the two saves cannot fight.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.addEventListener('pagehide', () => {
  saveScrollPosition(currentScrollPosition());
});

/// Saves the page being left and returns the position for the page being drawn.
///
/// The position has to be read here, before the router empties the page:
/// emptying it leaves nothing to scroll, so the browser says zero from then on.
/// The current key follows address changes made without routing, so each
/// filtered list is remembered under the address the reader actually left.
export function preparePageScroll(hash) {
  stopPlacing();
  const position = currentScrollPosition();
  saveScrollPosition(position);
  const nextKey = scrollStorageKey(hash);
  const samePage = activeScrollKey === nextKey;
  activeScrollKey = nextKey;

  // Settings redraw the current address directly. Keep the position just
  // recorded instead of restoring an older visit to the same page.
  if (samePage) return position;

  let saved = null;
  try {
    saved = JSON.parse(sessionStorage.getItem(nextKey) || 'null');
  } catch {
    saved = null;
  }
  if (typeof saved === 'number') saved = { at: saved, fromBottom: null };
  return saved;
}

/// Restores a saved position after the new page has been drawn. Says whether
/// it placed the page, so the router knows to leave the scroll alone.
export function restorePageScroll(saved) {
  if (!saved || !(saved.at > 0)) return false;
  placePageScroll(saved);
  return true;
}

/// Stops the current placement, if one is running. Called when the next page
/// starts drawing, so a placement never scrolls a page it was not made for —
/// the Back button fires none of the events placePageScroll listens for.
let stopPlacing = () => {};

/// A page can gain height as its pictures finish laying out. Keep its saved
/// place while that happens. Stop when the reader interacts with the page.
function placePageScroll(saved) {
  const wasAtBottom = saved.fromBottom !== null && saved.fromBottom <= 2;
  const place = () => {
    const at = wasAtBottom ? document.documentElement.scrollHeight : saved.at;
    window.scrollTo(0, at);
  };
  place();

  const observer = new ResizeObserver(place);
  observer.observe(document.body);

  const events = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
  const stop = () => {
    observer.disconnect();
    clearTimeout(timeout);
    for (const event of events) window.removeEventListener(event, stop);
    stopPlacing = () => {};
  };
  for (const event of events) {
    window.addEventListener(event, stop, { once: true, passive: true });
  }
  const timeout = setTimeout(stop, 10000);
  stopPlacing = stop;
}

/// Opens a screenshot over the page, with the rest of them a keypress away.
///
/// A raw image in a new tab loses the reader their place and gives them a
/// browser tab to close; this keeps them where they were. Escape, the ×, or a
/// click on the dark area closes it; the arrow keys, the edge buttons, or a
/// sideways swipe move between pictures, and Home/End jump to the ends. A
/// picture can be looked at closely: the wheel, a pinch, a double press, or
/// the +/− buttons zoom in on the spot under the pointer, a drag moves around
/// the zoomed picture, and 0 or another double press puts it back. A swipe
/// down closes, the way phone galleries do. The pictures either side are
/// fetched ahead of time so stepping is instant, and "Open original" is there
/// for the reader who wants the full file after all.
///
/// [images] is the list of `{url, caption}` still on the page, and [at] is
/// which one to open first. A picture can also carry `source` (`forum`,
/// `discord` or `nexus`) and `sourceUrl`, the post it came from.
export function showPicture(images, at = 0) {
  if (!images || !images.length) return;

  let showing = Math.max(0, Math.min(at, images.length - 1));
  // Where the keyboard was before this opened, so closing it puts the reader
  // back on the very screenshot they picked.
  const cameFrom = document.activeElement;

  const shot = el('img', {
    class: 'big-picture-shot', alt: '', draggable: 'false', 'data-plays': '',
  });
  const note = el('div', { class: 'big-picture-note' });
  const caption = el('div', { class: 'big-picture-caption' });
  const aiFacts = el('div', { class: 'big-picture-ai' });
  const counter = el('div', { class: 'big-picture-counter', 'aria-live': 'polite' });
  const fileName = el('div', { class: 'big-picture-name' });
  const from = el('a', {
    class: 'big-picture-source', target: '_blank', rel: 'noopener nofollow',
  });
  const original = el('a', {
    class: 'big-picture-original', text: 'Open original',
    target: '_blank', rel: 'noopener noreferrer',
  });

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
  const zoomOut = el('button', {
    class: 'big-picture-zoom-button', text: '−', title: 'Zoom out (−)',
    'aria-label': 'Zoom out',
  });
  const zoomIn = el('button', {
    class: 'big-picture-zoom-button', text: '+', title: 'Zoom in (+)',
    'aria-label': 'Zoom in',
  });

  const middle = el('div', { class: 'big-picture-middle' }, [shot, note]);
  const box = el('div', {
    class: 'big-picture', role: 'dialog', 'aria-modal': 'true',
    'aria-label': 'Screenshot',
  }, [
    middle,
    el('div', { class: 'big-picture-foot' }, [
      caption,
      aiFacts,
      el('div', { class: 'big-picture-tools' }, [counter, from, fileName, original]),
    ]),
    el('div', { class: 'big-picture-zoom' }, [zoomOut, zoomIn]),
    close,
    images.length > 1 ? back : null,
    images.length > 1 ? forward : null,
  ]);

  // --- Zoom. Scale 1 is the picture fitted to the screen; the translation is
  // in screen pixels from the centre of the box.

  const FIT = 1;
  const MAX_ZOOM = 8;
  let scale = FIT;
  let tx = 0;
  let ty = 0;

  const apply = () => {
    shot.style.transform = scale === FIT && !tx && !ty
      ? '' : `translate(${tx}px, ${ty}px) scale(${scale})`;
    box.classList.toggle('zoomed', scale > FIT);
    zoomOut.disabled = scale <= FIT;
    zoomIn.disabled = scale >= MAX_ZOOM;
  };

  // A zoomed picture can be dragged around but never right off the screen: the
  // drag stops where an edge of the picture meets the edge of its box. At fit
  // size this pins it to the centre.
  const clampPan = () => {
    const overX = Math.max(0, (shot.clientWidth * scale - middle.clientWidth) / 2);
    const overY = Math.max(0, (shot.clientHeight * scale - middle.clientHeight) / 2);
    tx = Math.max(-overX, Math.min(overX, tx));
    ty = Math.max(-overY, Math.min(overY, ty));
  };

  // Zooms so the spot at (x, y) stays put — zooming toward a corner should
  // bring that corner closer, not the middle of the picture.
  const zoomAt = (x, y, toScale) => {
    const next = Math.max(FIT, Math.min(MAX_ZOOM, toScale));
    if (next === scale) return;
    const r = middle.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const qx = (x - cx - tx) / scale;
    const qy = (y - cy - ty) / scale;
    scale = next;
    tx = x - cx - qx * scale;
    ty = y - cy - qy * scale;
    if (scale === FIT) { tx = 0; ty = 0; }
    clampPan();
    apply();
  };

  // The picture eases to its new place for a press (a button, a key, a double
  // press) but follows the hand instantly for a wheel, drag or pinch. The
  // class comes off when the easing ends — or at the next hands-on gesture,
  // for the browsers that never fire transitionend on an unchanged transform.
  const settle = () => shot.classList.add('settle');
  const unsettle = () => shot.classList.remove('settle');
  shot.addEventListener('transitionend', unsettle);

  const zoomFromCentre = (factor) => {
    settle();
    const r = middle.getBoundingClientRect();
    zoomAt(r.left + r.width / 2, r.top + r.height / 2, scale * factor);
  };

  const resetZoom = () => {
    scale = FIT;
    tx = 0;
    ty = 0;
    apply();
  };

  const toggleZoom = (x, y) => {
    settle();
    if (scale > FIT) resetZoom();
    else zoomAt(x, y, 2.5);
  };

  // --- Showing a picture.

  // The pictures either side are asked for as soon as one is shown, so
  // stepping to them is a change, not a wait.
  const preloaded = new Set();
  const preload = (i) => {
    if (images.length < 2) return;
    const url = images[(i + images.length) % images.length].url;
    if (preloaded.has(url)) return;
    preloaded.add(url);
    new Image().src = url;
  };

  // The picture's own file name, when its address ends in one — a reader
  // saving a picture or reporting a broken one wants to know which file it
  // was. An address that hides the file behind a script ("index.php?…") gets
  // no guess rather than a wrong one.
  const IMAGE_FILE = /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i;
  const fileNameOf = (url) => {
    try {
      const last = decodeURIComponent(
        new URL(url, location.href).pathname.split('/').pop() || '');
      return IMAGE_FILE.test(last) ? last : '';
    } catch {
      return '';
    }
  };

  const draw = () => {
    const image = images[showing];
    unsettle();
    resetZoom();
    note.hidden = true;
    shot.hidden = false;
    middle.classList.add('is-loading');
    shot.src = image.url;
    // A picture already fetched fires no load event worth waiting for.
    if (shot.complete && shot.naturalWidth) middle.classList.remove('is-loading');
    shot.alt = imageCaption(image);
    caption.textContent = imageCaption(image);
    aiFacts.textContent = imageAiFacts(image);
    aiFacts.hidden = !aiFacts.textContent;
    counter.textContent =
      images.length > 1 ? `${showing + 1} of ${images.length}` : '';
    fileName.textContent = fileNameOf(image.url);
    fileName.hidden = !fileName.textContent;
    const source = PICTURE_SOURCES[image.source];
    from.hidden = !source;
    if (source) {
      from.replaceChildren(
        el('span', {
          class: 'original-page-icon', html: pageIcon(source.field), 'aria-hidden': 'true',
        }),
        `Image from ${source.words}`,
      );
      if (image.sourceUrl) from.href = image.sourceUrl;
      else from.removeAttribute('href');
    }
    original.href = image.url;
    preload(showing + 1);
    preload(showing - 1);
  };

  shot.addEventListener('load', () => middle.classList.remove('is-loading'));
  shot.addEventListener('error', () => {
    middle.classList.remove('is-loading');
    shot.hidden = true;
    note.textContent = 'Could not load this picture.';
    note.hidden = false;
  });

  const step = (by) => {
    showing = (showing + by + images.length) % images.length;
    draw();
  };

  const onResize = () => { clampPan(); apply(); };

  const shut = () => {
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('hashchange', shut);
    window.removeEventListener('resize', onResize);
    document.body.classList.remove('picture-open');
    box.remove();
    if (cameFrom && cameFrom.focus) cameFrom.focus();
  };

  // --- Keyboard.

  // Tab stays inside the box while it is open — behind it is a whole page of
  // links the keyboard would otherwise wander off into, unseen.
  const trapTab = (e) => {
    const focusable = [...box.querySelectorAll('button:not(:disabled), a[href]')];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      last.focus();
      e.preventDefault();
    } else if (!e.shiftKey && document.activeElement === last) {
      first.focus();
      e.preventDefault();
    }
  };

  function onKey(e) {
    if (e.key === 'Tab') { trapTab(e); return; }
    if (e.key === 'Escape') shut();
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'Home') { showing = 0; draw(); }
    else if (e.key === 'End') { showing = images.length - 1; draw(); }
    else if (e.key === '+' || e.key === '=') zoomFromCentre(1.5);
    else if (e.key === '-' || e.key === '_') zoomFromCentre(1 / 1.5);
    else if (e.key === '0') { settle(); resetZoom(); }
    else return;
    e.preventDefault();
  }

  // --- The wheel zooms. There is nothing behind the box to scroll, and a
  // reader reaching for the wheel over a picture means "closer".

  middle.addEventListener('wheel', (e) => {
    e.preventDefault();
    unsettle();
    const amount = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
    zoomAt(e.clientX, e.clientY, scale * Math.exp(-amount * 0.002));
  }, { passive: false });

  // --- Fingers and the mouse button, all through pointer events so they read
  // the same: one pointer at fit size swipes, one pointer zoomed in drags the
  // picture around, two pointers pinch.

  const pointers = new Map();
  let start = null;
  // A drag ends with a click, and that click must not close the box or count
  // as a tap.
  let gestureMoved = false;
  let lastPointerType = 'mouse';
  let lastTap = { time: 0, x: 0, y: 0 };

  // Where the pointers are now is the wrong baseline once a finger is added or
  // lifted — the gesture starts over from the current picture state.
  const beginGesture = () => {
    const p = [...pointers.values()];
    start = {
      scale, tx, ty,
      x: p[0].x,
      y: p[0].y,
      spread: p.length > 1 ? Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y) : 0,
      midX: p.length > 1 ? (p[0].x + p[1].x) / 2 : p[0].x,
      midY: p.length > 1 ? (p[0].y + p[1].y) / 2 : p[0].y,
    };
  };

  middle.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    unsettle();
    lastPointerType = e.pointerType;
    // So the drag keeps working when the pointer leaves the box. Refused for a
    // pointer the browser no longer considers active, which is fine — the
    // gesture still works, it just lets go at the edge.
    try {
      middle.setPointerCapture(e.pointerId);
    } catch { /* keep going without it */ }
    pointers.set(e.pointerId, {
      x: e.clientX, y: e.clientY, type: e.pointerType,
    });
    if (pointers.size === 1) gestureMoved = false;
    if (pointers.size <= 2) beginGesture();
  });

  middle.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p || !start) return;
    p.x = e.clientX;
    p.y = e.clientY;
    const all = [...pointers.values()];
    if (all.length >= 2) {
      // A pinch: the spread between the fingers sets the zoom, and the
      // midpoint's travel drags at the same time. Worked out from where the
      // gesture began, not from the last move, so nothing drifts.
      gestureMoved = true;
      const spread = Math.hypot(all[1].x - all[0].x, all[1].y - all[0].y);
      const midX = (all[0].x + all[1].x) / 2;
      const midY = (all[0].y + all[1].y) / 2;
      const next = Math.max(FIT, Math.min(MAX_ZOOM,
        start.scale * (spread / (start.spread || 1))));
      const r = middle.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const qx = (start.midX - cx - start.tx) / start.scale;
      const qy = (start.midY - cy - start.ty) / start.scale;
      scale = next;
      tx = midX - cx - qx * scale;
      ty = midY - cy - qy * scale;
      if (scale === FIT) { tx = 0; ty = 0; }
      clampPan();
      apply();
      return;
    }
    const dx = p.x - start.x;
    const dy = p.y - start.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) gestureMoved = true;
    if (scale > FIT) {
      tx = start.tx + dx;
      ty = start.ty + dy;
      clampPan();
      apply();
    } else {
      // At fit size a drag is a swipe in the making. The picture follows the
      // pointer, so letting go feels like finishing something.
      shot.style.transform = `translate(${dx}px, ${dy}px)`;
    }
  });

  const endPointer = (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const wasTouch = p.type !== 'mouse';
    pointers.delete(e.pointerId);
    if (pointers.size) {
      beginGesture();
      return;
    }
    if (start && scale === FIT && gestureMoved) {
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) && images.length > 1) {
        step(dx < 0 ? 1 : -1);
      } else if (dy > 80 && Math.abs(dy) > Math.abs(dx)) {
        shut();
        return;
      } else {
        // Not enough of a swipe to mean anything: ease back to the middle.
        settle();
        apply();
      }
    }
    // A double tap zooms. The browser's own dblclick is left to the mouse, or
    // one double tap would zoom in and straight back out.
    if (wasTouch && !gestureMoved && e.type === 'pointerup') {
      const now = performance.now();
      const near = Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30;
      if (now - lastTap.time < 350 && near) {
        toggleZoom(e.clientX, e.clientY);
        lastTap = { time: 0, x: 0, y: 0 };
      } else {
        lastTap = { time: now, x: e.clientX, y: e.clientY };
      }
    }
    start = null;
  };
  middle.addEventListener('pointerup', endPointer);
  middle.addEventListener('pointercancel', endPointer);

  middle.addEventListener('dblclick', (e) => {
    e.preventDefault();
    if (lastPointerType === 'touch') return;
    toggleZoom(e.clientX, e.clientY);
  });

  // A click on the picture itself must not close it — only one on the dark
  // area around it, and never the click a drag or swipe ends with.
  box.addEventListener('click', (e) => {
    if (gestureMoved) return;
    if (e.target === box || e.target === middle) shut();
  });
  close.addEventListener('click', shut);
  back.addEventListener('click', () => step(-1));
  forward.addEventListener('click', () => step(1));
  zoomIn.addEventListener('click', () => zoomFromCentre(1.5));
  zoomOut.addEventListener('click', () => zoomFromCentre(1 / 1.5));
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', onResize);
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
///
/// Each paragraph is a string, or a list of strings and elements such as links.
export function openInfoDialog(title, paragraphs) {
  openBox(title, paragraphs.map((parts) => el('p', { class: 'about-line' }, parts)));
}

/// Asks for a name in a box over the page. Resolves to the name, trimmed, or
/// to null when the reader closes the box. A blank name cannot be sent.
export function askForName(title, { label = 'Name', confirm = 'Save' } = {}) {
  return new Promise((resolve) => {
    const input = el('input', { type: 'text', class: 'name-input', maxlength: '80' });
    const ok = el('button', { type: 'submit', class: 'btn btn-primary', text: confirm, disabled: '' });
    const cancel = el('button', { type: 'button', class: 'btn', text: 'Cancel' });
    const form = el('form', { class: 'name-form' }, [
      el('label', { class: 'name-label' }, [el('span', { text: label }), input]),
      el('div', { class: 'dialog-buttons' }, [cancel, ok]),
    ]);
    let answer = null;
    const shut = openBox(title, [form], { focus: input, onShut: () => resolve(answer) });
    input.addEventListener('input', () => { ok.disabled = !input.value.trim(); });
    cancel.addEventListener('click', shut);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!input.value.trim()) return;
      answer = input.value.trim();
      shut();
    });
  });
}

/// Asks a yes-or-no question in a box over the page. Resolves to true only
/// when the reader presses `yes`; closing the box counts as no.
export function askYesNo(title, text, { yes = 'Yes', no = 'No' } = {}) {
  return new Promise((resolve) => {
    const yesButton = el('button', { type: 'button', class: 'btn btn-primary', text: yes });
    const noButton = el('button', { type: 'button', class: 'btn', text: no });
    let answer = false;
    const shut = openBox(title, [
      el('p', { class: 'about-line', text }),
      el('div', { class: 'dialog-buttons' }, [noButton, yesButton]),
    ], { focus: yesButton, onShut: () => resolve(answer) });
    noButton.addEventListener('click', shut);
    yesButton.addEventListener('click', () => { answer = true; shut(); });
  });
}

/// The box the three above share: a heading with a ×, then `body`. Returns
/// the function that closes it. `onShut` runs once, however it was closed.
function openBox(title, body, { focus = null, onShut = () => {} } = {}) {
  // Where the keyboard was before this opened, so closing it puts the reader
  // back on the button they pressed.
  const cameFrom = document.activeElement;

  const close = el('button', {
    type: 'button', class: 'info-close', text: '×', 'aria-label': 'Close',
  });
  const dialog = el('dialog', { class: 'info-dialog' }, [
    el('div', { class: 'info-inner' }, [
      el('div', { class: 'info-head' }, [el('h2', { text: title }), close]),
      ...body,
    ]),
  ]);

  // Closing means taking it out of the page, not only shutting it. Every way
  // out goes through here, and it is safe to call twice.
  let shutAlready = false;
  const shut = () => {
    window.removeEventListener('hashchange', shut);
    if (dialog.open) dialog.close();
    dialog.remove();
    if (cameFrom && cameFrom.focus) cameFrom.focus();
    if (!shutAlready) {
      shutAlready = true;
      onShut();
    }
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
  (focus || close).focus();
  return shut;
}

// The box the "Remove mod from Starmodder" button opens. Shared by a mod's
// page and the About page so the two always say the same thing.
const TAKEDOWN_TITLE = 'Takedown request';
const FORUM_PROFILE_URL = 'https://fractalsoftworks.com/forum/index.php?action=pm;sa=send;u=7678';
const takedownParagraphs = () => [
  [
    'To request a mod or mods be removed, send a DM to ',
    el('a', { href: FORUM_PROFILE_URL, target: '_blank', rel: 'noopener noreferrer', text: 'Wispborne' }),
    ' on the Starsector forum or to Wisp on Discord (@142592906178330624).',
  ],
  "Please message from the account you use to post your mods.",
];

/// The "Remove mod from Starmodder" button. It only opens a box saying how to
/// ask: a takedown is done by hand, at the author's request.
export function takedownButton() {
  const button = el('button', {
    type: 'button', class: 'btn', text: 'Remove mod from Starmodder',
  });
  button.addEventListener('click', () => openInfoDialog(TAKEDOWN_TITLE, takedownParagraphs()));
  return button;
}

/// One button that opens every fold in [container] matching [selector], and
/// closes them all again once they are open. Home's release list and a mod's
/// Changelog tab both carry one.
///
/// Reading down a list of changelogs means clicking every row in turn, and
/// there is no way back short of clicking each one again. The label says what
/// a press would do, so nobody has to guess which way it goes.
///
/// Returns null when there are no folds — a button that would do nothing is
/// worse than no button.
export function expandAllButton(container, selector,
  { open: openLabel = 'Expand all', shut: shutLabel = 'Collapse all' } = {}) {
  const foldsIn = () => [...container.querySelectorAll(selector)];
  if (!foldsIn().length) return null;

  const button = el('button', { type: 'button', class: 'expand-all' });

  // Read off the page every time rather than kept in a variable: folds are
  // also opened one at a time, and a button that thinks it knows better tells
  // the reader the wrong thing.
  const relabel = () => {
    const folds = foldsIn();
    const allOpen = folds.length > 0 && folds.every((fold) => fold.open);
    button.textContent = allOpen ? shutLabel : openLabel;
    button.setAttribute('aria-expanded', allOpen ? 'true' : 'false');
  };

  button.addEventListener('click', () => {
    const folds = foldsIn();
    const open = !folds.every((fold) => fold.open);
    for (const fold of folds) fold.open = open;
    relabel();
  });

  // A fold's own `toggle` event does not travel up the page, so it is caught on
  // the way down instead. Without this, opening the last shut fold by hand
  // would leave the button still offering to open them all.
  container.addEventListener('toggle', relabel, true);

  relabel();
  return button;
}

// --- The reader's favorites ---

/// Where the favorites are kept. In the reader's own browser, and nowhere else
/// — there is no server here to keep them on.
///
/// The name in storage is the old one, from when this was called My List.
/// Changing it would empty everybody's favorites, and the reader never sees it.
const FAVORITES_KEY = 'starmodderMyList';

/// Anyone who wants to know when the favorites change. The header count and
/// whatever page is open both watch them.
const favoriteWatchers = new Set();

/// The favorited mod ids, in the order they were added.
export function favorites() {
  try {
    const saved = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
    return Array.isArray(saved) ? saved.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function isFavorite(id) {
  return favorites().includes(id);
}

/// Puts a whole set of favorites in place, dropping anything repeated. Used by
/// adding, removing, and taking somebody else's shared list as your own.
export function setFavorites(ids) {
  const kept = [...new Set((ids || []).filter(Boolean))];
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(kept));
  for (const watcher of favoriteWatchers) watcher(kept);
  return kept;
}

/// Adds a mod, or takes it out again if it is already there. Returns whether it
/// is a favorite afterwards.
export function toggleFavorite(id) {
  const now = favorites();
  const at = now.indexOf(id);
  if (at >= 0) now.splice(at, 1);
  else now.push(id);
  setFavorites(now);
  return at < 0;
}

export function watchFavorites(fn) {
  favoriteWatchers.add(fn);
  return () => favoriteWatchers.delete(fn);
}

/// The address that shares favorites: the ids packed into the hash, so the
/// whole list travels in the link and needs nothing at the other end.
export function favoritesHref(ids) {
  return buildHash(['favorites'], { ids: (ids || []).join(',') });
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

// The TriOS logo's triangle, from TriLink's favicon (Apache-2.0), without
// the ring around it, which is too thin to draw at button size. One colour,
// so it takes the button's text colour. Copied in as path data so nothing
// loads from an outside host.
const TRIOS_TRIANGLE = ''
  + '<path d="M142.864 44.077c7.675 13.052 15.417 26.067 23.013 39.167 13.53 23.3'
  + '37 26.977 46.723 40.445 70.097.913 1.585 2.096 3.163 2.432 4.886.273 1.403-.'
  + '102 3.396-.999 4.415-.704.8-3.017 1.157-3.981.604-10.239-5.868-20.44-11.814-'
  + '30.447-18.068-3.336-2.084-4.03-5.695-3.724-9.717 1.43-18.755-7.475-33.823-24'
  + '.5-41.885-5.966-2.825-9.183-7.116-8.96-14.1.32-9.988-.003-19.996.16-29.993.0'
  + '3-1.825 1.07-3.633 2.39-5.496 1.886 0 3.028.044 4.17.09zm-70.558 74.231c13.4'
  + '88-23.373 26.725-46.47 40.184-69.436 1.157-1.974 3.787-3.085 5.734-4.597 1.1'
  + '84 2.342 3.29 4.646 3.39 7.033.394 9.474-.04 18.98.23 28.464.191 6.7-2.71 10'
  + '.936-8.62 13.725-13.054 6.162-21.286 16.275-23.891 30.576-.649 3.56-.822 7.3'
  + '31-.445 10.924.608 5.795-1.945 9.686-6.53 12.44-8.7 5.225-17.466 10.35-26.36'
  + '4 15.226-1.586.87-3.943.332-5.944.444.044-2.144-.669-4.707.25-6.366 7.094-12'
  + '.806 14.503-25.437 22.006-38.433"/><path d="M190.113 173.865c2.787 2.31 7.85'
  + '6 2.795 6.656 7.36-1.286 4.888-6.047 3.139-9.431 3.148-39.144.1-78.288.125-1'
  + '17.43-.06-2.967-.013-7.725-.995-8.527-2.867-1.901-4.434 3.289-5.339 5.98-7.0'
  + '06 7.354-4.556 15.001-8.635 22.425-13.082 4.737-2.838 9.205-2.762 13.408.73 '
  + '14.321 11.894 35.24 13.162 51.58.315 4.662-3.665 9.294-3.77 14.302-.77 6.853'
  + ' 4.107 13.802 8.053 21.037 12.232"/>';
const TRIOS_SVG_START = '<svg viewBox="47.3 32.35 164 164" width="1em" '
  + 'height="1em" fill="currentColor" focusable="false" aria-hidden="true">';
// The full logo's nine small dots inside the triangle, for the big button.
const TRIOS_ICON = TRIOS_SVG_START + TRIOS_TRIANGLE
  + '<path d="M134.13 112.95c-2.49 3.218-5.608 4.31-8.318 1.805-1.566-1.447-2.604'
  + '-4.685-2.185-6.779.647-3.238 3.721-4.782 7.004-3.637 3.84 1.34 5.35 4.221 3.'
  + '499 8.612zm-15.863-2.441c1.379 2.539 3.255 4.94 3.143 7.243-.071 1.472-2.984'
  + ' 3.733-4.807 3.929-1.8.193-4.497-1.323-5.558-2.917-.919-1.38-.9-4.744.14-5.7'
  + '56 1.6-1.556 4.43-1.849 7.082-2.5zm19.528 1.286c3.043-2.369 6.16-2.625 8.219'
  + '.088 1.236 1.628 1.797 4.74 1.12 6.635-1.208 3.39-4.323 4.392-7.755 2.765-3.'
  + '52-1.67-4.077-4.72-1.584-9.488m-29.746 22.337c-3.209-2.493-4.322-5.605-1.803'
  + '-8.319 1.454-1.565 4.693-2.605 6.786-2.183 3.228.65 4.78 3.713 3.633 7.006-1'
  + '.344 3.86-4.239 5.32-8.616 3.496m19.412.654c-4.679-3.091-5.71-6.384-3.101-9.'
  + '438 2.403-2.814 5.588-3.433 8.237-.852 1.386 1.35 2.315 4.161 1.988 6.06-.56'
  + '8 3.289-3.29 4.743-7.124 4.23m25.323-7.317c.46 4.315-1.358 7.31-5.165 7.221-'
  + '2.163-.05-5.525-2.342-6.04-4.248-.51-1.878 1.297-5.477 3.149-6.66 3.366-2.15'
  + ' 6.24-.132 8.056 3.687m-36.558 7.607c4.326.112 7.022 2.234 6.518 6.058-.273 '
  + '2.07-2.754 5.176-4.52 5.379-2.103.241-5.552-1.576-6.557-3.483-1.978-3.751.31'
  + '4-6.547 4.559-7.954m26.309 11.711c-4.567.416-7.572-1.56-7.251-5.648.166-2.12'
  + ' 2.792-5.326 4.728-5.669 1.941-.344 5.342 1.74 6.429 3.693 1.789 3.214-.286 '
  + '5.95-3.906 7.624m-14.309-5.711c4.327.112 7.024 2.238 6.526 6.057-.27 2.07-2.'
  + '758 5.174-4.528 5.38-2.101.243-5.55-1.576-6.557-3.483-1.983-3.755.317-6.545 '
  + '4.559-7.954"/>'
  + '</svg>';
// On a card or row the nine dots are each less than a pixel and blur into
// a smudge, so one dot stands in for them.
const TRIOS_ICON_SMALL = TRIOS_SVG_START.replace('<svg ', '<svg class="trios-small" ')
  + TRIOS_TRIANGLE
  + '<circle cx="129" cy="128" r="14"/></svg>';

// The icons beside "Cards" and "Rows": four boxes, and three lines each with a
// dot at the front. Outline, like the site's other icons (Tabler shapes).
const VIEW_ICONS = {
  grid: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" '
    + 'stroke="currentColor" stroke-width="2" stroke-linejoin="round" '
    + 'focusable="false" aria-hidden="true">'
    + '<rect x="4" y="4" width="6" height="6" rx="1"/>'
    + '<rect x="14" y="4" width="6" height="6" rx="1"/>'
    + '<rect x="4" y="14" width="6" height="6" rx="1"/>'
    + '<rect x="14" y="14" width="6" height="6" rx="1"/></svg>',
  rows: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" '
    + 'stroke="currentColor" stroke-width="2" stroke-linecap="round" '
    + 'focusable="false" aria-hidden="true">'
    + '<path d="M9 6h11M9 12h11M9 18h11M5 6v.01M5 12v.01M5 18v.01"/></svg>',
};

/// The Cards and Rows pair of buttons, each with its icon beside the word.
/// `current()` says which is in use and `pick(which)` is told when the reader
/// changes it; each page keeps its own choice, this only draws the buttons.
export function viewToggle(current, pick) {
  const group = el('div', { class: 'view-toggle', role: 'group' });
  const button = (which, label) => {
    const b = el('button', { class: 'btn btn-with-icon' }, [
      el('span', { class: 'view-icon', html: VIEW_ICONS[which] }),
      el('span', { text: label }),
    ]);
    b.addEventListener('click', () => { pick(which); light(); });
    return b;
  };
  const gridBtn = button('grid', 'Cards');
  const rowsBtn = button('rows', 'Rows');
  const light = () => {
    for (const [b, which] of [[gridBtn, 'grid'], [rowsBtn, 'rows']]) {
      b.classList.toggle('on', current() === which);
      b.setAttribute('aria-pressed', String(current() === which));
    }
  };
  light();
  group.append(gridBtn, rowsBtn);
  return group;
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
    // Discord's own wordless mark, from Simple Icons (CC0). The site's other
    // icons are outline (Tabler), but a brand logo reads wrong as an outline —
    // Discord's is a solid shape — so this one is filled. Copied in as path
    // data so nothing loads from an outside host.
    field: 'discordUrl', name: 'Discord', label: 'On Discord',
    icon: '<svg class="discord-mark" viewBox="0 0 24 24" width="1em" height="1em" '
      + 'fill="currentColor" focusable="false" aria-hidden="true">'
      + '<path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 '
      + '00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762'
      + '-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 '
      + '19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458'
      + '-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 '
      + '2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 '
      + '1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722'
      + '-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743'
      + '.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01'
      + '.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 '
      + '12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 '
      + '1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023'
      + '-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a'
      + '.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569'
      + '-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 '
      + '2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569'
      + '-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 '
      + '1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/>'
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

/// Where a picture was posted, as the picture viewer names it, and which of a
/// mod's addresses leads to that post.
const PICTURE_SOURCES = {
  forum: { field: 'forumUrl', words: 'forum' },
  discord: { field: 'discordUrl', words: 'Discord' },
  nexus: { field: 'nexusUrl', words: 'Nexus Mods' },
};

/// A picture as the viewer takes it, with the post it came from.
export function withSource(image, source, detail) {
  const page = PICTURE_SOURCES[source];
  return { ...image, source, sourceUrl: page ? detail[page.field] || null : null };
}

/// The small site-owned icon for a `forumUrl` / `discordUrl` / `nexusUrl`
/// field, as an SVG string. The mod page's fallback button uses it too, so
/// there is one copy of each icon and the page never fetches one from an
/// outside host. Empty for a field with no icon.
export function pageIcon(field) {
  const page = ORIGINAL_PAGES.find((p) => p.field === field);
  return page ? page.icon : '';
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
/// A mod can offer a dozen downloads and the favorites page used to draw a
/// button for each
/// one, which asked the reader to choose between four buttons all saying
/// "Download". The builder has already put them in order, so this shows the
/// first — the same thing TriOS's catalog does on a mod's card.
///
/// Where there is both a download and an original forum, Discord or Nexus page,
/// summary cards and rows split the same fixed width between them. The
/// original-page icon gets a narrow fixed width and the download the rest. The large
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
  // A TriOS link carries the TriOS logo. With nothing to download, the button
  // opens the forum, Discord or Nexus page, so it carries that site's icon
  // like the mod page's button does.
  const triosIcon = big ? TRIOS_ICON : TRIOS_ICON_SMALL;
  const icon = best ? (best.kind === 'trios' ? triosIcon : null) : originalPage.icon;
  const button = el('a', {
    class: `btn btn-primary download-btn${big ? ' btn-big' : ''}${icon ? ' btn-with-icon' : ''}`,
    href,
    rel: 'noopener nofollow',
    target: '_blank',
    text: icon ? null : label,
    'aria-label': `${label}: ${modName(mod)}`,
    title: count > 1
      ? `${count} downloads.`
      : null,
  }, icon ? [
    el('span', { class: 'original-page-icon', html: icon, 'aria-hidden': 'true' }),
    el('span', { text: label }),
  ] : []);
  // On a card and on a row the button sits inside, or on top of, one big link
  // to the mod's page. Without this a press would follow that link as well.
  button.addEventListener('click', (e) => { e.stopPropagation(); });
  if (big || !best || !originalPage) return button;

  return el('span', { class: 'download-actions' }, [
    button,
    originalPageButton(mod, originalPage),
  ]);
}

/// The button that favorites a mod, or takes it out of the favorites.
///
/// Small and round on a card, where it sits over the picture; wide and worded
/// on the mod's own page, where it stands beside the download. One button
/// either way, so the two can never disagree about what is favorited.
export function favoriteToggle(mod, opts = {}) {
  const { wide = false } = opts;
  const button = el('button', { class: wide ? 'btn btn-big' : 'fav-toggle' });

  const draw = () => {
    const inIt = isFavorite(mod.id);
    button.classList.toggle('on', inIt);
    button.textContent = wide
      ? (inIt ? '★ Favorited' : '☆ Favorite')
      : (inIt ? '★' : '☆');
    button.title = inIt ? 'Remove from favorites' : 'Add to favorites';
    button.setAttribute('aria-pressed', String(inIt));
    button.setAttribute('aria-label',
      `${inIt ? 'Remove' : 'Add'} ${modName(mod)} ${inIt ? 'from' : 'to'} favorites`);
  };

  button.addEventListener('click', (e) => {
    // On a card the button sits on top of one big link. Without this the click
    // would follow the link as well as tick the box.
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(mod.id);
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

/// Match names by letters and digits so "LazyLib" and "Lazy Lib" count as one.
export function neededModKey(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/// Count how many mods need each mod, highest count first.
/// Use the most common spelling of each name.
/// Keep the id if any entry links to the mod's page.
export function requiredModCounts(mods) {
  const groups = new Map();
  for (const mod of mods || []) {
    const counted = new Set();
    for (const need of mod.needs || []) {
      const key = neededModKey(need.name);
      if (!key || counted.has(key)) continue;
      counted.add(key);
      const group = groups.get(key) || { count: 0, id: null, spellings: new Map() };
      group.count += 1;
      group.id = group.id || need.id || null;
      group.spellings.set(need.name, (group.spellings.get(need.name) || 0) + 1);
      groups.set(key, group);
    }
  }
  return [...groups.values()]
    .map((group) => ({
      name: [...group.spellings.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0],
      id: group.id,
      count: group.count,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/// The categories as a small table: a name and how many mods are in it on
/// each line, in as many columns as the page has room for. Each line is a link
/// to that category on the browse page, or, on Browse, a button that picks it.
///
/// This is the only way to browse by category that a reader can actually use. The
/// dropdown it replaces held 26 overlapping names; the site publishes thirteen
/// and shows them all at once.
///
/// `linkParams` are more address values for each link, such as Home's filters.
export function categoryChips(mods, opts = {}) {
  const { chosen = null, onPick = null, linkParams = {} } = opts;

  const inOrder = countedAcross(mods, (mod) => mod.categories);
  if (!inOrder.length) return null;

  const row = el('div', { class: 'category-table' });
  for (const [category, count] of inOrder) {
    const on = category === chosen;
    const chip = el(onPick ? 'button' : 'a', {
      class: on ? 'category-cell on' : 'category-cell',
      href: onPick ? null : buildHash(['browse'], { ...linkParams, category }),
      'aria-pressed': onPick ? String(on) : null,
      'aria-label': `${category}, ${count} mod${count === 1 ? '' : 's'}`,
    }, [
      el('span', { class: 'category-name', text: category }),
      el('span', { class: 'category-count', text: String(count) }),
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
/// came from rather than what category it belongs in.
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
/// Only ways the search really has belong here. Offering one it does not
/// leaves a reader typing something that quietly matches nothing. The plus
/// still works as a space, for old links, but a space does the same job, so
/// it is not offered.
/// Every line is a name, then how it works with something to type. A string is
/// words; a `code` is the letters themselves.
const WAYS_TO_SEARCH = [
  {
    name: 'Words',
    says: ['every word must match, in any order: ', { code: 'battlestar portrait' }],
  },
  {
    name: 'Exact phrase',
    says: ['in quotes: ', { code: '"unknown contact"' }],
  },
  {
    name: 'OR',
    says: ['comma-separated: ', { code: 'faction, portrait' }, ' matches either term'],
  },
  {
    name: 'Exclude',
    says: ['prefix with ', { code: '-' }, ' to hide results, e.g. ',
      { code: 'pirate -junk' }, ' or ', { code: 'faction, -portrait' }],
  },
  {
    name: 'Shorthand',
    says: ['e.g. ', { code: 'swp' }, ', ', { code: 'kol' }, ' or ', { code: 'indevo' },
      ' matches the full mod name'],
  },
  {
    name: 'Versions',
    says: ['e.g. ', { code: '0.98' }, ' matches mods for that release'],
  },
  {
    name: 'Close spellings',
    says: ['matches minor typos in names: ', { code: 'nexerlin' }],
  },
  {
    name: 'Field search',
    says: [{ code: 'key:value' }, ' syntax, e.g. ', { code: 'author:Wisp' },
      ', ', { code: 'category:weapons' }, ', ', { code: 'version:0.97' }, ', ',
      { code: 'from:discord' }],
  },
  {
    name: 'Has / is',
    says: [{ code: 'has:source' }, ', ', { code: 'has:download' }, ', ',
      { code: 'is:addable' }, ', ', { code: 'is:wip' }, ', ', { code: 'is:tool' }, ', ',
      { code: 'has:ai' }, ', ', { code: 'is:noai' },
      '; add ', { code: '-' }, ' to leave those out: ', { code: '-is:wip' }],
  },
];

// A plain cross for the search box's clear button (Tabler's "x").
const CLEAR_ICON = '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" '
  + 'stroke="currentColor" stroke-width="2" stroke-linecap="round" '
  + 'focusable="false" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

/// A search box with a panel that says what the search understands.
///
/// The panel is shown only while the pointer is over the search field. Focusing
/// the box to type does not open it, so it cannot cover the results just because
/// somebody is using the search.
///
/// `hideWhileTyping` is for the box at the top of every page, where the
/// suggested mods want the same room. Empty box: the panel. Typing: the
/// suggestions, unless the pointer is on the "?" itself, which always opens
/// the panel. `onHelpAsked(true)` is called when that happens, so the caller
/// can hide its suggestions, and `onHelpAsked(false)` when the pointer leaves.
export function searchHelpField(input, { hideWhileTyping = false, onHelpAsked } = {}) {
  const panel = el('div', { class: 'search-help' }, [
    el('p', {
      class: 'search-help-lead',
      text: 'Searches mod names and nicknames, authors, categories, versions and summaries.',
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

  // Our own clear button, in place of the browser's: Chrome draws a small grey
  // cross of its own that matches nothing else on the site. It shows only
  // while there is something to clear, and clearing tells the page the same
  // way typing does, so the list or the suggestions follow.
  const clearButton = el('button', {
    type: 'button',
    class: 'search-clear',
    title: 'Clear the search',
    'aria-label': 'Clear the search',
    html: CLEAR_ICON,
  });
  // Pressing the button would otherwise take the cursor out of the box first.
  clearButton.addEventListener('mousedown', (e) => e.preventDefault());
  clearButton.addEventListener('click', () => {
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  });
  const showClear = () => { clearButton.hidden = input.value === ''; };
  input.addEventListener('input', showClear);
  showClear();

  const box = el('span', { class: 'search-input' }, [input, clearButton]);
  const field = el('div', { class: 'search-field' }, [box, help, panel]);

  if (hideWhileTyping) {
    const sync = () => field.classList.toggle('help-off', input.value.trim() !== '');
    input.addEventListener('input', sync);
    sync();

    // The pointer counts as on the "?" while it is on the mark or on the panel
    // it opened, so the reader can move down into the panel to read it.
    let asked = false;
    const onHelp = (node) => !!node && (help.contains(node) || panel.contains(node));
    const setAsked = (now) => {
      if (now === asked) return;
      asked = now;
      field.classList.toggle('help-asked', now);
      onHelpAsked?.(now);
    };
    help.addEventListener('mouseenter', () => setAsked(true));
    for (const part of [help, panel]) {
      part.addEventListener('mouseleave', (e) => {
        if (!onHelp(e.relatedTarget)) setAsked(false);
      });
    }
  }
  return field;
}

// --- Names and versions ---

// `modName`, `otherNamesOf` and `everyOtherName` live in `mod_names.js` and
// are exported again at the top of this file.

/// The address of a mod's own page: the real file the builder writes at
/// `mods/<id>/`. That is what makes a copied address show the mod's own name
/// and picture when it is pasted somewhere that fetches it.
export function modHref(id) {
  return address().modHref(id);
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
    // Count "0.9.8a" as "0.98a" after fixing the typo.
    const spelling = repairGameVersion(version);
    entry.spellings.set(spelling, (entry.spellings.get(spelling) || 0) + 1);
  }

  return [...families.values()]
    .map((entry) => ({
      family: entry.family,
      count: entry.count,
      // The spelling most mods use, so "0.98a" wins over one stray "0.98".
      // Break ties with a final letter: "0.54.1a" wins over "0.54.1".
      label: [...entry.spellings.entries()]
        .sort((a, b) => b[1] - a[1]
          || endsInLetter(b[0]) - endsInLetter(a[0])
          || a[0].localeCompare(b[0]))[0][0],
    }))
    .sort((a, b) => compareGameVersions(b.family, a.family));
}

function endsInLetter(text) {
  return /[a-z]$/i.test(text) ? 1 : 0;
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
/// Where the website's own code lives. Commit links on the site point into it.
export const SITE_CODE_URL = 'https://github.com/wispborne/Mod_Repo_Scraper';

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
  if (standing === 'one-behind') return 'Built for the previous game release.';
  if (standing === 'old') return 'Built for an older game release.';
  return null;
}

/// What the version badge beside a mod's name means. The game version badge
/// next to it explains itself, so this one should too.
export const MOD_VERSION_NOTE =
  "Mod version";

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
