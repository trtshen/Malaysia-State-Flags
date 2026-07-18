import { readFileSync, writeFileSync } from "node:fs";
import { fromRoot, loadManifest, renderAttribution, renderGallery } from "./lib.mjs";

const manifest = loadManifest();
const readmePath = fromRoot("README.md");
const start = "<!-- GALLERY:START -->";
const end = "<!-- GALLERY:END -->";
const readme = readFileSync(readmePath, "utf8");
if (!readme.includes(start) || !readme.includes(end)) throw new Error("README gallery markers are missing.");
const gallery = `${start}\n${renderGallery(manifest)}\n${end}`;
const updated = readme.replace(new RegExp(`${start}[\\s\\S]*?${end}`), gallery);
writeFileSync(readmePath, updated);
writeFileSync(fromRoot("ATTRIBUTION.md"), renderAttribution(manifest));
console.log("Updated README gallery and ATTRIBUTION.md from data/flags.json.");
