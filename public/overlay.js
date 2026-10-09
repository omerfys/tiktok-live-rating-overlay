// TikTok Live Studio Retro Pixel Rating Overlay Script
const socket = io();

// DOM Elements
const overlayScreen = document.getElementById('overlay-screen');
const topCenterWidget = document.getElementById('top-center-widget');
const leftVotersContainer = document.getElementById('left-voters-container');
const mainPromptBox = document.getElementById('main-prompt-box');
const promptTextEl = document.getElementById('prompt-text');
const urgencyAlertBox = document.getElementById('urgency-alert-box');
const urgencyTextEl = document.getElementById('urgency-text');
const resultOverlayBox = document.getElementById('result-overlay-box');
const resultParticlesEl = document.getElementById('result-particles');

const headerCategoryEl = document.getElementById('header-category');
const headerTimeEl = document.getElementById('header-time');
const headerVotesEl = document.getElementById('header-votes');
const headerScoreEl = document.getElementById('header-score');

const top3PodiumBox = document.getElementById('top3-podium-box');
const top3CardsRow = document.getElementById('top3-cards-row');

const raffleContainer = document.getElementById('raffle-container');
const raffleTrack = document.getElementById('raffle-track');

const candidateProfileBox = document.getElementById('candidate-profile-box');
const candidateAvatarImg = document.getElementById('candidate-avatar-img');
const candidateUsernameEl = document.getElementById('candidate-username');
const candidateStatsEl = document.getElementById('candidate-stats');

const bottomTimerBar = document.getElementById('bottom-timer-bar');
const bottomTimerNum = document.getElementById('bottom-timer-num');

const rightVotesBadge = document.getElementById('right-votes-badge');
const rightVotesCount = document.getElementById('right-votes-count');

const raconKraliWidget = document.getElementById('racon-krali-widget');
const raconListEl = document.getElementById('racon-list');

const resultIconEl = document.getElementById('result-icon');
const resultTitleEl = document.getElementById('result-title');
const resultSubtitleEl = document.getElementById('result-subtitle');
const resultScoreNumEl = document.getElementById('result-score-num');
const resultVotesCountEl = document.getElementById('result-votes-count');

// State
let appConfig = {
  roundDuration: 20,
  resultDisplayDuration: 2.5,
  soundEnabled: true
};

let autoHideTimeout = null;
let currentRoundState = 'idle';

// Parse Widget Mode from Query Params or Path (Supports /leaderboard.html, /score.html, /urgency.html, /racon.html, etc.)
const urlParams = new URLSearchParams(window.location.search);
const pathName = window.location.pathname.toLowerCase();
const cleanPath = pathName.replace(/^\//, '').replace(/\.html$/, '');
const pathParts = cleanPath.split('/').filter(Boolean);

let rawMode = (urlParams.get('widget') || urlParams.get('mode') || urlParams.get('view') || '').toLowerCase().trim();

if (!rawMode) {
  if (pathParts.length === 1 && pathParts[0] !== 'overlay' && pathParts[0] !== 'admin') {
    rawMode = pathParts[0]; // e.g. "leaderboard", "score", "urgency", "prompt", "top3", "racon"
  } else if (pathParts.length >= 2 && pathParts[0] === 'overlay') {
    rawMode = pathParts[1]; // e.g. "overlay/top3", "overlay/racon"
  }
}

// Normalize canonical widget mode
function getCanonicalWidgetMode(raw) {
  if (!raw || raw === 'all' || raw === 'full') return 'full';
  if (['racon', 'racon_krali', 'raconkrali', 'racon-krali', 'kral', 'racon_siralamasi'].includes(raw)) return 'racon';
  if (['top3', 'podium', 'ilk3', 'top_three', 'topthree', 'en_cok', 'encok'].includes(raw)) return 'top3';
  if (['leaderboard', 'voters', 'votes', 'feed', 'sol', 'liste', 'chat_votes'].includes(raw)) return 'leaderboard';
  if (['score', 'top', 'header', 'puan', 'ust', 'stats'].includes(raw)) return 'score';
  if (['prompt', 'question', 'title', 'soru', 'baslik', 'banner'].includes(raw)) return 'prompt';
  if (['top_prompt', 'score_prompt', 'header_prompt', 'puan_soru', 'header_title'].includes(raw)) return 'top_prompt';
  if (['urgency', 'alert', 'uyari', 'aciliyet', 'countdown'].includes(raw)) return 'urgency';
  if (['result', 'verdict', 'sonuc', 'karar', 'winner'].includes(raw)) return 'result';
  if (['raffle', 'cekilis', 'lottery', 'roulette', 'cark', 'kasa', 'rulet'].includes(raw)) return 'raffle';
  return 'full';
}

const widgetMode = getCanonicalWidgetMode(rawMode);
console.log(`[OVERLAY] Aktif Widget Modu: "${widgetMode}" (Girdi: "${rawMode}")`);

// Mark body with widget mode for CSS targeting
document.body.classList.add(`widget-mode-${widgetMode}`);
if (widgetMode !== 'full') {
  document.body.classList.add('standalone-widget');
}

// Check which components are allowed in this widget mode
function isComponentAllowed(comp) {
  if (widgetMode === 'full') return comp !== 'top3' && comp !== 'racon'; // standalone widgets
  if (widgetMode === 'racon') return comp === 'racon';
  if (widgetMode === 'top3') return comp === 'top3';
  if (widgetMode === 'leaderboard') return comp === 'voters';
  if (widgetMode === 'score') return comp === 'score';
  if (widgetMode === 'prompt') return comp === 'prompt';
  if (widgetMode === 'top_prompt') return comp === 'score' || comp === 'prompt';
  if (widgetMode === 'urgency') return comp === 'urgency';
  if (widgetMode === 'result') return comp === 'result';
  if (widgetMode === 'raffle') return comp === 'raffle' || comp === 'candidate';
  return false;
}

// Unicode Styled Font & Fancy Nickname Cleaner Map
const UNICODE_STYLE_MAP = {
  // Small Caps
  '\u1D00': 'A', '\u0299': 'B', '\u1D04': 'C', '\u1D05': 'D', '\u1D07': 'E',
  '\u0262': 'G', '\u029C': 'H', '\u026A': 'I', '\u1D0A': 'J', '\u1D0B': 'K',
  '\u029F': 'L', '\u1D0D': 'M', '\u0274': 'N', '\u1D0F': 'O', '\u1D18': 'P',
  '\u01EB': 'Q', '\u0280': 'R', '\uA731': 'S', '\u1D1B': 'T', '\u1D1C': 'U',
  '\u1D20': 'V', '\u1D21': 'W', '\u028F': 'Y', '\u1D22': 'Z',
  'ғ': 'F', 'ꜰ': 'F', 'ǫ': 'Q', 'ʏ': 'Y', 'ᴢ': 'Z', 'ꜱ': 'S',

  // Superscript & Subscript numbers
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',

  // Superscript letters
  'ᵃ': 'a', 'ᵇ': 'b', 'ᶜ': 'c', 'ᵈ': 'd', 'ᵉ': 'e', 'ᶠ': 'f', 'ᵍ': 'g', 'ʰ': 'h', 'ⁱ': 'i', 'ʲ': 'j',
  'ᵏ': 'k', 'ˡ': 'l', 'ᵐ': 'm', 'ⁿ': 'n', 'ᵒ': 'o', 'ᵖ': 'p', 'ʳ': 'r', 'ˢ': 's', 'ᵗ': 't', 'ᵘ': 'u',
  'ᵛ': 'v', 'ʷ': 'w', 'ˣ': 'x', 'ʸ': 'y', 'ᶻ': 'z',

  // Circled numbers & Dingbat numbers
  '➊': '1', '➋': '2', '➌': '3', '➍': '4', '➎': '5', '➏': '6', '➐': '7', '➑': '8', '➒': '9', '➓': '10',
  '⓵': '1', '⓶': '2', '⓷': '3', '⓸': '4', '⓹': '5', '⓺': '6', '⓻': '7', '⓼': '8', '⓽': '9', '⓾': '10',
  '①': '1', '②': '2', '③': '3', '④': '4', '⑤': '5', '⑥': '6', '⑦': '7', '⑧': '8', '⑨': '9', '⑩': '10',
  '❶': '1', '❷': '2', '❸': '3', '❹': '4', '❺': '5', '❻': '6', '❼': '7', '❽': '8', '❾': '9', '❿': '10',
  '🔟': '10',

  // Negative Circled A-Z (U+1F150 to U+1F169)
  '🅐': 'A', '🅑': 'B', '🅒': 'C', '🅓': 'D', '🅔': 'E', '🅕': 'F', '🅖': 'G', '🅗': 'H', '🅘': 'I', '🅙': 'J',
  '🅚': 'K', '🅛': 'L', '🅜': 'M', '🅝': 'N', '🅞': 'O', '🅟': 'P', '🅠': 'Q', '🅡': 'R', '🅢': 'S', '🅣': 'T',
  '🅤': 'U', '🅥': 'V', '🅦': 'W', '🅧': 'X', '🅨': 'Y', '🅩': 'Z',

  // Negative Squared A-Z (U+1F170 to U+1F189)
  '🅰': 'A', '🅱': 'B', '🅲': 'C', '🅳': 'D', '🅴': 'E', '🅵': 'F', '🅶': 'G', '🅷': 'H', '🅸': 'I', '🅹': 'J',
  '🅺': 'K', '🅻': 'L', '🅼': 'M', '🅽': 'N', '🅾': 'O', '🅿': 'P', '🆀': 'Q', '🆁': 'R', '🆂': 'S', '🆃': 'T',
  '🆄': 'U', '🆅': 'V', '🆆': 'W', '🆇': 'X', '🆈': 'Y', '🆉': 'Z'
};

function sanitizeNickname(input, fallbackUsername = 'İzleyici') {
  if (!input || typeof input !== 'string') {
    return String(fallbackUsername || 'İzleyici').replace(/^@/, '').trim() || 'İzleyici';
  }

  let str = input;

  // 1. Remove BiDi / RTL / LTR override, zero-width, non-printable control characters
  str = str.replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\u00AD\u0000-\u001F\u007F-\u009F]/g, '');

  // 2. Custom mapped special character conversion (Small caps, negative circled/squared, special dingbats)
  for (const [key, val] of Object.entries(UNICODE_STYLE_MAP)) {
    if (str.includes(key)) {
      str = str.split(key).join(val);
    }
  }

  // 3. Unicode NFKC Normalization (Mathematical bold/italic/script/fraktur/double-struck, fullwidth, circled)
  str = str.normalize('NFKC');

  // 4. Anti-Zalgo: Strip excessive stacking combining diacritical marks (keep max 1 per base char)
  str = str.replace(/([\u0300-\u036F\u1AB0-\u1AFF\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F]){2,}/g, '$1');

  // 5. Trim whitespace and collapse multiple spaces
  str = str.replace(/\s+/g, ' ').trim();

  // If nickname was purely invisible chars or became empty, fallback to clean username
  if (!str) {
    return String(fallbackUsername || 'İzleyici').replace(/^@/, '').trim() || 'İzleyici';
  }

  return str;
}

