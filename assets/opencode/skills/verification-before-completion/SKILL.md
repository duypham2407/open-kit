---
name: verification-before-completion
description: "Use before claiming work is complete, fixed, or passing. Requires fresh verification evidence before any success claim."
---

# Skill: Verification Before Completion

## Bối cảnh

Skill này được dùng ngay trước khi Agent:

- báo đã xong việc
- nói test pass / fix xong / workflow complete
- tạo commit, PR, hoặc merge
- chuyển task sang bước tiếp theo như thể đã hoàn tất

OpenKit ưu tiên **evidence trước assertion**. Không có bằng chứng verification mới nhất thì không được nói như thể công việc đã ổn.

## Iron Law

```
KHÔNG CLAIM HOÀN THÀNH NẾU CHƯA CÓ VERIFICATION EVIDENCE MỚI
```

Nếu chưa chạy lệnh chứng minh claim trong phiên làm việc hiện tại, Agent phải nói trạng thái thực tế là "chưa verify" thay vì suy đoán.

## Gate Function

Trước khi phát biểu bất kỳ câu nào hàm ý thành công:

1. XÁC ĐỊNH lệnh nào chứng minh claim đó
2. CHẠY full command tương ứng
3. ĐỌC output thật, không suy diễn
4. KIỂM TRA exit code, số lỗi, số test pass/fail
5. CHỈ KHI đó mới được phát biểu trạng thái thành công

Nếu command fail hoặc verification path chưa tồn tại, phải báo đúng thực tế đó.

## What Counts As Valid Evidence

### Tests

Ví dụ hợp lệ:

- `node --test ".opencode/tests/*.test.js"` với output pass thật

Không hợp lệ:

- “lần trước test pass rồi”
- “nhìn code có vẻ đúng”
- “chỉ một phần suite pass nên chắc phần còn lại cũng ổn”

### Runtime behavior

Ví dụ hợp lệ:

- chạy `node .opencode/workflow-state.js status`
- chạy `node .opencode/workflow-state.js doctor`
- chạy manual smoke test có mô tả rõ input/output đã quan sát

Không hợp lệ:

- “hook này chắc in đúng vì test unit pass” nếu claim đang nói về integrated runtime behavior mà chưa kiểm chứng phù hợp

### Requirements / Plan completion

Ví dụ hợp lệ:

- đối chiếu từng mục trong brief/spec/plan với diff và output verification

Không hợp lệ:

- “test pass nên chắc requirements đều xong”

## Current OpenKit Reality

OpenKit hiện không có build/lint/test command cho application code nói chung.

Vì vậy skill này phải trung thực theo repo reality:

- nếu repo có workflow-runtime tests, dùng chúng
- nếu chỉ có runtime CLI/manual checks, nói rõ đó là verification path thực tế
- nếu không có validation path phù hợp, báo rõ khoảng trống đó thay vì bịa command

## Common Failure Patterns

| Claim | Cần Evidence | Không Đủ |
|------|--------------|---------|
| “Tests pass” | output test command mới nhất | run cũ, memory, assumption |
| “Bug fixed” | symptom repro + verification pass | chỉ sửa code |
| “Ready to commit” | verify relevant scope pass | chỉ nhìn diff |
| “Requirements met” | checklist against spec/plan + verification | tests pass một phần |
| “Agent task done” | inspect changes + verify behavior | tin subagent report |

## Red Flags

Nếu bắt gặp các câu nghĩ sau, phải dừng lại:

- “should work now”
- “looks correct”
- “probably fine”
- “just this once”
- “test cũ pass rồi”
- “tôi khá chắc”

Đó là dấu hiệu Agent đang chuyển từ kỹ sư sang người đoán mò.

## Required Output Style When Verification Fails Or Is Missing

Nếu verification fail:

- nêu command đã chạy
- nêu trạng thái fail thật
- nêu output/summary quan trọng
- không dùng wording mập mờ như “almost done”

Nếu verification path không tồn tại:

- nói rõ repo chưa có command phù hợp
- nêu manual check nào đã làm
- nêu limitation còn lại

## Before Commit / PR / Merge

Ngay trước commit, PR, hoặc merge, Agent phải kiểm tra:

- claim nào đang sắp được đưa ra
- command nào chứng minh claim đó
- output mới nhất có thật hay chưa

Không được dùng commit/merge như cách “đóng task cho xong” khi verification còn thiếu.

## Bottom Line

**Evidence before claims. Always.**

OpenKit có thể còn thiếu tooling ở nhiều phần, nhưng không bao giờ được thiếu sự trung thực về trạng thái verification.
