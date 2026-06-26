export const meta = {
  name: 'slack-needs-research',
  description: '시딩 오퍼레이션 슬랙 채널 전수 분석 — 대표/작업자 니즈·병목·대시보드 요구를 4렌즈 병렬 조사 후 종합 문서화',
  phases: [{ title: 'Analyze', detail: '4개 렌즈 병렬' }, { title: 'Synthesize', detail: '종합 문서 작성' }],
}

const CORPUS = 'C:/Users/sickkiya/AppData/Local/Temp/claude/C--Projects-zipiel-operate-dash/c7a11087-c91e-4d32-920a-48536971eed6/scratchpad/slack-corpus.txt'
const CTX = `맥락: (주)더프레임리스 브랜드 zipiel의 글로벌 인플루언서 시딩 협업 운영 슬랙 채널(C0APNDK4QKW)이다. 팀: effie(김정연·운영리드, 대표님 지시 전달·작업 분배), 작업자 Sol·Nhi·Anna·Jane(국가별 시딩 운영 — listing·outreach·협상·배송·콘텐츠), 대표(CEO), 이용진(AX·자동화 담당, 시딩 운영 대시보드 제작 중). 우리는 이미 시딩 협업 상태 대시보드를 만들었다(좌측 사이드바 + 상태그룹 시트 그리드 + detail 패널, 14k 협업, effie 시트 15상태 정본, 가로스크롤 0, 상태 한영병기). 코퍼스 = 채널 전체 히스토리(06-12~06-26) + 상위 20개 스레드 펼침. 내부 대화·PII(이메일·전화)는 요약만, raw 노출 금지.`

const SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          who: { type: 'string', description: '관련 인물/역할' },
          detail: { type: 'string', description: '구체 내용(한국어)' },
          evidence: { type: 'string', description: '근거(날짜·발화 요약, raw PII 제외)' },
          dashboard_implication: { type: 'string', description: '대시보드/자동화 시사점' },
        },
        required: ['topic', 'detail', 'dashboard_implication'],
      },
    },
    summary: { type: 'string' },
  },
  required: ['findings', 'summary'],
}

phase('Analyze')

const LENSES = [
  { key: 'ceo', prompt: `${CTX}\n\n너는 "대표(CEO)·운영리드 effie의 니즈·전략 방향" 렌즈로 코퍼스(${CORPUS})를 정독하라. effie가 대표님 지시로 전달하는 우선순위·KPI·목표(배송 개수·캠페인·국가별 집중제품·예산·ratecard·매출/전환), 의사결정이 필요한 지점, effie가 팀을 관리하며 반복해서 챙기는 것(취합·점검·보고)을 추출. 각 finding에 대시보드가 대표/리드의 의사결정을 어떻게 도울지(어떤 집계·뷰·알림) 시사점을 달아라.` },
  { key: 'operators', prompt: `${CTX}\n\n너는 "작업자(Sol·Nhi·Anna·Jane) 일일 업무·니즈·페인포인트" 렌즈로 코퍼스(${CORPUS})를 정독하라. 매일 반복하는 작업(listing 몇 건·outreach·DM·이메일 회신·협상·배송정보·콘텐츠 피드백·ratecard 업데이트·시트 업데이트), 수기·중복·도구 전환으로 인한 마찰, 'I start working now'/업무보고 패턴, 국가별 차이를 추출. 각 finding에 대시보드가 작업자의 어떤 반복/마찰을 줄일지 시사점을 달아라.` },
  { key: 'bottleneck', prompt: `${CTX}\n\n너는 "워크플로우 병목·비효율·데이터 문제" 렌즈로 코퍼스(${CORPUS})를 정독하라. 작업이 막히거나 느려지는 지점(배송 개수 부족·이메일 확보 어려움·상태 추적 분산·시트 수기 취합·국가별 시트 파편화·통화/요율 불일치·콘텐츠 산출 지연·중복 입력), 정보가 흩어져 생기는 손실, 반복 보고로 낭비되는 시간을 추출. 각 finding에 대시보드/자동화가 그 병목을 어떻게 푸는지 시사점을 달아라.` },
  { key: 'dashboard', prompt: `${CTX}\n\n너는 "시딩 운영 워크플로우 전체 + 대시보드 요구사항·갭" 렌즈로 코퍼스(${CORPUS})를 정독하라. 시딩 협업이 거치는 실제 단계(소싱→listing→outreach→협상→바우처/배송→콘텐츠→성과), 각 단계에서 시트로 하는 일, 대시보드가 반드시 보여줘야 할 것(우리가 만든 상태그룹 그리드·detail 패널·집계가 충족하는지 vs 빠진 것). 특히 우리 대시보드가 아직 못 다루는 요구(바우처 발행·배송 개수 추적·이메일 확보 현황·국가별 집중제품·ratecard·성과지표·업무보고 자동화)를 갭으로 명시. 각 finding에 충족/미충족과 다음 기능 제안을 달아라.` },
]

const analyses = await parallel(
  LENSES.map((l) => () => agent(l.prompt, { label: `lens:${l.key}`, phase: 'Analyze', schema: SCHEMA }))
)

phase('Synthesize')
const merged = LENSES.map((l, i) => ({ lens: l.key, result: analyses[i] })).filter((x) => x.result)

const doc = await agent(
  `${CTX}\n\n너는 4개 렌즈(ceo·operators·bottleneck·dashboard) 분석을 받아 **한국어 종합 조사 문서**(마크다운)를 작성하는 종합자다. 코퍼스(${CORPUS})를 직접 다시 확인해 근거를 보강하고 중복을 합쳐라.

4개 렌즈 결과(JSON):
${JSON.stringify(merged, null, 2)}

문서 구조(이 순서, 한국어, 처음 읽는 사람도 이해되게 자립적으로):
# zipiel 시딩 오퍼레이션 — 슬랙 채널 니즈·병목 조사
> 출처: 회사 슬랙 #mkt-오퍼레이션-대시보드(C0APNDK4QKW) 06-12~06-26 전수 / 작성 2026-06-26

## 1. 한눈에(Executive summary) — 핵심 3~5줄
## 2. 팀 구조·역할 (effie·작업자 4인·대표·이용진, 국가 분담)
## 3. 시딩 운영 워크플로우 (실제 단계: 소싱→listing→outreach→협상→바우처·배송→콘텐츠→성과, 각 단계에서 시트로 하는 일)
## 4. 대표·운영리드(effie) 니즈 (우선순위·KPI·의사결정 지점)
## 5. 작업자 니즈·일일 업무 (반복·수기·마찰, 국가별 차이)
## 6. 병목·비효율 (TOP 위주, 영향과 함께)
## 7. 대시보드 요구사항 — 충족 vs 갭 (우리가 만든 것이 푸는 것 / 아직 빠진 것)
## 8. 우선순위 제언 (다음에 만들/자동화할 것 P0~P2, 근거)
## 부록: 주요 발화·결정 타임라인 (날짜순 핵심 인용 요약, raw PII 제외)

규칙: raw PII(이메일·전화·고객정보) 금지, 인물은 역할/이름만. 날조 금지 — 코퍼스 근거만. 추정은 (추정) 라벨. 충분히 자세하게(이 문서로 다음 작업 우선순위를 정할 수 있게). 마크다운 전문을 그대로 반환(다른 설명 없이 문서만).`,
  { label: 'synthesize-doc', phase: 'Synthesize' }
)

return { doc, lensCount: merged.length }
