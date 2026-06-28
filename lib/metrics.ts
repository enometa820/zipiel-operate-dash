// lib/metrics.ts — 온에어 1/3/7일차 raw 블롭("라벨: 숫자\n…") 파서. 순수·테스트 가능.
// 날조 0: 파싱 안 되는 라벨·ERROR·빈값은 필드 부재(null). 0/추정으로 메우지 않는다.
// 파이썬(etl_onair parse_metrics)이 이 LABEL_MAP·규칙을 동일 포팅한다(정본 = 이 파일).

export const LABEL_MAP: Record<string, keyof ParsedMetrics> = {
  재생: "views",
  조회: "views",
  조회수: "views",
  좋아요: "likes",
  댓글: "comments",
  북마크: "saves",
  저장: "saves",
  리포스트: "reposts",
  공유: "shares",
  인용: "quotes",
  팔로우: "follows",
  팔로워: "follows",
};

export interface ParsedMetrics {
  views?: number;
  likes?: number;
  comments?: number;
  saves?: number;
  reposts?: number;
  shares?: number;
  quotes?: number;
  follows?: number;
}

// "재생: 109,293\n좋아요: 3\n댓글: 50" → {views:109293, likes:3, comments:50}
// "좋아요: ERROR" 줄은 숫자 매칭 안 돼 자연 skip. 미인식 라벨도 skip.
export function parseMetrics(blob?: string | null): ParsedMetrics {
  const out: ParsedMetrics = {};
  if (!blob) return out;
  for (const m of blob.matchAll(/([^\n:]+):\s*([\d,]+)/g)) {
    const field = LABEL_MAP[m[1].trim()];
    if (!field) continue;
    const n = parseInt(m[2].replace(/,/g, ""), 10);
    if (!Number.isNaN(n)) out[field] = n;
  }
  return out;
}
