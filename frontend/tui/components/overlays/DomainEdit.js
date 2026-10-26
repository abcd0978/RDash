// ROS 환경 표시 + rosbridge 대상 전환 — domainEdit 모드에서만 마운트.
//
// 예전엔 여기서 ROS_DOMAIN_ID 를 바꿔 다른 도메인의 그래프를 엿볼 수 있었다. 지금은 ROS 에 붙는 주체가
// 백엔드라, TUI 가 자기 환경변수를 바꿔봐야 아무 효과가 없다. 도메인은 백엔드를 띄울 때 정해진다.
// (도메인 "목록"은 애초에 못 보여준다 — DDS 는 어떤 도메인이 존재하는지 알려주지 않는다. 쓰는 값만 알 수 있다.)
// rosbridge 대상은 웹 🔌 rosbridge 와 같은 POST /api/rosbridge 로 바꾼다 — 백엔드가 프로세스 안에서 새 대상으로 재연결한다.
import { h, useState, useEffect } from '../../react.js';
import { Box, Text, useInput } from 'ink';
import { useDashboard } from '../../store.js';
import { typable } from '../../../../shared/util.js';
import { api, post } from '../../lib/api.js';

export function DomainEdit() {
  const d = useDashboard();
  const e = d.env || {};
  const [value, setValue] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => { api('/api/rosbridge').then((r) => { if (r) setValue(r.override || ''); }); }, []);

  const save = async () => {
    setMsg('저장됨 — 새 대상으로 연결 중…');
    await post('/api/rosbridge', { url: value });
    const o = await api('/api/env');
    if (o) d.setEnv(o);
    d.setDomainEdit(null);
  };

  useInput((ch, key) => {
    if (key.escape) d.setDomainEdit(null);
    else if (key.return) save();
    else if (key.backspace || key.delete) setValue((v) => v.slice(0, -1));
    else if (typable(ch, key)) setValue((v) => v + ch);
  }, { isActive: !!process.stdin.isTTY && !msg });

  const row = (k, v) => h(Text, null, h(Text, { dimColor: true }, `${k}: `), h(Text, { color: 'cyan' }, String(v || '—')));

  return h(Box, { flexDirection: 'column' },
    h(Text, { color: 'yellow' }, ' ROS 환경 (백엔드 기준)'),
    row(' 백엔드', `${e.backend}${e.url ? ` → ${e.url}` : ''}`),
    row(' 호스트', e.host),
    row(' ROS', e.ver === '2' ? '2' : '1'),
    e.ver === '2' ? row(' 도메인', `${e.domain}  (rmw: ${e.rmw})`) : row(' 마스터', e.master),
    h(Box, null,
      h(Text, { color: 'yellow' }, ' rosbridge 대상 = '),
      h(Text, { backgroundColor: 'yellow', color: 'black' }, `${value} `)),
    h(Text, { dimColor: true }, msg || ' IP만 입력하면 ws://IP:9090 · 비우고 Enter 면 로컬로 복귀 · Enter 저장 후 연결  Esc 닫기'));
}
