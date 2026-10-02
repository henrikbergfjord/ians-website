const universe = document.querySelector('.universe');
const toggle = document.querySelector('.orbit-toggle');
toggle?.addEventListener('click', () => {
  const paused = universe.classList.toggle('paused');
  toggle.setAttribute('aria-pressed', String(paused));
  toggle.textContent = paused ? 'Start bevegelse' : 'Pause bevegelse';
});
