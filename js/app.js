(() => {
  const PASTELS = { pink: '#f9c6d3', white: '#fdfbf5', blue: '#bcdcf5', green: '#c5e6c8', orange: '#fdd3ae' };
  // star fills: the same pastels, a few shades deeper so a rating stands out on the cream page
  const STAR_COLORS = { pink: '#f392b0', white: '#ffffff', blue: '#86bce8', green: '#86c991', orange: '#f6a466' };
  const STAR_PATH = 'M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z';
  const MAX_PHOTOS = 3;
  const esc = Ransom.esc;

  const $ = sel => document.querySelector(sel);
  const book = $('#book');
  const topbar = $('#topbar');
  const pager = $('#pager');
  const decor = $('#decor');

  let entries = [];
  let cover = { color: 'pink', title: 'cafe log', stickers: [], photo: null };
  let settings = { sound: true };
  let pos = 0;            // 0 = cover, 1..n = cafe pages, n+1 = blank page at the back
  let mode = 'read';      // read | edit | decorate
  let draft = null;       // entry being edited
  let anim = false;
  let selSticker = null;
  let selLetter = null;   // index of the cover-title letter being styled
  let stickerMode = false; // sticker drawer open while editing a page
  let stickerTab = 'food'; // food | drinks | animals | hearts | flowers | sky | other | washi
  let selPhoto = null;     // index of the page photo being resized / tilted
  let selCoverPhoto = false; // cover photo being resized / tilted
  const coverPhotoFx = () => ({ size: 1, rot: -3, x: 50, y: 56, ...(cover.photoFx || {}) });
  const coverPhotoTransform = () => { const f = coverPhotoFx(); return `translate(-50%, -50%) rotate(${f.rot}deg) scale(${f.size})`; };

  const lastLeaf = () => entries.length + 1;
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function sortEntries() {
    entries.sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || (a.createdAt || 0) - (b.createdAt || 0));
  }

  function prettyDate(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    return `${days[dt.getDay()]} · ${d} ${months[m - 1]} ${y}`;
  }

  function todayIso() {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  }

  // ---------- leaves ----------

  function coverLeaf() {
    const leaf = el(`<div class="leaf cover" style="--c:${PASTELS[cover.color] || PASTELS.pink}">
      <div class="cover-title ransom">${titleHtml()}</div>
      ${cover.photo ? `<div class="ph cover-photo${mode === 'decorate' && selCoverPhoto ? ' sel' : ''}" style="left:${coverPhotoFx().x}%;top:${coverPhotoFx().y}%;transform:${coverPhotoTransform()}"><img src="${cover.photo}" alt=""></div>` : ''}
      ${cover.stickers.map(s => Stickers.html(s, mode === 'decorate' && s.id === selSticker)).join('')}    </div>`);
    return leaf;
  }

  function starsHtml(rating) {
    let out = '';
    for (let i = 1; i <= 5; i++) {
      const part = Math.max(0, Math.min(1, rating - (i - 1)));
      out += `<span class="star">
        <svg class="fill" viewBox="0 0 24 24" style="clip-path:inset(0 ${100 - part * 100}% 0 0)"><path d="${STAR_PATH}"/></svg>
        <svg class="outline" viewBox="0 0 24 24"><path d="${STAR_PATH}"/></svg>
      </span>`;
    }
    return out;
  }

  // each photo's size and tilt; photos never adjusted keep their slightly scattered default look
  const PHOTO_TILT = [-2.5, 3, -1.5];
  const photoFx = (e, i) => ({ size: 1, rot: PHOTO_TILT[i] || 0, ...((e.photoFx || [])[i] || {}) });

  function photosHtml(e, editable) {
    const photos = e.photos || [];
    let inner = photos.map((src, i) => {
      const fx = photoFx(e, i);
      const sel = editable && selPhoto === i;
      return `<div class="ph${sel ? ' sel' : ''}" data-pi="${i}" style="transform:rotate(${fx.rot}deg) scale(${fx.size})${sel ? ';z-index:3' : ''}"><img src="${src}" alt="">${editable ? `<button class="rm" data-rm="${i}" aria-label="remove photo">×</button>` : ''}</div>`;
    }).join('');
    if (editable && photos.length < MAX_PHOTOS) inner += `<button class="ph empty" data-act="add-photo">+ photo</button>`;
    if (!editable && !photos.length) inner = `<div class="ph empty">photo</div>`;
    const n = Math.min(MAX_PHOTOS, photos.length + (editable && photos.length < MAX_PHOTOS ? 1 : 0)) || 1;
    return `<div class="photos n${n}">${inner}</div>`;
  }

  // placing = sticker drawer open: draw the page exactly as it will look once saved
  // (only the real photos, no "+ photo" slot or edit fields) so stickers land where you expect
  function pageLeaf(e, editable, placing) {
    const rating = e.rating || 0;
    const leaf = el(`<div class="leaf page${editable ? ' editing' : ''}${placing ? ' sticker-mode' : ''}" style="--star:${STAR_COLORS[e.starColor] || STAR_COLORS.pink}">
      <div class="row date">
        <span class="tag blue">date</span>
        <span class="hand view-only">${esc(prettyDate(e.date))}</span>
        <input class="in edit-only" type="date" data-f="date" value="${esc(e.date || '')}">
      </div>
      ${photosHtml(e, editable)}
      <div class="cafe">
        <div class="ransom view-only${e.name ? '' : ' placeholder'}">${Ransom.html(e.name || 'cafe name')}</div>
        <input class="in edit-only" data-f="name" placeholder="name of cafe" value="${esc(e.name || '')}" maxlength="40" autocomplete="off">
      </div>
      <div class="row">
        <span class="tag green">city</span>
        <input class="in" data-f="city" placeholder="where was it?" value="${esc(e.city || '')}" maxlength="40" autocomplete="off"${editable ? '' : ' readonly tabindex="-1"'}>
      </div>
      <div class="row">
        <div class="stars" role="slider" aria-label="rating" aria-valuemin="0" aria-valuemax="5" aria-valuenow="${rating}">${starsHtml(rating)}</div>
        <span class="hand rating-num">${rating ? rating : ''}</span>
        <div class="dots edit-only">${Object.keys(PASTELS).map(c =>
          `<button class="dot${(e.starColor || 'pink') === c ? ' on' : ''}" data-color="${c}" style="background:${STAR_COLORS[c]}" aria-label="${c} stars"></button>`).join('')}</div>
      </div>
      <div class="row">
        <span class="tag orange">drink</span>
        <input class="in" data-f="drink" placeholder="what did you order?" value="${esc(e.drink || '')}" maxlength="50" autocomplete="off"${editable ? '' : ' readonly tabindex="-1"'}>
      </div>
      <div class="notes">
        <span class="tag">notes</span>
        <textarea class="in" data-f="notes" placeholder="a few thoughts…" maxlength="400"${editable ? '' : ' readonly tabindex="-1"'}>${esc(e.notes || '')}</textarea>
      </div>
      ${(e.stickers || []).map(s => Stickers.html(s, placing && s.id === selSticker)).join('')}
    </div>`);
    if (editable) bindEditing(leaf);
    return leaf;
  }

  function blankLeaf() {
    return el(`<div class="leaf page blank">
      <div class="ransom">${Ransom.html(entries.length ? 'new page' : 'first page')}</div>
      <p>${entries.length ? 'been somewhere new?' : 'your journal is empty — log your first cafe'}</p>
      <button class="btn pink" data-act="new">+ add a cafe</button>
    </div>`);
  }

  function leafFor(i) {
    if (i === 0) return coverLeaf();
    if (mode === 'edit' && i === pos) return stickerMode ? pageLeaf(draft, false, true) : pageLeaf(draft, true);
    if (i <= entries.length) return pageLeaf(entries[i - 1], false);
    return blankLeaf();
  }

  // ---------- editing a page ----------

  function bindEditing(leaf) {
    leaf.querySelectorAll('[data-f]').forEach(input => {
      input.addEventListener('input', () => { draft[input.dataset.f] = input.value; });
    });

    leaf.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      const i = Number(b.dataset.rm);
      draft.photos.splice(i, 1);
      if (draft.photoFx) draft.photoFx.splice(i, 1);
      selPhoto = null;
      render();
    }));

    // tap a photo to resize / tilt it
    leaf.querySelectorAll('.ph[data-pi]').forEach(p => p.addEventListener('click', e => {
      if (stickerMode || e.target.closest('.rm')) return;
      const i = Number(p.dataset.pi);
      selPhoto = selPhoto === i ? null : i;
      render();
    }));

    leaf.querySelectorAll('.dot').forEach(d => d.addEventListener('click', () => {
      draft.starColor = d.dataset.color;
      leaf.style.setProperty('--star', STAR_COLORS[draft.starColor]);
      leaf.querySelectorAll('.dot').forEach(x => x.classList.toggle('on', x === d));
    }));

    const stars = leaf.querySelector('.stars');
    const num = leaf.querySelector('.rating-num');
    let startRating = 0, moved = false, down = false;
    const valueAt = x => {
      const r = stars.getBoundingClientRect();
      const v = Math.ceil(((x - r.left) / r.width) * 10) / 2;
      return Math.max(0.5, Math.min(5, v));
    };
    const paint = v => {
      draft.rating = v;
      stars.innerHTML = starsHtml(v);
      stars.setAttribute('aria-valuenow', v);
      num.textContent = v ? v : '';
    };
    stars.addEventListener('pointerdown', e => {
      down = true; moved = false; startRating = draft.rating || 0;
      stars.setPointerCapture(e.pointerId);
      paint(valueAt(e.clientX));
    });
    stars.addEventListener('pointermove', e => {
      if (!down) return;
      const v = valueAt(e.clientX);
      if (v !== draft.rating) { moved = true; paint(v); }
    });
    const end = () => {
      if (!down) return;
      down = false;
      // tapping the rating that is already set clears it
      if (!moved && draft.rating === startRating) paint(0);
    };
    stars.addEventListener('pointerup', end);
    stars.addEventListener('pointercancel', end);
  }

  function startEdit(entry) {
    draft = entry
      ? { ...entry, photos: [...(entry.photos || [])], photoFx: (entry.photoFx || []).map(f => f && { ...f }), stickers: (entry.stickers || []).map(s => ({ ...s })) }
      : { id: uid(), createdAt: Date.now(), date: todayIso(), name: '', city: '', drink: '', notes: '', rating: 0, starColor: 'pink', photos: [], stickers: [] };
    draft.isNew = !entry;
    mode = 'edit';
    stickerMode = false; selSticker = null; selPhoto = null;
    render();
  }

  async function saveEdit() {
    const { isNew, ...entry } = draft;
    entry.name = (entry.name || '').trim();
    entry.city = (entry.city || '').trim();
    entry.drink = (entry.drink || '').trim();
    await Store.putEntry(entry);
    const i = entries.findIndex(x => x.id === entry.id);
    if (i >= 0) entries[i] = entry; else entries.push(entry);
    sortEntries();
    pos = entries.findIndex(x => x.id === entry.id) + 1;
    mode = 'read'; draft = null; stickerMode = false; selSticker = null; selPhoto = null;
    render();
  }

  function cancelEdit() {
    mode = 'read'; draft = null; stickerMode = false; selSticker = null; selPhoto = null;
    render();
  }

  // in-app yes/no card (the browser's own confirm() is blocked in some app views)
  function ask(title, text, yes, no) {
    return new Promise(resolve => {
      const box = el(`<div class="ask" role="dialog" aria-modal="true">
        <div class="ask-card">
          <div class="ask-title">${Ransom.html(title)}</div>
          <p>${esc(text)}</p>
          <div class="ask-btns">
            <button class="btn" data-a="no">${esc(no)}</button>
            <button class="btn orange" data-a="yes">${esc(yes)}</button>
          </div>
        </div>
      </div>`);
      box.addEventListener('click', e => {
        const a = e.target.closest('[data-a]');
        if (!a && e.target !== box) return;
        box.remove();
        resolve(a ? a.dataset.a === 'yes' : false);
      });
      document.body.append(box);
    });
  }

  // jagged tear line near the spine, as clip-path points from top to bottom
  function tearLine() {
    const pts = [];
    for (let y = 0; y <= 100; y += 2.5 + Math.random() * 2.5) pts.push([7 + Math.random() * 4.5, Math.min(y, 100)]);
    pts[pts.length - 1][1] = 100;
    return pts;
  }
  const poly = pts => `polygon(${pts.map(([x, y]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`).join(',')})`;

  async function tearOut() {
    if (anim) return;
    const ok = await ask('tear it out?', 'This page will be ripped out of your journal for good.', 'tear it out', 'keep it');
    if (!ok) return;

    const id = draft.id;
    mode = 'read'; draft = null; stickerMode = false; selSticker = null; selPhoto = null;
    const torn = leafFor(pos);                       // the page as it looks saved
    await Store.deleteEntry(id);
    entries = entries.filter(x => x.id !== id);
    pos = Math.min(pos, lastLeaf());
    render();                                        // what's underneath (next page)

    anim = true;
    const line = tearLine();
    const stub = el('<div class="torn stub"></div>');
    const piece = el('<div class="torn piece"><div class="torn-inner"></div></div>');
    const stubLeaf = torn.cloneNode(true);
    stubLeaf.style.clipPath = poly([[0, 0], ...line, [0, 100]]);
    stub.append(stubLeaf);
    torn.style.clipPath = poly([...line, [100, 100], [100, 0]]);
    piece.firstElementChild.append(torn);
    book.append(stub, piece);

    tearSound();
    const play = async () => {
      await piece.animate([
        { transform: 'none' },
        { transform: 'translate(1%, -.5%) rotate(1deg)', offset: .15 },
        { transform: 'translate(.5%, 0) rotate(.4deg)', offset: .25 },
        { transform: 'translate(3%, -1%) rotate(3deg)', offset: .45 },
        { transform: 'translate(2.5%, -.5%) rotate(2.4deg)', offset: .55 },
        { transform: 'translate(6%, -2%) rotate(6deg)' },
      ], { duration: 650, easing: 'ease-in', fill: 'forwards' }).finished;
      await piece.animate([
        { transform: 'translate(6%, -2%) rotate(6deg)', opacity: 1 },
        { transform: 'translate(75%, 25%) rotate(32deg) scale(.85)', opacity: 0 },
      ], { duration: 520, easing: 'cubic-bezier(.4,0,.8,.4)', fill: 'forwards' }).finished;
      await stub.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450, delay: 250, fill: 'forwards' }).finished;
    };
    // taps are ignored during the rip, so make sure it always ends (the page is already deleted;
    // this only clears the animation) even if animations stall, e.g. the app is hidden mid-rip
    try {
      await Promise.race([play(), new Promise(r => setTimeout(r, 2600))]);
    } finally {
      stub.remove(); piece.remove();
      anim = false;
    }
  }

  function readImage(file, max) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('could not read image')); };
      img.src = url;
    });
  }

  $('#photo-input').addEventListener('change', async e => {
    const files = [...e.target.files];
    e.target.value = '';
    if (mode !== 'edit') return;
    for (const f of files) {
      if (draft.photos.length >= MAX_PHOTOS) break;
      try { draft.photos.push(await readImage(f, 1000)); } catch { /* skip unreadable file */ }
    }
    render();
  });

  // ---------- cover decorating ----------

  const saveCover = () => Store.setMeta('cover', cover);
  const titleHtml = () => Ransom.html(cover.title || 'cafe log', cover.letters, mode === 'decorate' ? selLetter : null);
  const refreshTitle = () => { const t = book.querySelector('.cover-title'); if (t) t.innerHTML = titleHtml(); };

  function letterEditor() {
    const cur = Ransom.current(cover.title || 'cafe log', cover.letters, selLetter);
    if (!cur) { selLetter = null; return null; }
    const swatches = (field, on) => Object.keys(Ransom.COLORS).map(c =>
      `<button class="swatch${on === c ? ' on' : ''}" data-letter-${field}="${c}" style="background:${Ransom.COLORS[c]}" aria-label="${c}"></button>`).join('');
    return `
      <div class="decor-row"><span class="tag">letter</span>
        <span class="help">“${esc(cur.ch)}”</span>
        <span class="spacer"></span>
        <button class="btn small" data-act="letter-reset">undo style</button>
        <button class="btn small green" data-act="letter-done">done</button>
      </div>
      <div class="decor-row"><span class="tag">paper</span>${swatches('bg', cur.bg)}</div>
      <div class="decor-row"><span class="tag blue">ink</span>${swatches('fg', cur.fg)}</div>
      <div class="decor-row"><span class="tag green">font</span>
        ${Ransom.FONTS.map((f, i) => `<button class="font-btn${cur.font === i ? ' on' : ''}" data-letter-font="${i}" style="font-family:${f}">${esc(cur.ch.toUpperCase() + cur.ch.toLowerCase())}</button>`).join('')}
      </div>
      <div class="decor-row"><span class="tag orange">case</span>
        <button class="font-btn${cur.upper ? ' on' : ''}" data-letter-upper="1">${esc(cur.ch.toUpperCase())}</button>
        <button class="font-btn${cur.upper ? '' : ' on'}" data-letter-upper="0">${esc(cur.ch.toLowerCase())}</button>
      </div>`;
  }

  // stickers being placed right now: the cover's while decorating, the page's while its sticker drawer is open
  const activeStickers = () => mode === 'decorate' ? cover.stickers : (mode === 'edit' && stickerMode ? (draft.stickers = draft.stickers || []) : null);
  const saveStickers = () => { if (mode === 'decorate') saveCover(); };  // page stickers save with "done"
  const selectedSticker = () => (activeStickers() || []).find(s => s.id === selSticker);

  function stickerPanel() {
    const s = selectedSticker();
    const controls = s ? `
      <div class="decor-row st-controls">
        <span class="tag orange">sticker</span>
        <span class="spacer"></span>
        <button class="btn small" data-act="sticker-front">to front</button>
        <button class="btn small pink" data-act="sticker-rm">remove</button>
        <button class="btn small green" data-act="sticker-done">ok</button>
      </div>
      <label class="decor-row slider"><span class="tag">size</span><input type="range" id="st-size" min="0.4" max="3" step="0.05" value="${s.size || 1}"></label>
      <label class="decor-row slider"><span class="tag blue">turn</span><input type="range" id="st-rot" min="-180" max="180" step="1" value="${s.rot || 0}"></label>` : '';
    const tabs = { food: 'food', drinks: 'drinks', animals: 'animals', hearts: 'hearts', flowers: 'flowers', sky: 'sky', other: 'other', washi: 'washi tape' };
    if (!tabs[stickerTab]) stickerTab = 'food';
    return `${controls}
      <div class="decor-row">
        ${s ? '' : '<span class="tag orange">stickers</span>'}
        ${Object.entries(tabs).map(([k, label]) => `<button class="tab-btn${stickerTab === k ? ' on' : ''}" data-sticker-tab="${k}">${label}</button>`).join('')}
      </div>
      <div class="sticker-pick pick-${stickerTab}">${Stickers.SETS[stickerTab].map(k => `<button data-sticker="${esc(k)}" aria-label="add sticker"><span class="prev">${Stickers.inner(k)}</span></button>`).join('')}</div>`;
  }

  function bindStickerControls() {
    const size = $('#st-size'), rot = $('#st-rot');
    if (!size) return;
    const live = () => {
      const s = selectedSticker(); if (!s) return;
      s.size = Number(size.value); s.rot = Number(rot.value);
      const node = book.querySelector(`.sticker[data-id="${CSS.escape(s.id)}"]`);
      if (node) { node.style.setProperty('--s', s.size); node.style.setProperty('--r', s.rot + 'deg'); }
    };
    size.addEventListener('input', live);
    rot.addEventListener('input', live);
    size.addEventListener('change', saveStickers);
    rot.addEventListener('change', saveStickers);
  }

  function photoPanel() {
    const fx = photoFx(draft, selPhoto);
    return `
      <div class="decor-row">
        <span class="tag green">photo ${selPhoto + 1}</span>
        <span class="spacer"></span>
        <button class="btn small" data-act="photo-reset">reset</button>
        <button class="btn small green" data-act="photo-done">ok</button>
      </div>
      <label class="decor-row slider"><span class="tag">size</span><input type="range" id="ph-size" min="0.5" max="1.6" step="0.02" value="${fx.size}"></label>
      <label class="decor-row slider"><span class="tag blue">turn</span><input type="range" id="ph-rot" min="-45" max="45" step="0.5" value="${fx.rot}"></label>`;
  }

  function bindPhotoControls() {
    const size = $('#ph-size'), rot = $('#ph-rot');
    const live = () => {
      draft.photoFx = draft.photoFx || [];
      draft.photoFx[selPhoto] = { size: Number(size.value), rot: Number(rot.value) };
      const node = book.querySelector(`.ph[data-pi="${selPhoto}"]`);
      if (node) node.style.transform = `rotate(${rot.value}deg) scale(${size.value})`;
    };
    size.addEventListener('input', live);
    rot.addEventListener('input', live);
  }

  function renderDecor() {
    const photoOpen = mode === 'edit' && !stickerMode && selPhoto !== null && draft && selPhoto < (draft.photos || []).length;
    decor.hidden = !(mode === 'decorate' || (mode === 'edit' && stickerMode) || photoOpen);
    if (decor.hidden) return;
    if (photoOpen) { decor.innerHTML = photoPanel(); bindPhotoControls(); return; }
    if (mode === 'edit') {
      decor.innerHTML = stickerPanel();
      bindStickerControls();
      return;
    }
    if (selCoverPhoto && cover.photo) {
      const fx = coverPhotoFx();
      decor.innerHTML = `
        <div class="decor-row">
          <span class="tag green">cover photo</span>
          <span class="spacer"></span>
          <button class="btn small" data-act="cover-photo-reset">reset</button>
          <button class="btn small green" data-act="cover-photo-done">ok</button>
        </div>
        <div class="decor-row"><span class="help">drag the photo on the cover to move it</span></div>
        <label class="decor-row slider"><span class="tag">size</span><input type="range" id="cp-size" min="0.4" max="1.7" step="0.02" value="${fx.size}"></label>
        <label class="decor-row slider"><span class="tag blue">turn</span><input type="range" id="cp-rot" min="-45" max="45" step="0.5" value="${fx.rot}"></label>`;
      const size = $('#cp-size'), rot = $('#cp-rot');
      const live = () => {
        cover.photoFx = { ...coverPhotoFx(), size: Number(size.value), rot: Number(rot.value) };
        const node = book.querySelector('.cover-photo');
        if (node) node.style.transform = coverPhotoTransform();
      };
      size.addEventListener('input', live);
      rot.addEventListener('input', live);
      size.addEventListener('change', saveCover);
      rot.addEventListener('change', saveCover);
      return;
    }
    const letterHtml = selLetter !== null ? letterEditor() : null;
    if (letterHtml) { decor.innerHTML = letterHtml; return; }
    if (selectedSticker()) { decor.innerHTML = stickerPanel(); bindStickerControls(); return; }
    decor.innerHTML = `
      <div class="decor-row"><span class="tag">color</span>
        ${Object.keys(PASTELS).map(c => `<button class="swatch${cover.color === c ? ' on' : ''}" data-cover-color="${c}" style="background:${PASTELS[c]}" aria-label="${c}"></button>`).join('')}
      </div>
      <div class="decor-row"><span class="tag blue">title</span>
        <input class="text-in" id="title-in" value="${esc(cover.title)}" maxlength="28" autocomplete="off">
      </div>
      <div class="decor-row"><span class="help">tap a title letter on the cover to change its color and style</span></div>
      <div class="decor-row"><span class="tag green">photo</span>
        <button class="btn small" data-act="cover-photo">${cover.photo ? 'change photo' : 'add photo'}</button>
        ${cover.photo ? '<button class="btn small" data-act="cover-photo-edit">size &amp; turn</button><button class="btn small" data-act="cover-photo-rm">remove</button>' : ''}
      </div>
      ${stickerPanel()}`;
    $('#title-in').addEventListener('input', e => {
      cover.title = e.target.value;
      refreshTitle();
      saveCover();
    });
  }

  function setLetter(patch) {
    cover.letters = cover.letters || [];
    const cur = Ransom.current(cover.title || 'cafe log', cover.letters, selLetter);
    // pin every part of the letter's look once it's been touched, so it never changes by itself
    cover.letters[selLetter] = { bg: cur.bg, fg: cur.fg, font: cur.font, upper: cur.upper, ...(cover.letters[selLetter] || {}), ...patch };
    saveCover();
    refreshTitle();
    renderDecor();
  }

  decor.addEventListener('click', e => {
    const lb = e.target.closest('[data-letter-bg]');
    const lf = e.target.closest('[data-letter-fg]');
    const lfont = e.target.closest('[data-letter-font]');
    const lu = e.target.closest('[data-letter-upper]');
    if (lb) {
      // keep the letter readable: dark paper gets pink ink, light paper gets dark ink, unless already contrasting
      const cur = Ransom.current(cover.title || 'cafe log', cover.letters, selLetter);
      const bg = lb.dataset.letterBg;
      const fg = bg === 'ink' ? (cur.fg === 'ink' ? 'pink' : cur.fg) : (cur.fg === 'ink' || cur.fg === bg ? 'ink' : cur.fg);
      return setLetter({ bg, fg });
    }
    if (lf) return setLetter({ fg: lf.dataset.letterFg });
    if (lfont) return setLetter({ font: Number(lfont.dataset.letterFont) });
    if (lu) return setLetter({ upper: lu.dataset.letterUpper === '1' });
    const c = e.target.closest('[data-cover-color]');
    const s = e.target.closest('[data-sticker]');
    const tab = e.target.closest('[data-sticker-tab]');
    if (c) { cover.color = c.dataset.coverColor; saveCover(); render(); }
    if (tab) { stickerTab = tab.dataset.stickerTab; renderDecor(); }
    if (s) {
      const list = activeStickers();
      if (!list) return;
      const k = s.dataset.sticker;
      const kind = Stickers.kindOf(k);
      const onCover = mode === 'decorate';
      const st = {
        id: uid(), k,
        x: 25 + Math.random() * 50,
        y: onCover ? 66 + Math.random() * 20 : 22 + Math.random() * 50,
        rot: kind === 'washi' ? Math.round(Math.random() * 50 - 25) : Math.round(Math.random() * 24 - 12),
        size: 1,
      };
      list.push(st);
      selSticker = st.id;
      selLetter = null;
      saveStickers(); render();
    }
  });

  $('#cover-photo-input').addEventListener('change', async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try { cover.photo = await readImage(f, 900); saveCover(); render(); } catch { /* ignore */ }
  });

  let stickerDrag = null;
  book.addEventListener('pointerdown', e => {
    const list = activeStickers();
    if (!list) return;
    const letter = mode === 'decorate' && e.target.closest('.cover-title .rl');
    const coverPhoto = mode === 'decorate' && !e.target.closest('.sticker') && e.target.closest('.cover-photo');
    if (coverPhoto) {
      // select it (without re-rendering, so the same press can drag it) and start moving it
      e.preventDefault();
      if (selLetter !== null) { selLetter = null; refreshTitle(); }
      selSticker = null;
      book.querySelectorAll('.sticker.sel').forEach(x => x.classList.remove('sel'));
      coverPhoto.classList.add('sel');
      if (!selCoverPhoto) { selCoverPhoto = true; renderDecor(); }
      cover.photoFx = coverPhotoFx();
      const r = book.getBoundingClientRect();
      const d = cover.photoFx;
      stickerDrag = { node: coverPhoto, data: d, dx: d.x - ((e.clientX - r.left) / r.width) * 100, dy: d.y - ((e.clientY - r.top) / r.height) * 100 };
      coverPhoto.setPointerCapture(e.pointerId);
      return;
    }
    if (mode === 'decorate' && selCoverPhoto) {
      // deselect without re-rendering, so a sticker grabbed in the same tap stays draggable
      selCoverPhoto = false;
      book.querySelector('.cover-photo')?.classList.remove('sel');
      renderDecor();
    }
    if (letter) {
      selLetter = Number(letter.dataset.li);
      selSticker = null;
      book.querySelectorAll('.sticker.sel').forEach(x => x.classList.remove('sel'));
      refreshTitle();
      renderDecor();
      return;
    }
    const s = e.target.closest('.sticker');
    if (s && selLetter !== null) { selLetter = null; refreshTitle(); }
    if (!s) {
      // on a page, taps outside stickers still reach the fields; on the cover they just deselect
      if (selSticker) { selSticker = null; book.querySelectorAll('.sticker.sel').forEach(x => x.classList.remove('sel')); renderDecor(); }
      return;
    }
    e.preventDefault();
    const was = selSticker;
    selSticker = s.dataset.id;
    book.querySelectorAll('.sticker').forEach(x => x.classList.toggle('sel', x === s));
    if (was !== selSticker) renderDecor();
    const r = book.getBoundingClientRect();
    const data = list.find(x => x.id === selSticker);
    // keep the grab point under the finger instead of jumping the sticker's centre to it
    stickerDrag = { node: s, data, dx: data.x - ((e.clientX - r.left) / r.width) * 100, dy: data.y - ((e.clientY - r.top) / r.height) * 100 };
    s.setPointerCapture(e.pointerId);
  });
  book.addEventListener('pointermove', e => {
    if (!stickerDrag) return;
    const r = book.getBoundingClientRect();
    const d = stickerDrag.data;
    d.x = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100 + stickerDrag.dx));
    d.y = Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100 + stickerDrag.dy));
    stickerDrag.node.style.left = d.x + '%';
    stickerDrag.node.style.top = d.y + '%';
  });
  const endStickerDrag = () => { if (stickerDrag) { stickerDrag = null; saveStickers(); } };
  book.addEventListener('pointerup', endStickerDrag);
  book.addEventListener('pointercancel', endStickerDrag);

  // ---------- page flip ----------

  function makeFlip(target) {
    const dir = target > pos ? 1 : -1;
    const frontIndex = dir > 0 ? pos : target;
    const underWrap = el('<div class="underwrap"></div>');
    const underShade = el('<div class="shade"></div>');
    underWrap.append(leafFor(dir > 0 ? target : pos), underShade);

    const turner = el('<div class="turner"><div class="face front"></div><div class="face back"></div></div>');
    const frontShade = el('<div class="shade"></div>');
    turner.firstElementChild.append(leafFor(frontIndex), frontShade);
    if (frontIndex === 0) {
      turner.lastElementChild.classList.add('cover-back');
      turner.lastElementChild.style.setProperty('--c', PASTELS[cover.color] || PASTELS.pink);
    }
    book.replaceChildren(underWrap, turner);

    const flip = {
      dir, target, p: 0,
      set(p) {
        flip.p = p;
        const angle = dir > 0 ? -180 * p : -180 * (1 - p);
        const k = Math.abs(angle) / 180;
        turner.style.transform = `rotateY(${angle}deg)`;
        frontShade.style.opacity = Math.sin(k * Math.PI) * 0.5 + k * 0.2;
        underShade.style.opacity = (1 - k) * 0.55;
      },
    };
    flip.set(0);
    return flip;
  }

  function finishFlip(flip, complete, duration) {
    anim = true;
    const from = flip.p, to = complete ? 1 : 0;
    const ms = Math.max(120, (duration || 520) * Math.abs(to - from));
    const t0 = performance.now();
    if (complete) flipSound();
    let done = false;
    const land = () => {
      if (done) return;
      done = true;
      clearTimeout(safety);
      if (complete) pos = flip.target;
      anim = false;
      render();
    };
    const step = now => {
      if (done) return;
      const t = Math.min(1, (now - t0) / ms);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      flip.set(from + (to - from) * eased);
      if (t < 1) return requestAnimationFrame(step);
      land();
    };
    // Taps are ignored while a page turns, so a turn must always land. If animation frames stop
    // (app hidden mid-turn, a frozen view), finish the turn anyway shortly after it should have ended.
    const safety = setTimeout(land, ms + 400);
    requestAnimationFrame(step);
  }

  function go(target) {
    if (anim || mode !== 'read' || target === pos || target < 0 || target > lastLeaf()) return;
    finishFlip(makeFlip(target), true, 650);
  }

  let drag = null;
  book.addEventListener('pointerdown', e => {
    if (mode !== 'read' || anim || e.button > 0) return;
    if (e.target.closest('button, a')) return;
    drag = { x: e.clientX, y: e.clientY, flip: null };
  });
  window.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.flip) {
      if (Math.abs(dx) < 10) return;
      const target = pos + (dx < 0 ? 1 : -1);
      if (Math.abs(dy) > Math.abs(dx) || target < 0 || target > lastLeaf()) { drag = null; return; }
      drag.flip = makeFlip(target);
    }
    const travelled = (drag.flip.dir > 0 ? -dx : dx) / (book.clientWidth * 0.85);
    drag.flip.set(Math.max(0, Math.min(1, travelled)));
  });
  const endDrag = e => {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.flip) return finishFlip(d.flip, e.type === 'pointerup' && d.flip.p > 0.22);
    if (e.type === 'pointerup' && pos === 0) go(1); // tap the cover to open
  };
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  window.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea') || !$('#contents').hidden) return;
    if (e.key === 'ArrowRight') go(pos + 1);
    if (e.key === 'ArrowLeft') go(pos - 1);
  });

  // ---------- flip sound (synthesised paper swish, no audio file) ----------

  let actx;
  function flipSound() {
    if (!settings.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      const dur = 0.34, n = Math.floor(actx.sampleRate * dur);
      const buf = actx.createBuffer(1, n, actx.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < n; i++) {
        const t = i / n;
        ch[i] = (Math.random() * 2 - 1) * Math.pow(Math.sin(Math.PI * t), 2) * (0.55 + 0.45 * Math.random());
      }
      const src = actx.createBufferSource();
      src.buffer = buf;
      const filter = actx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 0.8;
      filter.frequency.setValueAtTime(900, actx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(3600, actx.currentTime + dur);
      const gain = actx.createGain();
      gain.gain.value = 0.22;
      src.connect(filter).connect(gain).connect(actx.destination);
      src.start();
    } catch { /* sound is a nicety; never block a flip on it */ }
  }

  // paper rip: crackly noise in tiny uneven bursts, rising in pitch as the tear runs down the page
  function tearSound() {
    if (!settings.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      const dur = 0.75, sr = actx.sampleRate, n = Math.floor(sr * dur);
      const buf = actx.createBuffer(1, n, sr);
      const ch = buf.getChannelData(0);
      let grain = 0, amp = 0;
      for (let i = 0; i < n; i++) {
        if (--grain <= 0) {                                    // new fibre snapping every 1–7 ms
          grain = Math.floor(sr * (0.001 + Math.random() * 0.006));
          amp = Math.random() < 0.18 ? 0.15 : 0.45 + Math.random() * 0.55;
        }
        const t = i / n;
        const env = Math.min(1, t / 0.05) * (t < 0.55 ? 1 : 0.6) * Math.min(1, (1 - t) / 0.12); // tug, then the final rip
        ch[i] = (Math.random() * 2 - 1) * amp * env;
      }
      const src = actx.createBufferSource();
      src.buffer = buf;
      const hp = actx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 700;
      const bp = actx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 0.9;
      bp.frequency.setValueAtTime(1600, actx.currentTime);
      bp.frequency.exponentialRampToValueAtTime(4200, actx.currentTime + dur);
      const gain = actx.createGain();
      gain.gain.value = 0.5;
      src.connect(hp).connect(bp).connect(gain).connect(actx.destination);
      src.start();
    } catch { /* sound is a nicety */ }
  }

  // ---------- contents ----------

  function renderList() {
    const q = $('#search').value.trim().toLowerCase();
    const rows = entries
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => !q || [e.name, e.city, e.drink].some(v => (v || '').toLowerCase().includes(q)));
    $('#list').innerHTML = rows.length
      ? rows.map(({ e, i }) => `<button class="item" data-go="${i + 1}">
          ${e.photos && e.photos[0] ? `<img class="thumb" src="${e.photos[0]}" alt="">` : '<span class="thumb">☕</span>'}
          <span class="txt">
            <div class="name">${esc(e.name || 'unnamed cafe')}</div>
            <div class="sub">${esc([e.city, prettyDate(e.date)].filter(Boolean).join(' · '))}</div>
          </span>
          <span class="rate">${e.rating ? '★ ' + e.rating : ''}</span>
        </button>`).join('')
      : `<div class="none">${entries.length ? 'no cafes match that search' : 'no cafes logged yet'}</div>`;
  }

  function openContents() {
    $('#contents-title').innerHTML = Ransom.html('contents');
    $('#search').value = '';
    renderList();
    $('#contents').hidden = false;
  }

  $('#search').addEventListener('input', renderList);
  $('#list').addEventListener('click', e => {
    const item = e.target.closest('[data-go]');
    if (!item) return;
    $('#contents').hidden = true;
    go(Number(item.dataset.go));
  });

  // ---------- backup ----------

  function exportBackup() {
    const blob = new Blob([JSON.stringify({ app: 'cafe-log', version: 1, cover, entries })], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cafe-log-backup-${todayIso()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  $('#import-input').addEventListener('change', async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (data.app !== 'cafe-log' || !Array.isArray(data.entries)) throw new Error('not a cafe log backup');
      for (const entry of data.entries) {
        if (!entry || !entry.id) continue;
        await Store.putEntry(entry);
        const i = entries.findIndex(x => x.id === entry.id);
        if (i >= 0) entries[i] = entry; else entries.push(entry);
      }
      sortEntries();
      renderList();
      render();
      alert(`Restored ${data.entries.length} page(s).`);
    } catch {
      alert('That file is not a cafe log backup.');
    }
  });

  // ---------- chrome ----------

  function render() {
    document.getElementById('app').classList.toggle('decorating', mode === 'decorate');
    book.replaceChildren(leafFor(pos));

    const onEntry = pos >= 1 && pos <= entries.length;
    if (mode === 'edit') {
      topbar.innerHTML = `<button class="btn" data-act="cancel">cancel</button>
        ${draft.isNew ? '' : '<button class="btn small orange" data-act="tear">tear out</button>'}
        <span class="spacer"></span>
        <button class="btn green" data-act="save">done</button>`;
    } else if (mode === 'decorate') {
      topbar.innerHTML = `<span class="spacer"></span><button class="btn green" data-act="decor-done">done</button>`;
    } else {
      topbar.innerHTML = `<button class="btn blue" data-act="contents">contents</button>
        <span class="spacer"></span>
        ${pos === 0 ? '<button class="btn pink" data-act="decorate">decorate cover</button>' : ''}
        ${onEntry ? '<button class="btn pink" data-act="edit">edit page</button>' : ''}
        <button class="btn round" data-act="sound" aria-label="page sound ${settings.sound ? 'on' : 'off'}">${settings.sound ? '♪' : '×'}</button>`;
    }

    if (mode === 'read') {
      const label = pos === 0 ? 'cover' : onEntry ? `page ${pos} of ${entries.length}` : 'new page';
      pager.innerHTML = `<button class="btn round" data-act="prev" aria-label="previous page"${pos === 0 ? ' disabled' : ''}>‹</button>
        <span class="page-count">${label}</span>
        <button class="btn round" data-act="next" aria-label="next page"${pos === lastLeaf() ? ' disabled' : ''}>›</button>`;
    } else {
      pager.innerHTML = mode === 'edit'
        ? (stickerMode
          ? '<span class="page-count">drag stickers around the page</span><button class="btn green small" data-act="stickers-done">done with stickers</button>'
          : '<span class="page-count">slide the stars to rate</span><button class="btn orange small" data-act="page-stickers">✿ stickers</button>')
        : '';
    }
    pager.hidden = mode === 'decorate';
    renderDecor();
    applyBookLock();
  }

  // While the sticker drawer is open the journal has less room. Instead of letting the page
  // re-flow into a different shape (which would shift photos and text under the stickers),
  // keep its exact size from before and just shrink it to fit.
  let bookLock = null;
  function applyBookLock() {
    if (!(mode === 'edit' && stickerMode && bookLock)) {
      bookLock = null;
      book.style.width = book.style.height = book.style.transform = book.style.margin = '';
      return;
    }
    const stage = $('#stage');
    const sw = stage.clientWidth, sh = stage.clientHeight;
    const scale = Math.min(1, (sw * 0.96) / bookLock.w, (sh * 0.97) / bookLock.h);
    book.style.width = bookLock.w + 'px';
    book.style.height = bookLock.h + 'px';
    // negative margins make the full-size box take up exactly the stage, so it stays centred when scaled
    book.style.margin = `${Math.min(0, (sh - bookLock.h) / 2)}px ${Math.min(0, (sw - bookLock.w) / 2)}px`;
    book.style.transform = `scale(${scale})`;
  }
  window.addEventListener('resize', () => { if (bookLock) applyBookLock(); });

  // Notes only get as many ruled lines as the writing needs (one to write on while editing,
  // none on a saved page with no notes). Sized in cqw so it keeps following the book's size.
  function fitNotes() {
    book.querySelectorAll('.notes textarea').forEach(ta => {
      const editing = !!ta.closest('.editing');
      const box = ta.closest('.notes');
      box.classList.toggle('empty', !editing && !ta.value.trim());
      const lh = parseFloat(getComputedStyle(ta).lineHeight);
      if (!lh) return;
      ta.style.height = '0';
      let n = ta.value ? Math.round(ta.scrollHeight / lh) : 0;
      if (editing) n = Math.max(1, n);
      ta.style.height = `calc(${n} * 7.4cqw)`;
    });
  }
  new MutationObserver(fitNotes).observe(book, { childList: true, subtree: true });
  book.addEventListener('input', e => { if (e.target.matches('.notes textarea')) fitNotes(); });
  window.addEventListener('resize', fitNotes);
  document.fonts.ready.then(fitNotes);

  const actions = {
    contents: openContents,
    'close-contents': () => { $('#contents').hidden = true; },
    prev: () => go(pos - 1),
    next: () => go(pos + 1),
    new: () => startEdit(null),
    edit: () => startEdit(entries[pos - 1]),
    save: saveEdit,
    cancel: cancelEdit,
    tear: tearOut,
    'add-photo': () => $('#photo-input').click(),
    decorate: () => { mode = 'decorate'; selSticker = null; selLetter = null; selCoverPhoto = false; render(); },
    'decor-done': () => { mode = 'read'; selSticker = null; selLetter = null; selCoverPhoto = false; render(); },
    'letter-done': () => { selLetter = null; refreshTitle(); renderDecor(); },
    'letter-reset': () => {
      if (cover.letters) { cover.letters[selLetter] = null; saveCover(); }
      refreshTitle(); renderDecor();
    },
    'cover-photo': () => $('#cover-photo-input').click(),
    'cover-photo-rm': () => { cover.photo = null; cover.photoFx = null; selCoverPhoto = false; saveCover(); render(); },
    'cover-photo-edit': () => { selCoverPhoto = true; selLetter = null; selSticker = null; render(); },
    'cover-photo-done': () => { selCoverPhoto = false; render(); },
    'cover-photo-reset': () => { cover.photoFx = null; saveCover(); render(); },
    'sticker-rm': () => {
      const list = activeStickers(); if (!list) return;
      const i = list.findIndex(s => s.id === selSticker);
      if (i >= 0) list.splice(i, 1);
      selSticker = null; saveStickers(); render();
    },
    'sticker-front': () => {
      const list = activeStickers(); if (!list) return;
      const i = list.findIndex(s => s.id === selSticker);
      if (i >= 0) list.push(list.splice(i, 1)[0]);
      saveStickers(); render();
    },
    'sticker-done': () => { selSticker = null; book.querySelectorAll('.sticker.sel').forEach(x => x.classList.remove('sel')); renderDecor(); },
    'photo-done': () => { selPhoto = null; render(); },
    'photo-reset': () => { if (draft.photoFx) draft.photoFx[selPhoto] = null; render(); },
    'page-stickers': () => {
      selPhoto = null;
      render();                                    // photo panel closed: book is at its normal size
      bookLock = { w: book.offsetWidth, h: book.offsetHeight };
      stickerMode = true; selSticker = null;
      render();
    },
    'stickers-done': () => { stickerMode = false; selSticker = null; render(); },
    sound: () => { settings.sound = !settings.sound; Store.setMeta('settings', settings); render(); if (settings.sound) flipSound(); },
    export: exportBackup,
    import: () => $('#import-input').click(),
  };

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    // ignore taps while a page is turning or being torn out: the buttons on the page underneath
    // (e.g. "+ add a cafe") are already visible but belong to a page that isn't open yet
    if (anim) return;
    if (b && actions[b.dataset.act]) actions[b.dataset.act]();
  });

  // ---------- start ----------

  (async () => {
    try {
      entries = (await Store.allEntries()) || [];
      cover = { ...cover, ...((await Store.getMeta('cover')) || {}) };
      settings = { ...settings, ...((await Store.getMeta('settings')) || {}) };
    } catch (err) {
      console.error('could not open storage', err);
    }
    sortEntries();
    render();
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  })();
})();
