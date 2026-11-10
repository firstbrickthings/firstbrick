/* Frontend accessibility and progressive rendering. No remote writes. */
function renderProductBatch(gridId, products, countId) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  const list = products.filter(product => !product.catalogHidden);
  let shown = 0;
  const previous = document.getElementById(gridId + '-more');
  previous?.remove();
  grid.replaceChildren();
  const more = document.createElement('button');
  more.id = gridId + '-more';
  more.type = 'button';
  more.className = 'btn btn-outline bo-load-more';
  more.setAttribute('aria-controls', gridId);
  const count = document.getElementById(countId);
  if (count) { count.setAttribute('role', 'status'); count.setAttribute('aria-live', 'polite'); }
  function append() {
    const oldShown = shown;
    shown = Math.min(shown + 24, list.length);
    grid.insertAdjacentHTML('beforeend', list.slice(oldShown, shown).map(productCard).join(''));
    if (count) count.textContent = `Showing ${shown} of ${list.length} products`;
    more.textContent = `Show more products (${list.length - shown} remaining)`;
    more.hidden = shown >= list.length;
    if (oldShown) grid.children[oldShown]?.focus({preventScroll: true});
  }
  more.addEventListener('click', append);
  grid.after(more);
  append();
}

(function () {
  let fieldId = 0;
  function fields(root) {
    const nodes = [...(root.matches?.('input,select,textarea') ? [root] : []), ...root.querySelectorAll('input,select,textarea')];
    nodes.forEach(field => {
      if (['hidden', 'submit', 'button', 'reset'].includes(field.type)) return;
      if (!field.id) field.id = 'bo-field-' + (++fieldId);
      if (field.labels?.length) return;
      const label = field.previousElementSibling;
      if (label?.tagName === 'LABEL') { label.htmlFor = field.id; return; }
      const text = field.getAttribute('aria-label') || field.getAttribute('placeholder') ||
        (field.name || field.id).replace(/[-_]/g, ' ').replace(/^bo /, '');
      const created = document.createElement('label');
      created.htmlFor = field.id;
      created.className = field.closest('.search-wrap,.mobile-search-inner') ? 'sr-only' : 'bo-field-label';
      created.textContent = text.charAt(0).toUpperCase() + text.slice(1);
      field.before(created);
    });
  }
  function ready() {
    fields(document);
    const motion=document.getElementById('bo-hero-motion');
    if(motion){
      const reduced=matchMedia('(prefers-reduced-motion: reduce)');
      const sync=()=>{
        window.boHeroPaused=reduced.matches || motion.getAttribute('aria-pressed')==='true';
        motion.textContent=window.boHeroPaused?'Play slideshow':'Pause slideshow';
        if(window.boHeroPaused)clearTimeout(heroTimer);else startHeroTimer();
      };
      motion.addEventListener('click',()=>{motion.setAttribute('aria-pressed',String(!window.boHeroPaused));sync()});
      reduced.addEventListener('change',sync);sync();
      document.addEventListener('visibilitychange',()=>{if(document.hidden)clearTimeout(heroTimer);else if(!window.boHeroPaused)startHeroTimer()});
    }
    const observer = new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) {
        if (node.nodeType === 1 && node.matches('input,select,textarea,form,div,section,article')) fields(node);
      }
    });
    observer.observe(document.body, {childList: true, subtree: true});
    const layers = ['bo-u-modal', 'cart-drawer', 'wishlist-drawer', 'mobile-drawer'].map(id => document.getElementById(id)).filter(Boolean);
    const names = ['Your account and checkout', 'Shopping bag', 'Wishlist', 'Navigation menu'];
    const state = new Map();
    layers.forEach((layer, i) => {
      const panel = layer.querySelector('.drawer') || layer.firstElementChild || layer;
      panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true');
      panel.setAttribute('aria-label', names[i]); panel.tabIndex = -1;
      let open = false, previous;
      const update = () => {
        const next = !layer.classList.contains('hidden');
        if (next && !open) {
          previous = document.activeElement;
          const control = panel.querySelector('input:not([type=hidden]),select,textarea,button,a[href],[tabindex="0"]') || panel;
          control.focus({preventScroll: true});
        } else if (!next && open && previous?.isConnected) previous.focus({preventScroll: true});
        open = next;
      };
      state.set(layer, {panel, update});
      new MutationObserver(update).observe(layer, {attributes: true, attributeFilter: ['class']});
      update();
    });
    document.addEventListener('keydown', event => {
      const active = layers.filter(layer => !layer.classList.contains('hidden')).find(layer => layer.contains(document.activeElement));
      if (!active) return;
      const {panel} = state.get(active);
      if (event.key === 'Escape' && active.id === 'bo-u-modal') { event.preventDefault(); window.boU?.close(); }
      if (event.key !== 'Tab') return;
      const focusable = [...panel.querySelectorAll('button,a[href],input,select,textarea,[tabindex]')].filter(el =>
        el.tabIndex >= 0 && !el.disabled && el.getClientRects().length);
      const first = focusable[0] || panel, last = focusable.at(-1) || panel;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
  }
  document.addEventListener('DOMContentLoaded', ready);
})();
