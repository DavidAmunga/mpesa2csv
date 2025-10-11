#!/bin/bash

# Script to create minimal JREs using jlink from full JDK downloads
# This creates platform-specific minimal runtimes optimized for running Tabula

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESOURCES_DIR="$(cd "${SCRIPT_DIR}/../resources" && pwd)"
JDKS_DIR="${RESOURCES_DIR}/jre"
TEMP_DIR="${RESOURCES_DIR}/temp-jdks"

# Create temp directory for full JDKs
mkdir -p "$TEMP_DIR"

echo "Creating minimal JREs using jlink..."
echo ""
echo "This will replace the full JREs with smaller, optimized runtimes."
echo ""

# Modules needed for running Tabula (PDF processing with Java)
# Based on common requirements for PDF processing libraries
MODULES="java.base,java.desktop,java.logging,java.naming,java.xml,java.sql,jdk.crypto.ec,jdk.localedata,jdk.zipfs"

echo "Using modules: ${MODULES}"
echo ""

# Download host JDK to use jlink tool (based on current platform)
HOST_OS=$(uname -s)
HOST_ARCH=$(uname -m)

if [[ "$HOST_OS" == "Darwin" ]]; then
    if [[ "$HOST_ARCH" == "arm64" ]]; then
        HOST_JDK_URL="https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.13%2B11/OpenJDK17U-jdk_aarch64_mac_hotspot_17.0.13_11.tar.gz"
        HOST_JDK_FILE="host-jdk.tar.gz"
    else
        HOST_JDK_URL="https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.13%2B11/OpenJDK17U-jdk_x64_mac_hotspot_17.0.13_11.tar.gz"
        HOST_JDK_FILE="host-jdk.tar.gz"
    fi
elif [[ "$HOST_OS" == "Linux" ]]; then
    if [[ "$HOST_ARCH" == "aarch64" ]]; then
        HOST_JDK_URL="https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.13%2B11/OpenJDK17U-jdk_aarch64_linux_hotspot_17.0.13_11.tar.gz"
        HOST_JDK_FILE="host-jdk.tar.gz"
    else
        HOST_JDK_URL="https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.13%2B11/OpenJDK17U-jdk_x64_linux_hotspot_17.0.13_11.tar.gz"
        HOST_JDK_FILE="host-jdk.tar.gz"
    fi
else
    echo "❌ Error: Unsupported platform: $HOST_OS"
    echo "This script currently supports macOS and Linux."
    echo "For Windows, please run this script in WSL or use a Linux/macOS machine."
    exit 1
fi

echo "📥 Downloading host JDK for jlink tool..."
curl -# -L -o "${TEMP_DIR}/${HOST_JDK_FILE}" "$HOST_JDK_URL"
mkdir -p "${TEMP_DIR}/host-jdk"
tar -xzf "${TEMP_DIR}/${HOST_JDK_FILE}" -C "${TEMP_DIR}/host-jdk" --strip-components=1
rm "${TEMP_DIR}/${HOST_JDK_FILE}"

# Determine jlink path based on host platform
if [[ "$HOST_OS" == "Darwin" ]]; then
    JLINK="${TEMP_DIR}/host-jdk/Contents/Home/bin/jlink"
else
    JLINK="${TEMP_DIR}/host-jdk/bin/jlink"
fi

echo "✅ Host JDK ready"
echo ""

