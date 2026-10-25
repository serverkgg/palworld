## Choose Linux or Windows

Palworld runs server mods only on Windows. That limit comes from the game itself. Your server runs on Linux by default. If you want mods that run on the server, such as mods built on UE4SS or PalSchema, switch it to Windows.

> [!warning] On Windows every player starts a new character, because Palworld's Windows server identifies players differently from Linux. Your world stays as it is, and your Linux characters are kept and come back when you switch back to Linux. That's why Windows suits a new world best.

## Switch to Windows

1. Open the **Mods** tab
2. Under **Operating system**, choose **Windows, with server mods**, then save

We take a backup before the switch. Then your server downloads the game files from Steam again, and it's down until the download finishes. Your world and settings stay, and every player starts a new character.

## Install a mod from the Steam Workshop

1. In **Your mods**, search for the mod by name
2. Press **Install**, and we install every mod it depends on with it
3. Restart your server, and the mod runs

The catalog lists only the Steam Workshop mods that run on servers, never mods made only for the player's PC.

## Upload a mod from another site

1. Download the mod's zip from its site, such as Nexus Mods or CurseForge
2. In **Your mods**, press **Upload a mod** and pick the zip as you downloaded it
3. Restart your server, and the mod runs

We place every mod in the right folders on your server ourselves, so don't unpack the zip or move its files. Uploads take four kinds of mods: Steam Workshop packages with an `Info.json` file, UE4SS mods in Lua or C++, PalSchema mods, and pak mods.

Before you upload:

- Don't upload UE4SS or PalSchema, because we include matching versions of both on your server
- If your mod needs other mods, upload them too. A mod's row names any mod it needs that isn't installed
- If a mod comes with more than one preset, upload only one preset, because the mod is made to have one preset installed at a time
- Mods that run their own DLL beside the game's files, such as PalDefender, aren't supported on Serverk yet

If an uploaded mod shows "Doesn't run on servers", we found nothing in it that a server runs. Install it in each player's game instead.

An uploaded mod shows the **Manual** badge, and we don't track its updates. To update it, remove it and upload its new version.

## Mods on your players' PCs

Every player needs the same mods, unless a mod's page says it runs on the server only. Before joining, ask your friends to subscribe to the same Steam Workshop mods from their pages, and to install the uploaded mods from their sites.

## Edit a mod's files

Every start rebuilds the mods we place on your server, in the `ue4ss` folder and in the pak folders, so changes there are lost. To change a mod's files, open the file manager and edit them under the `Mods` folder.

## After a Palworld update

A Palworld update can break some mods until their authors update them.

- If **Your mods** shows an update for a mod, press **Update**, then restart your server
- If your server crashes after an update, turn the mods off in **Your mods**, start your server, and turn them back on once their authors update them

## Switch back to Linux

In the **Mods** tab, set **Operating system** to Linux, and your Linux characters come back as they were. **Your mods** is hidden on Linux, because Linux runs no server mods.

> [!note] If your mods added things to the world, it may not open on Linux the way it was. In that case, restore the backup we took before the switch to Windows.
