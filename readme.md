# Wisp's Unofficial Mod Repo

## What this?

This is a big json file of many Starsector mods. It is automatically updated twice a day.

It is created by gathering data from the USC Discord server, the official Forum, and NexusMods, then merging it all
together.

It's free for anybody to use, although I would love to hear if you are using it so we can talk about breaking changes if
needed.

The source code is located here: <https://github.com/davidwhitman/SMOL/tree/dev/Mod_Repo>. I accept ideas and consider
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
  - SMOL and MOSS, so far.
- How is it updated?
  - I have a Raspberry Pi that auto-runs the program twice a day and commits the result to GitHub. My contributions streak has never been better.

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

The first non-blank line in the post is assumed to be the name of the mod, and markdown is stripped from it.

The summary is the next two lines.

The description is everything after the first non-blank line.

The repo also looks for a link to the forum as well as a download link.

The search for a download link is prioritized and looks like this:

```kotlin
messageLines
    .mapNotNull { urlFinderRegex.find(it)?.value }
    .prefer { it.contains("/releases/download") }
    .prefer { it.contains("/releases") }
    .prefer { it.contains("dropbox") }
    .prefer { it.contains("drive.google") }
    .prefer { it.contains("patreon") }
    .prefer { it.contains("bitbucket") }
    .prefer { it.contains("github") }
    .prefer { it.contains("mediafire") }
```

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

### Nexus Mods

Uses a developer account to read all Starsector mods on NexusMods using their offical API.

#### Data

- Name
- Summary
- Description
- Version
- Author
- NexusMods url
- Categories
- Images (banner)
- Created and Edited times

## Json Schema

### Example

```json
{
  "totalCount": 312.0,
  "lastUpdated": "2022-05-21T01:13:00Z",
  "items": [
    {
      "name": "Nexerelin",
      "summary": "Nexerelin adds a number of 4X gameplay features to Starsector, such as faction diplomacy and warfare, and enhances the game with several other features. Choose your faction (or establish your own) and dominate the Sector!",
      "description": "[b][u]Features[/u][/b]\n<br />[list]\n<br />[*]4X game features in Starsector\n<br />[list]\n<br />[*]Factions will [b]wage war[/b] against each other and try to conquer their enemies\n<br />[*][b]Diplomacy[/b] events see faction relationships changing over time\n<br />[*][b]Join a faction[/b] to gain useful support and represent them in war and peace, or start your own\n<br />[*][b]Alliances[/b] offer mutual assistance in times of war\n<br />[*]Employers pay [b]insurance[/b] for ship losses\n<br />[*]NPC colonies [b]grow[/b] over time\n<br />[*]Planet descriptions can change as territory is won and lost (in development)\n<br />[/list][*]More things to do\n<br />[list]\n<br />[*][b]Mine[/b] planets and asteroids for useful resources for trade, or some treasure\n<br />[*]Use [b]agents[/b] to subvert other factions to your own ends\n<br />[*]Requisition [b]fleets[/b] from your colonies to carry out tasks\n<br />[*]Pay [b]tribute[/b] for the right to infringe on factions' territory\n<br />[*]Bring [b]aid[/b] to troubled worlds to keep them from decivilization\n<br />[*]Turn in [b]prisoners[/b] for reputation or cash\n<br />[*]Browse the [b]Prism Freeport[/b] for rare and pricey ships\n<br />[*]Construct remote [b]outposts[/b] to aid exploration\n<br />[/list][*]More events\n<br />[list]\n<br />[*][b]Remnant[/b] raids\n<br />[*][b]Relief[/b] fleets\n<br />[*][b]Vengeance[/b] fleets\n<br />[/list][*]New starting options\n<br />[list]\n<br />[*]Play in a [b]randomly generated[/b] Sector, or travel the star systems seen in vanilla and other mods\n<br />[*]Begin your journey with a range of [b]starting factions and ships[/b]\n<br />[/list][*]Gameplay tweaks\n<br />[list]\n<br />[*]Befriend pirates to lower the effects of their activity on your colonies\n<br />[*]Lower tariffs on trade\n<br />[*]...and more enhancements\n<br />[/list][/list]",
      "modVersion": "0.10.4d",
      "gameVersionReq": "0.95.1a",
      "authorsList": [
        "Histidine, Zaphide",
        "Histidine"
      ],
      "urls": {
        "Forum": "https://fractalsoftworks.com/forum/index.php?topic=9175.0",
        "NexusMods": "https://www.nexusmods.com/starsector/mods/28",
        "Discord": "https://discord.com/channels/187635036525166592/825068217361760306/962183806662635570",
        "DirectDownload": "https://github.com/Histidine91/Nexerelin/releases/download/v0.10.4d/Nexerelin_0.10.4d.zip",
        "DownloadPage": "https://github.com/Histidine91/Nexerelin/wiki/Changelog"
      },
      "sources": [
        "ModdingSubforum",
        "Discord",
        "NexusMods",
        "Index"
      ],
      "categories": [
        "Megamods"
      ],
      "images": {
        "banner": {
          "id": "https://staticdelivery.nexusmods.com/mods/2672/images/28/28-1550897189-588434237.jpeg",
          "filename": "https://staticdelivery.nexusmods.com/mods/2672/images/28/28-1550897189-588434237.jpeg",
          "url": "https://staticdelivery.nexusmods.com/mods/2672/images/28/28-1550897189-588434237.jpeg"
        }
      },
      "dateTimeCreated": "2019-02-23T05:21:04Z",
      "dateTimeEdited": "2022-04-09T02:52:13Z"
    }
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
