---
description: "Default entry command. Lets MasterOrchestrator classify work into Quick Task or Full Delivery."
---

# Lệnh: `/task`

Khi User gõ `/task [mô_tả]`, `MasterOrchestrator` phải:

1. Đọc `AGENTS.md`, `context/navigation.md`, `context/core/workflow.md`, và `.opencode/workflow-state.json` nếu đang resumable.
2. Tóm tắt mục tiêu, phạm vi, và rủi ro của yêu cầu.
3. Phân loại lane:
   - `Quick Task` nếu task là small-to-medium nhưng vẫn bounded, low-risk, và không cần quyết định thiết kế
   - `Full Delivery` nếu task có ambiguity, nhiều subsystem lỏng liên quan, hoặc cần artifact chain đầy đủ
4. Ghi `mode` và `mode_reason` vào workflow state.
5. Nếu là quick mode:
    - khởi tạo `quick_intake`
    - tạo quick intake brief gồm goal, scope, acceptance bullets, risk note, verification path
    - nếu task có vài bước nhưng vẫn bounded, cho phép mini-plan/checklist ngắn
    - chỉ tạo task card nhẹ khi traceability thực sự hữu ích
    - route sang `FullstackAgent`
6. Nếu là full mode:
    - khởi tạo `full_intake`
    - route sang `PMAgent` để bắt đầu full-delivery chain chuẩn

Hard triggers phải route sang `Full Delivery` ngay từ `/task`:

- design hoặc requirements chưa rõ
- cần quyết định architecture hoặc trade-off mới
- contract-sensitive change như API, schema, auth, billing, permission, hoặc security
- phạm vi chạm nhiều subsystem lỏng liên quan
- verification path không còn ngắn và cục bộ

`/task` là default classifier. Live contract hiện tại vẫn là `Quick Task` + `Full Delivery`; `Quick Task+` chỉ là future direction đã được phê duyệt cho quick lane, không phải command mới hay mode mới.

Mục tiêu của `/task` là giảm friction cho daily use nhưng vẫn giữ lane selection rõ ràng.
