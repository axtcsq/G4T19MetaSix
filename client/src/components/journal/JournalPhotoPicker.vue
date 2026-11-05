<script setup>
import { ref } from 'vue'

// Pick an optional photo for the journal entry. The photo is shrunk here,
// before it's sent, so the server only ever stores a small JPEG.
const photo = defineModel({ type: String, default: null })
// True while a photo is still being shrunk, so the page waits before saving.
const reading = defineModel('reading', { type: Boolean, default: false })

// The longest side once shrunk, and the most the saved photo may weigh.
const MAX_SIDE = 1280
const MAX_BYTES = 450_000

const photoError = ref('')

// A data URL's size in bytes, from its base64 length.
const bytesOf = (dataUrl) => Math.ceil(((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4)

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('This photo couldn’t be opened. Try a JPEG or PNG.'))
    }
    image.src = url
  })
}

// Draws the photo smaller and saves it as a JPEG, lowering the quality until
// it fits. Browsers turn phone photos the right way up when drawing them.
async function shrink(file) {
  const image = await loadImage(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(image.naturalWidth * scale)
  canvas.height = Math.round(image.naturalHeight * scale)
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
  for (let quality = 0.82; quality >= 0.4; quality -= 0.1) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality)
    if (bytesOf(dataUrl) <= MAX_BYTES) return dataUrl
  }
  throw new Error('This photo is too detailed to save. Try another one.')
}

async function choose(event) {
  const [file] = event.target.files
  // Clearing the input lets the same photo be picked again after removing it.
  event.target.value = ''
  if (!file) return
  photoError.value = ''
  // Some photos come without a type, so only a different kind of file is
  // turned away here; the browser opening it is the real check.
  if (file.type && !file.type.startsWith('image/')) {
    photoError.value = 'Pick an image file.'
    return
  }
  reading.value = true
  try {
    photo.value = await shrink(file)
  } catch (error) {
    photoError.value = error.message
  } finally {
    reading.value = false
  }
}

function remove() {
  photo.value = null
}
</script>

<template>
  <div class="photo-picker">
    <figure v-if="photo" class="picked-photo">
      <img :src="photo" alt="The photo for this entry" />
      <button type="button" class="remove-photo" @click="remove">Remove</button>
    </figure>

    <label v-else class="photo-drop" :class="{ 'is-reading': reading }">
      <input class="sr-only" type="file" accept="image/*" :disabled="reading" @change="choose" />
      <span v-if="reading" class="spin-ring" aria-hidden="true" />
      <svg v-else viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
        <circle cx="12" cy="13" r="3.5" />
      </svg>
      <span>{{ reading ? 'Getting your photo ready…' : 'Choose a photo or take one' }}</span>
    </label>
    <p v-if="photoError" role="alert" class="photo-status text-error">{{ photoError }}</p>
  </div>
</template>

<style scoped>
.photo-picker {
  font-family: var(--font-sans);
}
.photo-drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 140px;
  padding: 20px;
  border: 1.5px dashed var(--ui-border-accented);
  border-radius: 16px;
  color: var(--ui-text-muted);
  background: var(--ui-bg-elevated);
  font: 600 var(--text-label) var(--font-sans);
  cursor: pointer;
  transition:
    border-color 160ms ease,
    color 160ms ease;
}
.photo-drop:hover,
.photo-drop:focus-within {
  border-color: var(--ui-primary);
  color: var(--ui-primary);
}
.photo-drop:focus-within {
  outline: 2px solid var(--ui-primary);
  outline-offset: 3px;
}
.photo-drop.is-reading {
  cursor: progress;
}
.photo-drop svg {
  width: 32px;
  height: 32px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linejoin: round;
}
.picked-photo {
  position: relative;
  width: fit-content;
  max-width: 100%;
  margin: 0;
}
.picked-photo img {
  display: block;
  max-width: 100%;
  max-height: 320px;
  border-radius: 14px;
  object-fit: cover;
}
.remove-photo {
  position: absolute;
  top: 10px;
  right: 10px;
  padding: 6px 14px;
  border-radius: 999px;
  color: #fff;
  background: rgb(0 0 0 / 55%);
  font: 600 var(--text-label) var(--font-sans);
  cursor: pointer;
}
.remove-photo:hover {
  background: rgb(0 0 0 / 75%);
}
.remove-photo:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
}
.photo-status {
  margin: 10px 4px 0;
  font-size: var(--text-label);
}
</style>
