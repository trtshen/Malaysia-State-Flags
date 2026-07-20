import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function fromRoot(...parts) {
  return join(root, ...parts);
}

export function loadManifest() {
  return JSON.parse(readFileSync(fromRoot("data", "flags.json"), "utf8"));
}

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit"
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const details = options.capture ? `\n${result.stdout ?? ""}${result.stderr ?? ""}` : "";
    throw new Error(`${command} exited with status ${result.status}.${details}`);
  }
  return options.capture ? (result.stdout ?? "").trim() : "";
}

export function ensureTooling() {
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  if (nodeMajor < 20) throw new Error(`Node.js 20 or newer is required; found ${process.versions.node}.`);
  const version = run("magick", ["-version"], { capture: true });
  const match = version.match(/ImageMagick\s+(\d+)\./i);
  if (!match || Number(match[1]) < 7) throw new Error("ImageMagick 7 or newer is required.");
}

export function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function validateSourceSvg(flag) {
  const errors = [];
  const check = (condition, message) => { if (!condition) errors.push(`${flag.id}: ${message}`); };
  const svgPath = fromRoot(flag.assets.svg);

  check(existsSync(svgPath), `missing ${flag.assets.svg}.`);
  if (!existsSync(svgPath)) return errors;

  check(sha256(svgPath) === flag.source.sha256, "SVG SHA-256 does not match the manifest.");
  const svg = readFileSync(svgPath, "utf8");
  check(!/<script\b/i.test(svg), "scripts are forbidden in SVG.");
  check(!/<foreignObject\b/i.test(svg), "foreignObject is forbidden in SVG.");
  check(!/<!DOCTYPE|<!ENTITY/i.test(svg), "doctypes and entities are forbidden in SVG.");
  check(!/<image\b/i.test(svg), "embedded raster images are forbidden in SVG.");
  check(!/\son[a-z]+\s*=/i.test(svg), "event handlers are forbidden in SVG.");
  check(!/(?:href|xlink:href)\s*=\s*["'](?!#)/i.test(svg), "external SVG references are forbidden.");
  check(!/url\(\s*["']?(?:https?:|\/\/|data:)/i.test(svg), "external CSS resources are forbidden.");
  check(!/all rights reserved/i.test(svg), "conflicting All Rights Reserved notice found.");
  const rootTag = svg.match(/<svg\b([^>]*)>/i)?.[1] ?? "";
  const width = Number.parseFloat(rootTag.match(/\bwidth\s*=\s*["']([^"']+)/i)?.[1]);
  const height = Number.parseFloat(rootTag.match(/\bheight\s*=\s*["']([^"']+)/i)?.[1]);
  check(Number.isFinite(width) && Number.isFinite(height) && Math.abs(width / height - 2) < 0.001, "SVG dimensions must have a 2:1 ratio.");

  return errors;
}

export function listFiles(directory) {
  if (!existsSync(directory)) return [];
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(path));
    else files.push(path);
  }
  return files.sort();
}

export function relativePath(path) {
  return relative(root, path).split("\\").join("/");
}

export function replaceTemplate(template, values) {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key]));
}

export function fileSize(path) {
  return statSync(path).size;
}

export function renderGallery(manifest) {
  const cells = manifest.flags.map((flag) => {
    const rounded = replaceTemplate(manifest.assetTemplates.roundedPng, { id: flag.id, size: 128 });
    const faithful = replaceTemplate(manifest.assetTemplates.faithfulPng, { id: flag.id, size: 128 });
    const sticker = replaceTemplate(manifest.assetTemplates.whatsapp, { id: flag.id });
    const nativeName = flag.nameMs === flag.name ? "" : `<br><small>${flag.nameMs}</small>`;
    return `<a href="${flag.assets.svg}"><img src="${rounded}" width="96" height="96" alt="${flag.alt}"><br><strong>${flag.name}</strong>${nativeName}</a><br><a href="${faithful}">PNG</a> · <a href="${sticker}">WebP</a>`;
  });
  const rows = [];
  for (let index = 0; index < cells.length; index += 4) {
    const row = cells.slice(index, index + 4);
    while (row.length < 4) row.push("");
    rows.push(`<tr>${row.map((cell) => `<td align="center" width="25%">${cell}</td>`).join("")}</tr>`);
  }
  return `<table>\n${rows.join("\n")}\n</table>`;
}

export function renderAttribution(manifest) {
  const rows = manifest.flags.map((flag) => {
    const authors = flag.source.authors.join(", ");
    const attribution = flag.source.attribution ? ` ${flag.source.attribution}` : "";
    return `| ${flag.name} | [source revision](${flag.source.revisionUrl}) · [description](${flag.source.descriptionUrl}) | ${authors}${attribution} | [${flag.source.license.name}](${flag.source.license.url}) | ${flag.source.modificationStatus} |`;
  });
  return `# Attribution\n\nThis file is generated from [data/flags.json](data/flags.json). Do not edit it by hand.\n\n| Flag | Source | Author / attribution | Source license | Changes |\n| --- | --- | --- | --- | --- |\n${rows.join("\n")}\n\n## Generated assets\n\nFaithful PNGs are format conversions. Rounded PNGs and WhatsApp WebP files add canvas positioning, rounded clipping, borders, or strokes. Each generated asset remains subject to its source flag's terms. Where a source is public domain, the project dedicates any copyrightable contribution in its presentation to [CC0 1.0](LICENSES/CC0-1.0.txt). The project-original tray mark is also CC0 1.0.\n`;
}
