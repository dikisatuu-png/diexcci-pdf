(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const state = { tool: "merge", files: [], authMode: "login", user: null, supabase: null };
  const toolInfo = {
    merge: { title: "Merge PDF files", subtitle: "Combine your documents in the order you choose.", multiple: true, button: "Merge & download", note: "Select at least two PDF files. Use the × buttons to remove files." },
    split: { title: "Split PDF", subtitle: "Extract selected pages into a new PDF document.", multiple: false, button: "Split & download", note: "Enter pages such as 1-3, 5. Page numbers start at 1." },
    rotate: { title: "Rotate PDF", subtitle: "Rotate every page in your PDF document.", multiple: false, button: "Rotate & download", note: "All pages in the selected PDF will be rotated." },
    compress: { title: "Optimize PDF", subtitle: "Re-save a PDF using optimized object streams.", multiple: false, button: "Optimize & download", note: "This basic browser optimization may not reduce every PDF. Image-heavy PDFs may need a dedicated compression service." }
  };

  const config = window.DIEXCCI_CONFIG || {};
  const configReady = config.SUPABASE_URL && config.SUPABASE_ANON_KEY &&
    !config.SUPABASE_URL.includes("PASTE_") && !config.SUPABASE_ANON_KEY.includes("PASTE_");
  if (configReady && window.supabase?.createClient) {
    state.supabase = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
    state.supabase.auth.getSession().then(({ data }) => setUser(data.session?.user || null));
    state.supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user || null));
  }

  function setUser(user) {
    state.user = user;
    $("#account-label").textContent = user ? user.email : "Guest mode";
    $("#auth-open").textContent = user ? "Account" : "Sign in";
    $("#signout-button").classList.toggle("hidden", !user);
    $("#auth-submit").classList.toggle("hidden", !!user);
    $("#auth-form").classList.toggle("hidden", !!user);
    $("#auth-title").textContent = user ? "Your account." : (state.authMode === "login" ? "Welcome back." : "Create your account.");
    if (user) $("#auth-message").textContent = "Signed in as " + user.email;
  }

  function setStatus(message, type = "") {
    const el = $("#status"); el.textContent = message; el.className = "status " + type;
  }
  function formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  }
  function safeName(name) { return name.replace(/\.pdf$/i, "").replace(/[^\w\-]+/g, "-").slice(0, 60) || "document"; }
  function addFiles(list) {
    const incoming = [...list].filter(f => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    if (!incoming.length) { setStatus("Please select PDF files only.", "error"); return; }
    const multiple = state.tool === "merge";
    state.files = multiple ? [...state.files, ...incoming] : [incoming[incoming.length - 1]];
    renderFiles(); setStatus("");
  }
  function renderFiles() {
    $("#file-list").innerHTML = "";
    state.files.forEach((file, index) => {
      const item = document.createElement("div"); item.className = "file-item";
      item.innerHTML = `<span class="file-badge">PDF</span><span class="file-meta"><b></b><small></small></span><button class="file-remove" aria-label="Remove file">×</button>`;
      item.querySelector("b").textContent = file.name;
      item.querySelector("small").textContent = formatSize(file.size);
      item.querySelector("button").addEventListener("click", () => { state.files.splice(index, 1); renderFiles(); });
      $("#file-list").appendChild(item);
    });
    const total = state.files.reduce((n, f) => n + f.size, 0);
    $("#file-summary").textContent = state.files.length ? `${state.files.length} file(s) · ${formatSize(total)}` : "No files selected";
    $("#process-button").disabled = state.files.length === 0 || (state.tool === "merge" && state.files.length < 2);
    $("#process-button").innerHTML = state.files.length ? `${toolInfo[state.tool].button} <span>→</span>` : 'Choose PDF files <span>→</span>';
  }
  function selectTool(tool, shouldScroll = true) {
    state.tool = tool; state.files = [];
    const info = toolInfo[tool];
    $$(".tool-card").forEach(c => c.classList.toggle("active", c.dataset.tool === tool));
    $("#workspace-title").textContent = info.title;
    $("#workspace-subtitle").textContent = info.subtitle;
    $("#file-input").multiple = info.multiple;
    $("#file-input").value = "";
    $("#option-note").textContent = info.note;
    $("#tool-options").classList.toggle("hidden", !["split", "rotate", "compress"].includes(tool));
    $("#range-label").classList.toggle("hidden", tool !== "split");
    $("#page-range").classList.toggle("hidden", tool !== "split");
    $("#rotation-label").classList.toggle("hidden", tool !== "rotate");
    $("#rotation").classList.toggle("hidden", tool !== "rotate");
    $("#page-range").value = "";
    renderFiles(); setStatus("");
    if (shouldScroll) $("#workspace").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function parsePageRange(input, total) {
    const pages = new Set();
    for (const part of input.split(",").map(s => s.trim()).filter(Boolean)) {
      const match = part.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
      if (!match) throw new Error("Invalid page range. Example: 1-3, 5");
      const start = Number(match[1]), end = Number(match[2] || match[1]);
      if (start < 1 || end < start || end > total) throw new Error(`Page range must be between 1 and ${total}.`);
      for (let p = start; p <= end; p++) pages.add(p - 1);
    }
    if (!pages.size) throw new Error("Enter at least one page number.");
    return [...pages].sort((a,b) => a-b);
  }
  function downloadBytes(bytes, filename) {
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  async function saveHistory(tool, fileCount, outputName) {
    if (!state.supabase || !state.user) return;
    try {
      await state.supabase.from("pdf_history").insert({
        user_id: state.user.id, tool, file_count: fileCount, output_name: outputName
      });
    } catch (e) { console.warn("History could not be saved:", e); }
  }
  async function processFiles() {
    if (!window.PDFLib) { setStatus("PDF engine is still loading. Please try again in a moment.", "error"); return; }
    if (!state.files.length) return;
    const btn = $("#process-button"); btn.disabled = true; btn.textContent = "Processing…"; setStatus("Processing your PDF locally…");
    try {
      const { PDFDocument, degrees } = window.PDFLib;
      let output, filename;
      if (state.tool === "merge") {
        if (state.files.length < 2) throw new Error("Choose at least two PDF files to merge.");
        const merged = await PDFDocument.create();
        for (const file of state.files) {
          const source = await PDFDocument.load(await file.arrayBuffer());
          const copied = await merged.copyPages(source, source.getPageIndices());
          copied.forEach(page => merged.addPage(page));
        }
        output = await merged.save({ useObjectStreams: true });
        filename = "diexcci-merged.pdf";
      } else {
        const file = state.files[0];
        const source = await PDFDocument.load(await file.arrayBuffer());
        if (state.tool === "split") {
          const selected = parsePageRange($("#page-range").value, source.getPageCount());
          const result = await PDFDocument.create();
          const pages = await result.copyPages(source, selected);
          pages.forEach(page => result.addPage(page));
          output = await result.save({ useObjectStreams: true });
          filename = safeName(file.name) + "-split.pdf";
        } else if (state.tool === "rotate") {
          const angle = Number($("#rotation").value);
          source.getPages().forEach(page => page.setRotation(degrees((page.getRotation().angle + angle) % 360)));
          output = await source.save({ useObjectStreams: true });
          filename = safeName(file.name) + "-rotated.pdf";
        } else {
          output = await source.save({ useObjectStreams: true, objectsPerTick: 50 });
          filename = safeName(file.name) + "-optimized.pdf";
        }
      }
      downloadBytes(output, filename);
      await saveHistory(state.tool, state.files.length, filename);
      setStatus(`Done! ${filename} has been downloaded.`, "success");
    } catch (error) {
      console.error(error); setStatus(error.message || "Something went wrong while processing the PDF.", "error");
    } finally {
      btn.disabled = false; renderFiles();
    }
  }

  // Auth modal and optional Supabase account.
  function openAuth() { $("#auth-modal").classList.remove("hidden"); }
  function closeAuth() { $("#auth-modal").classList.add("hidden"); }
  function setAuthMode(mode) {
    state.authMode = mode;
    $$(".auth-tab").forEach(t => t.classList.toggle("selected", t.dataset.mode === mode));
    $("#auth-title").textContent = mode === "login" ? "Welcome back." : "Create your account.";
    $("#auth-submit").innerHTML = (mode === "login" ? "Sign in" : "Create account") + " <span>→</span>";
    $("#auth-message").textContent = "";
  }
  $("#auth-form").addEventListener("submit", async e => {
    e.preventDefault();
    if (!state.supabase) { $("#auth-message").textContent = "Add your Supabase URL and Publishable Key in js/config.js first."; return; }
    const email = $("#auth-email").value.trim(), password = $("#auth-password").value;
    $("#auth-submit").disabled = true; $("#auth-message").textContent = "Please wait…";
    try {
      const result = state.authMode === "login"
        ? await state.supabase.auth.signInWithPassword({ email, password })
        : await state.supabase.auth.signUp({ email, password });
      if (result.error) throw result.error;
      $("#auth-message").textContent = state.authMode === "signup" ? "Account created. Check your email if confirmation is enabled." : "Signed in successfully.";
      if (result.data.user) setUser(result.data.session?.user || result.data.user);
    } catch (err) { $("#auth-message").textContent = err.message; }
    finally { $("#auth-submit").disabled = false; }
  });
  $("#signout-button").addEventListener("click", async () => {
    if (state.supabase) await state.supabase.auth.signOut();
    setUser(null); $("#auth-message").textContent = "You are signed out.";
  });
  $("#auth-open").addEventListener("click", openAuth);
  $$("[data-close-modal]").forEach(el => el.addEventListener("click", closeAuth));
  $$(".auth-tab").forEach(el => el.addEventListener("click", () => setAuthMode(el.dataset.mode)));
  $$(".tool-card").forEach(el => el.addEventListener("click", () => selectTool(el.dataset.tool)));
  $("#browse-files").addEventListener("click", () => $("#file-input").click());
  $("#file-input").addEventListener("change", e => addFiles(e.target.files));
  $("#process-button").addEventListener("click", processFiles);
  const dz = $("#dropzone");
  ["dragenter", "dragover"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add("dragover"); }));
  ["dragleave", "drop"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove("dragover"); }));
  dz.addEventListener("drop", e => addFiles(e.dataTransfer.files));
  $("#year").textContent = new Date().getFullYear();
  selectTool("merge", false);
  if (!configReady) console.info("Supabase is not configured yet. PDF tools work in guest mode.");
})();
