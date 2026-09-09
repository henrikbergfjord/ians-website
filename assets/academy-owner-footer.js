(() => {
  'use strict';

  const path = location.pathname.toLowerCase();
  if (!path.startsWith('/academy/')) return;

  const existingContact = [...document.querySelectorAll('section, article, div, main')].find(el => {
    const heading = el.querySelector?.('h1,h2,h3');
    return heading && /kontakt teknisk ansvarlig/i.test(heading.textContent || '');
  });
  if (existingContact) existingContact.remove();

  document.querySelectorAll('footer').forEach(footer => footer.remove());
  document.getElementById('academy-owner-footer')?.remove();

  const footer = document.createElement('footer');
  footer.id = 'academy-owner-footer';
  footer.innerHTML = `
    <div class="academy-owner-footer__inner">
      <div class="academy-owner-footer__mark">HB</div>
      <div class="academy-owner-footer__copy">
        <strong>Laget og utarbeidet av Henrik Bergfjord</strong>
        <span>IANS Academy · Personlig læringsportal</span>
      </div>
      <div class="academy-owner-footer__contact">
        <a href="mailto:henrik.bergfjord@outlook.com">henrik.bergfjord@outlook.com</a>
        <a href="tel:+4793002067">+47 930 02 067</a>
      </div>
    </div>`;

  const style = document.createElement('style');
  style.textContent = `
    #academy-owner-footer{margin-top:56px;border-top:1px solid rgba(118,211,255,.16);background:rgba(5,15,27,.82);color:#eef7ff}
    .academy-owner-footer__inner{width:min(1180px,calc(100% - 40px));margin:0 auto;padding:28px 0;display:grid;grid-template-columns:auto 1fr auto;gap:16px;align-items:center}
    .academy-owner-footer__mark{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;font-weight:900;letter-spacing:.04em;background:linear-gradient(135deg,rgba(83,205,255,.22),rgba(126,105,255,.22));border:1px solid rgba(118,211,255,.25)}
    .academy-owner-footer__copy{display:grid;gap:4px}.academy-owner-footer__copy strong{font-size:.95rem}.academy-owner-footer__copy span{font-size:.82rem;color:rgba(238,247,255,.58)}
    .academy-owner-footer__contact{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px 16px}.academy-owner-footer__contact a{color:#bfeaff;text-decoration:none;font-size:.86rem}.academy-owner-footer__contact a:hover{text-decoration:underline;color:#fff}
    @media(max-width:720px){.academy-owner-footer__inner{grid-template-columns:auto 1fr}.academy-owner-footer__contact{grid-column:1/-1;justify-content:flex-start;padding-left:60px}}
  `;
  document.head.appendChild(style);
  document.body.appendChild(footer);
})();
