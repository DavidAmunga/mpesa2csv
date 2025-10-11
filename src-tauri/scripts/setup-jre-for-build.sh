#!/bin/bash

# Script to copy platform-specific JRE for Tauri builds
# This ensures only the required JRE is bundled with each platform build

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

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
TAURI_DIR="$(dirname "$SCRIPT_DIR")"
RESOURCES_DIR="$TAURI_DIR/resources"
JRE_SOURCE_DIR="$RESOURCES_DIR/jre"
BUILD_JRE_DIR="$RESOURCES_DIR/build-jre"

print_info "Starting JRE setup for platform-specific build..."
print_info "Script directory: $SCRIPT_DIR"
print_info "Tauri directory: $TAURI_DIR"
print_info "Resources directory: $RESOURCES_DIR"

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

# Clean up existing build JRE directory
cleanup_build_jre() {
    if [ -d "$BUILD_JRE_DIR" ]; then
        print_info "Cleaning up existing build JRE directory..."
        rm -rf "$BUILD_JRE_DIR"
        print_success "Cleanup complete"
    fi
}

# Create minimal JRE using jlink
create_minimal_jre() {
    local PLATFORM_JRE=$1
    local OUTPUT_PATH="$BUILD_JRE_DIR/$PLATFORM_JRE"
    
    # Modules required for Tabula PDF processing
    # java.base - Core Java functionality
    # java.sql - SQL support (required by Tabula)
    # java.desktop - AWT/Swing for PDF rendering
    # java.logging - Logging support
    # java.xml - XML processing
    # java.naming - JNDI support
    local MODULES="java.base,java.sql"
    
    print_info "Creating minimal JRE with modules: $MODULES"
    
    # Find a suitable JDK to use jlink from
    local JLINK_CMD=""
    
    # Try to find jlink in common locations
    if command -v jlink >/dev/null 2>&1; then
        JLINK_CMD="jlink"
    elif [ -f "/usr/libexec/java_home" ]; then
        # macOS specific
        local JAVA_HOME=$(/usr/libexec/java_home 2>/dev/null)
        if [ -n "$JAVA_HOME" ] && [ -f "$JAVA_HOME/bin/jlink" ]; then
            JLINK_CMD="$JAVA_HOME/bin/jlink"
        fi
    elif [ -n "$JAVA_HOME" ] && [ -f "$JAVA_HOME/bin/jlink" ]; then
        JLINK_CMD="$JAVA_HOME/bin/jlink"
    fi
    
    if [ -z "$JLINK_CMD" ]; then
        print_warning "jlink not found. Cannot create minimal JRE."
        print_warning "Please install JDK 11+ or ensure JAVA_HOME is set."
        return 1
    fi
    
    print_info "Using jlink: $JLINK_CMD"
    
    # Create minimal JRE with required modules for Tabula
    "$JLINK_CMD" \
        --add-modules "$MODULES" \
        --strip-debug \
        --no-man-pages \
        --no-header-files \
        --compress=2 \
        --output "$OUTPUT_PATH" 2>&1 | grep -v "Warning" || true
    
    if [ $? -eq 0 ] && [ -d "$OUTPUT_PATH" ]; then
        local SIZE=$(du -sh "$OUTPUT_PATH" | cut -f1)
        print_success "Minimal JRE created successfully (Size: $SIZE)"
        return 0
    else
        print_warning "Failed to create minimal JRE with jlink"
        return 1
    fi
}

# Copy platform-specific JRE
copy_platform_jre() {
    local PLATFORM_JRE=$1
    local SOURCE_PATH="$JRE_SOURCE_DIR/$PLATFORM_JRE"
    
    print_info "Selected JRE: $PLATFORM_JRE"
    
    # Check if we should create a minimal JRE instead of copying
    if [ "$CREATE_MINIMAL_JRE" = "true" ] || [ ! -d "$SOURCE_PATH" ]; then
        if [ ! -d "$SOURCE_PATH" ]; then
            print_warning "Source JRE not found at: $SOURCE_PATH"
            print_info "Attempting to create minimal JRE instead..."
        else
            print_info "CREATE_MINIMAL_JRE flag set, creating minimal JRE..."
        fi
        
        mkdir -p "$BUILD_JRE_DIR"
        
        if create_minimal_jre "$PLATFORM_JRE"; then
            return 0
        else
            if [ ! -d "$SOURCE_PATH" ]; then
                print_error "Cannot create minimal JRE and source JRE not found"
                print_error "Available JREs:"
                ls -la "$JRE_SOURCE_DIR" 2>/dev/null || print_error "JRE source directory not found"
                exit 1
            fi
            print_warning "Falling back to copying existing JRE..."
        fi
    fi
    
    # Copy existing JRE
    if [ ! -d "$SOURCE_PATH" ]; then
        print_error "JRE not found at: $SOURCE_PATH"
        print_error "Available JREs:"
        ls -la "$JRE_SOURCE_DIR" 2>/dev/null || print_error "JRE source directory not found"
        exit 1
    fi
    
    print_info "Creating build JRE directory at: $BUILD_JRE_DIR"
    mkdir -p "$BUILD_JRE_DIR"
    
    print_info "Copying JRE from $SOURCE_PATH to $BUILD_JRE_DIR/$PLATFORM_JRE..."
    cp -r "$SOURCE_PATH" "$BUILD_JRE_DIR/"
    
    # Verify the copy
    if [ -d "$BUILD_JRE_DIR/$PLATFORM_JRE" ]; then
        local SIZE=$(du -sh "$BUILD_JRE_DIR/$PLATFORM_JRE" | cut -f1)
        print_success "JRE copied successfully (Size: $SIZE)"
        
        # List the contents for verification
        print_info "JRE contents:"
        ls -la "$BUILD_JRE_DIR/$PLATFORM_JRE" | head -10
    else
        print_error "Failed to copy JRE"
        exit 1
    fi
}

