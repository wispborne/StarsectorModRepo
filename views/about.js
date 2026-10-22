// About: what the site does, where its data comes from, and how to report a
// problem.

import {
    clear, el, formatDay, modList, PROBLEM_REPORT_BASE,
} from '../lib.js';

const MOD_REPO_URL = 'https://github.com/wispborne/StarsectorModRepo';
const SCRAPER_URL = 'https://github.com/wispborne/Mod_Repo_Scraper';
const WISP_URL = 'https://github.com/wispborne';
const TRIOS_URL = 'https://fractalsoftworks.com/forum/index.php?topic=29674';
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
        githubLink(TRIOS_URL, 'TriOS'),
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
            + ' corporate copyright, what is considered hate speech, takedown requests, political mods, targeted mods etc.'
            + ' These are not how I\'d like to spend my free time.'
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
            '"None" means the author says no AI was used. "Not stated" means the '
            + 'mod\'s posts were read and say nothing about it. "Not checked yet" '
            + 'means they have not been read for this yet. The site does not '
            + 'guess from the pictures or the writing.',
            [
                'On Browse, "Hide AI use" hides mods by what AI was used for. '
                + 'Mods that do not say, or have not been checked, stay visible. '
                + 'In the search box, ',
                el('code', {text: 'has:ai'}),
                ' finds mods whose author says AI was used, and ',
                el('code', {text: 'is:noai'}),
                ' finds mods whose author says it was not. Put ',
                el('code', {text: '-'}),
                ' in front of either to leave those mods out.',
            ],
        ]),

        el('p', {}, [
            el('a', {
                class: 'btn',
                href: 'updates.xml',
                text: 'Feed',
            }),
            el('span', {text: ' '}),
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
            el('span', {text: ' '}),
            el('a', {
                class: 'btn btn-primary',
                href: PROBLEM_REPORT_BASE,
                target: '_blank',
                rel: 'noopener nofollow',
                text: 'Report a problem',
            }),
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

function githubLink(href, text) {
    return el('a', {
        href,
        target: '_blank',
        rel: 'noopener',
        text,
    });
}
