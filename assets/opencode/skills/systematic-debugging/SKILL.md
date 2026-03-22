---
name: systematic-debugging
description: "4-phase root cause process to debug scientifically instead of blindly guessing."
---

# Skill: Systematic Debugging

## Bối cảnh

Skill này được dùng bởi bất kỳ Developer Agent nào (Fullstack, QA, Tech Lead) khi gặp bug, build error, hoặc test fail ngoài ý muốn. LLM có thói quen thấu cáy (guess) và nhào vào sửa chữa bừa bãi. Skill này bắt buộc phải sửa lỗi theo con đường của kỹ sư.

## Quy tắc Tuyệt đối (The Golden Rule)
**KHÔNG thay đổi / fix bất cứ dòng code nào khi chưa làm sáng tỏ ROOT CAUSE.**

## Guardrails bổ sung

- Chỉ test 1 hypothesis chính tại một thời điểm
- Không được xếp chồng nhiều fix trong cùng một thử nghiệm
- Nếu đã thử 3 hướng fix mà bug gốc vẫn quay lại, phải nghi ngờ pattern hoặc architecture thay vì fix tiếp hướng thứ 4

## 4 Phase Fix Bug

### Phase 1: Context & Reproduction (Khám xét & Tái Hiện)
Đừng đọc code ngay. Đi tìm bằng chứng (Evidence).
1. Lấy nguyên văn Error Stack Trace.
2. Xác định file và dòng sập.
3. Thử tái hiện lỗi: Môi trường (dev/prod), input nào làm nó sập?
4. Nếu hệ thống có nhiều boundary (CLI -> controller -> rules, hook -> state file, command -> artifact), thu evidence theo từng boundary thay vì nhảy vào sửa lớp cuối.

### Phase 2: Hypothesis Generation (Phát Rút & Cắt Nghĩa)
Dựa vào Evidence, đề xuất Giả Thuyết (Hypothesis) tại sao nó lỗi. KHÔNG ĐƯỢC đề cập đến cách sửa ở đây.

* Ví dụ Giả định sai: "Tại vì biến X chưa tồn tại dẵn tới `.length` fail."
* Ví dụ Tốt: "Hàm A kỳ vọng Array nhưng API backend trả về `{ data: [] }` (Object), gọi `.map()` sẽ sập."

Liệt kê ra 2-3 Hypothesis. Sau đó loại trừ dần bằng cách grep / đọc code. Chốt được 1 Hypothesis KHẢ DI nhất (Most Likely Root Cause).

⚠️ Chỉ chọn 1 hypothesis chính để test. Không sửa ba giả thuyết cùng lúc rồi mong test tự giải thích điều gì đã đúng.

### Phase 3: Propose Fix (Lập Kế Hoạch Sửa Chữa)
Đề xuất Minimal Fix (Cách sửa tốn ít dòng code nhất, động vào ít file nhất).

⚠️ **RED ALERT: Sửa nhiều nơi = Giải Phẫu Kiến Trúc.** Nếu lúc đang lập kế hoạch, bạn thấy cần sửa 1 lúc 3-4 file logic khác nhau (scattered changes) -> **DỪNG LẠI CHUÔNG BÁO ĐỘNG**. Bạn đang không sửa bug, bạn đang vá víu (hack) hệ thống hoặc kiến trúc hệ thống gốc bị sai. Quay lại hỏi Master Orchestrator và gọi Architect rà soát hệ thống.

### Phase 4: Implementation (Xử Lý)
Tuân theo TDD (Đọc `skills/test-driven-development/SKILL.md`):
- Viết Test (nhằm bắt cái bug đó).
- Chạy: Thấy test đỏ ửng (vì bug còn đó).
- Áp dụng Minimal Fix từ Phase 3.
- Chạy: Thấy test pass xanh.
- Commit.

Nếu fix không work:

1. DỪNG
2. quay lại Phase 1 với evidence mới
3. nếu đã có 3 lần thử sửa mà lỗi lõi vẫn còn, báo `MasterOrchestrator` rằng đây có thể là vấn đề architecture/pattern chứ không còn là bug cục bộ nữa

## Rationalization Checklist (Kiểm Tra Nguỵ Biện)
- [ ] Tôi có đang ném log `console.log` mù quáng khắp nơi thay vì tập trung Root Cause? (Nếu có -> STOP).
- [ ] Tôi có đang định bọc toàn bộ code bằng `try...catch` ngầm nuốt lỗi? (Nếu có -> STOP).
- [ ] Tôi đã thử "đổi cách làm" lần 3 nhưng lỗi cũ vẫn y nguyên? (Hệ thống có vấn đề 캐ch (cache) hoặc môi trường sai. Kiểm tra lại môi trường thay vì sửa code).
- [ ] Tôi có đang sửa nhiều file rải rác chỉ để “làm test xanh lại” mà chưa chứng minh root cause? (Nếu có -> STOP).
