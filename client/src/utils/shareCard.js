// Draws a story-sized (9:16) summary of the user's MetaFor personality on a
// canvas, so it can be saved or shared like a year-in-review card.

export const CARD_WIDTH = 1080
export const CARD_HEIGHT = 1920

const SANS = 'Raleway, sans-serif'
const SERIF = '"Crimson Text", serif'
const PADDING = 90
const INNER_WIDTH = CARD_WIDTH - PADDING * 2

// Colours from the Patterns band.
const LAVENDER = '#665f78'
const TERRACOTTA = '#ce5b4b'
const BROWN = '#763e32'
const PEACH = '#ffcda6'

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not load the personality icon.'))
    image.src = src
  })
}

// The canvas only uses web fonts that have already loaded.
async function loadFonts() {
  await Promise.all([
    document.fonts.load(`600 40px ${SANS}`),
    document.fonts.load(`800 100px ${SANS}`),
    document.fonts.load(`400 40px ${SERIF}`),
    document.fonts.load(`italic 400 40px ${SERIF}`),
    document.fonts.load(`700 60px ${SERIF}`),
  ])
}

function drawBackground(ctx) {
  const gradient = ctx.createLinearGradient(0, 0, CARD_WIDTH * 0.4, CARD_HEIGHT)
  gradient.addColorStop(0, LAVENDER)
  gradient.addColorStop(0.55, TERRACOTTA)
  gradient.addColorStop(1, BROWN)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)

  // Soft peach waves, like the moving background on the page.
  for (let wave = 0; wave < 5; wave++) {
    const baseY = 260 + wave * 360
    ctx.beginPath()
    ctx.moveTo(0, CARD_HEIGHT)
    for (let x = 0; x <= CARD_WIDTH; x += 20) {
      const y = baseY + Math.sin(x / 170 + wave * 1.3) * 60 + Math.sin(x / 90 + wave) * 18
      ctx.lineTo(x, y)
    }
    ctx.lineTo(CARD_WIDTH, CARD_HEIGHT)
    ctx.closePath()
    ctx.fillStyle = `rgba(255, 205, 166, ${0.05 + wave * 0.012})`
    ctx.fill()
  }
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath()
  ctx.roundRect(x, y, width, height, radius)
}

// Shrinks the font until the text fits on one line.
function fitText(ctx, text, maxWidth, weight, size, family) {
  let fontSize = size
  ctx.font = `${weight} ${fontSize}px ${family}`
  while (ctx.measureText(text).width > maxWidth && fontSize > 40) {
    fontSize -= 4
    ctx.font = `${weight} ${fontSize}px ${family}`
  }
}

// Cuts the text with an ellipsis so it fits in maxWidth.
function truncate(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text
  let cut = text
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1)
  return `${cut.trimEnd()}…`
}

// Splits text into at most maxLines lines that fit in maxWidth.
function wrapLines(ctx, text, maxWidth, maxLines) {
  const lines = []
  let line = ''
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  if (lines.length > maxLines) {
    lines.length = maxLines
    lines[maxLines - 1] = truncate(ctx, `${lines[maxLines - 1]}…`, maxWidth)
  }
  return lines
}

// The MetaFor butterfly, with the same wing paths as ButterflyMark.vue: one
// side drawn, then mirrored for the other.
const UPPER_WING =
  'M30.5 27.5C27.5 17 19 5 6 3C1 2.5 -1 7 0 13C1.5 21 8 29 17 31C23 32 28 31.5 30.5 30.5Z'
const LOWER_WING =
  'M30.5 33C26 33 18.5 33.5 14.5 37.5C10.5 41.5 11.5 48.5 16.5 50.5C21.5 52.5 27 47 29.5 40.5C30.5 38 30.8 35.5 30.5 33Z'
const LOGO_HEIGHT = 60
// The logo's viewBox is 68 wide and 60 tall, starting at x = -2.
const LOGO_WIDTH = (LOGO_HEIGHT * 68) / 60

function drawButterfly(ctx, x, y) {
  const scale = LOGO_HEIGHT / 60
  const wings = [new Path2D(UPPER_WING), new Path2D(LOWER_WING)]
  ctx.save()
  ctx.translate(x + 2 * scale, y)
  ctx.scale(scale, scale)
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 2.6
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  for (const mirrored of [false, true]) {
    ctx.save()
    if (mirrored) {
      ctx.translate(64, 0)
      ctx.scale(-1, 1)
    }
    wings.forEach((wing) => ctx.stroke(wing))
    ctx.restore()
  }
  ctx.restore()
}

