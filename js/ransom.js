// Ransom-letter text: every letter is its own little magazine cutout.
// The look is seeded by the text itself, so a name always renders the same way.
const Ransom = (() => {
  const FONTS = [
    "'Abril Fatface', Georgia, serif",
    "'Anton', Impact, sans-serif",
    "'Bungee', 'Arial Black', sans-serif",
    "'Special Elite', 'Courier New', monospace",
    "'Permanent Marker', cursive",
    "Georgia, 'Times New Roman', serif",
    "'Courier New', monospace",
  ];
  const INK = '#3b302b';
  // [background, letter colour]
  const TILES = [
    ['#f9c6d3', INK], ['#fdfbf5', INK], ['#bcdcf5', INK], ['#c5e6c8', INK], ['#fdd3ae', INK],
    ['#f9c6d3', INK], ['#bcdcf5', INK], ['#c5e6c8', INK], ['#fdd3ae', INK],
    [INK, '#fdd3ae'], [INK, '#f9c6d3'],
  ];

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function rng(seed) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function esc(s) {
    return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // colours a letter can be set to (paper and ink), by name
  const COLORS = { pink: '#f9c6d3', white: '#fdfbf5', blue: '#bcdcf5', green: '#c5e6c8', orange: '#fdd3ae', ink: INK };

  // styles: optional array (one per letter, spaces not counted) of { bg, fg, font, upper }
  //   bg/fg = COLORS key, font = FONTS index, upper = true/false. Anything left out stays the seeded default.
  // sel: index of a letter to mark as selected (cover editor)
  function html(text, styles, sel) {
    const rand = rng(hash(text));
    let lastTile = -1, i = 0;
    return text.trim().split(/\s+/).filter(Boolean).map(word => {
      const letters = [...word].map(ch => {
        let tile;
        do { tile = Math.floor(rand() * TILES.length); } while (tile === lastTile);
        lastTile = tile;
        let [bg, fg] = TILES[tile];
        let font = FONTS[Math.floor(rand() * FONTS.length)];
        const rot = (rand() * 12 - 6).toFixed(1);
        const size = (0.85 + rand() * 0.4).toFixed(2);
        const lift = (rand() * 0.16 - 0.08).toFixed(2);
        let upper = rand() < 0.45;
        const s = styles && styles[i];
        if (s) {
          if (COLORS[s.bg]) bg = COLORS[s.bg];
          if (COLORS[s.fg]) fg = COLORS[s.fg];
          if (FONTS[s.font]) font = FONTS[s.font];
          if (typeof s.upper === 'boolean') upper = s.upper;
        }
        const shown = upper ? ch.toUpperCase() : ch.toLowerCase();
        const idx = i++;
        return `<span class="rl${idx === sel ? ' sel' : ''}" data-li="${idx}" style="background:${bg};color:${fg};font-family:${font};font-size:${size}em;transform:translateY(${lift}em) rotate(${rot}deg)">${esc(shown)}</span>`;
      }).join('');
      return `<span class="rw">${letters}</span>`;
    }).join(' ');
  }

  // the look a letter currently has, so the editor can show it as selected
  function current(text, styles, index) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html(text, styles);
    const node = tmp.querySelector(`[data-li="${index}"]`);
    if (!node) return null;
    const hexToKey = hex => Object.keys(COLORS).find(k => COLORS[k].toLowerCase() === hex.toLowerCase());
    const st = node.getAttribute('style');
    const pick = prop => (st.match(new RegExp(`(?:^|;)${prop}:([^;]+)`)) || [])[1];
    return {
      bg: hexToKey(pick('background')),
      fg: hexToKey(pick('color')),
      font: FONTS.indexOf(pick('font-family')),
      upper: node.textContent === node.textContent.toUpperCase() && node.textContent !== node.textContent.toLowerCase(),
      ch: node.textContent,
    };
  }

  return { html, esc, current, FONTS, COLORS };
})();
