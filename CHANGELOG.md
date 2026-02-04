# mpesa2csv

## 0.11.1

### Patch Changes

- [`46ea850`](https://github.com/DavidAmunga/mpesa2csv/commit/46ea8502c794ce635ad6a7b988245a6ccfbda068) Thanks [@DavidAmunga](https://github.com/DavidAmunga)! - fix: improve JRE bundling verification for Windows and macOS installers

## 0.11.0

### Minor Changes

- 06804b8: feat: add money in/out sheets

## 0.10.2

### Patch Changes

- 339b23a: fix: macos jre bundling

## 0.10.1

### Patch Changes

- 0f3a4b6: fix: arm64 jre bundling

## 0.10.0

### Minor Changes

- 8d99064: feat: add webhook service for external integrations
- 68f7ad4: feat: add top contacts sheet

### Patch Changes

- 16d176f: chore: improve release workflow

## 0.9.0

### Minor Changes

- 68f7ad4: feat: add top contacts sheet

## 0.8.0

### Minor Changes

- 619f6e7: feat: added extra export formats

  - JSON Export - Exports transactions in JSON format
  - OFX Export - Exports transactions in OFX (Open Financial Exchange) format (Experimental)
  - QFX Export - Exports transactions in QFX (Quicken Financial) format (Experimental)
  - QIF Export - Exports transactions in QIF (Quicken Interchange) format (Experimental)

## 0.7.5

### Patch Changes

- fix: improve sheets stacking

## 0.7.4

### Patch Changes

- fix: improve release process updates

## 0.7.3

### Patch Changes

- e834026: Enable code signing for secure auto-updates

## 0.7.2

### Patch Changes

- fix: release process update

## 0.7.1

### Patch Changes

- 40276c7: feat: improve data parsing in tabulaService

## 0.7.0

### Minor Changes

- 97d245d: feat: Replace PDF.js with Tabula for improved PDF table extraction

## 0.6.1

### Patch Changes

- fix: updater checker

## 0.6.0

### Minor Changes

- feat: added date formatter to filter options
- fix: save file dialog not working on windows

## 0.5.5

### Patch Changes

- 307a7b2: fix: minor app improvements

## 0.5.4

### Patch Changes

- 9497a3a: fix: datetime parsing for paybill statements

## 0.5.3

### Patch Changes

- fix: android release

## 0.5.2

### Patch Changes

- fix: android release

## 0.5.1

### Patch Changes

- fix: android release

## 0.5.0

### Minor Changes

- c409480: feat: added android base setup
- c409480: feat: add transaction filters
- c409480: feat: add open file on download success button

## 0.4.0

### Minor Changes

- 3ae00d9: feat: Add Transaction Amount Distribution Sheet

### Patch Changes

- 3ae00d9: fix: reset/skip options after upload

## 0.3.0

### Minor Changes

- 43a16f2: feat: add daily balance tracker sheet
- 43a16f2: feat: add monthly & weekly breakdown sheet

## 0.2.0

### Minor Changes

- 3b58f9c: feat: added financial summary export

### Patch Changes

- df51aea: fix: reorder columns and update total charges display in xlsx charges sheet export
- 3b58f9c: fix: refine statement processing

## 0.1.0

### Minor Changes

- 68e265d: Add optional Charges/Fees sheet to Excel exports

  - Add new export option to include a separate "Charges & Fees" sheet when exporting to Excel
  - Filter and categorize all transactions containing "charge" in the details
  - Display charges with date, amount, and balance information
  - Include summary totals for total charges and number of charge transactions

## 0.0.3

### Patch Changes

- aaf57ba: - feat: Add Excel export support and format selection UI
- 4819fd1: fix: consistent ui styling and accessibility

## 0.0.2

### Patch Changes

- 3415c7a: feat: add theme support
