---
description: "Triggers the writing-plans skill to create bite-sized tasks from specs."
---

# Lệnh: `/write-plan`

Lệnh này chỉ dùng cho lane `Full Delivery`.

Khi User gõ `/write-plan`, hoặc khi `TechLeadAgent` nhận được yêu cầu tạo kế hoạch triển khai:

1. Kiểm tra `mode` hiện tại là `full`. Nếu đang ở quick mode, báo lỗi và yêu cầu chuyển sang `/delivery`.
2. Xác nhận đã có đủ Spec (`docs/specs/`) và Architecture (`docs/architecture/`). Nếu thiếu, báo lỗi và yêu cầu bổ sung.
3. Load skill `skills/writing-plans/SKILL.md`.
4. Đọc `context/core/project-config.md` để biết repo có command validation nào thật sự tồn tại.
5. Có thể dùng `node .opencode/workflow-state.js show` để tham khảo feature hiện tại và stage hiện tại.
6. Khởi tạo file `docs/plans/YYYY-MM-DD-<feature>.md` từ `docs/templates/implementation-plan-template.md`.
7. Tạo draft plan theo TDD flow hoặc ghi rõ missing validation path nếu repo chưa có test command chuẩn.
8. In ra màn hình để User review và duyệt.
