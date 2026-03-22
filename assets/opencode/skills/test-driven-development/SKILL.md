---
name: test-driven-development
description: "RED-GREEN-REFACTOR cycle. Enforces strictly writing failing tests before production code."
---

# Skill: Test-Driven Development (TDD)

## Bối cảnh

Đây là "Luật Thép" (Iron Law) cho Fullstack Agent. KHÔNG ĐƯỢC PHÉP viết bất kỳ dòng production code nào nếu chưa có một failing test (test đang thất bại) chứng minh cần phải viết dòng code đó.

## Quy trình Thực thi (RED-GREEN-REFACTOR)

### Bước 1: RED (Viết Test Thất Bại)
1. Chọn một task nhỏ từ Implementation Plan.
2. Viết **một** test case cho behavior kiện đó.
3. Chạy test runner cụ thể cho ngôn ngữ/framework đang dùng, nhưng chỉ khi repository đã định nghĩa command đó. Nếu chưa có command chuẩn, dừng lại và báo missing validation path thay vì tự đoán.
4. **Validation Bắt Buộc**: Test PHẢI fail. Không chỉ fail, mà phải fail đúng lý do (ví dụ: `ReferenceError: function is not defined`, hoặc `Expected true but got false`).
   - Nếu test pass ngay lập tức → Test sai, xóa đi viết lại.

### Bước 2: GREEN (Viết Code Tối Thiểu)
1. Chỉ viết **đủ code để làm test vừa rồi pass**.
2. **Luật Lười Biếng (Lazy Code)**: Trả về hardcoded value nếu nó làm test pass. Không suy nghĩ về tương lai (YAGNI - You Aren't Gonna Need It).
3. Chạy lại test suite.
4. **Validation Bắt Buộc**: Test phải PASS. Nếu không, tiếp tục sửa đến khi PASS. Đừng viết thêm tính năng.

### Bước 3: REFACTOR (Tái Cấu Trúc)
Khi (và chỉ khi) tất cả test đang xanh (GREEN):
1. Nhìn lại code: Có bị lặp code (DRY)? Tên biến đọc hiểu được không? Design có ổn không?
2. Refactor code.
3. Chạy lại test suite. Nếu test fail → revert refactor ngay lập tức hoặc sửa nhanh.

## Anti-Patterns (Cần Loại Bỏ) & Trừng Phạt Hành Vi

| Lời nguỵ biện (Rationalization) | Hình phạt / Hành động Bắt buộc |
|--------------------------------|--------------------------------|
| "Cái này đơn giản quá, viết test mất thời gian, tôi code luôn." | **STOP.** Xóa code vừa viết, viết test trước. Dù là 1 hàm `add(a,b)`. |
| "Tôi viết 5 tests 1 lúc rồi code 1 lần cho lẹ." | **Dừng lại.** Một RED, Một GREEN, Một REFACTOR. Không gom cục. |
| "Test UI khó quá, thôi bỏ qua TDD phần này." | Chỉ được bỏ qua khi User Explicitly cho phép. Hãy cẩn thận tách logic khỏi UI để test logic. |
| "Ủa fail rồi mà tôi biết lỗi ở đâu, tôi fix file A. B. C. cùng lúc." | Root cause chỉ nằm ở 1 chỗ. Tìm và fix đúng 1 nơi. Đọc skill `systematic-debugging`. |

## Checklist của 1 Cycle Hoàn Thiện
- [ ] Test được viết & chạy (FAIL)
- [ ] Đọc error message → hiểu tại sao fail
- [ ] Viết minimal production code
- [ ] Chạy lại test (PASS)
- [ ] Dọn dẹp code xung quanh (REFACTOR)
- [ ] Commit (Mỗi GREEN/REFACTOR là 1 cơ hội commit nhỏ)
