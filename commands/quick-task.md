---
description: "Starts the Quick Task lane for narrow, low-risk work."
---

# Lệnh: `/quick-task`

Khi User gõ `/quick-task [mô_tả]`, `MasterOrchestrator` phải:

1. Đọc `AGENTS.md`, `context/navigation.md`, `context/core/workflow.md`, và `.opencode/workflow-state.json` nếu đang resumable.
2. Kiểm tra hard triggers để xác nhận task đủ điều kiện vào quick mode.
3. Dùng quick lane theo live Quick Task+ semantics: bounded mini-plan/checklist là first-class behavior qua `quick_plan`, stronger verification là bắt buộc trước `quick_done`, và task card vẫn chỉ là optional traceability artifact. Không đổi command name và không tạo lane mới.

Hard triggers loại khỏi quick mode:

- feature mới nhiều bước
- ambiguity cao về requirement
- contract-sensitive change như API, schema, auth, billing, permission, hoặc security
- thay đổi thiết kế hoặc kiến trúc
- phạm vi chạm nhiều subsystem lỏng liên quan
- verification path không còn ngắn và cục bộ

4. Nếu task không đủ điều kiện:
   - từ chối quick mode
   - giải thích lý do
   - hướng sang `/delivery`
5. Nếu task đủ điều kiện:
     - khởi tạo `quick_intake`
     - ghi `mode = quick` và `mode_reason`
     - tạo quick intake brief gồm goal, scope, acceptance bullets, risk note, verification path
     - advance sang `quick_plan`
     - ghi mini-plan/checklist ngắn trong quick plan stage, kể cả khi task đủ nhỏ để đi qua stage này rất nhanh
     - advance sang `quick_build` khi quick plan đã đủ để implementation bắt đầu
     - có thể tạo `docs/tasks/YYYY-MM-DD-<slug>.md` nếu traceability hữu ích
     - route sang `FullstackAgent`
6. Trong quick loop:
    - `bug` quay lại `quick_build`
    - `design_flaw` hoặc `requirement_gap` phải escalate sang `Full Delivery`
    - nếu phát hiện scope expansion hoặc verification gap làm task vượt quick boundary thì cũng phải escalate sang `Full Delivery`
7. Khi QA Lite pass, đóng task qua `quick_done`.

Quick mode không được dùng PM, BA, Architect, hoặc Tech Lead.
