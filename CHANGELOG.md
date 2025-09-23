# mpesa2csv

## 0.1.6

### Patch Changes

- 3852f85: fix:test release process

## 0.1.5

### Patch Changes

- 5b20030: Fix release process with proper git tagging and GitHub release creation

  - Add automatic git tag creation in changeset workflow
  - Improve GitHub release descriptions with changelog content
  - Fix version synchronization between package.json and tauri.conf.json
  - Add comprehensive release documentation and helper scripts

## 0.1.4

### Patch Changes

- 72d7dc4: fix: release process

## 0.1.3

### Patch Changes

- 4416a56: Test build workflow trigger - minor update to test the automated release process

## 0.1.2

### Patch Changes

- 4cf8a01: feat:test release

## 0.2.0

### Minor Changes

- ca3dbdc: add automated release process with cross-platform builds

  - Set up GitHub Actions workflows for automated releases on Mac, Windows, and Linux
  - Configure Tauri auto-updater for seamless in-app updates
  - Add changeset-based version management for better release workflow
  - Include code signing configuration for professional installers
  - Add security workflows for dependency management
