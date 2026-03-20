---
description: "Starts the Quick Task lane for narrow, low-risk work."
---

# Lệnh: `/quick-task`

Khi User gõ `/quick-task [mô_tả]`, `MasterOrchestrator` phải:

1. Đọc `AGENTS.md`, `context/navigation.md`, `context/core/workflow.md`, và `.opencode/workflow-state.json` nếu đang resumable.
2. Kiểm tra hard triggers để xác nhận task đủ điều kiện vào quick mode.

Hard triggers loại khỏi quick mode:

- feature mới nhiều bước
- ambiguity cao về requirement
- thay đổi API, schema, auth, billing, permission, hoặc security
- thay đổi thiết kế hoặc kiến trúc
- phạm vi chạm nhiều subsystem

3. Nếu task không đủ điều kiện:
   - từ chối quick mode
   - giải thích lý do
   - hướng sang `/delivery`
4. Nếu task đủ điều kiện:
   - khởi tạo `quick_intake`
   - ghi `mode = quick` và `mode_reason`
   - tạo quick intake brief
   - route sang `FullstackAgent`
5. Khi QA Lite pass, đóng task qua `quick_done`.

Quick mode không được dùng PM, BA, Architect, hoặc Tech Lead.
