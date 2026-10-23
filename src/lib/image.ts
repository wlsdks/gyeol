const MAX_SIDE = 2000

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/** 올린 이미지를 덱에 넣을 수 있는 크기로 줄여 data URL로 돌려준다. 이미지는 브라우저 밖으로 나가지 않는다. */
export async function imageToDataUrl(file: File): Promise<string> {
  if (file.type === 'image/svg+xml') return readAsDataUrl(file)
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  if (scale === 1 && file.size < 1.5 * 1024 * 1024) {
    bitmap.close()
    return readAsDataUrl(file)
  }
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  // 로고처럼 투명 배경이 있을 수 있는 형식은 PNG로 유지한다
  const keepAlpha = file.type === 'image/png' || file.type === 'image/webp' || file.type === 'image/gif'
  return canvas.toDataURL(keepAlpha ? 'image/png' : 'image/jpeg', 0.86)
}

export function pickImage(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.click()
  })
}
