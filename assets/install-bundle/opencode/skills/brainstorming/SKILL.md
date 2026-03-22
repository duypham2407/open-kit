---
name: brainstorming
description: "Socratic design refinement process. Used before writing any specs or code to clarify intent and explore options."
---

# Skill: Brainstorming (Socratic Refinement)

## Bối cảnh

Khi User đưa ra một ý tưởng, yêu cầu mới, hoặc khi PM Agent/Architect Agent bắt đầu thiết kế, **bắt buộc** phải dùng skill này trước khi chốt giải pháp.

Tuyệt đối KHÔNG nhảy vào viết spec hoặc code ngay lập tức. Cần phải đi qua quy trình "đặt câu hỏi - khám phá - chốt hạ".

## Quy trình Thực thi

### Phase 1: Context Exploration (Khám phá Bối cảnh)
1. Đọc yêu cầu ban đầu của User.
2. Xác định các file hiện tại có liên quan (nếu có).
3. Đặt câu hỏi làm rõ. **Quy tắc Vàng: Chỉ hỏi MỘT câu hỏi tại một thời điểm.** 
   - Đừng đưa ra 1 list 5 câu hỏi khiến User ngợp.
   - Hỏi câu quan trọng nhất trước. Chờ User trả lời rồi mới hỏi tiếp.
   - Ví dụ: "Ai là người dùng chính của tính năng này: Admin hay Client?"

### Phase 2: Option Generation (Đề xuất Giải pháp)
Khi đã đủ thông tin (không còn câu hỏi lớn), KHÔNG tự chốt một giải pháp duy nhất. Phải đề xuất 2-3 hướng tiếp cận:

**Mẫu Đề xuất:**
```markdown
Dựa trên những gì bạn chia sẻ, tôi thấy có X hướng tiếp cận chính:

**Option 1: [Tên ngắn gọn]**
*   **Cách hoạt động**: [Mô tả ngắn]
*   **Ưu điểm**: [...]
*   **Nhược điểm/Trade-off**: [...]

**Option 2: [Tên ngắn gọn]**
*   **Cách hoạt động**: [Mô tả ngắn]
*   **Ưu điểm**: [...]
*   **Nhược điểm/Trade-off**: [...]

Bạn thích hướng đi nào hơn, hay muốn kết hợp ý tưởng từ cả hai?
```

### Phase 3: Incremental Design (Thiết kế Từng phần)
Sau khi User chọn một Option, hãy thiết kế chi tiết **từng phần một**.
- Không ném một cục thiết kế khổng lồ vào mặt User.
- Ví dụ thiết kế DB trước. Xin ý kiến. Sau đó thiết kế API. Xin ý kiến.
- Dùng công cụ trực quan nếu cần (Mermaid diagrams, ASCII art).

### Phase 4: Handoff
Kết thúc brainstorming bằng cách chuyển sang tạo Product Brief hoặc Architecture Document (tùy vào Agent nào đang chạy), sau đó chuyển giao cho Agent tiếp theo trong pipeline.
