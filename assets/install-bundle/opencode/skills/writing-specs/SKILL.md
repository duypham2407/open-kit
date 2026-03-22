---
name: writing-specs
description: "Converts requirements into structured spec documents with concrete acceptance criteria."
---

# Skill: Writing Specs (Viết Specification)

## Bối cảnh

Skill này được BA Agent sử dụng để chuyển hóa từ Product Brief (high-level) thành một tài liệu Spec (low-level) chi tiết, sẵn sàng cho Architect và Dev team.

## Quy trình Thực thi

### 1. Verification (Kiểm tra Đầu vào)
- Đảm bảo bạn đã có Product Brief.
- Nếu Product Brief còn mơ hồ (ví dụ: "làm cho nó chạy nhanh hơn"), phải quay lại hỏi PM Agent/User để có định lượng rõ ràng.

### 2. User Stories Breakdown
Chia nhỏ tính năng thành các luồng người dùng (User Stories).
**Format Bắt buộc:** `Là [User Type], tôi muốn [Action], để [Benefit/Value].`

### 3. BDD Acceptance Criteria
Phần khó nhất và quan trọng nhất. Mỗi User Story phải có Acceptance Criteria dạng Given-When-Then.

**Ví dụ sai (mơ hồ):**
> Nút submit nên bị disable khi data sai.

**Ví dụ đúng (Given-When-Then):**
> **Given** người dùng đang ở form "Tạo mới"
> **And** trường "Email" đang bỏ trống hoặc sai định dạng
> **When** họ cố gắng bấm nút "Submit"
> **Then** nút "Submit" phải ở trạng thái disabled
> **And** một thông báo lỗi rỗng/sai định dạng sẽ hiện dưới trường "Email"

### 4. Edge Cases (Các trường hợp cực đoan)
Phải có phần dành riêng để suy nghĩ về những thứ sẽ hỏng hóc:
- Điều gì xảy ra nếu mạng rớt giữa chừng?
- Điều gì xảy ra nếu user click đúp vào nút (double click)?
- Thêm input quá dài/quá ngắn/kí tự đặc biệt?
- Race conditions?

### 5. Document Output
Tạo file markdown tại `docs/specs/YYYY-MM-DD-<feature-name>.md`.

## Anti-Patterns (Cần Tránh)
- **Tech Leaking**: Đưa quyết định kỹ thuật vào spec (ví dụ: "Dùng React useState để lưu form"). Spec chỉ nói về Hành Vi/Yêu Cầu, không nói về Code.
- **Unmeasurable Goals**: "Giao diện đẹp", "Xử lý nhanh". Cần đổi thành "Responsive trên di động", "Thời gian phản hồi < 200ms".
