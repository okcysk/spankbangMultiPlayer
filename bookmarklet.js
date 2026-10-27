/* SpankBang Quad Player bookmarklet.
   index.html serializes this function into a javascript: link with the player URL baked in,
   so it must not reference anything outside its own body. It runs in the user's own tab on
   SpankBang, which is why no server-side request to SpankBang is needed.
   Use block comments only: the source is turned into a URL. */
function sbqpBookmarklet(PLAYER_URL) {
  const MAX = 4, KEY = 'sbqp-selected', PANEL_ID = 'sbqp-panel';
  const SITE = /(^|\.)spankbang\.(com|party)$/i;
  const VIDEO_PATH = /^\/([a-z0-9]{1,16})\/video(?:\/|$)/i;
  if (!SITE.test(location.hostname)) { alert('SpankBangのページで実行してください。'); return; }
  if (window.__sbqpBookmarklet) { window.__sbqpBookmarklet.scan(); return; }

  /* sessionStorage survives navigation within this tab, so a selection can span several search pages. */
  let selected = [];
  try { selected = JSON.parse(sessionStorage.getItem(KEY) || '[]').filter(v => v && /^[a-z0-9]{1,16}$/i.test(v.id)).slice(0, MAX); } catch (e) {}
  const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(selected)); } catch (e) {} };
  const has = id => selected.some(v => v.id === id);

  function slugTitle(url) {
    let slug = url.pathname.split('/').filter(Boolean).pop() || '';
    try { slug = decodeURIComponent(slug); } catch (e) {}
    return slug.replace(/[+_-]+/g, ' ');
  }

  function videoInfo(anchor) {
    let url;
    try { url = new URL(anchor.href, location.href); } catch (e) { return null; }
    if (!SITE.test(url.hostname)) return null;
    const match = url.pathname.match(VIDEO_PATH);
    if (!match) return null;
    const title = anchor.getAttribute('title') || anchor.getAttribute('aria-label') ||
      anchor.querySelector('img')?.alt || slugTitle(url) || `Video ${match[1]}`;
    return { id: match[1], title: title.trim().replace(/\s+/g, ' ').slice(0, 180) };
  }

  /* Styles are set through the CSSOM rather than a <style> element so a strict style-src CSP cannot block them. */
  const css = (el, text) => { el.style.cssText = text; return el; };
  const button = (label, primary) => {
    const b = css(document.createElement('button'), `border:0;border-radius:9px;padding:9px 12px;font:700 13px system-ui,sans-serif;cursor:pointer;${primary ? 'background:#c4f26a;color:#18200f' : 'background:#30333c;color:#f3f3f5'}`);
    b.type = 'button'; b.textContent = label; return b;
  };

  const panel = css(document.createElement('div'), 'position:fixed;z-index:2147483647;right:18px;bottom:18px;display:flex;flex-wrap:wrap;align-items:center;gap:10px;max-width:calc(100vw - 36px);padding:12px 14px;background:#16181ef0;border:1px solid #41444e;border-radius:14px;color:#f7f7fa;font:14px/1.4 system-ui,sans-serif;box-shadow:0 8px 30px #0008');
  panel.id = PANEL_ID;
  const count = css(document.createElement('span'), 'font-weight:650;min-width:96px');
  const message = css(document.createElement('span'), 'flex-basis:100%;color:#ffb4b4;font-size:12px;display:none');
  const current = location.pathname.match(VIDEO_PATH);
  const addCurrent = button('この動画を追加', false);
  const clear = button('クリア', false);
  const open = button('Quad Playerで開く', true);
  const close = button('×', false);
  close.title = '閉じる';
  panel.append(count);
  if (current) panel.append(addCurrent);
  panel.append(clear, open, close, message);
  document.body.append(panel);

  let messageTimer;
  function notice(text) {
    message.textContent = text; message.style.display = 'block';
    clearTimeout(messageTimer); messageTimer = setTimeout(() => { message.style.display = 'none'; }, 2200);
  }

  function refresh() {
    count.textContent = `${selected.length} / ${MAX} 選択`;
    open.disabled = selected.length < 1; open.style.opacity = open.disabled ? '.42' : '1';
    if (current) addCurrent.disabled = has(current[1]);
    for (const box of document.querySelectorAll('.sbqp-check')) box.checked = has(box.dataset.videoId);
    save();
  }

  function toggle(info, on) {
    if (on && !has(info.id)) {
      if (selected.length >= MAX) { notice(`選択できるのは${MAX}本までです。`); refresh(); return; }
      selected.push(info);
    } else if (!on) selected = selected.filter(v => v.id !== info.id);
    refresh();
  }

  function scan() {
    for (const anchor of document.querySelectorAll('a[href*="/video/"]')) {
      /* Only mark thumbnail links, never title links, so each card gets one checkbox. */
      if (!anchor.querySelector('img') || anchor.querySelector('.sbqp-check')) continue;
      const info = videoInfo(anchor);
      if (!info) continue;
      if (getComputedStyle(anchor).position === 'static') anchor.style.position = 'relative';
      const box = css(document.createElement('input'), 'position:absolute;z-index:2147483646;top:8px;left:8px;width:32px;height:32px;margin:0;accent-color:#c4f26a;cursor:pointer;filter:drop-shadow(0 1px 3px #000)');
      box.type = 'checkbox'; box.className = 'sbqp-check'; box.dataset.videoId = info.id;
      box.title = '動画を選択'; box.checked = has(info.id);
      box.addEventListener('click', event => event.stopPropagation());
      box.addEventListener('change', event => { event.stopPropagation(); toggle(info, box.checked); });
      anchor.append(box);
    }
  }

  let scanTimer;
  const observer = new MutationObserver(() => { clearTimeout(scanTimer); scanTimer = setTimeout(scan, 200); });
  observer.observe(document.body, { childList: true, subtree: true });

  addCurrent.addEventListener('click', () => {
    const title = document.querySelector('h1')?.textContent || document.title;
    toggle({ id: current[1], title: title.trim().replace(/\s+/g, ' ').slice(0, 180) }, true);
  });
  clear.addEventListener('click', () => { selected = []; refresh(); });
  open.addEventListener('click', () => {
    if (!selected.length) return;
    const params = new URLSearchParams({ h: location.host });
    for (const v of selected) { params.append('v', v.id); params.append('t', v.title); }
    const target = `${PLAYER_URL}#${params}`;
    const win = window.open(target, '_blank');
    if (win) win.opener = null; else location.href = target;
  });
  close.addEventListener('click', () => {
    observer.disconnect(); panel.remove();
    for (const box of document.querySelectorAll('.sbqp-check')) box.remove();
    delete window.__sbqpBookmarklet;
  });

  window.__sbqpBookmarklet = { scan };
  scan(); refresh();
}
