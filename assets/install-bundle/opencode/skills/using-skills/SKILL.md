---
name: using-skills
description: "Meta-skill: Teaches agents how to discover, evaluate, and invoke skills. Loaded at session start."
---

# Hướng dẫn Sử dụng Skills — Meta-Skill

## Ý nghĩa của Skills

Trong AI Software Factory, "Skills" là các quy trình chuẩn (Standard Operating Procedures - SOP) định nghĩa cách hệ thống hoạt động. Khi một tình huống có skill tương ứng, bạn **bắt buộc** phải làm theo skill đó, không được tự ý hành động theo bản năng LLM.

## Phân cấp Chỉ thị (Instruction Priority)

Khi có xung đột, áp dụng thứ bậc sau (1 là cao nhất):

1. **User Prompt Hiện tại**: Chỉ thị trực tiếp của người dùng trong tin nhắn hiện tại
2. **Skill Instructions**: Hướng dẫn bên trong file `SKILL.md` đang áp dụng
3. **Agent Role Instructions**: Vai trò và ràng buộc của Agent (ví dụ: `QA Agent KHÔNG sửa code`)
4. **General System Prompt**: Bản năng LLM cơ bản

## Làm thế nào để dùng Skill?

Khi bạn nhận diện một tình huống (ví dụ: cần tạo plan, cần fix bug, cần test code), hãy làm theo các bước:

1. **Nhận diện**: "Cần tạo implementation plan"
2. **Khám phá**: "Để tôi dùng tool để đọc file `skills/writing-plans/SKILL.md`"
3. **Đọc**: Dùng tool `view_file` (hoặc tương đương) để đọc TOÀN BỘ file `SKILL.md`
4. **Thực thi**: Áp dụng từng bước trong file đã đọc

## Cảnh báo: Chống Hợp lý hóa (Rationalization Prevention)

Bản năng LLM thường cố gắng "đi đường tắt" (short-circuit). Hãy đề phòng các suy nghĩ sai lầm sau:

| Suy nghĩ Sai lầm (Rationalization) | Hành động Đúng (Correction) |
|-----------------------------------|----------------------------|
| "File này sửa dễ ợt, tôi sửa luôn khỏi cần báo Master Orchestrator." | Dừng lại. Tuân thủ role. Báo cáo Master Orchestrator trước. |
| "Tôi biết cách viết plan rồi, không cần đọc `skills/writing-plans/SKILL.md` đâu." | Không. Lần nào tạo plan cũng phải đọc lại skill để đảm bảo checklist mới nhất. |
| "Lỗi này rõ ràng quá, khỏi cần root cause analysis, fix luôn." | Không. Dùng `systematic-debugging` skill. Bắt buộc tìm root cause trước. |
| "User bảo làm gấp, bỏ qua khâu viết test (TDD) đi." | TDD là Iron Law. Không có ngoại lệ trừ khi User **rất explicitly** nói "Skip TDD". |
