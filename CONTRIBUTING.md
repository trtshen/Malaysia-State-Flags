# Contributing

Thanks for helping keep the collection accurate, safe, and easy to use.

## Before opening a pull request

1. Open an issue for an incorrect flag, new authoritative source, or licensing concern.
2. Prefer an official government specification. If none is available, provide a permanent Wikimedia Commons revision with clear reuse terms.
3. Never replace a source SVG without updating its source URL, authors, license, SHA-256 checksum, and modification status in `data/flags.json`.
4. Keep SVGs self-contained: no scripts, event handlers, external references, fonts, doctypes, entities, `foreignObject`, or embedded raster images.
5. Do not rename a stable flag ID or published asset path in a minor or patch release.

## Build and check

Install Node.js 20 or newer, ImageMagick 7, `zip`, and `unzip`. No npm dependencies are installed.

```sh
npm run build
npm run docs
npm test
npm run qa
```

Review the three contact sheets in `output/qa/` at small and large zoom. Check light, dark, and patterned backgrounds. Generated output must be committed under `assets/png/` and `platforms/whatsapp/`; temporary QA and release bundles stay ignored under `output/`.

## Licensing

Only contribute work you may legally redistribute. By contributing project code or documentation, you agree to license it under MIT. Project-original tray artwork is CC0. Flag artwork keeps the terms recorded for its source, including attribution and share-alike obligations where applicable.
