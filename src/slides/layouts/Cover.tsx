// 레이아웃: 표지 (cover). 모양은 styles/cover.css

import { asksDecision } from '../../deck/blueprints'
import { cx } from '../../lib/cx'
import { useSlide } from '../context'
import { ImageSlot, MetaRow, T } from '../fields'

export function Cover() {
  const { slide, meta, mode } = useSlide()
  // 결정 요청 칸은 결정을 받는 발표에서만 편집할 때 안내와 함께 보인다. 공유, 교육, 소개 같은 발표는 묻지 않으니
  // 칸을 두지 않는다(예전에 적어 둔 결정 요청은 그대로 보인다)
  const showAsk = !!slide.fields.ask?.trim() || (mode !== 'final' && asksDecision(meta.type))
  return (
    <>
      <div className="cv-main">
        <ImageSlot k="$logo" className="cv-logo" contain optional />
        <div className="cv-text">
          <T k="title" as="h1" className="cv-title" fit={[16, 28]} multiline />
          <T k="lead" as="p" className="cv-lead" multiline />
        </div>
      </div>
      <div className={cx('cv-side', !showAsk && 'no-ask')}>
        {showAsk ? (
          <div className="cv-ask">
            <span className="cv-label">결정 요청</span>
            <T k="ask" as="p" className="cv-ask-text" fit={[16, 28]} multiline />
          </div>
        ) : (
          <span />
        )}
        <dl className="cv-meta">
          <MetaRow label="발표" k="$presenter" />
          <MetaRow label="소속" k="$org" />
          <MetaRow label="날짜" k="$date" />
        </dl>
      </div>
    </>
  )
}
