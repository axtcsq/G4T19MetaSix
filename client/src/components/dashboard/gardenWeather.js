// All motion uses the garden's clock: pause, reduced motion and PNG export stay in sync.
export function drawWeather(p, weather, time, foreground = false) {
  if (!weather) return
  const { condition, isDay = true, wind = 0 } = weather
  const snowy = condition === 'snow'
  const stormy = ['storm', 'hail'].includes(condition)
  const wet = ['rain', 'drizzle', 'storm', 'hail'].includes(condition)
  const cloudy = ['partly', 'cloudy', 'fog'].includes(condition) || wet || snowy
  p.push()
  p.noStroke()
  if (!foreground) {
    p.background(
      !isDay
        ? '#273747'
        : stormy
          ? '#a4b1ba'
          : wet
            ? '#c4d0d1'
            : snowy
              ? '#e2e8e9'
              : condition === 'cloudy'
                ? '#cdd2cf'
                : '#eae8df',
    )
    if (!isDay) {
      p.fill('#f2eed1')
      p.circle(820, 95, 58)
      for (let i = 0; i < 28; i++) {
        p.fill(245, 242, 219, 110 + Math.sin(time + i) * 60)
        p.circle((i * 137 + 25) % 1000, (i * 53 + 20) % 250, 2 + (i % 3))
      }
    } else if (['clear', 'partly', 'wind'].includes(condition)) {
      for (let ring = 5; ring > 0; ring--) {
        p.fill(239, 204, 130, 12)
        p.circle(820, 90, 78 + ring * 24 + Math.sin(time) * 5)
      }
      p.fill('#edcf92')
      p.circle(820, 90, 66)
    }
    if (cloudy) {
      const count = condition === 'partly' ? 3 : 7
      for (let i = 0; i < count; i++) {
        const x = ((i * 241 + time * (12 + wind * 0.4)) % 1400) - 200
        const y = 36 + (i % 3) * 48
        p.fill(stormy ? '#81929e' : !isDay ? '#687786' : '#f0f0e9')
        p.ellipse(x, y, 240, 56)
        p.ellipse(x - 55, y - 16, 110, 65)
        p.ellipse(x + 35, y - 24, 135, 85)
      }
    }
  } else {
    if (wet || snowy) {
      const count = condition === 'drizzle' ? 45 : snowy ? 85 : 130
      for (let i = 0; i < count; i++) {
        const speed = snowy ? 22 + (i % 19) : 230 + (i % 100)
        const y = ((i * 73 + time * speed) % 710) - 30
        const x =
          ((i * 137 +
            time * (wind * 2 + (snowy ? 8 : 25)) +
            Math.sin(time + i) * (snowy ? 16 : 0)) %
            1080) -
          40
        if (snowy || condition === 'hail') {
          p.noStroke()
          p.fill(255, 255, 250, 210)
          p.circle(x, y, snowy ? 3 + (i % 5) : 4)
        } else {
          p.stroke(104, 137, 151, condition === 'drizzle' ? 100 : 160)
          p.strokeWeight(condition === 'drizzle' ? 1 : 1.5)
          p.line(x, y, x + 3 + wind * 0.2, y + (condition === 'drizzle' ? 9 : 20))
        }
      }
    }
    if (condition === 'fog') {
      p.noStroke()
      for (let i = 0; i < 9; i++) {
        p.fill(238, 241, 234, 38)
        p.ellipse(500 + Math.sin(time * 0.3 + i) * 180, 90 + i * 72, 1350, 130)
      }
    }
    if (wind >= 25 || condition === 'wind') {
      p.noFill()
      p.stroke(246, 245, 231, 140)
      p.strokeWeight(1.5)
      for (let i = 0; i < 12; i++) {
        const x = ((time * 145 + i * 193) % 1400) - 250
        const y = 180 + i * 37
        p.bezier(x, y, x + 50, y - 20, x + 100, y + 20, x + 170, y)
      }
    }
    // A quiet visible bolt, with no strobing/full-screen flashes.
    if (stormy) {
      p.noFill()
      p.stroke(250, 236, 178, 170 + Math.sin(time * 1.4) * 60)
      p.strokeWeight(3)
      p.beginShape()
      p.vertex(735, 84)
      p.vertex(710, 126)
      p.vertex(731, 122)
      p.vertex(706, 170)
      p.endShape()
    }
  }
  p.pop()
}
