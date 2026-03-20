---
description: "Triggers the subagent-driven-development skill to execute an implementation plan."
---

# Lệnh: `/execute-plan`

Khi User gõ lệnh `/execute-plan [đường_dẫn_tới_plan_md]`, hoặc khi Fullstack Agent nhận lệnh bắt đầu code:

1. Đọc file Plan được chỉ định.
2. Load skill `skills/subagent-driven-development/SKILL.md`.
3. Thông báo cho User biết đang bắt đầu Task 1 trên tổng số X Tasks.
4. Bắt đầu dispatch subagent (hoặc thực thi Task 1 tuân thủ TDD đỏ-xanh-refactor).
