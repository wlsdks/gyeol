// 부품: 이미지 (image). 모양은 styles/blocks/image.css

import { cx } from '../../lib/cx'
import { imageSize } from '../../lib/image'
import { useSlide } from '../context'
import { ImageSlot, T } from '../fields'

/**
 * 이미지. 꽉 채우기는 칸을 다 덮고(넘치는 쪽을 자른다), 전체 보이기는 이미지 비율 그대로 칸 안에서 가장 크게 그린다.
 * 비율은 파일 머리에서 읽어 둬서(imageSize) 내보낸 HTML도 자바스크립트 없이 같은 크기로 그린다
 */
export function Picture() {
  const { slide } = useSlide()
  const contain = slide.variant === 'contain'
  const size = contain ? imageSize(slide.fields.image ?? '') : null
  return (
    <figure className={cx('bk-img', size && 'is-fit')} style={size ? ({ '--ar': size.w / size.h }) : undefined}>
      <ImageSlot k="image" className="bk-img-i" contain={contain} />
      <T k="caption" as="figcaption" className="bk-img-c" />
    </figure>
  )
}
