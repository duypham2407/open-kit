---
description: "Default entry command. Lets MasterOrchestrator classify work into Quick Task or Full Delivery."
---

# Lệnh: `/task`

Khi User gõ `/task [mô_tả]`, `MasterOrchestrator` phải:

1. Đọc `AGENTS.md`, `context/navigation.md`, `context/core/workflow.md`, và `.opencode/workflow-state.json` nếu đang resumable.
2. Tóm tắt mục tiêu, phạm vi, và rủi ro của yêu cầu.
3. Phân loại lane:
   - `Quick Task` nếu task nhỏ, rõ, cục bộ, không cần quyết định thiết kế
   - `Full Delivery` nếu task có ambiguity, nhiều subsystem, hoặc cần artifact chain đầy đủ
4. Ghi `mode` và `mode_reason` vào workflow state.
5. Nếu là quick mode:
   - khởi tạo `quick_intake`
   - tạo quick intake brief gồm goal, scope, acceptance bullets, risk note, verification path
   - route sang `FullstackAgent`
6. Nếu là full mode:
   - khởi tạo `full_intake`
   - route sang `PMAgent` hoặc `/brainstorm` tùy bối cảnh

Mục tiêu của `/task` là giảm friction cho daily use nhưng vẫn giữ lane selection rõ ràng.
