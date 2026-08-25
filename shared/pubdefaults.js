// 발행 프리셋 — 토픽별 "미리 채운 메시지" 목록. 비개발자(QA)가 메시지 구조를 몰라도 값만 고쳐 발행하게 한다.
// 출처: shared/pubdefaults.json(번들 — teleop 프리셋처럼 rdash 가 아는 스택은 여기 실어 배포) + ~/.rdash_pubdefaults.json(기기별,
// 같은 토픽이면 홈 파일이 이긴다). 대상 프로젝트 레포는 rdash 를 몰라도 된다.
// 형식: { "/topic": [ {preset}, ... ] } 또는 { "/topic": { "presets": [ ... ], "reply": "/응답토픽", "probe": {...} } }
//   preset = { "field.path": value, ... } — 첫 항목이 기본 프리필, 나머지는 폼에서 전환.
//   reply  = 지정하면 발행 후 폼을 닫지 않고 그 토픽의 최신 메시지를 폼 하단에 보여준다(명령→결과 토픽 쌍).
//   probe  = 지원 항목이 대상에 따라 달라지는 서비스용. 폼을 열 때 request 를 한 번 호출해
//            응답에 없는 프리셋을 감춘다(filterByProbe). 응답 형식은 "한 줄에 항목 이름 하나".
//            { "request": "{command: list}", "field": "command", "always": ["list","get"] }
//            field   = 프리셋에서 항목 이름을 꺼낼 필드. 그 값의 첫 토큰을 이름으로 본다.
//            always  = 항목 이름이 아닌 동사로 시작하는 프리셋(list/get 등) — 항상 남긴다.
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

export const BUNDLED_PATH = join(dirname(fileURLToPath(import.meta.url)), 'pubdefaults.json');
export const PUBDEFAULTS_PATH = join(homedir(), '.rdash_pubdefaults.json');

export function loadPubDefaults() {
  const out = {};
  for (const f of [BUNDLED_PATH, PUBDEFAULTS_PATH]) {
    let d = null;
    try { d = JSON.parse(readFileSync(f, 'utf8')); } catch { continue; }   // 없거나 깨진 파일은 무시
    for (const [topic, v] of Object.entries(d)) {
      const presets = Array.isArray(v) ? v : Array.isArray(v?.presets) ? v.presets : [];
      const probe = (!Array.isArray(v) && v?.probe && typeof v.probe === 'object') ? v.probe : null;
      out[topic] = { presets, reply: (!Array.isArray(v) && typeof v?.reply === 'string') ? v.reply : null, probe };
    }
  }
  return out;   // topic → { presets, reply, probe }
}

// probe 응답에 없는 프리셋을 걸러낸다. 항목 이름은 각 줄의 첫 토큰(공백 또는 = 앞)으로 본다.
// 전부 걸러지면 probe 가 실패했거나 규약이 다른 것이므로 원본을 그대로 돌려준다.
export function filterByProbe(presets, probe, out) {
  if (!probe || !probe.field || !out) return presets;
  // 서비스 응답은 YAML 이라 긴 문자열이 접혀 나온다 — 줄 접힘(\\ + 개행)과 이스케이프(\\n, \\ )를
  // 되돌리고 봉투(ok: True / message: ")를 벗긴 뒤 각 줄의 첫 토큰을 항목 이름으로 본다.
  const text = String(out)
    .replace(/\\\r?\n\s*/g, '')
    .replace(/\\n/g, '\n')
    .replace(/\\ /g, ' ')
    .replace(/^\s*\w+:\s*(true|false)\s*$/gim, '')
    .replace(/^\s*\w+:\s*"/gm, '');
  const supported = new Set(text.split('\n').map((l) => l.trim().replace(/^"/, '').split(/[\s=]/)[0]).filter(Boolean));
  const always = new Set(probe.always || []);
  const kept = presets.filter((p) => {
    const v = p[probe.field];
    if (typeof v !== 'string') return true;
    const head = v.trim().split(/\s+/)[0];
    return always.has(head) || supported.has(head);
  });
  return kept.length ? kept : presets;
}

// 프리셋(경로→값)을 폼 필드에 입힌다 — value 로 넣어 사용자가 이어서 고칠 수 있게(def 는 자리표시자라 첫 입력에 지워진다).
export function applyPreset(fields, preset) {
  if (!preset || typeof preset !== 'object') return fields;
  const str = (v) => (v !== null && typeof v === 'object' ? JSON.stringify(v) : String(v));
  return fields.map((f) => (f.path in preset ? { ...f, value: str(preset[f.path]) } : f));
}