// Dynamic Retro Pixel Avatar Generator (Ensures every chatter always has a unique, colorful retro icon)
function getRetroAvatarFallback(username, nickname) {
  const cleanName = sanitizeNickname(nickname || username || 'Oy Veren', username);
  
  // Safe Unicode Initial Extraction (Handles surrogate pairs, Turkish letters, and emojis)
  let initial = '?';
  const match = cleanName.match(/[a-zA-Z0-9çÇğĞıİöÖşŞüÜ]/);
  if (match) {
    initial = match[0].toUpperCase();
  } else {
    const chars = Array.from(cleanName);
    if (chars.length > 0) {
      initial = chars[0].toUpperCase();
    }
  }

  const colors = ['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
  let hash = 0;
  for (let i = 0; i < cleanName.length; i++) {
    hash = cleanName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const bg = colors[Math.abs(hash) % colors.length];
  
  return `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'><rect width='64' height='64' rx='10' fill='${encodeURIComponent(bg)}'/><text x='50%' y='56%' dominant-baseline='middle' text-anchor='middle' font-family='monospace' font-size='32' font-weight='900' fill='%23ffffff'>${encodeURIComponent(initial)}</text></svg>`;
}

const DEFAULT_SAMPLE_TOP3 = [
  {
    rank: 1,
    userKey: 'ahmet_zafer',
    username: 'ahmet_zafer',
    nickname: 'Ahmet Zafer',
    avatar: '',
    voteCount: 5,
    maxRounds: 5,
    lastScore: 10,
    currentRoundScore: null
  },
  {
    rank: 2,
    userKey: 'zeynep_kaya',
    username: 'zeynep_kaya',
    nickname: 'Zeynep Kaya',
    avatar: '',
    voteCount: 4,
    maxRounds: 5,
    lastScore: 9,
    currentRoundScore: null
  },
  {
    rank: 3,
    userKey: 'efe_can81',
    username: 'efe_can81',
    nickname: 'Efe Can',
    avatar: '',
    voteCount: 3,
    maxRounds: 5,
    lastScore: 8,
    currentRoundScore: null
  }
];

let currentTopVoter = null;
let currentTop3Voters = [];

// Render or Update Top 3 Voters Podium Widget with FLIP Animation & Rank Transitions
function renderTop3Widget(top3List) {
  if (!top3CardsRow) return;

  const validList = (Array.isArray(top3List) && top3List.length > 0) ? top3List : [];
  currentTop3Voters = validList.length > 0 ? validList : (currentTop3Voters.length > 0 ? currentTop3Voters : DEFAULT_SAMPLE_TOP3);

  if (isComponentAllowed('top3') && top3PodiumBox) {
    top3PodiumBox.classList.remove('hidden');
    top3PodiumBox.style.display = 'flex';
  }

  // 1. Measure previous positions and state of existing cards (FLIP: First)
  const prevData = new Map();
  for (const child of Array.from(top3CardsRow.children)) {
    const key = child.dataset.userKey;
    if (key) {
      prevData.set(key, {
        rect: child.getBoundingClientRect(),
        rank: parseInt(child.dataset.rank, 10) || 0,
        voteCount: parseInt(child.dataset.voteCount, 10) || 0,
        element: child
      });
    }
  }

  // 2. Prepare new cards (FLIP: Last)
  const newCards = [];
  const currentKeys = new Set();

  for (let rank = 1; rank <= 3; rank++) {
    const voter = (currentTop3Voters && currentTop3Voters[rank - 1]) || DEFAULT_SAMPLE_TOP3[rank - 1];
    const cleanUser = voter ? String(voter.username || voter.userKey || `user_${rank}`).replace(/^@/, '').toLowerCase() : `user_${rank}`;
    currentKeys.add(cleanUser);

    const rawDisplayName = voter ? (voter.nickname || voter.username || `Kullanıcı ${rank}`) : `Kullanıcı ${rank}`;
    const displayName = sanitizeNickname(rawDisplayName, cleanUser);
    const voteCount = voter ? (voter.voteCount !== undefined && voter.voteCount !== null ? voter.voteCount : (rank === 1 ? 5 : (rank === 2 ? 4 : 3))) : (rank === 1 ? 5 : (rank === 2 ? 4 : 3));

    const letterAvatar = getRetroAvatarFallback(cleanUser, displayName);
    let avatarSrc = letterAvatar;
    if (voter && voter.avatar && typeof voter.avatar === 'string' && voter.avatar.trim().startsWith('http') && !voter.avatar.includes('unsplash.com')) {
      avatarSrc = voter.avatar.trim();
    }

    const prev = prevData.get(cleanUser);
    let card;
    let rankChanged = false;
    let voteIncreased = false;
    let becameFirst = false;

    if (prev && prev.element) {
      card = prev.element;
      rankChanged = (prev.rank !== rank && prev.rank > 0);
      voteIncreased = (voteCount > prev.voteCount && prev.voteCount > 0);
      becameFirst = (rank === 1 && prev.rank > 1);
    } else {
      card = document.createElement('div');
      card.className = `top3-card rank-${rank} card-enter`;
      card.innerHTML = `
        <div class="top3-avatar-wrap">
          <div class="top3-badge">${rank}</div>
          <img class="top3-avatar" src="${escapeHtml(avatarSrc)}" alt="" onerror="this.onerror=null;this.src='${escapeHtml(getRetroAvatarFallback(displayName, displayName))}'" />
        </div>
        <div class="top3-footer">
          <span class="top3-votes-pill">${escapeHtml(String(voteCount))} Oy</span>
        </div>
      `;
    }

    // Update dataset and classes
    card.dataset.userKey = cleanUser;
    card.dataset.rank = rank;
    card.dataset.voteCount = voteCount;
    card.className = `top3-card rank-${rank}`;

    // Update Avatar if changed
    const imgEl = card.querySelector('.top3-avatar');
    if (imgEl && imgEl.getAttribute('src') !== avatarSrc) {
      imgEl.src = avatarSrc;
    }

    // Update Badge with Pop animation on rank change
    const badgeEl = card.querySelector('.top3-badge');
    if (badgeEl) {
      badgeEl.textContent = rank;
      if (rankChanged) {
        badgeEl.classList.remove('badge-pop');
        void badgeEl.offsetWidth; // Force reflow
        badgeEl.classList.add('badge-pop');
      }
    }

    // Update Vote Pill with Bump animation on vote count increment
    const pillEl = card.querySelector('.top3-votes-pill');
    if (pillEl) {
      pillEl.textContent = `${voteCount} Oy`;
      if (voteIncreased) {
        pillEl.classList.remove('vote-bump');
        void pillEl.offsetWidth; // Force reflow
        pillEl.classList.add('vote-bump');
      }
    }

    // Overtake Rank 1 Gold Shine Animation
    const avatarWrap = card.querySelector('.top3-avatar-wrap');
    if (avatarWrap && becameFirst) {
      avatarWrap.classList.remove('rank-1-shine');
      void avatarWrap.offsetWidth; // Force reflow
      avatarWrap.classList.add('rank-1-shine');
    }

    newCards.push(card);
  }

  // Remove old cards that fell out of Top 3
  for (const [key, old] of prevData.entries()) {
    if (!currentKeys.has(key) && old.element && old.element.parentNode === top3CardsRow) {
      top3CardsRow.removeChild(old.element);
    }
  }

  // Append new / updated cards in rank order
  newCards.forEach(c => top3CardsRow.appendChild(c));

  // 3. FLIP: Invert & Play Animation
  for (const card of newCards) {
    const key = card.dataset.userKey;
    if (key && prevData.has(key)) {
      const prev = prevData.get(key);
      const newRect = card.getBoundingClientRect();
      const dx = prev.rect.left - newRect.left;
      const dy = prev.rect.top - newRect.top;

      if (dx !== 0 || dy !== 0) {
        card.style.transform = `translate(${dx}px, ${dy}px)`;
        card.style.transition = 'none';
        void card.offsetHeight; // Force reflow
        requestAnimationFrame(() => {
          card.style.transition = 'transform 0.65s cubic-bezier(0.34, 1.56, 0.64, 1)';
          card.style.transform = '';
        });
      }
    }
  }
}

// Render crisp pixelated retro SVG icons (◆ Baklava / Diamond for SAĞ KOL, ■ Square for RACON KESEN)
function getRaconBadgeIconHtml(rank, icon) {
  if (icon && typeof icon === 'string' && icon.includes('<svg')) {
    return icon;
  }
  if (rank <= 3 || icon === 'baklava' || icon === 'diamond' || icon === 'elmas' || icon === 'rhombus' || icon === '◆') {
    // Exact 8-bit Retro Pixel Baklava / Diamond (◆ SAĞ KOL - media_1789425734709.png)
    return `<svg class="racon-svg-icon" width="7" height="7" viewBox="0 0 7 7" fill="currentColor" style="display:inline-block; vertical-align:middle; shape-rendering:crispEdges; margin-right:1px;">
      <rect x="3" y="0" width="1" height="1" fill="currentColor"/>
      <rect x="2" y="1" width="3" height="1" fill="currentColor"/>
      <rect x="1" y="2" width="5" height="1" fill="currentColor"/>
      <rect x="0" y="3" width="7" height="1" fill="currentColor"/>
      <rect x="1" y="4" width="5" height="1" fill="currentColor"/>
      <rect x="2" y="5" width="3" height="1" fill="currentColor"/>
      <rect x="3" y="6" width="1" height="1" fill="currentColor"/>
    </svg>`;
  } else {
    // Exact yellow pixel square matching Rank 4 & 5 (■ RACON KESEN)
    return `<svg class="racon-svg-icon" width="5" height="5" viewBox="0 0 5 5" fill="currentColor" style="display:inline-block; vertical-align:middle; shape-rendering:crispEdges; margin-right:1px;">
      <rect x="0" y="0" width="5" height="5" fill="currentColor"/>
    </svg>`;
  }
}

// Default sample data for Racon Kralı (Matching the user's screenshot with ◆ Baklava / Diamond Icon)
const DEFAULT_SAMPLE_RACON = [
  { rank: 1, userKey: 'bayram', username: 'Bayram', nickname: 'Bayram', avatar: '', score: 420, badgeTitle: 'SAĞ KOL', badgeIcon: 'baklava', badgeClass: 'badge-cyan' },
  { rank: 2, userKey: 'ananad', username: 'ananad', nickname: 'ananad', avatar: '', score: 315, badgeTitle: 'SAĞ KOL', badgeIcon: 'baklava', badgeClass: 'badge-cyan' },
  { rank: 3, userKey: 'dogancan', username: 'dogancan', nickname: 'dogancan', avatar: '', score: 305, badgeTitle: 'SAĞ KOL', badgeIcon: 'baklava', badgeClass: 'badge-cyan' },
  { rank: 4, userKey: 'celalmihm', username: 'celalmihm', nickname: 'celalmihm', avatar: '', score: 200, badgeTitle: 'RACON KESEN', badgeIcon: 'square', badgeClass: 'badge-yellow' },
  { rank: 5, userKey: 'burak', username: 'burak', nickname: 'burak', avatar: '', score: 200, badgeTitle: 'RACON KESEN', badgeIcon: 'square', badgeClass: 'badge-yellow' }
];

let currentRaconList = [];

// Render or Update Racon Kralı Top 5 Leaderboard Widget with FLIP Animation
function renderRaconWidget(raconList) {
  if (!raconListEl) return;

  const validList = (Array.isArray(raconList) && raconList.length > 0) ? raconList : [];
  currentRaconList = validList.length > 0 ? validList : (currentRaconList.length > 0 ? currentRaconList : DEFAULT_SAMPLE_RACON);

  if (isComponentAllowed('racon') && raconKraliWidget) {
    raconKraliWidget.classList.remove('hidden');
    raconKraliWidget.style.display = 'flex';
  }

  // 1. Measure previous positions (FLIP: First)
  const prevData = new Map();
  for (const child of Array.from(raconListEl.children)) {
    const key = child.dataset.userKey;
    if (key) {
      prevData.set(key, {
        rect: child.getBoundingClientRect(),
        rank: parseInt(child.dataset.rank, 10) || 0,
        score: parseInt(child.dataset.score, 10) || 0,
        element: child
      });
    }
  }

  // 2. Prepare new rows (FLIP: Last)
  const newRows = [];
  const currentKeys = new Set();

  for (let idx = 0; idx < Math.min(5, currentRaconList.length); idx++) {
    const item = currentRaconList[idx] || DEFAULT_SAMPLE_RACON[idx];
    const rank = idx + 1;
    const cleanUser = item ? String(item.username || item.userKey || `user_${rank}`).replace(/^@/, '').toLowerCase() : `user_${rank}`;
    currentKeys.add(cleanUser);

    const rawDisplayName = item ? (item.nickname || item.username || `Kullanıcı ${rank}`) : `Kullanıcı ${rank}`;
    const displayName = sanitizeNickname(rawDisplayName, cleanUser);
    const scoreVal = item ? (parseInt(item.score, 10) || 0) : (rank === 1 ? 420 : (rank === 2 ? 315 : (rank === 3 ? 305 : 200)));

    const badgeIcon = item.badgeIcon || (rank <= 3 ? '▼' : '🟨');
    const badgeTitle = item.badgeTitle || (rank <= 3 ? 'SAĞ KOL' : 'RACON KESEN');
    const badgeClass = (rank <= 3) ? 'racon-badge-cyan' : 'racon-badge-yellow';

    const letterAvatar = getRetroAvatarFallback(cleanUser, displayName);
    let avatarSrc = letterAvatar;
    if (item && item.avatar && typeof item.avatar === 'string' && item.avatar.trim().startsWith('http') && !item.avatar.includes('unsplash.com')) {
      avatarSrc = item.avatar.trim();
    }

    const prev = prevData.get(cleanUser);
    let row;
    let scoreIncreased = false;
    let becameFirst = false;

    if (prev && prev.element) {
      row = prev.element;
      scoreIncreased = (scoreVal > prev.score && prev.score > 0);
      becameFirst = (rank === 1 && prev.rank > 1);
    } else {
      row = document.createElement('div');
      row.className = `racon-row rank-${rank} row-enter`;
      row.innerHTML = `
        <div class="racon-rank-num">${rank}</div>
        <div class="racon-avatar-wrap">
          ${rank === 1 ? '<span class="racon-crown">👑</span>' : ''}
          <img class="racon-avatar" src="${escapeHtml(avatarSrc)}" alt="" onerror="this.onerror=null;this.src='${escapeHtml(getRetroAvatarFallback(displayName, displayName))}'" />
        </div>
        <div class="racon-content">
          <div class="racon-top-line">
            <span class="racon-username">${escapeHtml(displayName)}</span>
            <span class="racon-score">${escapeHtml(String(scoreVal))}x</span>
          </div>
          <div class="racon-bottom-line ${badgeClass}">
            <span class="racon-badge-icon">${getRaconBadgeIconHtml(rank, badgeIcon)}</span>
            <span class="racon-badge-text">${escapeHtml(badgeTitle)}</span>
          </div>
        </div>
      `;
    }

    // Update dataset and classes
    row.dataset.userKey = cleanUser;
    row.dataset.rank = rank;
    row.dataset.score = scoreVal;
    row.className = `racon-row rank-${rank}`;

    // Update rank number
    const rankEl = row.querySelector('.racon-rank-num');
    if (rankEl) rankEl.textContent = rank;

    // Crown management (Only on rank 1)
    const avatarWrap = row.querySelector('.racon-avatar-wrap');
    if (avatarWrap) {
      const existingCrown = avatarWrap.querySelector('.racon-crown');
      if (rank === 1 && !existingCrown) {
        const crownSpan = document.createElement('span');
        crownSpan.className = 'racon-crown';
        crownSpan.textContent = '👑';
        avatarWrap.insertBefore(crownSpan, avatarWrap.firstChild);
      } else if (rank !== 1 && existingCrown) {
        existingCrown.remove();
      }
    }

    // Update Avatar
    const imgEl = row.querySelector('.racon-avatar');
    if (imgEl && imgEl.getAttribute('src') !== avatarSrc) {
      imgEl.src = avatarSrc;
    }

    // Update Username
    const nameEl = row.querySelector('.racon-username');
    if (nameEl) nameEl.textContent = displayName;

    // Update Score
    const scoreEl = row.querySelector('.racon-score');
    if (scoreEl) {
      scoreEl.textContent = `${scoreVal}x`;
      if (scoreIncreased) {
        scoreEl.classList.remove('score-bump');
        void scoreEl.offsetWidth; // Force reflow
        scoreEl.classList.add('score-bump');
      }
    }

    // Update Badge
    const badgeLine = row.querySelector('.racon-bottom-line');
    if (badgeLine) {
      badgeLine.className = `racon-bottom-line ${badgeClass}`;
      const iconSpan = badgeLine.querySelector('.racon-badge-icon');
      if (iconSpan) iconSpan.innerHTML = getRaconBadgeIconHtml(rank, badgeIcon);
      const textSpan = badgeLine.querySelector('.racon-badge-text');
      if (textSpan) textSpan.textContent = badgeTitle;
    }

    // Rank 1 Shine effect
    if (becameFirst) {
      row.classList.remove('rank-1-shine');
      void row.offsetWidth; // Force reflow
      row.classList.add('rank-1-shine');
    }

    newRows.push(row);
  }

  // Remove rows no longer in top 5
  for (const [key, old] of prevData.entries()) {
    if (!currentKeys.has(key) && old.element && old.element.parentNode === raconListEl) {
      raconListEl.removeChild(old.element);
    }
  }

  // Re-append in correct order
  newRows.forEach(r => raconListEl.appendChild(r));

  // 3. FLIP Invert & Play
  for (const row of newRows) {
    const key = row.dataset.userKey;
    if (key && prevData.has(key)) {
      const prev = prevData.get(key);
      const newRect = row.getBoundingClientRect();
      const dy = prev.rect.top - newRect.top;

      if (dy !== 0) {
        row.style.transform = `translateY(${dy}px)`;
        row.style.transition = 'none';
        void row.offsetHeight; // Force reflow
        requestAnimationFrame(() => {
          row.style.transition = 'transform 0.65s cubic-bezier(0.34, 1.56, 0.64, 1)';
          row.style.transform = '';
        });
      }
    }
  }
}

// Immediately hard-hide disallowed components so they NEVER flash or render
function enforceComponentIsolation() {
  if (!isComponentAllowed('voters') && leftVotersContainer) {
    leftVotersContainer.classList.add('hidden');
    leftVotersContainer.style.display = 'none';
  }
  if (!isComponentAllowed('top3') && top3PodiumBox) {
    top3PodiumBox.classList.add('hidden');
    top3PodiumBox.style.display = 'none';
  }
  if (!isComponentAllowed('racon') && raconKraliWidget) {
    raconKraliWidget.classList.add('hidden');
    raconKraliWidget.style.display = 'none';
  }
  if (!isComponentAllowed('score') && topCenterWidget) {
    topCenterWidget.classList.add('hidden');
    topCenterWidget.style.display = 'none';
  }
  if (!isComponentAllowed('prompt') && mainPromptBox) {
    mainPromptBox.classList.add('hidden');
    mainPromptBox.style.display = 'none';
  }
  if (!isComponentAllowed('urgency') && urgencyAlertBox) {
    urgencyAlertBox.classList.add('hidden');
    urgencyAlertBox.style.display = 'none';
  }
  if (!isComponentAllowed('result') && resultOverlayBox) {
    resultOverlayBox.classList.add('hidden');
    resultOverlayBox.style.display = 'none';
  }
  if (!isComponentAllowed('raffle') && raffleContainer) {
    raffleContainer.classList.add('hidden');
    raffleContainer.style.display = 'none';
  }
  if (!isComponentAllowed('candidate') && candidateProfileBox) {
    candidateProfileBox.classList.add('hidden');
    candidateProfileBox.style.display = 'none';
  }
  if (!isComponentAllowed('candidate') && bottomTimerBar) {
    bottomTimerBar.classList.add('hidden');
    bottomTimerBar.style.display = 'none';
  }
  if (!isComponentAllowed('candidate') && rightVotesBadge) {
    rightVotesBadge.classList.add('hidden');
    rightVotesBadge.style.display = 'none';
  }
}
enforceComponentIsolation();

const isPreviewMode = !!(urlParams.get('preview') || urlParams.get('sim') || urlParams.get('test'));

if (isComponentAllowed('top3')) {
  renderTop3Widget(DEFAULT_SAMPLE_TOP3);
  fetch('/api/voters/top3')
    .then(r => r.json())
    .then(res => {
      const list = (res && Array.isArray(res.top3)) ? res.top3 : (Array.isArray(res) ? res : []);
      renderTop3Widget(list);
    })
    .catch(() => {
      renderTop3Widget(DEFAULT_SAMPLE_TOP3);
    });

  if (isPreviewMode && widgetMode === 'top3') {
    setTimeout(() => {
      fetch('/api/voters/top3/test', { method: 'POST' }).catch(() => {});
    }, 450);
  }
}

if (isComponentAllowed('racon')) {
  renderRaconWidget(DEFAULT_SAMPLE_RACON);
  fetch('/api/racon/leaderboard')
    .then(r => r.json())
    .then(res => {
      const list = (res && Array.isArray(res.leaderboard)) ? res.leaderboard : [];
      renderRaconWidget(list);
    })
    .catch(() => {
      renderRaconWidget(DEFAULT_SAMPLE_RACON);
    });

  if (isPreviewMode && widgetMode === 'racon') {
    setTimeout(() => {
      fetch('/api/racon/test', { method: 'POST' }).catch(() => {});
    }, 450);
  }
}

if (widgetMode === 'raffle') {
  if (isPreviewMode) {
    setTimeout(() => {
      fetch('/api/raffle/test', { method: 'POST' }).catch(() => {});
    }, 450);
  }
}

// Auto-trigger full random rating simulation on preview of overlay or main rating widgets
if (isPreviewMode && (widgetMode === 'full' || widgetMode === 'leaderboard' || widgetMode === 'score' || widgetMode === 'prompt' || widgetMode === 'top_prompt' || widgetMode === 'urgency' || widgetMode === 'result')) {
  setTimeout(() => {
    if (currentRoundState && currentRoundState.isActive) return;
    fetch('/api/test/simulate-round', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duration: 15, bias: 'random' })
    }).catch(() => {});
  }, 450);
}

