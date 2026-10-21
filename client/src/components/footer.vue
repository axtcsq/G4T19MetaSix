<template>
  <footer class="site-footer">
    <div class="footer-inner">© MetaFor</div>
  </footer>
</template>

<style scoped>
/* Room for the floating listening dock, so it never covers the footer text. */
.site-footer {
  min-height: 64px;
  padding-bottom: var(--dock-space, 0px);
  color: #fff;
  background: #000;
  font-family: var(--font-sans);
  font-size: 0.9rem;
}

.footer-inner {
  display: flex;
  width: min(1110px, calc(100% - 56px));
  min-height: 64px;
  align-items: center;
  margin-inline: auto;
}

@media (max-width: 700px) {
  .footer-inner {
    width: calc(100% - 36px);
  }
}
</style>
