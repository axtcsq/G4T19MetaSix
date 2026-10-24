// Sets the browser tab title, like "Mood Calendar · MetaFor". Pages get theirs
// from the route's meta.title; pages named after their data (a quiz) call this
// again once it has loaded.
export function setPageTitle(name) {
  document.title = name ? `${name} · MetaFor` : 'MetaFor'
}