function drawHeader(ctx) {
  drawButterfly(ctx, PADDING, 100)

  ctx.textAlign = 'left'
  ctx.fillStyle = '#fff'
  ctx.font = `700 64px ${SERIF}`
  ctx.fillText('MetaFor', PADDING + LOGO_WIDTH + 18, 150)

  ctx.textAlign = 'right'
  ctx.font = `600 28px ${SANS}`
  ctx.letterSpacing = '4px'
  ctx.fillText('MY LISTENING PERSONALITY', CARD_WIDTH - PADDING, 142)
  ctx.letterSpacing = '0px'
}

function drawType(ctx, personality, icon) {
  const centreX = CARD_WIDTH / 2

  // The type icon on a white disc.
  ctx.beginPath()
  ctx.arc(centreX, 520, 210, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'
  ctx.shadowColor = 'rgba(0, 0, 0, 0.25)'
  ctx.shadowBlur = 40
  ctx.shadowOffsetY = 12
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.drawImage(icon, centreX - 150, 370, 300, 300)

  ctx.textAlign = 'center'
  ctx.fillStyle = '#fff'
  ctx.font = `600 44px ${SANS}`
  ctx.fillText('I am', centreX, 830)

  fitText(ctx, personality.type.name, INNER_WIDTH, 800, 104, SANS)
  ctx.fillText(personality.type.name, centreX, 945)

  ctx.font = `italic 400 46px ${SERIF}`
  ctx.fillStyle = PEACH
  wrapLines(ctx, personality.type.tagline, INNER_WIDTH - 40, 2).forEach((line, index) => {
    ctx.fillText(line, centreX, 1025 + index * 54)
  })
}

// The four traits as a 2 x 2 grid of tiles.
function drawTraits(ctx, traits) {
  const top = 1150
  const gap = 24
  const tileWidth = (INNER_WIDTH - gap) / 2
  const tileHeight = 130

  traits.slice(0, 4).forEach((trait, index) => {
    const x = PADDING + (index % 2) * (tileWidth + gap)
    const y = top + Math.floor(index / 2) * (tileHeight + gap)

    roundedRect(ctx, x, y, tileWidth, tileHeight, 24)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)'
    ctx.fill()

    ctx.textAlign = 'left'
    ctx.fillStyle = PEACH
    ctx.font = `600 24px ${SANS}`
    ctx.letterSpacing = '3px'
    ctx.fillText(trait.label.toUpperCase(), x + 30, y + 46)
    ctx.letterSpacing = '0px'

    ctx.fillStyle = '#fff'
    ctx.font = `800 46px ${SANS}`
    ctx.fillText(trait.poleName, x + 30, y + 102)

    ctx.textAlign = 'right'
    ctx.font = `600 34px ${SANS}`
    ctx.fillText(`${trait.strength}%`, x + tileWidth - 30, y + 102)
  })
}

function drawResults(ctx, quizResults) {
  const top = 1490
  ctx.textAlign = 'left'
  ctx.fillStyle = PEACH
  ctx.font = `600 26px ${SANS}`
  ctx.letterSpacing = '3px'
  ctx.fillText('MY QUIZ RESULTS', PADDING, top)
  ctx.letterSpacing = '0px'

  quizResults.slice(0, 6).forEach((result, index) => {
    const y = top + 58 + index * 46
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)'
    ctx.font = `600 30px ${SANS}`
    const quizLabel = truncate(ctx, result.quizTitle, 340)
    ctx.fillText(quizLabel, PADDING, y)

    ctx.fillStyle = '#fff'
    ctx.font = `400 36px ${SERIF}`
    ctx.textAlign = 'right'
    ctx.fillText(truncate(ctx, result.title, INNER_WIDTH - 380), CARD_WIDTH - PADDING, y)
    ctx.textAlign = 'left'
  })
}

function drawFooter(ctx, personality) {
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
  ctx.font = `600 28px ${SANS}`
  const quizzes = personality.quizResults.length
  ctx.fillText(
    `${personality.type.match}% match · ${quizzes} ${quizzes === 1 ? 'quiz' : 'quizzes'} + my listening`,
    CARD_WIDTH / 2,
    CARD_HEIGHT - 80,
  )
}

// Returns a canvas with the card drawn on it.
export async function drawShareCard(personality, iconSrc) {
  const [icon] = await Promise.all([loadImage(iconSrc), loadFonts()])

  const canvas = document.createElement('canvas')
  canvas.width = CARD_WIDTH
  canvas.height = CARD_HEIGHT
  const ctx = canvas.getContext('2d')

  drawBackground(ctx)
  drawHeader(ctx)
  drawType(ctx, personality, icon)
  drawTraits(ctx, personality.traits)
  drawResults(ctx, personality.quizResults)
  drawFooter(ctx, personality)

  return canvas
}

export function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not create the image.'))),
      'image/png',
    )
  })
}
