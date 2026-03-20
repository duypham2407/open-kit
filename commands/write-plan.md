---
description: "Triggers the writing-plans skill to create bite-sized tasks from specs."
---

# Lệnh: `/write-plan`

Khi User gõ `/write-plan`, hoặc khi Tech Lead Agent nhận được yêu cầu tạo kế hoạch triển khai:

1. Xác nhận đã có đủ Spec (`docs/specs/`) và Architecture (`docs/architecture/`). Nếu thiếu, báo lỗi và yêu cầu bổ sung.
2. Load skill `skills/writing-plans/SKILL.md`.
3. Khởi tạo file `docs/plans/YYYY-MM-DD-<feature>.md`.
4. Tạo draft plan theo TDD Flow.
5. In ra màn hình để User review và duyệt.
