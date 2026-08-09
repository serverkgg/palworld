# بالورلد (Palworld)

حزمة بالورلد على منصة سيرفرك (`serverk.gg`). هذا المستودع فيه كل شيء اللعبة تحتاجه عشان تشتغل على المنصة: ملف التعريف `serverk.yml`، الـ driver اللي يدير السيرفر، صورة الدوكر، والشروحات.

The Palworld game package for the Serverk platform (`serverk.gg`). This repo holds everything the game needs to run on the platform: the `serverk.yml` manifest, the driver that manages the server, the Docker image, and the guides.

## Layout

- `serverk.yml` — the game manifest: metadata, resources, ports, backup rules, guides.
- `src/` — the bridge driver: install (SteamCMD), lifecycle, query, backup, and the panel modules.
- `image/Dockerfile` — the runtime image; the compiled bridge binary is its entrypoint.
- `assets/` — logo and banner (webp).
- `guides/` — player guides in Arabic and English.

## Develop

Everything runs on [Bun](https://bun.sh):

```sh
bun install
bun run check
bun run tsc
bun run validate
bun run compile
```

`validate` checks the manifest, assets, and driver wiring with the exact validation the platform runs at publish. `compile` produces `dist/bridge-amd64` and `dist/bridge-arm64`.

The driver is built on [`@serverkgg/bridge`](https://www.npmjs.com/package/@serverkgg/bridge). To develop against a local bridge checkout, `bun link` in the bridge package then `bun link @serverkgg/bridge` here — never commit a `file:` dependency.

## Contribute

- افتح issue لأي مشكلة أو اقتراح — بالعربي أو بالإنجليزي، كلها مرحّب فيها.
- Pull requests run the `Check` workflow (lint, types, package validation) with no secrets, so forks work out of the box.
- Releases are done by the Serverk team through the platform's central release pipeline; merged changes ride the next release.

## Arabic copy

Arabic is the source language of the platform. Player-facing strings in `serverk.yml` and the guides use Gulf gaming Arabic — the game's Arabic name is always «بالورلد», written solid.
