---
name: file-organizer
version: 1.0.0
description: DEMONSTRATION ONLY — Not intended for production use. Organizes files into folders by type.
capabilities:
  - file-read
  - file-write
  - list-directory
permissions:
  - resource: fs
    actions:
      - read
      - write
      - list
---

# File Organizer

Organize files in a directory by their extension.

## Inputs

- `directory`: Target directory path (string)
- `dryRun`: If true, only preview changes (boolean)

## Procedure

1. List all files in the directory
2. Group by file extension
3. Create subdirectories for each group
4. Move files into corresponding directories

## Outputs

- Summary of organized files
