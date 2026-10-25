// 부품: 인용 (quote). 모양은 styles/blocks/quote.css

import { T } from '../fields'

export function Quote() {
  return (
    <figure className="bk-q">
      <span className="bk-q-mark" aria-hidden="true">
        “
      </span>
      <T k="quote" as="blockquote" className="bk-q-t" fit={[40, 70]} multiline />
      <T k="by" as="figcaption" className="bk-q-by" />
    </figure>
  )
}
