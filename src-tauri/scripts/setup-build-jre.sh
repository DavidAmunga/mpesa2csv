#!/bin/bash

# Combined script to download and setup platform-specific JRE for Tauri builds
# This script:
# 1. Detects the target platform
# 2. Downloads only the required JRE
# 3. Creates a minimal JRE using jlink (or uses the full JRE as fallback)
# 4. Places it directly in build-jre/ ready for bundling

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color


# Function to print colored messages
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Get directories
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
TAURI_DIR="$(dirname "$SCRIPT_DIR")"
RESOURCES_DIR="$TAURI_DIR/resources"
BUILD_JRE_DIR="$RESOURCES_DIR/build-jre"
TEMP_DOWNLOAD_DIR="$RESOURCES_DIR/.temp-jre-download"

# JRE version configuration
JRE_VERSION="17.0.13"
JRE_BUILD="11"
FULL_VERSION="jdk-${JRE_VERSION}%2B${JRE_BUILD}"

# Detect platform and architecture
detect_platform() {
    local OS=$(uname -s)
    local ARCH=$(uname -m)
    
    print_info "Detecting platform: OS=$OS, ARCH=$ARCH" >&2
    
    # Allow override via environment variable for cross-compilation
    if [ -n "$TARGET_PLATFORM" ]; then
        print_info "Using TARGET_PLATFORM override: $TARGET_PLATFORM" >&2
        echo "$TARGET_PLATFORM"
        return
    fi
    
    case "$OS" in
        Darwin)
            case "$ARCH" in
                arm64|aarch64)
                    echo "jre-macos-arm64"
                    ;;
                x86_64)
                    echo "jre-macos-x64"
                    ;;
                *)
                    print_error "Unsupported macOS architecture: $ARCH" >&2
                    exit 1
                    ;;
            esac
            ;;
        Linux)
            case "$ARCH" in
                x86_64|amd64)
                    echo "jre-linux-x64"
                    ;;
                aarch64|arm64)
                    echo "jre-linux-arm64"
                    ;;
                *)
                    print_error "Unsupported Linux architecture: $ARCH" >&2
                    exit 1
                    ;;
            esac
            ;;
        MINGW*|MSYS*|CYGWIN*|Windows_NT)
            case "$ARCH" in
                x86_64|amd64|AMD64)
                    echo "jre-windows-x64"
                    ;;
                *)
                    print_error "Unsupported Windows architecture: $ARCH" >&2
                    exit 1
                    ;;
            esac
            ;;
        *)
            print_error "Unsupported operating system: $OS" >&2
            exit 1
            ;;
    esac
}

# Get download URL and filename for platform
get_download_info() {
    local PLATFORM=$1
    
    case "$PLATFORM" in
        jre-macos-x64)
            echo "https://github.com/adoptium/temurin17-binaries/releases/download/${FULL_VERSION}/OpenJDK17U-jre_x64_mac_hotspot_${JRE_VERSION}_${JRE_BUILD}.tar.gz|tar.gz"
            ;;
        jre-macos-arm64)
            echo "https://github.com/adoptium/temurin17-binaries/releases/download/${FULL_VERSION}/OpenJDK17U-jre_aarch64_mac_hotspot_${JRE_VERSION}_${JRE_BUILD}.tar.gz|tar.gz"
            ;;
        jre-windows-x64)
            echo "https://github.com/adoptium/temurin17-binaries/releases/download/${FULL_VERSION}/OpenJDK17U-jre_x64_windows_hotspot_${JRE_VERSION}_${JRE_BUILD}.zip|zip"
            ;;
        jre-linux-x64)
            echo "https://github.com/adoptium/temurin17-binaries/releases/download/${FULL_VERSION}/OpenJDK17U-jre_x64_linux_hotspot_${JRE_VERSION}_${JRE_BUILD}.tar.gz|tar.gz"
            ;;
        jre-linux-arm64)
            echo "https://github.com/adoptium/temurin17-binaries/releases/download/${FULL_VERSION}/OpenJDK17U-jre_aarch64_linux_hotspot_${JRE_VERSION}_${JRE_BUILD}.tar.gz|tar.gz"
            ;;
        *)
            print_error "Unknown platform: $PLATFORM"
            exit 1
            ;;
    esac
}

