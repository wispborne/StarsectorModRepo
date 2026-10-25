// What a reader sees at an address with no mod behind it. A taken-down mod
// looks the same as a mistyped address on purpose.

import { clear, el } from '../lib.js';

/// Written exactly as asked for. The Dart side has the same words in
/// `lib/site/not_found_page_html.dart`, for the plain page.
export const NOT_FOUND_MESSAGE = 'This mod may have been removed at the request of its owner...or it may never '
  + 'have existed in the first place. Or something else.';

export function render(root) {
  document.title = 'Not found | Starmodder';
  clear(root).append(el('div', { class: 'notice not-found' }, [
    el('h2', { text: 'Not found' }),
    el('p', { text: NOT_FOUND_MESSAGE }),
    el('p', { class: 'not-found-links' }, [
      el('a', { href: '#/home', text: 'Go Home' }),
      el('a', { href: '#/browse', text: 'Browse mods' }),
    ]),
  ]));
}
