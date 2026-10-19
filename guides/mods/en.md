## Choose Linux or Windows

Palworld runs server mods only on Windows. That limit comes from the game itself. Your server runs on Linux by default. If you want mods that run on the server, such as mods built on UE4SS or PalSchema, switch it to Windows.

> [!warning] On Windows every player starts a new character, because Palworld's Windows server identifies players differently from Linux. Your world stays as it is, and your Linux characters are kept and come back when you switch back to Linux. That's why Windows suits a new world best.

## Switch to Windows

1. Open the **Mods** tab
2. Under **Operating system**, choose **Windows, with server mods**, then save

We take a backup before the switch. Then your server downloads the game files from Steam again, and it's down until the download finishes. Your world and settings stay, and every player starts a new character.

## Upload a mod

1. Download the mod from its site, such as the Steam Workshop or Nexus Mods
2. In the **Your mods** table, press **Upload a mod** and pick the mod's zip as you downloaded it
3. Restart your server, and the mod runs

The table takes three kinds of mods:

- Steam Workshop packages with an `Info.json` file
- PalSchema mods
- UE4SS mods

Before you upload:

- We include matching versions of UE4SS and PalSchema, so you don't need to upload them
- If your mod needs other mods, upload them too
- If a mod comes with more than one preset, upload only one preset, because the mod is made to have one preset installed at a time
- Every player needs the same mods, so install them on your PC before joining

The state "Doesn't run on servers" means the mod was made for the player's PC only, and your server won't run it.

## Edit a mod's files

Every start replaces the files in the `ue4ss` folder on your server with clean ones, so changes inside it are lost. To change a mod's files, open the file manager and edit them under `Mods/UE4SSMods` or `Mods/PalSchemaMods`.

## If your server crashes after an update

A Palworld update can break some mods until their authors update them. If your server crashes after an update, turn the mods off in the **Your mods** table, then start your server.

## Switch back to Linux

In the **Mods** tab, set **Operating system** to Linux, and your Linux characters come back as they were.

> [!note] If your mods added things to the world, it may not open on Linux the way it was. In that case, restore the backup we took before the switch to Windows.
