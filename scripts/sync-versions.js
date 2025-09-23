#!/usr/bin/env node

/**
 * Sync versions between package.json, Cargo.toml, and tauri.conf.json
 * This ensures all version numbers stay in sync when using changesets
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const rootDir = process.cwd();

// Read the version from package.json
const packageJson = JSON.parse(
  readFileSync(join(rootDir, "package.json"), "utf8")
);
const version = packageJson.version;

console.log(`📦 Syncing version to ${version}`);

// Update Cargo.toml
const cargoTomlPath = join(rootDir, "src-tauri", "Cargo.toml");
let cargoToml = readFileSync(cargoTomlPath, "utf8");
cargoToml = cargoToml.replace(/^version = "[^"]*"/m, `version = "${version}"`);
writeFileSync(cargoTomlPath, cargoToml);
console.log("✅ Updated src-tauri/Cargo.toml");

// Update tauri.conf.json
const tauriConfPath = join(rootDir, "src-tauri", "tauri.conf.json");
const tauriConf = JSON.parse(readFileSync(tauriConfPath, "utf8"));
tauriConf.version = version;
writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + "\n");
console.log("✅ Updated src-tauri/tauri.conf.json");

console.log("🎉 Version sync complete!");
