import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { ensureTooling, fromRoot, loadManifest, replaceTemplate, run } from "./lib.mjs";

ensureTooling();
const manifest = loadManifest();
const pngRoot = fromRoot("assets", "png");
const whatsappRoot = fromRoot("platforms", "whatsapp");

rmSync(pngRoot, { recursive: true, force: true });
rmSync(fromRoot("platforms", "whatsapp", "stickers"), { recursive: true, force: true });
mkdirSync(fromRoot("platforms", "whatsapp", "stickers"), { recursive: true });

for (const size of manifest.sizes) {
  mkdirSync(fromRoot("assets", "png", "faithful", String(size)), { recursive: true });
  mkdirSync(fromRoot("assets", "png", "rounded", String(size)), { recursive: true });
}

for (const flag of manifest.flags) {
  const source = fromRoot(flag.assets.svg);
  for (const size of manifest.sizes) {
    const faithfulRelative = replaceTemplate(manifest.assetTemplates.faithfulPng, { id: flag.id, size });
    const roundedRelative = replaceTemplate(manifest.assetTemplates.roundedPng, { id: flag.id, size });
    const faithful = fromRoot(faithfulRelative);
    const rounded = fromRoot(roundedRelative);
    const flagWidth = Math.round(size * 0.875);
    const flagHeight = flagWidth / 2;
    const radius = Math.round(size * 0.0625);
    const border = Math.max(1, Math.round(size / 128));
    const inset = border / 2;

    run("magick", [
      "-background", "none", source,
      "-resize", `${size}x${size / 2}!`,
      "-gravity", "center", "-extent", `${size}x${size}`,
      "-alpha", "on", "-strip", "-depth", "8", `PNG32:${faithful}`
    ]);

    run("magick", [
      "-background", "none", source,
      "-resize", `${flagWidth}x${flagHeight}!`,
      "(", "-size", `${flagWidth}x${flagHeight}`, "xc:none",
      "-fill", "white", "-stroke", "none",
      "-draw", `roundrectangle 0,0,${flagWidth - 1},${flagHeight - 1},${radius},${radius}`, ")",
      "-alpha", "off", "-compose", "CopyOpacity", "-composite",
      "-compose", "over",
      "-fill", "none", "-stroke", "rgba(0,0,0,0.18)", "-strokewidth", String(border),
      "-draw", `roundrectangle ${inset},${inset},${flagWidth - 1 - inset},${flagHeight - 1 - inset},${Math.max(1, radius - inset)},${Math.max(1, radius - inset)}`,
      "-gravity", "center", "-extent", `${size}x${size}`,
      "-alpha", "on", "-strip", "-depth", "8", `PNG32:${rounded}`
    ]);
  }

  const rounded512 = fromRoot(replaceTemplate(manifest.assetTemplates.roundedPng, { id: flag.id, size: 512 }));
  const sticker = fromRoot(replaceTemplate(manifest.assetTemplates.whatsapp, { id: flag.id }));
  mkdirSync(dirname(sticker), { recursive: true });
  run("magick", [
    "-size", "512x512", "xc:none",
    "-fill", "none", "-stroke", "white", "-strokewidth", "16",
    "-draw", "roundrectangle 32,144,479,367,32,32",
    rounded512, "-compose", "over", "-composite",
    "-strip", "-quality", "90", "-define", "webp:method=6", sticker
  ]);
}

run("magick", [
  "-background", "none", fromRoot("assets", "project", "tray-mark.svg"),
  "-resize", "96x96!", "-alpha", "on", "-strip", "-depth", "8",
  `PNG32:${fromRoot("platforms", "whatsapp", "tray.png")}`
]);

const contents = {
  sticker_packs: [{
    identifier: "malaysia_state_flags_v1",
    name: "Malaysia State Flags",
    publisher: "malaysia-state-flags contributors",
    tray_image_file: "tray.png",
    image_data_version: "1",
    stickers: manifest.flags.map((flag) => ({
      image_file: `stickers/${flag.id}.webp`,
      emojis: ["🇲🇾"],
      accessibility_text: flag.alt
    }))
  }]
};
writeFileSync(fromRoot("platforms", "whatsapp", "contents.json"), `${JSON.stringify(contents, null, 2)}\n`);
console.log(`Generated ${manifest.flags.length * manifest.sizes.length * 2} PNG icons and ${manifest.flags.length} WhatsApp stickers.`);
