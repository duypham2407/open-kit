---
title: OpenKit Full Project Audit — Design Spec
date: 2026-05-09
status: approved
owner: brainstorming → writing-plans
---

# OpenKit Full Project Audit — Design Spec

## 1. Mục tiêu & Nguyên tắc

### 1.1. Mục tiêu
Phát hiện và phân loại các bug/lỗi tiềm ẩn trong toàn bộ vùng sản xuất của OpenKit (npm package `@duypham93/openkit`, version hiện tại `0.5.1`). Đầu ra là:
- **Audit report** (markdown) — phân loại theo Critical / High / Medium / Low, mỗi issue có `file:line` và evidence.
- **Fix plan** (markdown) — wave-based plan với acceptance criteria, làm input cho `superpowers:writing-plans`.

### 1.2. Phạm vi (in-scope)
- `src/` — runtime, install, mcp-server, capabilities
- `src/openkit-runtime/lib/` — workflow-state, kernel, controller, FSM, bootstrap
- `bin/` — CLI entry points (`openkit`, `openkit-mcp`)
- `src/hooks/` — session-start, graph-indexer
- `scripts/` — sync/verify scripts
- `src/agents/*.md` — 7 agents (master-orchestrator, product-lead, solution-lead, fullstack, qa, quick, code-reviewer)
- `src/commands/*.md` — 15 commands
- `src/skills/` — 20 bundled skills
- `registry.json`, `AGENTS.md`, `package.json`, install manifest, `README.md`, `CHANGELOG.md`, `RELEASES.md`

### 1.3. Phạm vi (out-of-scope)
- `node_modules/`
- `release-notes/` (lịch sử)
- `src/tests/` trong audit cycle — chỉ audit gián tiếp qua coverage gaps. Test mới sẽ được thêm trong fix cycle (§4) khi fix Critical/High.
- Refactor lớn, đổi public API, performance optimization không liên quan correctness

### 1.4. Nguyên tắc
1. **Evidence-first** — Critical/High phải có `file:line` + lập luận hoặc repro step.
2. **Không fix trong audit cycle** — chỉ ghi report; fix là cycle riêng.
3. **Phân loại theo blast radius** — Critical > High > Medium > Low (matrix ở §3.4).
4. **Cross-layer check ở tổng hợp** — main agent đối chiếu drift sau khi subagents trả về.
5. **Verify trước khi đưa vào report** — Critical 100%, High spot-check 1/3.

---

## 2. Cấu trúc 4 subagents song song

### 2.1. Subagent 1 — Runtime + Workflow Core
**Vùng**: `src/openkit-runtime/lib/`, `src/runtime/`, `src/mcp-server/`, `src/hooks/`

**Tập trung tìm**:
- FSM transitions không hợp lệ, dead state, race khi nhiều process đụng SQLite
- Bootstrap `quick_intake → quick_plan` còn artefact `quick_brainstorm` không
- Error handling kernel/controller: throw nuốt, fallback im lặng
- MCP tool schemas vs handler mismatches
- Hook lifecycle: infinite loop, blocking I/O, side effect lên repo user
- State path resolution edge cases (fresh project, path có space, symlink)

### 2.2. Subagent 2 — Install / CLI / Distribution
**Vùng**: `src/install/`, `bin/`, `scripts/`, `package.json#files`, install manifest, doctor, upgrade

**Tập trung tìm**:
- File khai báo `package.json#files` nhưng không tồn tại (hoặc ngược lại)
- `merge-policy.js` ghi đè file user không backup, race khi concurrent install
- `discovery.js` / `materialize.js` — path traversal, symlink follow, permission errors
- `doctor` — false green / false red
- Upgrade flow: data migration giữa version, rollback an toàn
- Verify scripts có cover đủ không

### 2.3. Subagent 3 — Contract Layer
**Vùng**: `src/agents/*.md`, `src/commands/*.md`, `src/skills/`, `registry.json`, `AGENTS.md`, `instructions/`, `src/context/`

**Tập trung tìm**:
- Drift giữa `registry.json` ↔ FSM stages ↔ agent ownership ↔ command flow
- Agent reference command/skill không tồn tại; command chỉ định stage không có trong FSM
- 3 lanes (quick-task, delivery, migrate) có complete chain đến terminal stage
- README/AGENTS/CHANGELOG/RELEASES nhất quán phiên bản, naming, flow
- Skills bundled (`src/skills/*/SKILL.md`) metadata hợp lệ

