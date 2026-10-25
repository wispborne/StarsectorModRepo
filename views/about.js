// About: what the site does, where its data comes from, and how to report a
// problem.

import {
    clear, el, formatDay, modList, PROBLEM_REPORT_BASE, SITE_CODE_URL, takedownButton,
} from '../lib.js';
import { GUIDE_ICON, GUIDE_ROUTE, GUIDE_TITLE, openGuide } from './guide.js';

const MOD_REPO_URL = 'https://github.com/wispborne/StarsectorModRepo';
const SCRAPER_URL = SITE_CODE_URL;
const WISP_URL = 'https://github.com/wispborne';
// TriOS's own page on this site.
const TRIOS_PAGE = 'mods/trios-launcher-mod-manager-toolkit/';
const QBMBAMM_URL = 'https://github.com/theRoastSuckling/QBMBAMM';

// Inline GitHub mark; inherits the button colour.
const GITHUB_ICON = '<svg viewBox="0 0 24 24" width="1em" height="1em" '
    + 'fill="currentColor" focusable="false" aria-hidden="true"><path d="'
    + 'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.1'
    + '13.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-'
    + '4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.'
    + '084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 '
    + '3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5'
    + '.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1'
    + '.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .4'
    + '05 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.76'
    + '5.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.'
    + '096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.5'
    + '65 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12'
    + '"/></svg>';

export async function render(root) {
    let collectedOn = null;
    try {
        collectedOn = (await modList()).generatedAt;
    } catch {
        collectedOn = null;
    }

    document.title = 'About | Starmodder';
    clear(root);
    root.append(el('div', {class: 'stack'}, [
        el('div', {class: 'page-head'}, [
            el('h1', {text: 'About Starmodder'}),
        ]),
        // The guide is always here, even with its top-bar button hidden.
        el('div', {class: 'about-actions'}, [
            guideButton(),
            iconButton('updates.xml', FEED_ICON, 'Release feed'),
            iconButton('#/changelog', CHANGELOG_ICON, 'Changelog'),
            // The site's own code.
            el('a', {
                class: 'btn btn-with-icon',
                href: SCRAPER_URL,
                target: '_blank',
                rel: 'noopener',
            }, [
                el('span', {class: 'github-icon', html: GITHUB_ICON}),
                'GitHub',
            ]),
            el('a', {
                class: 'btn btn-primary btn-with-icon',
                href: PROBLEM_REPORT_BASE,
                target: '_blank',
                rel: 'noopener nofollow',
            }, [
                el('span', {class: 'button-icon report-icon', html: REPORT_ICON}),
                'Report a problem',
            ]),
        ]),

    section('What is this?', [
      'Starmodder is an easier way to view, filter, and sort mods posted on the official Starsector '
        + 'forum and the Unofficial Starsector Discord.',
      [
        'This is ',
        el('em', {text: 'not'}),
        ' a site like NexusMods; you cannot upload or manage mods here (see "Why not let people upload mods?" below). It is only '
        + 'displaying mods from other sites in an easier format.',
      ],
    ]),

    section('Who made this?', [
      [
        'Starmodder is made by ',
        githubLink(WISP_URL, 'Wisp'),
        ' (developer of ',
        el('a', {href: TRIOS_PAGE, text: 'TriOS'}),
        '). Its scraper combines code written by Wisp with a Dart port and fork of ',
        githubLink(QBMBAMM_URL, 'QBMBAMM'),
        ', originally made by theRoastSuckling aka kyuubi_.',
      ],
        'AI wrote the code for the website itself.'
    ]),

    section('How does it work?', [
            [
                githubLink(SCRAPER_URL, 'A scraper'),
                ' collects mod information from forum threads and Discord mod '
                + 'channels, then merges it ',
                githubLink(MOD_REPO_URL, 'all together'),
                ', then builds this site from that merge. TriOS uses the same data.'
            ],
            collectedOn
                ? `The site updates twice a day. It last ran: ${
                    formatDay(collectedOn)}.`
                : 'The site updates twice a day.',
            [
                'It is available in the ',
                githubLink(MOD_REPO_URL, 'Starsector Mod Repo'),
                ' repo. The scraper\'s code is in the ',
                githubLink(SCRAPER_URL, 'Mod Repo Scraper'),
                ' repo.',
            ],
        ]),

        section('Why not let people upload mods?', [
            'Moderation.',
            'The current setup relies on the moderation teams of the Forum and USC to decide what mods'
            + ' to allow. From the Starmodder side, everything is entirely automated.',
            'Dealing with issues such as: how NSFW is too NSFW, whether a mod stole someone else\'s work,'
            + ' corporate copyright, what is considered hate speech, political mods, targeted mods etc.'
            + ' These are not how I\'d like to spend my free time.',
        ]),

        section('Removing your mods', [
            'If you made a mod, you can ask me to remove it from Starmodder. You can ask for one mod '
            + 'or all your mods.',
            'I only remove mods at the author\'s request. The button below explains how to contact me '
            + 'and confirm you\'re the author.',
            [takedownButton()],
        ]),

        section('How is AI used?', [
            'The LLM runs on my own hardware in my own home; scraped forum mods are not sent to cloud providers.',
            'AI writes summaries from forum posts and is marked with the sparkle icon.',
            'You can choose when to see AI-generated mod summaries in Settings: "Only as a fallback" (no human desc available), '
            + '"Always", or "Never".',
            'With summaries enabled, mod pages can also show an AI summary in '
            + 'the Description tab. You can hide it there for all mod pages.',
            'AI also extracts details such as versions, changelogs, save compatibility, licenses'
            + ', source code links, and more from the author\'s post.',
        ]),

        section('Does a mod say it was made with AI?', [
            'Each mod page has an "AI use" line under Details. It shows what the '
            + 'author says about using AI tools to make the mod, such as for '
            + 'portraits, music or code. Point at it to read the author\'s own words.',
            '"None" means the author says no AI was used. "Unknown" means the '
            + 'mod\'s posts were read and say nothing about it. "Not checked yet" '
            + 'means they have not been read for this yet. The site does not '
            + 'guess from the pictures or the writing.',
            [
                'On Browse, the "AI use" filter has presets such as "No AI images" '
                + 'and "No vibecode", or Custom to choose what AI was used for. '
                + 'Most presets keep mods that do not say, or have not been checked. '
                + '"Absolutely no AI" shows only mods whose author says no AI was used. '
                + 'In the search box, ',
                el('code', {text: 'has:ai'}),
                ' finds mods whose author says AI was used, and ',
                el('code', {text: 'is:noai'}),
                ' finds mods whose author says it was not. Put ',
                el('code', {text: '-'}),
                ' in front of either to leave those mods out.',
            ],
        ]),
    ]));
}

