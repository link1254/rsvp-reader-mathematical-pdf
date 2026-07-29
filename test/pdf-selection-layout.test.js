import { describe, expect, it } from 'vitest';
import {
  buildSelectionSegments,
  chooseSelectionCandidate,
  confirmWeakMathRegions,
  locateSelectionItems
} from '../src/pdf-selection-layout.js';

const viewport = {
  scale: 1,
  convertToViewportPoint(x, y) {
    return [x, 600 - y];
  }
};

function item(str, x, width, y = 500) {
  return {
    str,
    width,
    height: 10,
    dir: 'ltr',
    transform: [1, 0, 0, 1, x, y]
  };
}

describe('visual PDF selection layout', () => {
  it('locates a copied formula even when PDF glyphs are split into separate items', () => {
    const items = [
      item('F', 10, 6), item('1', 16, 4), item('(q)', 20, 14), item(' ˙', 34, 4),
      item('q = dI(q)/dt', 38, 60), item(' with ', 98, 25), item('I(q) = ∫ F', 123, 50),
      item('1', 173, 4), item('(q)', 177, 14)
    ];

    const match = locateSelectionItems(items, 'F1(q)q = dI(q)/dt with I(q) = ∫F1(q)');

    expect(match).toMatchObject({ start: 0, end: 8, exact: true });
  });

  it('recovers a leading equation skipped by a fallback prose anchor', () => {
    const items = [
      item('H ≡ π(x) φ(x) − L(φ, π)', 100, 170, 520),
      item('(2.48)', 430, 35, 520),
      item('is the Hamiltonian density. The Hamiltonian is a local functional of the fields.', 10, 390, 490),
      item('Given two functionals:', 10, 120, 470),
      item('A[π, φ] = d3x a(π, φ)', 120, 170, 450),
      item('In particular the final conclusion follows from this definition.', 10, 310, 430)
    ];
    const copiedText = [
      'H≡π(x) φ(x)−L(φ,π) (2.48)',
      items[2].str,
      items[3].str,
      'A[π,φ] = a(π,φ) d3x',
      items[5].str
    ].join(' ');
    const regions = [
      { x: 95, y: 65, width: 185, height: 30, kind: 'display', confidence: .92 }
    ];

    const selection = locateSelectionItems(items, copiedText);
    const segments = buildSelectionSegments(items, viewport, regions, selection);

    expect(selection).toMatchObject({ start: 0, startChar: 0, exact: false });
    expect(segments[0].type).toBe('math');
  });

  it('moves a split right-side equation label onto the display equation', () => {
    const items = [
      item('E = mc2', 100, 80, 500),
      item('(', 430, 4, 500),
      item('A', 434, 6, 500),
      item('.', 440, 3, 500),
      item('3a', 443, 10, 500),
      item(')', 453, 4, 500)
    ];
    const selection = {
      start: 0,
      end: items.length - 1,
      startChar: 0,
      endChar: items.at(-1).str.length
    };
    const regions = [
      { x: 95, y: 86, width: 90, height: 20, kind: 'display', confidence: .94 }
    ];

    const segments = buildSelectionSegments(items, viewport, regions, selection);

    expect(segments).toEqual([{
      type: 'math',
      region: regions[0],
      regionIndex: 0,
      equationLabel: '(A.3a)'
    }]);
  });

  it('accepts a bare equation label only beside a display equation', () => {
    const items = [
      item('F(x) = 0', 100, 80, 500),
      item('4.2', 430, 18, 500),
      item('A prose reference [7] remains here.', 10, 180, 475)
    ];
    const selection = {
      start: 0,
      end: items.length - 1,
      startChar: 0,
      endChar: items.at(-1).str.length
    };
    const regions = [
      { x: 95, y: 86, width: 90, height: 20, kind: 'display', confidence: .94 }
    ];

    const segments = buildSelectionSegments(items, viewport, regions, selection);
    const text = segments.filter(segment => segment.type === 'text')
      .map(segment => segment.value)
      .join(' ');

    expect(segments[0]).toMatchObject({ type: 'math', equationLabel: '4.2' });
    expect(text).toContain('[7]');
    expect(text).not.toContain('4.2');
  });

  it('does not include a preceding equation when the selection starts with prose', () => {
    const items = [
      item('H ≡ π(x) φ(x) − L(φ, π)', 100, 170, 520),
      item('(2.48)', 430, 35, 520),
      item('is the Hamiltonian density and the discussion continues here.', 10, 320, 490)
    ];

    const selection = locateSelectionItems(items, items[2].str);

    expect(selection).toMatchObject({ start: 2, startChar: 0, exact: true });
  });

  it('rejects matching anchors when the interior belongs to another passage', () => {
    const items = [
      item('The field is described by', 10, 100),
      item('an unrelated discussion from another chapter', 110, 190),
      item('and this proves the result', 300, 120)
    ];

    const match = locateSelectionItems(
      items,
      'The field is described by the Hamiltonian and its spectrum in the selected section and this proves the result'
    );

    expect(match).toBeNull();
  });

  it('locates a long PDF selection when copied text omits the final display equation', () => {
    const items = [
      item('In the Lagrangian description of field theory, the coordinates are treated equally.', 10, 350),
      item('The Hamiltonian approach singles out the time coordinate among spacetime coordinates.', 10, 350),
      item('This formalism is based on a choice of time slicing and a Lagrangian density.', 10, 350),
      item('The canonically conjugated momentum is naturally defined by', 10, 280),
      item('pi(x) = dL / d phi(x)', 120, 130),
      item('which extends the ordinary derivative to a functional derivative.', 10, 300),
      item('The relation is inverted at each point to express the field in terms of momentum.', 10, 370),
      item('phi(x) maps to phi(pi(x), phi(x))', 120, 180),
      item('The Hamiltonian is defined in analogy with mechanics by a Legendre transform:', 10, 360),
      item('H(pi, phi) = integral d3x (pi(x) phi(x) - L(phi, pi))', 90, 300),
      item('(2.47)', 430, 35),
      item('where:', 10, 35)
    ];
    const copiedText = [
      items[0].str,
      items[1].str,
      items[2].str,
      items[3].str,
      items[4].str,
      items[5].str,
      items[6].str,
      items[7].str,
      items[8].str,
      'where:'
    ].join(' ');

    const match = locateSelectionItems(items, copiedText);

    expect(match).toMatchObject({
      start: 0,
      end: 11,
      exact: false,
      aligned: true
    });
    expect(match.coverage).toBeGreaterThan(.8);
  });

  it('locates a PDF selection when the browser removes spaces between prose words', () => {
    const items = [
      item('It should be appreciated that the least action principle in field theory ', 10, 340),
      item('is the natural generalization of mechanics.', 10, 220),
      item('delta phi(x, ti) = delta phi(x, tf) = 0', 80, 220),
      item('and the linear variation of the action is', 10, 210),
      item('integral d4x partial L partial phi', 80, 190),
      item('from which we draw the same conclusions as in our previous general discussion.', 10, 380),
      item('The expression in brackets defines the functional derivative.', 10, 300),
      item('delta S / delta phi = partial L / partial phi', 80, 240),
      item('The concept is straightforwardly generalised to arbitrary space dimensions.', 10, 370),
      item('F[phi] = integral dnx f(phi)', 80, 180),
      item('Then:', 10, 35)
    ];
    const copiedText = [
      'Itshouldbeappreciatedthattheleastactionprincipleinfieldtheory',
      'isthenaturalgeneralizationofmechanics.',
      'unreliable-math-glyphs',
      'andthelinearvariationoftheactionis',
      'different-integral-order',
      'fromwhichwedrawthesameconclusionsasinourpreviousgeneraldiscussion.',
      'Theexpressioninbracketsdefinesthefunctionalderivative.',
      'another-broken-formula',
      'Theconceptisstraightforwardlygeneralisedtoarbitraryspacedimensions.',
      'unreadable-final-formula',
      'Then:'
    ].join(' ');

    const match = locateSelectionItems(items, copiedText);

    expect(match).toMatchObject({
      start: 0,
      end: 10,
      exact: false,
      characterAligned: true
    });
    expect(match.coverage).toBeGreaterThan(.64);
  });

  it('selects the strongest page match instead of the first partial match', () => {
    const weak = {
      pageNumber: 12,
      selection: { exact: false, score: .62, coverage: .55 }
    };
    const correct = {
      pageNumber: 73,
      selection: { exact: false, score: .91, coverage: .88 }
    };

    expect(chooseSelectionCandidate([weak, correct])).toBe(correct);
  });

  it('refuses two similarly plausible pages without a reliable hint', () => {
    const first = {
      pageNumber: 12,
      selection: { exact: false, score: .84, coverage: .8 }
    };
    const second = {
      pageNumber: 73,
      selection: { exact: false, score: .81, coverage: .79 }
    };

    expect(chooseSelectionCandidate([first, second])).toBeNull();
    expect(chooseSelectionCandidate([first, second], 73)).toBe(second);
  });

  it('uses a reliable page hint when repeated text is exact elsewhere', () => {
    const repeated = {
      pageNumber: 12,
      selection: { exact: true, score: 1, coverage: 1 }
    };
    const visiblePage = {
      pageNumber: 73,
      selection: { exact: false, score: .94, coverage: .91 }
    };

    expect(chooseSelectionCandidate([repeated, visiblePage])).toBeNull();
    expect(chooseSelectionCandidate([repeated, visiblePage], 73)).toBe(visiblePage);
  });

  it('confirms a weak inline formula from fragmented PDF math glyphs', () => {
    const items = [
      { ...item('variables ', 10, 45), fontName: 'prose' },
      { ...item('q', 55, 5), fontName: 'math' },
      { ...item('a', 60, 4, 502), height: 7, fontName: 'subscript' },
      { ...item(' continue', 64, 45), fontName: 'prose' }
    ];
    const regions = [
      { x: 54, y: 86, width: 12, height: 18, kind: 'inline', confidence: .69 }
    ];

    expect(confirmWeakMathRegions(items, viewport, regions)).toEqual(regions);
  });

  it('rejects a weak detector box over an italic prose word', () => {
    const items = [
      { ...item('ordinary text ', 10, 70), fontName: 'prose' },
      { ...item('remarkably', 80, 55), fontName: 'italic' },
      { ...item(' unchanged', 135, 50), fontName: 'prose' }
    ];
    const regions = [
      { x: 79, y: 86, width: 57, height: 18, kind: 'inline', confidence: .69 }
    ];

    expect(confirmWeakMathRegions(items, viewport, regions)).toEqual([]);
  });

  it('keeps every high-confidence visual region without text confirmation', () => {
    const regions = [
      { x: 200, y: 200, width: 50, height: 20, kind: 'display', confidence: .9 }
    ];

    expect(confirmWeakMathRegions([], viewport, regions)).toEqual(regions);
  });

  it('removes a weak box that redundantly encloses two stronger formulas', () => {
    const items = [
      { ...item('operators ', 10, 45), fontName: 'prose' },
      { ...item('ˆ', 55, 5), fontName: 'math' },
      { ...item('q', 55, 5), fontName: 'math' },
      { ...item('a', 60, 4, 502), height: 7, fontName: 'subscript' },
      { ...item('ˆ', 75, 5), fontName: 'math' },
      { ...item('p', 75, 5), fontName: 'math' },
      { ...item('a', 80, 4, 502), height: 7, fontName: 'subscript' }
    ];
    const first = { x: 54, y: 86, width: 12, height: 18, kind: 'inline', confidence: .52 };
    const second = { x: 74, y: 86, width: 12, height: 18, kind: 'inline', confidence: .46 };
    const enclosing = { x: 54, y: 85, width: 34, height: 20, kind: 'inline', confidence: .42 };

    expect(confirmWeakMathRegions(items, viewport, [first, second, enclosing]))
      .toEqual([first, second]);
  });

  it('replaces every detected formula with a math segment and preserves intervening prose', () => {
    const items = [
      item('Notice derivative ', 10, 85),
      item('F1(q)q = dI(q)/dt', 95, 105),
      item(' with ', 200, 30),
      item('I(q) = ∫ F1(q)). Thus', 230, 125),
      item(' the result follows.', 355, 90)
    ];
    const selection = locateSelectionItems(
      items,
      'Notice derivative F1(q)q = dI(q)/dt with I(q) = ∫ F1(q)). Thus the result follows.'
    );
    const regions = [
      { x: 94, y: 86, width: 108, height: 20, kind: 'inline', confidence: .93 },
      { x: 229, y: 86, width: 86, height: 20, kind: 'inline', confidence: .93 }
    ];

    const segments = buildSelectionSegments(items, viewport, regions, selection);
    const visibleText = segments.filter(segment => segment.type === 'text')
      .map(segment => segment.value)
      .join(' ');

    expect(segments.filter(segment => segment.type === 'math')).toHaveLength(2);
    expect(visibleText).toContain('Notice derivative');
    expect(visibleText).toContain('with');
    expect(visibleText).toContain('Thus the result follows.');
    expect(visibleText).not.toContain('dI(q)');
    expect(visibleText).not.toContain('∫');
  });

  it('turns an isolated Greek symbol into a math segment instead of text', () => {
    const items = [item('a scalar field ', 10, 70), item('ϕ', 80, 8), item('(x).', 88, 18)];
    const selection = locateSelectionItems(items, 'a scalar field ϕ(x).');
    const regions = [
      { x: 79, y: 86, width: 27, height: 20, kind: 'inline', confidence: .91 }
    ];

    const segments = buildSelectionSegments(items, viewport, regions, selection);

    expect(segments.some(segment => segment.type === 'math')).toBe(true);
    expect(segments.filter(segment => segment.type === 'text').map(segment => segment.value).join(' '))
      .not.toContain('ϕ');
  });

  it('keeps a vertically shifted integral inside its detected formula', () => {
    const items = [
      item('I(q) = ', 10, 35),
      item('∫', 45, 7, 492),
      item('F1(q)', 52, 28)
    ];
    const selection = locateSelectionItems(items, 'I(q) = ∫F1(q)');
    const regions = [
      { x: 9, y: 86, width: 73, height: 20, kind: 'inline', confidence: .93 }
    ];

    const segments = buildSelectionSegments(items, viewport, regions, selection);

    expect(segments).toHaveLength(1);
    expect(segments[0].type).toBe('math');
  });

  it('keeps a raised superscript on the same formula line', () => {
    const items = [
      item('x', 100, 7, 500),
      item('μ', 107, 5, 505),
      item(' follows', 112, 40, 500)
    ];
    const selection = {
      start: 0,
      end: 2,
      startChar: 0,
      endChar: items[2].str.length
    };
    const regions = [
      { x: 99, y: 86, width: 15, height: 20, kind: 'inline', confidence: .94 }
    ];

    const segments = buildSelectionSegments(items, viewport, regions, selection);
    const text = segments.filter(segment => segment.type === 'text')
      .map(segment => segment.value)
      .join(' ');

    expect(segments.filter(segment => segment.type === 'math')).toHaveLength(1);
    expect(text).toBe('follows');
  });

  it('does not let a display equation consume text on the following line', () => {
    const items = [
      item('display equation', 100, 120, 520),
      item('which shows that the action continues', 100, 190, 490)
    ];
    const selection = {
      start: 0,
      end: 1,
      startChar: 0,
      endChar: items[1].str.length
    };
    const regions = [
      { x: 95, y: 65, width: 130, height: 25, kind: 'display', confidence: .94 }
    ];

    const segments = buildSelectionSegments(items, viewport, regions, selection);
    const text = segments.filter(segment => segment.type === 'text')
      .map(segment => segment.value)
      .join(' ');

    expect(text).toContain('which shows that the action continues');
  });

  it('does not let an inline equation consume text on the following line', () => {
    const items = [
      item('f(k)', 250, 20, 500),
      item('without spin', 250, 65, 476)
    ];
    const selection = {
      start: 0,
      end: 1,
      startChar: 0,
      endChar: items[1].str.length
    };
    const regions = [
      { x: 249, y: 86, width: 22, height: 20, kind: 'inline', confidence: .94 }
    ];

    const segments = buildSelectionSegments(items, viewport, regions, selection);
    const text = segments.filter(segment => segment.type === 'text')
      .map(segment => segment.value)
      .join(' ');

    expect(text).toContain('without spin');
  });

  it('marks a larger PDF line gap as a paragraph boundary', () => {
    const first = {
      ...item('First paragraph ends here.', 10, 160, 500),
      hasEOL: true
    };
    const second = item('Second paragraph starts here.', 10, 170, 480);
    const selection = {
      start: 0,
      end: 1,
      startChar: 0,
      endChar: second.str.length
    };

    const segments = buildSelectionSegments(
      [first, second],
      viewport,
      [],
      selection
    );

    expect(segments).toEqual([
      {
        type: 'text',
        value: first.str,
        paragraphEnd: true
      },
      {
        type: 'text',
        value: second.str,
        paragraphEnd: false
      }
    ]);
  });

  it('keeps ordinary adjacent PDF lines in the same paragraph', () => {
    const first = {
      ...item('First visual line', 10, 100, 500),
      hasEOL: true
    };
    const second = item('continues on the next line.', 10, 150, 488);
    const selection = {
      start: 0,
      end: 1,
      startChar: 0,
      endChar: second.str.length
    };

    const segments = buildSelectionSegments(
      [first, second],
      viewport,
      [],
      selection
    );

    expect(segments).toEqual([{
      type: 'text',
      value: 'First visual line continues on the next line.',
      paragraphEnd: false
    }]);
  });

  it('reconstructs a word hyphenated between adjacent PDF lines', () => {
    const first = {
      ...item('called the Lagrange equa-', 10, 150, 500),
      hasEOL: true
    };
    const second = item('tions. The principle follows.', 10, 170, 488);
    const selection = {
      start: 0,
      end: 1,
      startChar: 0,
      endChar: second.str.length
    };

    const segments = buildSelectionSegments(
      [first, second],
      viewport,
      [],
      selection
    );

    expect(segments).toEqual([{
      type: 'text',
      value: 'called the Lagrange equations. The principle follows.',
      paragraphEnd: false
    }]);
  });

  it('keeps an intentional compound on one token across PDF lines', () => {
    const first = {
      ...item('a well-', 10, 80, 500),
      hasEOL: true
    };
    const second = item('known result', 10, 90, 488);
    const selection = {
      start: 0,
      end: 1,
      startChar: 0,
      endChar: second.str.length
    };

    const segments = buildSelectionSegments(
      [first, second],
      viewport,
      [],
      selection
    );

    expect(segments[0].value).toBe('a well-known result');
  });
});
