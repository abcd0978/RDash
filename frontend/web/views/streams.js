/* streamView(구 stream) · log · diag — 실시간 라인 스트림(로그/진단) 모달. */

import { el } from '../lib/dom.js';
import { openModal, setModalSub } from '../lib/modal.js';
import { openStream } from '../lib/stream.js';
import { state } from '../lib/state.js';

const ROS1_LOG_LEVEL = { 1: 10, 2: 20, 4: 30, 8: 40, 16: 50 };

// more: 같은 표에 섞어 넣을 추가 스트림 [{ endpoint, parse }] — 로그 창의 토픽 발행 줄
export function streamView(title, endpoint, parse, klass, more = []) {
  const filterInp = el('input', { placeholder: '필터…', style: 'margin-bottom:6px' });
  const tbl = el('table', { class: 'tbl' }), wrap = el('div', {}, filterInp, tbl);
  openModal(title, wrap);
  const rows = [];
  let is_render_queued = false;
  const queueRender = () => {   // 토픽 발행 줄이 초당 수십 개 들어와도 프레임당 한 번만 다시 그린다
    if (is_render_queued) {
      return;
    }
    is_render_queued = true;
    requestAnimationFrame(() => { is_render_queued = false; rerender(); });
  };
  const rerender = () => { const f = filterInp.value.toLowerCase(); tbl.innerHTML = ''; rows.filter((r) => !f || r.text.toLowerCase().includes(f)).slice(-400).forEach((r) => tbl.append(el('tr', { class: 'lrow ' + r.cls }, el('td', {}, r.a), el('td', {}, r.b)))); wrap.scrollTop = wrap.scrollHeight; };
  filterInp.oninput = rerender;
  const open = (ep, ps) => openStream(ep, (d) => { const blk = JSON.parse(d); for (const r of ps(blk)) { rows.push(r); if (rows.length > 1000) rows.shift(); } queueRender(); });
  const subs = [open(endpoint, parse), ...more.map((m) => open(m.endpoint, m.parse))];
  setModalSub({ close() { subs.forEach((s) => s.close()); } });
}

export function log() {
  const L = (l) => (l >= 50 ? 'FATAL' : l >= 40 ? 'ERROR' : l >= 30 ? 'WARN' : l >= 20 ? 'INFO' : 'DEBUG'), C = (l) => (l >= 40 ? 'ERROR' : l >= 30 ? 'WARN' : 'OK');
  streamView('📜 로그 /rosout', '/rosout', (blk) => {
    const lv = /level:\s*(\d+)/.exec(blk), nm = /name:\s*["']?([^\n"']+)/.exec(blk), ms = /msg:\s*["']?(.*)/.exec(blk), n = lv ? +lv[1] : 0;
    let lvl = ROS1_LOG_LEVEL[n] || 0;   // ROS1 Log 레벨(1/2/4/8/16) → ROS2 단위
    const is_ros2 = (state.ver === '2');
    if (is_ros2) {
      lvl = n;
    }
    return [{ a: L(lvl), b: (nm ? nm[1].trim() : '?') + ': ' + (ms ? ms[1].replace(/["']\s*$/, '').trim() : ''), cls: C(lvl), text: blk }];
  }, undefined, [{ endpoint: '/publog', parse: (p) => [{ a: 'PUB', b: p.topic + ': ' + p.text, cls: 'OK', text: p.topic + ' ' + p.text }] }]);
}

// 토픽 발행 이력 — 백엔드가 쌓아 둔 이력을 먼저 받고, 이후 발행되는 메시지가 실시간으로 붙는다
export function pubhist(it) {
  const hms = (t) => { const d = new Date(t); return d.toLocaleTimeString('ko-KR', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0'); };
  streamView('🕘 발행 이력 ' + it.name, '/pubhist?topic=' + encodeURIComponent(it.name), (e) => [{ a: hms(e.t), b: e.text, cls: 'OK', text: e.text }]);
}

export function diag() {
  const LV = ['OK', 'WARN', 'ERROR', 'STALE'];
  streamView('🩺 진단 /diagnostics', '/diagnostics', (blk) => {
    const out = [];
    const si = blk.indexOf('status:'), sb = si >= 0 ? blk.slice(si) : blk;
    for (const part of sb.split(/\n\s*- /).slice(1)) {
      const lv = /level:\s*(\d+)/.exec(part), nm = /name:\s*["']?(.*)/.exec(part), ms = /message:\s*["']?(.*)/.exec(part), lvl = lv ? +lv[1] : 0;
      out.push({ a: LV[lvl] || '?', b: (nm ? nm[1].replace(/["']\s*$/, '').trim() : '?') + ': ' + (ms ? ms[1].replace(/["']\s*$/, '').trim() : ''), cls: LV[lvl] || 'OK', text: part });
    }
    return out;
  });
}
