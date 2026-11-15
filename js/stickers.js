// Sticker catalog: cute emoji, food / drink / animal emoji, washi tape strips and junk-journal bits.
// A sticker is stored as { id, k, x, y, rot, size } where k is a key from this catalog.
// Older cover stickers were stored as { ch: '☕' }; those still work as 'e:☕'.
const Stickers = (() => {
  const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const CUTE = ['☕', '🥤', '🍵', '🥐', '🍰', '🍩', '🧁', '🍪', '🍓', '🌸', '🌷', '⭐', '✨', '💗', '🎀', '🐈', '🍋', '🍮','🌼', '🍒'];

  // Every food, drink and animal emoji (Unicode 15.1, shown on iPhone/iPad with iOS 17.4 or newer).
  const FOOD = [
    // fruit
    '🍇', '🍈', '🍉', '🍊', '🍋', '🍋‍🟩', '🍌', '🍍', '🥭', '🍎', '🍏', '🍐', '🍑', '🍒', '🍓', '🫐', '🥝', '🍅', '🫒', '🥥',
    // vegetables
    '🥑', '🍆', '🥔', '🥕', '🌽', '🌶️', '🫑', '🥒', '🥬', '🥦', '🧄', '🧅', '🍄', '🍄‍🟫', '🥜', '🫘', '🌰', '🫚', '🫛',
    // prepared
    '🍞', '🥐', '🥖', '🫓', '🥨', '🥯', '🥞', '🧇', '🧀', '🍖', '🍗', '🥩', '🥓', '🍔', '🍟', '🍕', '🌭', '🥪', '🌮', '🌯',
    '🫔', '🥙', '🧆', '🥚', '🍳', '🥘', '🍲', '🫕', '🥣', '🥗', '🍿', '🧈', '🧂', '🥫',
    // asian
    '🍱', '🍘', '🍙', '🍚', '🍛', '🍜', '🍝', '🍠', '🍢', '🍣', '🍤', '🍥', '🥮', '🍡', '🥟', '🥠', '🥡', '🦪',
    // sweets
    '🍦', '🍧', '🍨', '🍩', '🍪', '🎂', '🍰', '🧁', '🥧', '🍫', '🍬', '🍭', '🍮', '🍯',
  ];
  const DRINKS = ['☕', '🫖', '🍵', '🧋', '🥤', '🧃', '🧉', '🥛', '🍼', '🍶', '🍾', '🍷', '🍸', '🍹', '🍺', '🍻', '🥂', '🥃', '🫗', '🧊'];
  const ANIMALS = [
    // mammals
    '🐵', '🐒', '🦍', '🦧', '🐶', '🐕', '🦮', '🐕‍🦺', '🐩', '🐺', '🦊', '🦝', '🐱', '🐈', '🐈‍⬛', '🦁', '🐯', '🐅', '🐆', '🐴',
    '🫎', '🫏', '🐎', '🦄', '🦓', '🦌', '🦬', '🐮', '🐂', '🐃', '🐄', '🐷', '🐖', '🐗', '🐽', '🐏', '🐑', '🐐', '🐪', '🐫',
    '🦙', '🦒', '🐘', '🦣', '🦏', '🦛', '🐭', '🐁', '🐀', '🐹', '🐰', '🐇', '🐿️', '🦫', '🦔', '🦇', '🐻', '🐻‍❄️', '🐨', '🐼',
    '🦥', '🦦', '🦨', '🦘', '🦡', '🐾',
    // birds
    '🦃', '🐔', '🐓', '🐣', '🐤', '🐥', '🐦', '🐧', '🕊️', '🦅', '🦆', '🦢', '🦉', '🦤', '🦩', '🦚', '🦜', '🐦‍⬛', '🪿', '🐦‍🔥',
    // amphibians and reptiles
    '🐸', '🐊', '🐢', '🦎', '🐍', '🐲', '🐉', '🦕', '🦖',
    // sea
    '🐳', '🐋', '🐬', '🦭', '🐟', '🐠', '🐡', '🦈', '🐙', '🦑', '🦐', '🦞', '🦀', '🪼', '🐚',
    // bugs
    '🐌', '🦋', '🐛', '🐜', '🐝', '🪲', '🐞', '🦗', '🪳', '🕷️', '🦂', '🦟', '🪰', '🪱',
  ];

  // washi: [key, tape colour, pattern]
  const WASHI = [
    ['pink-dots', '#f4a9bd', 'dots'], ['blue-stripe', '#a9cfee', 'stripe'], ['green-grid', '#b1dbb6', 'grid'],
    ['orange-check', '#f9c193', 'check'], ['cream-plain', '#efe3c8', 'plain'], ['ink-dots', '#5b4b43', 'dots'],
    ['pink-hearts', '#f4a9bd', 'hearts'], ['blue-cafe', '#a9cfee', 'cafe'], ['green-stripe', '#b1dbb6', 'stripe'],
    ['orange-dots', '#f9c193', 'dots'], ['lilac-grid', '#d6c4ec', 'grid'], ['kraft-cafe', '#d6b58a', 'cafe'],
  ];

  // junk journal: [key, inner html]
  const JUNK = [
    ['ticket', '<span class="jj ticket"><i>admit</i><b>ONE</b><i>no. 0427</i></span>'],
    ['stamp', '<span class="jj stamp"><span class="stamp-in"><span class="stamp-ico">☕</span><small>café post · 25</small></span></span>'],
    ['roundstamp', '<span class="jj roundstamp"><span>café</span><b>★ approved ★</b><span>club</span></span>'],
    ['label', '<span class="jj label">no. 07</span>'],
    ['receipt', '<span class="jj receipt"><b>CAFE</b><span>1 × latte <em>4.50</em></span><span>1 × treat <em>3.25</em></span><span class="tot">total <em>7.75</em></span><span>thank you!</span></span>'],
    ['sticky', '<span class="jj sticky">remember<br>this one ♡</span>'],
    ['airmail', '<span class="jj airmail"><span>par avion</span></span>'],
    ['tag', '<span class="jj luggage">fave ♡</span>'],
    ['burst', '<span class="jj burst"><span>10/10</span></span>'],
    ['ring', '<span class="jj ring"></span>'],
    ['scrap', '<span class="jj scrap">good coffee,<br>good day</span>'],
    ['bubble', '<span class="jj bubble">yum!</span>'],
    ['clip', '<span class="jj clip"><svg viewBox="0 0 24 64" aria-hidden="true"><path d="M8 50V12a6 6 0 0 1 12 0v40a9 9 0 0 1-18 0V18" fill="none" stroke="#9a948e" stroke-width="2.6" stroke-linecap="round"/></svg></span>'],
    ['kraft', '<span class="jj kraft"><b>est.</b> coffee lover</span>'],
    ['flower', '<span class="jj pressed">✿</span>'],
    ['xoxo', '<span class="jj xoxo">x o x o</span>'],
  ];

  const SETS = {
    cute: CUTE.map(c => 'e:' + c),
    food: FOOD.map(c => 'e:' + c),
    drinks: DRINKS.map(c => 'e:' + c),
    animals: ANIMALS.map(c => 'e:' + c),
    washi: WASHI.map(w => 'w:' + w[0]),
    junk: JUNK.map(j => 'j:' + j[0]),
  };
  const washiBy = Object.fromEntries(WASHI.map(w => [w[0], w]));
  const junkBy = Object.fromEntries(JUNK);

  const keyOf = s => s.k || (s.ch ? 'e:' + s.ch : 'e:☕');
  const kindOf = k => (k[0] === 'w' ? 'washi' : k[0] === 'j' ? 'junk' : 'cute');

  function inner(k) {
    const [type, id] = [k[0], k.slice(2)];
    if (type === 'w') {
      const w = washiBy[id] || WASHI[0];
      return `<span class="washi p-${w[2]}" style="--tc:${w[1]}"></span>`;
    }
    if (type === 'j') return junkBy[id] || '';
    return `<span class="emoji">${esc(id)}</span>`;
  }

  function html(s, selected) {
    const k = keyOf(s);
    return `<span class="sticker k-${kindOf(k)}${selected ? ' sel' : ''}" data-id="${esc(s.id)}" style="left:${s.x}%;top:${s.y}%;--r:${s.rot || 0}deg;--s:${s.size || 1}">${inner(k)}</span>`;
  }

  return { SETS, html, inner, kindOf, keyOf };
})();