function section(title, paragraphs) {
    return el('section', {class: 'panel'}, [
        el('h2', {text: title}),
        ...paragraphs.map((content) => el(
            'p',
            {class: 'about-line'},
            typeof content === 'string' ? [content] : content,
        )),
    ]);
}

// Tabler icons (MIT): rss, history and message-report.
const FEED_ICON = tablerIcon('<path d="M5 19m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/>'
    + '<path d="M4 4a16 16 0 0 1 16 16"/><path d="M4 11a9 9 0 0 1 9 9"/>');
const CHANGELOG_ICON = tablerIcon('<path d="M12 8l0 4l2 2"/>'
    + '<path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5"/>');
const REPORT_ICON = tablerIcon('<path d="M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5'
    + 'l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12z"/>'
    + '<path d="M12 8v3"/><path d="M12 14v.01"/>');

function tablerIcon(paths) {
    return '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" '
        + 'stroke="currentColor" stroke-width="2" stroke-linecap="round" '
        + 'stroke-linejoin="round" focusable="false" aria-hidden="true">'
        + paths + '</svg>';
}

function iconButton(href, icon, label) {
    return el('a', {class: 'btn btn-with-icon', href}, [
        el('span', {class: 'button-icon', html: icon}),
        label,
    ]);
}

function guideButton() {
    // A link, so it is the same height as the links beside it. A plain click
    // opens the guide in a box, the same as the top bar's button.
    const link = iconButton(`${GUIDE_ROUTE}/`, GUIDE_ICON, GUIDE_TITLE);
    link.addEventListener('click', (e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        openGuide();
    });
    return link;
}

function githubLink(href, text) {
    return el('a', {
        href,
        target: '_blank',
        rel: 'noopener',
        text,
    });
}
