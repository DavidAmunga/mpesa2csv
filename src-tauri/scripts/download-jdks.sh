#!/bin/bash

# Script to download Java 17 JREs for multiple platforms
# Downloads to app/src-tauri/resources/jdks/

set -e

# Configuration
RESOURCES_DIR="$(cd "$(dirname "$0")/../resources" && pwd)"
JDKS_DIR="${RESOURCES_DIR}/jre"

# Create jdks directory if it doesn't exist
mkdir -p "$JDKS_DIR"

echo "Downloading Java 17 JREs to ${JDKS_DIR}"
echo ""

# Using Eclipse Temurin (AdoptOpenJDK) Java 17 LTS distributions
# Latest version: 17.0.13+11 (as of October 2024)

# macOS Intel (x64)
echo "📦 Downloading macOS Intel (x64) JRE..."
curl -# -L -o "${JDKS_DIR}/jre-macos-x64.tar.gz" \
  "https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.13%2B11/OpenJDK17U-jre_x64_mac_hotspot_17.0.13_11.tar.gz"
mkdir -p "${JDKS_DIR}/jre-macos-x64"
tar -xzf "${JDKS_DIR}/jre-macos-x64.tar.gz" -C "${JDKS_DIR}/jre-macos-x64" --strip-components=1
rm "${JDKS_DIR}/jre-macos-x64.tar.gz"
echo "✅ macOS Intel JRE downloaded"
echo ""

# macOS Apple Silicon (ARM64)
echo "📦 Downloading macOS Apple Silicon (ARM64) JRE..."
curl -# -L -o "${JDKS_DIR}/jre-macos-arm64.tar.gz" \
  "https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.13%2B11/OpenJDK17U-jre_aarch64_mac_hotspot_17.0.13_11.tar.gz"
mkdir -p "${JDKS_DIR}/jre-macos-arm64"
tar -xzf "${JDKS_DIR}/jre-macos-arm64.tar.gz" -C "${JDKS_DIR}/jre-macos-arm64" --strip-components=1
rm "${JDKS_DIR}/jre-macos-arm64.tar.gz"
echo "✅ macOS Apple Silicon JRE downloaded"
echo ""

# Windows x64
echo "📦 Downloading Windows x64 JRE..."
curl -# -L -o "${JDKS_DIR}/jre-windows-x64.zip" \
  "https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.13%2B11/OpenJDK17U-jre_x64_windows_hotspot_17.0.13_11.zip"
mkdir -p "${JDKS_DIR}/jre-windows-x64"
unzip -q "${JDKS_DIR}/jre-windows-x64.zip" -d "${JDKS_DIR}/jre-windows-x64-temp"
# Move contents from subdirectory
if [ -d "${JDKS_DIR}/jre-windows-x64-temp/"*"-jre" ]; then
    mv "${JDKS_DIR}/jre-windows-x64-temp/"*"-jre"/* "${JDKS_DIR}/jre-windows-x64/"
    rm -rf "${JDKS_DIR}/jre-windows-x64-temp"
else
    mv "${JDKS_DIR}/jre-windows-x64-temp"/* "${JDKS_DIR}/jre-windows-x64/"
    rmdir "${JDKS_DIR}/jre-windows-x64-temp"
fi
rm "${JDKS_DIR}/jre-windows-x64.zip"
echo "✅ Windows x64 JRE downloaded"
echo ""

# Linux x64
echo "📦 Downloading Linux x64 JRE..."
curl -# -L -o "${JDKS_DIR}/jre-linux-x64.tar.gz" \
  "https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.13%2B11/OpenJDK17U-jre_x64_linux_hotspot_17.0.13_11.tar.gz"
mkdir -p "${JDKS_DIR}/jre-linux-x64"
tar -xzf "${JDKS_DIR}/jre-linux-x64.tar.gz" -C "${JDKS_DIR}/jre-linux-x64" --strip-components=1
rm "${JDKS_DIR}/jre-linux-x64.tar.gz"
echo "✅ Linux x64 JRE downloaded"
echo ""

# Linux ARM64 (for completeness)
echo "📦 Downloading Linux ARM64 JRE..."
curl -# -L -o "${JDKS_DIR}/jre-linux-arm64.tar.gz" \
  "https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.13%2B11/OpenJDK17U-jre_aarch64_linux_hotspot_17.0.13_11.tar.gz"
mkdir -p "${JDKS_DIR}/jre-linux-arm64"
tar -xzf "${JDKS_DIR}/jre-linux-arm64.tar.gz" -C "${JDKS_DIR}/jre-linux-arm64" --strip-components=1
rm "${JDKS_DIR}/jre-linux-arm64.tar.gz"
echo "✅ Linux ARM64 JRE downloaded"
echo ""

echo "🎉 All Java 17 JREs downloaded successfully!"
echo ""
echo "Directory structure:"
echo "${JDKS_DIR}/"
echo "├── jre-macos-x64/     (macOS Intel)"
echo "├── jre-macos-arm64/   (macOS Apple Silicon)"
echo "├── jre-windows-x64/   (Windows x64)"
echo "├── jre-linux-x64/     (Linux x64)"
echo "└── jre-linux-arm64/   (Linux ARM64)"
echo ""
echo "Total size: $(du -sh "${JDKS_DIR}" | cut -f1)"
