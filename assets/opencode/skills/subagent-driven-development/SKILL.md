---
name: subagent-driven-development
description: "Execution engine. Dispatches fresh subagents for each task to avoid context pollution and ensures 2-stage review."
---

# Skill: Subagent-Driven Development

## Bối cảnh

Được Fullstack Agent sử dụng để thực thi một Implementation Plan.

Khi thực hiện một chuỗi các công việc phức tạp, Agent gốc có thể bị "ngợp" (hallucination) do context quá dài. Subagent-Driven Development giải quyết bài toán này bằng cách: Thay vì một LLM session lớn ôm đồm tất cả, ta cắt task ra và phái (dispatch) một "bộ não" mới tinh (fresh subagent) xuống xử lý TỪNG task một.

## Quy trình Thực thi

### 1. Chuẩn bị (Task Queueing)
Đọc file `docs/plans/YYYY-MM-DD-<feature>.md`.
Có được một danh sách (queue) các tasks.

### 2. Batch Execution (Lặp lại cho từng Task)

Lấy Task N từ Queue:

#### Bước 2a: Chuẩn bị Payload cho Subagent
Tạo một prompt (chỉ định nghĩa, chưa chạy) với đủ context cho Subagent (đây thường là Fullstack Agent "cày cuốc"):
- File cần tập trung (`target file`)
- Code cần viết (chi tiết nhỏ từ Plan)
- Test cần pass
- Explicit Instruction: "Tuân theo TDD, tuân theo coding standards"

#### Bước 2b: Dispatch & Execution
Gọi công cụ/script để chạy subagent này độc lập. (Có thể là lệnh shell, script `run_agent.sh` hoặc tương tự mô phỏng việc ủy quyền).

Subagent (nhân viên code) phải báo một trong 4 trạng thái chuẩn:

- `DONE`: hoàn thành task, sẵn sàng qua review
- `DONE_WITH_CONCERNS`: hoàn thành nhưng có lo ngại cần controller đọc trước review
- `NEEDS_CONTEXT`: thiếu context, không được đoán mò
- `BLOCKED`: không thể hoàn thành với scope/context hiện tại

#### Bước 2c: Dừng & Gọi Reviewer (Code Reviewer Subagent)
Tuyệt đối KHÔNG gạch bỏ (check) task hiện tại và đi tiếp.
Phải dispatch một `code-reviewer` subagent độc lập (fresh context) để đánh giá code vừa xuất của nhân viên.

Quy trình Review 2-Stage (Đọc: `skills/code-review/SKILL.md`):
- **Stage 1**: Kiểm tra Spec Compliance.
- **Stage 2**: Kiểm tra Code Quality.

Không được đảo thứ tự hai stage này.

*Nếu fail*: Quăng lại task cho bước 2a kèm feedback để sửa.
*Nếu pass*: Ghi task thành trạng thái DONE, commit.

### 3. Vòng Lặp & Tối Ưu
Quay lại Bước 2 cho Task N+1.

## Anti-Patterns (Cần Xóa Bỏ)
- "Tôi ôm luôn 5 tasks trong Plan làm một lần cho xong". → **Sai nghiêm trọng**. LLM sẽ quên instructions giữa chừng và rác context.
- Bỏ qua code review subagent vì "tin tưởng khả năng của mình". → Subagent (nhân viên code) có thể làm bừa. Bắt buộc có bên kiểm tra độc lập thứ 3 (Reviewer subagent) không thiên vị.
- Cho implementer đọc lại toàn bộ plan và tự chọn scope khi controller đã biết task cụ thể. → Sai. Controller phải đưa full task text/context liên quan, không ném cả thế giới vào subagent.
- Nhảy sang task kế tiếp khi spec review hoặc quality review vẫn còn issue open. → Sai. Một task chỉ DONE khi đã qua cả 2 gate.

## Xử lý theo trạng thái của Implementer

### `DONE`
- qua spec review ngay

### `DONE_WITH_CONCERNS`
- đọc concern trước
- nếu concern liên quan correctness/scope, giải quyết trước khi review
- nếu chỉ là note maintainability, vẫn qua review nhưng ghi nhớ cho task sau

### `NEEDS_CONTEXT`
- cung cấp context còn thiếu
- re-dispatch cùng task, không để implementer tự bịa assumptions

### `BLOCKED`
- đánh giá blocker là do thiếu context, do task quá lớn, hay do plan sai
- nếu cần, tách task nhỏ hơn hoặc escalate về người/agent điều phối
