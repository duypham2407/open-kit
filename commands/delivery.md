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

Lệnh này là đường vào rõ ràng cho feature work và các task có risk cao.
