/* Edit-mode overlay — injected into the public dashboard when it's loaded
 * inside the CMS Page Builder iframe with ?_cms=edit. NEVER loaded in
 * production / public visits.
 *
 * What it does:
 *   1. Outlines every element tagged with `data-cms-bind="kind:key"` on hover.
 *   2. On click, sends `{type:'cms.select', kind, key, value, rect}` to the
 *      parent window via postMessage. The parent CMS then shows a floating
 *      inspector right next to the element so the admin edits in place.
 *   3. Receives `{type:'cms.preview', kind, key, value}` from the parent —
 *      live-previews the change locally without a reload.
 *   4. Optional contenteditable inline mode (double-click) for text blocks.
 *
 * Postmessage protocol (parent ↔ iframe):
 *   parent → iframe : { type:'cms.preview', kind, key, value }
 *   iframe → parent : { type:'cms.ready' }
 *   iframe → parent : { type:'cms.select', kind, key, value, rect }
 *   iframe → parent : { type:'cms.inlineSave', kind, key, value }  (Ctrl+Enter)
 *   iframe → parent : { type:'cms.cancel' }                         (Esc)
 */
(function () {
  if (window.__ATLAS_EDIT_MODE_LOADED) return;
  window.__ATLAS_EDIT_MODE_LOADED = true;

  // Only run when explicitly invited (?_cms=edit OR window.ATLAS_EDIT_MODE)
  const params = new URLSearchParams(location.search);
  const inEdit = params.get('_cms') === 'edit' || window.ATLAS_EDIT_MODE;
  if (!inEdit) return;

  // Tell the parent we're up and which keys we can edit.
  function announce() {
    try {
      const targets = Array.from(document.querySelectorAll('[data-cms-bind]'))
        .map((el) => el.getAttribute('data-cms-bind'));
      window.parent.postMessage(
        { type: 'cms.ready', targets, url: location.href },
        '*'
      );
    } catch (e) { /* parent might not be same-origin in some hosts */ }
  }

  // --- styling --------------------------------------------------------------
  const style = document.createElement('style');
  style.textContent = `
    [data-cms-bind] {
      outline: 2px dashed transparent;
      outline-offset: 4px;
      cursor: pointer;
      transition: outline-color 120ms ease, background 120ms ease;
      position: relative;
    }
    [data-cms-bind]:hover {
      outline-color: #b8351e;
      background: rgba(184,53,30,0.04);
    }
    [data-cms-bind].cms-selected {
      outline: 2px solid #b8351e !important;
      outline-offset: 4px;
      background: rgba(184,53,30,0.06);
    }
    [data-cms-section] {
      position: relative;
      outline: 2px dashed transparent;
      outline-offset: -2px;
      transition: outline-color 120ms ease, box-shadow 120ms ease;
    }
    [data-cms-section]:hover { outline-color: #1e6eb8; }
    [data-cms-section].dragging { opacity: 0.35; }
    body.cms-dragging-active [data-cms-section] { outline-color: rgba(30,110,184,0.35); }
    [data-cms-section].drag-over-top {
      box-shadow: inset 0 5px 0 #1e6eb8, 0 -4px 12px rgba(30,110,184,0.35);
    }
    [data-cms-section].drag-over-bottom {
      box-shadow: inset 0 -5px 0 #1e6eb8, 0 4px 12px rgba(30,110,184,0.35);
    }
    [data-cms-section].drag-over-top::before,
    [data-cms-section].drag-over-bottom::after {
      content: 'DROP HERE';
      position: absolute; left: 50%; transform: translateX(-50%);
      background: #1e6eb8; color: white;
      padding: 2px 10px; border-radius: 3px;
      font: 600 10px 'JetBrains Mono', ui-monospace, monospace;
      letter-spacing: 0.08em; z-index: 99999;
      pointer-events: none;
    }
    [data-cms-section].drag-over-top::before    { top: -10px; }
    [data-cms-section].drag-over-bottom::after  { bottom: -10px; }
    .cms-section-handle {
      position: absolute; top: 6px; left: 6px;
      background: rgba(30,110,184,0.95); color: white;
      padding: 4px 8px; border-radius: 4px;
      font: 600 11px 'JetBrains Mono', ui-monospace, monospace;
      cursor: grab; user-select: none;
      z-index: 99998;
      opacity: 0; pointer-events: none;
      transition: opacity 120ms ease;
      display: flex; align-items: center; gap: 6px;
    }
    .cms-section-handle:hover { background: #1e6eb8; }
    .cms-section-handle:active { cursor: grabbing; }
    [data-cms-section]:hover .cms-section-handle { opacity: 1; pointer-events: auto; }
    .cms-handle-grip { font-size: 14px; line-height: 1; }
    .cms-handle-hide {
      background: rgba(0,0,0,0.4); color: white;
      border: none; border-radius: 3px; padding: 2px 6px;
      cursor: pointer; font-size: 10px;
    }
    .cms-handle-hide:hover { background: rgba(184,53,30,0.95); }
    [data-cms-bind][data-cms-inline] {
      outline-color: #6b8d6b;
    }
    .cms-tag {
      position: absolute; top: -22px; left: -2px;
      background: #1a1612; color: #fbf7ec;
      font: 600 10px 'JetBrains Mono', ui-monospace, monospace;
      padding: 2px 6px; border-radius: 3px 3px 0 0;
      pointer-events: none;
      opacity: 0; transition: opacity 120ms ease;
      z-index: 9999;
    }
    [data-cms-bind]:hover .cms-tag,
    [data-cms-bind].cms-selected .cms-tag { opacity: 1; }
    .cms-edit-banner {
      position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
      background: rgba(184,53,30,0.95); color: white;
      padding: 6px 14px; border-radius: 16px;
      font: 600 11px 'Inter', system-ui, sans-serif;
      text-transform: uppercase; letter-spacing: 0.08em;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      pointer-events: none;
      z-index: 100000;
    }
    [contenteditable="true"] {
      outline: 2px solid #6b8d6b !important;
      background: rgba(107,141,107,0.10) !important;
      cursor: text !important;
    }
    /* Resize handles on selected text elements */
    .cms-resize-handles {
      position: absolute;
      pointer-events: none;
      z-index: 99996;
    }
    .cms-resize-handle {
      position: absolute;
      width: 12px; height: 12px;
      background: #b8351e;
      border: 2px solid white;
      border-radius: 50%;
      pointer-events: auto;
      box-shadow: 0 1px 4px rgba(0,0,0,0.2);
    }
    .cms-resize-handle.tl { top: -6px;    left: -6px;   cursor: nwse-resize; }
    .cms-resize-handle.tr { top: -6px;    right: -6px;  cursor: nesw-resize; }
    .cms-resize-handle.bl { bottom: -6px; left: -6px;   cursor: nesw-resize; }
    .cms-resize-handle.br { bottom: -6px; right: -6px;  cursor: nwse-resize; }
    .cms-resize-handle.n  { top: -6px;    left: 50%; transform: translateX(-50%); cursor: ns-resize; }
    .cms-resize-handle.s  { bottom: -6px; left: 50%; transform: translateX(-50%); cursor: ns-resize; }
    .cms-resize-handle.e  { right: -6px;  top: 50%;  transform: translateY(-50%); cursor: ew-resize; }
    .cms-resize-handle.w  { left: -6px;   top: 50%;  transform: translateY(-50%); cursor: ew-resize; }
    .cms-resize-handle.n,
    .cms-resize-handle.s { background: #1e6eb8; }
    .cms-resize-handle.e,
    .cms-resize-handle.w { background: #d4a017; }
    .cms-resize-handle:hover { transform: scale(1.4); transition: transform 120ms; }
    .cms-resize-handle.n:hover { transform: translateX(-50%) scale(1.4); }
    .cms-resize-handle.s:hover { transform: translateX(-50%) scale(1.4); }
    .cms-resize-handle.e:hover { transform: translateY(-50%) scale(1.4); }
    .cms-resize-handle.w:hover { transform: translateY(-50%) scale(1.4); }
    body.cms-alt-down [data-cms-bind] { cursor: move !important; }
    body.cms-alt-down [data-cms-bind]:hover { outline: 2px solid #6b8d6b !important; }
    .cms-restore-banner {
      position: fixed; top: 60px; left: 50%; transform: translateX(-50%);
      background: rgba(184,53,30,0.97); color: white;
      padding: 12px 22px; border-radius: 8px;
      font: 600 13px 'Inter', system-ui, sans-serif;
      box-shadow: 0 6px 24px rgba(0,0,0,0.4);
      z-index: 100001;
      display: flex; gap: 12px; align-items: center;
      animation: cms-banner-in 220ms ease;
    }
    @keyframes cms-banner-in { from { opacity:0; transform:translateX(-50%) translateY(-10px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
    .cms-restore-banner button {
      background: white; color: #b8351e; border: none;
      padding: 6px 14px; border-radius: 4px;
      font: 700 12px 'JetBrains Mono', ui-monospace, monospace;
      cursor: pointer; text-transform: uppercase; letter-spacing: 0.06em;
    }
    .cms-restore-banner button:hover { opacity: 0.9; }
    .cms-restore-banner .close { background: transparent; color: white; padding: 4px 8px; }
    .cms-resize-readout {
      position: absolute; top: -32px; left: 50%; transform: translateX(-50%);
      background: #1a1612; color: #fbf7ec;
      padding: 3px 10px; border-radius: 4px;
      font: 700 11px 'JetBrains Mono', ui-monospace, monospace;
      pointer-events: none; white-space: nowrap;
      box-shadow: 0 2px 6px rgba(0,0,0,0.25);
    }
  `;
  document.head.appendChild(style);

  // Persistent banner so admin always knows they're in edit mode.
  const banner = document.createElement('div');
  banner.className = 'cms-edit-banner';
  banner.textContent = '✎ CMS edit mode — click any outlined element to edit';
  document.body.appendChild(banner);

  // --- decorate ------------------------------------------------------------
  function decorate() {
    document.querySelectorAll('[data-cms-bind]').forEach((el) => {
      if (el.querySelector(':scope > .cms-tag')) return;
      const bind = el.getAttribute('data-cms-bind') || '';
      const tag = document.createElement('span');
      tag.className = 'cms-tag';
      tag.textContent = bind;
      el.appendChild(tag);
    });
    document.querySelectorAll('[data-cms-section]').forEach((el) => {
      if (el.querySelector(':scope > .cms-section-handle')) return;
      const sectionRef = el.getAttribute('data-cms-section') || '';
      const blockType = el.getAttribute('data-cms-block-type') || '';
      const handle = document.createElement('div');
      handle.className = 'cms-section-handle';
      handle.draggable = true;
      handle.dataset.sectionRef = sectionRef;
      const grip = document.createElement('span');
      grip.className = 'cms-handle-grip';
      grip.textContent = '⋮⋮';
      const label = document.createElement('span');
      label.textContent = blockType || sectionRef;
      const resetBtn = document.createElement('button');
      resetBtn.className = 'cms-handle-hide';
      resetBtn.title = 'Reset all styles on this section';
      resetBtn.textContent = '⟲';
      resetBtn.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        window.parent.postMessage({ type: 'cms.resetSectionStyles',
          selector: 'section:' + sectionRef }, '*');
      });
      const hideBtn = document.createElement('button');
      hideBtn.className = 'cms-handle-hide';
      hideBtn.title = 'Hide this section';
      hideBtn.textContent = '×';
      hideBtn.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        const [slot, id] = sectionRef.split(':');
        window.parent.postMessage({ type: 'cms.hideSection', slot, id }, '*');
      });
      handle.append(grip, label, resetBtn, hideBtn);
      // Drag events live on the handle so users can click into the section
      // body without dragging accidentally. We use the parent SECTION as the
      // drag image so users see the whole block following the cursor.
      handle.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', sectionRef);
        try {
          // Position the drag image so the cursor sits where the user grabbed.
          const rect = el.getBoundingClientRect();
          e.dataTransfer.setDragImage(el, e.clientX - rect.left, e.clientY - rect.top);
        } catch (_) { /* not supported in all browsers */ }
        el.classList.add('dragging');
        document.body.classList.add('cms-dragging-active');
      });
      handle.addEventListener('dragend', () => {
        el.classList.remove('dragging');
        document.body.classList.remove('cms-dragging-active');
        document.querySelectorAll('[data-cms-section]').forEach((x) => {
          x.classList.remove('drag-over-top', 'drag-over-bottom');
        });
      });
      el.appendChild(handle);

      // Each section is also a drop target for sibling drops.
      el.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const rect = el.getBoundingClientRect();
        const top = (e.clientY - rect.top) < rect.height / 2;
        el.classList.toggle('drag-over-top', top);
        el.classList.toggle('drag-over-bottom', !top);
      });
      el.addEventListener('dragleave', () => {
        el.classList.remove('drag-over-top', 'drag-over-bottom');
      });
      el.addEventListener('drop', (e) => {
        e.preventDefault();
        const fromRef = e.dataTransfer.getData('text/plain');
        const toRef = el.getAttribute('data-cms-section') || '';
        el.classList.remove('drag-over-top', 'drag-over-bottom');
        if (!fromRef || fromRef === toRef) return;
        const rect = el.getBoundingClientRect();
        const before = (e.clientY - rect.top) < rect.height / 2;
        // fromRef and toRef look like "<slot>:<id>". The slot can differ
        // (e.g. dragging from header to footer) — handle both cases.
        const [fromSlot, fromId] = fromRef.split(':');
        const [toSlot,   toId]   = toRef.split(':');
        if (fromSlot === toSlot) {
          window.parent.postMessage({
            type: 'cms.reorder',
            slot: fromSlot, from: fromId, to: toId,
            position: before ? 'before' : 'after',
          }, '*');
        } else {
          window.parent.postMessage({
            type: 'cms.crossSlotMove',
            fromSlot, fromId, toSlot, toId,
            position: before ? 'before' : 'after',
          }, '*');
        }
      });
    });
  }
  // Decorate now + whenever React re-renders (MutationObserver).
  decorate();
  const mo = new MutationObserver(() => decorate());
  mo.observe(document.body, { childList: true, subtree: true });

  // Read element text WITHOUT including any CMS-injected children (bind tags,
  // section handles). Critical: el.textContent would otherwise concatenate
  // the bind-tag label into the value and pollute the saved setting.
  function getCleanText(el) {
    let txt = '';
    for (const node of el.childNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.classList && (
          node.classList.contains('cms-tag') ||
          node.classList.contains('cms-section-handle')
        )) continue;
        txt += getCleanText(node);
      } else if (node.nodeType === Node.TEXT_NODE) {
        txt += node.textContent || '';
      }
    }
    return txt;
  }

  // --- selection / click → tell parent -------------------------------------
  let selected = null;
  let resizeHandles = null;

  function clearResizeHandles() {
    if (resizeHandles && resizeHandles.parentNode) {
      resizeHandles.parentNode.removeChild(resizeHandles);
    }
    resizeHandles = null;
  }

  function attachResizeHandles(el) {
    clearResizeHandles();
    // Only attach to elements with [data-cms-bind] — i.e. real editable
    // text/setting elements, not nav containers etc.
    if (!el || !el.matches('[data-cms-bind]')) return;
    // Skip elements that visually shouldn't be resized (badges, color swatches).
    const tag = el.tagName.toLowerCase();
    if (!/^(h1|h2|h3|h4|h5|h6|p|span|div|li|a|button|strong|em|label)$/.test(tag)) return;

    const wrap = document.createElement('div');
    wrap.className = 'cms-resize-handles';
    const tl = document.createElement('div'); tl.className = 'cms-resize-handle tl';
    const tr = document.createElement('div'); tr.className = 'cms-resize-handle tr';
    const bl = document.createElement('div'); bl.className = 'cms-resize-handle bl';
    const br = document.createElement('div'); br.className = 'cms-resize-handle br';
    const n  = document.createElement('div'); n.className  = 'cms-resize-handle n';
    const s  = document.createElement('div'); s.className  = 'cms-resize-handle s';
    const ew = document.createElement('div'); ew.className = 'cms-resize-handle e';
    const wh = document.createElement('div'); wh.className = 'cms-resize-handle w';
    const readout = document.createElement('div'); readout.className = 'cms-resize-readout';
    wrap.append(tl, tr, bl, br, n, s, ew, wh, readout);

    // Position absolutely over the element
    function reposition() {
      if (!el.isConnected) { clearResizeHandles(); return; }
      const rect = el.getBoundingClientRect();
      wrap.style.position = 'fixed';
      wrap.style.top    = rect.top + 'px';
      wrap.style.left   = rect.left + 'px';
      wrap.style.width  = rect.width + 'px';
      wrap.style.height = rect.height + 'px';
    }
    reposition();
    document.body.appendChild(wrap);

    const reposOnScroll = () => reposition();
    window.addEventListener('scroll', reposOnScroll, true);
    window.addEventListener('resize', reposOnScroll);

    // Drag-to-resize: changes font-size proportionally to vertical drag.
    [tl, tr, bl, br].forEach((handle) => {
      handle.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const startY = e.clientY;
        const baseSize = parseFloat(getComputedStyle(el).fontSize) || 16;
        const direction = handle.classList.contains('tl') || handle.classList.contains('tr') ? -1 : 1;
        handle.setPointerCapture(e.pointerId);
        readout.textContent = `${Math.round(baseSize)}px`;
        document.body.style.userSelect = 'none';

        function onMove(ev) {
          const delta = (ev.clientY - startY) * direction;
          const newSize = Math.max(8, Math.min(180, baseSize + delta * 0.6));
          el.style.fontSize = newSize + 'px';
          readout.textContent = `${Math.round(newSize)}px`;
          reposition();
        }
        function onUp(ev) {
          handle.removeEventListener('pointermove', onMove);
          handle.removeEventListener('pointerup', onUp);
          document.body.style.userSelect = '';
          const finalSize = parseFloat(el.style.fontSize);
          // Keep the inline style applied so the user sees the change
          // immediately. The SSE round-trip below re-injects the persisted
          // style; we then clear inline so the persisted override takes over.
          const bind = el.getAttribute('data-cms-bind') || '';
          window.parent.postMessage({
            type: 'cms.styleResize',
            selector: 'bind:' + bind,
            property: 'fontSize',
            value: Math.round(finalSize) + 'px',
          }, '*');
          setTimeout(() => { if (el) el.style.fontSize = ''; }, 1500);
        }
        handle.addEventListener('pointermove', onMove);
        handle.addEventListener('pointerup', onUp);
      });
    });

    // East / West handles → resize WIDTH (in px)
    [ew, wh].forEach((handle, idx) => {
      const sign = idx === 0 ? 1 : -1; // east grows, west shrinks
      handle.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const startX = e.clientX;
        const baseW = el.getBoundingClientRect().width;
        handle.setPointerCapture(e.pointerId);
        readout.textContent = `${Math.round(baseW)}px wide`;
        document.body.style.userSelect = 'none';
        function onMove(ev) {
          const delta = (ev.clientX - startX) * sign;
          const newW = Math.max(40, Math.min(1600, baseW + delta));
          el.style.width = newW + 'px';
          el.style.maxWidth = newW + 'px';
          readout.textContent = `${Math.round(newW)}px wide`;
          reposition();
        }
        function onUp() {
          handle.removeEventListener('pointermove', onMove);
          handle.removeEventListener('pointerup', onUp);
          document.body.style.userSelect = '';
          const finalW = Math.round(parseFloat(el.style.width));
          const bind = el.getAttribute('data-cms-bind') || '';
          window.parent.postMessage({
            type: 'cms.styleResize',
            selector: 'bind:' + bind,
            property: 'width',
            value: finalW + 'px',
          }, '*');
          setTimeout(() => { if (el) { el.style.width = ''; el.style.maxWidth = ''; } }, 1500);
        }
        handle.addEventListener('pointermove', onMove);
        handle.addEventListener('pointerup', onUp);
      });
    });

    // North / South handles → resize HEIGHT (or padding-block) in px
    [n, s].forEach((handle, idx) => {
      const sign = idx === 0 ? -1 : 1; // north up=shrink, south down=grow
      handle.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const startY = e.clientY;
        const baseH = el.getBoundingClientRect().height;
        handle.setPointerCapture(e.pointerId);
        readout.textContent = `${Math.round(baseH)}px tall`;
        document.body.style.userSelect = 'none';
        function onMove(ev) {
          const delta = (ev.clientY - startY) * sign;
          const newH = Math.max(20, Math.min(1200, baseH + delta));
          el.style.height = newH + 'px';
          readout.textContent = `${Math.round(newH)}px tall`;
          reposition();
        }
        function onUp() {
          handle.removeEventListener('pointermove', onMove);
          handle.removeEventListener('pointerup', onUp);
          document.body.style.userSelect = '';
          const finalH = Math.round(parseFloat(el.style.height));
          const bind = el.getAttribute('data-cms-bind') || '';
          window.parent.postMessage({
            type: 'cms.styleResize',
            selector: 'bind:' + bind,
            property: 'height',
            value: finalH + 'px',
          }, '*');
          setTimeout(() => { if (el) el.style.height = ''; }, 1500);
        }
        handle.addEventListener('pointermove', onMove);
        handle.addEventListener('pointerup', onUp);
      });
    });

    resizeHandles = wrap;
  }

  function clearSelection() {
    if (selected) selected.classList.remove('cms-selected');
    selected = null;
    clearResizeHandles();
    clearRestoreBanner();
  }

  // --- Auto-detect "this element is invisible" ----------------------------
  let restoreBanner = null;
  function clearRestoreBanner() {
    if (restoreBanner && restoreBanner.parentNode) restoreBanner.parentNode.removeChild(restoreBanner);
    restoreBanner = null;
  }
  function checkInvisible(el) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none') return 'display is set to none';
    if (cs.visibility === 'hidden' || cs.visibility === 'collapse') return 'visibility is hidden';
    if (parseFloat(cs.opacity) === 0) return 'opacity is 0';
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return 'element has zero size';
    if (rect.right < -50 || rect.bottom < -50 || rect.left > innerWidth + 50 || rect.top > innerHeight + 50) {
      return 'element is positioned off-screen';
    }
    // Approximate "text colour same as background colour"
    const colour = cs.color;
    const bg = cs.backgroundColor;
    if (colour && bg && colour !== 'rgba(0, 0, 0, 0)' && colour === bg) {
      return 'text colour matches background colour';
    }
    return null;
  }
  function showRestoreBanner(el, reason) {
    clearRestoreBanner();
    const bind = el.getAttribute('data-cms-bind') || '';
    const b = document.createElement('div');
    b.className = 'cms-restore-banner';
    const msg = document.createElement('span');
    msg.textContent = '⚠ This element appears invisible (' + reason + ').';
    const fix = document.createElement('button');
    fix.textContent = 'Restore default style';
    fix.addEventListener('click', () => {
      window.parent.postMessage({ type: 'cms.healElement', selector: 'bind:' + bind }, '*');
      clearRestoreBanner();
    });
    const close = document.createElement('button');
    close.className = 'close';
    close.textContent = '×';
    close.addEventListener('click', clearRestoreBanner);
    b.append(msg, fix, close);
    document.body.appendChild(b);
    restoreBanner = b;
  }

  document.addEventListener('click', (e) => {
    // Ignore clicks on our own handles
    if (e.target.closest && e.target.closest('.cms-resize-handle, .cms-resize-handles, .cms-section-handle, .cms-tag')) {
      return;
    }
    const el = e.target.closest('[data-cms-bind]');
    if (!el) {
      clearSelection();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    clearSelection();
    selected = el;
    el.classList.add('cms-selected');
    attachResizeHandles(el);
    const invisReason = checkInvisible(el);
    if (invisReason) showRestoreBanner(el, invisReason);
    const bind = el.getAttribute('data-cms-bind') || '';
    const [kind, ...keyParts] = bind.split(':');
    const key = keyParts.join(':');
    const value = el.getAttribute('data-cms-value') ?? getCleanText(el).trim();
    const rect = el.getBoundingClientRect();
    window.parent.postMessage({
      type: 'cms.select',
      kind, key, value,
      rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
    }, '*');
  }, true);

  // Double-click → enable contenteditable inline. Ctrl+Enter saves, Esc cancels.
  document.addEventListener('dblclick', (e) => {
    const el = e.target.closest('[data-cms-bind][data-cms-inline]');
    if (!el) return;
    e.preventDefault();
    el.setAttribute('contenteditable', 'true');
    el.focus();
    document.execCommand('selectAll', false, null);
  });

  document.addEventListener('keydown', (e) => {
    const el = document.activeElement;
    if (!el || el.getAttribute('contenteditable') !== 'true') return;
    if (e.key === 'Escape') {
      el.removeAttribute('contenteditable');
      window.parent.postMessage({ type: 'cms.cancel' }, '*');
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      const bind = el.getAttribute('data-cms-bind') || '';
      const [kind, ...keyParts] = bind.split(':');
      const key = keyParts.join(':');
      const value = getCleanText(el).trim();
      el.removeAttribute('contenteditable');
      if (!value) {
        window.parent.postMessage({ type: 'cms.inlineRejected', kind, key,
          reason: 'Empty value rejected — the field would have become invisible. Use the Inspector if you really want to delete it.' }, '*');
        return;
      }
      // Reject suspiciously short / single-letter values for hero / title fields
      // where they almost certainly indicate an accidental keypress (e.g. typing
      // "e" instead of editing). Layout-critical fields need real content.
      const layoutCriticalKeys = ['site.heroTitle', 'site.title', 'site.tagline'];
      if (layoutCriticalKeys.includes(key) && value.length < 4) {
        window.parent.postMessage({ type: 'cms.inlineRejected', kind, key,
          reason: `"${value}" is too short for ${key}. Use the Inspector if you really want to set it.` }, '*');
        return;
      }
      window.parent.postMessage({ type: 'cms.inlineSave', kind, key, value }, '*');
    }
  });

  // --- receive live previews from parent -----------------------------------
  function camelToKebab(s) { return s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()); }
  function selectorOf(stored) {
    if (stored.startsWith('bind:'))    return `[data-cms-bind="${stored.slice(5)}"]`;
    if (stored.startsWith('section:')) return `[data-cms-section="${stored.slice(8)}"]`;
    return stored;
  }
  // Append a "force-state" classed rule mirror: when the parent CMS sets the
  // state picker to :hover, we want the user to SEE the hover style without
  // actually hovering. We do this by adding both the hover pseudo-class rule
  // AND a parallel rule with .cms-force-hover that we apply to the targeted
  // element while the inspector is open.
  function injectForceStateStyle(state) {
    let st = document.getElementById('cms-force-state-style');
    if (!st) {
      st = document.createElement('style');
      st.id = 'cms-force-state-style';
      document.head.appendChild(st);
    }
    if (!state || state === 'default') { st.textContent = ''; return; }
    // Auto-promote any selector with :state to also match .cms-force-<state>.
    // We do this by looking at existing cms-style-preview-* blocks.
    const rules = [];
    document.querySelectorAll('style[id^="cms-style-preview-"]').forEach((s) => {
      const txt = s.textContent || '';
      // Replace ":hover {" etc. with ".cms-force-hover {" so the same rules
      // apply when we add the class.
      const adjusted = txt.replace(new RegExp(':' + state + '\\s*{', 'g'),
                                    '.cms-force-' + state + ' {');
      rules.push(adjusted);
    });
    st.textContent = rules.join('\n\n');
  }
  window.addEventListener('message', (e) => {
    const msg = e.data;
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'cms.preview') {
      const sel = `[data-cms-bind="${msg.kind}:${msg.key}"]`;
      document.querySelectorAll(sel).forEach((el) => {
        // Replace the visible text without touching React's tree too much.
        // Re-renders may overwrite this; that's fine — saving via API and
        // SSE-driven reload makes the change permanent.
        const tag = el.querySelector(':scope > .cms-tag');
        for (const node of Array.from(el.childNodes)) {
          if (node === tag) continue;
          if (node.nodeType === Node.TEXT_NODE) node.remove();
        }
        const txt = document.createTextNode(msg.value || '');
        el.insertBefore(txt, tag);
      });
    } else if (msg.type === 'cms.stylePreview') {
      // Live style preview — inject a <style> block keyed to the selector
      // so we can replace/clear it without affecting other elements.
      // Now handles nested state (default/hover/focus/active) and
      // breakpoint (all/mobile/tablet/desktop) overrides.
      const id = 'cms-style-preview-' + msg.selector.replace(/[^a-z0-9_-]/gi, '_');
      let st = document.getElementById(id);
      if (!st) {
        st = document.createElement('style');
        st.id = id;
        document.head.appendChild(st);
      }
      st.textContent = (window.__ATLAS_COMPILE_STYLE_ENTRY
        ? window.__ATLAS_COMPILE_STYLE_ENTRY({
            selector: msg.selector,
            properties: msg.properties,
            customCss: msg.customCss,
          }).join('\n\n')
        : (() => {
            // Fallback if the bridge helper isn't loaded.
            const cssSel = selectorOf(msg.selector);
            const props = Object.entries(msg.properties || {})
              .filter(([_, v]) => v != null && v !== '')
              .map(([k, v]) => `  ${camelToKebab(k)}: ${v};`).join('\n');
            const custom = String(msg.customCss || '').replace(/<\/?(style|script)[^>]*>/gi, '');
            return `${cssSel} {\n${props}\n${custom}\n}`;
          })());
    } else if (msg.type === 'cms.forceState') {
      // Add a class so the user sees :hover/:focus/:active styling without
      // having to physically hover the element.
      document.querySelectorAll('.cms-force-hover,.cms-force-focus,.cms-force-active')
        .forEach((n) => n.classList.remove('cms-force-hover','cms-force-focus','cms-force-active'));
      if (msg.state && msg.state !== 'default') {
        const tgt = document.querySelector(selectorOf(msg.selector));
        if (tgt) tgt.classList.add('cms-force-' + msg.state);
        injectForceStateStyle(msg.state);
      } else {
        injectForceStateStyle(null);
      }
    } else if (msg.type === 'cms.styleClear') {
      const id = 'cms-style-preview-' + msg.selector.replace(/[^a-z0-9_-]/gi, '_');
      const st = document.getElementById(id);
      if (st) st.remove();
    } else if (msg.type === 'cms.scrollTo') {
      const sel = `[data-cms-bind="${msg.kind}:${msg.key}"]`;
      const el = document.querySelector(sel);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        clearSelection();
        selected = el;
        el.classList.add('cms-selected');
      }
    }
  });

  // --- Alt+drag = free-form translate ------------------------------------
  // While Alt (or Option on macOS) is held, dragging any data-cms-bind
  // element translates it via transform: translate(X,Y). On pointerup we
  // persist as a style override so the position survives reload.
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Alt') document.body.classList.add('cms-alt-down');
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'Alt') document.body.classList.remove('cms-alt-down');
  });
  window.addEventListener('blur', () => {
    document.body.classList.remove('cms-alt-down');
  });

  let dragSession = null;
  document.addEventListener('pointerdown', (e) => {
    if (!e.altKey) return;
    if (e.target.closest('.cms-resize-handle, .cms-resize-handles, .cms-section-handle, .cms-tag')) return;
    const el = e.target.closest('[data-cms-bind]');
    if (!el) return;
    e.preventDefault(); e.stopPropagation();
    // Parse current transform translate (if any)
    const tr = el.style.transform || getComputedStyle(el).transform;
    let curX = 0, curY = 0;
    const m = (typeof tr === 'string') ? tr.match(/translate\(\s*(-?\d+(?:\.\d+)?)px\s*,\s*(-?\d+(?:\.\d+)?)px/) : null;
    if (m) { curX = parseFloat(m[1]); curY = parseFloat(m[2]); }
    dragSession = { el, startX: e.clientX, startY: e.clientY, curX, curY };
    el.setPointerCapture(e.pointerId);
    document.body.style.userSelect = 'none';
  }, true);
  document.addEventListener('pointermove', (e) => {
    if (!dragSession) return;
    const dx = e.clientX - dragSession.startX;
    const dy = e.clientY - dragSession.startY;
    const newX = dragSession.curX + dx;
    const newY = dragSession.curY + dy;
    dragSession.el.style.transform = `translate(${Math.round(newX)}px, ${Math.round(newY)}px)`;
  });
  document.addEventListener('pointerup', () => {
    if (!dragSession) return;
    const { el } = dragSession;
    const tr = el.style.transform || '';
    el.style.transform = '';
    document.body.style.userSelect = '';
    dragSession = null;
    const bind = el.getAttribute('data-cms-bind') || '';
    window.parent.postMessage({
      type: 'cms.styleResize',
      selector: 'bind:' + bind,
      property: 'transform',
      value: tr,
    }, '*');
  });

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(announce, 400));
  } else {
    setTimeout(announce, 400);
  }
})();