// Retro 8-bit Audio Synthesizer via Web Audio API
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) audioCtx = new AudioContextClass();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// 8-bit Coin Sound (When new vote arrives)
function playRetroCoinSound() {
  if (!appConfig.soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(987.77, ctx.currentTime); // B5
    osc.frequency.setValueAtTime(1318.51, ctx.currentTime + 0.08); // E6
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch (e) {}
}

// 8-bit Alert Beep (When 10s remaining)
function playAlertBeep() {
  if (!appConfig.soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch (e) {}
}

// 8-bit Victory Jingle (When round finishes)
function playVictoryJingle() {
  if (!appConfig.soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + idx * 0.08;
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.15, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.3);
    });
  } catch (e) {}
}

// Create Falling Confetti
function spawnConfetti() {
  if (!resultParticlesEl || !isComponentAllowed('result')) return;
  resultParticlesEl.innerHTML = '';
  const colors = ['#fbee38', '#39ff14', '#ff3333', '#38bdf8', '#fb923c', '#ffffff'];
  for (let i = 0; i < 30; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = `${Math.random() * 1.5}s`;
    piece.style.animationDuration = `${1.8 + Math.random() * 1.5}s`;
    resultParticlesEl.appendChild(piece);
  }
}


// Crisp Mechanical CS:GO Case Opening Tick Sound (Net, Tok ve Yüksek Sesli Tıklama)
function playRaffleTickSound(vol = 0.38, delaySec = 0) {
  if (!appConfig.soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime + (delaySec || 0);

    // Layer 1: High transient sharp snap (Keskin mekanik çıt sesi)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(2200 + Math.random() * 300, now);
    osc1.frequency.exponentialRampToValueAtTime(280, now + 0.028);

    gain1.gain.setValueAtTime(vol * 0.75, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.028);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.03);

    // Layer 2: Mechanical body / ratchet tooth thump (Tok gövde rezonansı)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(850 + Math.random() * 150, now);
    osc2.frequency.exponentialRampToValueAtTime(90, now + 0.038);

    gain2.gain.setValueAtTime(vol, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.038);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now);
    osc2.stop(now + 0.04);
  } catch (e) {}
}

