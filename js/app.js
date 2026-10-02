/*
 * app.js — Console R : R complet dans le navigateur grâce à webR (R compilé en WebAssembly).
 * Éditeur de script + console, graphiques, catalogue et recherche de paquets dans le dépôt webR.
 * Le premier lancement télécharge R (~25 Mo) ; le service worker le garde ensuite en cache.
 */
const WEBR_URLS = ['https://webr.r-wasm.org/v0.6.0/webr.mjs', 'https://webr.r-wasm.org/latest/webr.mjs'];
const HOME = '/home/web_user';
const BASE_PKGS = new Set(['base', 'stats', 'utils', 'graphics', 'grDevices', 'methods', 'datasets', 'tools', 'grid',
  'parallel', 'splines', 'stats4', 'compiler', 'tcltk', 'webr']);

// Exécution côté R : chaque expression est affichée (marque \001), évaluée dans l'environnement global,
// imprimée si visible ; erreurs (\002) et avis (\003) sont écrits aussitôt, comme dans la console R.
const R_HELPERS = String.raw`
local({
  e <- new.env()
  emit <- function(mark, txt) {
    lines <- strsplit(paste(txt, collapse = "\n"), "\n", fixed = TRUE)[[1]]
    cat(paste0(mark, lines, "\n"), sep = "", file = stderr())
  }
  prompt <- function(lines) cat(paste0("\001", ifelse(seq_along(lines) == 1, "> ", "+ "), lines, "\n"), sep = "")
  e$run <- function(code, echo = TRUE, partial = FALSE) {
    exprs <- tryCatch(parse(text = code, keep.source = TRUE), error = function(err) err)
    if (inherits(exprs, "error")) {
      msg <- conditionMessage(exprs)
      if (partial && grepl("unexpected end of input|INCOMPLETE_STRING", msg)) return("incomplete")
      if (echo) prompt(strsplit(code, "\n", fixed = TRUE)[[1]])
      emit("\002", paste0("Erreur de syntaxe : ", sub("^<text>:", "ligne ", msg)))
      return("error")
    }
    srcs <- attr(exprs, "srcref")
    for (i in seq_along(exprs)) {
      if (echo) {
        src <- if (!is.null(srcs)) as.character(srcs[[i]]) else deparse(exprs[[i]])
        prompt(src)
      }
      ok <- withCallingHandlers(
        tryCatch({
          r <- withVisible(eval(exprs[[i]], envir = globalenv()))
          if (r$visible) print(r$value)
          TRUE
        }, error = function(err) {
          call <- conditionCall(err)
          if (identical(call, quote(eval(exprs[[i]], envir = globalenv())))) call <- NULL
          where <- if (is.null(call)) "" else paste0(" dans ", deparse(call, nlines = 1)[1])
          emit("\002", paste0("Erreur", where, " : ", conditionMessage(err)))
          FALSE
        }),
        warning = function(w) {
          call <- conditionCall(w)
          where <- if (is.null(call)) "" else paste0(" dans ", deparse(call, nlines = 1)[1])
          emit("\003", paste0("Avis", where, " : ", conditionMessage(w)))
          invokeRestart("muffleWarning")
        })
      if (!ok) return("error")
    }
    "ok"
  }
  installed <- function(p) nzchar(system.file(package = p))
  e$deps <- function(pkgs) {
    miss <- unique(pkgs[!vapply(pkgs, installed, logical(1))])
    if (!length(miss)) return(invisible())
    message("Installation de ", paste(miss, collapse = ", "), " (une fois par session)…")
    suppressWarnings(try(webr::install(miss), silent = TRUE))
    still <- miss[!vapply(miss, installed, logical(1))]
    if (length(still)) message("Paquet indisponible pour webR : ", paste(still, collapse = ", "))
    invisible()
  }
  # enregistrer("resultats.csv") : envoie un fichier du répertoire de travail sur le téléphone
  e$enregistrer <- function(fichier) {
    if (!file.exists(fichier)) stop("fichier introuvable : ", fichier, call. = FALSE)
    cat("\004", normalizePath(fichier), "\n", sep = "")
    invisible(fichier)
  }
  attach(e, name = "tools:console")
})
try(webr::shim_install(), silent = TRUE)
# Aide (?mean, help(lm)) : le texte de la page d'aide s'affiche dans la console
options(help_type = "text", pager = function(files, header, title, delete.file) {
  for (f in files) cat(gsub("_\b", "", readLines(f, warn = FALSE)), sep = "\n")
  if (isTRUE(delete.file)) unlink(files)
  invisible()
})
`;

const EXAMPLES = [
  ['Premiers pas', `x <- rnorm(200, mean = 10, sd = 2)
summary(x)
hist(x, col = "steelblue", main = "Histogramme")`],
  ['Régression linéaire', `fit <- lm(mpg ~ wt + hp, data = mtcars)
summary(fit)
par(mfrow = c(2, 2))
plot(fit)`],
  ['Tests statistiques', `t.test(extra ~ group, data = sleep)
chisq.test(table(mtcars$cyl, mtcars$am))
shapiro.test(faithful$eruptions)
cor.test(~ Sepal.Length + Petal.Length, data = iris)`],
  ['dplyr : manipuler des données', `library(dplyr)
starwars |>
  filter(!is.na(height), !is.na(mass)) |>
  group_by(species) |>
  summarise(n = n(), taille = mean(height), masse = mean(mass)) |>
  arrange(desc(n)) |>
  head(8)`],
  ['ggplot2 : graphique', `library(ggplot2)
ggplot(mpg, aes(displ, hwy, colour = class)) +
  geom_point() +
  geom_smooth(aes(group = 1), method = "loess", formula = y ~ x) +
  labs(x = "Cylindrée (L)", y = "Consommation autoroute (mpg)") +
  theme_minimal()`],
  ['ACP (FactoMineR)', `library(FactoMineR)
acp <- PCA(iris[, 1:4], graph = FALSE)
acp$eig
plot(acp, choix = "var")
plot(acp, choix = "ind", habillage = "none")`],
  ['Modèle mixte (lme4)', `library(lme4)
m <- lmer(Reaction ~ Days + (Days | Subject), data = sleepstudy)
summary(m)`],
  ['Survie (Kaplan-Meier)', `library(survival)
km <- survfit(Surv(time, status) ~ sex, data = lung)
km
plot(km, col = c("steelblue", "tomato"), xlab = "Jours", ylab = "Survie")
survdiff(Surv(time, status) ~ sex, data = lung)`],
  ['Arbre de décision (rpart)', `library(rpart)
arbre <- rpart(Species ~ ., data = iris)
arbre
plot(arbre, margin = 0.1); text(arbre, use.n = TRUE)`],
  ['Séries temporelles (forecast)', `library(forecast)
fit <- auto.arima(AirPassengers, lambda = 0)
summary(fit)
plot(forecast(fit, h = 24))`],
  ['Monte-Carlo : estimer π', `set.seed(42)
n <- 1e5
x <- runif(n); y <- runif(n)
4 * mean(x^2 + y^2 <= 1)`],
  ['Matrices et algèbre linéaire', `A <- matrix(c(4, 1, 2, 1, 3, 0, 2, 0, 5), 3)
solve(A)
eigen(A)
chol(A)`],
];

