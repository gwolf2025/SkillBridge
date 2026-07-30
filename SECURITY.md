# Security Policy

## Supported Versions

| Version     | Supported |
| ----------- | --------- |
| 0.1.0-alpha | ✅        |

## Reporting a Vulnerability

Please report security vulnerabilities by opening a [GitHub Security Advisory](https://github.com/skillbridge/skillbridge/security/advisories/new).

Do not report security vulnerabilities through public GitHub issues, discussions, or pull requests.

You should receive an acknowledgment within 48 hours. If you do not, please follow up.

## What to Include

- A clear description of the vulnerability
- Steps to reproduce
- Affected versions and configurations
- Any potential mitigations you have identified

## Scope

The following are in scope:

- Path traversal in any file-reading operation
- Unsafe YAML deserialization
- Prototype pollution via parsed input
- Symlink following outside allowed directories
- Arbitrary file write during install operations
- Leakage of environment variables or secrets in diagnostic output

The following are out of scope:

- Attacks requiring physical access or social engineering
- Denial of service through resource exhaustion (acceptable for alpha)
- Theoretical vulnerabilities without a practical attack vector

## Policy

- We will acknowledge receipt within 48 hours
- We will provide an initial assessment within 5 business days
- We will coordinate an embargo date for disclosure
- We will credit reporters in release notes (if desired)