// 8-bit Celebratory Fanfare (When Raffle Winner is Chosen)
function playRaffleWinSound() {
  if (!appConfig.soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const notes = [587.33, 739.99, 880.00, 1174.66]; // D5, F#5, A5, D6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + idx * 0.09;
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.30, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.45);
    });
  } catch (e) {}
}

let raffleAnimationTimeout = null;
let candidateTransitionTimeout = null;
let raffleAnimationFrameId = null;
let currentCandidate = null;
let isRaffleActive = false;

// Immediately Stop, Cancel, and Hide All Raffle, Candidate and Overlay Elements
function stopAllRaffleAndOverlay() {
  isRaffleActive = false;
  currentCandidate = null;

  if (raffleAnimationFrameId) {
    cancelAnimationFrame(raffleAnimationFrameId);
    raffleAnimationFrameId = null;
  }
  if (raffleAnimationTimeout) {
    clearTimeout(raffleAnimationTimeout);
    raffleAnimationTimeout = null;
  }
  if (candidateTransitionTimeout) {
    clearTimeout(candidateTransitionTimeout);
    candidateTransitionTimeout = null;
  }
  if (autoHideTimeout) {
    clearTimeout(autoHideTimeout);
    autoHideTimeout = null;
  }

  // Immediately clear and hide raffle container and reset roulette track
  if (raffleTrack) {
    raffleTrack.innerHTML = '';
    raffleTrack.style.transition = 'none';
    raffleTrack.style.transform = 'translateX(0px)';
  }
  if (raffleContainer) {
    raffleContainer.classList.add('hidden');
    raffleContainer.style.display = 'none';
  }

  // Immediately hide candidate profile box, timer bar, right vote badge
  if (candidateProfileBox) {
    candidateProfileBox.classList.add('hidden');
    candidateProfileBox.style.display = 'none';
  }
  if (bottomTimerBar) {
    bottomTimerBar.classList.add('hidden');
    bottomTimerBar.style.display = 'none';
  }
  if (rightVotesBadge) {
    rightVotesBadge.classList.add('hidden');
    rightVotesBadge.style.display = 'none';
  }

  // Clear particles / confetti
  if (resultParticlesEl) {
    resultParticlesEl.innerHTML = '';
  }

  // Immediately hide all main overlay components
  if (leftVotersContainer) {
    leftVotersContainer.innerHTML = '';
    leftVotersContainer.classList.add('hidden');
    leftVotersContainer.style.display = 'none';
  }
  if (topCenterWidget) {
    topCenterWidget.classList.add('hidden');
    topCenterWidget.style.display = 'none';
  }
  if (mainPromptBox) {
    mainPromptBox.classList.add('hidden');
    mainPromptBox.style.display = 'none';
  }
  if (urgencyAlertBox) {
    urgencyAlertBox.classList.add('hidden');
    urgencyAlertBox.style.display = 'none';
  }
  if (resultOverlayBox) {
    resultOverlayBox.classList.add('hidden');
    resultOverlayBox.style.display = 'none';
  }
  if (top3PodiumBox && widgetMode !== 'top3') {
    top3PodiumBox.classList.add('hidden');
    top3PodiumBox.style.display = 'none';
  }

  setOverlayState('idle');
}

// Run CS:GO Case Opening Roulette Roll (Ekran görüntüsü 1 ile birebir)
function runRaffleAnimation({ participants, winner, duration = 6000 }) {
  if (!isComponentAllowed('raffle')) return;
  if (!raffleContainer || !raffleTrack) return;

  isRaffleActive = true;
  if (raffleAnimationTimeout) clearTimeout(raffleAnimationTimeout);
  if (candidateTransitionTimeout) clearTimeout(candidateTransitionTimeout);
  if (raffleAnimationFrameId) cancelAnimationFrame(raffleAnimationFrameId);

  // Set visual state to raffle
  setOverlayState('raffle');

  // Strictly hide and clear left voters container
  if (leftVotersContainer) {
    leftVotersContainer.innerHTML = '';
    leftVotersContainer.classList.add('hidden');
    leftVotersContainer.style.display = 'none';
  }
  // Strictly hide top center widget and prompts
  if (topCenterWidget) {
    topCenterWidget.classList.add('hidden');
    topCenterWidget.style.display = 'none';
  }
  if (mainPromptBox) {
    mainPromptBox.classList.add('hidden');
    mainPromptBox.style.display = 'none';
  }
  if (urgencyAlertBox) {
    urgencyAlertBox.classList.add('hidden');
    urgencyAlertBox.style.display = 'none';
  }
  if (resultOverlayBox) {
    resultOverlayBox.classList.add('hidden');
    resultOverlayBox.style.display = 'none';
  }
  if (top3PodiumBox && widgetMode !== 'top3') {
    top3PodiumBox.classList.add('hidden');
    top3PodiumBox.style.display = 'none';
  }
  if (candidateProfileBox) {
    candidateProfileBox.classList.add('hidden');
    candidateProfileBox.style.display = 'none';
  }
  if (bottomTimerBar) {
    bottomTimerBar.classList.add('hidden');
    bottomTimerBar.style.display = 'none';
  }
  if (rightVotesBadge) {
    rightVotesBadge.classList.add('hidden');
    rightVotesBadge.style.display = 'none';
  }

  // Show raffle container
  raffleContainer.classList.remove('hidden');
  raffleContainer.style.display = 'flex';

  // Total items on track: 50 items, target winner at slot 38
  const TOTAL_SLOTS = 50;
  const WINNER_SLOT = 38;
  const CARD_WIDTH = 80;
  const CARD_GAP = 10;
  const CARD_PITCH = CARD_WIDTH + CARD_GAP; // 90px

  const pool = Array.isArray(participants) && participants.length > 0 ? participants : [winner];
  raffleTrack.innerHTML = '';
  raffleTrack.style.transition = 'none';
  raffleTrack.style.transform = 'translateX(0px)';

  const cardElements = [];

  for (let i = 0; i < TOTAL_SLOTS; i++) {
    const item = (i === WINNER_SLOT) ? winner : pool[i % pool.length];
    const card = document.createElement('div');
    card.className = `raffle-card slot-${i}`;
    if (i === WINNER_SLOT) card.dataset.isWinner = 'true';

    const displayName = item.nickname || item.username || 'Katılımcı';
    const fallbackSvg = getRetroAvatarFallback(item.username, displayName);
    let rawAvatar = (item.avatar && typeof item.avatar === 'string' && (item.avatar.trim().startsWith('http') || item.avatar.trim().startsWith('data:'))) 
      ? item.avatar.trim() 
      : '';
    const avatarSrc = rawAvatar || fallbackSvg;
    const scoreVal = item.score !== undefined && item.score !== null ? item.score : (item.voteCount || '');

    card.innerHTML = `
      <img class="raffle-card-img" src="${escapeHtml(avatarSrc)}" alt="" onerror="this.onerror=null;this.src='${escapeHtml(fallbackSvg)}'" />
      ${scoreVal !== '' ? `<span class="raffle-card-tag">${escapeHtml(String(scoreVal))}</span>` : ''}
    `;

    raffleTrack.appendChild(card);
    cardElements.push(card);
  }

  // Force reflow
  raffleTrack.getBoundingClientRect();

  // Calculate destination offset - EXACT DEAD CENTER (Tam Ortasında Dursun)
  const winnerCard = cardElements[WINNER_SLOT];
  const cardOffsetLeft = (winnerCard && winnerCard.offsetLeft) ? winnerCard.offsetLeft : (WINNER_SLOT * CARD_PITCH);
  const cardWidth = (winnerCard && winnerCard.offsetWidth) ? winnerCard.offsetWidth : CARD_WIDTH;
  const winningCardCenter = cardOffsetLeft + (cardWidth / 2);

  const viewport = raffleContainer.querySelector('.raffle-viewport');
  const viewportWidth = viewport ? viewport.clientWidth : 640;
  const viewportCenter = viewportWidth / 2;

  // Exact dead-center alignment: 0 jitter, subpixel precise
  const targetX = (viewportWidth / 2) - winningCardCenter;

  // Sound ticking engine via requestAnimationFrame (Physically synchronized with track translation)
  const animDuration = duration || 6000;
  const animStartTime = performance.now();
  let lastPassedSlot = 0;

  function tickEngine(now) {
    if (!isRaffleActive) return;
    const elapsed = now - animStartTime;
    if (elapsed >= animDuration) return;

    const computed = window.getComputedStyle(raffleTrack);
    const matrix = new DOMMatrixReadOnly(computed.transform);
    const currentX = Math.abs(matrix.m41);

    const passedSlot = Math.floor((currentX + (viewportWidth / 2)) / CARD_PITCH);
    const delta = passedSlot - lastPassedSlot;
    if (delta > 0) {
      if (delta === 1) {
        playRaffleTickSound(0.38);
      } else {
        // Fast initial spin: play micro-staggered ticks for passed cards so fast motion is punchy and continuous
        const count = Math.min(delta, 3);
        for (let k = 0; k < count; k++) {
          playRaffleTickSound(0.42, k * 0.008);
        }
      }
      lastPassedSlot = passedSlot;
    }

    if (isRaffleActive) {
      raffleAnimationFrameId = requestAnimationFrame(tickEngine);
    }
  }

  raffleAnimationFrameId = requestAnimationFrame(tickEngine);

  // Apply smooth CS case opening deceleration
  raffleTrack.style.transition = `transform ${animDuration}ms cubic-bezier(0.12, 0.88, 0.22, 1)`;
  raffleTrack.style.transform = `translateX(${targetX.toFixed(2)}px)`;

  // On roll finish
  raffleAnimationTimeout = setTimeout(() => {
    if (!isRaffleActive) return;
    const winnerCard = cardElements[WINNER_SLOT];
    if (winnerCard) {
      winnerCard.classList.add('is-winner');
    }
    playRaffleWinSound();
    spawnConfetti();

    // After 1.6s short result animation, fade out raffle, zoom in candidate profile box and activate voting
    candidateTransitionTimeout = setTimeout(() => {
      if (!isRaffleActive) return;
      isRaffleActive = false;
      raffleContainer.classList.add('hidden');
      raffleContainer.style.display = 'none';

      showCandidateProfileBox(winner);
      setOverlayState('voting');

      // Candidate profile box has now grown on screen!
      // Leaderboard appears THEN, starting completely fresh for candidate votes!
      if (isComponentAllowed('voters') && leftVotersContainer) {
        leftVotersContainer.innerHTML = '';
        leftVotersContainer.classList.remove('hidden');
        leftVotersContainer.style.display = '';
      }
      if (isComponentAllowed('score') && topCenterWidget) {
        topCenterWidget.classList.remove('hidden');
        topCenterWidget.style.display = '';
      }
    }, 1600);

  }, animDuration);
}

