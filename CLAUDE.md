# SilverBrain — Assistant Instructions

## Version bump before commit

Whenever the user asks you to create a git commit, **bump the project version first** and include that bump in the same commit. Do not commit without completing this step unless the user explicitly says to skip the version bump.

### Step 1 — Ask the user

Before staging or committing, ask which version bump to apply. Present these options clearly:

- **patch** — bug fixes, small tweaks (e.g. `0.1.0` → `0.1.1`)
- **minor** — new features, backward-compatible (e.g. `0.1.0` → `0.2.0`)
- **major** — breaking changes (e.g. `0.1.0` → `1.0.0`)
- **alpha** — alpha pre-release (e.g. `0.2.0` → `0.2.0-alpha.1`, or `0.2.0-alpha.1` → `0.2.0-alpha.2`)
- **beta** — beta pre-release (e.g. `0.2.0` → `0.2.0-beta.1`, or `0.2.0-beta.1` → `0.2.0-beta.2`)
- **pre-release** — generic pre-release tag (e.g. `0.2.0` → `0.2.0-rc.1`, or `0.2.0-rc.1` → `0.2.0-rc.2`)

Wait for the user's answer before bumping or committing.

### Step 2 — Read the current version

The canonical version is in `package.json`. All version-bearing files must stay in sync:

| File | Field |
|------|-------|
| `package.json` | `"version"` |
| `src-tauri/Cargo.toml` | `version` (under `[package]`) |
| `src-tauri/tauri.conf.json` | `"version"` |

### Step 3 — Compute the new version

Parse the current version as semver (`MAJOR.MINOR.PATCH` with optional `-PRERELEASE`).

| Bump type | Rule |
|-----------|------|
| **patch** | Increment PATCH; remove any pre-release suffix |
| **minor** | Increment MINOR; reset PATCH to `0`; remove pre-release |
| **major** | Increment MAJOR; reset MINOR and PATCH to `0`; remove pre-release |
| **alpha** | If already `-alpha.N`, increment `N`. Otherwise append `-alpha.1` to the current base version |
| **beta** | If already `-beta.N`, increment `N`. Otherwise append `-beta.1` to the current base version |
| **pre-release** | If already has a pre-release suffix (`-rc.N`, `-pre.N`, etc.), increment `N`. Otherwise append `-rc.1` to the current base version |

Examples:

- `0.1.0` + patch → `0.1.1`
- `0.1.0` + minor → `0.2.0`
- `0.1.0` + major → `1.0.0`
- `0.2.0` + alpha → `0.2.0-alpha.1`
- `0.2.0-alpha.1` + alpha → `0.2.0-alpha.2`
- `0.2.0` + beta → `0.2.0-beta.1`
- `0.2.0` + pre-release → `0.2.0-rc.1`

### Step 4 — Update all version files

Set the new version in all three files listed above. Verify they match exactly.

### Step 5 — Commit

Include the version bump in the commit alongside the other changes. Mention the new version in the commit message (e.g. `v0.1.1: fix matrix drag-and-drop`).

### Step 6 — Tag the release

After the commit succeeds, create an **annotated** git tag on that commit:

```bash
git tag -a v{VERSION} -m "v{VERSION}"
```

Use the `v` prefix (e.g. version `0.1.1` → tag `v0.1.1`). If the tag already exists, stop and tell the user — do not overwrite it.

Do **not** push the tag unless the user explicitly asks. When they do, run:

```bash
git push origin v{VERSION}
```
