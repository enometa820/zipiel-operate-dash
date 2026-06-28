import { describe, it, expect } from "vitest";
import { parseMetrics } from "../metrics";

describe("parseMetrics", () => {
  it("정상 블롭(재생/좋아요/댓글)을 정수로", () => {
    expect(parseMetrics("좋아요: 3\n댓글: 50\n재생: 109293")).toEqual({ likes: 3, comments: 50, views: 109293 });
  });
  it("콤마 숫자 처리", () => {
    expect(parseMetrics("재생: 109,293")).toEqual({ views: 109293 });
  });
  it("ERROR·#REF 줄은 자연 skip(날조 0)", () => {
    expect(parseMetrics("재생: ERROR\n좋아요: 5")).toEqual({ likes: 5 });
    expect(parseMetrics("재생: #REF!")).toEqual({});
  });
  it("빈값·null은 빈 객체", () => {
    expect(parseMetrics("")).toEqual({});
    expect(parseMetrics(null)).toEqual({});
    expect(parseMetrics(undefined)).toEqual({});
  });
  it("미인식 라벨은 skip", () => {
    expect(parseMetrics("알수없음: 99\n좋아요: 1")).toEqual({ likes: 1 });
  });
  it("전체 라벨 매핑(북마크·리포스트·공유·인용·팔로우)", () => {
    expect(parseMetrics("북마크: 10\n리포스트: 20\n공유: 30\n인용: 40\n팔로우: 50")).toEqual({
      saves: 10, reposts: 20, shares: 30, quotes: 40, follows: 50,
    });
  });
  it("조회/저장 동의어", () => {
    expect(parseMetrics("조회: 100\n저장: 5")).toEqual({ views: 100, saves: 5 });
  });
});
