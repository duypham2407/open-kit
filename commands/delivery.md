---
description: "Starts the Full Delivery lane for feature work and higher-risk changes."
---

# Lệnh: `/delivery`

Khi User gõ `/delivery [mô_tả]`, `MasterOrchestrator` phải:

1. Đọc `AGENTS.md`, `context/navigation.md`, `context/core/workflow.md`, và `.opencode/workflow-state.json` nếu đang resumable.
2. Khởi tạo `full_intake`.
3. Ghi `mode = full` và `mode_reason` vào workflow state.
4. Bắt đầu full-delivery lane:
   - `PMAgent` tạo brief
   - `BAAgent` tạo spec
   - `ArchitectAgent` tạo architecture
   - `TechLeadAgent` tạo implementation plan
   - `FullstackAgent` implement
   - `QAAgent` validate
5. Áp dụng full approval chain trước khi advance qua các stage chính.

`/delivery` là đường vào rõ ràng cho heavy lane. Dùng lệnh này khi:

- task không còn bounded trong quick lane
- cần product/spec/design/architecture treatment
- có contract-sensitive change như API, schema, auth, billing, permission, hoặc security
- phạm vi chạm nhiều subsystem lỏng liên quan
- quick work đã bị escalate vì `requirement_gap` hoặc `design_flaw`, hoặc vì phát sinh scope expansion hay verification gap làm vượt quick boundary

Lệnh này giữ nguyên hard split với quick lane và khớp với `/task`: khi đã vào full mode, entry point luôn bắt đầu bằng `PMAgent`, rồi đi theo full-delivery chain chuẩn.
