---
name: code-review
description: "Pre-review checklist and quality gates. Uses a two-stage approach: spec compliance then code quality."
---

# Skill: Code Review

## Bối cảnh

Được dùng bởi Code Reviewer Subagent, hoặc QA Agent, hoặc Tech Lead Agent.
Mục tiêu là chốt chặn cuối cùng ngăn code thối (bad code) hoặc code làm sai mục đích (non-compliant) đi vào master.

## Yêu cầu Đầu Vào

- Cần Review cái gì? (File/Commit/PR)
- Tài liệu đối chiếu: Spec (Requirements), Architecture (Design), Code Standards.

## Two-Stage Review Process

Tuyệt đối tuân theo thứ tự 2 giai đoạn này. Không bàn về Formatting/Clean Code nếu tính năng làm Tào Lao không đúng Spec.

### Stage 1: Spec Compliance (Tính Tuân Thủ Yêu Cầu)
**Chỉ hỏi đúng 1 câu: "Code này CÓ ĐÁP ỨNG chính xác Acceptance Criteria trong Spec và KHÔNG chế thêm tính năng thừa hông?"**

- Soi từng Acceptance Criterium (Given - When - Then).
- Code có xử lý Edge Cases mà BA đã vạch ra không?
- **Overscope Audit (Over-engineering)**: Khắc phục tính "bệnh nghề nghiệp" của Dev. Code có build sẵn những tính năng "tiện tay" chưa có yêu cầu không? (YAGNI).

=> **Ghi chú Pass / Fail Stage 1. Nếu Fail, kết thúc buổi review và quăng lại mặt thằng Dev ngay, không cần làm Stage 2.**

### Stage 2: Code Quality (Độ Sạch Của Code)
Chỉ đến bước này khi Stage 1 đã PASS. Mở tài liệu `context/core/code-quality.md` ra quy chiếu.

Soi theo mức độ (Severity):
1. **Critical/Security (Phải sửa ngay)**: SQL injection, lộ biến môi trường, crash nổ memory.
2. **Architecture (Tham vấn)**: Lệnh sai ranh giới (Controller tính luôn query DB). => Gọi Techlead xử lý.
3. **Important Quality (Nên sửa)**: Đặt tên biến vô nghĩa (`let a = 1`), hàm dài > 50 dòng, test coverage tụt nát.
4. **Minor (Nhẹ)**: Cãi nhau về ngoặc nhọn, spaces. (Tuân theo linter có sẵn).

## Checklist Của Một Báo Cáo Review Tốt
- [ ] Phải nêu rõ Stage 1 (Pass/Fail) và lý do.
- [ ] Phải trích xuất CHÍNH XÁC File Path và Dòng Lỗi (Line Number).
- [ ] Phải ghi rõ Severity (Critical/Important/Minor).
- [ ] KHÔNG CHỈ CHỬI mà hãy Góp Ý: Đưa ra Snippet Code ví dụ cách sửa.

## Cấm Kị (Anti-Patterns)
- Review hời hợt: "LGTM (Looks Good To Me)!" mà hổng đọc file.
- Sửa giùm Dev: "Để tui vô tui sửa cho lẹ rồi approve". (Reviewer KHÔNG ĐƯỢC chạm vào mảng code. Bắt Dev tự chịu trách nhiệm).
