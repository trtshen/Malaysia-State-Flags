import { existsSync, readFileSync } from "node:fs";
import { extname } from "node:path";
import {
  ensureTooling, fileSize, fromRoot, listFiles, loadManifest, relativePath,
  renderAttribution, renderGallery, replaceTemplate, run, validateSourceSvg
} from "./lib.mjs";

const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };
const manifest = loadManifest();
ensureTooling();

check(manifest.schemaVersion === 1, "Manifest schemaVersion must be 1.");
check(manifest.flags.length === 17, `Expected 17 flags; found ${manifest.flags.length}.`);
check(manifest.flags.filter((flag) => flag.type === "state").length === 13, "Expected 13 state flags.");
check(manifest.flags.filter((flag) => flag.type === "federal-territory").length === 3, "Expected three individual federal territories.");
check(manifest.flags.filter((flag) => flag.type === "federal-territories-collective").length === 1, "Expected one collective Federal Territories flag.");
check(new Set(manifest.flags.map((flag) => flag.id)).size === manifest.flags.length, "Flag IDs must be unique.");
check(JSON.stringify(manifest.sizes) === JSON.stringify([32, 64, 128, 256, 512]), "Icon sizes must be 32, 64, 128, 256, and 512.");

for (const flag of manifest.flags) {
  check(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(flag.id), `${flag.id}: invalid stable ID.`);
  check(Boolean(flag.name && flag.nameMs && flag.alt), `${flag.id}: names and accessibility text are required.`);
  check(flag.source.descriptionUrl.startsWith("https://") && flag.source.descriptionUrl.includes("oldid="), `${flag.id}: permanent description URL is required.`);
  check(flag.source.revisionUrl.startsWith("https://"), `${flag.id}: HTTPS source revision URL is required.`);
  check(Array.isArray(flag.source.authors) && flag.source.authors.length > 0, `${flag.id}: source authors are required.`);
  check(Boolean(flag.source.license?.id && flag.source.license?.name && flag.source.license?.url), `${flag.id}: source license metadata is incomplete.`);
  check(Boolean(flag.source.modificationStatus), `${flag.id}: modification status is required.`);

  errors.push(...validateSourceSvg(flag));
}

const identify = (path) => run("magick", ["identify", "-format", "%w|%h|%[channels]|%[opaque]", path], { capture: true }).split("|");
const visibleMean = (path) => Number(run("magick", [path, "-alpha", "off", "-colorspace", "RGB", "-format", "%[fx:mean]", "info:"], { capture: true }));
for (const flag of manifest.flags) {
  for (const size of manifest.sizes) {
    for (const style of ["faithful", "rounded"]) {
      const template = style === "faithful" ? manifest.assetTemplates.faithfulPng : manifest.assetTemplates.roundedPng;
      const relative = replaceTemplate(template, { id: flag.id, size });
      const path = fromRoot(relative);
      check(existsSync(path), `${flag.id}: missing ${relative}.`);
      if (existsSync(path)) {
        const [width, height, , opaque] = identify(path);
        check(Number(width) === size && Number(height) === size, `${relative}: expected ${size}x${size}.`);
        check(opaque.toLowerCase() === "false", `${relative}: expected a transparent canvas.`);
        check(visibleMean(path) > 0.01, `${relative}: rendered content is unexpectedly black or empty.`);
      }
    }
  }
  const stickerRelative = replaceTemplate(manifest.assetTemplates.whatsapp, { id: flag.id });
  const sticker = fromRoot(stickerRelative);
  check(existsSync(sticker), `${flag.id}: missing ${stickerRelative}.`);
  if (existsSync(sticker)) {
    const [width, height, , opaque] = identify(sticker);
    check(width === "512" && height === "512", `${stickerRelative}: expected 512x512.`);
    check(opaque.toLowerCase() === "false", `${stickerRelative}: expected transparency.`);
    check(visibleMean(sticker) > 0.01, `${stickerRelative}: rendered content is unexpectedly black or empty.`);
    check(fileSize(sticker) <= 100 * 1024, `${stickerRelative}: exceeds the 100 KB WhatsApp limit.`);
  }
}

const pngFiles = listFiles(fromRoot("assets", "png")).filter((path) => extname(path).toLowerCase() === ".png");
const webpFiles = listFiles(fromRoot("platforms", "whatsapp", "stickers")).filter((path) => extname(path).toLowerCase() === ".webp");
check(pngFiles.length === 170, `Expected 170 PNGs; found ${pngFiles.length}.`);
check(webpFiles.length === 17, `Expected 17 WhatsApp stickers; found ${webpFiles.length}.`);

const tray = fromRoot("platforms", "whatsapp", "tray.png");
check(existsSync(tray), "Missing WhatsApp tray icon.");
if (existsSync(tray)) {
  const [width, height] = identify(tray);
  check(width === "96" && height === "96", "WhatsApp tray icon must be 96x96.");
  check(fileSize(tray) <= 50 * 1024, "WhatsApp tray icon exceeds 50 KB.");
}

const contentsPath = fromRoot("platforms", "whatsapp", "contents.json");
check(existsSync(contentsPath), "Missing WhatsApp contents.json.");
if (existsSync(contentsPath)) {
  const contents = JSON.parse(readFileSync(contentsPath, "utf8"));
  const pack = contents.sticker_packs?.[0];
  check(contents.sticker_packs?.length === 1, "WhatsApp metadata must contain one pack.");
  check(pack?.stickers?.length === 17, "WhatsApp pack must contain 17 stickers.");
  check(pack?.stickers?.every((sticker) => sticker.accessibility_text && sticker.image_file), "Every WhatsApp sticker needs a file and accessibility label.");
}

const readme = readFileSync(fromRoot("README.md"), "utf8");
const galleryMatch = readme.match(/<!-- GALLERY:START -->\n([\s\S]*?)\n<!-- GALLERY:END -->/);
check(galleryMatch?.[1] === renderGallery(manifest), "README gallery is out of date; run npm run docs.");
check(readFileSync(fromRoot("ATTRIBUTION.md"), "utf8") === renderAttribution(manifest), "ATTRIBUTION.md is out of date; run npm run docs.");

const localLinks = [...readme.matchAll(/(?:href|src)=["']([^"']+)["']|\]\(([^)]+)\)/g)]
  .map((match) => match[1] ?? match[2])
  .filter((link) => !/^(?:https?:|#|mailto:|\.\.\/)/.test(link))
  .map((link) => link.split(/[?#]/)[0]);
for (const link of localLinks) check(existsSync(fromRoot(link)), `README link does not resolve: ${link}`);

if (errors.length) {
  console.error(`Validation failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`Validated 17 source SVGs, 170 PNGs, 17 WhatsApp stickers, metadata, documentation, and links.`);