// TikTok High-Resolution Avatar Converter (Replaces low-res thumbnails 72x72 / 100x100 with HD 720x720 / 1080x1080)
function getHighResAvatarUrl(url, targetRes = 720) {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) return url || '';

  let highRes = url;
  const resStr = `${targetRes}x${targetRes}`;
  const shrinkStr = `${targetRes}:${targetRes}`;

  // Replace resolution suffixes like _100x100, _72x72, _200x200, _300x300
  highRes = highRes.replace(/_\d{2,4}x\d{2,4}\.(jpeg|jpg|png|webp|heic)/gi, `_${resStr}.$1`);

  // Replace ~c5_100x100, ~c5_72x72, ~c5_200x200
  highRes = highRes.replace(/~c5_\d{2,4}x\d{2,4}\.(jpeg|jpg|png|webp|heic)/gi, `~c5_${resStr}.$1`);

  // Replace tplv-tiktok-obj-shrink:72:72, tplv-tiktok-obj-shrink:100:100
  highRes = highRes.replace(/tplv-tiktok-obj-shrink:\d{2,4}:\d{2,4}/gi, `tplv-tiktok-obj-shrink:${shrinkStr}`);

  // Replace ~tplv-obj:72:72, ~tplv-obj:100:100
  highRes = highRes.replace(/~tplv-obj:\d{2,4}:\d{2,4}/gi, `~tplv-obj:${shrinkStr}`);

  return highRes;
}

// Multi-tier resolution loader with fallback chain (HD 720p -> 300p -> Original -> Proxy -> SVG)
function loadCandidateAvatarWithFallback(imgEl, rawAvatar, fallbackSvg) {
  if (!imgEl) return;

  if (!rawAvatar || !rawAvatar.startsWith('http')) {
    imgEl.onerror = null;
    imgEl.src = fallbackSvg;
    return;
  }

  const hd720 = getHighResAvatarUrl(rawAvatar, 720);
  const med300 = getHighResAvatarUrl(rawAvatar, 300);
  const original = rawAvatar;
  const proxyUrl = `/api/avatar-proxy?url=${encodeURIComponent(original)}`;

  const queue = [];
  if (hd720) queue.push(hd720);
  if (med300 && med300 !== hd720) queue.push(med300);
  if (original && original !== hd720 && original !== med300) queue.push(original);
  queue.push(proxyUrl);

  let attemptIdx = 0;

  function tryNextSource() {
    if (attemptIdx < queue.length) {
      const nextSrc = queue[attemptIdx++];
      imgEl.onerror = tryNextSource;
      imgEl.src = nextSrc;
    } else {
      imgEl.onerror = null;
      imgEl.src = fallbackSvg;
    }
  }

  tryNextSource();
}

// Display Candidate Profile Box with Statistics (Ekran görüntüsü 2 ile birebir, ultra net HD)
function showCandidateProfileBox(candidate) {
  if (!isComponentAllowed('candidate')) return;
  if (!candidateProfileBox || !candidate) return;
  currentCandidate = candidate;

  const cleanUser = String(candidate.username || '').replace(/^@/, '');
  const displayName = sanitizeNickname(candidate.nickname || candidate.username || 'Aday', cleanUser);
  const fallbackSvg = getRetroAvatarFallback(cleanUser, displayName);
  let rawAvatar = (candidate.avatar && typeof candidate.avatar === 'string' && (candidate.avatar.trim().startsWith('http') || candidate.avatar.trim().startsWith('data:'))) 
    ? candidate.avatar.trim() 
    : '';

  if (candidateAvatarImg) {
    loadCandidateAvatarWithFallback(candidateAvatarImg, rawAvatar, fallbackSvg);
  }

  if (candidateUsernameEl) {
    candidateUsernameEl.textContent = displayName;
  }

  if (candidateStatsEl) {
    const avgScore = candidate.averageScoreGiven !== undefined ? candidate.averageScoreGiven : (candidate.score || 6.1);
    const voteCount = candidate.totalVotesGiven !== undefined ? candidate.totalVotesGiven : 1;
    const chance = candidate.winChance || '%4';
    candidateStatsEl.textContent = `ortalama ${avgScore} · ${voteCount} oy · şans ${chance}`;
  }

  candidateProfileBox.classList.remove('hidden');
  candidateProfileBox.style.display = 'flex';

  if (bottomTimerBar) {
    bottomTimerBar.classList.remove('hidden');
    bottomTimerBar.style.display = 'flex';
  }
  if (rightVotesBadge) {
    rightVotesBadge.classList.remove('hidden');
    rightVotesBadge.style.display = 'flex';
  }
}

// Hide and Reset Candidate Profile Box Immediately
function hideCandidateProfileBox() {
  stopAllRaffleAndOverlay();
}


// Demote previous top voter card to regular voter card so their vote slides down into the feed
function demoteTopCardToRegular(topCard) {
  if (!topCard || !leftVotersContainer) return;
  topCard.classList.remove('is-top-voter');

  // Re-trigger slide-in animation so it smoothly lands into the regular list
  topCard.style.animation = 'none';
  void topCard.offsetWidth; // force reflow
  topCard.style.animation = '';

  trimRegularCards(5);
}

// Keep max N regular cards visible in the list (total max N + 1 with top voter)
function trimRegularCards(maxCount = 5) {
  if (!leftVotersContainer) return;
  const regularCards = Array.from(leftVotersContainer.children).filter(c => !c.classList.contains('is-top-voter'));
  while (regularCards.length > maxCount) {
    const toRemove = regularCards.pop();
    if (toRemove && toRemove.parentNode === leftVotersContainer) {
      leftVotersContainer.removeChild(toRemove);
    }
  }
}

