// Leonida Trophy Guide: checklist, roadmap and cited guides for GTA VI on PS5.
// All data comes from data/trophies.json, a file of this app; nothing is fetched
// from the network. Progress is kept in localStorage and can be exported/imported.
const STORAGE_KEY = 'gta6-trophy-guide-v1';

const listEl = document.getElementById('list');
const detailEl = document.getElementById('detail');
const roadmapEl = document.getElementById('roadmap');
const searchEl = document.getElementById('search');
const kindEl = document.getElementById('kind');
const gradeEl = document.getElementById('grade');
const missableEl = document.getElementById('missable-only');
const spoilerEl = document.getElementById('spoiler');
const showingEl = document.getElementById('showing-count');
const progressText = document.getElementById('progress-text');
const progressFill = document.getElementById('progress-fill');
const progressGrades = document.getElementById('progress-grades');
const progressPlatinum = document.getElementById('progress-platinum');

const doc = await (await fetch('data/trophies.json')).json();
const trophies = doc.trophies;
const stages = doc.roadmap_stages || [];
const byId = new Map(trophies.map((t) => [t.id, t]));

let earned = new Set();
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  const ids = Array.isArray(saved) ? saved : saved.earned;
  if (Array.isArray(ids)) for (const id of ids) if (byId.has(id)) earned.add(id);
} catch {
  earned = new Set();
}
let selectedId = null;
let view = 'checklist';

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...earned].sort((a, b) => a - b)));
}

function isHidden(trophy) {
  return spoilerEl.checked && trophy.kind === 'story' && !earned.has(trophy.id);
}

function displayName(trophy) {
  return isHidden(trophy) ? 'Hidden story trophy' : trophy.name;
}

function displayDescription(trophy) {
  return isHidden(trophy)
    ? 'Hidden until earned — tick it off to reveal its name and description.'
    : trophy.description;
}

function gradeLabel(grade) {
  return grade[0].toUpperCase() + grade.slice(1);
}

function badge(text, cls) {
  const s = document.createElement('span');
  s.className = 'badge ' + cls;
  s.textContent = text;
  return s;
}

function toggleEarned(id) {
  if (earned.has(id)) earned.delete(id);
  else earned.add(id);
  saveProgress();
  renderAll();
}

function makeCheckbox(trophy) {
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = earned.has(trophy.id);
  box.setAttribute('aria-label', 'Earned: ' + displayName(trophy));
  box.addEventListener('change', () => toggleEarned(trophy.id));
  return box;
}

function trophyCard(trophy) {
  const card = document.createElement('article');
  card.className = 'card' + (earned.has(trophy.id) ? ' earned' : '');
  card.dataset.id = String(trophy.id);

  const head = document.createElement('div');
  head.className = 'card-head';
  head.append(makeCheckbox(trophy));
  const name = document.createElement('h3');
  name.textContent = displayName(trophy);
  head.append(name);
  card.append(head);

  const tags = document.createElement('p');
  tags.className = 'tags';
  tags.append(badge(gradeLabel(trophy.grade), 'grade-' + trophy.grade));
  tags.append(badge(trophy.kind, 'kind'));
  if (trophy.missable) tags.append(badge('MISSABLE', 'missable'));
  tags.append(badge('Stage ' + trophy.stage, 'stage'));
  card.append(tags);

  const desc = document.createElement('p');
  desc.className = 'official';
  desc.textContent = displayDescription(trophy);
  card.append(desc);

  const actions = document.createElement('div');
  actions.className = 'card-actions';
  const guideBtn = document.createElement('button');
  guideBtn.type = 'button';
  guideBtn.textContent = isHidden(trophy) ? 'Guide hidden until earned' : 'Read guide';
  guideBtn.disabled = isHidden(trophy);
  guideBtn.addEventListener('click', () => selectTrophy(trophy.id));
  actions.append(guideBtn);
  card.append(actions);
  return card;
}

