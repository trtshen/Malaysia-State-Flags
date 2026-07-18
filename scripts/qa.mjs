import { mkdirSync, rmSync } from "node:fs";
import { ensureTooling, fromRoot, loadManifest, replaceTemplate, run } from "./lib.mjs";

ensureTooling();
const manifest = loadManifest();
const qaRoot = fromRoot("output", "qa");
const transparent = fromRoot("output", "qa", ".contact-sheet.png");
const temporaryRows = [];
mkdirSync(qaRoot, { recursive: true });

const images = manifest.flags.map((flag) => fromRoot(replaceTemplate(manifest.assetTemplates.roundedPng, { id: flag.id, size: 128 })));
for (let rowIndex = 0; rowIndex < Math.ceil(images.length / 5); rowIndex += 1) {
  const row = images.slice(rowIndex * 5, rowIndex * 5 + 5);
  const rowPath = fromRoot("output", "qa", `.row-${rowIndex}.png`);
  const args = [];
  for (let column = 0; column < 5; column += 1) {
    args.push("(");
    if (row[column]) args.push(row[column], "-background", "none", "-gravity", "center", "-extent", "160x160");
    else args.push("-size", "160x160", "xc:none");
    args.push(")");
  }
  args.push("-background", "none", "+append", rowPath);
  run("magick", args);
  temporaryRows.push(rowPath);
}
run("magick", [...temporaryRows, "-background", "none", "-append", transparent]);
const dimensions = run("magick", ["identify", "-format", "%wx%h", transparent], { capture: true });

run("magick", [transparent, "-background", "#f4f4f4", "-alpha", "remove", "-alpha", "off", fromRoot("output", "qa", "contact-sheet-light.png")]);
run("magick", [transparent, "-background", "#202124", "-alpha", "remove", "-alpha", "off", fromRoot("output", "qa", "contact-sheet-dark.png")]);
run("magick", ["-size", dimensions, "pattern:checkerboard", transparent, "-compose", "over", "-composite", fromRoot("output", "qa", "contact-sheet-pattern.png")]);
rmSync(transparent, { force: true });
for (const row of temporaryRows) rmSync(row, { force: true });
console.log(`Created visual QA sheets in ${qaRoot}.`);
