let isRewriting = false;

document.addEventListener("DOMContentLoaded", () => {
  requireAuth();
  document.getElementById("logout-btn")?.addEventListener("click", logout);
  document.getElementById("rewrite-btn")?.addEventListener("click", rewrite);
});

async function rewrite() {
  if (isRewriting) return;

  const draft = document.getElementById("draft-input").value.trim();
  const context = document.getElementById("context-input").value.trim();
  const errorBox = document.getElementById("form-error");
  const resultBox = document.getElementById("result");
  const btn = document.getElementById("rewrite-btn");

  errorBox.style.display = "none";

  if (!draft) {
    errorBox.textContent = "Paste a message first.";
    errorBox.style.display = "block";
    return;
  }

  isRewriting = true;
  btn.disabled = true;
  btn.textContent = "Rewriting…";
  resultBox.innerHTML = '<span class="placeholder">Thinking about the best way to say this…</span>';

  try {
    const res = await authFetch("/api/message-coach", {
      method: "POST",
      body: JSON.stringify({ draft, context }),
    });
    const data = await safeJson(res);

    if (!res.ok || !data.result) {
      resultBox.innerHTML = '<span class="placeholder">Nothing here yet.</span>';
      errorBox.textContent = data.error || "Something went wrong. Please try again.";
      errorBox.style.display = "block";
      return;
    }

    resultBox.textContent = data.result;
  } catch (err) {
    resultBox.innerHTML = '<span class="placeholder">Nothing here yet.</span>';
    errorBox.textContent = "Couldn't connect to the server.";
    errorBox.style.display = "block";
  } finally {
    isRewriting = false;
    btn.disabled = false;
    btn.textContent = "Rewrite it";
  }
}
