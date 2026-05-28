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
      transition: outline-color 120ms ease;
    }
    [data-cms-section]:hover { outline-color: #1e6eb8; }
    [data-cms-section].dragging { opacity: 0.4; }
    [data-cms-section].drag-over-top    { box-shadow: inset 0 4px 0 #1e6eb8; }
    [data-cms-section].drag-over-bottom { box-shadow: inset 0 -4px 0 #1e6eb8; }
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
      const hideBtn = document.createElement('button');
      hideBtn.className = 'cms-handle-hide';
      hideBtn.title = 'Hide this section';
      hideBtn.textContent = '×';
      hideBtn.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        const [slot, id] = sectionRef.split(':');
        window.parent.postMessage({ type: 'cms.hideSection', slot, id }, '*');
      });
      handle.append(grip, label, hideBtn);
      // Drag events live on the handle so users can click into the section
      // body without dragging accidentally.
      handle.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', sectionRef);
        el.classList.add('dragging');
      });
      handle.addEventListener('dragend', () => {
        el.classList.remove('dragging');
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
        const [slot, fromId] = fromRef.split(':');
        const [, toId] = toRef.split(':');
        window.parent.postMessage({
          type: 'cms.reorder',
          slot,
          from: fromId,
          to: toId,
          position: before ? 'before' : 'after',
        }, '*');
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
  function clearSelection() {
    if (selected) selected.classList.remove('cms-selected');
    selected = null;
  }

  document.addEventListener('click', (e) => {
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
      const value = getCleanText(el);    // ← exclude CMS-injected tag children
      el.removeAttribute('contenteditable');
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

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(announce, 400));
  } else {
    setTimeout(announce, 400);
  }
})();
