// Turns the user's exported data into a PDF. Each page is drawn on a canvas first,
// because PDF's built-in fonts can't show song titles in Japanese, Korean or other
// non-Latin scripts, and the browser's fonts can.

const PAGE_WIDTH = 595
const PAGE_HEIGHT = 842
const MARGIN = 48
const SCALE = 1.5
const FONT = 'Raleway, "Segoe UI", "Helvetica Neue", Arial, "Noto Sans", sans-serif'
const INK = '#292321'
const MUTED = '#6f6660'
const BRAND = '#a54b3b'
const STYLES = {
  title: { font: `700 26px ${FONT}`, color: INK, line: 32, before: 0 },
  heading: { font: `700 16px ${FONT}`, color: BRAND, line: 22, before: 18 },
  subheading: { font: `700 11px ${FONT}`, color: INK, line: 15, before: 9 },
  text: { font: `400 10px ${FONT}`, color: INK, line: 14, before: 0 },
  note: { font: `400 9px ${FONT}`, color: MUTED, line: 13, before: 0 },
}

const formatDate = (value, withTime = false) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown date'
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  })
}

// What goes in the PDF, in order: [style, text] pairs.
export function dataExportItems(data, quizzes = []) {
  const items = [
    ['title', 'Your MetaFor data'],
    ['note', `Exported ${formatDate(data.exportedAt, true)}`],
    ['heading', 'Account'],
    ['text', `Name: ${data.account?.displayName ?? 'Not set'}`],
    ['text', `Timezone: ${data.account?.timezone ?? 'Not set'}`],
    ['text', `Birthday: ${data.account?.birthday ? formatDate(data.account.birthday) : 'Not set'}`],
    ['text', `Spotify connected: ${data.account?.spotifyLinked ? 'Yes' : 'No'}`],
  ]

  const journal = data.journal ?? []
  items.push(['heading', `Journal (${journal.length})`])
  if (!journal.length) items.push(['note', 'No journal entries.'])
  for (const entry of journal) {
    items.push(['subheading', `${formatDate(entry.createdAt, true)} · ${entry.mood}`])
    if (entry.journal) items.push(['text', entry.journal])
    if (entry.song) items.push(['note', `Song of the Day: ${entry.song.name} by ${(entry.song.artists ?? []).join(', ')}`])
    const extras = [entry.hasDrawing && 'a drawing', entry.hasPhoto && 'a photo'].filter(Boolean)
    if (extras.length) items.push(['note', `This entry also has ${extras.join(' and ')}, shown in the app.`])
  }

  const attempts = data.quizAttempts ?? []
  items.push(['heading', `Quizzes (${attempts.length})`])
  if (!attempts.length) items.push(['note', 'No quizzes taken.'])
  const quizById = new Map(quizzes.map((quiz) => [quiz.id, quiz]))
  const latestShown = new Set()
  for (const attempt of attempts) {
    const quiz = quizById.get(attempt.quizId)
    items.push(['subheading', `${formatDate(attempt.createdAt, true)} · ${quiz?.title ?? attempt.quizId}`])
    // Attempts come newest first, and only the newest one's result is worked out.
    if (quiz?.latestResult && !latestShown.has(quiz.id)) {
      latestShown.add(quiz.id)
      const { title, subtitle } = quiz.latestResult
      items.push(['text', `Result: ${title}${subtitle ? `, ${subtitle}` : ''}`])
    }
    const answers = Object.keys(attempt.answers ?? {}).length
    items.push(['note', `${answers} ${answers === 1 ? 'answer' : 'answers'} saved`])
  }

  const listens = data.listens ?? []
  items.push(['heading', `Listening history (${listens.length})`])
  if (!listens.length) items.push(['note', 'No plays saved.'])
  for (const listen of listens) {
    const song = listen.track
      ? `${listen.track.name} by ${(listen.track.artists ?? []).join(', ')}`
      : 'Unknown song'
    items.push(['text', `${formatDate(listen.playedAt, true)}  ${song}`])
  }
  return items
}

// Splits text into lines that fit. Scripts without spaces break between characters.
export function wrapText(text, fits) {
  const lines = []
  for (const paragraph of String(text).split(/\r?\n/)) {
    let line = ''
    for (const word of paragraph.split(/(?<=\s)/)) {
      if (fits(line + word)) {
        line += word
        continue
      }
      if (line) lines.push(line.trimEnd())
      line = ''
      for (const character of word) {
        if (!fits(line + character) && line) {
          lines.push(line)
          line = ''
        }
        line += character
      }
    }
    lines.push(line.trimEnd())
  }
  return lines
}

function newPage() {
  const canvas = document.createElement('canvas')
  canvas.width = PAGE_WIDTH * SCALE
  canvas.height = PAGE_HEIGHT * SCALE
  const context = canvas.getContext('2d')
  context.scale(SCALE, SCALE)
  context.fillStyle = '#fff'
  context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT)
  context.textBaseline = 'top'
  return { canvas, context }
}

export async function downloadDataPdf(data, quizzes, fileName) {
  // Only loaded when someone exports, so it doesn't slow the app down.
  const { jsPDF } = await import('jspdf')
  await document.fonts?.ready
  const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true })
  let page = newPage()
  let pageNumber = 1
  let y = MARGIN

  const finishPage = async () => {
    const { canvas, context } = page
    context.font = STYLES.note.font
    context.fillStyle = MUTED
    context.fillText(`Page ${pageNumber}`, MARGIN, PAGE_HEIGHT - MARGIN + 16)
    if (pageNumber > 1) pdf.addPage()
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.75), 'JPEG', 0, 0, PAGE_WIDTH, PAGE_HEIGHT)
    // A long history is many pages, so let the page stay responsive between them.
    await new Promise((resolve) => setTimeout(resolve))
  }

  for (const [styleName, text] of dataExportItems(data, quizzes)) {
    const style = STYLES[styleName]
    page.context.font = style.font
    const width = PAGE_WIDTH - MARGIN * 2
    const lines = wrapText(text, (line) => page.context.measureText(line).width <= width)
    y += y > MARGIN ? style.before : 0
    for (const line of lines) {
      if (y + style.line > PAGE_HEIGHT - MARGIN) {
        await finishPage()
        page = newPage()
        pageNumber += 1
        y = MARGIN
        page.context.font = style.font
      }
      page.context.fillStyle = style.color
      page.context.fillText(line, MARGIN, y)
      y += style.line
    }
  }
  await finishPage()
  pdf.save(fileName)
}
