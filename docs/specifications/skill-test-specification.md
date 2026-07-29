# SkillBridge Skill Test Specification

**Version:** 0.1.0-alpha
**Status:** Draft
**Date:** 2026-07-29

## 1. Overview

The SkillBridge skill-test specification defines a standard YAML/JSON format for writing automated tests against skills in the SkillBridge ecosystem. Skill tests validate that a skill produces expected outputs, behaves correctly under various inputs, and meets permission and conversion requirements.

Skill tests are pure data — no inline code execution or dynamic evaluation is permitted.

## 2. Type Definitions

### 2.1 `SkillTestSuite`

Top-level grouping of related test definitions.

| Field         | Type                  | Required | Description                            |
| ------------- | --------------------- | -------- | -------------------------------------- |
| `name`        | string                | yes      | Human-readable name for the test suite |
| `description` | string                | no       | Description of the test suite purpose  |
| `tests`       | SkillTestDefinition[] | yes      | Array of test definitions (at least 1) |

### 2.2 `SkillTestDefinition`

A single test case.

| Field                  | Type                  | Required | Description                                |
| ---------------------- | --------------------- | -------- | ------------------------------------------ |
| `name`                 | string                | yes      | Unique name for this test case             |
| `description`          | string                | no       | Description of what the test validates     |
| `input`                | TestInput             | no       | Input configuration for the test           |
| `assertions`           | Assertion[]           | yes      | Array of assertions to verify (at least 1) |
| `conversionAssertions` | ConversionAssertion[] | no       | Cross-format conversion tests              |
| `humanReview`          | HumanReview           | no       | Marker requiring manual human review       |

### 2.3 `TestInput`

| Field      | Type     | Required | Description                      |
| ---------- | -------- | -------- | -------------------------------- |
| `fixtures` | string[] | no       | Paths to fixture files to load   |
| `prompt`   | string   | no       | Prompt text to send to the skill |
| `args`     | string[] | no       | CLI-style arguments              |

### 2.4 `Assertion` (discriminated union)

Each assertion has a `type` field identifying the assertion kind:

#### 2.4.1 `expectText`

Assert that the output contains expected text.

| Field      | Type           | Required | Description                                        |
| ---------- | -------------- | -------- | -------------------------------------------------- |
| `type`     | `"expectText"` | yes      |                                                    |
| `expected` | string         | yes      | Expected text content                              |
| `location` | string         | no       | Where to look (e.g., `stdout`, `stderr`, `output`) |

#### 2.4.2 `expectJson`

Assert that the output matches structured JSON.

| Field      | Type           | Required | Description         |
| ---------- | -------------- | -------- | ------------------- |
| `type`     | `"expectJson"` | yes      |                     |
| `expected` | unknown        | yes      | Expected JSON value |
| `location` | string         | no       | Where to look       |

#### 2.4.3 `prohibitText`

Assert that the output does NOT contain forbidden text.

| Field      | Type             | Required | Description                     |
| ---------- | ---------------- | -------- | ------------------------------- |
| `type`     | `"prohibitText"` | yes      |                                 |
| `pattern`  | string           | yes      | Text or regex pattern to forbid |
| `location` | string           | no       | Where to check                  |

#### 2.4.4 `fileAssert`

Assert file existence, content, or checksum.

| Field      | Type           | Required | Description                                   |
| ---------- | -------------- | -------- | --------------------------------------------- |
| `type`     | `"fileAssert"` | yes      |                                               |
| `path`     | string         | yes      | Path to the file                              |
| `exists`   | boolean        | no       | Whether the file should exist (default: true) |
| `content`  | string         | no       | Expected file content                         |
| `checksum` | string         | no       | Expected SHA-256 checksum                     |

#### 2.4.5 `toolCallAssert`

Assert expected tool invocations.

| Field     | Type               | Required | Description                    |
| --------- | ------------------ | -------- | ------------------------------ |
| `type`    | `"toolCallAssert"` | yes      |                                |
| `tool`    | string             | yes      | Tool name                      |
| `args`    | unknown            | no       | Expected arguments             |
| `count`   | number             | no       | Expected invocation count      |
| `ordered` | boolean            | no       | Whether calls must be in order |

