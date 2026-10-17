const universe = document.querySelector('.universe');
const toggle = document.querySelector('.orbit-toggle');
toggle?.addEventListener('click', () => {
  const paused = universe.classList.toggle('paused');
  toggle.setAttribute('aria-pressed', String(paused));
  const english = document.documentElement.lang === 'en';
  toggle.textContent = english ? (paused ? 'Resume motion' : 'Pause motion') : (paused ? 'Start bevegelse' : 'Pause bevegelse');
});
