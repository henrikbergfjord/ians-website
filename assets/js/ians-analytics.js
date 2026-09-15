/*
 * IANS Analytics
 * Førsteparts, anonym sidevisningsstatistikk for ians.no.
 * Ingen cookies, bruker-ID eller fingerprinting.
 */
(() => {
  if (
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1"
  ) return;

  let path = location.pathname || "/";

  // Normaliser /index.html til katalog-URL.
  if (path === "/index.html") {
    path = "/";
  } else if (path.endsWith("/index.html")) {
    path = path.slice(0, -"index.html".length);
  }

  // Interne/systemrelaterte sider skal ikke inngå
  // i vanlig IANS besøksstatistikk.
  const excluded = [
    /admin/i,
    /login/i,
    /tilgang/i,
    /registrer/i,
    /dashboard/i,
    /styre/i,
    /teknisk/i,
    /personvern/i,
    /old/i
  ];

  if (excluded.some((rule) => rule.test(path))) return;

  fetch("/api/page-view", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ path }),
    keepalive: true,
    credentials: "same-origin"
  }).catch(() => {});
})();
