#!/bin/bash

# Post-build script to rename Android APK and AAB files with custom naming
# Usage: ./rename-android-builds.sh

set -e

echo "🏷️ Renaming Android build files..."

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")
APP_NAME="mpesa2csv"

# Navigate to Android build directory
cd src-tauri/gen/android/app/build/outputs

echo "📱 Processing APK files..."
# Rename APK files
if [ -d "apk" ]; then
    find apk -name "*.apk" -type f | while read apk_file; do
        dir=$(dirname "$apk_file")
        filename=$(basename "$apk_file")
        
        # Extract variant info from path and filename
        if [[ "$apk_file" == *"release"* ]]; then
            variant="release"
        elif [[ "$apk_file" == *"debug"* ]]; then
            variant="debug"
        else
            variant="unknown"
        fi
        
        # Extract architecture/type info
        if [[ "$apk_file" == *"universal"* ]]; then
            arch="universal"
        elif [[ "$apk_file" == *"arm64"* ]]; then
            arch="arm64"
        elif [[ "$apk_file" == *"x86"* ]]; then
            arch="x86"
        else
            arch="universal"
        fi
        
        # Create new filename
        new_filename="${APP_NAME}-v${VERSION}-${arch}-${variant}.apk"
        new_path="${dir}/${new_filename}"
        
        # Rename the file
        if [ "$apk_file" != "$new_path" ]; then
            mv "$apk_file" "$new_path"
            echo "✅ Renamed: $(basename "$apk_file") → $new_filename"
            
            # Copy to root directory for easy access
            cp "$new_path" "../../../../../$new_filename"
            echo "📋 Copied to root: $new_filename"
        fi
    done
fi

echo "📦 Processing AAB files..."
# Rename AAB files
if [ -d "bundle" ]; then
    find bundle -name "*.aab" -type f | while read aab_file; do
        dir=$(dirname "$aab_file")
        filename=$(basename "$aab_file")
        
        # Extract variant info from path
        if [[ "$aab_file" == *"Release"* ]]; then
            variant="release"
        elif [[ "$aab_file" == *"Debug"* ]]; then
            variant="debug"
        else
            variant="release"
        fi
        
        # Extract architecture/type info
        if [[ "$aab_file" == *"universal"* ]]; then
            arch="universal"
        else
            arch="universal"
        fi
        
        # Create new filename
        new_filename="${APP_NAME}-v${VERSION}-${arch}-${variant}.aab"
        new_path="${dir}/${new_filename}"
        
        # Rename the file
        if [ "$aab_file" != "$new_path" ]; then
            mv "$aab_file" "$new_path"
            echo "✅ Renamed: $(basename "$aab_file") → $new_filename"
            
            # Copy to root directory for easy access
            cp "$new_path" "../../../../../$new_filename"
            echo "📋 Copied to root: $new_filename"
        fi
    done
fi

echo ""
echo "🎉 Android build renaming complete!"
echo ""
echo "📁 Files available in root directory:"
ls -la ../../../../../*.apk ../../../../../*.aab 2>/dev/null || echo "No renamed files found in root"
