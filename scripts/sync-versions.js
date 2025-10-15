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

// Update Android version (tauri.properties)
const tauriPropertiesPath = join(
  rootDir,
  "src-tauri",
  "gen",
  "android",
  "app",
  "tauri.properties"
);
try {
  let tauriProperties = readFileSync(tauriPropertiesPath, "utf8");

  // Convert semantic version to Android version code
  // e.g., "0.5.0" -> 5000, "1.2.3" -> 10203
  const versionParts = version.split(".").map(Number);
  const versionCode =
    versionParts[0] * 10000 + versionParts[1] * 100 + (versionParts[2] || 0);

  // Update versionName and versionCode
  tauriProperties = tauriProperties.replace(
    /tauri\.android\.versionName=.*/,
    `tauri.android.versionName=${version}`
  );
  tauriProperties = tauriProperties.replace(
    /tauri\.android\.versionCode=.*/,
    `tauri.android.versionCode=${versionCode}`
  );

  writeFileSync(tauriPropertiesPath, tauriProperties);
  console.log(`✅ Updated Android version: ${version} (code: ${versionCode})`);
} catch (error) {
  console.log(
    "⚠️ Android tauri.properties not found - will be generated during build"
  );
}

console.log("🎉 Version sync complete!");
