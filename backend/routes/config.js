// 기준선(Baseline) · 북마크/프리셋 — 설정류 조회/저장.
import { Router } from 'express';
import { loadBookmarks, saveBookmarks, activePreset, presetNames, savePreset } from '../../shared/bookmarks.js';
import { loadBaseline, saveBaseline } from '../../shared/baseline.js';
import { loadOverlays, saveOverlays, discoverOverlays } from '../../shared/overlays.js';
import { restartRosbridge, be } from '../ros.js';
import { rbRetarget } from '../telemetry.js';
import { rosbridgeOverride, setRosbridgeOverride } from '../../shared/ports.js';

const router = Router();

// rosbridge 대상 전환 — 저장 후 프로세스 안에서 새 대상으로 재연결한다(재시작 루프 없이 띄워도 동작)
router.get('/api/rosbridge', (req, res) => res.json({ url: be.url, override: rosbridgeOverride() }));
router.post('/api/rosbridge', (req, res) => {
  let u = String(req.body.url || '').trim();
  const is_missing_scheme = (u !== '' && !/^wss?:\/\//.test(u));
  if (is_missing_scheme) {
    u = 'ws://' + u;
  }
  const is_missing_port = (u !== '' && !/:\d+/.test(u.replace(/^wss?:\/\//, '')));
  if (is_missing_port) {
    u = u + ':9090';
  }
  setRosbridgeOverride(u);
  rbRetarget(be.url);   // 비우면 env·기본값으로 돌아가므로 u 가 아니라 be.url
  res.json({ ok: true, url: be.url });
});

// 기준선(Baseline) — 프로파일은 브라우저가 계산해 저장, diff 도 브라우저에서.
router.get('/api/baseline', (req, res) => res.json({ baseline: loadBaseline() }));
router.post('/api/baseline', (req, res) => { saveBaseline(req.body.profile || {}); res.json({ ok: true }); });

// 북마크
router.get('/api/bookmarks', (req, res) => res.json({ bookmarks: loadBookmarks(), preset: activePreset(), presets: presetNames() }));
router.post('/api/bookmarks', (req, res) => { saveBookmarks(req.body.bookmarks || [], activePreset()); res.json({ ok: true }); });

// 워크스페이스 오버레이 — shared/overlays.js 참조(왜 필요한지는 거기 주석).
// enabled 검증만 하고 candidates 소속 여부는 안 본다 — 사용자가 후보에 없는 경로를 손으로 넣을 수 있어야 한다.
router.get('/api/overlays', (req, res) => res.json({ candidates: discoverOverlays(), enabled: loadOverlays() }));
router.post('/api/overlays', (req, res) => {
  const enabled = req.body.enabled;
  if (Array.isArray(enabled) && enabled.every((s) => typeof s === 'string')) {
    saveOverlays(enabled);
    restartRosbridge();   // 워치독이 새 오버레이로 재기동(backend/ros.js)
  }
  res.json({ candidates: discoverOverlays(), enabled: loadOverlays() });
});

router.post('/api/preset', (req, res) => {
  const b = req.body;
  const names = presetNames();
  let name = b.name;
  if (!name && names.length) {
    const cur = activePreset();
    name = names[(names.indexOf(cur) + 1) % names.length];
  }
  if (name) savePreset(name);
  res.json({ preset: activePreset(), presets: names, bookmarks: loadBookmarks() });
});

export default router;