# Verify JRE is minimal (has only required modules)
verify_minimal_jre() {
    local PLATFORM_JRE=$1
    local JRE_PATH="$BUILD_JRE_DIR/$PLATFORM_JRE"
    
    print_info "Verifying JRE modules..."
    
    # Find java executable
    local JAVA_BIN=""
    if [ -f "$JRE_PATH/bin/java" ]; then
        JAVA_BIN="$JRE_PATH/bin/java"
    elif [ -f "$JRE_PATH/Contents/Home/bin/java" ]; then
        JAVA_BIN="$JRE_PATH/Contents/Home/bin/java"
    fi
    
    if [ -n "$JAVA_BIN" ] && [ -f "$JAVA_BIN" ]; then
        chmod +x "$JAVA_BIN"
        
        # List modules
        local MODULES=$("$JAVA_BIN" --list-modules 2>/dev/null | grep -E "^(java\.base|java\.sql|java\.desktop)" | wc -l)
        
        if [ "$MODULES" -ge 3 ]; then
            print_success "JRE has required modules for Tabula"
            
            # Show all modules for transparency
            print_info "Installed modules:"
            "$JAVA_BIN" --list-modules 2>/dev/null | head -10 || true
        else
            print_warning "Could not verify JRE modules"
        fi
    else
        print_warning "Java executable not found for verification"
    fi
}

# Set executable permissions for Java binary (important for macOS and Linux)
set_java_permissions() {
    local PLATFORM_JRE=$1
    local JRE_PATH="$BUILD_JRE_DIR/$PLATFORM_JRE"
    
    print_info "Setting executable permissions for Java binary..."
    
    # Try multiple possible locations for Java binary
    local JAVA_BIN=""
    local POSSIBLE_PATHS=(
        "$JRE_PATH/bin/java"                          # jlink structure & Linux/Windows
        "$JRE_PATH/Contents/Home/bin/java"            # Full macOS JRE structure
    )
    
    for path in "${POSSIBLE_PATHS[@]}"; do
        if [ -f "$path" ]; then
            JAVA_BIN="$path"
            break
        fi
    done
    
    if [ -n "$JAVA_BIN" ] && [ -f "$JAVA_BIN" ]; then
        chmod +x "$JAVA_BIN"
        print_success "Set executable permission for: $JAVA_BIN"
        
        # Also set permissions for other binaries in the bin directory
        chmod +x "$(dirname "$JAVA_BIN")"/* 2>/dev/null || true
    else
        print_warning "Java binary not found in expected locations"
    fi
}

# Main execution
main() {
    print_info "=========================================="
    print_info "Platform-Specific JRE Setup for Tauri"
    print_info "=========================================="
    
    # Check for CREATE_MINIMAL_JRE environment variable (default: true)
    if [ -z "$CREATE_MINIMAL_JRE" ]; then
        CREATE_MINIMAL_JRE="true"
    fi
    
    if [ "$CREATE_MINIMAL_JRE" = "true" ]; then
        print_info "Minimal JRE creation enabled (optimized for Tabula PDF processing)"
    fi
    
    # Create JRE source directory if it doesn't exist
    if [ ! -d "$JRE_SOURCE_DIR" ]; then
        print_warning "JRE source directory not found: $JRE_SOURCE_DIR"
        mkdir -p "$JRE_SOURCE_DIR"
        print_info "Created JRE source directory"
    fi
    
    # Detect platform
    PLATFORM_JRE=$(detect_platform)
    
    # Clean up any existing build JRE
    cleanup_build_jre
    
    # Copy or create the platform-specific JRE
    copy_platform_jre "$PLATFORM_JRE"
    
    # Set executable permissions
    set_java_permissions "$PLATFORM_JRE"
    
    # Verify the JRE is minimal
    verify_minimal_jre "$PLATFORM_JRE"
    
    print_success "=========================================="
    print_success "JRE setup complete!"
    print_success "Platform: $PLATFORM_JRE"
    print_success "Location: $BUILD_JRE_DIR/$PLATFORM_JRE"
    print_success "=========================================="
    print_info ""
    print_info "You can now run: pnpm tauri build"
    print_info ""
}

# Run main function
main "$@"

