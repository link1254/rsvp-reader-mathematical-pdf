import katex from 'katex';
import 'katex/dist/katex.min.css';

const superscripts = { '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','⁺':'+','⁻':'-' };
const subscripts = { '₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9' };
const replacements = new Map([
  ['−','-'], ['×','\\times '], ['÷','\\div '], ['≈','\\approx '], ['≠','\\neq '],
  ['≤','\\leq '], ['≥','\\geq '], ['≡','\\equiv '], ['±','\\pm '], ['∞','\\infty '], ['∑','\\sum '],
  ['∏','\\prod '], ['∫','\\int '], ['√','\\sqrt{}'], ['∂','\\partial '], ['∇','\\nabla '],
  ['→','\\to '], ['↦','\\mapsto '], ['⇒','\\Rightarrow '], ['∝','\\propto '], ['ℏ','\\hbar '], ['ħ','\\hbar '],
  ['ψ','\\psi '], ['φ','\\phi '], ['χ','\\chi '], ['ρ','\\rho '], ['μ','\\mu '],
  ['ν','\\nu '], ['λ','\\lambda '], ['σ','\\sigma '], ['π','\\pi '], ['τ','\\tau '],
  ['δ','\\delta '], ['□','\\Box ']
]);

export function unicodeMathToLatex(input) {
  let output = '';
  const normalized = input.trim()
    .replace(/∂\s*2\s*([A-Za-z])/g, '∂^{2}_{$1}')
    .replace(/∇\s*2/g, '∇^{2}')
    .replace(/([ℏħcm])\s*([24])(?=[A-Za-zΑ-ω∂∇]|\s|[+−=),.]|$)/g, '$1^{$2}');
  const chars = [...normalized];
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    if (superscripts[char] !== undefined) {
      let value = '';
      while (i < chars.length && superscripts[chars[i]] !== undefined) value += superscripts[chars[i++]];
      output += `^{${value}}`; i--; continue;
    }
    if (subscripts[char] !== undefined) {
      let value = '';
      while (i < chars.length && subscripts[chars[i]] !== undefined) value += subscripts[chars[i++]];
      output += `_{${value}}`; i--; continue;
    }
    output += replacements.get(char) ?? char;
  }
  return output;
}

export function renderMath(element, expression, displayMode = true) {
  try {
    katex.render(unicodeMathToLatex(expression), element, { displayMode, throwOnError: false, strict: false, trust: false });
  } catch {
    element.textContent = expression;
  }
}
