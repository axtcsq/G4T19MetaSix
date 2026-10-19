<script setup>
import { onBeforeUnmount, ref } from 'vue'
import { canvasToBlob, drawShareCard } from '@/utils/shareCard'

// A pop-up that draws the user's personality as a story-sized card they can
// save or share. It floats over the page, so it never changes the layout.
const props = defineProps({
  personality: { type: Object, required: true },
  icon: { type: String, required: true },
})

const dialog = ref(null)
const imageUrl = ref('')
const isDrawing = ref(false)
const error = ref('')
const shareMessage = ref('')
let imageFile = null

const fileName = () => `metafor-${props.personality.type.id}.png`

function clearImage() {
  if (imageUrl.value) URL.revokeObjectURL(imageUrl.value)
  imageUrl.value = ''
  imageFile = null
}

async function open() {
  dialog.value.showModal()
  clearImage()
  error.value = ''
  shareMessage.value = ''
  isDrawing.value = true

  try {
    const blob = await canvasToBlob(await drawShareCard(props.personality, props.icon))
    imageFile = new File([blob], fileName(), { type: 'image/png' })
    imageUrl.value = URL.createObjectURL(blob)
  } catch (drawError) {
    error.value = drawError.message
  } finally {
    isDrawing.value = false
  }
}

function close() {
  dialog.value.close()
}

// Phones can share the image straight to other apps; elsewhere it downloads.
const canShareFiles = () =>
  Boolean(imageFile && navigator.canShare?.({ files: [imageFile] }))

async function share() {
  shareMessage.value = ''
  try {
    await navigator.share({
      files: [imageFile],
      title: 'My MetaFor personality',
      text: `I'm ${props.personality.type.name} on MetaFor.`,
    })
  } catch (shareError) {
    // Closing the share sheet isn't an error.
    if (shareError.name !== 'AbortError') shareMessage.value = 'Sharing failed. Try saving it instead.'
  }
}

defineExpose({ open })
onBeforeUnmount(clearImage)
</script>

<template>
  <dialog
    ref="dialog"
    class="share-dialog"
    aria-labelledby="share-dialog-title"
    @close="clearImage"
    @click.self="close"
  >
    <div class="share-panel">
      <div class="share-header">
        <h2 id="share-dialog-title" class="share-title">Your personality card</h2>
        <button type="button" class="close-button" aria-label="Close" @click="close">×</button>
      </div>

      <div class="share-preview">
        <p v-if="isDrawing" role="status" class="share-status">Making your card...</p>
        <p v-else-if="error" role="alert" class="share-status">{{ error }}</p>
        <img
          v-else-if="imageUrl"
          :src="imageUrl"
          :alt="`Personality card: ${personality.type.name}, ${personality.type.tagline}`"
          class="share-image"
        />
      </div>

      <div class="share-actions">
        <a
          class="share-button"
          :class="{ 'is-disabled': !imageUrl }"
          :href="imageUrl || undefined"
          :download="fileName()"
          :aria-disabled="!imageUrl"
        >
          Save image
        </a>
        <button
          v-if="canShareFiles()"
          type="button"
          class="share-button share-button--quiet"
          @click="share"
        >
          Share
        </button>
      </div>
      <p v-if="shareMessage" role="alert" class="share-note">{{ shareMessage }}</p>
    </div>
  </dialog>
</template>

<style scoped>
.share-dialog {
  width: min(420px, calc(100% - 32px));
  max-height: calc(100dvh - 32px);
  margin: auto;
  padding: 0;
  border: 1px solid rgba(118, 62, 50, 0.4);
  border-radius: 18px;
  color: #000;
  background: #fff;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
}

.share-dialog::backdrop {
  background: rgba(26, 24, 36, 0.65);
}

.share-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.25rem;
}

.share-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.share-title {
  font-family: var(--font-sans);
  font-size: 1.3rem;
  font-weight: 700;
}

.close-button {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  font-size: 1.8rem;
  line-height: 1;
  cursor: pointer;
}

.close-button:hover {
  background: rgba(118, 62, 50, 0.08);
}

/* Keeps the 9:16 shape while the card is being drawn. */
.share-preview {
  display: grid;
  aspect-ratio: 9 / 16;
  max-height: calc(100dvh - 220px);
  margin-inline: auto;
  overflow: hidden;
  border-radius: 12px;
  background: linear-gradient(160deg, #665f78, #ce5b4b 55%, #763e32);
  place-items: center;
}

.share-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.share-status {
  padding: 1rem;
  color: #fff;
  font-family: var(--font-serif);
  font-size: 1.15rem;
  text-align: center;
}

.share-actions {
  display: flex;
  gap: 0.75rem;
}

.share-button {
  display: flex;
  flex: 1;
  min-height: 48px;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(118, 62, 50, 0.2);
  border-radius: 10px;
  color: #000;
  background: #ffe6d2;
  box-shadow: 0 4px 4px rgba(0, 0, 0, 0.25);
  font-family: var(--font-serif);
  font-size: 1.2rem;
  text-decoration: none;
  cursor: pointer;
}

.share-button:hover {
  background: #ffd6b6;
}

.share-button--quiet {
  background: #fff;
}

.share-button.is-disabled {
  opacity: 0.5;
  pointer-events: none;
}

.share-button:focus-visible,
.close-button:focus-visible {
  outline: 3px solid rgba(206, 91, 75, 0.45);
  outline-offset: 2px;
}

.share-note {
  color: #a1352a;
  font-family: var(--font-sans);
  font-size: 0.9rem;
}
</style>
