/* SpankBang Multi Player bookmarklet.
   index.html serializes this function into a javascript: link with the player URL and version baked in,
   so it must not reference anything outside its own body. It runs in the user's own tab on
   SpankBang, which is why no server-side request to SpankBang is needed: the video pages are
   read same-origin to find each video's MP4 URL, so the player can drive its own <video>.
   Use block comments only: the source is turned into a URL. */
function sbqpBookmarklet(PLAYER_URL, VERSION) {
  const MAX = 16, KEY = 'sbqp-selected', PANEL_ID = 'sbqp-panel';
  /* 720p first: up to 16 streams play at once, so the sharpest file is rarely the best one. */
  const QUALITY = ['720p', '480p', '1080p', '320p', '240p', '4k'];
  const SITE = /(^|\.)spankbang\.(com|party)$/i;
  /* Video links come in three shapes: /<id>/video/<slug>, /<id>/embed/, and, inside a playlist,
     /<playlist id>-<id>/playlist/<slug>. A bare /<id>/playlist/ is the playlist itself, not a video. */
  const VIDEO_PATH = /^\/([a-z0-9]{1,16})\/(?:video|embed)(?:\/|$)/i;
  const PLAYLIST_ITEM = /^\/[a-z0-9]{1,16}-([a-z0-9]{1,16})\/playlist(?:\/|$)/i;
  const videoId = path => (path.match(VIDEO_PATH) || path.match(PLAYLIST_ITEM) || [])[1] || '';
  if (!SITE.test(location.hostname)) { alert('SpankBangのページで実行してください。'); return; }
  if (window.__sbqpBookmarklet) { window.__sbqpBookmarklet.scan(); return; }

  /* Every run starts with an empty selection. Older versions kept it in sessionStorage, so drop that copy too. */
  let selected = [];
  try { sessionStorage.removeItem(KEY); } catch (e) {}
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
    const id = videoId(url.pathname);
    if (!id) return null;
    const title = anchor.getAttribute('title') || anchor.getAttribute('aria-label') ||
      anchor.querySelector('img')?.alt || slugTitle(url) || `Video ${id}`;
    /* An embed page may not carry the stream list, so read the video page instead; a playlist item page plays the video itself.
       The page is read from this tab's own host, since a link to another language host would be a cross-origin fetch. */
    const page = location.origin + (/\/embed(\/|$)/i.test(url.pathname) ? `/${id}/video/` : url.pathname);
    return { id, url: page, title: title.trim().replace(/\s+/g, ' ').slice(0, 180) };
  }

  /* SpankBang lists its files in a stream_data object keyed by quality; older pages only have <source> tags. */
  function bestMp4(html) {
    const text = html.replace(/\\\//g, '/').replace(/&amp;/g, '&');
    const byQuality = {};
    const data = text.match(/stream_data\s*=\s*(\{[\s\S]*?\})\s*;/);
    if (data) {
      for (const entry of data[1].matchAll(/["']?(\w+)["']?\s*:\s*\[([^\]]*)\]/g)) {
        const url = entry[2].match(/https:\/\/[^"'\s]+/);
        if (url && /\.mp4(\?|$)/i.test(url[0])) byQuality[entry[1].toLowerCase()] = url[0];
      }
    }
    for (const quality of QUALITY) if (byQuality[quality]) return byQuality[quality];
    const any = Object.values(byQuality)[0];
    if (any) return any;
    const source = text.match(/<source\b[^>]*\bsrc=["'](https:\/\/[^"']+\.mp4[^"']*)["']/i);
    if (source) return source[1];
    return text.match(/https:\/\/[^"'\s<>]+\.mp4(?:\?[^"'\s<>]*)?/i)?.[0] || '';
  }
  const streams = new Map();
  const read = url => fetch(url, { credentials: 'include' })
    .then(response => response.ok ? response.text() : '').then(bestMp4).catch(() => '');
  function resolve(video) {
    if (!streams.has(video.id)) {
      /* If the linked page has no MP4 (a playlist page laid out differently, say), try the plain video page. */
      const plain = `/${video.id}/video/`;
      streams.set(video.id, read(video.url || plain).then(url => url || (video.url && !video.url.endsWith(plain) ? read(plain) : '')));
    }
    return streams.get(video.id);
  }

  function encodeState(state) {
    const bytes = new TextEncoder().encode(JSON.stringify(state));
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  /* Styles are set through the CSSOM rather than a <style> element so a strict style-src CSP cannot block them. */
  const css = (el, text) => { el.style.cssText = text; return el; };
  const button = (label, primary) => {
    const b = css(document.createElement('button'), `border:0;border-radius:9px;padding:9px 12px;font:700 13px system-ui,sans-serif;cursor:pointer;${primary ? 'background:#c4f26a;color:#18200f' : 'background:#30333c;color:#f3f3f5'}`);
    b.type = 'button'; b.textContent = label; return b;
  };

  const panel = css(document.createElement('div'), 'position:fixed;z-index:2147483647;right:18px;bottom:18px;display:flex;flex-wrap:wrap;align-items:center;gap:10px;max-width:calc(100vw - 36px);padding:12px 14px;background:#16181ef0;border:1px solid #41444e;border-radius:14px;color:#f7f7fa;font:14px/1.4 system-ui,sans-serif;box-shadow:0 8px 30px #0008');
  panel.id = PANEL_ID;
  const label = css(document.createElement('span'), 'flex-basis:100%;color:#aeb4c0;font-size:11px');
  label.textContent = `SpankBang Multi Player ${VERSION || ''}`.trim();
  const count = css(document.createElement('span'), 'font-weight:650;min-width:96px');
  const message = css(document.createElement('span'), 'flex-basis:100%;color:#ffb4b4;font-size:12px;display:none');
  const current = videoId(location.pathname);
  const addCurrent = button('この動画を追加', false);
  const clear = button('クリア', false);
  const open = button('Multi Playerで開く', true);
  const close = button('×', false);
  close.title = '閉じる';
  /* Contact links styled like the Monsnode web player's header: a circled icon followed by the address. */
  const contact = (href, icon, text) => {
    const link = css(document.createElement('a'), 'display:inline-flex;align-items:center;gap:6px;color:#c6cad2;text-decoration:none;font-size:13px;white-space:nowrap');
    link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer';
    const mark = css(document.createElement('span'), 'display:inline-grid;place-items:center;width:20px;height:20px;border:1px solid #59606d;border-radius:50%;font-size:12px;font-weight:800');
    mark.textContent = icon; mark.setAttribute('aria-hidden', 'true');
    link.append(mark, text);
    link.addEventListener('mouseenter', () => { link.style.color = '#c4f26a'; link.style.textDecoration = 'underline'; });
    link.addEventListener('mouseleave', () => { link.style.color = '#c6cad2'; link.style.textDecoration = 'none'; });
    return link;
  };
  const contacts = css(document.createElement('span'), 'display:inline-flex;align-items:center;gap:12px');
  contacts.append(contact('mailto:okcysk@gmail.com', '✉', 'okcysk@gmail.com'), contact('https://x.com/okcysk46770', '𝕏', '@okcysk46770'));
  panel.append(label, count);
  if (current) panel.append(addCurrent);
  panel.append(clear, open, contacts, close, message);
  document.body.append(panel);

  let messageTimer;
  function notice(text) {
    message.textContent = text; message.style.display = 'block';
    clearTimeout(messageTimer); messageTimer = setTimeout(() => { message.style.display = 'none'; }, 2600);
  }

  function refresh() {
    count.textContent = `${selected.length} / ${MAX} 選択`;
    open.disabled = selected.length < 1; open.style.opacity = open.disabled ? '.42' : '1';
    if (current) addCurrent.disabled = has(current);
    for (const box of document.querySelectorAll('.sbqp-check')) box.checked = has(box.dataset.videoId);
  }

  function toggle(info, on) {
    if (on && !has(info.id)) {
      if (selected.length >= MAX) { notice(`選択できるのは${MAX}本までです。`); refresh(); return; }
      selected.push(info);
      resolve(info);
    } else if (!on) selected = selected.filter(v => v.id !== info.id);
    refresh();
  }

  /* A thumbnail link holds an image or preview, or is at least thumbnail-sized; a title link is a short line of text. */
  const isThumb = anchor => {
    if (anchor.querySelector('img,picture,video')) return true;
    const box = anchor.getBoundingClientRect();
    return box.width >= 100 && box.height >= 56;
  };
  /* Any page under the site works: the top page, playlists, channels, related videos and so on. */
  function scan() {
    for (const anchor of document.querySelectorAll('a[href]')) {
      if (anchor.dataset.sbqp || panel.contains(anchor)) continue;
      const info = videoInfo(anchor);
      if (!info) { anchor.dataset.sbqp = 'skip'; continue; }
      /* Not done yet: a lazy-loaded card may only get its image later. */
      if (!isThumb(anchor)) continue;
      anchor.dataset.sbqp = 'done';
      /* One checkbox per card, even when the card links the same video from several thumbnails. */
      const card = anchor.parentElement?.parentElement || anchor.parentElement;
      if (card && [...card.querySelectorAll('.sbqp-check')].some(box => box.dataset.videoId === info.id)) continue;
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
    toggle({ id: current, url: location.origin + location.pathname, title: title.trim().replace(/\s+/g, ' ').slice(0, 180) }, true);
  });
  clear.addEventListener('click', () => { selected = []; refresh(); });
  open.addEventListener('click', async () => {
    if (!selected.length) return;
    /* Open the tab before awaiting the lookups: a window.open after a long await loses the click's popup permission. */
    const win = window.open('', '_blank');
    open.disabled = true; open.textContent = '動画URLを取得中…';
    const urls = await Promise.all(selected.map(resolve));
    const slots = selected.map((video, i) => ({ i, id: video.id, h: location.host, t: video.title, u: urls[i] }));
    const state = { v: 1, n: [1, 2, 4, 9, 16].find(n => n >= slots.length), c: slots.length, slots };
    const target = `${PLAYER_URL}#share=${encodeState(state)}`;
    const missing = urls.filter(url => !url).length;
    if (missing) notice(`${missing}本は動画URLを取得できなかったため、埋め込みプレーヤー（シークバーなし）で再生します。`);
    if (win) { win.opener = null; win.location.href = target; } else location.href = target;
    /* The player has its own copy of the selection now, so the next pick starts from nothing. */
    selected = [];
    open.textContent = 'Multi Playerで開く'; refresh();
  });
  close.addEventListener('click', () => {
    observer.disconnect(); panel.remove();
    for (const box of document.querySelectorAll('.sbqp-check')) box.remove();
    for (const anchor of document.querySelectorAll('a[data-sbqp]')) delete anchor.dataset.sbqp;
    delete window.__sbqpBookmarklet;
  });

  window.__sbqpBookmarklet = { scan };
  scan(); refresh();
}
