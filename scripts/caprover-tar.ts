// Archive à envoyer dans CapRover (« Deploy via upload » ou `caprover deploy -t`) :
//   bun run deploy:caprover          → sources (CapRover construit l'image)
//   bun run deploy:caprover 0.1.1    → image publiée sur GHCR (rien à construire)
// captain-definition est toujours à la racine de l'archive.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import pkg from "../package.json" with { type: "json" };

const IMAGE = "ghcr.io/kazerlelutin/twsb";
const version = process.argv[2]?.replace(/^v/, "");
fs.mkdirSync("dist", { recursive: true });

if (version) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "twsb-caprover-"));
  fs.writeFileSync(
    path.join(dir, "captain-definition"),
    `${JSON.stringify({ schemaVersion: 2, imageName: `${IMAGE}:${version}` }, null, 2)}\n`,
  );
  const out = path.resolve(`dist/twsb-caprover-v${version}.tar`);
  spawnSync("tar", ["-cf", out, "-C", dir, "captain-definition"], {
    stdio: "inherit",
  });
  console.log(`${out} : image ${IMAGE}:${version}`);
} else {
  if (
    spawnSync("git", ["status", "--porcelain"], {
      encoding: "utf8",
    }).stdout.trim()
  )
    console.warn(
      "Attention : seules les modifications commitées sont incluses.",
    );
  const out = path.resolve(`dist/twsb-source-v${pkg.version}.tar`);
  spawnSync("git", ["archive", "--format=tar", "-o", out, "HEAD"], {
    stdio: "inherit",
  });
  console.log(`${out} : sources (CapRover construit l'image)`);
}
