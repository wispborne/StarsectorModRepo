# Wisp's Unofficial Mod Repo

## What this?

This is a big json file of many Starsector mods. It is automatically updated twice a day.

It is created by gathering data from the USC Discord server and the official Forum, then merging it all
together.

It's free for anybody to use, although I would love to hear if you are using it so we can talk about breaking changes if
needed.

The source code is located here: https://github.com/wispborne/Mod_Repo_Scraper. I accept ideas and consider
pull requests.

## Opting Out

Opting out is a work in progress and is currently just possible for Discord posts.

- Discord: React to your post with the 🕸 emoji.

## FAQ

- Does this download my files?
  - No. It grabs links, but never downloads anything.
- My mod is Discord-only, does this let anyone download it?
  - Depends. If the files were only uploaded to Discord, then no, users will need a USC Discord account to download it. However, if you linked to a website like GitHub for the download (which is public), then anyone can download it.
- What is this used for?
  - TriOS, MOSS, [Starmodder](https://starmodder.pages.dev/), and QB's Mod Manager. Maybe others.
- How is it updated?
  - I have a laptop server that auto-runs the program twice a day and commits the result to GitHub. My contributions streak has never been better.

## Mod Sources

Mods from different sources will be merged into one mod if either of the following merging methods succeeds:

1. Fuzzy matching of the mod name and author (both must roughly match).
2. Checking for a link to the official forum; if both mods point to the same page, they're merged.

### Forum

With permission, this uses JSoup to scrape the Mod Index as well as the Mods and Modding subforums.

It does _not_ load each individual mod page, only the list of topics, and uses a regex (`[\[{]([^]}]*?\d+?[^]}]*?)[]}]`)
to look for the game version in a forum topic to determine if it's a mod post or some other random post.

#### Data

- Name
- Author
- Forum url

### Discord

With permission, uses a bot account to read all messages in the #mod_updates channel of
the [USC server](https://discord.gg/a8AWVcPCPr) using the official Discord API.


Note: The mod repo does not download files, nor expose mods that are uploaded to Discord as attachments. If a mod is not
uploaded outside of Discord, the user will need a USC Discord account to download it.

#### Data

- Name (guessed)
- Summary
- Description
- Author
- Forum url (if present)
- Discord url
- Download Page url (if present)
- Direct Download url (if present)
- Images
- Created and Edited times

## Json Schema

### Example

```json
{
  "totalCount": 899,
  "lastUpdated": "2026-04-11T11:05:35.552286"
  "items": [
    {
      "name": "Nexerelin",
      "summary": "4X in Starsector.",
      "description": "4X in Starsector.\n\nDownload: <https://github.com/Histidine91/Nexerelin/releases/download/v0.12.1d/Nexerelin_0.12.1d.zip>\n\nChangelog: <https://github.com/Histidine91/Nexerelin/wiki/Changelog>\nForum thread: http://fractalsoftworks.com/forum/index.php?topic=9175.0\nNexus: https://www.nexusmods.com/starsector/mods/28\n\nKo-Fi: <https://ko-fi.com/R6R5Q52DU>",
      "gameVersionReq": "0.98a",
      "authorsList": [
        "Histidine",
        "Histidine, Zaphide",
        "histidine_my"
      ],
      "urls": {
        "Forum": "https://fractalsoftworks.com/forum/index.php?topic=9175.0",
        "Discord": "https://discord.com/channels/187635036525166592/1355540819095978154/1355540819095978154",
        "DirectDownload": "https://github.com/Histidine91/Nexerelin/releases/download/v0.12.1d/Nexerelin_0.12.1d.zip",
        "DownloadPage": "https://ko-fi.com/R6R5Q52DU"
      },
      "sources": [
        "Discord",
        "Index",
        "ModdingSubforum"
      ],
      "categories": [
        "Colonies",
        "Exploration",
        "Megamod",
        "Megamods",
        "Quests and Bars"
      ],
      "images": {
        "1355540819561676981": {
          "id": "1355540819561676981",
          "filename": "nex_icon.png",
          "contentType": "image/png",
          "size": 8716,
          "url": "https://cdn.discordapp.com/attachments/1355540819095978154/1355540819561676981/nex_icon.png?ex=69dba444&is=69da52c4&hm=9b8aff91a435a2db6224a77663753de1ffe54cf38bb66c4b8772bfb568510ff1&",
          "proxyUrl": "https://media.discordapp.net/attachments/1355540819095978154/1355540819561676981/nex_icon.png?ex=69dba444&is=69da52c4&hm=9b8aff91a435a2db6224a77663753de1ffe54cf38bb66c4b8772bfb568510ff1&"
        }
      },
      "dateTimeCreated": "2025-03-29T13:55:16.003Z",
      "dateTimeEdited": "2026-02-07T03:46:45.022Z"
    },
  ]
}
```

### Mod

| Field                     | Type (? for nullable)      | Notes                                                                                     | 
|---------------------------|----------------------------|-------------------------------------------------------------------------------------------| 
| name                      | String                     |                                                                                           | 
| summary                   | String?                    |                                                                                           | 
| description               | String?                    |                                                                                           | 
| modVersion                | String?                    |                                                                                           | 
| gameVersionReq            | String?                    |                                                                                           | 
| authorsList               | List<String>?              |                                                                                           | 
| urls                      | "Map<ModUrlType, String>?" | "ModUrlTypes: ""Forum"", ""Discord"", ""NexusMods"", ""DirectDownload"", ""DownloadPage"" | 
| May contain any or none." |                            |                                                                                           | 
| sources                   | List<ModSource>?           | "ModSources: ""Index"", ""ModdingSubforum"", ""Discord"", ""NexusMods"""                  | 
| categories                | List<String>?              |                                                                                           | 
| images                    | "Map<String, Image>?"      | See Image section                                                                         | 
| dateTimeCreated           | Date?                      | ISO-8601                                                                                  | 
| dateTimeEdited            | Date?                      | ISO-8601                                                                                  | 


### Image
|Field          |Type (? for nullable)   |Notes                                                                         |
|---------------|------------------------|------------------------------------------------------------------------------|
|id             |String                  |                                                                              |
|filename       |String?                 |                                                                              |
|description    |String?                 |                                                                              |
|content_type   |String?                 |                                                                              |
|size           |Int?                    |                                                                              |
|url            |String?                 |                                                                              |
|proxy_url      |String?                 |                                                                              |