### 2.4. Subagent 4 — Cross-cutting
**Vùng**: toàn repo, focus theo loại lỗi

**Tập trung tìm**:
- Command injection: `execSync`/`spawn` với user-controlled input
- Path traversal: file ops với path từ config/user
- Secret handling: `.env`, MCP secrets, log không leak token
- Supply chain: dependencies CVE, postinstall scripts, pinning
- Test coverage gaps ở critical path (bootstrap, merge-policy, hooks)
- Đối chiếu với semgrep/quality rules đã có

### 2.5. Sub-report template (4 subagents trả về cùng format)
```
## [Subagent N] — <vùng>
### Critical
- [C-1] <tiêu đề> — `file:line`
  - Mô tả ngắn (1-2 câu)
  - Evidence/repro: ...
  - Đề xuất fix (1 dòng): ...
### High / Medium / Low
... (cùng format)
### Notes
- Vùng đã đọc, vùng skip và lý do
```

---

## 3. Quy trình tổng hợp & cross-layer check

### 3.1. Dedupe & merge
Cùng 1 issue có thể bị 2 subagent flag. Quy tắc: gộp thành 1, ghi rõ "phát hiện từ N góc nhìn", giữ priority cao nhất.

### 3.2. Cross-layer drift check (chỉ main agent làm được)
1. **FSM ↔ registry.json ↔ commands** — stage có owner, có command kích hoạt; command map đúng stage.
2. **Agents ↔ skills ↔ commands** — references tồn tại và metadata đúng.
3. **package.json#files ↔ filesystem ↔ install manifest** — 3 nguồn khớp.
4. **README ↔ AGENTS ↔ CHANGELOG ↔ version** — `0.5.1` nhất quán mọi nơi.
5. **Test coverage ↔ critical path** — bootstrap, merge-policy, hooks, FSM transition phải có E2E.

### 3.3. Verify trước report
- **Critical**: main agent đọc lại file gốc, xác nhận. Nếu nghi ngờ → grep thêm.
- **High**: spot-check 1/3 ngẫu nhiên. Nếu sai → request subagent re-verify cả batch.
- **Medium/Low**: tin subagent (vẫn ghi `file:line`).

### 3.4. Priority matrix
| Priority | Tiêu chí |
|----------|---------|
| **Critical** | Mất dữ liệu user, crash khi bootstrap, security breach (RCE/secret leak), npm publish fail |
| **High** | Sai luồng chính 1 lane, contract drift gây fail bootstrap, doctor false-green |
| **Medium** | Edge case (path có space, fresh project), error message khó hiểu, test gap critical path |
| **Low** | Cleanup, dead code, doc lệch nhỏ |

### 3.5. Audit report structure
```
docs/superpowers/specs/2026-05-09-project-audit-report.md
├── Executive summary (counts theo priority)
├── Cross-layer findings
├── Critical (theo subagent)
├── High
├── Medium
├── Low
└── Coverage gaps (vùng đã đọc / skip + lý do)
```

---

## 4. Fix plan structure

### 4.1. Entry chuẩn cho mỗi issue
```markdown
### [C-1] <tiêu đề>
- **Priority**: Critical
- **Location**: `path/to/file.js:123-145`
- **Root cause**: 1-2 câu
- **Fix approach**: 2-4 câu (không viết code)
- **Acceptance criteria**:
  - [ ] Verifiable check 1
  - [ ] Verifiable check 2
  - [ ] Test added: `src/tests/runtime/<name>.test.js`
- **Risk if fixed wrong**: backward compat / migration concern
- **Estimated effort**: S / M / L
- **Depends on**: [C-2], [H-3]
```

### 4.2. Wave-based execution
**Wave 0 — Pre-fix safety net**
- `npm run verify:all` pass trên main hiện tại (baseline)
- Snapshot fresh-project bootstrap E2E
- Tag commit baseline

**Wave 1 — Critical**
- Fix tất cả Critical, mỗi fix 1 commit + test mới
- Sau wave: `verify:all` + manual smoke 3 lanes

**Wave 2 — High**
- Sort topo theo `Depends on`
- Fix high contract-drift trước khi sửa runtime dùng nó

**Wave 3 — Medium + Low**
- Có thể batch nhiều issue/commit
- Low có thể defer