// Render or Update the Top Voter (Son 5 El Lideri) Card at the very top
function renderTopVoterCard(topVoter) {
  if (!isComponentAllowed('voters') || !leftVotersContainer) return;
  if (isRaffleActive || currentCandidate) return;
  if (!topVoter) return;

  // Lider bu aktif turda oy VERMEDİYSE ekranda / sıralamada kesinlikle gözükmeyecek!
  const roundScore = (topVoter.currentRoundScore !== null && topVoter.currentRoundScore !== undefined)
    ? parseInt(topVoter.currentRoundScore, 10)
    : null;

  const existingTopCard = leftVotersContainer.querySelector('.voter-card.is-top-voter');

  if (roundScore === null || isNaN(roundScore)) {
    // Bu turda henüz oy vermemiş -> Varsa ekrandaki eski lider kartını normal listeye kaydır veya kaldır
    if (existingTopCard) {
      const cleanKey = String(topVoter.userKey || topVoter.username || '').toLowerCase().replace(/^@/, '');
      if (existingTopCard.dataset.userKey !== cleanKey) {
        demoteTopCardToRegular(existingTopCard);
      } else {
        existingTopCard.remove();
      }
    }
    return;
  }

  currentTopVoter = topVoter;
  const userKey = String(topVoter.userKey || topVoter.username || '').toLowerCase().replace(/^@/, '');
  const displayName = sanitizeNickname(topVoter.nickname || topVoter.username || 'Lider', userKey);

  const displayScore = roundScore;
  const scoreClass = `score-${displayScore}`;

  const fallbackSvg = getRetroAvatarFallback(topVoter.username, displayName);
  let rawAvatar = (topVoter.avatar && typeof topVoter.avatar === 'string' && (topVoter.avatar.trim().startsWith('http') || topVoter.avatar.trim().startsWith('data:'))) 
    ? topVoter.avatar.trim() 
    : '';
  const initialSrc = rawAvatar || fallbackSvg;

  // 1. Aynı kullanıcı zaten lider kartındaysa sadece içeriğini güncelle
  if (existingTopCard && existingTopCard.dataset.userKey === userKey) {
    const nameEl = existingTopCard.querySelector('.voter-username');
    if (nameEl) nameEl.textContent = displayName;

    const scoreEl = existingTopCard.querySelector('.voter-score');
    if (scoreEl) {
      scoreEl.className = `voter-score ${scoreClass}`;
      scoreEl.textContent = displayScore;
    }

    if (rawAvatar) {
      const imgEl = existingTopCard.querySelector('.voter-avatar');
      if (imgEl && imgEl.src !== rawAvatar) {
        imgEl.dataset.retriedProxy = '';
        imgEl.onerror = () => handleAvatarError(imgEl, rawAvatar, fallbackSvg);
        imgEl.src = rawAvatar;
      }
    }

    if (leftVotersContainer.firstChild !== existingTopCard) {
      leftVotersContainer.insertBefore(existingTopCard, leftVotersContainer.firstChild);
    }
    return;
  }

  // 2. Eğer liderlik el değiştirdiyse (önceki lider kartı başka birine aitse):
  // Önceki liderin kartını yok etmek yerine normal karta dönüştürüp aşağıya kaydırıyoruz!
  if (existingTopCard && existingTopCard.dataset.userKey !== userKey) {
    demoteTopCardToRegular(existingTopCard);
  }

  // 3. Yeni lider daha önce alt listede normal bir kart olarak yer alıyorsa onu kaldır (çifte kart olmasın)
  const existingRegular = leftVotersContainer.querySelector(`.voter-card[data-user-key="${userKey}"]:not(.is-top-voter)`);
  if (existingRegular) {
    existingRegular.remove();
  }

  // 4. Yeni lider kartını oluştur ve en tepeye yerleştir
  const topCard = document.createElement('div');
  topCard.className = 'voter-card is-top-voter';
  topCard.dataset.userKey = userKey;

  topCard.innerHTML = `
    <img class="voter-avatar" 
         src="${escapeHtml(initialSrc)}" 
         referrerpolicy="no-referrer" 
         loading="eager" 
         alt="" 
         onerror="handleAvatarError(this, '${escapeHtml(rawAvatar)}', '${escapeHtml(fallbackSvg)}')" />
    <div class="voter-info">
      <div class="voter-username">${escapeHtml(displayName)}</div>
      <div class="voter-score ${scoreClass}">${displayScore}</div>
    </div>
  `;

  leftVotersContainer.insertBefore(topCard, leftVotersContainer.firstChild);
  trimRegularCards(5);
}

// Add or Update Voter Card in Leaderboard / Left Stack
function addVoterCard(vote) {
  if (!isComponentAllowed('voters') || !leftVotersContainer) return;
  if (isRaffleActive) return;

  const rawUser = String(vote.username || vote.userId || vote.nickname || 'Oy Veren').trim();
  const cleanUsername = rawUser.replace(/^@/, '');
  const userKey = cleanUsername.toLowerCase();
  const displayName = sanitizeNickname(vote.nickname || cleanUsername || 'Oy Veren', cleanUsername);

  const fallbackSvg = getRetroAvatarFallback(cleanUsername, displayName);
  
  let rawAvatar = (vote.avatar && typeof vote.avatar === 'string' && (vote.avatar.trim().startsWith('http') || vote.avatar.trim().startsWith('data:'))) 
    ? vote.avatar.trim() 
    : '';

  const initialSrc = rawAvatar || fallbackSvg;
  const scoreNum = parseInt(vote.score, 10);
  const scoreClass = `score-${scoreNum}`;

  const topCard = leftVotersContainer.querySelector('.voter-card.is-top-voter');

  // If the voter is the current top voter, update or render the top card!
  if (currentTopVoter && currentTopVoter.userKey === userKey) {
    currentTopVoter.currentRoundScore = scoreNum;
    if (rawAvatar) currentTopVoter.avatar = rawAvatar;
    currentTopVoter.nickname = displayName;

    // Remove any regular card for this user if one existed
    const existingRegular = leftVotersContainer.querySelector(`.voter-card[data-user-key="${userKey}"]:not(.is-top-voter)`);
    if (existingRegular) existingRegular.remove();

    renderTopVoterCard(currentTopVoter);
    playRetroCoinSound();
    return;
  }

  // Check if a regular card already exists for this user (excluding the top card)
  let existingCard = null;
  if (userKey) {
    for (const child of leftVotersContainer.children) {
      if (!child.classList.contains('is-top-voter') && child.dataset && child.dataset.userKey === userKey) {
        existingCard = child;
        break;
      }
    }
  }

  if (existingCard) {
    // 1. Update text and score
    const nameEl = existingCard.querySelector('.voter-username');
    if (nameEl) nameEl.textContent = displayName;

    const scoreEl = existingCard.querySelector('.voter-score');
    if (scoreEl) {
      scoreEl.className = `voter-score ${scoreClass}`;
      scoreEl.textContent = scoreNum;
    }

    // 2. If incoming vote has a real avatar, update image
    if (rawAvatar) {
      const imgEl = existingCard.querySelector('.voter-avatar');
      if (imgEl && imgEl.src !== rawAvatar) {
        imgEl.dataset.retriedProxy = '';
        imgEl.onerror = () => handleAvatarError(imgEl, rawAvatar, fallbackSvg);
        imgEl.src = rawAvatar;
      }
    }

    // 3. Move existing card to the top of regular cards (right below top card)
    if (topCard && topCard.nextSibling !== existingCard) {
      leftVotersContainer.insertBefore(existingCard, topCard.nextSibling);
    } else if (!topCard) {
      leftVotersContainer.insertBefore(existingCard, leftVotersContainer.firstChild);
    }
    playRetroCoinSound();
    return;
  }

  // Create new card for first-time voter in this round
  const card = document.createElement('div');
  card.className = 'voter-card';
  if (userKey) {
    card.dataset.userKey = userKey;
  }

  card.innerHTML = `
    <img class="voter-avatar" 
         src="${escapeHtml(initialSrc)}" 
         referrerpolicy="no-referrer" 
         loading="eager" 
         alt="" 
         onerror="handleAvatarError(this, '${escapeHtml(rawAvatar)}', '${escapeHtml(fallbackSvg)}')" />
    <div class="voter-info">
      <div class="voter-username">${escapeHtml(displayName)}</div>
      <div class="voter-score ${scoreClass}">${scoreNum}</div>
    </div>
  `;

  // Insert right below the top voter card (or at top if no top card)
  if (topCard) {
    leftVotersContainer.insertBefore(card, topCard.nextSibling);
  } else {
    leftVotersContainer.insertBefore(card, leftVotersContainer.firstChild);
  }

  // Keep max 5 regular cards visible on screen (total max 6 cards with top voter)
  trimRegularCards(5);

  playRetroCoinSound();
}

// Retry failed image load via backend proxy, then fallback to retro SVG
function handleAvatarError(imgEl, originalUrl, fallback) {
  if (!imgEl) return;
  if (originalUrl && !imgEl.dataset.retriedProxy) {
    imgEl.dataset.retriedProxy = 'true';
    imgEl.src = `/api/avatar-proxy?url=${encodeURIComponent(originalUrl)}`;
  } else {
    imgEl.onerror = null;
    imgEl.src = fallback;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
  });
}

// ================= Socket.io Handlers =================

socket.on('init_state', (data) => {
  if (data.config) {
    appConfig = { ...appConfig, ...data.config };
    if (promptTextEl && (!data.currentRound || !data.currentRound.isActive)) {
      promptTextEl.innerHTML = escapeHtml(data.config.defaultTitle || "Chate 1-10 yazın, acımayın!").replace(/\n/g, ' ');
    }
    if (headerCategoryEl && (!data.currentRound || !data.currentRound.isActive)) {
      headerCategoryEl.textContent = data.config.defaultCategory || "Chat konuşuyor";
    }
  }
  if (data.topVoter) {
    currentTopVoter = data.topVoter;
  }
  if (data.top3Voters && isComponentAllowed('top3')) {
    renderTop3Widget(data.top3Voters);
  }
  if (data.raconLeaderboard && isComponentAllowed('racon')) {
    renderRaconWidget(data.raconLeaderboard);
  }

  if (data.candidate && data.currentRound && data.currentRound.isActive && isComponentAllowed('candidate')) {
    showCandidateProfileBox(data.candidate);
  }

  if (data.currentRound && data.currentRound.isActive) {
    handleRoundStart(Object.assign({}, data.currentRound, { topVoter: data.topVoter, top3Voters: data.top3Voters }));
    if (data.currentRound.votes && isComponentAllowed('voters')) {
      Object.values(data.currentRound.votes).forEach(v => {
        addVoterCard(v);
      });
    }
  } else if (data.currentRound && data.currentRound.status === 'finished' && data.currentRound.finalResult) {
    handleRoundFinished(data.currentRound.finalResult);
  } else {
    setOverlayState('idle');
  }
});

// Racon Kralı Updated (Live Event)
socket.on('racon_updated', (data) => {
  if (data && data.leaderboard && isComponentAllowed('racon')) {
    renderRaconWidget(data.leaderboard);
  }
});

socket.on('config_updated', (cfg) => {
  appConfig = { ...appConfig, ...cfg };
  if (cfg.defaultTitle && promptTextEl && currentRoundState !== 'voting') {
    promptTextEl.innerHTML = escapeHtml(cfg.defaultTitle).replace(/\n/g, ' ');
  }
  if (cfg.defaultCategory && headerCategoryEl && currentRoundState !== 'voting') {
    headerCategoryEl.textContent = cfg.defaultCategory;
  }
});

// Raffle Event from server
socket.on('raffle_started', (data) => {
  if (!isComponentAllowed('raffle')) return;
  if (data && data.winner) {
    isRaffleActive = true;
    setOverlayState('raffle');
    runRaffleAnimation(data);
  }
});

// Round Started
socket.on('round_started', (data) => {
  if (autoHideTimeout) clearTimeout(autoHideTimeout);
  isRaffleActive = false;
  handleRoundStart(data);
});

