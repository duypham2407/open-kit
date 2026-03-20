---
name: writing-plans
description: "Converts specs and architecture into bite-sized implementation plans. Strictly enforces TDD flow."
---

# Skill: Writing Implementation Plans

## Bối cảnh

Skill này được Tech Lead Agent sử dụng. Nó biến các tài liệu thiết kế (Spec, Architecture) thành các bước Code cụ thể (Actionable steps) cho Fullstack Agent thực hiện.

Mỗi Plan là một bản thiết kế chi tiết (blueprint) mà "nhắm mắt" Fullstack Agent cũng làm được.

## Quy tắc Cốt lõi của Một Plan Tốt

1. **Bite-sized Tasks**: Mỗi task chỉ mất khoảng 2-5 phút thực hiện. Nếu 1 task có vẻ tốn hơn 10 phút, HÃY CHIA NHỎ NÓ RA.
2. **Atomic Steps**: Mỗi bước là một tính năng hoàn chỉnh, có thể test được ngay. Không để lại code "nửa vời".
3. **Exact File Paths**: Khai báo chính xác đường dẫn tuyệt đối (hoặc tương đối với root) của file cần tạo/sửa.
4. **TDD Flow**: MỖI task logic đều phải bắt đầu bằng việc viết Test.

## Quy trình Thực thi

### Bước 1: Context Gathering
Đảm bảo bạn đã đọc:
- `docs/specs/YYYY-MM-DD-<feature>.md`
- `docs/architecture/YYYY-MM-DD-<feature>.md`
- `context/core/code-quality.md`

### Bước 2: Viết Plan Document

Tạo file `docs/plans/YYYY-MM-DD-<feature>.md` theo cấu trúc sau:

```markdown
# Implementation Plan: [Tên Tính năng]

## Dependencies
- Cần cài thêm package nào không? (npm install X, pip install Y)
- Cần biến môi trường nào không?

## Các Bước Triển Khai

Cứ mỗi task, tuân theo cấu trúc TDD Flow này:

### [ ] Task 1: [Tên thao tác cụ thể, vd: Init Database Schema]
- **File**: `path/to/file.ext`
- **Mục tiêu**: [Mô tả ngắn gọn]
- **Test Command**: `[lệnh chạy test cho file này]`
- **Chi tiết**:
  - Viết test kiểm tra xem bảng X đã tồn tại chưa (FAIL)
  - Viết schema creation script (PASS)

### [ ] Task 2: [Task tiếp theo]
...
```

### Bước 3: Rà soát & Tinh chỉnh
- Các task đã đủ nhỏ chưa?
- Có task nào yêu cầu sửa > 3 file cùng lúc không? → Nếu có, chia nhỏ ra.
- Có task logic nào KHÔNG yêu cầu viết test trước không? → Bắt buộc thêm test.
- Đã cover hết acceptance criteria trong Spec chưa?

## Anti-Patterns
- "Task 1: Xây Frontend, Task 2: Xây Backend". (Quá lớn, sai bét).
- Không có hướng dẫn test/dòng lệnh để test.
- Plan mà không nói sửa file nào.
