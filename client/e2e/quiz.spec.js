import { test, expect } from './helpers.js'
import { musicalNeeds } from '../../server/data/quizzes/musicalNeeds.js'

test('quiz requires answers, supports Back, and shows submitted result', async ({ page, app }) => {
  expect(app.signedIn).toBe(true)
  const answers = Object.fromEntries(musicalNeeds.questions.map((q) => [q.id, q.options[0].id]))
  let submitted
  const result = {
    quizId: musicalNeeds.id,
    quizTitle: musicalNeeds.title,
    title: 'Music as Fuel',
    headline: 'Your result',
    subtitle: 'Fuel',
    description: 'Music helps you focus.',
    justification: [],
    breakdown: [],
  }
  await page.route('**/api/quiz/musical-needs', (route) => route.fulfill({ json: musicalNeeds }))
  await page.route('**/api/quiz/musical-needs/result', (route) => {
    if (route.request().method() === 'POST') submitted = route.request().postDataJSON()
    return route.fulfill({ json: result })
  })
  await page.goto('/quiz/musical-needs')
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled()
  await page
    .getByRole('button', { name: musicalNeeds.questions[0].options[0].text, exact: true })
    .click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(
    page.getByRole('button', { name: musicalNeeds.questions[0].options[0].text, exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  for (const [index, question] of musicalNeeds.questions.entries()) {
    await page.getByRole('button', { name: question.options[0].text, exact: true }).click()
    await page
      .getByRole('button', {
        name: index === musicalNeeds.questions.length - 1 ? 'See my result' : 'Next',
        exact: true,
      })
      .click()
  }
  await expect(page).toHaveURL('/quiz/musical-needs/result')
  await expect(page.getByRole('heading', { name: 'Music as Fuel', exact: true })).toBeVisible()
  expect(submitted).toEqual({ answers })
})
