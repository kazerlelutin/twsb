// Prépare une version : met à jour package.json, commite et crée le tag vX.Y.Z.
//   bun run release patch|minor|major|1.4.0 [--push]
// Le tag poussé déclenche la CI de release (build, archive, image Docker).
import { spawnSync } from "node:child_process";
import fs from "node:fs";

const run = (cmd: string, args: string[]) => {
  const res = spawnSync(cmd, args, { stdio: "inherit" });
  if (res.status !== 0) process.exit(res.status ?? 1);
};
const output = (cmd: string, args: string[]) =>
  spawnSync(cmd, args, { encoding: "utf8" }).stdout.trim();

const [bump = "patch", ...flags] = process.argv.slice(2);
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const [major, minor, patch] = String(pkg.version).split(".").map(Number);
const next =
  bump === "major"
    ? `${major + 1}.0.0`
    : bump === "minor"
      ? `${major}.${minor + 1}.0`
      : bump === "patch"
        ? `${major}.${minor}.${patch + 1}`
        : bump.replace(/^v/, "");
if (!/^\d+\.\d+\.\d+$/.test(next)) {
  console.error(`Version invalide : ${bump}`);
  process.exit(1);
}
if (output("git", ["status", "--porcelain"])) {
  console.error("Des modifications ne sont pas commitées.");
  process.exit(1);
}
if (output("git", ["tag", "--list", `v${next}`])) {
  console.error(`Le tag v${next} existe déjà.`);
  process.exit(1);
}
pkg.version = next;
fs.writeFileSync("package.json", `${JSON.stringify(pkg, null, 2)}\n`);
run("git", ["add", "package.json"]);
run("git", ["commit", "-m", `Version ${next}`]);
run("git", ["tag", "-a", `v${next}`, "-m", `Version ${next}`]);
if (flags.includes("--push")) run("git", ["push", "--follow-tags"]);
else console.log(`Tag v${next} créé. Publier : git push --follow-tags`);