function handleRoundStart(data) {
  isRaffleActive = false;
  if (raffleContainer) {
    raffleContainer.classList.add('hidden');
    raffleContainer.style.display = 'none';
  }

  // If standalone top3 widget mode, only maintain top3 and ignore round overlays
  if (widgetMode === 'top3') {
    if (data && data.top3Voters) {
      renderTop3Widget(data.top3Voters);
    }
    setOverlayState('voting');
    return;
  }

  // If standalone racon widget mode, only maintain racon
  if (widgetMode === 'racon') {
    setOverlayState('voting');
    return;
  }

  const title = data.title || "Chate 1-10 yazın, acımayın!";
  if (promptTextEl) promptTextEl.innerHTML = escapeHtml(title).replace(/\n/g, ' ');
  if (headerCategoryEl) headerCategoryEl.textContent = data.category || 'Chat konuşuyor';
  
  const timeLeft = data.timeLeft || data.duration || 20;
  if (headerTimeEl) headerTimeEl.textContent = `${timeLeft} sn`;
  if (bottomTimerNum) bottomTimerNum.textContent = timeLeft;
  if (headerVotesEl) headerVotesEl.textContent = `${(data.stats && data.stats.totalVotes) || 0} oy`;
  if (rightVotesCount) rightVotesCount.textContent = (data.stats && data.stats.totalVotes) || 0;
  if (headerScoreEl) headerScoreEl.textContent = (data.stats && data.stats.average) ? Number(data.stats.average).toFixed(1) : '0.0';

  // Check if this is a candidate rating round (Ekran görüntüsü 2)
  if (data.candidate && isComponentAllowed('candidate')) {
    currentTopVoter = null;
    currentCandidate = data.candidate;
    showCandidateProfileBox(data.candidate);
    if (mainPromptBox) {
      mainPromptBox.classList.add('hidden');
      mainPromptBox.style.display = 'none';
    }
    // Candidate round: Leaderboard starts fresh and only includes candidate votes
    if (leftVotersContainer && isComponentAllowed('voters')) {
      leftVotersContainer.innerHTML = '';
      leftVotersContainer.classList.remove('hidden');
      leftVotersContainer.style.display = '';
    }
  } else if (!data.candidate) {
    currentCandidate = null;
    if (candidateProfileBox) {
      candidateProfileBox.classList.add('hidden');
      candidateProfileBox.style.display = 'none';
    }
    if (bottomTimerBar) {
      bottomTimerBar.classList.add('hidden');
      bottomTimerBar.style.display = 'none';
    }
    if (rightVotesBadge) {
      rightVotesBadge.classList.add('hidden');
      rightVotesBadge.style.display = 'none';
    }
    if (mainPromptBox) {
      mainPromptBox.classList.remove('hidden');
      mainPromptBox.style.display = '';
    }
    if (leftVotersContainer) {
      leftVotersContainer.innerHTML = '';
      leftVotersContainer.classList.remove('hidden');
      leftVotersContainer.style.display = '';
    }
    // Store Top Voter data in memory
    if (data.topVoter) {
      currentTopVoter = data.topVoter;
      if (currentTopVoter.currentRoundScore !== null && currentTopVoter.currentRoundScore !== undefined) {
        renderTopVoterCard(currentTopVoter);
      }
    }
    if (data.top3Voters) {
      renderTop3Widget(data.top3Voters);
    }
  }

  if (urgencyAlertBox) {
    urgencyAlertBox.classList.add('hidden');
    urgencyAlertBox.style.display = 'none';
  }

  setOverlayState('voting');
}

// Round Tick (Each second)
socket.on('round_tick', (data) => {
  if (isRaffleActive) return;

  const timeLeft = Math.max(0, data.timeLeft);
  if (headerTimeEl) headerTimeEl.textContent = `${timeLeft} sn`;
  if (bottomTimerNum) bottomTimerNum.textContent = timeLeft;

  if (data.stats) {
    if (headerVotesEl) headerVotesEl.textContent = `${data.stats.totalVotes || 0} oy`;
    if (rightVotesCount) rightVotesCount.textContent = data.stats.totalVotes || 0;
    if (headerScoreEl) headerScoreEl.textContent = Number(data.stats.average || 0).toFixed(1);
  }

  // Show "SON X SANİYE, ACELE!" urgency box ONLY if urgency component is allowed
  if (isComponentAllowed('urgency') && urgencyAlertBox && urgencyTextEl) {
    if (timeLeft <= 10 && timeLeft > 0) {
      urgencyAlertBox.classList.remove('hidden');
      urgencyAlertBox.style.display = '';
      urgencyTextEl.textContent = `SON ${timeLeft} SANİYE, ACELE!`;
      if (timeLeft <= 5) {
        playAlertBeep();
      }
    } else {
      urgencyAlertBox.classList.add('hidden');
      urgencyAlertBox.style.display = 'none';
    }
  }
});

// Vote Received (Live)
socket.on('vote_received', (data) => {
  if (isRaffleActive) return;

  // In candidate rating round: ONLY candidate votes are registered and added to leaderboard
  if (currentCandidate) {
    if (data.vote && isComponentAllowed('voters')) {
      addVoterCard(data.vote);
    }
    if (data.stats) {
      if (headerVotesEl) headerVotesEl.textContent = `${data.stats.totalVotes || 0} oy`;
      if (rightVotesCount) rightVotesCount.textContent = data.stats.totalVotes || 0;
      if (headerScoreEl) headerScoreEl.textContent = Number(data.stats.average || 0).toFixed(1);
    }
    return;
  }

  if (data.topVoter && isComponentAllowed('voters') && leftVotersContainer) {
    currentTopVoter = data.topVoter;
    const topCard = leftVotersContainer.querySelector('.voter-card.is-top-voter');
    if (!topCard || currentTopVoter.userKey !== data.topVoter.userKey) {
      const existingRegular = leftVotersContainer.querySelector(`.voter-card[data-user-key="${data.topVoter.userKey}"]:not(.is-top-voter)`);
      if (existingRegular) existingRegular.remove();
      renderTopVoterCard(data.topVoter);
    }
  }

  if (data.top3Voters) {
    renderTop3Widget(data.top3Voters);
  }

  if (data.vote && isComponentAllowed('voters')) {
    addVoterCard(data.vote);
  }
  if (data.stats) {
    if (headerVotesEl) headerVotesEl.textContent = `${data.stats.totalVotes || 0} oy`;
    if (rightVotesCount) rightVotesCount.textContent = data.stats.totalVotes || 0;
    if (headerScoreEl) headerScoreEl.textContent = Number(data.stats.average || 0).toFixed(1);
  }
});

// Top Voter Updated (Explicit Event)
socket.on('top_voter_updated', (data) => {
  if (data && data.top3Voters && isComponentAllowed('top3')) {
    renderTop3Widget(data.top3Voters);
  }

  if (isRaffleActive || currentCandidate) return;

  currentTopVoter = data ? data.topVoter : null;
  if (currentRoundState === 'voting' && isComponentAllowed('voters') && leftVotersContainer) {
    if (currentTopVoter) {
      renderTopVoterCard(currentTopVoter);
    } else {
      const topCard = leftVotersContainer.querySelector('.voter-card.is-top-voter');
      if (topCard) {
        demoteTopCardToRegular(topCard);
      }
    }
  }
});

// Round Finished (Verdict Display)
socket.on('round_finished', (result) => {
  handleRoundFinished(result);
});

function handleRoundFinished(result) {
  if (autoHideTimeout) clearTimeout(autoHideTimeout);

  if (result && result.top3Voters) {
    renderTop3Widget(result.top3Voters);
  }

  if (isComponentAllowed('result')) {
    playVictoryJingle();
    spawnConfetti();

    const verdict = (result && result.verdict) || {};
    if (resultIconEl) resultIconEl.textContent = '';
    if (resultTitleEl) resultTitleEl.textContent = verdict.title || 'EFSANE BU';
    if (resultSubtitleEl) resultSubtitleEl.textContent = verdict.subtitle || 'rekor kırıldı galiba';
    if (resultScoreNumEl) resultScoreNumEl.textContent = result.average !== undefined ? Number(result.average).toFixed(1) : '0.0';
    if (resultVotesCountEl) resultVotesCountEl.textContent = `${result.totalVotes || 0} Oy`;
  }

  setOverlayState('finished');

  // Auto-hide after configured duration (e.g. 2.5s)
  const hideDelay = (appConfig.resultDisplayDuration || 2.5) * 1000;
  autoHideTimeout = setTimeout(() => {
    setOverlayState('idle');
  }, hideDelay);
}

// Round Reset & Raffle Stop
socket.on('round_reset', () => {
  stopAllRaffleAndOverlay();
});

socket.on('raffle_stopped', () => {
  stopAllRaffleAndOverlay();
});

// Live Title / Prompt Update
socket.on('round_title_updated', (data) => {
  if (data.title && promptTextEl) {
    promptTextEl.innerHTML = escapeHtml(data.title).replace(/\n/g, ' ');
  }
  if (data.category && headerCategoryEl) {
    headerCategoryEl.textContent = data.category;
  }
});

// Urgency Alert Trigger
socket.on('trigger_alert', (data) => {
  if (!isComponentAllowed('urgency')) return;
  if (urgencyAlertBox && urgencyTextEl) {
    urgencyTextEl.textContent = data.text || 'SON SANİYELER, ACELE!';
    urgencyAlertBox.classList.remove('hidden');
    urgencyAlertBox.style.display = '';
    playAlertBeep();
    setTimeout(() => {
      urgencyAlertBox.classList.add('hidden');
      urgencyAlertBox.style.display = 'none';
    }, 4000);
  }
});

