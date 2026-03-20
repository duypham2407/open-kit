---
description: "Triggers the subagent-driven-development skill to execute an implementation plan."
---

# Lệnh: `/execute-plan`

Lệnh này chỉ dùng cho lane `Full Delivery`.

Khi User gõ lệnh `/execute-plan [đường_dẫn_tới_plan_md]`, hoặc khi `FullstackAgent` nhận lệnh bắt đầu code theo plan:

1. Đọc `AGENTS.md`, `context/navigation.md`, `.opencode/workflow-state.json`, `context/core/session-resume.md`, và `context/core/workflow-state-schema.md` trước khi tiếp tục workflow đang dở.
2. Kiểm tra `mode` hiện tại là `full`. Nếu đang ở quick mode, không dùng `/execute-plan`.
3. Dùng `node .opencode/workflow-state.js validate` để xác nhận state hợp lệ trước khi thực thi.
4. Đọc file Plan được chỉ định.
5. Load skill `skills/subagent-driven-development/SKILL.md`.
6. Thông báo cho User biết đang bắt đầu Task 1 trên tổng số X Tasks.
7. Bắt đầu dispatch subagent hoặc thực thi Task 1 tuân thủ TDD đỏ-xanh-refactor.
