# Third-party notices

RSVP Reader - Mathematical PDF includes or uses the projects listed below.
They remain licensed by their respective authors. Nothing in the project's
PolyForm Noncommercial license replaces or restricts those licenses.

The extension's production package contains the complete applicable license
texts under `licenses/`. Source distributions contain the same files under
`public/licenses/`.

## Components distributed with the extension

### Mozilla PDF.js (`pdfjs-dist` 5.7.284)

- Purpose: PDF parsing, text-layer access, and page rendering.
- Source: https://github.com/mozilla/pdf.js/tree/v5.7.284
- License: Apache License 2.0.
- License text: `licenses/PDFJS-APACHE-2.0.txt`.

### Microsoft ONNX Runtime Web (`onnxruntime-web` and `onnxruntime-common` 1.22.0)

- Purpose: local WebAssembly inference for mathematical formula detection.
- Source: https://github.com/microsoft/onnxruntime/tree/v1.22.0
- License: MIT.
- License text: `licenses/ONNXRUNTIME-MIT.txt`.
- Notices for software incorporated by ONNX Runtime:
  `licenses/ONNXRUNTIME-THIRD-PARTY-NOTICES.txt`.

### Pix2Text MFD 1.5 model

- Purpose: local detection of inline and displayed mathematical formulas.
- Model source: https://huggingface.co/breezedeus/pix2text-mfd-1.5
- Project source: https://github.com/breezedeus/Pix2Text
- License: MIT, as declared by the model repository.
- License text: `licenses/PIX2TEXT-MFD-MIT.txt`.
- Bundled file: `models/pix2text-mfd-1.5.onnx`.
- SHA-256:
  `40d4fc852d99bcbf25a9478897d2f49fbbb8f7fdd6569c088cd1c31386293bd7`.

### KaTeX (`katex` 0.16.47)

- Purpose: LaTeX-style reading font and mathematical rendering support.
- Source: https://github.com/KaTeX/KaTeX/tree/v0.16.47
- License: MIT.
- License text: `licenses/KATEX-MIT.txt`.

### Locally bundled reading fonts

- Atkinson Hyperlegible (`@fontsource/atkinson-hyperlegible` 5.3.0):
  https://fontsource.org/fonts/atkinson-hyperlegible, SIL Open Font License 1.1,
  `licenses/ATKINSON-HYPERLEGIBLE-OFL-1.1.txt`.
- OpenDyslexic (`@fontsource/opendyslexic` 5.3.0):
  https://fontsource.org/fonts/opendyslexic, SIL Open Font License 1.1,
  `licenses/OPENDYSLEXIC-OFL-1.1.txt`.
- Lexend (`@fontsource-variable/lexend` 5.3.0):
  https://fontsource.org/fonts/lexend, SIL Open Font License 1.1,
  `licenses/LEXEND-OFL-1.1.txt`.

Only the local webfont files required by the reader are included. No font is
downloaded while the extension is running.

## Development tools

These tools build or test the project and are not shipped in the extension:

- Vite 7.3.6: https://github.com/vitejs/vite, MIT.
- Vitest 3.2.7: https://github.com/vitest-dev/vitest, MIT.

Their own distributions contain the notices for their respective transitive
dependencies.

`npm run check` also inspects the complete non-development npm dependency graph
for unexpected licenses and compares this notice with
`dist/BUNDLED_DEPENDENCIES.json`, which is generated from the modules actually
present in the production JavaScript bundle.

## Project identity

The project name and logo identify RSVP Reader - Mathematical PDF. Their
inclusion does not imply that Mozilla, Microsoft, BreezeDeus, KaTeX, Vite,
Vitest, or their contributors sponsor or endorse this project.