# Download and extract JRE
download_jre() {
    local PLATFORM=$1
    local DOWNLOAD_INFO=$(get_download_info "$PLATFORM")
    local URL=$(echo "$DOWNLOAD_INFO" | cut -d'|' -f1)
    local EXT=$(echo "$DOWNLOAD_INFO" | cut -d'|' -f2)
    local ARCHIVE_FILE="$TEMP_DOWNLOAD_DIR/${PLATFORM}.${EXT}"
    local EXTRACT_DIR="$TEMP_DOWNLOAD_DIR/$PLATFORM"
    
    print_info "Downloading $PLATFORM JRE..." >&2
    print_info "URL: $URL" >&2
    
    # Create temp directory
    mkdir -p "$TEMP_DOWNLOAD_DIR"
    
    # Download with progress
    if ! curl -# -L -o "$ARCHIVE_FILE" "$URL"; then
        print_error "Failed to download JRE" >&2
        exit 1
    fi
    
    print_success "Download complete" >&2
    print_info "Extracting JRE..." >&2
    
    mkdir -p "$EXTRACT_DIR"
    
    # Extract based on file type
    if [ "$EXT" = "tar.gz" ]; then
        tar -xzf "$ARCHIVE_FILE" -C "$EXTRACT_DIR" --strip-components=1
    elif [ "$EXT" = "zip" ]; then
        unzip -q "$ARCHIVE_FILE" -d "${EXTRACT_DIR}-temp"
        # Move contents from subdirectory
        if [ -d "${EXTRACT_DIR}-temp/"*"-jre" ]; then
            mv "${EXTRACT_DIR}-temp/"*"-jre"/* "$EXTRACT_DIR/"
            rm -rf "${EXTRACT_DIR}-temp"
        else
            mv "${EXTRACT_DIR}-temp"/* "$EXTRACT_DIR/"
            rmdir "${EXTRACT_DIR}-temp"
        fi
    fi
    
    # Clean up archive
    rm "$ARCHIVE_FILE"
    
    find "$EXTRACT_DIR" -type f -exec chmod 644 {} \; 2>/dev/null || true
    find "$EXTRACT_DIR" -type d -exec chmod 755 {} \; 2>/dev/null || true
    
    print_success "JRE extracted successfully" >&2
    echo "$EXTRACT_DIR"
}

# Create minimal JRE using jlink
create_minimal_jre() {
    local SOURCE_JRE=$1
    local OUTPUT_DIR=$2
    
    # Modules required for Tabula PDF processing
    # java.base - Core Java functionality
    # java.sql - SQL support (required by Tabula)
    local MODULES="java.base,java.sql"
    
    print_info "Creating minimal JRE with modules: $MODULES" >&2
    
    # Find jlink in the downloaded JRE first
    local JLINK_CMD=""
    
    # Check if downloaded JRE has jlink (it won't, as it's a JRE not JDK)
    # So we need to use system JDK's jlink
    
    if command -v jlink >/dev/null 2>&1; then
        JLINK_CMD="jlink"
    elif [ -f "/usr/libexec/java_home" ]; then
        # macOS specific
        local JAVA_HOME=$(/usr/libexec/java_home 2>/dev/null || echo "")
        if [ -n "$JAVA_HOME" ] && [ -f "$JAVA_HOME/bin/jlink" ]; then
            JLINK_CMD="$JAVA_HOME/bin/jlink"
        fi
    elif [ -n "$JAVA_HOME" ] && [ -f "$JAVA_HOME/bin/jlink" ]; then
        JLINK_CMD="$JAVA_HOME/bin/jlink"
    fi
    
    if [ -z "$JLINK_CMD" ]; then
        print_warning "jlink not found. Will use full JRE instead." >&2
        print_warning "To create minimal JRE, install JDK 11+ or set JAVA_HOME" >&2
        return 1
    fi
    
    print_info "Using jlink: $JLINK_CMD" >&2
    
    # Use system JDK modules to create minimal JRE
    # We don't need modules from the downloaded JRE - we'll create a fresh minimal runtime
    print_info "Creating minimal JRE from system JDK modules" >&2
    
    # Create minimal JRE using system JDK
    if "$JLINK_CMD" \
        --add-modules "$MODULES" \
        --strip-debug \
        --no-man-pages \
        --no-header-files \
        --compress=2 \
        --output "$OUTPUT_DIR" 2>&1 | grep -v "Warning" || [ ${PIPESTATUS[0]} -eq 0 ]; then
        
        if [ -d "$OUTPUT_DIR" ]; then
            find "$OUTPUT_DIR" -type f -exec chmod 644 {} \; 2>/dev/null || true
            find "$OUTPUT_DIR" -type d -exec chmod 755 {} \; 2>/dev/null || true
            
            local SIZE=$(du -sh "$OUTPUT_DIR" | cut -f1)
            print_success "Minimal JRE created successfully (Size: $SIZE)" >&2
            return 0
        fi
    fi
    
    print_warning "Failed to create minimal JRE with jlink" >&2
    return 1
}

# Copy full JRE as fallback
copy_full_jre() {
    local SOURCE_JRE=$1
    local OUTPUT_DIR=$2
    
    print_info "Copying full JRE to build directory..." >&2
    
    cp -r "$SOURCE_JRE" "$OUTPUT_DIR"
    
    find "$OUTPUT_DIR" -type f -exec chmod 644 {} \; 2>/dev/null || true
    find "$OUTPUT_DIR" -type d -exec chmod 755 {} \; 2>/dev/null || true
    
    local SIZE=$(du -sh "$OUTPUT_DIR" | cut -f1)
    print_success "Full JRE copied successfully (Size: $SIZE)" >&2
}

# Set executable permissions
set_java_permissions() {
    local JRE_PATH=$1
    
    print_info "Setting permissions on JRE files..." >&2
    
    find "$JRE_PATH" -type f -exec chmod 644 {} \; 2>/dev/null || true
    find "$JRE_PATH" -type d -exec chmod 755 {} \; 2>/dev/null || true
    
    # Try multiple possible locations for Java binary
    local POSSIBLE_PATHS=(
        "$JRE_PATH/bin/java"                          # jlink structure & Linux/Windows
        "$JRE_PATH/Contents/Home/bin/java"            # Full macOS JRE structure
    )
    
    for path in "${POSSIBLE_PATHS[@]}"; do
        if [ -f "$path" ]; then
            chmod 755 "$path"
            print_success "Set executable permission for: $path" >&2
            find "$(dirname "$path")" -type f -exec chmod 755 {} \; 2>/dev/null || true
            return 0
        fi
    done
    
    print_warning "Java binary not found in expected locations" >&2
    return 1
}

# Verify JRE works
verify_jre() {
    local JRE_PATH=$1
    
    print_info "Verifying JRE installation..." >&2
    
    # Find java executable
    local JAVA_BIN=""
    if [ -f "$JRE_PATH/bin/java" ]; then
        JAVA_BIN="$JRE_PATH/bin/java"
    elif [ -f "$JRE_PATH/Contents/Home/bin/java" ]; then
        JAVA_BIN="$JRE_PATH/Contents/Home/bin/java"
    fi
    
    if [ -n "$JAVA_BIN" ] && [ -f "$JAVA_BIN" ]; then
        chmod +x "$JAVA_BIN"
        
        # Test Java version
        if "$JAVA_BIN" -version 2>&1 | head -1 | grep -q "openjdk"; then
            print_success "JRE verified successfully" >&2
            "$JAVA_BIN" -version 2>&1 | head -3 >&2
            
            # List modules if available
            if "$JAVA_BIN" --list-modules >/dev/null 2>&1; then
                print_info "Installed modules:" >&2
                "$JAVA_BIN" --list-modules 2>/dev/null | head -10 >&2 || true
            fi
            return 0
        else
            print_warning "Could not verify JRE" >&2
            return 1
        fi
    else
        print_error "Java executable not found" >&2
        return 1
    fi
}

# Clean up temp directory
cleanup_temp() {
    if [ -d "$TEMP_DOWNLOAD_DIR" ]; then
        print_info "Cleaning up temporary files..." >&2
        rm -rf "$TEMP_DOWNLOAD_DIR"
        print_success "Cleanup complete" >&2
    fi
}

# Clean up build JRE directory
cleanup_build_jre() {
    if [ -d "$BUILD_JRE_DIR" ]; then
        print_info "Cleaning up existing build JRE directory..." >&2
        rm -rf "$BUILD_JRE_DIR"
        print_success "Build directory cleaned" >&2
    fi
}

# Main execution
main() {
    print_info "==========================================" >&2
    print_info "Platform-Specific JRE Setup for Tauri" >&2
    print_info "==========================================" >&2
    echo "" >&2
    
    # Detect platform
    PLATFORM_JRE=$(detect_platform)
    print_success "Target platform: $PLATFORM_JRE" >&2
    echo "" >&2
    
    # Check if we should skip download (JRE already exists)
    local FORCE_DOWNLOAD="${FORCE_DOWNLOAD:-false}"
    local FINAL_JRE_PATH="$BUILD_JRE_DIR/$PLATFORM_JRE"
    
    if [ -d "$FINAL_JRE_PATH" ] && [ "$FORCE_DOWNLOAD" != "true" ]; then
        print_info "JRE already exists at: $FINAL_JRE_PATH" >&2
        print_info "Verifying existing JRE..." >&2
        
        if verify_jre "$FINAL_JRE_PATH"; then
            print_success "==========================================" >&2
            print_success "Using existing JRE" >&2
            print_success "Location: $FINAL_JRE_PATH" >&2
            print_success "==========================================" >&2
            echo "" >&2
            print_info "To force re-download, run: FORCE_DOWNLOAD=true $0" >&2
            echo "" >&2
            return 0
        else
            print_warning "Existing JRE verification failed, will re-download" >&2
        fi
    fi
    
    # Clean up existing build directory
    cleanup_build_jre
    
    # Trap to ensure cleanup on exit
    trap cleanup_temp EXIT
    
    # Create build directory
    mkdir -p "$BUILD_JRE_DIR"
    
    local USE_MINIMAL="${USE_MINIMAL_JRE:-true}"
    local CREATED_MINIMAL=false
    local DOWNLOADED_JRE=""
    
    # Try to create minimal JRE first (doesn't require download)
    if [ "$USE_MINIMAL" = "true" ]; then
        print_info "Step 1/2: Creating optimized minimal JRE" >&2
        echo "" >&2
        
        if create_minimal_jre "$DOWNLOADED_JRE" "$FINAL_JRE_PATH"; then
            CREATED_MINIMAL=true
        else
            print_warning "Cannot create minimal JRE, will download full JRE instead" >&2
            echo "" >&2
            
            print_info "Step 1/2: Downloading full JRE" >&2
            echo "" >&2
            DOWNLOADED_JRE=$(download_jre "$PLATFORM_JRE")
            echo "" >&2
            
            print_info "Step 2/2: Installing full JRE" >&2
            echo "" >&2
            copy_full_jre "$DOWNLOADED_JRE" "$FINAL_JRE_PATH"
        fi
    else
        print_info "USE_MINIMAL_JRE=false, downloading full JRE" >&2
        print_info "Step 1/2: Downloading full JRE" >&2
        echo "" >&2
        DOWNLOADED_JRE=$(download_jre "$PLATFORM_JRE")
        echo "" >&2
        
        print_info "Step 2/2: Installing full JRE" >&2
        echo "" >&2
        copy_full_jre "$DOWNLOADED_JRE" "$FINAL_JRE_PATH"
    fi
    echo "" >&2
    
    # Set permissions and verify
    print_info "Final step: Setting permissions and verifying" >&2
    echo "" >&2
    set_java_permissions "$FINAL_JRE_PATH"
    verify_jre "$FINAL_JRE_PATH"
    echo "" >&2
    
    # Get final size
    local FINAL_SIZE=$(du -sh "$FINAL_JRE_PATH" | cut -f1)
    
    # Success message
    print_success "==========================================" >&2
    print_success "JRE setup complete!" >&2
    print_success "==========================================" >&2
    print_info "Platform:    $PLATFORM_JRE" >&2
    print_info "Location:    $FINAL_JRE_PATH" >&2
    print_info "Size:        $FINAL_SIZE" >&2
    if [ "$CREATED_MINIMAL" = "true" ]; then
        print_info "Type:        Minimal JRE (optimized)" >&2
    else
        print_info "Type:        Full JRE" >&2
    fi
    print_success "==========================================" >&2
    echo "" >&2
    
    # Configure JRE for Linux AppImage bundling
    if [[ "$PLATFORM_JRE" == "jre-linux-"* ]]; then
        configure_linux_jre_bundling "$FINAL_JRE_PATH"
    fi
    
    print_info "You can now run: pnpm tauri build" >&2
    echo "" >&2
}

# Configure JRE for Linux AppImage bundling
# This helps linuxdeploy find libjvm.so and other JRE dependencies
configure_linux_jre_bundling() {
    local JRE_PATH=$1
    
    echo "" >&2
    print_info "==========================================" >&2
    print_info "Configuring JRE for Linux AppImage bundling..." >&2
    print_info "==========================================" >&2
    
    # Find the lib directory
    local LIB_DIR="$JRE_PATH/lib"
    
    if [ ! -d "$LIB_DIR" ]; then
        print_warning "lib directory not found at $LIB_DIR" >&2
        print_warning "Skipping Linux bundling configuration..." >&2
        return 0
    fi
    
    # Check if libjvm.so exists in server subdirectory
    local LIBJVM_SERVER="$LIB_DIR/server/libjvm.so"
    
    if [ ! -f "$LIBJVM_SERVER" ]; then
        print_info "libjvm.so not in server/ subdirectory, checking other locations..." >&2
        local LIBJVM_PATH=$(find "$JRE_PATH" -name "libjvm.so" -type f 2>/dev/null | head -1)
        if [ -z "$LIBJVM_PATH" ]; then
            print_warning "Could not find libjvm.so in JRE directory" >&2
            print_warning "AppImage bundling may fail. Consider using full JRE instead." >&2
            return 0
        fi
        LIBJVM_SERVER="$LIBJVM_PATH"
        print_info "Found libjvm.so at: $LIBJVM_SERVER" >&2
    fi
    
    # Create symlinks to help linuxdeploy find libraries
    # linuxdeploy searches in lib/ but not lib/server/, so we create symlinks
    print_info "Creating symlinks for linuxdeploy compatibility..." >&2
    
    if [ -d "$LIB_DIR/server" ] && [ ! -f "$LIB_DIR/libjvm.so" ]; then
        ln -sf "server/libjvm.so" "$LIB_DIR/libjvm.so" 2>/dev/null || true
        print_success "Created symlink: lib/libjvm.so -> server/libjvm.so" >&2
    fi
    
    # Create symlinks for other server libraries
    if [ -d "$LIB_DIR/server" ]; then
        local SYMLINK_COUNT=0
        for lib in "$LIB_DIR/server/"*.so*; do
            if [ -f "$lib" ]; then
                local libname=$(basename "$lib")
                if [ ! -e "$LIB_DIR/$libname" ]; then
                    ln -sf "server/$libname" "$LIB_DIR/$libname" 2>/dev/null || true
                    SYMLINK_COUNT=$((SYMLINK_COUNT + 1))
                fi
            fi
        done
        if [ $SYMLINK_COUNT -gt 0 ]; then
            print_success "Created $SYMLINK_COUNT additional symlinks" >&2
        fi
    fi
    
    # Configure RPATH for better dependency resolution
    if command -v patchelf >/dev/null 2>&1; then
        print_info "Configuring RPATH for JRE libraries..." >&2
        
        # Set RPATH for libjvm.so
        if [ -f "$LIBJVM_SERVER" ]; then
            patchelf --set-rpath '$ORIGIN:$ORIGIN/..:$ORIGIN/../lib' "$LIBJVM_SERVER" 2>/dev/null || true
        fi
        
        # Configure RPATH for other libraries in server directory
        if [ -d "$LIB_DIR/server" ]; then
            for lib in "$LIB_DIR/server/"*.so*; do
                if [ -f "$lib" ]; then
                    patchelf --set-rpath '$ORIGIN:$ORIGIN/..:$ORIGIN/../lib' "$lib" 2>/dev/null || true
                fi
            done
        fi
        
        print_success "RPATH configuration complete" >&2
    else
        print_info "patchelf not available, skipping RPATH configuration" >&2
    fi
    
    print_success "==========================================" >&2
    print_success "Linux AppImage bundling configuration complete!" >&2
    print_success "==========================================" >&2
    echo "" >&2
}

# Run main function
main "$@"