function filteredTrophies() {
  const q = searchEl.value.trim().toLowerCase();
  return trophies.filter((t) => {
    if (kindEl.value !== 'all' && t.kind !== kindEl.value) return false;
    if (gradeEl.value !== 'all' && t.grade !== gradeEl.value) return false;
    if (missableEl.checked && !t.missable) return false;
    if (q && !(t.name + ' ' + t.description + ' ' + t.guide + ' ' + t.kind).toLowerCase().includes(q)) return false;
    return true;
  });
}

function renderList() {
  const shown = filteredTrophies();
  listEl.replaceChildren();
  for (const t of shown) listEl.append(trophyCard(t));
  if (!shown.length) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = 'No trophies match these filters.';
    listEl.append(p);
  }
  showingEl.textContent = `Showing ${shown.length} of ${trophies.length} trophies · ${earned.size} earned`;
}

function renderDetail() {
  detailEl.replaceChildren();
  const trophy = selectedId === null ? null : byId.get(selectedId);
  if (!trophy) {
    const p = document.createElement('p');
    p.className = 'detail-empty';
    p.textContent = 'Select a trophy to read its guide and sources.';
    detailEl.append(p);
    return;
  }
  const hidden = isHidden(trophy);

  const title = document.createElement('h2');
  title.textContent = displayName(trophy);
  detailEl.append(title);

  const tags = document.createElement('p');
  tags.className = 'tags';
  tags.append(badge(gradeLabel(trophy.grade), 'grade-' + trophy.grade));
  tags.append(badge(trophy.kind, 'kind'));
  if (trophy.missable) tags.append(badge('MISSABLE', 'missable'));
  tags.append(badge('Stage ' + trophy.stage, 'stage'));
  detailEl.append(tags);

  const officialLabel = document.createElement('p');
  officialLabel.className = 'label';
  officialLabel.textContent = 'Official description (PlayStation)';
  detailEl.append(officialLabel);
  const desc = document.createElement('p');
  desc.className = 'official';
  desc.textContent = displayDescription(trophy);
  detailEl.append(desc);

  if (hidden) {
    const note = document.createElement('p');
    note.className = 'hidden-note';
    note.textContent = 'This is a story trophy and the spoiler setting is on. Its guide stays hidden until you earn it — tick the box to reveal it.';
    detailEl.append(note);
  } else {
    const guideLabel = document.createElement('p');
    guideLabel.className = 'label';
    guideLabel.textContent = 'Guide (our own words)';
    detailEl.append(guideLabel);
    const guide = document.createElement('p');
    guide.className = 'guide';
    guide.textContent = trophy.guide;
    detailEl.append(guide);

    const sourcesLabel = document.createElement('p');
    sourcesLabel.className = 'label';
    sourcesLabel.textContent = 'Sources';
    detailEl.append(sourcesLabel);
    const sources = document.createElement('ul');
    sources.className = 'sources';
    for (const s of trophy.sources || []) {
      const li = document.createElement('li');
      li.textContent = s;
      sources.append(li);
    }
    detailEl.append(sources);
  }

  const stage = stages.find((s) => s.stage === trophy.stage);
  if (stage) {
    const road = document.createElement('p');
    road.className = 'roadmap-note';
    road.textContent = `Roadmap: Stage ${stage.stage} — ${stage.name}. ${stage.note}`;
    detailEl.append(road);
  }

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'earned-toggle';
  toggle.textContent = earned.has(trophy.id) ? 'Mark as not earned' : 'Mark as earned';
  toggle.addEventListener('click', () => toggleEarned(trophy.id));
  detailEl.append(toggle);
}

