// 레이아웃마다의 그리기를 모은 표. 레이아웃 하나의 그리기는 layouts/<이름>.tsx, 모양은 styles/<이름>.css에 있다.
// 여러 레이아웃이 같이 쓰는 조각(장 머리, 항목)은 layouts/parts.tsx

import type { ReactNode } from 'react'
import type { LayoutId } from '../deck/types'
import { Agenda } from './layouts/Agenda'
import { Bars } from './layouts/Bars'
import { Bridge } from './layouts/Bridge'
import { Case } from './layouts/Case'
import { Closing } from './layouts/Closing'
import { Compare } from './layouts/Compare'
import { Cover } from './layouts/Cover'
import { Funnel } from './layouts/Funnel'
import { ImageText } from './layouts/ImageText'
import { Kpi } from './layouts/Kpi'
import { Logos } from './layouts/Logos'
import { Matrix } from './layouts/Matrix'
import { Points } from './layouts/Points'
import { Position } from './layouts/Position'
import { Pricing } from './layouts/Pricing'
import { Process } from './layouts/Process'
import { Progress } from './layouts/Progress'
import { Scorecard } from './layouts/Scorecard'
import { Section } from './layouts/Section'
import { Share } from './layouts/Share'
import { Statement } from './layouts/Statement'
import { Summary } from './layouts/Summary'
import { Table } from './layouts/Table'
import { Timeline } from './layouts/Timeline'
import { Trend } from './layouts/Trend'
import { Versus } from './layouts/Versus'

/** 레이아웃마다의 그리기. 부품 장(compose)은 여기 없다: 부품 장(blocks.tsx)이 레이아웃 부품을 그리려고 이 표를 쓰므로,
 * 여기서 부품 장을 가져오면 두 파일이 서로를 가져온다. 장을 그리는 곳(SlideCanvas)이 부품 장을 따로 고른다 */
export const LAYOUT_VIEWS: Record<Exclude<LayoutId, 'compose'>, () => ReactNode> = {
  cover: Cover,
  section: Section,
  agenda: Agenda,
  summary: Summary,
  statement: Statement,
  kpi: Kpi,
  scorecard: Scorecard,
  bridge: Bridge,
  trend: Trend,
  progress: Progress,
  share: Share,
  process: Process,
  funnel: Funnel,
  table: Table,
  points: Points,
  compare: Compare,
  matrix: Matrix,
  position: Position,
  timeline: Timeline,
  case: Case,
  pricing: Pricing,
  imageText: ImageText,
  logos: Logos,
  bars: Bars,
  versus: Versus,
  closing: Closing,
}

export { BOLD_LAYOUTS } from '../deck/layouts'
