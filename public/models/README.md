# Local mathematical formula detector

`pix2text-mfd-1.5.onnx` is the Pix2Text MFD 1.5 mathematical formula
detection model:

- Source: https://huggingface.co/breezedeus/pix2text-mfd-1.5
- License: MIT
- License text: `../licenses/PIX2TEXT-MFD-MIT.txt`
- SHA-256:
  `40d4fc852d99bcbf25a9478897d2f49fbbb8f7fdd6569c088cd1c31386293bd7`

`ort-wasm-simd-threaded.mjs` and `ort-wasm-simd-threaded.wasm` come from
`onnxruntime-web` 1.22.0:

- Source: https://github.com/microsoft/onnxruntime/tree/v1.22.0
- License: MIT
- License text: `../licenses/ONNXRUNTIME-MIT.txt`
- Third-party notices: `../licenses/ONNXRUNTIME-THIRD-PARTY-NOTICES.txt`
- MJS SHA-256:
  `30dd851d9c00622940500f71ddd2ff8820c5cb65270816080175b958705385a8`
- WASM SHA-256:
  `71aef04959c5c1b6de461b6538e2058e306610034a85aad2742d0c7fd4533fe4`

All three files are bundled with the extension so PDF pages are analyzed
locally. See the repository-level `THIRD_PARTY_NOTICES.md` for the complete
inventory.