#### 2.4.6 `permissionAssert`

Assert expected permission requests.

| Field      | Type                 | Required | Description                                  |
| ---------- | -------------------- | -------- | -------------------------------------------- |
| `type`     | `"permissionAssert"` | yes      |                                              |
| `resource` | string               | yes      | Resource identifier (per IR Permission type) |
| `actions`  | string[]             | yes      | Expected actions                             |
| `count`    | number               | no       | Expected request count                       |

#### 2.4.7 `jsonSchemaAssert`

Assert output matches a JSON Schema.

| Field      | Type                 | Required | Description               |
| ---------- | -------------------- | -------- | ------------------------- |
| `type`     | `"jsonSchemaAssert"` | yes      |                           |
| `schema`   | object               | yes      | JSON Schema object        |
| `location` | string               | no       | Where to apply the schema |

#### 2.4.8 `snapshot`

Named snapshot for output comparison.

| Field      | Type         | Required | Description                       |
| ---------- | ------------ | -------- | --------------------------------- |
| `type`     | `"snapshot"` | yes      |                                   |
| `name`     | string       | yes      | Snapshot name (must be non-empty) |
| `location` | string       | no       | Where to capture                  |

#### 2.4.9 `expectDiagnostics`

Assert expected diagnostics.

| Field                    | Type                  | Required | Description                          |
| ------------------------ | --------------------- | -------- | ------------------------------------ |
| `type`                   | `"expectDiagnostics"` | yes      |                                      |
| `diagnostics`            | array                 | yes      | Array of expected diagnostic objects |
| `diagnostics[].severity` | string                | no       | Expected severity                    |
| `diagnostics[].message`  | string                | no       | Expected message                     |
| `diagnostics[].code`     | string                | no       | Expected error code                  |

#### 2.4.10 `conversionAssert`

Cross-format conversion test.

| Field        | Type                 | Required | Description                             |
| ------------ | -------------------- | -------- | --------------------------------------- |
| `type`       | `"conversionAssert"` | yes      |                                         |
| `fromFormat` | string               | yes      | Source format                           |
| `toFormat`   | string               | yes      | Target format                           |
| `assertions` | Assertion[]          | yes      | Sub-assertions for the converted output |

#### 2.4.11 `humanReview`

Marker requiring manual human review.

| Field          | Type            | Required | Description                                    |
| -------------- | --------------- | -------- | ---------------------------------------------- |
| `type`         | `"humanReview"` | yes      |                                                |
| `reason`       | string          | yes      | Why human review is needed (must be non-empty) |
| `instructions` | string          | no       | Instructions for the reviewer                  |

## 3. Validation Rules

- `SkillTestSuite` must have a non-empty `name` and at least one `test`
- `SkillTestDefinition` must have a non-empty `name` and at least one `assertion`
- Each assertion must have a valid `type` from the defined union
- `humanReview` requires a non-empty `reason`
- `snapshot` requires a non-empty `name`
- Unknown fields are permitted but produce an info-level diagnostic
- Permission assertions must align with the IR `Permission` vocabulary

## 4. Security Rules

- Skill test definitions are pure data — no inline code execution
- Snapshots should not contain secrets or sensitive values
- The `humanReview` assertion type is a gating marker only — it does not provide automated safety guarantees
- Prohibited output patterns use pattern matching only (no regex injection from test definitions)

## 5. Example

```yaml
name: My Skill Test Suite
description: Validates the core behavior of my-skill
tests:
  - name: basic-output-test
    description: Verify the skill produces the expected greeting
    input:
      prompt: 'Hello, skill!'
    assertions:
      - type: expectText
        expected: "Hello! I'm ready to help."
      - type: expectDiagnostics
        diagnostics:
          - severity: info
            message: skill activated
            code: SKILL-001
    humanReview:
      reason: Manual verification of greeting format
      instructions: Check that the greeting is polite and professional
```
