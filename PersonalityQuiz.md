# Personality Quizzes

MetaFor's Personality page (`/quiz`) has six music-themed quizzes. Each quiz gives the user a fixed, explainable result. The **Patterns** section then combines all of their quiz results with their Spotify listening to decide which of the six **MetaFor personality types** they are, and explains how it got there.

Owner: Le Xin (@IceBucket420). Branch: `Personality-Quizzes`.

---

## Contents

1. [How it works for the user](#how-it-works-for-the-user)
2. [The six quizzes](#the-six-quizzes)
3. [Patterns](#patterns)
4. [Pages](#pages)
5. [API](#api)
6. [Data stored](#data-stored)
7. [Where the code lives](#where-the-code-lives)
8. [Changing things](#changing-things)
9. [Setting up the AI](#setting-up-the-ai)
10. [Waiting on teammates](#waiting-on-teammates)

---

## How it works for the user

1. On **Find Your Personality**, the user picks one of six quiz cards and presses **Get Started**.
2. They answer the questions one at a time. Spotify Horoscope asks for their birthday instead.
3. A **result page** shows what they are, what it means, why we think so, and a breakdown chart.
4. Back on the Personality page, that quiz's card now shows **Your result** with **View result** and **Retake** buttons.
5. The **Patterns** section updates after every quiz. It shows their MetaFor type, their four trait bars, insights, a mood × music line, and **How it adds up**: what each quiz and their Spotify data said about each trait.

Results are **fixed**: the same answers always give the same result, and no LLM is involved in any single quiz. Retaking a quiz replaces its old result.

---

## The six quizzes

| Quiz | Asks | Possible results | Uses Spotify data |
|---|---|---|---|
| Music MBTI | 12 questions | 16 types, e.g. *INFP · The Bedroom Dreamer* | No |
| Spotify Horoscope | Birthday only | Genre + energy + sign, e.g. *Jazzy Easygoing Libra* | Top genre, energy |
| Aux Alignment | 8 questions | 9 D&D alignments, e.g. *The Crowd Pleaser* | No |
| Love on Repeat | 8 questions | 5 music love languages | No |
| Soundwoods | 8 questions | 4 forest scenes, e.g. *The Moonlit Lake* | Energy, for comparison |
| Maslow’s Mixtape | 7 questions | 5 levels of need | Playlist names |

Every option a user can pick adds points to one or more of the quiz's **dimensions** (for example `{ E: 2 }` or `{ L: 1, G: 2 }`). The quiz's `evaluate()` turns those totals into its result. Every result also says how it scores on the four [MetaFor traits](#metafor-traits), which is what Patterns combines.

### 1. Music MBTI

**Concept:** similar to the real MBTI, but every question is about music. The result says something like "Based on the quiz, we think you are an INTP", gives a justification, and explains what being an INTP means for how you listen.

**How it's scored**
- 3 questions for each MBTI letter pair: E/I, S/N, T/F, J/P. Each has 4 options worth 2 points (strong lean) or 1 point (mild lean) towards one letter.
- Each pair picks the letter with more points, giving a 4-letter code.
- The result shows that code, a type name and meaning (16 written in the file), one justification line per letter with its percentage, and four scale bars.

| | | | |
|---|---|---|---|
| INTJ The Concept Album Architect | INTP The Deep-Cut Theorist | ENTJ The Festival Strategist | ENTP The Genre Debater |
| INFJ The Lyric Interpreter | INFP The Bedroom Dreamer | ENFJ The Playlist Matchmaker | ENFP The Discovery Spark |
| ISTJ The Library Keeper | ISFJ The Comfort Curator | ESTJ The Aux Organiser | ESFJ The Singalong Host |
| ISTP The Sound Tinkerer | ISFP The Mood Painter | ESTP The Front Row Thrill-Seeker | ESFP The Dance Floor Star |

**MetaFor traits:** E/I → Crowd/Solo, N/S → Explorer/Loyalist, F/T → Wordsmith/Soundscaper.

### 2. Spotify Horoscope

**Concept:** takes the user's Spotify data and their birthday. Using general horoscope knowledge, it identifies what kind of "music genre and usual energy" sign they are, e.g. "a Jazzy Fierce Libra" or "a Metal Chill Leo", with a description of what that means.

**How it's scored**
- **Sign:** worked out from the birthday's date ranges, plus the sign's element (fire, earth, air, water).
- **Genre word:** taken from the most common genre across their top artists (jazz → *Jazzy*, metal → *Metal*, k-pop → *K-Pop*, r&b → *Silky*, and so on, otherwise *Eclectic*).
- **Energy word:** taken from the average energy of their top tracks, from 75% and up to below 30%: *Fierce*, *Bold*, *Easygoing*, *Chill*, *Dreamy*.
- **Description:** a sign trait, an element trait, what the genre says about them, and what the energy says.

**MetaFor traits:** track energy → Amped/Mellow; fire and air signs lean Crowd, earth and water lean Solo.

### 3. Aux Alignment

**Concept:** D&D-style moral alignment (Lawful/Chaotic, Good/Evil) rating how safe or risky you are when handed the car aux cord or party speaker. Questions are behavioural scenarios at a party, in a car or hosting an event, where the user's taste collides with the group's. Options force a choice between playing it safe for the crowd (Lawful/Good), keeping your own taste at all costs (Evil) or being completely unpredictable (Chaotic).

**How it's scored**
- Each option gives points to L (Lawful), C (Chaotic), G (Good) and/or E (Evil).
- *Order* = how L compares with C, and *Morality* = how G compares with E, each from −1 to 1. A score within 0.25 of zero counts as Neutral.
- That places the user in one of 9 cells:

| | Good | Neutral | Evil |
|---|---|---|---|
| **Lawful** | The Crowd Pleaser | The Queue Keeper | The Aux Dictator |
| **Neutral** | The Vibe Reader | The Shuffle Button | The Aux Hog |
| **Chaotic** | The Wildcard DJ | The Genre Blender | The Aux Saboteur |

**MetaFor traits:** Chaotic → Explorer, Lawful → Loyalist; Good → Crowd, Evil → Solo.

### 4. Love on Repeat

**Concept:** based on the 5 Love Languages. It identifies how you show affection and form close connections through music. Questions are emotional and relational: how you react when someone sends you a song, which music gesture makes you feel cared for, and how you share music.

**How it's scored:** every question has five options, one per language. The language picked most often is the result, and the second most picked is shown as "With a side of…".

| Language | Means |
|---|---|
| Acts of Curation | Making tailored playlists |
| Words of Acoustic Affirmation | Sending the exact lyric, with the timestamp |
| Quality Listening Time | Gigs, karaoke, drives together |
| Gifts of Vinyl | Records, merch and tickets |
| Shared Earbud | Physical closeness while listening |

**MetaFor traits:** a mix weighted by how often each language was picked. Curation → Explorer, Words → Wordsmith, Time → Crowd and Amped, Gifts → Loyalist, Shared Earbud → Mellow and Solo.

### 5. Soundwoods

**Concept:** adapts the classic "A Walk in the Woods" projection test into an imaginary journey through a sound-filled forest. Instead of choosing objects, users make narrative choices about sounds, volume and musical environments: entering a silent forest, weathering a sudden storm, finding an unreleased track. These reveal their baseline mood, how they cope and how they share music, without asking about taste directly.

**How it's scored**
- Each choice nudges four Spotify audio values up or down: **valence** (happiness), **energy**, **acousticness** and **instrumentalness**. Each starts at 50%, and 12 points moves it all the way to 0% or 100%.
- Valence and energy pick the scene:

| | High energy | Low energy |
|---|---|---|
| **High valence** | The Sunlit Clearing | The Firefly Grove |
| **Low valence** | The Thunder Ridge | The Moonlit Lake |

- Extra justification lines appear when acousticness or instrumentalness is 60% or more.
- The result compares the imagined forest's energy with the user's real Spotify energy, e.g. "Your imagined forest is calmer than your actual listening".

**MetaFor traits:** energy → Amped/Mellow, instrumentalness → Soundscaper (low instrumentalness → Wordsmith).

### 6. Maslow’s Mixtape

**Concept:** based on Maslow's Hierarchy of Needs. It maps where music sits in your daily life, from basic utility to self-actualisation. Questions are about priorities: what would happen if you lost music for a week? Would your productivity crash, would you lose your social connections, or would you lose your sense of self? It also looks at the user's playlists to tell functional listening (workout, study, sleep) apart from deep album listening and emotional processing.

**How it's scored**
- Every question has five options, one per level.
- Each of the user's Spotify playlists whose name contains a keyword for a level (e.g. "gym", "study", "sleep", "party", "album", "late night") adds 1 point to that level.
- The level with the most points is the result. The breakdown is listed from the top of the pyramid down.

| Level | Music as |
|---|---|
| 5. Self-actualisation | Self |
| 4. Esteem | Identity |
| 3. Belonging | Connection |
| 2. Safety | Shelter |
| 1. Physiological | Fuel |

**MetaFor traits:** a mix weighted by each level's share. Fuel → Soundscaper and Amped, Shelter → Mellow and Loyalist, Connection → Crowd, Identity → Explorer and Crowd, Self → Wordsmith and Solo.

---

## Patterns

Using all of the user's quiz results plus their Spotify data, Patterns:
- gives a short visual summary,
- decides their overall personality from the six MetaFor types,
- writes a text summary.

### MetaFor traits

Everything is translated into four traits, each scored from −1 to 1 (`server/data/metaforTraits.js`):

| Trait | Positive pole | Negative pole |
|---|---|---|
| Energy | Amped | Mellow |
| Discovery | Explorer | Loyalist |
| Focus | Wordsmith | Soundscaper |
| Setting | Crowd | Solo |

### How the type is chosen

1. **Quizzes:** each trait is the average of that trait across the user's latest result for every quiz that measures it.
2. **Spotify:** the listening data gives its own score for each trait:
   - Energy: the average energy of their top tracks.
   - Discovery: the share of plays that are repeats (more repeats → Loyalist).
   - Focus: the average instrumentalness of their top tracks.
   - Setting: the average danceability of their top tracks.
3. **Blend:** each trait is **70% quizzes + 30% Spotify** (`QUIZ_WEIGHT` and `SPOTIFY_WEIGHT` in `server/services/patterns.js`).
4. **Match:** each MetaFor type has a target profile. The type closest to the user's traits wins, with a match percentage.
5. **AI:** if an LLM is set up, it gets the traits, quiz results, listening stats and mood-log counts. It can pick from the **3 closest** types only, so results stay consistent, and writes the headline, insights and summary. Without an LLM, the closest type is used with fixed text.

The personality is rebuilt and saved every time a quiz is submitted, so the page never calls the LLM on a plain visit.

### The six MetaFor types

Drafts in `server/data/personalityTypes.js`. Each has a name, tagline, longer description, an icon in `client/src/assets/images/personality/types/`, and a target profile.

| Type | Tagline | Profile |
|---|---|---|
| The Storm Chaser | Loud, restless and always hunting the next big sound. | Amped + Explorer |
| The Tide Keeper | Steady, calm and loyal to the songs that hold you. | Mellow + Loyalist |
| The Poet | You hear every word and keep the ones that matter. | Wordsmith + Solo |
| The Daydreamer | Soft textures, headphones on, somewhere far away. | Mellow + Soundscaper + Solo |
| The Spark | Hand you the aux and the room lights up. | Amped + Crowd |
| The Wanderer | No home genre, just the next interesting sound. | Explorer + Soundscaper |

### What the section shows

- **Type card:** "You are a", the type's icon, name, tagline and what the type means.
- **Trait bars:** the four combined traits.
- **Text card:**
  - A headline and one insight per trait.
  - **Mood × music:** the user's most-logged mood next to their tracks' average happiness, e.g. "so your music sounds moodier than you feel".
  - The match percentage.
- **How it adds up:** one row per quiz (its result links to the result page) plus a Spotify row, each with chips for the traits it pushed towards. Dark chips are strong leans. The last row, *All together*, is the combined result. The ⓘ icon explains the 70/30 blend on hover or tap.
- **Summary:** a paragraph under the section, written by the AI, or a sentence listing the quiz results when there is no AI.

### Share card

The **Share card** button in the top-right corner of Patterns opens a pop-up with a story-sized (1080 × 1920) image of the user's personality, in the style of a year-in-review card. It shows their type and icon, tagline, the four traits with their strength, every quiz result, and the match. **Save image** downloads it as `metafor-<type>.png`. On phones that support sharing files, a **Share** button sends it straight to other apps.

- The image is drawn in the browser with the Canvas API (`client/src/utils/shareCard.js`), so there is no extra library and nothing is sent to the server.
- The pop-up is `client/src/components/ShareCardDialog.vue`, a native `<dialog>`. It closes with Esc, the × button or a click outside it.
- The button sits on top of the corner beside the heading instead of taking up its own row, so the Patterns section stays the same size. On phones it shrinks to an icon.

---

## Pages

| Route | View | Shows |
|---|---|---|
| `/quiz` | `views/personality-hub.vue` | Quiz cards and Patterns |
| `/quiz/:quizId` | `views/personality-quiz.vue` | One question per step, birthday step for Spotify Horoscope |
| `/quiz/:quizId/result` | `views/personality-result.vue` | The user's latest result for that quiz |

The design follows the "Personality Test" frame in the team Figma: Raleway headers, Crimson Text body, peach `#ffcda6` and terracotta `#ce5b4b` bars, `#763e32` accents and the gradient Patterns band.

### Card images

Each quiz card has a calm nature photo that hints at the quiz. The photos are from Unsplash (free to use under the [Unsplash License](https://unsplash.com/license)), cropped to 900 × 600 and saved in `client/src/assets/images/personality/`.

| Quiz | Photo | By |
|---|---|---|
| Music MBTI | Light through a glass prism, one light split into many facets | Egor Litvinov |
| Spotify Horoscope | Crystals on a wooden slice | Sarah Brown |
| Aux Alignment | Stones placed around a zen garden, each in its own spot | Jupter Moon |
| Love on Repeat | Ripples spreading on still water | Jackson Hendry |
| Soundwoods | Sunlight through a forest | Łukasz Szmigiel |
| Maslow’s Mixtape | A stack of balanced stones | Sean Stratton |

To change one, replace the PNG with the same name, or add a new import to `quizImages` in `personality-hub.vue`.

---

## API

All under `/api/quiz`. Every request needs MongoDB, and returns `503` if it's unavailable.

| Method and path | Does |
|---|---|
| `GET /api/quiz` | Lists the quizzes, each with its `latestResult` (or `null`) |
| `GET /api/quiz/personality` | The saved MetaFor personality, or `null` before any quiz is taken |
| `GET /api/quiz/:quizId` | A quiz's questions. Option scores stay on the server |
| `GET /api/quiz/:quizId/result` | The latest result for that quiz, or `404` if it hasn't been taken |
| `POST /api/quiz/:quizId/result` | Body `{ answers: { questionId: optionId, birthday? } }`. Saves the attempt, rebuilds Patterns and returns `{ result, personality }`. Returns `400` if a question is unanswered or the birthday is invalid |

---

## Data stored

| Collection | Holds |
|---|---|
| `quizattempts` | `{ userId, quizId, answers, createdAt }`. Only the answers are stored; results are recalculated from them, so fixing a description also updates past results. Indexed on `userId + quizId + createdAt` |
| `personalities` | One per user (unique `userId`): the latest Patterns result, with type, match, traits, quiz results, per-source traits, mood link, listening stats, and the AI's headline, insights and summary. It is rebuilt if a quiz's result title has changed since it was saved |

Both collections are in `server/scripts/db-init.js`, so run `npm run db:init` once to create their indexes. Until login is merged, `userId` is `null` and every query filters on that, so only `currentUserId()` in `quizController.js` needs to change then.

---

## Where the code lives

```
server/
  data/
    metaforTraits.js        the 4 MetaFor traits
    personalityTypes.js     the 6 MetaFor types
    mockSpotify.js          stand-in Spotify data (top artists, tracks, playlists)
    quizzes/
      index.js              list of quizzes, in card order
      musicMbti.js  spotifyHoroscope.js  auxAlignment.js
      loveOnRepeat.js  soundwoods.js  musicalNeeds.js
  services/
    quizEngine.js           answer checking, tallying, shared helpers
    patterns.js             combining traits, ranking types, listening stats, mood link
    quizLlm.js              AI prompt and checks (callLlm is a stub)
  models/QuizAttempt.js     MongoDB models
  controller/quizController.js
  routes/quizRoutes.js
client/src/
  api/quiz.js
  views/personality-hub.vue  personality-quiz.vue  personality-result.vue
  components/TraitBar.vue  PersonalityBreakdown.vue  WaveBackground.vue  ShareCardDialog.vue
  utils/shareCard.js        draws the shareable card
  assets/images/personality/   card images, star and type icons
```

---

## Changing things

**Rename or rewrite a MetaFor type:** edit `server/data/personalityTypes.js`. In `profile`, `1` is a strong lean to the first pole (Amped, Explorer, Wordsmith, Crowd) and `-1` to the second. If you change a type's `id`, also rename its icon in `client/src/assets/images/personality/types/` and update `typeIcons` in `personality-hub.vue`.

**Edit a quiz's questions or result text:** edit its file in `server/data/quizzes/`. Keep question `id`s stable. If an `id` changes, older attempts no longer match the quiz and are skipped until the user retakes it.

**Add a quiz**
1. Create `server/data/quizzes/yourQuiz.js` exporting an object with `id`, `title`, `description`, `dimensions`, `questions` and `evaluate(answers, spotifyProfile)`.
2. Make `evaluate` return:
   - `resultId`, `title`, `subtitle`, `headline`, `description`
   - `justification`: an array of strings
   - `breakdown`: rows from `scaleRow()` or `shareRow()`, or `{ kind: "tag", label, value }`
   - `traits`: an object of MetaFor trait scores from −1 to 1
3. Add it to `QUIZZES` in `server/data/quizzes/index.js`.
4. Optionally add a card image in `quizImages` in `personality-hub.vue`. Without one, the card shows the lilac placeholder.

**Change the blend:** edit `QUIZ_WEIGHT` and `SPOTIFY_WEIGHT` in `server/services/patterns.js`. The ⓘ tooltip reads them automatically.

---

## Setting up the AI

The AI only writes the Patterns text; it never decides a single quiz's result. To turn it on:

1. Pick a provider and fill in `callLlm(prompt)` in `server/services/quizLlm.js`. It should return the model's raw text reply.
2. Put the key in `server/.env` as `LLM_API_KEY`. Never send it to the client.

`buildAnalysisPrompt()` already asks for JSON with `typeId`, `headline`, `insights` and `summary`. `analysePersonality()` checks the reply: the type must be one of the 3 closest, and every text field has a length limit. If anything is wrong, it falls back to the fixed text.

**Safety:** the prompt tells the model to keep things light and for fun, not to diagnose or mention mental health conditions, and not to give advice. If the mood logs are mostly sad, anxious or angry, it may gently say that music seems to be a comfort, without dwelling on it. Bring this to the team's safety discussion.

---

## Waiting on teammates

| Waiting on | What changes |
|---|---|
| Login and accounts (George) | Return the signed-in user's `_id` from `currentUserId()` in `quizController.js`. Only count the signed-in user's mood logs. Read the birthday from the profile and only ask when it's missing |
| Spotify API (Jeriel) | Replace `mockSpotifyProfile` in `quizController.js` with the user's real top artists, tracks, playlists and audio features. The field names already follow the Spotify Web API and ReccoBeats |

**Ideas for later:** card images for the five quizzes that don't have one yet; a spider web chart of the four traits; a shareable Wrapped-style result card.
