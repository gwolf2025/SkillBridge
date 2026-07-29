---
name: code-analyzer
version: 1.0.0
description: DEMONSTRATION ONLY — Not intended for production use. Analyzes source code for complexity and style issues.
capabilities:
  - file-read
  - command-exec
  - search-files
permissions:
  - resource: fs
    actions:
      - read
      - search
  - resource: bash:*
    actions:
      - execute
---

# Code Analyzer

Run static analysis on source code files.

## Inputs

- `path`: Path to analyze (string)
- `tool`: Analysis tool to use (enum: eslint, pylint, clippy)

## Procedure

1. Discover source files
2. Run the selected analysis tool
3. Collect results
4. Generate report

## Outputs

- Analysis report with warnings and errors