function renderRoadmap() {
  roadmapEl.replaceChildren();
  showingEl.textContent = `Roadmap: ${trophies.length} trophies in ${stages.length} stages · ${earned.size} earned`;
  const intro = document.createElement('p');
  intro.className = 'roadmap-intro';
  intro.textContent = 'Earn the trophies stage by stage. Stage 1 is the story — its trophies are tied to single chapters and missions, so do them when they run. Stages 2 and 3 have no story window: counts and collectibles can be finished at any time. Stage 4 is the cleanup.';
  roadmapEl.append(intro);
  for (const stage of stages) {
    const block = document.createElement('section');
    block.className = 'roadmap-stage';
    const heading = document.createElement('h2');
    const done = trophies.filter((t) => t.stage === stage.stage && earned.has(t.id)).length;
    const total = trophies.filter((t) => t.stage === stage.stage).length;
    heading.textContent = `Stage ${stage.stage} — ${stage.name} (${done}/${total})`;
    block.append(heading);
    const note = document.createElement('p');
    note.className = 'roadmap-note';
    note.textContent = stage.note;
    block.append(note);
    const items = document.createElement('ol');
    items.className = 'roadmap-items';
    for (const t of trophies.filter((x) => x.stage === stage.stage)) {
      const li = document.createElement('li');
      li.className = earned.has(t.id) ? 'done' : '';
      li.append(makeCheckbox(t));
      const name = document.createElement('span');
      name.className = 'roadmap-name';
      name.textContent = displayName(t);
      li.append(name);
      li.append(badge(gradeLabel(t.grade), 'grade-' + t.grade));
      if (t.missable) li.append(badge('MISSABLE', 'missable'));
      if (!isHidden(t)) {
        const open = document.createElement('button');
        open.type = 'button';
        open.className = 'link-button';
        open.textContent = 'Guide';
        open.addEventListener('click', () => {
          selectTrophy(t.id);
          setView('checklist');
        });
        li.append(open);
      }
      items.append(li);
    }
    block.append(items);
    roadmapEl.append(block);
  }
}

function renderProgress() {
  progressText.textContent = `${earned.size} / ${trophies.length}`;
  progressFill.style.width = `${(earned.size / trophies.length) * 100}%`;
  const counts = {};
  for (const t of trophies) {
    counts[t.grade] = counts[t.grade] || [0, 0];
    counts[t.grade][1] += 1;
    if (earned.has(t.id)) counts[t.grade][0] += 1;
  }
  progressGrades.textContent = ['platinum', 'gold', 'silver', 'bronze']
    .map((g) => `${gradeLabel(g)} ${counts[g][0]}/${counts[g][1]}`)
    .join(' · ');
  const platinum = trophies.find((t) => t.grade === 'platinum');
  progressPlatinum.textContent = platinum && earned.has(platinum.id)
    ? 'Platinum: earned — Leonida Legend!'
    : 'Platinum: locked — earn the other 54 trophies';
}

function renderAll() {
  renderProgress();
  if (view === 'checklist') {
    renderList();
    renderDetail();
  } else {
    renderRoadmap();
  }
}

function selectTrophy(id) {
  selectedId = id;
  renderDetail();
  detailEl.scrollIntoView({ block: 'nearest' });
}

function setView(next) {
  view = next;
  document.getElementById('tab-checklist').classList.toggle('active', next === 'checklist');
  document.getElementById('tab-roadmap').classList.toggle('active', next === 'roadmap');
  listEl.hidden = next !== 'checklist';
  detailEl.hidden = next !== 'checklist';
  roadmapEl.hidden = next !== 'roadmap';
  renderAll();
}

document.getElementById('tab-checklist').addEventListener('click', () => setView('checklist'));
document.getElementById('tab-roadmap').addEventListener('click', () => setView('roadmap'));
for (const el of [searchEl, kindEl, gradeEl, missableEl, spoilerEl]) {
  el.addEventListener('input', () => { if (view === 'checklist') renderAll(); else renderRoadmap(); });
}

document.getElementById('export').addEventListener('click', () => {
  const payload = { game: 'Grand Theft Auto VI', earned: [...earned].sort((a, b) => a - b), exportedAt: new Date().toISOString() };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  a.download = 'gta6-trophy-progress.json';
  a.click();
  URL.revokeObjectURL(a.href);
});

document.getElementById('import').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const ids = Array.isArray(parsed) ? parsed : parsed.earned;
    if (!Array.isArray(ids)) throw new Error('no earned list in file');
    const next = new Set();
    for (const id of ids) if (byId.has(id)) next.add(id);
    earned = next;
    saveProgress();
    renderAll();
  } catch (err) {
    alert('That file is not a trophy progress export: ' + err.message);
  }
  e.target.value = '';
});

renderAll();
