/* rtsp — RTSP 주소를 백엔드에서 fMP4 remux 해 브라우저 MSE 로 재생. */
import { el } from '../lib/dom.js';
import { openModal, toast, getActiveModal } from '../lib/modal.js';
import { openStream } from '../lib/stream.js';

const LAST = 'rdash.rtsp.url';

export function rtsp() {
  let url = '';
  try { url = localStorage.getItem(LAST) || ''; } catch (_) { /* */ }

  const input = el('input', { value: url, placeholder: 'rtsp://100.88.16.17:8554/scan', style: 'flex:1;min-width:0' });
  const video = el('video', { autoplay: true, muted: true, playsinline: true, controls: true, style: 'width:100%;background:#000;border-radius:4px;margin-top:8px;max-height:70vh' });
  const status = el('div', { class: 'hint', style: 'margin-top:4px' }, '주소 입력 후 재생');

  let stream = null, ms = null, sb = null, queue = [], mime = 'video/mp4; codecs="avc1.42E01F"';

  const stop = () => {
    if (stream) { stream.close(); stream = null; }
    try { if (ms && ms.readyState === 'open') ms.endOfStream(); } catch (_) { /* */ }
    sb = null; queue = [];
  };

  const flush = () => {
    if (!sb || sb.updating || !queue.length) return;
    try { sb.appendBuffer(queue.shift()); } catch (_) { queue = []; }
  };

  const play = () => {
    stop();
    const u = input.value.trim();
    if (!u) { toast('RTSP 주소를 입력하세요', 'err'); return; }
    try { localStorage.setItem(LAST, u); } catch (_) { /* */ }
    status.textContent = '연결 중…';

    ms = new MediaSource();
    video.src = URL.createObjectURL(ms);
    ms.addEventListener('sourceopen', () => {
      try { sb = ms.addSourceBuffer(mime); } catch (e) { status.textContent = '코덱 미지원: ' + e.message; return; }
      sb.mode = 'sequence';
      sb.addEventListener('updateend', flush);
      let first = true;
      stream = openStream('/rtsp?url=' + encodeURIComponent(u), (data) => {
        if (!(data instanceof ArrayBuffer)) return;
        if (first) { first = false; status.textContent = '재생 중 — ' + u; }
        queue.push(new Uint8Array(data, 4));   // 앞 4바이트는 스트림 id
        flush();
      });
    }, { once: true });
    video.play().catch(() => {});
  };

  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); play(); } });

  const wrap = el('div', {},
    el('div', { class: 'actbtns', style: 'display:flex;gap:6px' },
      input,
      el('button', { class: 'act', onclick: play }, '▶ 재생 (Enter)'),
      el('button', { class: 'act', onclick: () => { stop(); status.textContent = '정지됨'; } }, '■ 정지')),
    status, video);

  openModal('📺 RTSP 재생', wrap);
  const mm = getActiveModal();
  if (mm) mm.close = stop;   // 모달 닫으면 스트림·ffmpeg 정리
  if (url) play();
}
