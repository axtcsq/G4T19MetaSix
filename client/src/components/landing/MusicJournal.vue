<script setup>
import { onBeforeUnmount, ref } from 'vue'
import ButterflyMark from '@/components/layout/ButterflyMark.vue'

// "Spotify + journal" on the landing page. The button merges them into the
// MetaFor butterfly with a burst of notes; pulling them apart brings it back.
const merged = ref(false)

function merge() {
  merged.value = true
}

function pullApart() {
  merged.value = false
}
</script>

<template>
  <section class="music-journal landing-shell" aria-label="Spotify and journal">
    <button v-if="!merged" type="button" class="journal-button" @click="merge">
      Drag Spotify into your journal
    </button>

    <div v-else class="merged" role="status">
      <div class="burst" aria-hidden="true">
        <span v-for="index in 8" :key="index" :style="{ '--angle': `${index * 45}deg` }">{{ index % 2 ? '♪' : '♫' }}</span>
      </div>
      <ButterflyMark class="merged-mark" :size="84" />
      <p class="merged-text">Your music + your words = <strong>MetaFor</strong></p>
      <button type="button" class="hint" @click="pullApart">Pull them apart</button>
    </div>
  </section>
</template>

<style scoped>
.music-journal {
  display: flex;
  min-height: 110px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-block: 8px 32px;
}
/* One quiet pill: an outline that lights up in the brand colour on hover. */
.journal-button {
  min-height: 44px;
  padding: 0 22px;
  border: 1px solid var(--ui-border);
  border-radius: 999px;
  color: var(--ui-text);
  background: var(--ui-bg-elevated);
  font-family: var(--font-sans);
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 180ms ease, color 180ms ease;
}
.journal-button:hover {
  border-color: var(--ui-primary);
  color: var(--ui-primary);
}
.journal-button:focus-visible {
  outline: 3px solid var(--color-brand-400);
  outline-offset: 3px;
}

.merged {
  position: relative;
  display: flex;
  min-height: 150px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  color: var(--ui-primary);
}
.merged-mark {
  animation: grow 520ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
.merged-text {
  margin: 0;
  color: var(--ui-text);
  font-family: var(--font-serif);
  font-size: var(--text-body);
  animation: rise 500ms ease 200ms both;
}
.merged-text strong {
  color: var(--ui-primary);
  font-family: var(--font-sans);
}
/* Notes fly out in a ring from behind the butterfly. */
.burst {
  position: absolute;
  top: 40%;
  left: 50%;
  pointer-events: none;
}
.burst span {
  position: absolute;
  font-size: 1.6rem;
  opacity: 0;
  animation: burst 1100ms ease-out forwards;
}
.hint {
  padding: 4px 8px;
  border: 0;
  border-radius: 6px;
  color: var(--ui-primary);
  background: transparent;
  font-family: var(--font-sans);
  font-size: 0.74rem;
  cursor: pointer;
}
.hint:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}
.hint:focus-visible {
  outline: 3px solid var(--color-brand-400);
}

@keyframes grow {
  from {
    opacity: 0;
    transform: scale(0.3) rotate(-12deg);
  }
}
@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}
@keyframes burst {
  0% {
    opacity: 1;
    transform: translate(-50%, -50%) rotate(var(--angle)) translateY(0) rotate(calc(-1 * var(--angle))) scale(0.6);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) rotate(var(--angle)) translateY(-130px) rotate(calc(-1 * var(--angle))) scale(1.1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .merged-mark,
  .merged-text,
  .burst {
    animation: none;
  }
}
</style>
