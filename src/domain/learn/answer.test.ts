import { describe, expect, it } from 'vitest'
import { AnswerRecordSchema, toAnswerRecord } from './answer.ts'

const TERM_ID = '00000000-0000-4000-8000-000000000001'

describe('toAnswerRecord', () => {
  it('takes the instant and the local day from the same moment', () => {
    // 00:30 on the 26th at UTC+7 is still the 25th in UTC.
    const record = toAnswerRecord(TERM_ID, true, false, new Date(2026, 9, 26, 0, 30))
    expect(record).toEqual({
      termId: TERM_ID,
      correct: true,
      promote: false,
      answeredAt: '2026-10-25T17:30:00.000Z',
      day: '2026-10-26',
    })
    expect(AnswerRecordSchema.parse(record)).toStrictEqual(record)
  })
})

describe('AnswerRecordSchema', () => {
  const valid = toAnswerRecord(TERM_ID, true, true, new Date(2026, 9, 25, 9))

  it('rejects a wrong answer that promotes', () => {
    const result = AnswerRecordSchema.safeParse({ ...valid, correct: false })
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([['promote']])
  })

  it('rejects a day that is not a calendar day', () => {
    expect(AnswerRecordSchema.safeParse({ ...valid, day: '2026-10-25T00:00' }).success).toBe(false)
  })
})
