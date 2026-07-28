# RSVP Reader Beta - Mathematical PDF

Test build from the `dev/new-features` branch. The stable version remains
available on the `main` branch.

**English** | [Français](README.fr.md)

<p align="center">
  <img src="public/icons/icon-128.png" width="128" height="128" alt="RSVP Reader Beta - Mathematical PDF logo">
</p>

An RSVP reading extension for scientific and mathematical PDF documents.

It reads a selected passage one word at a time in a separate window, detects
mathematical notation locally, and displays it as faithful snapshots from the
PDF. The document stays open on the same page and no annotations are modified.

> **Status: experimental prototype.** The project works with its main test PDF,
> but it still needs to be tested on more documents, systems, and browsers.

## Why this project?

I am a physics student with dyslexia. I needed a tool quickly that could make
long scientific texts easier to read without destroying equations during text
extraction.

The project was therefore developed through a vibe-coding workflow: iterative
AI-assisted development, automated tests, and repeated trials on real physics
lecture notes. Its source is publicly available so that people who find the
idea useful can help test, fix, and improve it.

## Features

- RSVP reading of text selected directly in the browser's PDF viewer, with
  adjustable speed, adaptive pacing for difficult words, navigation, and
  passage context;
- local detection of mathematical notation, displayed as faithful PDF snapshots
  instead of uncertain transcription;
- extraction of common equation labels such as `(2.4)`, `(A.3a)`, `[4.2]`, or
  a right-aligned `4.2`: the label is removed from the RSVP text and displayed
  in the lower-right corner of the corresponding equation;
- controlled equation pauses, with manual or automatic continuation and image
  copying when needed;
- visible progress during PDF analysis and an optional, privacy-reviewed problem
  report;
- dyslexia-friendly fonts, two interface themes, and a resizable reader whose
  content and dimensions adapt between sessions;
- French and English interfaces, selected automatically from the browser
  language or explicitly in the reader settings;
- fully local processing: no PDF or selected passage is sent to a server.

## Browser support

| Browser | Status | Extensions page |
| --- | --- | --- |
| Microsoft Edge | Supported and used for the primary tests | `edge://extensions` |
| Google Chrome | Supported on Chromium 116 or newer | `chrome://extensions` |
| Brave | Supported on recent Chromium-based desktop versions | `brave://extensions` |
| Firefox | Not currently compatible | `about:debugging#/runtime/this-firefox` |

