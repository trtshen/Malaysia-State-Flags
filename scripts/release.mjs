import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { fromRoot, run, sha256 } from "./lib.mjs";

run(process.execPath, ["scripts/build.mjs"]);
run(process.execPath, ["scripts/docs.mjs"]);
run(process.execPath, ["scripts/validate.mjs"]);
run(process.execPath, ["scripts/qa.mjs"]);

const releaseRoot = fromRoot("output", "release");
rmSync(releaseRoot, { recursive: true, force: true });
mkdirSync(releaseRoot, { recursive: true });

const archives = [
  ["svg.zip", "assets/svg"],
  ["icons.zip", "assets/png"],
  ["whatsapp.zip", "platforms/whatsapp"]
];

for (const [name, directory] of archives) {
  run("zip", ["-r", "-X", fromRoot("output", "release", name), directory]);
  run("unzip", ["-t", fromRoot("output", "release", name)]);
}

const sums = archives
  .map(([name]) => fromRoot("output", "release", name))
  .map((path) => `${sha256(path)}  ${basename(path)}`)
  .join("\n");
writeFileSync(fromRoot("output", "release", "SHA256SUMS"), `${sums}\n`);
console.log(`Created v1.0.0 release bundles in ${releaseRoot}.`);
