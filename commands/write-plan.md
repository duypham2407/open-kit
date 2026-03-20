---
description: "Triggers the writing-plans skill to create bite-sized tasks from specs."
---

# Lệnh: `/write-plan`

Khi User gõ `/write-plan`, hoặc khi Tech Lead Agent nhận được yêu cầu tạo kế hoạch triển khai:

1. Xác nhận đã có đủ Spec (`docs/specs/`) và Architecture (`docs/architecture/`). Nếu thiếu, báo lỗi và yêu cầu bổ sung.
2. Load skill `skills/writing-plans/SKILL.md`.
3. Đọc `context/core/project-config.md` để biết repo có command validation nào thật sự tồn tại.
4. Dùng `node .opencode/workflow-state.js show` nếu cần kiểm tra feature hiện tại và stage hiện tại.
5. Khởi tạo file `docs/plans/YYYY-MM-DD-<feature>.md` từ `docs/templates/implementation-plan-template.md`.
6. Tạo draft plan theo TDD Flow hoặc ghi rõ missing validation path nếu repo chưa có test command chuẩn.
7. In ra màn hình để User review và duyệt.
