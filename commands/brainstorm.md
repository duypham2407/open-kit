---
description: "Triggers the brainstorming skill to explore product/architecture design before implementation."
---

# Lệnh: `/brainstorm`

Khi User gõ lệnh `/brainstorm`, hoặc khi PM Agent/Architect Agent bắt đầu một tính năng mới:

1. Dừng mọi luồng công việc hiện tại (nếu đang dở dang).
2. Load skill `skills/brainstorming/SKILL.md`.
3. Bắt đầu Phase 1 của skill: Hỏi User 1 câu hỏi quan trọng nhất về bối cảnh.
