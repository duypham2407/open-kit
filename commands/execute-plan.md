---
description: "Triggers the subagent-driven-development skill to execute an implementation plan."
---

# Lệnh: `/execute-plan`

Khi User gõ lệnh `/execute-plan [đường_dẫn_tới_plan_md]`, hoặc khi Fullstack Agent nhận lệnh bắt đầu code:

1. Đọc `AGENTS.md`, `context/navigation.md`, `.opencode/workflow-state.json`, `context/core/session-resume.md`, và `context/core/workflow-state-schema.md` trước khi tiếp tục workflow đang dở.
2. Dùng `node .opencode/workflow-state.js validate` để xác nhận state hợp lệ trước khi thực thi.
3. Đọc file Plan được chỉ định.
4. Load skill `skills/subagent-driven-development/SKILL.md`.
5. Thông báo cho User biết đang bắt đầu Task 1 trên tổng số X Tasks.
6. Bắt đầu dispatch subagent (hoặc thực thi Task 1 tuân thủ TDD đỏ-xanh-refactor).
