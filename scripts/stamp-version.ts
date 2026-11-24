// Inscrit la version dans .output/VERSION : le lanceur sait ainsi ce que contient l'image.
import fs from "node:fs";
import pkg from "../package.json" with { type: "json" };

fs.writeFileSync(".output/VERSION", `${pkg.version}\n`);
console.log(`[build] version ${pkg.version}`);
