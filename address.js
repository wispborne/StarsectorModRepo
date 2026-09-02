// The public site's addresses.
//
// A mod's page is a real file on disk at `mods/<id>/`, so that is a mod's
// address. Every other page is a hash on the site's front document. One
// function works the route out of the address, and the address is the only
// place the route is kept — nothing is hidden in `history.state`, so what the
// address bar says is always what the page is showing.
//
// A mod's page is two folders down, so it carries `<base href="../../">`.
// Every relative link and every data fetch therefore resolves beside the front
// document from either page, and `document.baseURI` names the site's root on
// both.
//
// Because the two page shapes have different paths, a click on an ordinary
// link between them would be a whole new page load. So clicks on our own
// addresses are caught here and turned into history entries instead, and the
// router draws the new page without the site restarting.

/// The route parts of a hash like `#/foo/bar?x=1`: ['foo','bar'].
function partsOfHash(hash) {
  const path = String(hash || '').replace(/^#\/?/, '').split('?')[0];
  return path.length ? path.split('/').map(decodeURIComponent) : [];
}

/// Builds the site's address handling over a browser. The browser pieces are
/// arguments so the tests can run a whole visit — links, Back and Forward —
/// without a browser.
export function siteAddress({
  documentRef = document,
  locationRef = location,
  historyRef = history,
  windowRef = window,
} = {}) {
  // Where the site's front document lives. Both pages say so: the front
  // document carries `<base href="./">` and a mod's page `<base href="../../">`,
  // so either way this is the folder the site's own files sit in.
  const root = new URL('.', documentRef.baseURI);

  // Pin the base to an absolute address, because the address bar moves and the
  // files do not. Opening a mod puts `mods/<id>/` in the address bar without
  // loading a new document; a base still written as `./` would follow it, and
  // every stylesheet, script and data file would then be looked for inside the
  // mod's folder. The reader's `?data=…` rides along, so a hash link written
  // anywhere on the site keeps them in the sample data.
  const pinned = new URL(root.href);
  pinned.search = locationRef.search;
  const baseTag = documentRef.querySelector
    ? documentRef.querySelector('base')
    : null;
  if (baseTag) baseTag.href = pinned.href;

  /// The root, carrying whatever `?data=…` the reader is browsing under, so an
  /// address built from it never drops them out of the sample data half way
  /// through a visit.
  function here() {
    const url = new URL(root.href);
    url.search = locationRef.search;
    return url;
  }

  /// The part of a path below the site's root, with any `index.html` and
  /// surrounding slashes off. Null when the address is not a page this site
  /// draws, '' for the front document, `mods/<id>` for a mod's page.
  ///
  /// Our pages are folders — the site's own, and one per mod. Anything else
  /// under the root is a file the site fetches rather than a page it draws:
  /// `mods/<id>.json` is one mod's data, and sits right beside `mods/<id>/`.
  ///
  /// A folder is told from a file by the dot, not by the trailing slash. Most
  /// hosts redirect `mods/<id>` to `mods/<id>/`, but the site is not allowed to
  /// need anything a plain static server cannot do, and a link shared with the
  /// slash rubbed off should still open the mod. A mod's id is only ever
  /// lowercase letters, digits and dashes (`ModIdStore.cleanName` turns
  /// everything else into a dash), so an id can never look like a file.
  function below(pathname) {
    if (!pathname.startsWith(root.pathname)) return null;
    const rest = pathname
      .slice(root.pathname.length)
      .replace(/(^|\/)index\.html$/, '$1');
    const last = rest.replace(/\/+$/, '').split('/').pop() || '';
    if (rest !== '' && !rest.endsWith('/') && last.includes('.')) return null;
    return rest.replace(/^\/+|\/+$/g, '');
  }

  /// The route [url] names, or null when it is not a page this site draws —
  /// the release feed, a download, another site. A mod's page is named by its
  /// path; every other page by the hash on the front document.
  function routeOf(url) {
    if (url.origin !== locationRef.origin) return null;
    const rest = below(url.pathname);
    if (rest === null) return null;
    if (rest === '') return partsOfHash(url.hash);
    const bits = rest.split('/').map(decodeURIComponent);
    return bits.length === 2 && bits[0] === 'mods' ? bits : null;
  }

  /// The address last drawn. Kept so the same page is never drawn twice over
  /// for one move, and so a redraw that leaves the address alone is not
  /// mistaken for a move.
  let drawn = null;

  /// What the router asked to be told when the address moves.
  let announce = null;

  /// Draws whatever the address now names, unless it is already on screen.
  function moved() {
    if (locationRef.href === drawn) return;
    drawn = locationRef.href;
    if (announce) announce();
  }

  /// Adds a history entry for [url] and draws it.
  function goTo(url) {
    if (url.href === locationRef.href) return;
    historyRef.pushState(null, '', url.href);
    moved();
  }

  /// A click on a link to one of our own pages, turned into a history entry so
  /// the site does not reload. Everything else — another site, a download, a
  /// new tab, a click with a key held down — is left to the browser.
  function onClick(event) {
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const link = event.target && event.target.closest
      ? event.target.closest('a[href]')
      : null;
    if (!link) return;
    if (link.target || link.hasAttribute('download')) return;

    const url = new URL(link.href);
    if (routeOf(url) === null) return;

    event.preventDefault();
    // A hash link written on a mod's page resolves against the site's root,
    // which carries no query — so the reader's `?data=…` is put back on.
    if (!url.search) url.search = locationRef.search;
    goTo(url);
  }

  return {
    /// The route the address names, as path parts: ['mods','nexerelin'],
    /// ['browse'], or [] for the front page.
    parts() {
      return routeOf(new URL(locationRef.href)) || [];
    },

    /// The one address a page's scroll position is filed under. It has to be
    /// the same string every time that page is drawn, and a mod's page has no
    /// hash, so its route is written as one.
    scrollKey() {
      const rest = below(locationRef.pathname);
      if (rest) return `#/${rest}`;
      return locationRef.hash || '#/home';
    },

    /// The address of a mod's own page. It resolves to the same place from the
    /// front document and from another mod's page, because both have the
    /// site's root as their base.
    modHref(id) {
      return `mods/${encodeURIComponent(id)}/${locationRef.search}`;
    },

    /// Goes to a page, adding a history entry, and draws it.
    go(href) {
      goTo(new URL(href, here()));
    },

    /// Changes the address without adding a history entry and without
    /// redrawing. A list calls this as its search, filters and page change.
    replace(href) {
      const url = new URL(href, here());
      historyRef.replaceState(null, '', url.href);
      drawn = url.href;
    },

    /// Starts drawing pages: on Back and Forward, and on a click on one of our
    /// own links.
    ///
    /// Both history events are needed. An ordinary hash link fires
    /// `hashchange`, and in some browsers `popstate` as well; a jump between a
    /// mod's path and a hash address changes more than the fragment, so it
    /// fires only `popstate`. Listening for just the first of those is what
    /// leaves the Back button dead on a mod's page.
    watch(onMove) {
      announce = onMove;
      drawn = locationRef.href;
      windowRef.addEventListener('popstate', moved);
      windowRef.addEventListener('hashchange', moved);
      documentRef.addEventListener('click', onClick);
    },
  };
}

/// The one address the site uses. Built when it is first asked for, so a test
/// can build its own over a fake browser instead.
let shared = null;

export function address() {
  if (!shared) shared = siteAddress();
  return shared;
}