// ------------------------------------------------------------------ outils
const $ = (s) => document.querySelector(s);
const store = {
  get(k, d) { try { const v = localStorage.getItem('consoler:' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('consoler:' + k, JSON.stringify(v)); } catch (e) { /* stockage indisponible */ } },
  del(k) { try { localStorage.removeItem('consoler:' + k); } catch (e) { /* idem */ } },
};
const THEMES = ['auto', 'light', 'dark'], THEME_NAMES = { auto: 'auto', light: 'clair', dark: 'sombre' };
let theme = store.get('theme', 'auto');
function applyTheme() {
  if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
  const b = document.getElementById('rc-theme'); if (b) b.textContent = `Thème : ${THEME_NAMES[theme]}`;
}
applyTheme();

const main = $('.rc-main'), out = $('#rc-out'), editor = $('#rc-editor'), input = $('#rc-input');
const statusEl = $('#rc-status');
function status(text, cls) { statusEl.textContent = text; statusEl.className = cls || ''; }

const VIEWS = ['script', 'console', 'hist', 'files', 'pkgs'];
function setView(v) {
  if (!VIEWS.includes(v)) v = 'console';
  main.dataset.view = v;
  document.querySelectorAll('.rc-nav button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === v)));
  $('#rc-keys').hidden = v !== 'script' && v !== 'console';
  if (v === 'pkgs') refreshPkgs();
  if (v === 'hist') renderHistory();
  if (v === 'files') { renderScripts(); refreshRFiles(); }
  store.set('view', v);
  if (v === 'console') scrollEnd();
}
document.querySelectorAll('.rc-nav button').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
const wide = matchMedia('(min-width: 900px)');

// ------------------------------------------------------------------ sortie
const scrollEnd = () => { out.scrollTop = out.scrollHeight; };
function newCell() { const c = document.createElement('div'); c.className = 'rc-cell'; out.appendChild(c); return c; }
function info(html, cell = newCell()) {
  const p = document.createElement('pre'); p.className = 'rc-info'; p.innerHTML = html; cell.appendChild(p); scrollEnd(); return cell;
}
const toSave = [];
function renderOutput(cell, output) {
  let pre = null, cls = null;
  for (const o of output) {
    if (o.type !== 'stdout' && o.type !== 'stderr') continue;
    for (let line of String(o.data).split('\n')) {
      let c = o.type === 'stdout' ? '' : 'rc-msg';
      if (line[0] === '\u0004') { toSave.push(line.slice(1)); continue; }
      if (line[0] === '\u0001') { c = 'rc-echo'; line = line.slice(1); }
      else if (line[0] === '\u0002') { c = 'rc-err'; line = line.slice(1); }
      else if (line[0] === '\u0003') { c = 'rc-warn'; line = line.slice(1); }
      if (!pre || c !== cls) { pre = document.createElement('pre'); if (c) pre.className = c; cls = c; cell.appendChild(pre); pre.textContent = line; }
      else pre.textContent += '\n' + line;
    }
  }
}
function addPlot(cell, bitmap) {
  const cv = document.createElement('canvas');
  cv.width = bitmap.width; cv.height = bitmap.height;
  cv.getContext('2d').drawImage(bitmap, 0, 0);
  bitmap.close?.();
  const img = new Image();
  img.className = 'rc-plot'; img.alt = 'Graphique R (appui long pour enregistrer)';
  img.src = cv.toDataURL('image/png');
  cell.appendChild(img);
  img.addEventListener('load', scrollEnd);
}
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ------------------------------------------------------------------ démarrage de R
let webR = null, ready = null, queue = Promise.resolve();

async function start() {
  status('Téléchargement de R (≈ 25 Mo la première fois)…', 'busy');
  let mod = null, lastErr = null;
  for (const u of WEBR_URLS) { try { mod = await import(u); break; } catch (e) { lastErr = e; } }
  if (!mod) throw lastErr || new Error('webR introuvable');
  webR = new mod.WebR();
  await webR.init();
  status('Préparation…', 'busy');
  await webR.evalRVoid(R_HELPERS);
  await syncWidth();
  status(`R ${webR.versionR || ''} prêt`, 'ok');
  restorePkgs();
  refreshPkgs();
}
function boot() {
  ready = start().catch((e) => {
    status('R n’a pas pu démarrer', 'bad');
    info(`<span class="rc-err">Impossible de charger R : ${esc(String(e && e.message || e))}</span>\n` +
      'Le premier lancement nécessite une connexion internet (R est téléchargé depuis webr.r-wasm.org).\nUne fois chargé, R reste disponible hors ligne.');
    throw e;
  });
  ready.catch(() => {});
}

// Toutes les exécutions passent par une file : R traite une commande à la fois.
function enqueue(fn) {
  const p = queue.then(() => ready).then(async () => {
    status('Calcul en cours…', 'busy');
    try { return await fn(); } finally { status(`R ${webR.versionR || ''} prêt`, 'ok'); }
  });
  queue = p.catch(() => {});
  return p;
}

function detectPkgs(code) {
  const src = code.replace(/#.*$/gm, '');
  const found = new Set();
  for (const m of src.matchAll(/\b(?:library|require|requireNamespace)\s*\(\s*["']?([A-Za-z][A-Za-z0-9.]*)/g)) found.add(m[1]);
  for (const m of src.matchAll(/\b([A-Za-z][A-Za-z0-9.]*):::?/g)) found.add(m[1]);
  return [...found].filter((p) => !BASE_PKGS.has(p));
}

function plotSize() {
  const w = Math.max(420, Math.min(760, Math.round((out.clientWidth - 24) * 1.3)));
  return { width: w, height: Math.round(w * 0.72), bg: 'white' };
}

async function syncWidth() {
  if (!webR) return;
  const probe = document.createElement('pre');
  probe.style.cssText = 'position:absolute;visibility:hidden;margin:0';
  probe.textContent = 'x'.repeat(50);
  out.appendChild(probe);
  const cw = probe.getBoundingClientRect().width / 50;
  probe.remove();
  const avail = (out.clientWidth || 360) - 26;
  const cols = Math.max(32, Math.min(160, Math.floor(avail / (cw || 7.8))));
  await webR.evalRVoid(`options(width = ${cols})`);
}

function runCode(code, { echo = true, partial = false } = {}) {
  return enqueue(async () => {
    const shelter = await new webR.Shelter();
    const c = newCell();
    try {
      const pkgs = detectPkgs(code);
      if (pkgs.length) {
        const d = await shelter.captureR('get("deps", "tools:console")(p)', { env: { p: pkgs }, captureConditions: false, captureGraphics: false });
        renderOutput(c, d.output);
        scrollEnd();
        installedChanged();
      }
      const r = await shelter.captureR('get("run", "tools:console")(code, echo, partial)', {
        env: { code, echo, partial }, captureConditions: false, captureGraphics: plotSize(),
      });
      const res = await r.result.toJs();
      const st = (res && res.values && res.values[0]) || 'ok';
      if (st === 'incomplete') { if (!c.childNodes.length) c.remove(); return st; }
      renderOutput(c, r.output);
      for (const img of r.images || []) addPlot(c, img);
      for (const f of toSave.splice(0)) await saveRFile(f);
      if (!c.childNodes.length) c.remove();
      return st;
    } catch (e) {
      info(`<span class="rc-err">${esc(String(e && e.message || e))}</span>`, c);
      return 'error';
    } finally {
      shelter.purge();
      scrollEnd();
    }
  }).catch(() => 'error'); // R n'a pas démarré : le message est déjà affiché
}

// ------------------------------------------------------------------ éditeur de script
const DEFAULT_SCRIPT = `# R complet dans votre téléphone.
# « Tout exécuter » lance le script ; « Ligne / sélection » la ligne du curseur.
# Les paquets s'installent au premier library() — voir aussi l'onglet Paquets.

data(mtcars)
summary(mtcars[, 1:4])
fit <- lm(mpg ~ wt, data = mtcars)
coef(fit)
plot(mpg ~ wt, data = mtcars, pch = 19, col = "steelblue")
abline(fit, col = "tomato", lwd = 2)
`;
editor.value = store.get('script', DEFAULT_SCRIPT);
let saveT = 0;
editor.addEventListener('input', () => {
  clearTimeout(saveT);
  saveT = setTimeout(() => { store.set('script', editor.value); if (typeof autosaveCurrent === 'function') autosaveCurrent(); }, 400);
});

function runAll() {
  const code = editor.value;
  if (!code.trim()) return;
  if (!wide.matches) setView('console');
  record(code, 'script');
  runCode(code);
}
function runSelection() {
  const { selectionStart: a, selectionEnd: b, value } = editor;
  let code;
  if (a !== b) code = value.slice(a, b);
  else {
    const s = value.lastIndexOf('\n', a - 1) + 1;
    let e = value.indexOf('\n', a); if (e < 0) e = value.length;
    code = value.slice(s, e);
    // avance au début de la ligne suivante, comme Ctrl+Entrée dans RStudio
    const next = Math.min(value.length, e + 1);
    editor.setSelectionRange(next, next);
  }
  if (!code.trim()) return;
  if (!wide.matches) setView('console');
  record(code, 'script');
  runCode(code);
}
$('#rc-run-all').addEventListener('click', runAll);
$('#rc-run-sel').addEventListener('click', runSelection);
editor.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); if (e.shiftKey) runAll(); else runSelection(); }
  else if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); insert(editor, '  '); }
});

// ------------------------------------------------------------------ console interactive
let pending = '';
// Historique : chaque code exécuté (console, script, relance) est gardé avec sa date, 1000 entrées au plus
const journal = store.get('journal', null) || store.get('history', []).map((c) => ({ c, t: 0, s: 'console' }));
const history = journal.map((j) => j.c); // pour ↑/↓ dans la console
let hIdx = history.length;
function record(code, src) {
  code = code.replace(/\s+$/, '');
  if (!code.trim()) return;
  const last = journal[journal.length - 1];
  if (last && last.c === code) { last.t = Date.now(); last.s = src; }
  else { journal.push({ c: code, t: Date.now(), s: src }); history.push(code); }
  if (journal.length > 1000) { journal.splice(0, journal.length - 1000); history.splice(0, history.length - 1000); }
  hIdx = history.length;
  store.set('journal', journal);
}
const ps = $('#rc-ps');
function autoGrow() { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight + 2, innerHeight * 0.3)}px`; }
input.addEventListener('input', autoGrow);

async function submit() {
  const line = input.value;
  if (!line.trim() && !pending) return;
  input.value = ''; autoGrow();
  hIdx = history.length;
  const code = pending ? `${pending}\n${line}` : line;
  const st = await runCode(code, { partial: true });
  if (st === 'incomplete') {
    pending = code; ps.textContent = '+';
    const c = newCell(); const p = document.createElement('pre'); p.className = 'rc-echo';
    p.textContent = code.split('\n').map((l, i) => (i ? '+ ' : '> ') + l).join('\n'); c.appendChild(p); c.dataset.pending = '1'; scrollEnd();
  } else {
    pending = ''; ps.textContent = '>';
    record(code, 'console');
  }
  // l'écho provisoire d'une saisie incomplète est remplacé par celui de l'exécution
  if (st !== 'incomplete') out.querySelectorAll('.rc-cell[data-pending]').forEach((c) => c.remove());
  else out.querySelectorAll('.rc-cell[data-pending]').forEach((c, i, all) => { if (i < all.length - 1) c.remove(); });
}
$('#rc-form').addEventListener('submit', (e) => { e.preventDefault(); submit(); });
function browseHistory(dir) {
  if (!history.length) return;
  hIdx = Math.max(0, Math.min(history.length, hIdx + dir));
  input.value = history[hIdx] ?? ''; autoGrow();
  const n = input.value.length; input.setSelectionRange(n, n);
}
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); submit(); }
  else if (e.key === 'ArrowUp' && !input.value.slice(0, input.selectionStart).includes('\n')) { e.preventDefault(); browseHistory(-1); }
  else if (e.key === 'ArrowDown' && !input.value.slice(input.selectionEnd).includes('\n')) { e.preventDefault(); browseHistory(1); }
  else if (e.key === 'Escape' && pending) { pending = ''; ps.textContent = '>'; out.querySelectorAll('.rc-cell[data-pending]').forEach((c) => c.remove()); }
});

// ------------------------------------------------------------------ barre de touches (mobile)
let target = input;
editor.addEventListener('focus', () => { target = editor; });
input.addEventListener('focus', () => { target = input; });
function insert(el, text, pair) {
  const a = el.selectionStart, b = el.selectionEnd, sel = el.value.slice(a, b);
  const ins = pair ? text + sel + pair : text;
  el.setRangeText(ins, a, b, 'end');
  if (pair && !sel) el.setSelectionRange(a + text.length, a + text.length);
  el.dispatchEvent(new Event('input'));
}
const KEYS = [
  ['⇥', () => insert(target, '  ')], ['<-', () => insert(target, ' <- ')], ['|>', () => insert(target, ' |> ')],
  ['( )', () => insert(target, '(', ')')], [')', () => insert(target, ')')], ['[ ]', () => insert(target, '[', ']')],
  ['{ }', () => insert(target, '{', '}')], ['" "', () => insert(target, '"', '"')], ['$', () => insert(target, '$')],
  ['~', () => insert(target, '~')], ['=', () => insert(target, '=')], [',', () => insert(target, ', ')],
  [':', () => insert(target, ':')], ['#', () => insert(target, '# ')], ['^', () => insert(target, '^')],
  ['↑', () => { if (target === input) browseHistory(-1); }], ['↓', () => { if (target === input) browseHistory(1); }],
  ['⏎', () => { if (target === input) insert(input, '\n'); else insert(editor, '\n'); }],
];
const keysEl = $('#rc-keys');
KEYS.forEach(([label, fn]) => {
  const b = document.createElement('button');
  b.type = 'button'; b.textContent = label;
  b.setAttribute('aria-label', label === '⏎' ? 'Nouvelle ligne' : label === '⇥' ? 'Indentation' : label === '↑' ? 'Historique précédent' : label === '↓' ? 'Historique suivant' : label);
  b.addEventListener('pointerdown', (e) => e.preventDefault()); // garde le clavier ouvert
  b.addEventListener('click', () => { fn(); target.focus(); });
  keysEl.appendChild(b);
});

// ------------------------------------------------------------------ menu outils
const menu = $('#rc-menu'), menuBtn = $('#rc-menu-btn');
function setMenu(open) { menu.hidden = !open; menuBtn.setAttribute('aria-expanded', String(open)); }
menuBtn.addEventListener('click', (e) => { e.stopPropagation(); setMenu(menu.hidden); });
document.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target)) setMenu(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); menuBtn.focus(); } });

const exSel = $('#rc-examples');
EXAMPLES.forEach(([name], i) => { const o = document.createElement('option'); o.value = String(i); o.textContent = name; exSel.appendChild(o); });
exSel.addEventListener('change', () => {
  const ex = EXAMPLES[+exSel.value]; exSel.value = '';
  if (!ex) return;
  editor.value = ex[1]; store.set('script', editor.value);
  setMenu(false); setView('script');
});

$('#rc-upload').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  setMenu(false); setView('console');
  const name = f.name.replace(/[^\w.\-]+/g, '_');
  const buf = new Uint8Array(await f.arrayBuffer());
  try {
    await enqueue(() => webR.FS.writeFile(`${HOME}/${name}`, buf));
    const how = /\.csv$/i.test(name) ? `read.csv("${name}")` : /\.(xlsx?|xls)$/i.test(name) ? `readxl::read_excel("${name}")`
      : /\.rds$/i.test(name) ? `readRDS("${name}")` : /\.(rdata|rda)$/i.test(name) ? `load("${name}")`
      : /\.json$/i.test(name) ? `jsonlite::fromJSON("${name}")` : /\.(sav|dta|sas7bdat)$/i.test(name) ? `haven::read_${/sav$/i.test(name) ? 'sav' : /dta$/i.test(name) ? 'dta' : 'sas'}("${name}")`
      : /\.(dat|txt)$/i.test(name) ? `read.table("${name}")` : `readLines("${name}")`;
    info(`Fichier importé dans le répertoire de travail : <b>${esc(name)}</b> (${(buf.length / 1024).toFixed(1)} Ko)\nPour le lire : <code>${esc(how)}</code>`);
  } catch (err) { info(`<span class="rc-err">Import impossible : ${esc(String(err.message || err))}</span>`); }
});

$('#rc-open-script').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  editor.value = await f.text(); store.set('script', editor.value);
  setCurrent(f.name.replace(/\.(r|txt)$/i, ''));
  setMenu(false); setView('script');
});
$('#rc-clear').addEventListener('click', () => { out.innerHTML = ''; setMenu(false); setView('console'); });
$('#rc-restart').addEventListener('click', async () => {
  setMenu(false); setView('console');
  try { webR && webR.close(); } catch (e) { /* déjà arrêté */ }
  webR = null; queue = Promise.resolve(); pending = ''; ps.textContent = '>';
  info('R redémarré : l’environnement de travail est vide.');
  pkgState.installed = new Set();
  boot();
});

let resizeT = 0;
addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if (webR) enqueue(syncWidth).catch(() => {}); }, 300); });

// ------------------------------------------------------------------ enregistrement sur le téléphone
function toast(msg) {
  const t = document.createElement('div'); t.className = 'rc-toast'; t.textContent = msg; t.setAttribute('role', 'status');
  document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
}
const stamp = () => { const d = new Date(), p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}h${p(d.getMinutes())}`; };
const safeName = (n) => (n || 'sans-titre').trim().replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80) || 'sans-titre';
// Sur téléphone : feuille de partage (Fichiers, Notes, Drive, WhatsApp…) si possible, sinon téléchargement
async function saveFile(name, data, type, { share = true } = {}) {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const touch = matchMedia('(pointer: coarse)').matches;
  if (share && touch && navigator.canShare) {
    try {
      const file = new File([blob], name, { type: blob.type || type });
      if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast(`Enregistré : ${name} (dossier Téléchargements)`);
}
async function saveRFile(path) {
  try {
    const data = await webR.FS.readFile(path);
    await saveFile(path.split('/').pop(), new Blob([data]), 'application/octet-stream', { share: false });
  } catch (e) { toast(`Impossible d’enregistrer ${path}`); }
}

// ------------------------------------------------------------------ historique
const fmtTime = (t) => (t ? new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '');
function dayLabel(t) {
  if (!t) return 'Plus ancien';
  const d = new Date(t), today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((today - new Date(d).setHours(0, 0, 0, 0)) / 864e5);
  return diff === 0 ? 'Aujourd’hui' : diff === 1 ? 'Hier' : d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
const SRC = { console: 'console', script: 'script', relance: 'relancé' };
function renderHistory() {
  const q = $('#hi-q').value.trim().toLowerCase();
  const list = $('#hi-list');
  const items = journal.map((j, i) => ({ ...j, i })).filter((j) => !q || j.c.toLowerCase().includes(q)).reverse();
  $('#hi-count').textContent = journal.length
    ? `${items.length} entrée${items.length > 1 ? 's' : ''}${q ? ' trouvée' + (items.length > 1 ? 's' : '') : ''} · touchez un code pour le voir en entier`
    : 'Aucun code exécuté pour l’instant. Tout ce que vous lancez (console ou script) apparaîtra ici.';
  list.replaceChildren();
  let day = null;
  for (const j of items.slice(0, 300)) {
    const dl = dayLabel(j.t);
    if (dl !== day) { day = dl; const h = document.createElement('div'); h.className = 'hi-day'; h.textContent = dl; list.appendChild(h); }
    const it = document.createElement('div'); it.className = 'hi-item'; it.dataset.i = j.i;
    it.innerHTML = `<div class="hi-meta"><span class="hi-src">${SRC[j.s] || j.s}</span><span>${fmtTime(j.t)}</span></div>
      <pre></pre><div class="hi-btns"><button type="button" data-a="run">▶ Relancer</button><button type="button" class="ghost" data-a="console">Console</button>
      <button type="button" class="ghost" data-a="script">+ Script</button><button type="button" class="ghost" data-a="copy">Copier</button>
      <button type="button" class="ghost" data-a="del" aria-label="Supprimer">✕</button></div>`;
    it.querySelector('pre').textContent = j.c;
    list.appendChild(it);
  }
  if (items.length > 300) list.insertAdjacentHTML('beforeend', `<p class="pk-hint">… ${items.length - 300} entrées plus anciennes : affinez la recherche.</p>`);
}
$('#hi-q').addEventListener('input', renderHistory);
$('#hi-list').addEventListener('click', async (e) => {
  const it = e.target.closest('.hi-item'); if (!it) return;
  const j = journal[+it.dataset.i]; if (!j) return;
  const a = e.target.closest('button')?.dataset.a;
  if (!a) { it.classList.toggle('open'); return; }
  if (a === 'run') { setView('console'); record(j.c, 'relance'); runCode(j.c); }
  else if (a === 'console') { input.value = j.c; autoGrow(); setView('console'); input.focus(); }
  else if (a === 'script') {
    editor.value = editor.value.replace(/\n*$/, '\n\n') + j.c + '\n'; editor.dispatchEvent(new Event('input'));
    setView('script'); toast('Ajouté à la fin du script');
  } else if (a === 'copy') {
    try { await navigator.clipboard.writeText(j.c); toast('Copié'); } catch (err) { toast('Copie impossible'); }
  } else if (a === 'del') {
    journal.splice(+it.dataset.i, 1); history.splice(0, history.length, ...journal.map((x) => x.c)); hIdx = history.length;
    store.set('journal', journal); renderHistory();
  }
});
function historyAsR() {
  return `# Historique Console R — exporté le ${new Date().toLocaleString('fr-FR')}\n\n` +
    journal.map((j) => `# ${j.t ? new Date(j.t).toLocaleString('fr-FR') : ''} (${SRC[j.s] || j.s})\n${j.c}\n`).join('\n');
}
$('#hi-export').addEventListener('click', () => saveFile(`historique_${stamp()}.R`, historyAsR(), 'text/plain'));
$('#hi-clear').addEventListener('click', () => {
  if (!journal.length || !confirm('Effacer tout l’historique ?')) return;
  journal.length = 0; history.length = 0; hIdx = 0; store.set('journal', journal); renderHistory();
});

// ------------------------------------------------------------------ mes scripts, notes, exports
const scripts = store.get('scripts', {}); // { nom: { code, t } }
let current = store.get('current', '');
function setCurrent(name) {
  current = name || ''; store.set('current', current);
  $('#rc-script-name').textContent = current ? `· ${current}` : '';
  $('#fi-name').value = current;
}
function autosaveCurrent() {
  if (current && scripts[current]) { scripts[current] = { code: editor.value, t: Date.now() }; store.set('scripts', scripts); }
}
function renderScripts() {
  const box = $('#fi-scripts');
  const names = Object.keys(scripts).sort((a, b) => scripts[b].t - scripts[a].t);
  box.replaceChildren(...names.map((n) => {
    const r = document.createElement('div'); r.className = 'fi-row' + (n === current ? ' current' : ''); r.dataset.n = n;
    const lines = scripts[n].code.split('\n').length;
    r.innerHTML = `<div class="fi-main"><b></b><small>${n === current ? 'ouvert · ' : ''}${lines} ligne${lines > 1 ? 's' : ''} · ${new Date(scripts[n].t).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</small></div>
      <button type="button" data-a="open">Ouvrir</button><button type="button" class="ghost" data-a="dl" aria-label="Enregistrer sur le téléphone">⤓</button>
      <button type="button" class="ghost" data-a="del" aria-label="Supprimer">✕</button>`;
    r.querySelector('b').textContent = n;
    return r;
  }));
  if (!names.length) box.innerHTML = '<p class="pk-hint">Aucun script enregistré. Donnez un nom ci-dessus puis « Enregistrer ».</p>';
}
$('#fi-save').addEventListener('click', () => {
  const n = safeName($('#fi-name').value);
  if (!$('#fi-name').value.trim()) { $('#fi-name').focus(); return; }
  if (scripts[n] && n !== current && !confirm(`Remplacer le script « ${n} » ?`)) return;
  scripts[n] = { code: editor.value, t: Date.now() }; store.set('scripts', scripts);
  setCurrent(n); renderScripts(); toast(`Script « ${n} » enregistré`);
});
$('#fi-new').addEventListener('click', () => {
  editor.value = ''; store.set('script', ''); setCurrent(''); renderScripts(); setView('script'); editor.focus();
});
$('#fi-scripts').addEventListener('click', (e) => {
  const r = e.target.closest('.fi-row'); const a = e.target.closest('button')?.dataset.a; if (!r || !a) return;
  const n = r.dataset.n;
  if (a === 'open') { editor.value = scripts[n].code; store.set('script', editor.value); setCurrent(n); setView('script'); }
  else if (a === 'dl') saveFile(`${n}.R`, scripts[n].code, 'text/plain');
  else if (a === 'del' && confirm(`Supprimer le script « ${n} » ?`)) {
    delete scripts[n]; store.set('scripts', scripts); if (n === current) setCurrent(''); renderScripts();
  }
});

const notes = $('#fi-notes');
notes.value = store.get('notes', '');
let notesT = 0;
notes.addEventListener('input', () => { clearTimeout(notesT); notesT = setTimeout(() => store.set('notes', notes.value), 300); });

function reportHTML() {
  const body = out.cloneNode(true);
  body.querySelectorAll('[data-pending]').forEach((n) => n.remove());
  const noteHtml = notes.value.trim() ? `<h2>Notes</h2><div class="notes">${esc(notes.value)}</div>` : '';
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Session R ${new Date().toLocaleString('fr-FR')}</title><style>
body{font-family:system-ui,sans-serif;max-width:860px;margin:0 auto;padding:16px;color:#141821;background:#fff}
h1{font-size:20px}h2{font-size:16px;margin-top:24px}pre{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;margin:0;white-space:pre-wrap;overflow-wrap:anywhere}
.rc-cell{padding:6px 0 10px;border-bottom:1px dashed #dcdfe6}.rc-echo{color:#2851c8}.rc-err{color:#b83232}.rc-warn{color:#9a6400}.rc-msg{color:#454c5b}
.rc-info{color:#6f7686;font-family:system-ui,sans-serif}img{max-width:100%;height:auto;border:1px solid #dcdfe6;border-radius:4px;margin:6px 0}
.notes{white-space:pre-wrap;background:#f5f6f8;padding:10px;border-radius:6px}</style></head><body>
<h1>Session R — ${esc(new Date().toLocaleString('fr-FR'))}</h1>${noteHtml}<h2>Console</h2>${body.innerHTML}</body></html>`;
}
const EXPORTS = {
  script: () => saveFile(`${safeName(current || 'script')}.R`, editor.value, 'text/plain'),
  notes: () => saveFile(`notes_${stamp()}.txt`, notes.value, 'text/plain'),
  console: () => saveFile(`console_${stamp()}.txt`, out.innerText, 'text/plain'),
  report: () => saveFile(`rapport_${stamp()}.html`, reportHTML(), 'text/html'),
  history: () => saveFile(`historique_${stamp()}.R`, historyAsR(), 'text/plain'),
  all: () => saveFile(`console-r_sauvegarde_${stamp()}.json`, JSON.stringify({ app: 'console-r', v: 1, t: Date.now(), script: editor.value, scripts, notes: notes.value, journal }, null, 1), 'application/json'),
};
document.querySelectorAll('[data-export]').forEach((b) => b.addEventListener('click', () => EXPORTS[b.dataset.export]()));
$('#fi-import').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (d.app !== 'console-r') throw new Error('format');
    Object.assign(scripts, d.scripts || {}); store.set('scripts', scripts);
    if (d.notes && d.notes !== notes.value) { notes.value = notes.value ? `${notes.value}\n\n${d.notes}` : d.notes; store.set('notes', notes.value); }
    const seen = new Set(journal.map((j) => `${j.t}|${j.c}`));
    for (const j of d.journal || []) if (!seen.has(`${j.t}|${j.c}`)) journal.push(j);
    journal.sort((a, b) => a.t - b.t); history.splice(0, history.length, ...journal.map((j) => j.c)); hIdx = history.length;
    store.set('journal', journal);
    renderScripts(); toast('Sauvegarde restaurée');
  } catch (err) { toast('Fichier de sauvegarde invalide'); }
});

// Fichiers du répertoire de travail de R (write.csv, saveRDS, png…)
async function refreshRFiles() {
  const box = $('#fi-rfiles');
  if (!webR) { box.innerHTML = '<p class="pk-hint">R démarre…</p>'; return; }
  try {
    const rows = await enqueue(async () => {
      const sh = await new webR.Shelter();
      try {
        const r = await sh.evalR('f <- list.files(recursive = TRUE); f <- f[!startsWith(f, ".") & f != "default.profraw"]; i <- file.info(f); keep <- i$size > 0 | f != "Rplots.pdf"; f <- f[keep]; i <- i[keep, ]; data.frame(f = f, s = i$size, t = as.numeric(i$mtime))');
        const j = await r.toJs();
        const col = (n) => j.values[j.names.indexOf(n)].values;
        const f = col('f'), sz = col('s'), t = col('t');
        return f.map((x, k) => ({ f: x, s: sz[k], t: t[k] })).sort((a, b) => b.t - a.t);
      } finally { sh.purge(); }
    });
    box.replaceChildren(...rows.map((r) => {
      const d = document.createElement('div'); d.className = 'fi-row'; d.dataset.f = r.f;
      const kb = r.s < 1024 ? `${r.s} o` : r.s < 1048576 ? `${(r.s / 1024).toFixed(1)} Ko` : `${(r.s / 1048576).toFixed(1)} Mo`;
      d.innerHTML = '<div class="fi-main"><b></b><small></small></div><button type="button" data-a="dl">Enregistrer</button>';
      d.querySelector('b').textContent = r.f; d.querySelector('small').textContent = kb;
      return d;
    }));
    if (!rows.length) box.innerHTML = '<p class="pk-hint">Aucun fichier pour l’instant.</p>';
  } catch (e) { box.innerHTML = '<p class="pk-hint">Liste indisponible.</p>'; }
}
$('#fi-refresh').addEventListener('click', refreshRFiles);
$('#fi-rfiles').addEventListener('click', async (e) => {
  const d = e.target.closest('.fi-row'); if (!d || !e.target.closest('button')) return;
  try { const data = await webR.FS.readFile(`${HOME}/${d.dataset.f}`); await saveFile(d.dataset.f.split('/').pop(), new Blob([data]), 'application/octet-stream'); }
  catch (err) { toast('Lecture du fichier impossible'); }
});
setCurrent(current);

// ------------------------------------------------------------------ paquets
const REPO = 'https://repo.r-wasm.org/';
const CATALOG = [
  ['Manipulation de données', 'tidyverse et compagnie', ['dplyr', 'tidyr', 'tibble', 'purrr', 'stringr', 'forcats', 'lubridate', 'data.table', 'janitor']],
  ['Import / export', 'CSV, Excel, SPSS, Stata, SAS, JSON', ['readr', 'readxl', 'writexl', 'openxlsx', 'haven', 'jsonlite']],
  ['Graphiques', '', ['ggplot2', 'patchwork', 'scales', 'ggrepel', 'GGally', 'corrplot', 'lattice', 'viridisLite']],
  ['Statistique', 'tests, modèles linéaires et généralisés', ['MASS', 'car', 'broom', 'emmeans', 'boot', 'nortest', 'psych', 'Hmisc']],
  ['Modèles avancés', 'mixtes, additifs, survie', ['lme4', 'nlme', 'mgcv', 'survival', 'glmmTMB', 'betareg']],
  ['Économétrie', '', ['AER', 'lmtest', 'sandwich', 'plm', 'fixest', 'ivreg']],
  ['Séries temporelles', '', ['forecast', 'tseries', 'urca', 'zoo', 'xts', 'rugarch']],
  ['Analyse multivariée', 'ACP, AFC, classification', ['FactoMineR', 'factoextra', 'cluster', 'ade4']],
  ['Apprentissage automatique', '', ['rpart', 'randomForest', 'ranger', 'glmnet', 'e1071', 'class', 'nnet', 'caret']],
  ['Actuariat & finance', '', ['actuar', 'ChainLadder', 'lifecontingencies', 'PerformanceAnalytics', 'fitdistrplus', 'copula']],
  ['Texte', '', ['stringi', 'tidytext', 'tm']],
  ['Calcul numérique', '', ['Matrix', 'numDeriv', 'optimx', 'pracma', 'deSolve']],
];
const pkgState = { index: null, installed: new Set(), busy: new Set() };
const wanted = new Set(store.get('pkgs', []));
const restoreBox = $('#pk-restore');
restoreBox.checked = store.get('restore', true);
restoreBox.addEventListener('change', () => store.set('restore', restoreBox.checked));

function chip(name) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'pk-chip'; b.dataset.pkg = name; b.textContent = name;
  const st = pkgState.installed.has(name) ? 'inst' : pkgState.busy.has(name) ? 'busy'
    : pkgState.index && !pkgState.index.has(name) ? 'na' : '';
  if (st) b.classList.add(st);
  const v = pkgState.index && pkgState.index.get(name);
  if (v) { const sm = document.createElement('small'); sm.textContent = v; b.appendChild(sm); }
  b.title = st === 'inst' ? `Charger ${name}` : st === 'na' ? `${name} n’est pas disponible pour webR` : `Installer ${name}`;
  return b;
}
function renderPkgs() {
  const inst = $('#pk-installed');
  inst.replaceChildren(...[...pkgState.installed].sort((a, b) => a.localeCompare(b)).map(chip));
  if (!pkgState.installed.size) inst.innerHTML = `<span class="pk-hint">${webR ? 'Aucun paquet ajouté pour l’instant.' : 'R démarre…'}</span>`;
  $('#pk-catalog').replaceChildren(...CATALOG.map(([title, sub, list]) => {
    const d = document.createElement('div'); d.className = 'pk-cat';
    d.innerHTML = `<h2>${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}`;
    const l = document.createElement('div'); l.className = 'pk-list'; l.append(...list.map(chip));
    d.appendChild(l); return d;
  }));
  search();
}
function search() {
  const q = $('#pk-q').value.trim().toLowerCase();
  const box = $('#pk-results');
  if (!q) { box.hidden = true; return; }
  box.hidden = false;
  const list = $('#pk-res-list');
  if (!pkgState.index) { list.innerHTML = '<span class="pk-hint">Liste du dépôt indisponible (hors ligne ?) : tapez le nom exact puis « Installer ».</span>'; return; }
  const names = [...pkgState.index.keys()].filter((n) => n.toLowerCase().includes(q))
    .sort((a, b) => (b.toLowerCase().startsWith(q) - a.toLowerCase().startsWith(q)) || a.length - b.length || a.localeCompare(b));
  list.replaceChildren(...names.slice(0, 60).map(chip));
  if (!names.length) list.innerHTML = '<span class="pk-hint">Aucun paquet de ce nom dans le dépôt webR.</span>';
  else if (names.length > 60) list.insertAdjacentHTML('beforeend', `<span class="pk-hint">… et ${names.length - 60} autres : précisez la recherche.</span>`);
}
$('#pk-q').addEventListener('input', search);
$('#pk-q').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#pk-go').click(); } });
$('#pk-go').addEventListener('click', () => {
  const q = $('#pk-q').value.trim();
  if (!/^[A-Za-z][A-Za-z0-9.]*$/.test(q)) { $('#pk-q').focus(); return; }
  const exact = pkgState.index && [...pkgState.index.keys()].find((n) => n.toLowerCase() === q.toLowerCase());
  installPkg(exact || q);
});
$('#pk').addEventListener('click', (e) => { const b = e.target.closest('.pk-chip'); if (b && !b.classList.contains('na')) installPkg(b.dataset.pkg); });

async function loadIndex() {
  if (pkgState.index || !webR) return;
  try {
    const ver = String(webR.versionR || '').split('.').slice(0, 2).join('.');
    const res = await fetch(`${REPO}bin/emscripten/contrib/${ver}/PACKAGES`);
    if (!res.ok) return;
    const idx = new Map();
    for (const block of (await res.text()).split(/\n\s*\n/)) {
      const n = /^Package:\s*(\S+)/m.exec(block), v = /^Version:\s*(\S+)/m.exec(block);
      if (n) idx.set(n[1], v ? v[1] : '');
    }
    pkgState.index = idx;
    $('#pk-info').innerHTML = `${idx.size.toLocaleString('fr-FR')} paquets disponibles. Touchez un paquet pour l’installer et le charger (<code>library()</code>).`;
    renderPkgs();
  } catch (e) { /* hors ligne : la recherche par nom exact reste possible */ }
}
async function refreshPkgs() {
  renderPkgs();
  if (!webR) return;
  loadIndex();
  try {
    const names = await enqueue(async () => {
      const sh = await new webR.Shelter();
      try {
        const r = await sh.evalR('ip <- installed.packages(); rownames(ip)[is.na(ip[, "Priority"]) & !rownames(ip) %in% c("webr", "translations")]');
        return (await r.toJs()).values || [];
      } finally { sh.purge(); }
    });
    pkgState.installed = new Set(names);
    renderPkgs();
  } catch (e) { /* R indisponible */ }
}
function installedChanged() { setTimeout(() => refreshPkgs(), 0); }

async function installPkg(name) {
  if (pkgState.busy.has(name)) return;
  pkgState.busy.add(name); renderPkgs();
  $('#pk-info').textContent = `Installation et chargement de ${name}… (détails dans la console)`;
  await runCode(`library(${name})`);
  pkgState.busy.delete(name);
  await refreshPkgs();
  if (pkgState.installed.has(name)) {
    wanted.add(name); store.set('pkgs', [...wanted]);
    $('#pk-info').textContent = `✓ ${name} est installé et chargé.`;
  } else $('#pk-info').textContent = `✗ ${name} n’a pas pu être installé (voir la console).`;
}

function restorePkgs() {
  if (!restoreBox.checked || !wanted.size) return;
  const list = [...wanted];
  enqueue(async () => {
    status('Restauration des paquets…', 'busy');
    const sh = await new webR.Shelter();
    try { await sh.captureR('get("deps", "tools:console")(p)', { env: { p: list }, captureConditions: false, captureGraphics: false }); }
    finally { sh.purge(); }
  }).then(() => { info(`Paquets restaurés : ${esc(list.join(', '))} (à charger avec <code>library()</code>).`); refreshPkgs(); }).catch(() => {});
}

// ------------------------------------------------------------------ thème et installation de l'application
$('#rc-theme').addEventListener('click', () => { theme = THEMES[(THEMES.indexOf(theme) + 1) % 3]; store.set('theme', theme); applyTheme(); });
applyTheme();
let installPrompt = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; $('#rc-install').hidden = false; });
$('#rc-install').addEventListener('click', async () => {
  if (!installPrompt) return;
  installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; $('#rc-install').hidden = true; setMenu(false);
});

// ------------------------------------------------------------------ lancement
if ('serviceWorker' in navigator && isSecureContext) {
  addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
setView(store.get('view', 'console'));
info('Bienvenue dans R. Tapez une commande ci-dessous (ex. <code>summary(iris)</code>) ou ouvrez l’onglet Script. ' +
  'Onglet Paquets : installer ggplot2, dplyr, lme4… Menu ⋯ : exemples, import de fichiers, aide.');
boot();

