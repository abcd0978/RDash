/* rosbridge 대상 전환 — 다른 보드의 rosbridge 로 붙인다. 저장하면 백엔드가 새 대상으로 재연결한다. */
import { el, api, post } from '../lib/dom.js';
import { openModal, toast } from '../lib/modal.js';

export function rosbridge() {
  const wrap = el('div', {});
  openModal('🔌 rosbridge 대상', wrap);
  api('/api/rosbridge').then((r) => {
    wrap.innerHTML = '';
    wrap.append(el('div', { class: 'hint', style: 'margin-bottom:8px;line-height:1.5' },
      '현재: ' + r.url + ' — IP만 입력하면 ws://IP:9090 으로 저장됩니다. 저장하면 새 대상으로 다시 연결하고 페이지를 새로고침합니다.'));
    const input = el('input', { placeholder: '100.88.31.49 또는 ws://host:9090', style: 'width:60%', value: r.override || '' });
    const save = async (url) => {
      await post('/api/rosbridge', { url });
      toast('저장됨 — 새 대상으로 연결 중', 'ok');
      setTimeout(() => location.reload(), 1000);
    };
    const saveBtn = el('button', { class: 'act', onclick: () => save(input.value) }, '저장 후 연결');
    const clearBtn = el('button', { class: 'act', onclick: () => save('') }, '로컬로 복귀');
    input.addEventListener('keydown', (e) => {
      const is_enter = (e.key === 'Enter');
      if (is_enter) {
        save(input.value);
      }
    });
    wrap.append(el('div', { class: 'actbtns', style: 'margin-top:6px' }, input, saveBtn, clearBtn));
  });
}
