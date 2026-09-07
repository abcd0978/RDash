/* rtsp — 도킹형 플로팅 RTSP 플레이어. 백엔드 fMP4 remux → MSE. 드래그/리사이즈, PiP·팝업 분리, 설정 저장. */
import { el } from '../lib/dom.js';
import { toast } from '../lib/modal.js';
import { openStream } from '../lib/stream.js';

const CFG = 'rdash.rtsp.cfg';
let panel = null;   // 싱글톤 — 뷰 전환해도 상주

function load() {
  try { return JSON.parse(localStorage.getItem(CFG)) || {}; } catch (_) { return {}; }
}
function save(c) {
  try { localStorage.setItem(CFG, JSON.stringify(c)); } catch (_) { /* */ }
}

export function rtsp() {
  if (panel) { panel.style.display = ''; return; }   // 이미 있으면 다시 보이기만
  panel = build();
  document.body.append(panel);
}

function build() {
  const cfg = Object.assign({ url: 'rtsp://100.88.16.17:8554/scan', presets: [], x: 0, y: 0, w: 420, h: 260, lowLatency: true }, load());

  // ── MSE 재생 엔진 — 지정한 video 엘리먼트에 스트림을 붙인다(도킹/팝업이 각자 video 소유) ──
  const video = el('video', { autoplay: true, muted: true, playsinline: true, style: 'width:100%;height:100%;background:#000;object-fit:contain;display:block' });
  let target = video;   // 현재 재생 대상 (도킹 video 또는 팝업 video)
  let stream = null, ms = null, sb = null, queue = [];
  const flush = () => { if (!sb || sb.updating || !queue.length) return; try { sb.appendBuffer(queue.shift()); } catch (_) { queue = []; } };
  const stop = () => {
    if (stream) { stream.close(); stream = null; }
    try { if (ms && ms.readyState === 'open') ms.endOfStream(); } catch (_) { /* */ }
    sb = null; queue = [];
  };
  const play = (u, vid) => {
    stop();
    if (vid) target = vid;
    u = (u || cfg.url || '').trim();
    if (!u) { toast('RTSP 주소를 입력하세요', 'err'); return; }
    cfg.url = u; save(cfg);
    setStatus('연결 중…');
    ms = new MediaSource();
    target.src = URL.createObjectURL(ms);
    ms.addEventListener('sourceopen', () => {
      try { sb = ms.addSourceBuffer('video/mp4; codecs="avc1.42E01F"'); } catch (e) { setStatus('코덱 오류: ' + e.message); return; }
      sb.mode = 'sequence';
      sb.addEventListener('updateend', () => {
        flush();
        // 저지연 — 라이브 끝단으로 계속 따라붙어 버퍼 누적 방지
        if (cfg.lowLatency && target.buffered.length) {
          const end = target.buffered.end(target.buffered.length - 1);
          if (end - target.currentTime > 1.0) target.currentTime = end - 0.3;
        }
      });
      let first = true;
      stream = openStream('/rtsp?url=' + encodeURIComponent(u), (data) => {
        if (!(data instanceof ArrayBuffer)) return;
        if (first) { first = false; setStatus(''); }
        queue.push(new Uint8Array(data, 4));
        flush();
      });
    }, { once: true });
    target.play().catch(() => {});
  };

  // ── 헤더 (드래그 핸들 + 버튼) ──
  const title = el('span', { style: 'flex:1;font-size:12px;color:var(--dim);cursor:move;user-select:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, '📺 RTSP');
  const status = el('span', { style: 'font-size:11px;color:var(--accent)' });
  const setStatus = (t) => { status.textContent = t; };
  const btn = (label, ttl, fn) => el('button', { title: ttl, onclick: fn, style: 'background:none;border:0;color:var(--fg);cursor:pointer;font-size:13px;padding:0 4px' }, label);

  const header = el('div', { style: 'display:flex;align-items:center;gap:2px;padding:4px 6px;background:var(--panel);border-bottom:1px solid var(--line)' },
    title, status,
    btn('⚙', '설정', () => toggleCfg()),
    btn('⧉', 'PiP (다른 앱 위에)', () => { try { video.requestPictureInPicture(); } catch (_) { toast('PiP 미지원 브라우저', 'err'); } }),
    btn('⊞', '새 창으로', () => popOut()),
    btn('✕', '닫기', () => { stop(); panel.remove(); panel = null; }));

  // ── 설정 패널 ──
  const urlInput = el('input', { value: cfg.url, placeholder: 'rtsp://…', style: 'flex:1;min-width:0;font-size:12px' });
  urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); play(urlInput.value); } });
  const presetSel = el('select', { style: 'font-size:11px;max-width:120px', onchange: () => { if (presetSel.value) { urlInput.value = presetSel.value; play(presetSel.value); } } });
  const refreshPresets = () => {
    presetSel.innerHTML = '';
    presetSel.append(el('option', { value: '' }, '프리셋…'));
    (cfg.presets || []).forEach((p) => presetSel.append(el('option', { value: p }, p)));
  };
  refreshPresets();
  const lowLat = el('input', { type: 'checkbox' });
  lowLat.checked = cfg.lowLatency;
  lowLat.onchange = () => { cfg.lowLatency = lowLat.checked; save(cfg); };

  const cfgPanel = el('div', { style: 'display:none;padding:6px;background:var(--card);border-bottom:1px solid var(--line);font-size:11px' },
    el('div', { style: 'display:flex;gap:4px;margin-bottom:4px' },
      urlInput,
      el('button', { class: 'act', style: 'font-size:11px', onclick: () => play(urlInput.value) }, '▶'),
      el('button', { title: '이 주소를 프리셋에 저장', style: 'font-size:11px', onclick: () => { const u = urlInput.value.trim(); if (u && !cfg.presets.includes(u)) { cfg.presets.push(u); save(cfg); refreshPresets(); toast('프리셋 저장', 'ok'); } } }, '＋')),
    el('div', { style: 'display:flex;align-items:center;gap:6px' },
      presetSel,
      el('button', { title: '선택 프리셋 삭제', style: 'font-size:11px', onclick: () => { const v = presetSel.value; if (v) { cfg.presets = cfg.presets.filter((p) => p !== v); save(cfg); refreshPresets(); } } }, '－'),
      el('label', { style: 'margin-left:auto;display:flex;align-items:center;gap:3px;cursor:pointer' }, lowLat, '저지연')));
  const toggleCfg = () => { cfgPanel.style.display = cfgPanel.style.display === 'none' ? '' : 'none'; };

  // ── 비디오 영역 + 리사이즈 핸들 ──
  const vidWrap = el('div', { style: 'position:relative;flex:1;min-height:0;background:#000' }, video);
  const resize = el('div', { style: 'position:absolute;right:0;bottom:0;width:14px;height:14px;cursor:nwse-resize;background:linear-gradient(135deg,transparent 50%,var(--dim) 50%)' });
  vidWrap.append(resize);

  const p = el('div', { style: `position:fixed;z-index:9000;display:flex;flex-direction:column;background:var(--bg);border:1px solid var(--line);border-radius:6px;box-shadow:0 6px 24px rgba(0,0,0,.4);overflow:hidden;left:${cfg.x || (window.innerWidth - cfg.w - 20)}px;top:${cfg.y || (window.innerHeight - cfg.h - 20)}px;width:${cfg.w}px;height:${cfg.h}px` },
    header, cfgPanel, vidWrap);

  // ── 드래그 이동 ──
  drag(title, p, (x, y) => { cfg.x = x; cfg.y = y; save(cfg); });
  // ── 리사이즈 ──
  resizeDrag(resize, p, (w, h) => { cfg.w = w; cfg.h = h; save(cfg); });

  play(cfg.url);
  return p;

  // ── 새 창(팝업)으로 분리 → 닫으면 rdash 로 복귀 (video 를 옮기지 않고 각 창에 새 video + 재연결) ──
  function popOut() {
    const win = window.open('', 'rtsp_' + Date.now(), `width=${cfg.w + 20},height=${cfg.h + 40}`);
    if (!win) { toast('팝업 차단됨 — 브라우저에서 이 사이트 팝업 허용', 'err'); return; }
    win.document.title = 'RTSP — ' + cfg.url;
    win.document.body.style.cssText = 'margin:0;background:#000;overflow:hidden';
    const pv = win.document.createElement('video');
    pv.autoplay = true; pv.muted = true; pv.playsInline = true; pv.controls = true;
    pv.style.cssText = 'width:100vw;height:100vh;object-fit:contain;background:#000';
    win.document.body.append(pv);
    p.style.display = 'none';
    play(cfg.url, pv);   // 팝업 video 로 재연결
    // 팝업이 닫혔는지 부모에서 폴링 — beforeunload 는 window.open 자식에서 불안정
    const poll = setInterval(() => {
      if (win.closed) { clearInterval(poll); if (panel) { p.style.display = ''; play(cfg.url, video); } }
    }, 500);
  }
}

function drag(handle, elm, onEnd) {
  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY, ox = elm.offsetLeft, oy = elm.offsetTop;
    const mv = (ev) => { elm.style.left = ox + (ev.clientX - sx) + 'px'; elm.style.top = oy + (ev.clientY - sy) + 'px'; };
    const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); onEnd(elm.offsetLeft, elm.offsetTop); };
    document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
  });
}

function resizeDrag(handle, elm, onEnd) {
  handle.addEventListener('mousedown', (e) => {
    e.preventDefault(); e.stopPropagation();
    const sx = e.clientX, sy = e.clientY, ow = elm.offsetWidth, oh = elm.offsetHeight;
    const mv = (ev) => { elm.style.width = Math.max(220, ow + (ev.clientX - sx)) + 'px'; elm.style.height = Math.max(160, oh + (ev.clientY - sy)) + 'px'; };
    const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); onEnd(elm.offsetWidth, elm.offsetHeight); };
    document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
  });
}
