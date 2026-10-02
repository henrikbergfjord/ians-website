(() => {
  const gallery = document.querySelector('#gallery-dialog');
  const area = document.querySelector('#area-dialog');
  const image = document.querySelector('#gallery-image');
  const caption = document.querySelector('#gallery-caption');
  const pictures = [
    ['maimyra-66.jpg', 'Rekkehusene – prosjektillustrasjon'],
    ['maimyra-hero.jpg', 'Maimyra og Brattholmen – prosjektillustrasjon'],
    ['maimyra-omrade.jpg', 'Boliger og uteområde – prosjektillustrasjon'],
    ['maimyra-66-2.jpg', 'Fasader og fellesområde – prosjektillustrasjon'],
    ['maimyra-66-eksterior.jpg', 'Eksteriør – prosjektillustrasjon']
  ];
  let index = 0;
  function showPicture(next) {
    index = (next + pictures.length) % pictures.length;
    image.src = '/assets/maimyra/' + pictures[index][0];
    image.alt = pictures[index][1];
    caption.textContent = `${index + 1} / ${pictures.length} · ${pictures[index][1]}`;
  }
  document.querySelectorAll('[data-gallery], [data-open-gallery]').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      showPicture(Number(button.dataset.gallery || 0));
      gallery.showModal();
    });
  });
  document.querySelector('#previous-image').addEventListener('click', () => showPicture(index - 1));
  document.querySelector('#next-image').addEventListener('click', () => showPicture(index + 1));
  gallery.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      showPicture(index + (event.key === 'ArrowLeft' ? -1 : 1));
    }
  });
  document.querySelector('[data-open-area]').addEventListener('click', () => area.showModal());
  [gallery, area].forEach(dialog => {
    dialog.querySelector('.close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
  });
})();