### 4.3. Out-of-scope (ghi rõ trong plan)
- Refactor lớn (chia file > 500 dòng) — flag, không fix
- Đổi public API CLI/MCP — cần product decision riêng
- Performance optimization không liên quan correctness — defer

### 4.4. Fix plan file structure
```
docs/superpowers/specs/2026-05-09-project-audit-fix-plan.md
├── Wave 0: Pre-fix safety net
├── Wave 1: Critical
├── Wave 2: High
├── Wave 3: Medium + Low
├── Out-of-scope (deferred)
└── Verification matrix (issue → command/test)
```

### 4.5. Quan hệ với writing-plans
Fix plan này là **spec**, không phải implementation plan. Sau approval, invoke `superpowers:writing-plans` để biến thành implementation plan có TDD steps, execution order.

---

## 5. Execution flow & Deliverables

### 5.1. Quy trình tổng (audit cycle)
```
[1] Viết spec (file này) + commit
[2] Self-review spec → fix inline
[3] User review spec → approve / request changes
[4] Invoke superpowers:writing-plans (lần 1 — cho audit execution)
[5] writing-plans-driven execution:
    [5a] Spawn 4 subagents song song
    [5b] Mỗi subagent trả sub-report
    [5c] Main agent tổng hợp + cross-layer check
    [5d] Verify Critical (100%) + spot-check High (1/3)
    [5e] Viết audit report
    [5f] Viết fix plan
    [5g] Commit cả 2 file
[6] User review report + fix plan → approve
[7] Sau approval: invoke writing-plans (lần 2 — cho fix execution)
```

### 5.2. Deliverables (audit cycle)
1. **Design spec** — `docs/superpowers/specs/2026-05-09-project-audit-design.md` (file này)
2. **Audit report** — `docs/superpowers/specs/2026-05-09-project-audit-report.md`
3. **Fix plan** — `docs/superpowers/specs/2026-05-09-project-audit-fix-plan.md`
4. **Git commits** — mỗi deliverable 1 commit

### 5.3. Token & thời gian budget
- 4 subagents song song: ~80-150K tokens
- Tổng hợp + verify: ~30-50K tokens
- Tổng: ~150-200K tokens, ~30-60 phút wall-clock

### 5.4. Stop conditions & context management
- **Audit thành công**: đã đọc xong 4 vùng (mỗi vùng có sub-report), tổng hợp + cross-layer check xong, 2 file deliverable (report + fix plan) đã viết và commit.
- **Auto-compact ở 80% context window**: khi token usage của main session tiến tới 80% context window, main agent **tự động compact** (giữ lại design spec + sub-reports + cross-layer findings; loại bỏ raw tool output, exploration noise, repeated reads), rồi **tiếp tục audit** mà không dừng. Không cần user can thiệp.
  - Trước khi compact: ghi snapshot trạng thái (sub-report nào đã có, vùng nào còn lại) ra biến nội bộ / TodoWrite để recover sau compact.
  - Sau compact: verify state (sub-reports, todos) còn nguyên, tiếp tục từ đúng bước đang làm.
  - Subagents có context riêng, không bị ảnh hưởng bởi compact của main session.
- **Hard stop** (báo user, không tự tiếp tục): chỉ khi phát hiện blocking issue khiến audit tiếp không ý nghĩa (vd: branch chưa merge gây lệch lớn, repo state corrupt).

### 5.5. Risks & mitigations
| Risk | Mitigation |
|------|------------|
| Subagent thiếu context → false positive | Brief đầy đủ + verify Critical 100% |
| Subagent dừng sớm, miss vùng | Sub-report ghi "đã đọc / skip", main check |
| Cross-layer drift bị bỏ sót | 5 checks bắt buộc ở §3.2 |
| Audit report quá dài, không review nổi | Executive summary < 1 trang, detail ở phụ lục |
| Compact mất context giữa chừng | Trước compact: snapshot state (sub-reports đã có, todos) vào TodoWrite. Sau compact: verify recover được trước khi tiếp tục. |

### 5.6. Audit "thành công" khi
- 4 vùng đã đọc (hoặc skip có lý do)
- 100% Critical có evidence verify được
- Fix plan có acceptance criteria cho mọi Critical/High
- 5 cross-layer checks đã chạy, drift flag riêng
- User confirm report đủ thông tin để quyết định ưu tiên fix
