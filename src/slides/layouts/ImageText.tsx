// 레이아웃: 이미지와 설명 (imageText). 모양은 styles/image-text.css

import { cx } from '../../lib/cx'
import { useSlide } from '../context'
import { ImageSlot, T } from '../fields'

export function ImageText() {
  const { slide } = useSlide()
  return (
    <div className={cx('ix', slide.options.flip && 'is-flip')}>
      <ImageSlot k="image" className="ix-img" contain={slide.options.contain} />
      <div className="ix-text">
        <T k="title" as="h2" className="s-title ix-title" fit={[16, 28]} multiline />
        <T k="body" className="ix-body" multiline />
      </div>
    </div>
  )
}
