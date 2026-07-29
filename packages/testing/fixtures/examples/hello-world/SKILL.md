---
name: hello-world
version: 1.0.0
description: DEMONSTRATION ONLY — Not intended for production use. A minimal skill that responds with a greeting.
capabilities:
  - file-read
permissions:
  - resource: fs
    actions:
      - read
---

# Hello World

Respond with a friendly greeting.

## Inputs

- `name`: The name to greet (string)

## Outputs

- A greeting string
