export function drawItem(context, item) {
  context.save()
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.lineWidth = item.width
  context.strokeStyle = item.color
  context.fillStyle = item.color

  if (item.type === 'marker') context.globalAlpha = 0.32
  if (item.type === 'eraser') context.globalCompositeOperation = 'destination-out'

  if (item.type === 'pen' || item.type === 'marker' || item.type === 'eraser') {
    context.beginPath()
    context.moveTo(item.points[0].x, item.points[0].y)
    item.points.forEach((point) => context.lineTo(point.x, point.y))
    context.stroke()
  } else if (item.type === 'line') {
    context.beginPath()
    context.moveTo(item.startX, item.startY)
    context.lineTo(item.endX, item.endY)
    context.stroke()
  } else if (item.type === 'rectangle') {
    context.strokeRect(item.startX, item.startY, item.endX - item.startX, item.endY - item.startY)
  } else if (item.type === 'circle') {
    const radiusX = (item.endX - item.startX) / 2
    const radiusY = (item.endY - item.startY) / 2
    const centerX = item.startX + radiusX
    const centerY = item.startY + radiusY
    context.beginPath()
    context.ellipse(centerX, centerY, Math.abs(radiusX), Math.abs(radiusY), 0, 0, Math.PI * 2)
    context.stroke()
  } else if (item.type === 'text') {
    context.font = `600 ${item.width}px Raleway, sans-serif`
    item.text.split('\n').forEach((line, index) => {
      context.fillText(line, item.x, item.y + index * item.width * 1.4)
    })
  }

  context.restore()
}
