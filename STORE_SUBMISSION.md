# Chrome Web Store submission checklist

Internal notes for publishing PromptEnhance — not part of the user-facing README.
Everything here that's just text/files is prepared; a few steps can only be done by
whoever owns the Chrome Web Store developer account (payment and login required).

## No build step

PromptEnhance is plain HTML/CSS/JS with no bundler, transpiler, or dependencies —
"packaging" just means zipping the source files with `manifest.json` at the root of
the zip.

**Don't use `Compress-Archive` or right-click → Send to → Compressed folder for this.**
Both use Windows' own path separator for zip entry names, producing paths like
`background\providers\ollama.js` instead of `background/providers/ollama.js` inside
the archive. Most tools tolerate it, but Chrome Web Store's uploader has been
reported to reject zips built that way. Use this instead, which builds the archive
entry-by-entry with explicit forward-slash names — run from the project root:

```powershell
$root = (Get-Location).Path
$zipPath = Join-Path $root "PromptEnhance-1.0.zip"
if ([System.IO.File]::Exists($zipPath)) { [System.IO.File]::Delete($zipPath) }

$includes = @("manifest.json","background","content","options","shared","icons")
$files = @()
foreach ($item in $includes) {
  $full = Join-Path $root $item
  if (Test-Path $full -PathType Leaf) { $files += Get-Item $full }
  else { $files += Get-ChildItem -Path $full -Recurse -File }
}

$bs = [char]92; $fwd = [char]47
Add-Type -AssemblyName System.IO.Compression
$fs = [System.IO.File]::Open($zipPath, [System.IO.FileMode]::Create)
$archive = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create)
foreach ($file in $files) {
  $entryName = $file.FullName.Substring($root.Length + 1).Replace($bs, $fwd)
  $entry = $archive.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
  $entryStream = $entry.Open()
  $srcStream = [System.IO.File]::OpenRead($file.FullName)
  $srcStream.CopyTo($entryStream)
  $srcStream.Dispose(); $entryStream.Dispose()
}
$archive.Dispose(); $fs.Dispose()
```

