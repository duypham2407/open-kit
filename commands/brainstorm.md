---
description: "Triggers the brainstorming skill to explore product/architecture design before implementation."
---

# Lệnh: `/brainstorm`

Khi User gõ lệnh `/brainstorm`, hoặc khi PM Agent/Architect Agent bắt đầu một tính năng mới:

1. Dừng mọi luồng công việc hiện tại (nếu đang dở dang).
2. Đọc `AGENTS.md`, `context/navigation.md`, `context/core/workflow.md`, và `.opencode/workflow-state.json` nếu workflow đang resumable.
3. Có thể dùng `node .opencode/workflow-state.js show` hoặc `node .opencode/workflow-state.js validate` để kiểm tra state trước khi tiếp tục.
4. Load skill `skills/brainstorming/SKILL.md`.
5. Nếu cần, tạo hoặc cập nhật artifact thiết kế phù hợp trong `docs/briefs/` hoặc `docs/architecture/`.
6. Bắt đầu Phase 1 của skill: Hỏi User 1 câu hỏi quan trọng nhất về bối cảnh.
