(() => {
  const PASSWORD = "Kraft2026";
  const STORAGE_KEY = "academy_authenticated";

  if (sessionStorage.getItem(STORAGE_KEY) === "true") {
    return;
  }

  document.documentElement.style.visibility = "hidden";

  document.addEventListener("DOMContentLoaded", () => {
    document.documentElement.style.visibility = "visible";

    const overlay = document.createElement("div");
    overlay.className = "academy-lock";

    overlay.innerHTML = `
      <div class="academy-lock-card">
        <div class="brand-mark academy-lock-logo"></div>

        <span class="kicker">Privat læringsportal</span>

        <h1>Statnett Academy</h1>

        <p class="muted">
          Skriv inn passordet for å åpne læringsportalen.
        </p>

        <form id="academyLoginForm">
          <label for="academyPassword">Passord</label>

          <input
            id="academyPassword"
            type="password"
            autocomplete="current-password"
            placeholder="Skriv inn passord"
            required
          >

          <p id="academyLoginError" class="academy-lock-error"></p>

          <button class="button primary" type="submit">
            Åpne Academy
          </button>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);

    const form = document.getElementById("academyLoginForm");
    const input = document.getElementById("academyPassword");
    const error = document.getElementById("academyLoginError");

    if (!form || !input || !error) {
      return;
    }

    input.focus();

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      if (input.value === PASSWORD) {
        sessionStorage.setItem(STORAGE_KEY, "true");
        overlay.remove();
        return;
      }

      error.textContent = "Feil passord. Prøv igjen.";
      input.value = "";
      input.focus();
    });
  });
})();