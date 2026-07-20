import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fromRoot, loadManifest, replaceTemplate, run, validateSourceSvg } from "./lib.mjs";

const manifest = loadManifest();
const outputDirectory = fromRoot("output", "site");
const repositoryUrl = "https://github.com/trtshen/Malaysia-State-Flags";
const releaseUrl = `${repositoryUrl}/releases/latest`;

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function requireFile(relativePath) {
  const path = fromRoot(relativePath);
  if (!existsSync(path)) throw new Error(`Required site asset is missing: ${relativePath}`);
}

function requireHttpsUrl(value, fieldName) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${fieldName} must be a valid URL.`);
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error(`${fieldName} must be an HTTPS URL without embedded credentials.`);
  }
  return url.href;
}

function validateManifest() {
  if (!Array.isArray(manifest.flags) || manifest.flags.length !== 17) {
    throw new Error(`Expected 17 flags in data/flags.json; found ${manifest.flags?.length ?? 0}.`);
  }
  if (!Array.isArray(manifest.sizes) || manifest.sizes.some((size) => !Number.isInteger(size))) {
    throw new Error("data/flags.json must contain an integer sizes array.");
  }

  const ids = new Set();
  for (const flag of manifest.flags) {
    if (ids.has(flag.id)) throw new Error(`Duplicate flag ID: ${flag.id}`);
    ids.add(flag.id);
    if (!flag.name || !flag.nameMs || !flag.alt || !flag.source?.license?.name) {
      throw new Error(`Flag ${flag.id} is missing site content required by the catalogue.`);
    }
    for (const [fieldName, value] of [
      ["descriptionUrl", flag.source.descriptionUrl],
      ["revisionUrl", flag.source.revisionUrl],
      ["license.url", flag.source.license.url],
      ["verifiedAgainst", flag.source.verifiedAgainst]
    ]) {
      if (value) requireHttpsUrl(value, `${flag.id} source.${fieldName}`);
    }
    const svgErrors = validateSourceSvg(flag);
    if (svgErrors.length) throw new Error(svgErrors.join("\n"));
    requireFile(replaceTemplate(manifest.assetTemplates.whatsapp, { id: flag.id }));
    for (const size of manifest.sizes) {
      requireFile(replaceTemplate(manifest.assetTemplates.faithfulPng, { id: flag.id, size }));
      requireFile(replaceTemplate(manifest.assetTemplates.roundedPng, { id: flag.id, size }));
    }
  }
}

function typeLabel(type) {
  if (type === "state") return "State";
  if (type === "federal-territory") return "Federal territory";
  return "Collective flag";
}

function externalLink(url, label) {
  return `<a href="${escapeHtml(requireHttpsUrl(url, `${label} link`))}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`;
}

