// Shows search suggestions: `posted-on:` offers forum and Discord, `category:`
// offers categories, and so on. `searchCompletions` in `search.js` chooses
// the suggestions. This file displays them.
//
// The top search box shows these rows before its mod suggestions
// (`completionGroup`). Browse has no existing list, so it uses a separate
// menu (`attachCompletionMenu`).

import { el, clear } from './lib.js';
import { applyCompletion, searchCompletions } from './search.js';

/// Suggestions for the term at the cursor in [input], or null.
export function completionsFor(input, mods) {
  const cursor = input.selectionStart ?? input.value.length;
  return searchCompletions(mods, input.value, cursor);
}

/// Inserts the selected item and moves the cursor to its end.
/// Sends an input event, as typing would.
export function pickCompletion(input, found, item) {
  const next = applyCompletion(input.value, found, item);
  input.value = next.text;
  input.focus();
  input.setSelectionRange(next.cursor, next.cursor);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/// A heading and one row per item. Each row uses `.suggestion` so the top
/// search box's arrow keys can select it along with the mod suggestions.
export function completionGroup(input, found) {
  const rows = found.items.map((item) => {
    const row = el('div', { class: 'suggestion completion' }, [
      el('code', { class: 'completion-term', text: item.label }),
      item.note ? el('span', { class: 'completion-note', text: item.note }) : null,
    ]);
    // Pressing a row must not take the cursor out of the box.
    row.addEventListener('mousedown', (e) => e.preventDefault());
    row.addEventListener('click', () => pickCompletion(input, found, item));
    return row;
  });
  return [el('div', { class: 'suggestion-group', text: found.group }), ...rows];
}

/// Keys that move the cursor without typing, after which the term under it
/// may be a different one.
const CURSOR_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'Home', 'End']);

/// A menu of suggested search terms for [input], which has to be in a box
/// that is `position: relative` already (the `.search-input` that
/// `searchHelpField` wraps it in). [getMods] gives the mod list the values
/// come from.
///
/// Up and down pick a row, Enter or Tab puts the picked one in, and Tab with
/// nothing picked puts in the first. Escape shuts the menu. Enter with
/// nothing picked is left to the page.
export function attachCompletionMenu(input, getMods) {
  const menu = el('div', {
    class: 'suggestions completion-menu',
    role: 'listbox',
    'aria-label': 'Suggested search terms',
    hidden: '',
  });
  input.parentNode.append(menu);

  let found = null;
  let active = -1;
  const rows = () => [...menu.querySelectorAll('.completion')];
  const field = () => input.closest('.search-field');

  const hide = () => {
    found = null;
    active = -1;
    clear(menu);
    menu.hidden = true;
    field()?.classList.remove('completing');
  };
  const setActive = (index) => {
    const all = rows();
    if (!all.length) return;
    active = (index + all.length) % all.length;
    all.forEach((row, i) => row.setAttribute('aria-selected', i === active ? 'true' : 'false'));
    all[active].scrollIntoView({ block: 'nearest' });
  };
  const show = () => {
    found = completionsFor(input, getMods());
    if (!found) { hide(); return; }
    clear(menu);
    menu.append(...completionGroup(input, found));
    rows().forEach((row, i) => {
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', 'false');
      row.addEventListener('mouseenter', () => setActive(i));
    });
    active = -1;
    menu.hidden = false;
    // Hide the search help panel while the menu uses the same space.
    field()?.classList.add('completing');
  };

  input.addEventListener('input', show);
  input.addEventListener('focus', show);
  input.addEventListener('click', show);
  input.addEventListener('keyup', (e) => { if (CURSOR_KEYS.has(e.key)) show(); });
  // Wait for a click on a suggestion to finish before hiding the menu.
  input.addEventListener('blur', () => setTimeout(() => {
    if (document.activeElement !== input) hide();
  }, 150));

  input.addEventListener('keydown', (e) => {
    if (!found) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const down = e.key === 'ArrowDown';
      setActive(active < 0 ? (down ? 0 : rows().length - 1) : active + (down ? 1 : -1));
    } else if ((e.key === 'Enter' && active >= 0) || (e.key === 'Tab' && !e.shiftKey)) {
      e.preventDefault();
      pickCompletion(input, found, found.items[Math.max(active, 0)]);
    } else if (e.key === 'Escape') {
      hide();
    }
  });
}
