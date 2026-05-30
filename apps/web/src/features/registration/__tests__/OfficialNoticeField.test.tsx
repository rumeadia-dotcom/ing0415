/**
 * OfficialNoticeField — 상품정보고시 입력 (PR-5 ESM / PR-4 11번가 공용 프레임).
 *
 * 마스터: docs/architecture/v1/features/esm.md §4.4 / §5(ESM), 11st.md §4.6 / §7 PR-4(11번가).
 * 검증:
 *   - (ESM 기본 config) 상품군 select(41개) 렌더 + 미선택 시 항목 폼 미노출.
 *   - 상품군 선택 시 EsmOfficialNotice 형태로 onChange (정적 필수항목 seed).
 *   - 항목 value 입력이 details[].value 에 적재 / 추가/삭제 / 해제.
 *   - (주입 config) 11번가형 1군 + free-form 직접입력 — type 직접입력 칸 동작 (PR-4).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  OfficialNoticeField,
  type OfficialNoticeConfig,
} from '../components/OfficialNoticeField'
import type { EsmOfficialNotice } from '@/lib/schemas'

function renderField(
  value: EsmOfficialNotice | undefined = undefined,
): { onChange: ReturnType<typeof vi.fn> } {
  const onChange = vi.fn()
  render(
    <OfficialNoticeField
      fieldId="mof-officialNotice"
      fieldLabel="G마켓·옥션 상품정보고시"
      value={value}
      onChange={onChange}
    />,
  )
  return { onChange }
}

describe('OfficialNoticeField — 상품군 select', () => {
  it('41개 상품군 옵션을 렌더한다 (+ placeholder)', () => {
    renderField()
    const select = screen.getByLabelText('G마켓·옥션 상품정보고시')
    // 41 상품군 + placeholder 1.
    expect(select.querySelectorAll('option')).toHaveLength(42)
    expect(screen.getByRole('option', { name: '의류' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '살생물제품' })).toBeInTheDocument()
  })

  it('상품군 미선택이면 항목 폼이 보이지 않는다', () => {
    renderField()
    expect(screen.queryByText('필수 고시 항목')).not.toBeInTheDocument()
  })

  it('상품군 선택 시 officialNoticeNo + 정적 필수항목 seed 로 onChange', async () => {
    const user = userEvent.setup()
    const { onChange } = renderField()
    // 상품군 41(살생물제품) — 정적 항목 "41-1" 1개 seed.
    await user.selectOptions(screen.getByLabelText('G마켓·옥션 상품정보고시'), '41')
    const arg = onChange.mock.calls.at(-1)?.[0] as EsmOfficialNotice
    expect(arg.officialNoticeNo).toBe('41')
    expect(arg.details).toEqual([{ code: '41-1', value: '' }])
  })

  it('정적 항목 없는 상품군은 빈 details 로 시작', async () => {
    const user = userEvent.setup()
    const { onChange } = renderField()
    await user.selectOptions(screen.getByLabelText('G마켓·옥션 상품정보고시'), '1')
    const arg = onChange.mock.calls.at(-1)?.[0] as EsmOfficialNotice
    expect(arg).toEqual({ officialNoticeNo: '1', details: [] })
  })

  it('상품군 해제(빈 선택) 시 onChange(undefined)', async () => {
    const user = userEvent.setup()
    const { onChange } = renderField({ officialNoticeNo: '1', details: [] })
    await user.selectOptions(screen.getByLabelText('G마켓·옥션 상품정보고시'), '')
    expect(onChange).toHaveBeenLastCalledWith(undefined)
  })
})

describe('OfficialNoticeField — 항목 입력', () => {
  it('항목 value 입력이 details[].value 에 적재된다', async () => {
    const user = userEvent.setup()
    const { onChange } = renderField({
      officialNoticeNo: '41',
      details: [{ code: '41-1', value: '' }],
    })
    await user.type(screen.getByLabelText('고시 항목 1 내용'), '살균제')
    // controlled — 마지막 호출에 마지막 글자 패치가 담긴다.
    const arg = onChange.mock.calls.at(-1)?.[0] as EsmOfficialNotice
    expect(arg.details[0]?.code).toBe('41-1')
  })

  it('정적 필수항목의 코드 입력칸은 읽기전용(잠금)', () => {
    renderField({ officialNoticeNo: '41', details: [{ code: '41-1', value: '' }] })
    const codeInput = screen.getByLabelText('고시 항목 1 코드') as HTMLInputElement
    expect(codeInput.readOnly).toBe(true)
  })

  it('항목 추가 시 free-form 행이 details 에 더해진다', async () => {
    const user = userEvent.setup()
    const { onChange } = renderField({ officialNoticeNo: '1', details: [] })
    await user.click(screen.getByRole('button', { name: '항목 추가' }))
    const arg = onChange.mock.calls.at(-1)?.[0] as EsmOfficialNotice
    expect(arg.details).toEqual([{ code: '', value: '' }])
  })

  it('추가 행(잠금 아님)은 삭제 버튼을 노출한다', () => {
    renderField({ officialNoticeNo: '1', details: [{ code: 'x', value: 'y' }] })
    // staticCount=0 이므로 첫 행은 셀러 추가행 → 삭제 가능.
    expect(
      screen.getByRole('button', { name: '고시 항목 1 삭제' }),
    ).toBeInTheDocument()
  })
})

// 11번가형 주입 config — 확보 군 1개 + free-form 직접입력 (PR-4).
const ELEVEN_ST_CONFIG: OfficialNoticeConfig = {
  options: [{ value: '891011', label: '일반 상품 (예시 군 · 891011)' }],
  staticItemCodes: () => [],
  allowFreeform: true,
}

function renderWithConfig(
  config: OfficialNoticeConfig,
  value: EsmOfficialNotice | undefined = undefined,
): { onChange: ReturnType<typeof vi.fn> } {
  const onChange = vi.fn()
  render(
    <OfficialNoticeField
      fieldId="mof-officialNotice"
      fieldLabel="11번가 상품정보고시"
      value={value}
      onChange={onChange}
      config={config}
    />,
  )
  return { onChange }
}

describe('OfficialNoticeField — 주입 config (11번가형: 1군 + free-form)', () => {
  it('주입한 마스터 옵션 + 직접입력 옵션만 렌더한다 (ESM 41군 아님)', () => {
    renderWithConfig(ELEVEN_ST_CONFIG)
    const select = screen.getByLabelText('11번가 상품정보고시')
    // 확보 군 1 + placeholder 1 + free-form 1 = 3.
    expect(select.querySelectorAll('option')).toHaveLength(3)
    expect(
      screen.getByRole('option', { name: '일반 상품 (예시 군 · 891011)' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: '직접 입력 (마스터에 없는 상품군)' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: '의류' })).not.toBeInTheDocument()
  })

  it('확보 군 선택 시 officialNoticeNo=type + 빈 details 로 onChange', async () => {
    const user = userEvent.setup()
    const { onChange } = renderWithConfig(ELEVEN_ST_CONFIG)
    await user.selectOptions(screen.getByLabelText('11번가 상품정보고시'), '891011')
    const arg = onChange.mock.calls.at(-1)?.[0] as EsmOfficialNotice
    expect(arg).toEqual({ officialNoticeNo: '891011', details: [] })
  })

  it('free-form 선택 시 type 빈 값 + 항목 1행 + 직접입력 칸 노출', async () => {
    const user = userEvent.setup()
    const { onChange } = renderWithConfig(ELEVEN_ST_CONFIG)
    await user.selectOptions(
      screen.getByLabelText('11번가 상품정보고시'),
      '__freeform__',
    )
    const arg = onChange.mock.calls.at(-1)?.[0] as EsmOfficialNotice
    expect(arg).toEqual({ officialNoticeNo: '', details: [{ code: '', value: '' }] })
  })

  it('free-form 상태에서 type 직접입력 칸이 노출되고 입력값이 officialNoticeNo 에 적재', async () => {
    const user = userEvent.setup()
    // 이미 free-form 상태(마스터에 없는 type)인 value 로 시작.
    const { onChange } = renderWithConfig(ELEVEN_ST_CONFIG, {
      officialNoticeNo: '',
      details: [{ code: '', value: '' }],
    })
    const typeInput = screen.getByLabelText('상품군 유형코드 직접 입력')
    expect(typeInput).toBeInTheDocument()
    await user.type(typeInput, '7')
    const arg = onChange.mock.calls.at(-1)?.[0] as EsmOfficialNotice
    expect(arg.officialNoticeNo).toBe('7')
  })

  it('config 미주입 시 ESM 기본(41군) — 하위호환', () => {
    render(
      <OfficialNoticeField
        fieldId="mof-officialNotice"
        fieldLabel="G마켓·옥션 상품정보고시"
        value={undefined}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByRole('option', { name: '의류' })).toBeInTheDocument()
    // ESM 은 free-form 옵션 없음.
    expect(
      screen.queryByRole('option', { name: '직접 입력 (마스터에 없는 상품군)' }),
    ).not.toBeInTheDocument()
  })
})