function renderCard(flag, index) {
  const png = replaceTemplate(manifest.assetTemplates.faithfulPng, { id: flag.id, size: 128 });
  const webp = replaceTemplate(manifest.assetTemplates.whatsapp, { id: flag.id });
  const nativeName = flag.nameMs === flag.name
    ? ""
    : `<p class="flag-native" lang="ms">${escapeHtml(flag.nameMs)}</p>`;
  const authors = flag.source.authors.map(escapeHtml).join(", ");
  const attribution = flag.source.attribution
    ? `<dt>Attribution</dt><dd>${escapeHtml(flag.source.attribution)}</dd>`
    : "";
  const verified = flag.source.verifiedAgainst
    ? `<li>${externalLink(flag.source.verifiedAgainst, "Verification reference")}</li>`
    : "";
  const eager = index < 4 ? ' loading="eager" fetchpriority="high"' : ' loading="lazy"';

  return `
    <article class="flag-card" data-flag-card data-id="${escapeHtml(flag.id)}" data-type="${escapeHtml(flag.type)}" data-search="${escapeHtml(`${flag.name} ${flag.nameMs} ${flag.id}`.toLowerCase())}">
      <div class="flag-preview">
        <img src="${escapeHtml(png)}" alt="${escapeHtml(flag.alt)}" width="128" height="128" data-preview${eager}>
      </div>
      <div class="flag-card-body">
        <div class="flag-heading">
          <div>
            <h3>${escapeHtml(flag.name)}</h3>
            ${nativeName}
          </div>
          <span class="type-badge">${typeLabel(flag.type)}</span>
        </div>
        <div class="download-row" aria-label="Download ${escapeHtml(flag.name)} flag">
          <a class="download-link" href="${escapeHtml(flag.assets.svg)}" download>SVG</a>
          <a class="download-link" href="${escapeHtml(png)}" download data-png-link>PNG</a>
          <a class="download-link" href="${escapeHtml(webp)}" download>WebP</a>
        </div>
        <button class="copy-button" type="button" data-copy-button>Copy HTML</button>
        <details class="source-details">
          <summary>Source and licence</summary>
          <dl>
            <dt>Author(s)</dt><dd>${authors}</dd>
            <dt>Licence</dt><dd>${externalLink(flag.source.license.url, flag.source.license.name)}</dd>
            ${attribution}
            <dt>Changes</dt><dd>${escapeHtml(flag.source.modificationStatus)}</dd>
          </dl>
          <ul class="source-links">
            <li>${externalLink(flag.source.revisionUrl, "Source file")}</li>
            <li>${externalLink(flag.source.descriptionUrl, "Source description")}</li>
            ${verified}
          </ul>
        </details>
      </div>
    </article>`;
}

