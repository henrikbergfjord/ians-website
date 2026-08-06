/* Enkel passordlås for Academy */

.academy-lock{
  position:fixed;
  inset:0;
  z-index:9999;
  display:grid;
  place-items:center;
  padding:20px;
  background:
    radial-gradient(circle at top left, rgba(139,124,255,.13), transparent 30%),
    radial-gradient(circle at top right, rgba(121,169,255,.10), transparent 25%),
    linear-gradient(180deg, var(--bg), var(--bg2));
}

.academy-lock-card{
  width:min(440px, 100%);
  padding:30px;
  border:1px solid var(--line);
  border-radius:var(--radius);
  background:var(--panel);
  box-shadow:0 24px 60px rgba(0,0,0,.45);
}

.academy-lock-logo{
  margin-bottom:20px;
}

.academy-lock-card h1{
  margin-bottom:12px;
  font-size:2rem;
}

.academy-lock-card form{
  display:grid;
  gap:12px;
  margin-top:24px;
}

.academy-lock-card label{
  color:var(--text);
  font-size:.85rem;
  font-weight:800;
}

.academy-lock-card input{
  width:100%;
  padding:14px 16px;
  border:1px solid var(--line);
  border-radius:12px;
  outline:none;
  color:var(--text);
  background:rgba(255,255,255,.05);
  font:inherit;
}

.academy-lock-card input:focus{
  border-color:rgba(121,169,255,.60);
  box-shadow:0 0 0 4px rgba(121,169,255,.10);
}

.academy-lock-card .button{
  width:100%;
  margin-top:4px;
}

.academy-lock-error{
  min-height:20px;
  margin:0;
  color:var(--danger);
  font-size:.86rem;
}