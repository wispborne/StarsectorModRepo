// The privacy policy: a page of its own at `privacy/`. The Discord Developer
// Portal links to that address, so it must not change.
//
// The words are written once, in `privacy.html`. The builder puts them into the
// page's file for search engines, and the page fetches the same file here.

import { clear, el } from '../lib.js';

export const PRIVACY_TITLE = 'Privacy policy';
export const PRIVACY_ROUTE = 'privacy';

let words = null;

/// The policy's words, fetched once per visit. Fetched by hand rather than
/// through `data()`, because it is part of the site rather than the published
/// data: `?data=sample` must not send it looking in `sample-data/`.
async function policyContent() {
  if (!words) {
    words = fetch('./privacy.html', { credentials: 'omit' })
      .then((res) => {
        if (!res.ok) throw new Error(`Unable to load the privacy policy (${res.status}).`);
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
  document.title = `${PRIVACY_TITLE} | Starmodder`;
  const content = await policyContent();
  clear(root);
  root.append(el('div', { class: 'stack' }, [
    el('div', { class: 'page-head' }, [el('h1', { text: PRIVACY_TITLE })]),
    el('section', { class: 'panel guide policy' }, [content]),
  ]));
}