Verify it afterward the same way Chrome's own upload validation effectively does:
unzip into a scratch folder, confirm `manifest.json` is at the top level (not nested),
and confirm the entries use `/` not `\` (`unzip -l PromptEnhance-1.0.zip` from Git
Bash, or any archive tool's file listing).

This intentionally excludes `README.md`, `STORE_SUBMISSION.md`, `store-assets/`, and
`.git` — none of that is needed for the extension to run. The zip itself is
gitignored (`*.zip`); regenerate it from source rather than trusting a stale copy.

Before uploading, sanity-check it the same way the Chrome Web Store's own validator
will: unzip it into a scratch folder and confirm `manifest.json` sits at the top
level (not nested inside a subfolder), then "Load unpacked" from that scratch folder
to confirm it still works.

## Listing content

**Category:** Productivity

**Single purpose** (required field — Chrome rejects listings with more than one):
> PromptEnhance has a single purpose: rewriting user-selected text in place into a
> stronger AI prompt, by sending it to an AI provider the user personally configures
> with their own API key.

**Short description** (search results, ≤132 characters — this is 115):
> Select any text, click Enhance, and get a sharper AI prompt back in place — using
> your own API key, cloud or local.

**Detailed description** (adapt/trim as you like — pulled from `README.md`):
> Select text in any editable field on any web page — a chat box, a form, anything —
> click the ✨ Enhance button that appears, and the selection is rewritten in place
> into a sharper prompt.
>
> Runs entirely as a browser extension with no external server of ours involved. You
> bring your own API key for whichever provider you want: Anthropic (Claude), OpenAI,
> Google (Gemini), OpenRouter, or a fully local, offline setup via Ollama or LM
> Studio. Your key and settings are stored only in your browser's local extension
> storage and are sent only directly to the provider you choose — never to us.
>
> Undo works exactly like any other edit (Ctrl+Z) if you don't like the result.

**Privacy policy URL:** https://digitalgods.ai/privacy

## Permission justifications

The dashboard requires a written justification for each sensitive permission. Drafts:

- **Host permissions** (`api.anthropic.com`, `api.openai.com`,
  `generativelanguage.googleapis.com`, `openrouter.ai`, `localhost`/`127.0.0.1`):
  > These are the direct API endpoints for the AI providers the user explicitly
  > configures (Anthropic, OpenAI, Google Gemini, OpenRouter) and for local AI
  > servers (Ollama, LM Studio) running on the user's own machine. Host permission is
  > needed so the background service worker can send the enhancement request
  > directly to whichever provider the user selects, using the user's own API key. No
  > other network requests are made by the extension.

- **Content script on `<all_urls>` / all frames:**
  > PromptEnhance's core feature — enhancing selected text in place — is meant to
  > work in the text box of any chatbot or web form, not a fixed list of sites. The
  > content script only detects a text selection inside an editable field and shows a
  > small floating button; it takes no other action and reads no other page content.
  > Because the feature is inherently site-agnostic by design, it needs to run on all
  > sites rather than a fixed allowlist.

- **`storage`:**
  > Stores the user's own provider selection, model choice, and API key locally via
  > `chrome.storage.local`, so settings persist between browser sessions. This data
  > never leaves the browser except when sent directly to the provider API the user
  > configured.

- **`alarms`:**
  > Used only to periodically ping the extension's own background service worker
  > while an enhancement request is in flight, so Chrome doesn't terminate it mid-
  > request due to inactivity. Not used for tracking, scheduling, or any user-facing
  > behavior.

## Data usage disclosure

The dashboard's "Privacy practices" tab will ask you to declare what user data the
extension collects/uses. Based on actual behavior: PromptEnhance transmits **website
content** (specifically, the text the user selects) to whichever third-party AI
provider the user personally configures with their own API key — never to a server
we operate, never for advertising, never sold. No other category (location, health,
financial info, browsing history, personal communications) applies.

**Google's exact form wording/categories change over time** — I can't fill out or
submit that form (it requires your authenticated dashboard session), so treat the
above as the substance to translate into whatever the live form asks, not a literal
transcript of it.

## Screenshots

Two real screenshots captured via browser automation are in
`store-assets/screenshots/`: the floating ✨ Enhance button over a text selection
(`01-select-and-enhance-button.jpg`), and the completed enhanced result in the same
field (`02-enhanced-result.jpg`). Chrome Web Store requires at least one, so this
already satisfies the minimum (up to 5 are allowed, and it accepts JPEGs at
non-standard sizes — 1280×800 or 640×400 is just their *recommendation*, not a hard
requirement).

An Options-page screenshot was deliberately left out: Chrome blocks one extension
from capturing another extension's page pixels (a real security restriction, not a
missing feature), so it couldn't be captured via automation the way the other two
were. Grab that one yourself if you want it — open the extension's Options page and
use any normal screenshot tool (Win+Shift+S) — it's a two-second manual step.

A small promo tile (440×280) is optional but recommended for discoverability — not
included here, since it's more of a marketing asset than a functional screenshot.

## Steps only you can do

These require your own Google account and can't be automated on your behalf:

1. Register as a Chrome Web Store developer (one-time $5 fee) at
   https://chrome.google.com/webstore/devconsole if you haven't already.
2. Click **New Item**, upload `PromptEnhance-1.0.zip`.
3. Fill in the listing fields using the copy above (category, descriptions).
4. Upload the screenshots from `store-assets/screenshots/`.
5. Fill in the **Privacy practices** tab: paste in the permission justifications
   above, declare the website-content data usage, and set the privacy policy URL to
   https://digitalgods.ai/privacy.
6. Submit for review. Google's review for a new item typically takes a few days;
   expect possible back-and-forth if a reviewer wants more detail on the broad host
   permissions — the justifications above are written to preempt the most common
   questions (why all sites, why localhost, why these specific API domains).
