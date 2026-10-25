// "How to install mods": a page of its own at `how-to-install-mods/`, and the
// same words in a box over the page, opened from the top bar.
//
// The words are written once, in `how-to-install-mods.html`. The builder puts
// them into the page's file for search engines, and both the page and the box
// fetch the same file here.

import { clear, el, errorPanel } from '../lib.js';
import { PAGE_FOLDERS } from '../address.js';

export const GUIDE_TITLE = 'How to install mods';

/// The guide's icon, beside its title in the top bar and on About. Tabler
/// info-circle (MIT).
export const GUIDE_ICON = '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" '
  + 'stroke="currentColor" stroke-width="2" stroke-linecap="round" '
  + 'stroke-linejoin="round" focusable="false" aria-hidden="true">'
  + '<path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"/>'
  + '<path d="M12 9h.01"/><path d="M11 12h1v4h1"/></svg>';

const HIDE_BUTTON = 'Hide from toolbar';
const SHOW_BUTTON = 'Show in toolbar';
const HIDDEN_NOTE = 'Also accessible from the About page.';

/// The guide's folder, which is also its address and its route.
export const GUIDE_ROUTE = PAGE_FOLDERS[0];

let words = null;

/// Kept per reader, like the site's other choices. A reader who already knows
/// how to install mods can take the button off the top bar; the guide is still
/// on the About page.
const BUTTON_KEY = 'starmodderGuideButton';

/// Whether the reader took the guide's button off the top bar.
export function guideButtonHidden() {
  try {
    return localStorage.getItem(BUTTON_KEY) === 'hidden';
  } catch {
    return false;
  }
}

/// What redraws the top bar when the reader hides or shows the button. The
/// router sets it once, so the guide can be opened from any page.
let buttonChanged = null;

export function onGuideButtonChange(redraw) {
  buttonChanged = redraw;
}

function setGuideButtonHidden(hidden) {
  try {
    if (hidden) localStorage.setItem(BUTTON_KEY, 'hidden');
    else localStorage.removeItem(BUTTON_KEY);
  } catch {
    // Storage is off. The button simply stays as it was.
  }
}

/// The guide's words as page content, fetched once per visit. Fetched by hand
/// rather than through `data()`, because it is part of the site rather than
/// the published data: `?data=sample` must not send it looking in
/// `sample-data/`.
async function guideContent() {
  if (!words) {
    words = fetch('./how-to-install-mods.html', { credentials: 'omit' })
      .then((res) => {
        if (!res.ok) throw new Error(`The guide could not be loaded (${res.status}).`);
        return res.text();
      })
      .catch((err) => {
        words = null;
        throw err;
      });
  }
  // Read into a template, so nothing in it runs or starts loading before it
  // is put on the page.
  const template = document.createElement('template');
  template.innerHTML = await words;
  return template.content;
}

export async function render(root) {
  document.title = `${GUIDE_TITLE} | Starmodder`;
  const content = await guideContent();
  clear(root);
  root.append(el('div', { class: 'stack' }, [
    el('div', { class: 'page-head' }, [el('h1', { text: GUIDE_TITLE })]),
    el('section', { class: 'panel guide' }, [content]),
  ]));
}

/// Opens the guide in a box over the page the reader is on, so they keep
/// their place. Its foot hides the top bar's button, or puts it back once it
/// is hidden; the bar is redrawn after either, through [onGuideButtonChange].
export async function openGuide() {
  const cameFrom = document.activeElement;
  const close = el('button', {
    type: 'button', class: 'info-close', text: '×', 'aria-label': 'Close',
  });
  const body = el('div', { class: 'guide' }, [el('div', { class: 'loading', text: 'Loading…' })]);
  // The hide button and its note sit at the left, Close at the right.
  const hideSide = el('div', { class: 'guide-hide' });
  const closeFoot = el('button', { type: 'button', class: 'guide-toggle', text: 'Close' });
  const foot = el('div', { class: 'guide-foot' }, [hideSide, closeFoot]);
  const drawFoot = () => {
    const hidden = guideButtonHidden();
    const toggle = el('button', {
      type: 'button', class: 'guide-toggle',
      text: hidden ? SHOW_BUTTON : HIDE_BUTTON,
    });
    toggle.addEventListener('click', () => {
      setGuideButtonHidden(!hidden);
      if (buttonChanged) buttonChanged();
      drawFoot();
      hideSide.querySelector('button').focus();
    });
    clear(hideSide).append(...(hidden
      ? [toggle, el('span', { class: 'guide-note', text: HIDDEN_NOTE })]
      : [toggle]));
  };
  drawFoot();

  const dialog = el('dialog', { class: 'info-dialog guide-dialog' }, [
    el('div', { class: 'info-inner' }, [
      el('div', { class: 'info-head' }, [el('h2', { text: GUIDE_TITLE }), close]),
      body,
      foot,
    ]),
  ]);

  // Every way out comes through here, the same as the other info boxes.
  const shut = () => {
    window.removeEventListener('hashchange', shut);
    window.removeEventListener('popstate', shut);
    if (dialog.open) dialog.close();
    dialog.remove();
    if (cameFrom && cameFrom.focus) cameFrom.focus();
  };
  close.addEventListener('click', shut);
  closeFoot.addEventListener('click', shut);
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) shut();
  });
  dialog.addEventListener('cancel', shut);
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') shut();
  });
  // Back is a way out too. A mod's page is a path rather than a hash, so both
  // events count. The guide's own links open in a new tab, so they leave the
  // box where it is.
  window.addEventListener('hashchange', shut);
  window.addEventListener('popstate', shut);

  document.body.append(dialog);
  dialog.showModal();
  close.focus();

  try {
    clear(body).append(await guideContent());
  } catch (err) {
    clear(body).append(errorPanel(err));
  }
}