// Set Visual State (With strict component isolation per widgetMode)
function setOverlayState(state) {
  currentRoundState = state;
  overlayScreen.className = `overlay-screen state-${state}`;

  // 0. STANDALONE TOP 3 PODIUM WIDGET
  if (widgetMode === 'top3') {
    enforceComponentIsolation();
    if (top3PodiumBox) {
      top3PodiumBox.classList.remove('hidden');
      top3PodiumBox.style.display = 'flex';
    }
    return;
  }

  // 0.1 STANDALONE RACON KRALI LEADERBOARD WIDGET
  if (widgetMode === 'racon') {
    enforceComponentIsolation();
    if (raconKraliWidget) {
      raconKraliWidget.classList.remove('hidden');
      raconKraliWidget.style.display = 'flex';
    }
    return;
  }

  // 1. STANDALONE LEADERBOARD / VOTERS FEED
  if (widgetMode === 'leaderboard') {
    enforceComponentIsolation();
    if (leftVotersContainer) {
      if (state === 'voting') {
        leftVotersContainer.classList.remove('hidden');
        leftVotersContainer.style.display = '';
      } else {
        leftVotersContainer.classList.add('hidden');
        leftVotersContainer.style.display = 'none';
        if (state === 'idle') leftVotersContainer.innerHTML = '';
      }
    }
    return;
  }

  // 2. STANDALONE SCORE / HEADER
  if (widgetMode === 'score') {
    enforceComponentIsolation();
    if (topCenterWidget) {
      if (state === 'voting') {
        topCenterWidget.classList.remove('hidden');
        topCenterWidget.style.display = '';
      } else {
        topCenterWidget.classList.add('hidden');
        topCenterWidget.style.display = 'none';
      }
    }
    return;
  }

  // 3. STANDALONE PROMPT / QUESTION BANNER
  if (widgetMode === 'prompt') {
    enforceComponentIsolation();
    if (mainPromptBox) {
      if (state === 'voting') {
        mainPromptBox.classList.remove('hidden');
        mainPromptBox.style.display = '';
      } else {
        mainPromptBox.classList.add('hidden');
        mainPromptBox.style.display = 'none';
      }
    }
    return;
  }

  // 4. STANDALONE TOP SCORE + PROMPT BANNER
  if (widgetMode === 'top_prompt') {
    enforceComponentIsolation();
    if (state === 'voting') {
      if (topCenterWidget) { topCenterWidget.classList.remove('hidden'); topCenterWidget.style.display = ''; }
      if (mainPromptBox) { mainPromptBox.classList.remove('hidden'); mainPromptBox.style.display = ''; }
    } else {
      if (topCenterWidget) { topCenterWidget.classList.add('hidden'); topCenterWidget.style.display = 'none'; }
      if (mainPromptBox) { mainPromptBox.classList.add('hidden'); mainPromptBox.style.display = 'none'; }
    }
    return;
  }

  // 5. STANDALONE URGENCY ALERT BOX
  if (widgetMode === 'urgency') {
    enforceComponentIsolation();
    return;
  }

  // 6. STANDALONE RESULT / VERDICT OVERLAY
  if (widgetMode === 'result') {
    enforceComponentIsolation();
    if (resultOverlayBox) {
      if (state === 'finished') {
        resultOverlayBox.classList.remove('hidden');
        resultOverlayBox.style.display = '';
      } else {
        resultOverlayBox.classList.add('hidden');
        resultOverlayBox.style.display = 'none';
      }
    }
    return;
  }

  // 7. FULL OVERLAY (All components in broadcast layout)
  if (state === 'raffle') {
    isRaffleActive = true;
    if (raffleContainer) { raffleContainer.classList.remove('hidden'); raffleContainer.style.display = 'flex'; }
    if (leftVotersContainer) { leftVotersContainer.innerHTML = ''; leftVotersContainer.classList.add('hidden'); leftVotersContainer.style.display = 'none'; }
    if (topCenterWidget) { topCenterWidget.classList.add('hidden'); topCenterWidget.style.display = 'none'; }
    if (mainPromptBox) { mainPromptBox.classList.add('hidden'); mainPromptBox.style.display = 'none'; }
    if (urgencyAlertBox) { urgencyAlertBox.classList.add('hidden'); urgencyAlertBox.style.display = 'none'; }
    if (resultOverlayBox) { resultOverlayBox.classList.add('hidden'); resultOverlayBox.style.display = 'none'; }
    if (top3PodiumBox) { top3PodiumBox.classList.add('hidden'); top3PodiumBox.style.display = 'none'; }
    if (candidateProfileBox) { candidateProfileBox.classList.add('hidden'); candidateProfileBox.style.display = 'none'; }
    if (bottomTimerBar) { bottomTimerBar.classList.add('hidden'); bottomTimerBar.style.display = 'none'; }
    if (rightVotesBadge) { rightVotesBadge.classList.add('hidden'); rightVotesBadge.style.display = 'none'; }
  } else if (state === 'voting') {
    if (raffleContainer) { raffleContainer.classList.add('hidden'); raffleContainer.style.display = 'none'; }
    if (topCenterWidget) { topCenterWidget.classList.remove('hidden'); topCenterWidget.style.display = ''; }
    if (leftVotersContainer) { leftVotersContainer.classList.remove('hidden'); leftVotersContainer.style.display = ''; }
    if (urgencyAlertBox) { urgencyAlertBox.classList.add('hidden'); urgencyAlertBox.style.display = 'none'; }
    if (resultOverlayBox) { resultOverlayBox.classList.add('hidden'); resultOverlayBox.style.display = 'none'; }

    if (currentCandidate) {
      if (candidateProfileBox) { candidateProfileBox.classList.remove('hidden'); candidateProfileBox.style.display = 'flex'; }
      if (bottomTimerBar) { bottomTimerBar.classList.remove('hidden'); bottomTimerBar.style.display = 'flex'; }
      if (rightVotesBadge) { rightVotesBadge.classList.remove('hidden'); rightVotesBadge.style.display = 'flex'; }
      if (mainPromptBox) { mainPromptBox.classList.add('hidden'); mainPromptBox.style.display = 'none'; }
    } else {
      if (candidateProfileBox) { candidateProfileBox.classList.add('hidden'); candidateProfileBox.style.display = 'none'; }
      if (bottomTimerBar) { bottomTimerBar.classList.add('hidden'); bottomTimerBar.style.display = 'none'; }
      if (rightVotesBadge) { rightVotesBadge.classList.add('hidden'); rightVotesBadge.style.display = 'none'; }
      if (mainPromptBox) { mainPromptBox.classList.remove('hidden'); mainPromptBox.style.display = ''; }
    }
  } else if (state === 'finished') {
    if (raffleContainer) { raffleContainer.classList.add('hidden'); raffleContainer.style.display = 'none'; }
    if (topCenterWidget) { topCenterWidget.classList.add('hidden'); topCenterWidget.style.display = 'none'; }
    if (mainPromptBox) { mainPromptBox.classList.add('hidden'); mainPromptBox.style.display = 'none'; }
    if (leftVotersContainer) { leftVotersContainer.classList.add('hidden'); leftVotersContainer.style.display = 'none'; }
    if (candidateProfileBox) { candidateProfileBox.classList.add('hidden'); candidateProfileBox.style.display = 'none'; }
    if (bottomTimerBar) { bottomTimerBar.classList.add('hidden'); bottomTimerBar.style.display = 'none'; }
    if (rightVotesBadge) { rightVotesBadge.classList.add('hidden'); rightVotesBadge.style.display = 'none'; }
    if (urgencyAlertBox) { urgencyAlertBox.classList.add('hidden'); urgencyAlertBox.style.display = 'none'; }
    if (resultOverlayBox) { resultOverlayBox.classList.remove('hidden'); resultOverlayBox.style.display = ''; }
  } else {
    // idle state
    currentCandidate = null;
    if (raffleContainer) { raffleContainer.classList.add('hidden'); raffleContainer.style.display = 'none'; }
    if (candidateProfileBox) { candidateProfileBox.classList.add('hidden'); candidateProfileBox.style.display = 'none'; }
    if (bottomTimerBar) { bottomTimerBar.classList.add('hidden'); bottomTimerBar.style.display = 'none'; }
    if (rightVotesBadge) { rightVotesBadge.classList.add('hidden'); rightVotesBadge.style.display = 'none'; }
    if (topCenterWidget) { topCenterWidget.classList.add('hidden'); topCenterWidget.style.display = 'none'; }
    if (mainPromptBox) { mainPromptBox.classList.add('hidden'); mainPromptBox.style.display = 'none'; }
    if (leftVotersContainer) {
      leftVotersContainer.innerHTML = '';
      leftVotersContainer.classList.add('hidden');
      leftVotersContainer.style.display = 'none';
    }
    if (urgencyAlertBox) { urgencyAlertBox.classList.add('hidden'); urgencyAlertBox.style.display = 'none'; }
    if (resultOverlayBox) { resultOverlayBox.classList.add('hidden'); resultOverlayBox.style.display = 'none'; }
  }
}

window.addEventListener('click', () => {
  getAudioContext();
});

function isKeyMatchOverlay(assigned, event) {
  if (!assigned) return false;
  const cleanAssigned = String(assigned).toUpperCase().trim();
  const eventCode = String(event.code || '').toUpperCase().trim();
  const eventKey = String(event.key || '').toUpperCase().trim();

  if (cleanAssigned === eventCode || cleanAssigned === eventKey) return true;
  if (cleanAssigned === 'SPACE' && (eventCode === 'SPACE' || eventKey === ' ')) return true;
  if (cleanAssigned.startsWith('KEY') && cleanAssigned.replace('KEY', '') === eventKey) return true;
  if (cleanAssigned.startsWith('DIGIT') && cleanAssigned.replace('DIGIT', '') === eventKey) return true;
  if (eventCode.startsWith('KEY') && eventCode.replace('KEY', '') === cleanAssigned) return true;
  if (eventCode.startsWith('DIGIT') && eventCode.replace('DIGIT', '') === cleanAssigned) return true;
  return false;
}

function isMouseMatchOverlay(assigned, event) {
  if (!assigned) return false;
  const up = String(assigned).toUpperCase().trim();
  if ((up === 'MOUSEMIDDLE' || up === 'MOUSE3' || up === 'MBUTTON') && event.button === 1) return true;
  if ((up === 'MOUSERIGHT' || up === 'MOUSE2' || up === 'RBUTTON') && event.button === 2) return true;
  if ((up === 'MOUSE4' || up === 'XBUTTON1' || up === 'BUTTON4' || up === 'M4') && event.button === 3) return true;
  if ((up === 'MOUSE5' || up === 'XBUTTON2' || up === 'BUTTON5' || up === 'M5') && event.button === 4) return true;
  if (up.startsWith('MOUSE')) {
    const num = parseInt(up.replace('MOUSE', ''), 10);
    if (!isNaN(num) && event.button === (num - 1)) return true;
  }
  return false;
}

let lastOverlayRoundToggle = 0;
let lastOverlayRaffleToggle = 0;

// Hotkey listener on overlay window (Round toggle & Raffle toggle)
window.addEventListener('keydown', (e) => {
  const roundHotkey = localStorage.getItem('tiktok_round_start_hotkey') || localStorage.getItem('tiktok_round_hotkey') || (appConfig && appConfig.hotkey) || 'F6';
  const raffleHotkey = localStorage.getItem('tiktok_round_raffle_hotkey') || (appConfig && appConfig.raffleHotkey) || 'F8';

  const now = Date.now();
  if (isKeyMatchOverlay(roundHotkey, e)) {
    e.preventDefault();
    if (now - lastOverlayRoundToggle < 600) return;
    lastOverlayRoundToggle = now;
    socket.emit('toggle_round');
  } else if (isKeyMatchOverlay(raffleHotkey, e)) {
    e.preventDefault();
    if (now - lastOverlayRaffleToggle < 600) return;
    lastOverlayRaffleToggle = now;
    socket.emit('toggle_raffle');
  }
});

function handleOverlayMouseTrigger(e) {
  const roundHotkey = localStorage.getItem('tiktok_round_start_hotkey') || localStorage.getItem('tiktok_round_hotkey') || (appConfig && appConfig.hotkey) || 'F6';
  const raffleHotkey = localStorage.getItem('tiktok_round_raffle_hotkey') || (appConfig && appConfig.raffleHotkey) || 'F8';

  const now = Date.now();
  if (isMouseMatchOverlay(roundHotkey, e)) {
    e.preventDefault();
    if (now - lastOverlayRoundToggle < 600) return;
    lastOverlayRoundToggle = now;
    socket.emit('toggle_round');
  } else if (isMouseMatchOverlay(raffleHotkey, e)) {
    e.preventDefault();
    if (now - lastOverlayRaffleToggle < 600) return;
    lastOverlayRaffleToggle = now;
    socket.emit('toggle_raffle');
  }
}

window.addEventListener('pointerdown', handleOverlayMouseTrigger, { capture: true, passive: false });