function renderPage() {
  const cards = manifest.flags.map(renderCard).join("\n");
  const heroFlags = manifest.flags.slice(0, 7).map((flag) => {
    const path = replaceTemplate(manifest.assetTemplates.roundedPng, { id: flag.id, size: 128 });
    return `<img src="${escapeHtml(path)}" alt="" width="84" height="84">`;
  }).join("\n");
  const sizes = manifest.sizes.map((size) => `<option value="${size}"${size === 128 ? " selected" : ""}>${size} px</option>`).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Download SVG, PNG, and WebP flags for Malaysia's states and federal territories.">
  <meta name="theme-color" content="#071b31">
  <meta property="og:title" content="Malaysia State Flags">
  <meta property="og:description" content="A download-ready, community-maintained collection of Malaysia state and federal territory flags.">
  <meta property="og:type" content="website">
  <title>Malaysia State Flags — SVG, PNG and WebP downloads</title>
  <link rel="icon" href="assets/png/rounded/64/federal-territories.png" type="image/png">
  <link rel="stylesheet" href="styles.css">
  <script src="app.js" defer></script>
</head>
<body>
  <a class="skip-link" href="#catalogue">Skip to flag catalogue</a>
  <header class="site-header">
    <a class="brand" href="#top" aria-label="Malaysia State Flags home">
      <img src="assets/png/rounded/64/federal-territories.png" alt="" width="42" height="42">
      <span>Malaysia State Flags</span>
    </a>
    <nav aria-label="Primary navigation">
      <a href="#catalogue">Flags</a>
      <a href="#formats">Formats</a>
      <a href="#use">Use</a>
      <a href="${repositoryUrl}">GitHub</a>
    </nav>
  </header>

  <main id="top">
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-copy">
        <p class="eyebrow">Unofficial · Community maintained</p>
        <h1 id="hero-title">Every Malaysian state flag, ready to use.</h1>
        <p class="hero-intro">Download-ready SVG flags and social-sized icons for Malaysia’s 13 states, three federal territories, and the collective Federal Territories flag.</p>
        <div class="hero-actions">
          <a class="button button-primary" href="#catalogue">Browse flags</a>
          <a class="button button-secondary" href="${releaseUrl}">Download all</a>
          <a class="text-link" href="${repositoryUrl}">View on GitHub <span aria-hidden="true">↗</span></a>
        </div>
        <dl class="collection-stats" aria-label="Collection summary">
          <div><dt>${manifest.flags.length}</dt><dd>flags</dd></div>
          <div><dt>${manifest.sizes.length}</dt><dd>PNG sizes</dd></div>
          <div><dt>3</dt><dd>file formats</dd></div>
        </dl>
      </div>
      <div class="hero-flags" aria-hidden="true">${heroFlags}</div>
    </section>

    <section class="catalogue section" id="catalogue" aria-labelledby="catalogue-title">
      <div class="section-heading">
        <div>
          <p class="eyebrow">The collection</p>
          <h2 id="catalogue-title">Find your flag</h2>
          <p>Choose a presentation and resolution, then download individual files.</p>
        </div>
        <p class="result-count" aria-live="polite" data-result-count>${manifest.flags.length} flags shown</p>
      </div>

      <div class="catalogue-controls" aria-label="Catalogue controls">
        <label class="search-control">
          <span>Search flags</span>
          <input type="search" placeholder="Try Johor or Melaka" autocomplete="off" data-search-input>
        </label>
        <fieldset class="filter-control">
          <legend>Type</legend>
          <div class="segmented-control" data-filter-group>
            <button type="button" aria-pressed="true" data-filter="all">All</button>
            <button type="button" aria-pressed="false" data-filter="state">States</button>
            <button type="button" aria-pressed="false" data-filter="federal">Federal Territories</button>
          </div>
        </fieldset>
        <label class="select-control">
          <span>Preview style</span>
          <select data-style-select>
            <option value="faithful" selected>Faithful</option>
            <option value="rounded">Rounded</option>
          </select>
        </label>
        <label class="select-control">
          <span>PNG size</span>
          <select data-size-select>${sizes}</select>
        </label>
      </div>

      <div class="flag-grid" data-flag-grid>${cards}</div>
      <div class="empty-state" hidden data-empty-state>
        <h3>No matching flags</h3>
        <p>Try another name or clear the selected filter.</p>
      </div>
      <p class="copy-status" role="status" aria-live="polite" data-copy-status></p>
    </section>

    <section class="formats section" id="formats" aria-labelledby="formats-title">
      <div class="section-heading narrow">
        <div><p class="eyebrow">Choose the right file</p><h2 id="formats-title">Four useful presentations</h2></div>
      </div>
      <div class="format-grid">
        <article><span class="format-mark">SVG</span><h3>Vector source</h3><p>Scales cleanly to any size. Best for websites, print, and design work.</p></article>
        <article><span class="format-mark">PNG</span><h3>Faithful raster</h3><p>A direct raster conversion that keeps the flag’s original proportions.</p></article>
        <article><span class="format-mark">PNG</span><h3>Rounded icon</h3><p>A square, clipped presentation for avatars, menus, and social interfaces.</p></article>
        <article><span class="format-mark">WebP</span><h3>Sticker artwork</h3><p>512×512 artwork prepared for compatible WhatsApp sticker workflows.</p></article>
      </div>
      <div class="bulk-downloads">
        <div><h3>Download a complete set</h3><p>Release archives bundle the latest validated collection.</p></div>
        <div class="bulk-actions">
          <a href="${releaseUrl}/download/svg.zip">SVG sources</a>
          <a href="${releaseUrl}/download/icons.zip">PNG icons</a>
          <a href="${releaseUrl}/download/whatsapp.zip">WhatsApp artwork</a>
        </div>
      </div>
      <p class="note">Raw GitHub URLs are convenient for testing, but should not be treated as a production CDN.</p>
    </section>

    <section class="usage section" id="use" aria-labelledby="use-title">
      <div class="section-heading narrow">
        <div><p class="eyebrow">Quick start</p><h2 id="use-title">Use the files accessibly</h2><p>Prefer SVG when you need flexible sizing. Choose a generated PNG when you need fixed dimensions or a social-ready treatment.</p></div>
      </div>
      <div class="code-grid">
        <article><h3>HTML image</h3><pre><code>&lt;img src="./assets/svg/johor.svg"
  alt="Flag of Johor, Malaysia"
  width="240"&gt;</code></pre></article>
        <article><h3>CSS background</h3><pre><code>.johor-flag {
  background: url("./assets/png/rounded/128/johor.png")
    center / contain no-repeat;
  width: 128px;
  height: 128px;
}</code></pre></article>
      </div>
      <p class="accessibility-callout"><strong>Describe meaning, not decoration.</strong> If a flag conveys location or identity, give it meaningful alternative text. Use an empty <code>alt</code> only when the image is purely decorative.</p>
    </section>

    <section class="legal section" aria-labelledby="legal-title">
      <div>
        <p class="eyebrow">Use responsibly</p>
        <h2 id="legal-title">Attribution and official-symbol rules still matter.</h2>
      </div>
      <div>
        <p>Each flag retains its recorded upstream licensing terms. Official-symbol, trademark, passing-off, and respectful-display rules can apply independently of copyright.</p>
        <p><strong>This collection is unofficial.</strong> It is not affiliated with or endorsed by the Government of Malaysia or any Malaysian state or federal territory.</p>
        <div class="legal-links">
          <a href="${repositoryUrl}/blob/main/ATTRIBUTION.md">Full attribution</a>
          <a href="${repositoryUrl}/blob/main/LEGAL.md">Legal notice</a>
          <a href="${repositoryUrl}/blob/main/LICENSE">Project licence</a>
        </div>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <div><strong>Malaysia State Flags</strong><p>Collection version ${escapeHtml(manifest.collection.version)}</p></div>
    <div class="footer-links">
      <a href="${repositoryUrl}/issues/new?template=incorrect-flag.yml">Report an incorrect flag</a>
      <a href="${repositoryUrl}/issues/new?template=new-source.yml">Propose a source</a>
      <a href="${repositoryUrl}/issues/new?template=licensing.yml">Raise a licensing concern</a>
      <a href="${repositoryUrl}/blob/main/CONTRIBUTING.md">Contributing guide</a>
      <a href="${releaseUrl}">Latest release</a>
      <a href="${repositoryUrl}">Repository</a>
    </div>
  </footer>
</body>
</html>`;
}

function validateOutput() {
  const htmlPath = join(outputDirectory, "index.html");
  const html = readFileSync(htmlPath, "utf8");
  const renderedCards = (html.match(/data-flag-card/g) ?? []).length;
  if (renderedCards !== manifest.flags.length) {
    throw new Error(`Generated site contains ${renderedCards} cards; expected ${manifest.flags.length}.`);
  }

  const localLinks = [...html.matchAll(/(?:href|src)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((link) => !/^(?:https?:|#|mailto:)/.test(link))
    .map((link) => link.split(/[?#]/)[0]);
  for (const link of localLinks) {
    if (link.startsWith("/") || !existsSync(join(outputDirectory, link))) {
      throw new Error(`Generated site link does not resolve inside the Pages artifact: ${link}`);
    }
  }
}

validateManifest();
run("node", ["--check", fromRoot("site", "app.js")]);
rmSync(outputDirectory, { recursive: true, force: true });
mkdirSync(outputDirectory, { recursive: true });

for (const relativePath of ["assets/svg", "assets/png", "platforms/whatsapp/stickers"]) {
  const destination = join(outputDirectory, relativePath);
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(fromRoot(relativePath), destination, { recursive: true });
}

cpSync(fromRoot("site", "styles.css"), join(outputDirectory, "styles.css"));
cpSync(fromRoot("site", "app.js"), join(outputDirectory, "app.js"));
writeFileSync(join(outputDirectory, ".nojekyll"), "");
writeFileSync(join(outputDirectory, "index.html"), renderPage());
validateOutput();

console.log(`Generated GitHub Pages site with ${manifest.flags.length} flags at output/site/.`);