Edge, Chrome, and Brave use the same Chromium extension APIs. Brave officially
states that it supports nearly all Chromium-compatible extensions. Firefox uses
different APIs for its sidebar and background process; details are available in
the [Firefox compatibility](#firefox-compatibility) section.

## Installation

### 1. Build the extension

Requirements:

- [Git](https://git-scm.com/);
- [Node.js](https://nodejs.org/) 20 or newer, which includes npm;
- approximately 200 MB of free space for dependencies and the local model.

On Windows, Node.js LTS can be installed with:

```bash
winget install --id OpenJS.NodeJS.LTS --exact --source winget
```

```bash
git clone https://github.com/link1254/rsvp-reader-mathematical-pdf.git
cd rsvp-reader-mathematical-pdf
npm install
npm run check
```

The `npm run check` command runs the tests and creates the loadable extension in
the `dist` directory.

### 2. Microsoft Edge

1. Open `edge://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Select the `dist` directory.
5. Open the extension details and enable **Allow access to file URLs** to read
   PDFs stored on your computer.

Official documentation:
[sideload an extension in Edge](https://learn.microsoft.com/en-us/microsoft-edge/extensions/getting-started/extension-sideloading).

### 3. Google Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Select the `dist` directory.
5. In the extension details, allow access to file URLs for local PDFs.

Official documentation:
[load an unpacked extension in Chrome](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked).

### 4. Brave

1. Open `brave://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Select the `dist` directory.
5. Allow access to file URLs in the extension details when needed.

Brave is based on Chromium and
[documents its compatibility with Chromium extensions](https://support.brave.com/hc/en-us/articles/360017909112-How-can-I-add-extensions-to-Brave).

## Usage

1. Open a PDF with a text layer in the browser.
2. Select the passage you want to read.
3. Right-click the selection.
4. Choose **Read selection with RSVP Reader Beta**.
5. Wait for the local analysis to finish, then use:
   - `Space` to play or pause;
   - the left and right arrow keys to move one word at a time;
   - the up arrow or `↶` to restart the current sentence;
   - `-5` and `+5` to move quickly;
   - **I understand — continue** to confirm an equation;
   - **Copy image** to copy the displayed formula.
6. Select **Report** to prepare a problem report. The selected excerpt and PDF
   page image can each be removed before copying or sending it.
7. Open **Settings → Interface language** to choose **Automatic (browser)**,
   **Français**, or **English**. This choice also updates the context menu.
8. Under **Settings → Mathematics in the overview**, choose **Yellow labels**
   or **Expression previews**. A notation without an available capture keeps
   its yellow label.
If a very short selection appears in several places in the document, the
extension refuses to choose a page arbitrarily. Select a slightly longer
sentence in that case.

## Feedback reports

By default, **Report** opens a prefilled public Issue on this GitHub repository.
Nothing is published automatically: the user must review the Issue on GitHub
and submit it manually. The description and displayed diagnostics are public.
The selected excerpt is opt-in and unchecked by default; a PDF page image is
never attached automatically in public mode.

The feature can be switched without removing its code:

```dotenv
# Default: prefilled public GitHub Issue
VITE_FEEDBACK_MODE=public

# Optional private Worker relay
VITE_FEEDBACK_MODE=private
VITE_FEEDBACK_ENDPOINT=https://feedback.example.com/report

# Hide the feature
VITE_FEEDBACK_MODE=disabled
```

The optional private relay creates an Issue in a separate private GitHub
repository. Its setup is documented in
[`feedback-relay/README.md`](feedback-relay/README.md).

## How mathematical content is handled

1. [PDF.js](https://mozilla.github.io/pdf.js/) opens the document, reads its
   text layer, and renders the page as an image.
2. The local
   [Pix2Text MFD 1.5](https://huggingface.co/breezedeus/pix2text-mfd-1.5)
   model detects mathematical regions in that image.
3. [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/) runs the model
   directly inside the extension.
4. PDF text-layer geometry associates the selection with detected regions.
5. Formulas are cropped from the original rendering and become PNG image steps
   in the RSVP stream.

The PDF is not converted to Markdown: mathematical delimiters in converted
Markdown would be generated after formula recognition, not reliably recovered
from the original PDF. The bundled model only detects mathematical regions, so
the extension displays exact snapshots instead of potentially incorrect LaTeX.

A more detailed technical description is available in
[`PDF_MATH_DETECTION.md`](PDF_MATH_DETECTION.md) in French.

## Privacy and permissions

Reading and mathematical analysis are entirely local:

- no account is required;
- no telemetry is included;
- the PDF, selected text, and snapshots are not sent over the Internet during
  reading;
- the ONNX model and WebAssembly runtime are bundled with the extension.

In public feedback mode, the extension only opens a prefilled GitHub page after
user confirmation. The user still controls the final GitHub submission. The
excerpt is optional and the page image is never included automatically. In
private mode, data is sent to the configured relay only after validation; the
excerpt and complete page image have separate consent controls.

Permissions are used to create the context menu, inspect the active tab, capture
the visible page, open and remember the RSVP window, store settings, and copy an
equation to the clipboard. The `file://`, `http://`, and `https://` permissions
allow the extension to access the selected PDF.

## Firefox compatibility

The current code cannot be loaded into Firefox as-is.

- Chromium uses `sidePanel`, while Firefox uses
  [`sidebar_action`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/sidebar_action).
- The current manifest declares a
  [`background.service_worker`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background),
  which Firefox handles differently.
- The manifest also contains Chromium-specific fields and permissions.
- Firefox's built-in PDF viewer, tab capture behavior, and image clipboard
  support need dedicated validation.

A clean port will require a separately generated Firefox manifest, a sidebar
adapter, and a dedicated test campaign. Most of the PDF and mathematical
detection engine should nevertheless be reusable.

## Development

```bash
npm install
npm run dev
npm run test
npm run build
npm run check
```

- `npm run dev` starts Vite for interface development.
- `npm run test` runs the Vitest test suite.
- `npm run build` rebuilds `dist`.
- `npm run check` runs all tests and then performs a complete build.

After making a change, rebuild the extension, select **Reload** on the browser's
extensions page, and close any older RSVP Reader window that is still open.

## Contributing

Feedback, issues, and pull requests are welcome, especially for:

- testing other scientific PDFs;
- reducing false positives and missed formulas;
- improving accessibility and the reading experience;
- measuring performance on other computers;
- preparing the Firefox port;
- adding reproducible tests.

When reporting a problem, include the browser and its version, the extension
version, PDF type, page number, selected passage, and a screenshot whenever
possible. Do not publish a copyrighted PDF without permission.

Before opening a pull request:

```bash
npm run check
```

## Technologies, sources, and credits

- [Mozilla PDF.js](https://github.com/mozilla/pdf.js): PDF text-layer reading
  and page rendering, Apache-2.0 license.
- [Pix2Text](https://github.com/breezedeus/Pix2Text) and
  [Pix2Text MFD 1.5](https://huggingface.co/breezedeus/pix2text-mfd-1.5):
  mathematical formula detection, MIT license.
- [Microsoft ONNX Runtime Web](https://github.com/microsoft/onnxruntime): local
  model inference, MIT license.
- [KaTeX](https://katex.org/): mathematical rendering tools, MIT license.
- [Atkinson Hyperlegible](https://fontsource.org/fonts/atkinson-hyperlegible),
  [OpenDyslexic](https://fontsource.org/fonts/opendyslexic), and
  [Lexend](https://fontsource.org/fonts/lexend): locally bundled reading fonts,
  SIL Open Font License 1.1.
- [Vite](https://vite.dev/): extension build system, MIT license.
- [Vitest](https://vitest.dev/): automated testing, MIT license.
- [OpenAI Codex](https://help.openai.com/en/articles/11369540/): assistance
  with development, code review, and test creation.
- [Chromium Extensions documentation](https://developer.chrome.com/docs/extensions/)
  and [MDN WebExtensions](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions):
  browser API references.

The exact bundled model and runtime files, versions, licenses, and SHA-256
checksums are documented in
[`public/models/README.md`](public/models/README.md).
The complete attribution inventory and the paths to the license texts are in
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md). `npm run check` verifies
that these notices still match the installed dependencies and the packaged
model files.

The lecture-note PDF used during development is not included in this repository.

## License

The project code and original project assets are source-available under the
[PolyForm Noncommercial License 1.0.0](LICENSE). The permitted personal,
research, educational, public-interest, and other noncommercial uses are
described in the license.

Commercial use, sale, monetized distribution, or incorporation into a
commercial product requires a separate written license from the copyright
holder. Commercial licensing requests can be submitted to the repository
owner through GitHub.

The project name and logo identify this project and are not licensed for use
in a way that suggests endorsement or an official derivative. Components and
models from other authors remain subject to the licenses listed in
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
