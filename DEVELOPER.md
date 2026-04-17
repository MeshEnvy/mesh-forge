# Firmware projects on MeshForge

This guide is for maintainers of **GitHub-hosted PlatformIO firmware** that users open in MeshForge.

## Quick tips

- **Optional `meshforge.yaml`** — full reference in the next section. Commit it on your **default branch** so MeshForge can narrow the tag and target pickers.
- After you push tags or change how the project should be discovered, hit **Refresh tags** on the repo page so MeshForge pulls the latest from GitHub.
- Set your repository’s **default branch** in GitHub to the branch you commit custom changes on (many maintainers name it after the mod). MeshForge periodically scans that branch.

## meshforge.yaml

`meshforge.yaml` is an **optional file at the repository root** (same level as `platformio.ini`). It tells MeshForge how to **filter Git tags** and **PlatformIO environments** (`[env:…]` names) in the web UI so users only see combinations that make sense for your project.

### Where MeshForge reads it

The **tag** and **target** dropdowns use the copy of `meshforge.yaml` from your repo’s **GitHub default branch** (via the GitHub contents API). That means:

- Put the file on whatever branch you set as **default** in GitHub settings.
- When you change the profile, merge or push to that default branch, then use **Refresh tags** so MeshForge refetches it.
- The profile is **not** read separately per selected tag for the pickers—one file on the default branch drives the filters for the whole repo view.

### File shape

MeshForge only understands a top-level `meshforge:` block with optional `tags:` and `targets:` sections. Other keys are ignored. The built-in parser is intentionally small: it expects **2-space indentation** under `meshforge:` (`tags:` / `targets:` at two spaces, their fields at four), supports **line comments** (`# …`), **quoted or unquoted** string values, and **inline lists** like `[wifi, ble]` for `require_capabilities`. If the file is missing or unparsable, MeshForge shows all tags and all scanned environments (subject to the normal scan).

```yaml
meshforge:
  tags:
    include: ^v2\.
  targets:
    include: HELTEC|TLORA|TBEAM
    require_capabilities: [wifi]
```

### `tags.include`

- **Type:** string interpreted as a **JavaScript `RegExp`** source (same as `new RegExp(…)` in the browser).
- **Effect:** Only **tag names** that match this pattern stay in the tag dropdown. If the pattern is missing, every tag from GitHub is listed (still sorted as usual).
- **Invalid regex:** MeshForge treats the filter as absent and keeps the full tag list.

Use this to hide CI-only tags, old experiments, or anything you do not want offered as a firmware ref—for example `^v\d` for SemVer-looking tags only.

### `targets.include`

- **Type:** string → **JavaScript `RegExp`** over **PlatformIO environment names** (not display names).
- **Effect:** When no `include_template` applies (see below), environments whose names do not match are hidden from the target picker.
- **Invalid regex:** the regex filter is skipped (capabilities can still apply).

### `targets.include_template` (tag-aware targets)

When you want **which targets appear** to depend on **which tag is selected**, use **`tags.include` together with `targets.include_template`**:

1. `tags.include` must match the **currently selected tag**; the match is run with `RegExp.exec`, so you can use **capturing groups** `(...)` or **named groups** `(?<name>…)` (JavaScript regex syntax).
2. `targets.include_template` is a string that becomes a **new regex** after **placeholders** are filled in. Each substituted piece is **regex-escaped** so literal tag text does not break the pattern.

**Placeholders**

| Placeholder        | Meaning                                        |
| ------------------ | ---------------------------------------------- |
| `${1}`, `${2}`, …  | Numbered capture groups from `tags.include`    |
| `${myName}`        | Named group `(?<myName>…)` from `tags.include` |
| `${myName_snake}`  | Same capture, converted to **snake_case**      |
| `${myName_camel}`  | **lowerCamelCase**                             |
| `${myName_pascal}` | **PascalCase**                                 |

**Precedence:** If both `include_template` and `tags.include` are set and the current tag **matches** `tags.include`, the expanded template is the target regex. Otherwise MeshForge uses **`targets.include`** as a plain static regex. If neither yields a valid regex, there is no name-based filter (capabilities may still apply).

**Example:** Tags like `acme-1.0.0` where environments are named `acme_1_0_0` and `acme_1_0_0_debug`:

```yaml
meshforge:
  tags:
    include: ^(?<mod>[a-z]+)-(?<ver>[0-9]+(?:\.[0-9]+)*)$
  targets:
    include_template: ^${mod_snake}_${ver_snake}
```

The template becomes a regex that still matches if you suffix env names (for example `_debug`). Adjust the tag regex and template to match how **you** name tags vs `env:` sections.

### `targets.require_capabilities`

- **Type:** inline list of strings, e.g. `[wifi, ble]`.
- **Effect:** An environment is shown only if **every** listed capability is present on that env. Capabilities are **inferred** by MeshForge from PlatformIO’s `platform` / `board` for each env (not read from `meshforge.yaml`). Today that means roughly:
  - **Espressif32** (including `pioarduino` URLs) → `wifi`, `ble`
  - **nordicnrf52** → `ble`
  - **Raspberry Pi / Pico** → `wifi` and `ble` only when the board looks like a **Pico W** (e.g. name contains `picow` or ends with `_w`)
  - Other platforms → **no** inferred capabilities

You can use **only** `require_capabilities` (no `include` / `include_template`) to, for example, restrict the list to ESP32-class boards. If every env shows **no** capabilities (for example an old scan completed before capability detection), open the repo again on that ref so MeshForge can **rescan**; otherwise the capability filter may hide everything.

### Practical tips

- **Start without a file**, add `meshforge.yaml` once tag and env lists feel noisy or unsafe for end users.
- **Test regexes** in a JavaScript console (`new RegExp('…').test('tag-name')`) before committing.
- **Refresh tags** after editing the file on the default branch so the UI picks up changes quickly.

## Release tag naming

Tag releases so users can read both your mod and the upstream base at a glance, for example:

`<modName>-<modVersion>-<baseName>-<baseVersion>`

That makes it clear which upstream firmware version a release is built on.

## Maintaining a fork

- **Start from upstream** — Pick a tagged upstream release (often the latest) or any commit, and branch from there for your project (Meshtastic, MeshCore, or any PlatformIO-based LoRa mesh firmware).
- **Default branch** — Set that branch as the GitHub default. MeshForge uses it for periodic scans.
- **When upstream tags a new release** — **Merge** that tag into your branch and continue development. That keeps older release tags meaningful. **Do not rebase** published history you care about, or those tags will no longer sit on the older base revision users expect.
- **Branch-only workflow** — You can maintain a branch without tags; MeshForge builds from the **tip** of that branch. That works well for experimental projects before you cut releases.