# Function to download JDK and create minimal JRE
create_minimal_jre() {
    local platform=$1
    local arch=$2
    local jdk_url=$3
    local jdk_filename=$4
    local jdk_name=$5
    local output_dir=$6
    
    echo "📦 Processing ${platform} (${arch})..."
    
    # Download full JDK for its jmods
    echo "  Downloading JDK for jmods..."
    curl -# -L -o "${TEMP_DIR}/${jdk_filename}" "$jdk_url"
    
    # Extract JDK
    echo "  Extracting JDK..."
    if [[ "$jdk_filename" == *.tar.gz ]]; then
        mkdir -p "${TEMP_DIR}/${jdk_name}"
        tar -xzf "${TEMP_DIR}/${jdk_filename}" -C "${TEMP_DIR}/${jdk_name}" --strip-components=1
    elif [[ "$jdk_filename" == *.zip ]]; then
        unzip -q "${TEMP_DIR}/${jdk_filename}" -d "${TEMP_DIR}/${jdk_name}-temp"
        # Handle nested directory structure - find the actual JDK directory
        jdk_subdir=$(find "${TEMP_DIR}/${jdk_name}-temp" -maxdepth 1 -type d -name "*jdk*" -not -name "${jdk_name}-temp" | head -n 1)
        if [ -n "$jdk_subdir" ]; then
            # Move the JDK subdirectory to the final location
            mv "$jdk_subdir" "${TEMP_DIR}/${jdk_name}"
            rm -rf "${TEMP_DIR}/${jdk_name}-temp"
        else
            # No subdirectory, rename temp to final
            mv "${TEMP_DIR}/${jdk_name}-temp" "${TEMP_DIR}/${jdk_name}"
        fi
    fi
    
    # Determine module path based on target platform
    local module_path
    if [[ "$platform" == "macos"* ]]; then
        module_path="${TEMP_DIR}/${jdk_name}/Contents/Home/jmods"
    else
        module_path="${TEMP_DIR}/${jdk_name}/jmods"
    fi
    
    # Create minimal JRE using host's jlink with target platform's jmods
    echo "  Creating minimal JRE with jlink..."
    rm -rf "$output_dir"
    mkdir -p "$(dirname "$output_dir")"
    
    "$JLINK" \
        --module-path "$module_path" \
        --add-modules "$MODULES" \
        --output "$output_dir" \
        --strip-debug \
        --no-man-pages \
        --no-header-files \
        --compress=2
    
    # Clean up
    rm -rf "${TEMP_DIR}/${jdk_name}"
    rm -f "${TEMP_DIR}/${jdk_filename}"
    
    # Get size
    local size=$(du -sh "$output_dir" | cut -f1)
    echo "  ✅ Created minimal JRE (${size})"
    echo ""
}

# macOS Intel (x64)
create_minimal_jre \
    "macos" \
    "x64" \
    "https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.13%2B11/OpenJDK17U-jdk_x64_mac_hotspot_17.0.13_11.tar.gz" \
    "macos-x64-jdk.tar.gz" \
    "macos-x64-jdk" \
    "${JDKS_DIR}/jre-macos-x64"

# macOS Apple Silicon (ARM64)
create_minimal_jre \
    "macos" \
    "arm64" \
    "https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.13%2B11/OpenJDK17U-jdk_aarch64_mac_hotspot_17.0.13_11.tar.gz" \
    "macos-arm64-jdk.tar.gz" \
    "macos-arm64-jdk" \
    "${JDKS_DIR}/jre-macos-arm64"

# Windows x64
create_minimal_jre \
    "windows" \
    "x64" \
    "https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.13%2B11/OpenJDK17U-jdk_x64_windows_hotspot_17.0.13_11.zip" \
    "windows-x64-jdk.zip" \
    "windows-x64-jdk" \
    "${JDKS_DIR}/jre-windows-x64"

# Linux x64
create_minimal_jre \
    "linux" \
    "x64" \
    "https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.13%2B11/OpenJDK17U-jdk_x64_linux_hotspot_17.0.13_11.tar.gz" \
    "linux-x64-jdk.tar.gz" \
    "linux-x64-jdk" \
    "${JDKS_DIR}/jre-linux-x64"

# Linux ARM64
create_minimal_jre \
    "linux" \
    "arm64" \
    "https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.13%2B11/OpenJDK17U-jdk_aarch64_linux_hotspot_17.0.13_11.tar.gz" \
    "linux-arm64-jdk.tar.gz" \
    "linux-arm64-jdk" \
    "${JDKS_DIR}/jre-linux-arm64"

# Clean up temp directory
rm -rf "$TEMP_DIR"

echo "🎉 All minimal JREs created successfully!"
echo ""
echo "Directory structure:"
echo "${JDKS_DIR}/"
echo "├── macos-x64/     (macOS Intel)"
echo "├── macos-arm64/   (macOS Apple Silicon)"
echo "├── windows-x64/   (Windows x64)"
echo "├── linux-x64/     (Linux x64)"
echo "└── linux-arm64/   (Linux ARM64)"
echo ""
echo "Total size: $(du -sh "${JDKS_DIR}" | cut -f1)"
echo ""
echo "Size comparison:"
echo "  Before (full JREs):  ~635M"
echo "  After (minimal):     $(du -sh "${JDKS_DIR}" | cut -f1)"
echo ""
echo "Modules included: ${MODULES}"
