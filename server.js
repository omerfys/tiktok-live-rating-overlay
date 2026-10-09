const express = require('express');
const http = require('http');
const https = require('https');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { WebcastPushConnection } = require('tiktok-live-connector');

// Load Config
const CONFIG_FILE = path.join(__dirname, 'config.json');
let config = {};

function loadConfig() {
  try {
    const data = fs.readFileSync(CONFIG_FILE, 'utf8');
    config = JSON.parse(data);
  } catch (err) {
    console.error('Config yükleme hatası, varsayılanlar kullanılıyor:', err.message);
    config = {
      port: 3000,
      tiktokUsername: '',
      roundDuration: 20,
      resultDisplayDuration: 2.5,
      defaultTitle: "Chate 1-10 yazın, acımayın!",
      defaultCategory: "Chat konuşuyor",
      allowVoteUpdate: false,
      antiTrollProtection: false,
      soundEnabled: true,
      hotkey: "F6",
      stopHotkey: "F7",
      raffleHotkey: "F8",
      ratingTiers: [
        { min: 1.0, max: 2.9, emoji: "", title: "BERBAT BU", subtitle: "chat hiç acımadı!", color: "#ef4444", badge: "F-TIER" },
        { min: 3.0, max: 4.9, emoji: "", title: "KÖTÜ BU", subtitle: "chat pek beğenmedi...", color: "#f97316", badge: "D-TIER" },
        { min: 5.0, max: 6.9, emoji: "", title: "ORTALAMA BU", subtitle: "fena değil, idare eder.", color: "#eab308", badge: "C-TIER" },
        { min: 7.0, max: 8.4, emoji: "", title: "İYİ BU", subtitle: "chatın beğenisini kazandın!", color: "#38bdf8", badge: "B-TIER" },
        { min: 8.5, max: 9.4, emoji: "", title: "HARİKA BU", subtitle: "chat bayağı yükseldi!", color: "#4ade80", badge: "A-TIER" },
        { min: 9.5, max: 10.0, emoji: "", title: "EFSANE BU", subtitle: "rekor kırıldı galiba!", color: "#fbbf24", badge: "S-TIER / REKOR" }
      ]
    };
  }
}

function saveConfig() {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
  } catch (err) {
    console.error('Config kaydetme hatası:', err.message);
  }
}

loadConfig();

// App & Socket setup
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// HTML and Extensionless Routes & Modular Overlay Endpoints
const modularRoutes = [
  '/overlay', '/overlay.html', '/overlay/:widget', '/overlay/:widget.html',
  '/leaderboard', '/leaderboard.html',
  '/top3', '/top3.html', '/podium', '/podium.html',
  '/voters', '/voters.html',
  '/score', '/score.html',
  '/prompt', '/prompt.html',
  '/top_prompt', '/top_prompt.html',
  '/urgency', '/urgency.html',
  '/result', '/result.html',
  '/raffle', '/raffle.html', '/cekilis', '/cekilis.html',
  '/racon', '/racon.html', '/racon_krali', '/racon_krali.html', '/racon-krali', '/racon-krali.html'
];

app.get(modularRoutes, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'overlay.html'));
});

app.get(['/admin', '/admin.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

// State Management
let tiktokConnection = null;
let tiktokStatus = {
  connected: false,
  username: config.tiktokUsername || '',
  roomInfo: null,
  error: null
};

let currentRound = {
  isActive: false,
  status: 'idle', // 'idle' | 'voting' | 'finished'
  title: config.defaultTitle || "Chate 1-10 yazın, acımayın!",
  category: config.defaultCategory || "Chat konuşuyor",
  duration: config.roundDuration || 20,
  timeLeft: 0,
  startTime: null,
  votes: {}, // userId -> { username, nickname, avatar, score, timestamp }
  stats: {
    totalVotes: 0,
    sum: 0,
    average: 0,
    breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 },
    recentVotes: []
  },
  finalResult: null
};

let timerInterval = null;
let simulationInterval = null;
let hotkeyProcess = null;

// Start Native Windows Hotkey Process (Toggle Round & Toggle Raffle Hotkeys)
function startNativeHotkeyService(startKey, raffleKey) {
  if (hotkeyProcess) {
    try {
      hotkeyProcess.kill();
    } catch (e) {}
    hotkeyProcess = null;
  }

  const startK = (startKey !== undefined ? startKey : (config.hotkey || 'F6')).trim();
  const raffleK = (raffleKey !== undefined ? raffleKey : (config.raffleHotkey || 'F8')).trim();
  const scriptPath = path.join(__dirname, 'hotkey_listener.ps1');

  if (!fs.existsSync(scriptPath)) return;

  try {
    hotkeyProcess = spawn('powershell.exe', [
      '-ExecutionPolicy', 'Bypass',
      '-NoProfile',
      '-WindowStyle', 'Hidden',
      '-File', scriptPath,
      '-StartKey', startK,
      '-RaffleKey', raffleK,
      '-Port', String(config.port || 3000)
    ], {
      windowsHide: true,
      stdio: 'ignore'
    });

    hotkeyProcess.on('error', (err) => {
      console.warn('[GLOBAL HOTKEY] PowerShell hook çalıştırılamadı:', err.message);
    });

    console.log(`[GLOBAL HOTKEY] Windows genelinde aktif! Oylama (Başlat/Bitir): [${startK || 'Yok'}] | Çekiliş (Başlat/Durdur): [${raffleK || 'Yok'}] (Sekme alttayken de çalışır)`);
  } catch (err) {
    console.warn('[GLOBAL HOTKEY] Hata:', err.message);
  }
}

// Unicode Styled Font & Fancy Nickname Cleaner Map (Handles Mathematical fonts, Small caps, Circled, etc.)
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

// Vote Parser Helper (Supports regular numbers, math unicode numbers, 10/10, natural language)
function parseVoteFromText(text) {
  if (!text || typeof text !== 'string') return null;

  // Normalize styled/fancy Unicode digits and text
  let clean = text;
  for (const [key, val] of Object.entries(UNICODE_STYLE_MAP)) {
    if (clean.includes(key)) clean = clean.split(key).join(val);
  }
  clean = clean.normalize('NFKC').trim();

  // 1. Direct number check
  if (/^10$/.test(clean)) return 10;
  if (/^[1-9]$/.test(clean)) return parseInt(clean, 10);

  // 2. Score format like "10/10", "8/10", "9 / 10"
  const slashMatch = clean.match(/^([1-9]|10)\s*\/\s*10/i);
  if (slashMatch) {
    return parseInt(slashMatch[1], 10);
  }

  // 3. Natural language check: "puanım 9", "bence 10", "verdim 7", "notum 8", "10 verdim", "10 bence"
  const regex = /(?:^|\b)(10|[1-9])(?:\b|$|\.|\!|\s)/;
  const match = clean.match(regex);
  if (match) {
    const num = parseInt(match[1], 10);
    if (num >= 1 && num <= 10) {
      if (/\b(?:100|\d{2,})\b/.test(clean) && num !== 10) {
        return null;
      }
      return num;
    }
  }

  return null;
}

// Rating Verdict Helper
function getRatingVerdict(avgScore) {
  const avg = parseFloat(avgScore);
  if (isNaN(avg) || avg <= 0) {
    return {
      title: "OY YOK",
      subtitle: "Chatten geçerli puan gelmedi.",
      color: "#6b7280",
      badge: "YORUMSUZ",
      gradient: "linear-gradient(135deg, #4b5563, #374151)"
    };
  }

  const tiers = config.ratingTiers || [];
  for (const tier of tiers) {
    if (avg >= tier.min && avg <= tier.max) {
      return tier;
    }
  }

  if (avg < 1) return tiers[0] || { title: "BERBAT BU", subtitle: "Çok düşük puan!", color: "#ef4444" };
  return tiers[tiers.length - 1] || { title: "EFSANE BU", subtitle: "Kusursuz!", color: "#fbbf24" };
}

// Recalculate Round Stats
function calculateRoundStats() {
  const votesList = Object.values(currentRound.votes);
  const totalVotes = votesList.length;
  const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 };
  let sum = 0;

  votesList.forEach(v => {
    sum += v.score;
    if (breakdown[v.score] !== undefined) {
      breakdown[v.score]++;
    }
  });

  const average = totalVotes > 0 ? parseFloat((sum / totalVotes).toFixed(1)) : 0;
  
  const recentVotes = [...votesList]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 10);

  currentRound.stats = {
    totalVotes,
    sum,
    average,
    breakdown,
    recentVotes
  };

  return currentRound.stats;
}

// Persistent Avatar Cache (Keeps chatters' avatars across rounds and duplicate packets)
const avatarCache = new Map();

// Pre-Round Message & Timestamp Tracking (Ensures previous chat messages are NEVER included in new rounds)
let lastSeenPreRoundCreateTime = 0;
const preRoundMessageIds = new Set();

function markPreRoundMessage(msgId, createTime) {
  if (msgId) {
    preRoundMessageIds.add(String(msgId));
    if (preRoundMessageIds.size > 5000) {
      const first = preRoundMessageIds.values().next().value;
      preRoundMessageIds.delete(first);
    }
  }
  if (createTime && createTime > lastSeenPreRoundCreateTime) {
    lastSeenPreRoundCreateTime = createTime;
  }
}

function extractMessageTimestamp(data) {
  if (!data || typeof data !== 'object') return null;
  const rawTime = data.createTime || data.create_time || data.timestamp || data.time || data.createdAt || data.created_at ||
                  data.user?.createTime || data.userDetails?.createTime;
  if (!rawTime) return null;
  let num = Number(rawTime);
  if (isNaN(num) || num <= 0) return null;
  if (num < 10000000000) {
    num = num * 1000;
  }
  return num;
}

function extractMessageId(data) {
  if (!data || typeof data !== 'object') return null;
  const rawId = data.msgId || data.messageId || data.commentId || data.id || data.msg_id || data.comment_id;
  if (rawId) return String(rawId);
  return null;
}

// User Rating History for Anti-Troll / Rating Manipulation Protection (üst üste 1 puan spam engelleme)
let currentRoundNumber = 0;
const userScoreHistory = new Map(); // userKey -> { lastScore, roundNumber, timestamp }

// Rolling round history for dynamic top voter calculation across the last 5 hands
const VOTER_HISTORY_FILE = path.join(__dirname, 'voter_history.json');
let recentRoundsHistory = [];
const cumulativeVoterStats = new Map(); // userKey -> { userKey, username, nickname, avatar, totalVotesGiven, sumScoresGiven, scoresList }
let lastRoundVoters = []; // Eligible voters from the latest completed round
let lastRaffleResult = null;
let candidateRoundTimer = null;

function loadVoterHistory() {
  try {
    if (fs.existsSync(VOTER_HISTORY_FILE)) {
      const raw = fs.readFileSync(VOTER_HISTORY_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        recentRoundsHistory = parsed;
        // Populate cumulative stats and last round voters from history
        recentRoundsHistory.forEach(r => {
          if (r && r.votes) {
            Object.values(r.votes).forEach(v => {
              if (!v) return;
              const key = String(v.userId || v.username || '').toLowerCase().replace(/^@/, '');
              if (!key) return;
              let cum = cumulativeVoterStats.get(key);
              if (!cum) {
                cum = {
                  userKey: key,
                  username: v.username || key,
                  nickname: v.nickname || v.username || key,
                  avatar: v.avatar || '',
                  totalVotesGiven: 0,
                  sumScoresGiven: 0,
                  scoresList: []
                };
                cumulativeVoterStats.set(key, cum);
              }
              cum.totalVotesGiven++;
              cum.sumScoresGiven += (v.score || 7);
              cum.scoresList.push(v.score || 7);
              if (v.avatar) cum.avatar = v.avatar;
            });
          }
        });
        if (recentRoundsHistory.length > 0) {
          const lastR = recentRoundsHistory[recentRoundsHistory.length - 1];
          if (lastR && lastR.votes) {
            lastRoundVoters = Object.values(lastR.votes);
          }
        }
      }
    }
  } catch (e) {
    recentRoundsHistory = [];
  }
}

function saveVoterHistory() {
  try {
    fs.writeFileSync(VOTER_HISTORY_FILE, JSON.stringify(recentRoundsHistory.slice(-20), null, 2), 'utf8');
  } catch (e) {}
}

loadVoterHistory();

// ==================== RACON KRALI TOP 5 LEADERBOARD ====================
const RACON_HISTORY_FILE = path.join(__dirname, 'racon_history.json');
const raconLeaderboardMap = new Map(); // userKey -> { userKey, username, nickname, avatar, score, lastUpdated }

const DEFAULT_RACON_LEADERBOARD = [
  { rank: 1, userKey: 'bayram', username: 'Bayram', nickname: 'Bayram', avatar: '', score: 420, badgeTitle: 'SAĞ KOL', badgeIcon: 'arm', badgeClass: 'badge-cyan' },
  { rank: 2, userKey: 'ananad', username: 'ananad', nickname: 'ananad', avatar: '', score: 315, badgeTitle: 'SAĞ KOL', badgeIcon: 'arm', badgeClass: 'badge-cyan' },
  { rank: 3, userKey: 'dogancan', username: 'dogancan', nickname: 'dogancan', avatar: '', score: 305, badgeTitle: 'SAĞ KOL', badgeIcon: 'arm', badgeClass: 'badge-cyan' },
  { rank: 4, userKey: 'celalmihm', username: 'celalmihm', nickname: 'celalmihm', avatar: '', score: 200, badgeTitle: 'RACON KESEN', badgeIcon: 'square', badgeClass: 'badge-yellow' },
  { rank: 5, userKey: 'burak', username: 'burak', nickname: 'burak', avatar: '', score: 200, badgeTitle: 'RACON KESEN', badgeIcon: 'square', badgeClass: 'badge-yellow' }
];

function loadRaconHistory() {
  try {
    if (fs.existsSync(RACON_HISTORY_FILE)) {
      const raw = fs.readFileSync(RACON_HISTORY_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        parsed.forEach(item => {
          if (!item) return;
          const key = String(item.userKey || item.username || '').toLowerCase().replace(/^@/, '');
          if (!key) return;
          raconLeaderboardMap.set(key, {
            userKey: key,
            username: item.username || key,
            nickname: sanitizeNickname(item.nickname || item.username || key, key),
            avatar: item.avatar || (avatarCache.has(key) ? avatarCache.get(key) : ''),
            score: parseInt(item.score, 10) || 0,
            lastUpdated: item.lastUpdated || Date.now()
          });
        });
      }
    }
  } catch (e) {
    console.warn('[RACON HISTORY] Yükleme hatası:', e.message);
  }
}

function saveRaconHistory() {
  try {
    const arr = Array.from(raconLeaderboardMap.values());
    fs.writeFileSync(RACON_HISTORY_FILE, JSON.stringify(arr, null, 2), 'utf8');
  } catch (e) {
    console.warn('[RACON HISTORY] Kayıt hatası:', e.message);
  }
}

loadRaconHistory();

function getRaconBadge(rank) {
  if (rank === 1) {
    return { badgeTitle: 'SAĞ KOL', badgeIcon: 'baklava', badgeClass: 'badge-cyan' };
  } else if (rank === 2 || rank === 3) {
    return { badgeTitle: 'SAĞ KOL', badgeIcon: 'baklava', badgeClass: 'badge-cyan' };
  } else {
    return { badgeTitle: 'RACON KESEN', badgeIcon: 'square', badgeClass: 'badge-yellow' };
  }
}

function getRaconLeaderboard(limit = 5) {
  if (raconLeaderboardMap.size === 0) {
    return DEFAULT_RACON_LEADERBOARD.slice(0, limit);
  }

  const sorted = Array.from(raconLeaderboardMap.values()).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.lastUpdated || 0) - (a.lastUpdated || 0);
  });

  const res = sorted.slice(0, limit).map((item, idx) => {
    const rank = idx + 1;
    const badge = getRaconBadge(rank);
    return {
      rank,
      userKey: item.userKey,
      username: item.username,
      nickname: item.nickname || item.username,
      avatar: item.avatar || (avatarCache.has(item.userKey) ? avatarCache.get(item.userKey) : ''),
      score: item.score,
      badgeTitle: badge.badgeTitle,
      badgeIcon: badge.badgeIcon,
      badgeClass: badge.badgeClass
    };
  });

  // If fewer than limit, fill with remaining default slots so layout is full
  if (res.length < limit) {
    const existingKeys = new Set(res.map(r => r.userKey));
    for (const def of DEFAULT_RACON_LEADERBOARD) {
      if (res.length >= limit) break;
      if (!existingKeys.has(def.userKey)) {
        res.push({
          ...def,
          rank: res.length + 1,
          ...getRaconBadge(res.length + 1)
        });
      }
    }
  }

  return res.slice(0, limit);
}

function addRaconPoints({ username, nickname, avatar, amount = 1 }) {
  const rawUser = String(username || '').trim();
  const cleanUsername = rawUser.replace(/^@/, '');
  const userKey = cleanUsername.toLowerCase();
  if (!userKey) return null;

  const cleanNick = sanitizeNickname(nickname || cleanUsername || rawUser, cleanUsername);
  let finalAvatar = (typeof avatar === 'string' && avatar.trim().length > 0) ? avatar.trim() : '';
  if (finalAvatar.startsWith('//')) finalAvatar = 'https:' + finalAvatar;
  if (finalAvatar) avatarCache.set(userKey, finalAvatar);
  else if (avatarCache.has(userKey)) finalAvatar = avatarCache.get(userKey);

  const addScore = parseInt(amount, 10) || 1;
  let entry = raconLeaderboardMap.get(userKey);

  if (!entry) {
    entry = {
      userKey,
      username: cleanUsername || rawUser,
      nickname: cleanNick,
      avatar: finalAvatar,
      score: 0,
      lastUpdated: Date.now()
    };
    raconLeaderboardMap.set(userKey, entry);
  }

  entry.score += addScore;
  entry.lastUpdated = Date.now();
  if (finalAvatar) entry.avatar = finalAvatar;
  entry.nickname = cleanNick;

  saveRaconHistory();

  const currentList = getRaconLeaderboard(5);
  io.emit('racon_updated', {
    leaderboard: currentList,
    updatedUser: { ...entry, addScore }
  });

  return currentList;
}

function setRaconScore({ username, nickname, avatar, score }) {
  const rawUser = String(username || '').trim();
  const cleanUsername = rawUser.replace(/^@/, '');
  const userKey = cleanUsername.toLowerCase();
  if (!userKey) return null;

  const cleanNick = sanitizeNickname(nickname || cleanUsername || rawUser, cleanUsername);
  let finalAvatar = (typeof avatar === 'string' && avatar.trim().length > 0) ? avatar.trim() : '';
  if (finalAvatar) avatarCache.set(userKey, finalAvatar);
  else if (avatarCache.has(userKey)) finalAvatar = avatarCache.get(userKey);

  const newScore = parseInt(score, 10) || 0;
  let entry = raconLeaderboardMap.get(userKey);
  if (!entry) {
    entry = {
      userKey,
      username: cleanUsername,
      nickname: cleanNick,
      avatar: finalAvatar,
      score: newScore,
      lastUpdated: Date.now()
    };
    raconLeaderboardMap.set(userKey, entry);
  } else {
    entry.score = newScore;
    entry.lastUpdated = Date.now();
    if (finalAvatar) entry.avatar = finalAvatar;
    entry.nickname = cleanNick;
  }

  saveRaconHistory();
  const currentList = getRaconLeaderboard(5);
  io.emit('racon_updated', { leaderboard: currentList });
  return currentList;
}

function resetRaconLeaderboard() {
  raconLeaderboardMap.clear();
  try {
    if (fs.existsSync(RACON_HISTORY_FILE)) {
      fs.unlinkSync(RACON_HISTORY_FILE);
    }
  } catch (e) {}

  const defaultList = getRaconLeaderboard(5);
  io.emit('racon_updated', { leaderboard: defaultList });
  console.log('[RACON KRALI] Sıralama sıfırlandı.');
  return defaultList;
}

let raconSimTimeouts = [];
function startRaconSimulation() {
  raconSimTimeouts.forEach(t => clearTimeout(t));
  raconSimTimeouts = [];

  const candidates = {
    bayram: { userKey: 'bayram', username: 'Bayram', nickname: 'Bayram', avatar: '' },
    ananad: { userKey: 'ananad', username: 'ananad', nickname: 'ananad', avatar: '' },
    dogancan: { userKey: 'dogancan', username: 'dogancan', nickname: 'dogancan', avatar: '' },
    celalmihm: { userKey: 'celalmihm', username: 'celalmihm', nickname: 'celalmihm', avatar: '' },
    burak: { userKey: 'burak', username: 'burak', nickname: 'burak', avatar: '' }
  };

  const steps = [
    // Adım 1 (0s): Başlangıç tablosu
    {
      delay: 0,
      list: [
        { ...candidates.bayram, rank: 1, score: 420, ...getRaconBadge(1) },
        { ...candidates.ananad, rank: 2, score: 315, ...getRaconBadge(2) },
        { ...candidates.dogancan, rank: 3, score: 305, ...getRaconBadge(3) },
        { ...candidates.celalmihm, rank: 4, score: 200, ...getRaconBadge(4) },
        { ...candidates.burak, rank: 5, score: 200, ...getRaconBadge(5) }
      ]
    },
    // Adım 2 (+2.5s): dogancan +20x alır -> 325x -> 2. sıraya yükselir!
    {
      delay: 2500,
      list: [
        { ...candidates.bayram, rank: 1, score: 420, ...getRaconBadge(1) },
        { ...candidates.dogancan, rank: 2, score: 325, ...getRaconBadge(2) },
        { ...candidates.ananad, rank: 3, score: 315, ...getRaconBadge(3) },
        { ...candidates.celalmihm, rank: 4, score: 200, ...getRaconBadge(4) },
        { ...candidates.burak, rank: 5, score: 200, ...getRaconBadge(5) }
      ]
    },
    // Adım 3 (+5.0s): ananad +110x dev hediye patlatır -> 425x -> BAYRAM'I GEÇİP 1. SIRAYA YERLEŞİR (Taç Değişimi & Altın Işıma)!
    {
      delay: 5000,
      list: [
        { ...candidates.ananad, rank: 1, score: 425, ...getRaconBadge(1) },
        { ...candidates.bayram, rank: 2, score: 420, ...getRaconBadge(2) },
        { ...candidates.dogancan, rank: 3, score: 325, ...getRaconBadge(3) },
        { ...candidates.celalmihm, rank: 4, score: 200, ...getRaconBadge(4) },
        { ...candidates.burak, rank: 5, score: 200, ...getRaconBadge(5) }
      ]
    },
    // Adım 4 (+7.5s): celalmihm +130x alır -> 330x -> 3. sıraya sıçrar!
    {
      delay: 7500,
      list: [
        { ...candidates.ananad, rank: 1, score: 425, ...getRaconBadge(1) },
        { ...candidates.bayram, rank: 2, score: 420, ...getRaconBadge(2) },
        { ...candidates.celalmihm, rank: 3, score: 330, ...getRaconBadge(3) },
        { ...candidates.dogancan, rank: 4, score: 325, ...getRaconBadge(4) },
        { ...candidates.burak, rank: 5, score: 200, ...getRaconBadge(5) }
      ]
    },
    // Adım 5 (+10.0s): Bayram +60x hediye gönderir -> 480x -> 1. LİĞİ GERİ ALIR (Kral Dönüşü)!
    {
      delay: 10000,
      list: [
        { ...candidates.bayram, rank: 1, score: 480, ...getRaconBadge(1) },
        { ...candidates.ananad, rank: 2, score: 425, ...getRaconBadge(2) },
        { ...candidates.celalmihm, rank: 3, score: 330, ...getRaconBadge(3) },
        { ...candidates.dogancan, rank: 4, score: 325, ...getRaconBadge(4) },
        { ...candidates.burak, rank: 5, score: 200, ...getRaconBadge(5) }
      ]
    },
    // Adım 6 (+12.5s): burak +140x alır -> 340x -> 3. sıraya yükselir!
    {
      delay: 12500,
      list: [
        { ...candidates.bayram, rank: 1, score: 480, ...getRaconBadge(1) },
        { ...candidates.ananad, rank: 2, score: 425, ...getRaconBadge(2) },
        { ...candidates.burak, rank: 3, score: 340, ...getRaconBadge(3) },
        { ...candidates.celalmihm, rank: 4, score: 330, ...getRaconBadge(4) },
        { ...candidates.dogancan, rank: 5, score: 325, ...getRaconBadge(5) }
      ]
    }
  ];

  steps.forEach((step, idx) => {
    const t = setTimeout(() => {
      io.emit('racon_updated', {
        leaderboard: step.list
      });
      console.log(`[RACON SİMÜLASYON - Adım ${idx + 1}/${steps.length}] 1. ${step.list[0].nickname} (${step.list[0].score}x) | 2. ${step.list[1].nickname} (${step.list[1].score}x) | 3. ${step.list[2].nickname} (${step.list[2].score}x)`);
    }, step.delay);
    raconSimTimeouts.push(t);
  });

  return steps[0].list;
}

// Cumulative stats helper for candidate profile
function getUserCumulativeStats(userKey) {
  const cleanKey = String(userKey || '').toLowerCase().replace(/^@/, '');
  const stats = cumulativeVoterStats.get(cleanKey);
  if (!stats || stats.totalVotesGiven === 0) {
    return {
      averageScoreGiven: 6.5,
      totalVotesGiven: 1,
      lastScore: 7
    };
  }
  const avg = parseFloat((stats.sumScoresGiven / stats.totalVotesGiven).toFixed(1));
  return {
    averageScoreGiven: avg,
    totalVotesGiven: stats.totalVotesGiven,
    lastScore: stats.scoresList[stats.scoresList.length - 1] || 7
  };
}

// Helper to check if a payload originates from a chat comment/message
function isChatMessagePayload(payload = {}, query = {}) {
  if (!payload && !query) return false;
  const p = (typeof payload === 'object' && payload !== null) ? payload : {};
  const q = (typeof query === 'object' && query !== null) ? query : {};
  const dataObj = (typeof p.data === 'object' && p.data !== null) ? p.data : {};

  const eventName = String(p.event || p.type || p.action || q.event || q.type || q.action || '').toLowerCase();
  if (['chat', 'comment', 'message', 'msg', 'gift', 'share', 'like', 'follow'].includes(eventName)) {
    return true;
  }

  const commentText = (
    dataObj.comment || dataObj.message || dataObj.text || dataObj.content || dataObj.msg ||
    p.comment || p.message || p.text || p.content || p.msg ||
    q.comment || q.message || q.text
  );

  if (commentText !== undefined && commentText !== null && String(commentText).trim().length > 0) {
    return true;
  }

  if ((p.uniqueId || p.userId || dataObj.uniqueId || dataObj.userId) && (p.score !== undefined || dataObj.score !== undefined || commentText !== undefined)) {
    return true;
  }

  return false;
}

// Eligible participants pool for raffle: Strictly from previous completed round voters
function getEligibleRaffleParticipants() {
  if (lastRoundVoters && lastRoundVoters.length > 0) {
    return [...lastRoundVoters];
  }
  if (recentRoundsHistory.length > 0) {
    for (let i = recentRoundsHistory.length - 1; i >= 0; i--) {
      const r = recentRoundsHistory[i];
      if (r && r.votes && Object.keys(r.votes).length > 0) {
        return Object.values(r.votes);
      }
    }
  }
  return [];
}

// Çekiliş Başlatma (CS Kasa Açılımı Ruleti - Yalnızca bir önceki turda oy verenlerden)
function startRaffle(options = {}) {
  // If triggered unintentionally with a chat comment payload, reject immediately
  if (isChatMessagePayload(options)) {
    console.log('[ÇEKİLİŞ ENGELLENDİ] Chat/Yorum mesajı çekiliş başlatamaz!');
    return { success: false, message: 'Chat mesajları çekiliş başlatamaz.' };
  }

  // If a round is actively running or counting down, STOP it immediately!
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }

  const isExplicitTest = !!(options.isTest || (Array.isArray(options.participants) && options.participants.length > 0));

  let list = options.participants;
  if (!list || !Array.isArray(list) || list.length === 0) {
    list = getEligibleRaffleParticipants();
  }

  // Deduplicate and sanitize participants by unique userKey
  const uniqueMap = new Map();
  if (Array.isArray(list)) {
    for (const item of list) {
      if (!item) continue;
      const rawUser = String(item.userKey || item.userId || item.username || '').trim();
      const cleanUsername = rawUser.replace(/^@/, '');
      const key = cleanUsername.toLowerCase();
      if (!key) continue;

      if (!uniqueMap.has(key)) {
        const avatar = item.avatar || (avatarCache.has(key) ? avatarCache.get(key) : '');
        const cleanNick = sanitizeNickname(item.nickname || item.username || cleanUsername, cleanUsername);
        uniqueMap.set(key, {
          userKey: key,
          username: item.username || cleanUsername,
          nickname: cleanNick,
          avatar: avatar,
          score: item.score || 7
        });
      }
    }
  }
  list = Array.from(uniqueMap.values());

  // If still empty:
  if (list.length === 0) {
    if (isExplicitTest) {
      // Realistic demo participants matching screenshots only for test button
      list = [
        { userKey: 'ok_voter', username: 'O.K', nickname: 'O.K', avatar: '', score: 10 },
        { userKey: 'secel', username: 'Secel', nickname: 'Secel', avatar: '', score: 10 },
        { userKey: 'ultraslan81', username: 'ultraslan.81', nickname: 'ultraslan.81', avatar: '', score: 1 },
        { userKey: 'ahmetzafer', username: 'ahmetzafer', nickname: 'ahmetzafer', avatar: '', score: 6 },
        { userKey: 'can_berk', username: 'Can_Berk', nickname: 'Can Berk', avatar: '', score: 9 },
        { userKey: 'eren_g', username: 'ErenGamer', nickname: 'Eren', avatar: '', score: 8 }
      ];
    } else {
      console.warn('[ÇEKİLİŞ UYARI] Önceki turda oy veren katılımcı bulunamadı!');
      return {
        success: false,
        message: 'Önceki turda oy veren katılımcı bulunamadı. Çekiliş için önce en az bir oylama turu tamamlanmalıdır.',
        participantCount: 0
      };
    }
  }

  currentRound.isActive = false;
  currentRound.status = 'raffle';
  currentRound.timeLeft = 0;
  currentRound.candidate = null;
  currentRound.isCandidateRound = false;
  currentRound.votes = {};
  calculateRoundStats();
  lastSeenPreRoundCreateTime = Date.now();

  // Pick random winner
  const winnerIndex = Math.floor(Math.random() * list.length);
  const picked = list[winnerIndex];
  const userKey = picked.userKey;
  const cumStats = getUserCumulativeStats(userKey);
  const winChance = Math.max(1, Math.round(100 / list.length));

  const winner = {
    userKey,
    username: picked.username,
    nickname: picked.nickname,
    avatar: getHighResAvatarUrl(picked.avatar || (avatarCache.has(userKey) ? avatarCache.get(userKey) : ''), 720),
    score: picked.score,
    averageScoreGiven: cumStats.averageScoreGiven,
    totalVotesGiven: cumStats.totalVotesGiven,
    winChance: `${winChance}%`
  };

  const raffleDuration = options.duration || 6000;

  lastRaffleResult = {
    participants: list,
    winner,
    duration: raffleDuration,
    timestamp: Date.now()
  };

  console.log(`[ÇEKİLİŞ BAŞLADI] Katılımcı (Önceki Tur): ${list.length} | Kazanan: @${winner.username} (${winner.nickname})`);

  io.emit('raffle_started', {
    participants: list,
    winner,
    duration: raffleDuration,
    autoStartCandidateRound: options.autoStartCandidateRound !== false
  });

  // Automatically start candidate rating round when roulette stops and candidate profile zooms in (6000ms + 1600ms = 7600ms)
  if (options.autoStartCandidateRound !== false) {
    if (candidateRoundTimer) clearTimeout(candidateRoundTimer);
    candidateRoundTimer = setTimeout(() => {
      startCandidateRatingRound(winner, options.candidateRoundDuration || 20, !!options.simulateVotes);
    }, raffleDuration + 1600);
  }

  return { success: true, winner, participantCount: list.length };
}

// Aday Oylama Turu Simülasyonu (Test Çekilişi Yapıldığında Otomatik Rastgele Oylar Gönderir)
function startCandidateVoteSimulation(bias = 'random') {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }

  const sampleChatters = [
    { username: "Ahmet_TR", nickname: "Ahmet", avatar: "" },
    { username: "Zeynep_K", nickname: "Zeynep", avatar: "" },
    { username: "ErenGamer", nickname: "Eren", avatar: "" },
    { username: "Ayse_06", nickname: "Ayşe Nur", avatar: "" },
    { username: "BarisStream", nickname: "Barış", avatar: "" },
    { username: "ElifYilmaz", nickname: "Elif Y.", avatar: "" },
    { username: "Can_Berk", nickname: "Can Berk", avatar: "" },
    { username: "MertOnline", nickname: "Mert", avatar: "" },
    { username: "Selin_34", nickname: "Selin", avatar: "" },
    { username: "BurakKing", nickname: "Burak", avatar: "" },
    { username: "Melis_A", nickname: "Melis", avatar: "" },
    { username: "Tolga_07", nickname: "Tolga", avatar: "" },
    { username: "Derya_X", nickname: "Derya", avatar: "" },
    { username: "Volkan_Pro", nickname: "Volkan", avatar: "" },
    { username: "Buseee", nickname: "Buse", avatar: "" },
    { username: "Kemal_K", nickname: "Kemal", avatar: "" },
    { username: "Emre_01", nickname: "Emre", avatar: "" },
    { username: "Nazli_Can", nickname: "Nazlı", avatar: "" }
  ];

  let voteCount = 0;
  const targetVotes = 12 + Math.floor(Math.random() * 6); // 12-17 votes

  simulationInterval = setInterval(() => {
    if (!currentRound.isActive || !currentRound.isCandidateRound) {
      clearInterval(simulationInterval);
      simulationInterval = null;
      return;
    }

    const chatter = sampleChatters[voteCount % sampleChatters.length];
    const uniqueUser = chatter.username + (Math.floor(Math.random() * 90) + 10);

    let score;
    if (bias === 'high') {
      score = Math.floor(Math.random() * 3) + 8; // 8, 9, 10
    } else if (bias === 'low') {
      score = Math.floor(Math.random() * 3) + 1; // 1, 2, 3
    } else if (bias === 'mid') {
      score = Math.floor(Math.random() * 3) + 5; // 5, 6, 7
    } else {
      const rand = Math.random();
      if (rand < 0.20) score = Math.floor(Math.random() * 4) + 2; // 2..5
      else if (rand < 0.55) score = Math.floor(Math.random() * 3) + 6; // 6..8
      else score = Math.floor(Math.random() * 2) + 9; // 9..10
    }

    registerVote({
      userId: uniqueUser,
      username: uniqueUser,
      nickname: chatter.nickname,
      avatar: chatter.avatar,
      score: score
    });

    voteCount++;
    if (voteCount >= targetVotes) {
      clearInterval(simulationInterval);
      simulationInterval = null;
    }
  }, 750);
}

// Profil Puanlama Turu Başlatma (Seçilen kişiyi chatin oylaması)
function startCandidateRatingRound(candidate, duration = 20, simulate = false) {
  const roundDuration = duration || config.roundDuration || 20;
  console.log(`[ADAY OYLAMASI BAŞLADI] Aday: @${candidate.username} (${candidate.nickname})${simulate ? ' [SİMÜLASYON AKTİF]' : ''}`);
  startRound({
    duration: roundDuration,
    title: `@${candidate.nickname || candidate.username} Puanlayın (1-10)`,
    category: "Chat konuşuyor",
    candidate: candidate
  });

  if (simulate) {
    // Aday resmi ekranda büyüdükten 1 saniye sonra simüle oylar yağmaya başlasın
    setTimeout(() => {
      if (currentRound.isActive && currentRound.isCandidateRound) {
        startCandidateVoteSimulation();
      }
    }, 1000);
  }
}

// Dynamic Rolling Window: Calculate the top N voters across the last 5 hands (Son 5 el)
function getRecentTopVoters(count = 3, windowSize = 5) {
  const roundsToInspect = [];

  // Completed rounds from history (up to windowSize)
  for (let i = recentRoundsHistory.length - 1; i >= 0 && roundsToInspect.length < windowSize; i--) {
    roundsToInspect.unshift(recentRoundsHistory[i]);
  }

  const hasCurrentVotes = currentRound.votes && Object.keys(currentRound.votes).length > 0;
  const userStats = new Map();

  function processRoundVotes(votesObj, isCurrentRound) {
    if (!votesObj) return;
    for (const [key, v] of Object.entries(votesObj)) {
      if (!v) continue;
      const cleanKey = String(key || v.username || v.userId || '').toLowerCase().replace(/^@/, '');
      if (!cleanKey) continue;

      if (!userStats.has(cleanKey)) {
        userStats.set(cleanKey, {
          userKey: cleanKey,
          username: v.username || cleanKey,
          nickname: v.nickname || v.username || cleanKey,
          avatar: v.avatar || (avatarCache.has(cleanKey) ? avatarCache.get(cleanKey) : ''),
          voteCount: 0,
          lastScore: v.score,
          lastTimestamp: v.timestamp || 0,
          currentRoundScore: isCurrentRound ? v.score : null
        });
      }

      const entry = userStats.get(cleanKey);
      entry.voteCount++;
      if (v.avatar && (!entry.avatar || entry.avatar.startsWith('data:'))) {
        entry.avatar = v.avatar;
      }
      if (v.timestamp && v.timestamp >= entry.lastTimestamp) {
        entry.lastTimestamp = v.timestamp;
        entry.lastScore = v.score;
      }
      if (isCurrentRound) {
        entry.currentRoundScore = v.score;
      }
    }
  }

  // If current round has votes, inspect (windowSize - 1) previous rounds + current round
  if (hasCurrentVotes) {
    const trimmedCompleted = roundsToInspect.slice(-(windowSize - 1));
    for (const r of trimmedCompleted) {
      processRoundVotes(r.votes, false);
    }
    processRoundVotes(currentRound.votes, true);
  } else {
    // Current round doesn't have votes yet, inspect up to windowSize completed rounds
    const trimmedCompleted = roundsToInspect.slice(-windowSize);
    for (const r of trimmedCompleted) {
      processRoundVotes(r.votes, false);
    }
  }

  // If fewer than count voters, pull earlier voters from history so all podium slots can be filled
  if (userStats.size < count && recentRoundsHistory.length > windowSize) {
    for (let i = recentRoundsHistory.length - windowSize - 1; i >= 0 && userStats.size < count; i--) {
      const r = recentRoundsHistory[i];
      if (r && r.votes) {
        for (const [key, v] of Object.entries(r.votes)) {
          const cleanKey = String(key || v.username || v.userId || '').toLowerCase().replace(/^@/, '');
          if (cleanKey && !userStats.has(cleanKey)) {
            userStats.set(cleanKey, {
              userKey: cleanKey,
              username: v.username || cleanKey,
              nickname: v.nickname || v.username || cleanKey,
              avatar: v.avatar || (avatarCache.has(cleanKey) ? avatarCache.get(cleanKey) : ''),
              voteCount: 1,
              lastScore: v.score,
              lastTimestamp: v.timestamp || 0,
              currentRoundScore: null
            });
          }
        }
      }
    }
  }

  if (userStats.size === 0) {
    return [
      {
        rank: 1,
        userKey: 'ahmet_zafer',
        username: 'ahmet_zafer',
        nickname: 'Ahmet Zafer',
        avatar: '',
        voteCount: 5,
        maxRounds: windowSize,
        lastScore: 10,
        currentRoundScore: (currentRound.votes && currentRound.votes['ahmet_zafer']) ? currentRound.votes['ahmet_zafer'].score : null
      },
      {
        rank: 2,
        userKey: 'zeynep_kaya',
        username: 'zeynep_kaya',
        nickname: 'Zeynep Kaya',
        avatar: '',
        voteCount: 4,
        maxRounds: windowSize,
        lastScore: 9,
        currentRoundScore: (currentRound.votes && currentRound.votes['zeynep_kaya']) ? currentRound.votes['zeynep_kaya'].score : null
      },
      {
        rank: 3,
        userKey: 'efe_can81',
        username: 'efe_can81',
        nickname: 'Efe Can',
        avatar: '',
        voteCount: 3,
        maxRounds: windowSize,
        lastScore: 8,
        currentRoundScore: (currentRound.votes && currentRound.votes['efe_can81']) ? currentRound.votes['efe_can81'].score : null
      }
    ].slice(0, count);
  }

  // Sort users:
  // 1. voteCount descending (how many hands out of the last 5 did they participate in)
  // 2. lastTimestamp descending (most active/recent)
  // 3. lastScore descending
  const sorted = Array.from(userStats.values()).sort((a, b) => {
    if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
    if (b.lastTimestamp !== a.lastTimestamp) return b.lastTimestamp - a.lastTimestamp;
    return (b.lastScore || 0) - (a.lastScore || 0);
  });

  return sorted.slice(0, count).map((best, idx) => ({
    rank: idx + 1,
    userKey: best.userKey,
    username: best.username,
    nickname: best.nickname,
    avatar: best.avatar || (avatarCache.has(best.userKey) ? avatarCache.get(best.userKey) : ''),
    voteCount: best.voteCount,
    maxRounds: windowSize,
    lastScore: best.lastScore,
    currentRoundScore: (currentRound.votes && currentRound.votes[best.userKey]) ? currentRound.votes[best.userKey].score : null
  }));
}

function getRecentTopVoter(windowSize = 5) {
  const list = getRecentTopVoters(1, windowSize);
  return list.length > 0 ? list[0] : null;
}


// Process an incoming vote
function registerVote({ userId, username, nickname, avatar, score, createTime, msgId }) {
  if (!currentRound.isActive) return false;

  // 1. Pre-round message check by message ID
  if (msgId && preRoundMessageIds.has(String(msgId))) {
    console.log(`[ESKİ MESAJ ENGELLENDİ] Mesaj (${msgId}) tur başlamadan önce yazılmış.`);
    return false;
  }

  // 2. Pre-round message check by timestamp
  const msgTime = (typeof createTime === 'number' && createTime > 0) ? createTime : null;
  if (msgTime) {
    if (currentRound.startCreateTime && msgTime <= currentRound.startCreateTime) {
      console.log(`[ESKİ MESAJ ENGELLENDİ] Mesaj zamanı (${msgTime}) tur öncesi son mesajdan (${currentRound.startCreateTime}) küçük/eşit.`);
      return false;
    }
    if (currentRound.startTime && msgTime < currentRound.startTime) {
      console.log(`[ESKİ MESAJ ENGELLENDİ] Mesaj tur başlamadan önce (${msgTime} < ${currentRound.startTime}) yazılmış.`);
      return false;
    }
  }

  const parsedScore = parseInt(score, 10);
  if (isNaN(parsedScore) || parsedScore < 1 || parsedScore > 10) return false;

  const rawUser = String(username || userId || '').trim();
  const cleanUsername = rawUser.replace(/^@/, '');
  const userKey = cleanUsername.toLowerCase();
  if (!userKey) return false;

  const cleanNickname = sanitizeNickname(nickname || cleanUsername || rawUser, cleanUsername);

  // Anti-Troll / Rating Manipulation Protection (Üst üste 2. kez 1 puan verme koruması)
  if (config.antiTrollProtection && parsedScore === 1) {
    const history = userScoreHistory.get(userKey);
    if (history && history.roundNumber < currentRoundNumber && history.lastScore === 1) {
      console.log(`[MANİPÜLASYON ENGELLENDİ] @${cleanUsername} önceki turda da 1 puan vermişti. Üst üste 2. kez 1 puan verdiği için oyu sayılmadı.`);
      return false;
    }
  }

  // Normalize avatar URL
  let finalAvatar = (typeof avatar === 'string' && avatar.trim().length > 0) ? avatar.trim() : '';
  if (finalAvatar.startsWith('//')) {
    finalAvatar = 'https:' + finalAvatar;
  }
  if (!finalAvatar.startsWith('http') && !finalAvatar.startsWith('data:')) {
    finalAvatar = '';
  }

  // Cache or retrieve avatar
  if (finalAvatar) {
    avatarCache.set(userKey, finalAvatar);
  } else if (avatarCache.has(userKey)) {
    finalAvatar = avatarCache.get(userKey);
  }

  const existingVote = currentRound.votes[userKey];
  const isUpdate = !!existingVote;

  // If user already voted in this round
  if (existingVote) {
    const timeDiff = Date.now() - existingVote.timestamp;

    // Concurrent duplicate packet from TikFinity WebSocket + Webhook within 3s:
    // If the earlier packet was missing an avatar and this packet provides it, attach avatar to existing vote
    if (timeDiff < 3000 && !existingVote.avatar && finalAvatar) {
      existingVote.avatar = finalAvatar;
      existingVote.nickname = cleanNickname;
      io.emit('vote_received', {
        vote: existingVote,
        isUpdate: true,
        stats: currentRound.stats
      });
      return true;
    }

    // Anti-spam protection: if vote updating is disabled, discard any 2nd/3rd/spam vote
    if (!config.allowVoteUpdate) {
      console.log(`[SPAM ENGELLENDİ] @${cleanUsername} bu turda zaten oy verdi (${existingVote.score} puan). Yeni yazdığı "${parsedScore}" puanı sayılmadı.`);
      return false;
    }
  }

  currentRound.votes[userKey] = {
    userId: userKey,
    username: cleanUsername || rawUser,
    nickname: cleanNickname,
    avatar: finalAvatar,
    score: parsedScore,
    timestamp: Date.now()
  };

  // Record history for cross-round manipulation protection
  userScoreHistory.set(userKey, {
    lastScore: parsedScore,
    roundNumber: currentRoundNumber,
    timestamp: Date.now()
  });

  // Track cumulative voter stats across stream
  let cum = cumulativeVoterStats.get(userKey);
  if (!cum) {
    cum = {
      userKey,
      username: cleanUsername || rawUser,
      nickname: cleanNickname,
      avatar: finalAvatar,
      totalVotesGiven: 0,
      sumScoresGiven: 0,
      scoresList: []
    };
    cumulativeVoterStats.set(userKey, cum);
  }
  cum.totalVotesGiven++;
  cum.sumScoresGiven += parsedScore;
  cum.scoresList.push(parsedScore);
  if (finalAvatar && (!cum.avatar || cum.avatar.startsWith('data:'))) cum.avatar = finalAvatar;
  cum.nickname = cleanNickname;

  calculateRoundStats();

  const topVoter = getRecentTopVoter(5);
  const top3Voters = getRecentTopVoters(3, 5);

  io.emit('vote_received', {
    vote: currentRound.votes[userKey],
    isUpdate,
    stats: currentRound.stats,
    topVoter,
    top3Voters
  });

  return true;
}

// Start Round
function startRound({ duration, title, category, candidate } = {}) {
  if (timerInterval) clearInterval(timerInterval);
  if (simulationInterval) clearInterval(simulationInterval);

  currentRoundNumber++;
  const roundDuration = duration !== undefined ? parseInt(duration, 10) : (config.roundDuration || 20);

  currentRound.isActive = true;
  currentRound.roundNumber = currentRoundNumber;
  currentRound.status = 'voting';
  currentRound.duration = roundDuration;
  currentRound.timeLeft = roundDuration;
  currentRound.title = title || config.defaultTitle || "Chate 1-10 yazın, acımayın!";
  currentRound.category = category || config.defaultCategory || "Chat konuşuyor";
  currentRound.startTime = Date.now();
  currentRound.startCreateTime = Date.now();
  currentRound.votes = {};
  currentRound.finalResult = null;
  currentRound.candidate = candidate || null;
  currentRound.isCandidateRound = !!candidate;
  calculateRoundStats();

  console.log(`[TUR BAŞLADI] Süre: ${roundDuration}s | Başlık: "${currentRound.title}"${candidate ? ` | Aday: @${candidate.username}` : ''}`);

  io.emit('round_started', {
    title: currentRound.title,
    category: currentRound.category,
    duration: currentRound.duration,
    timeLeft: currentRound.timeLeft,
    stats: currentRound.stats,
    topVoter: getRecentTopVoter(5),
    top3Voters: getRecentTopVoters(3, 5),
    candidate: currentRound.candidate,
    isCandidateRound: currentRound.isCandidateRound
  });

  timerInterval = setInterval(() => {
    currentRound.timeLeft -= 1;

    io.emit('round_tick', {
      timeLeft: currentRound.timeLeft,
      stats: currentRound.stats
    });

    if (currentRound.timeLeft <= 0) {
      finishRound();
    }
  }, 1000);
}

// Finish Round
function finishRound() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }

  currentRound.isActive = false;
  currentRound.status = 'finished';
  currentRound.timeLeft = 0;

  // Save completed round to recent history for rolling 5-hand leaderboard
  if (currentRound.votes && Object.keys(currentRound.votes).length > 0) {
    recentRoundsHistory.push({
      roundNumber: currentRound.roundNumber || currentRoundNumber,
      votes: JSON.parse(JSON.stringify(currentRound.votes))
    });
    if (recentRoundsHistory.length > 20) {
      recentRoundsHistory = recentRoundsHistory.slice(-20);
    }
    saveVoterHistory();

    // Save eligible voters for future raffles (if this was a regular round with votes)
    if (!currentRound.isCandidateRound) {
      lastRoundVoters = Object.values(currentRound.votes).map(v => ({
        userKey: v.userId || String(v.username).toLowerCase().replace(/^@/, ''),
        username: v.username,
        nickname: v.nickname || v.username,
        avatar: v.avatar || (avatarCache.get(String(v.username).toLowerCase().replace(/^@/, '')) || ''),
        score: v.score,
        timestamp: v.timestamp
      }));
    }
  }

  const finalStats = calculateRoundStats();
  const verdict = getRatingVerdict(finalStats.average);
  const topVoter = getRecentTopVoter(5);
  const top3Voters = getRecentTopVoters(3, 5);

  currentRound.finalResult = {
    title: currentRound.title,
    category: currentRound.category,
    duration: currentRound.duration,
    totalVotes: finalStats.totalVotes,
    average: finalStats.average,
    verdict: verdict,
    breakdown: finalStats.breakdown,
    topVotes: finalStats.recentVotes,
    topVoter: topVoter,
    top3Voters: top3Voters,
    candidate: currentRound.candidate,
    isCandidateRound: currentRound.isCandidateRound
  };

  console.log(`[TUR BİTTİ] Toplam Oy: ${finalStats.totalVotes} | Ortalama: ${finalStats.average} | Değerlendirme: ${verdict.title}`);

  io.emit('round_finished', currentRound.finalResult);
}

// Çekiliş ve Aday Turu/Simülasyonunu Durdurma
function stopRaffle() {
  if (candidateRoundTimer) {
    clearTimeout(candidateRoundTimer);
    candidateRoundTimer = null;
  }
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  currentRound.isActive = false;
  currentRound.status = 'idle';
  currentRound.timeLeft = 0;
  currentRound.votes = {};
  currentRound.finalResult = null;
  currentRound.candidate = null;
  currentRound.isCandidateRound = false;
  calculateRoundStats();

  console.log('[ÇEKİLİŞ / TEST DURDURULDU]');
  io.emit('raffle_stopped');
  io.emit('round_reset', { stats: currentRound.stats });

  return { success: true, message: 'Çekiliş ve simülasyon durduruldu' };
}

// Reset / Stop Round
function stopRound() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }
  if (candidateRoundTimer) {
    clearTimeout(candidateRoundTimer);
    candidateRoundTimer = null;
  }

  currentRound.isActive = false;
  currentRound.status = 'idle';
  currentRound.timeLeft = 0;
  currentRound.votes = {};
  currentRound.finalResult = null;
  currentRound.candidate = null;
  currentRound.isCandidateRound = false;
  calculateRoundStats();

  console.log('[TUR SIFIRLANDI]');
  io.emit('raffle_stopped');
  io.emit('round_reset', { stats: currentRound.stats });
}

// TikTok Live Connection Manager (Session ID gerektirmez, sadece kullanıcı adı ile çalışır)
function connectTikTok(username, sessionId) {
  if (!username || typeof username !== 'string') {
    throw new Error('Geçerli bir TikTok kullanıcı adı giriniz');
  }

  const cleanUser = username.replace(/^@/, '').trim();
  const cleanSession = (sessionId !== undefined ? sessionId : (config.tiktokSessionId || '')).trim();

  config.tiktokUsername = cleanUser;
  if (cleanSession) config.tiktokSessionId = cleanSession;
  saveConfig();

  if (tiktokConnection) {
    try {
      tiktokConnection.disconnect();
    } catch (e) {
      console.warn('Eski bağlantı kapatılırken hata:', e.message);
    }
    tiktokConnection = null;
  }

  tiktokStatus = {
    connected: false,
    username: cleanUser,
    roomInfo: null,
    error: null
  };

  console.log(`[TIKTOK] @${cleanUser} yayınına bağlanılıyor (Session ID gerektirmez)...`);
  io.emit('tiktok_status', tiktokStatus);

  const modernHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': 'https://www.tiktok.com/',
    'Origin': 'https://www.tiktok.com',
    'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1'
  };

  const connOptions = {
    processInitialData: false,
    enableExtendedGiftInfo: false,
    enableWebsocketUpgrade: true,
    requestPollingIntervalMs: 1000,
    requestHeaders: modernHeaders,
    websocketHeaders: modernHeaders,
    clientParams: {
      app_language: 'tr-TR',
      browser_language: 'tr-TR',
      tz_name: 'Europe/Istanbul',
      browser_version: '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    }
  };

  if (cleanSession) {
    connOptions.sessionId = cleanSession;
  }

  tiktokConnection = new WebcastPushConnection(cleanUser, connOptions);

  tiktokConnection.connect().then(state => {
    tiktokStatus.connected = true;
    tiktokStatus.roomInfo = {
      roomId: state.roomId,
      roomUserCount: state.roomUserCount || 0
    };
    tiktokStatus.error = null;
    saveConfig();

    console.log(`[TIKTOK] Bağlantı başarılı! Room ID: ${state.roomId}`);
    io.emit('tiktok_status', tiktokStatus);
  }).catch(err => {
    tiktokStatus.connected = false;
    let errMsg = err.message || 'Bağlantı kurulamadı';
    const lower = errMsg.toLowerCase();

    if (lower.includes('live has ended') || lower.includes('offline') || lower.includes('ended')) {
      errMsg = `Kullanıcı (@${cleanUser}) şu an canlı yayında değil. Canlı yayını açtıktan sonra tekrar Bağlan'a basın.`;
    } else if (lower.includes('failed to retrieve room_id') || lower.includes('room_id from page')) {
      errMsg = `Canlı yayın odası bulunamadı. Kullanıcının (@${cleanUser}) canlı yayında olduğundan emin olun.`;
    } else if (lower.includes('user not found') || lower.includes('not found')) {
      errMsg = `TikTok kullanıcısı (@${cleanUser}) bulunamadı. Lütfen kullanıcı adını kontrol edin.`;
    } else if (lower.includes('already connecting') || lower.includes('already connected')) {
      errMsg = 'Zaten bağlantı kuruluyor veya bağlı.';
    } else if (lower.includes('403') || lower.includes('sign request')) {
      errMsg = 'TikTok bot koruması engeli. Canlı yayındayken tekrar deneyin veya TikFinity açıkken chat otomatik aktarılır.';
    }

    tiktokStatus.error = errMsg;
    console.error(`[TIKTOK BAĞLANTI HATASI]:`, err.message);
    io.emit('tiktok_status', tiktokStatus);
  });

  // Chat listener
  tiktokConnection.on('chat', (data) => {
    const createTime = extractMessageTimestamp(data);
    const msgId = extractMessageId(data);

    if (!currentRound.isActive) {
      markPreRoundMessage(msgId, createTime);
      return;
    }

    const comment = data.comment || '';
    const score = parseVoteFromText(comment);

    if (score !== null) {
      let avatar = '';
      if (data.profilePictureUrl) {
        avatar = data.profilePictureUrl;
      } else if (data.userDetails && data.userDetails.profilePictureUrls && data.userDetails.profilePictureUrls.length > 0) {
        avatar = data.userDetails.profilePictureUrls[0];
      } else if (data.userDetails && data.userDetails.profilePictureUrl) {
        avatar = data.userDetails.profilePictureUrl;
      } else if (data.profilePictureUrls && data.profilePictureUrls.length > 0) {
        avatar = data.profilePictureUrls[0];
      }

      const nickname = data.nickname || (data.userDetails && data.userDetails.nickname) || data.uniqueId || 'İzleyici';
      const username = data.uniqueId || (data.userDetails && data.userDetails.uniqueId) || data.userId || 'user';

      registerVote({
        userId: data.uniqueId || data.userId,
        username: username,
        nickname: nickname,
        avatar: avatar,
        score: score,
        createTime: createTime,
        msgId: msgId
      });
    }
  });

  // Gift listener for Racon Kralı leaderboard
  tiktokConnection.on('gift', (data) => {
    try {
      const username = data.uniqueId || data.userId || (data.userDetails && data.userDetails.uniqueId) || 'user';
      const nickname = data.nickname || (data.userDetails && data.userDetails.nickname) || username;
      const avatar = extractAvatarUrl(data);
      const diamondCount = parseInt(data.diamondCount, 10) || 1;
      const repeatCount = parseInt(data.repeatCount, 10) || 1;
      const giftName = data.giftName || 'Hediye';
      
      const points = diamondCount * repeatCount;
      console.log(`[TIKTOK HEDİYE] @${username} (${nickname}) ${repeatCount}x ${giftName} gönderdi -> +${points}x Racon Puanı!`);
      
      addRaconPoints({
        username,
        nickname,
        avatar,
        amount: points
      });
    } catch (e) {
      console.warn('[TIKTOK HEDİYE HATA]:', e.message);
    }
  });

  tiktokConnection.on('disconnected', () => {
    console.log('[TIKTOK] Bağlantı kesildi.');
    tiktokStatus.connected = false;
    io.emit('tiktok_status', tiktokStatus);
  });

  tiktokConnection.on('error', (err) => {
    console.error('[TIKTOK SOCKET HATA]:', err);
    tiktokStatus.error = err.message;
    io.emit('tiktok_status', tiktokStatus);
  });
}

function disconnectTikTok() {
  if (tiktokConnection) {
    try {
      tiktokConnection.disconnect();
    } catch (e) {}
    tiktokConnection = null;
  }
  tiktokStatus.connected = false;
  tiktokStatus.error = null;
  io.emit('tiktok_status', tiktokStatus);
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

// Helper to extract avatar URL from any TikTok / TikFinity data structure (prioritizes highest quality)
function extractAvatarUrl(data) {
  if (!data || typeof data !== 'object') return '';

  // 1. Highest resolution fields first
  const highResCandidates = [
    data.user?.avatarLarger,
    data.userDetails?.avatarLarger,
    data.user_details?.avatarLarger,
    data.author?.avatarLarger,
    data.user?.avatarMedium,
    data.userDetails?.avatarMedium,
    data.user_details?.avatarMedium,
    data.author?.avatarMedium,
    data.user?.avatarLarge,
    data.userDetails?.avatarLarge,
    data.user?.profilePictureUrl,
    data.userDetails?.profilePictureUrl,
    data.profilePictureUrl,
    data.avatar,
    data.avatarUrl,
    data.image,
    data.user?.avatar,
    data.userDetails?.avatar,
    data.author?.avatar,
    data.sender?.avatar,
    data.user?.avatarThumb,
    data.userDetails?.avatarThumb,
    data.avatarThumb
  ];

  for (let c of highResCandidates) {
    if (typeof c === 'string') {
      c = c.trim();
      if (c.startsWith('//')) c = 'https:' + c;
      if (c.startsWith('http') || c.startsWith('data:')) {
        return getHighResAvatarUrl(c, 720);
      }
    }
  }

  // Check array candidates
  const arrayCandidates = [
    data.userDetails?.profilePictureUrls,
    data.user_details?.profilePictureUrls,
    data.user?.profilePictureUrls,
    data.profilePictureUrls,
    data.avatarUrls
  ];

  for (const arr of arrayCandidates) {
    if (Array.isArray(arr) && arr.length > 0) {
      // Look from the end if available (often larger resolution is last)
      for (let i = arr.length - 1; i >= 0; i--) {
        let item = arr[i];
        if (typeof item === 'string') {
          item = item.trim();
          if (item.startsWith('//')) item = 'https:' + item;
          if (item.startsWith('http') || item.startsWith('data:')) {
            return getHighResAvatarUrl(item, 720);
          }
        }
      }
    }
  }

  return '';
}

// ---------------- TIKFINITY LOCAL EVENT API WEBSOCKET CLIENT ----------------
let tikfinityWs = null;
let tikfinityReconnectTimer = null;
let isTikfinityConnected = false;

function connectTikFinityEventAPI() {
  if (typeof WebSocket === 'undefined') return;
  if (tikfinityWs && (tikfinityWs.readyState === WebSocket.OPEN || tikfinityWs.readyState === WebSocket.CONNECTING)) {
    return;
  }

  try {
    tikfinityWs = new WebSocket('ws://localhost:21213/');

    tikfinityWs.onopen = () => {
      isTikfinityConnected = true;
      console.log('[TIKFINITY EVENT API] ws://localhost:21213/ adresine başarıyla bağlandı! TikTok chat mesajları otomatik alınıyor.');
      io.emit('tikfinity_status', { connected: true });
    };

    tikfinityWs.onmessage = (event) => {
      try {
        const raw = JSON.parse(event.data);
        const eventName = String(raw.event || '').toLowerCase();
        const data = raw.data || raw;

        if (eventName === 'chat' || eventName === 'comment') {
          const createTime = extractMessageTimestamp(data) || extractMessageTimestamp(raw);
          const msgId = extractMessageId(data) || extractMessageId(raw);

          if (!currentRound.isActive) {
            markPreRoundMessage(msgId, createTime);
            return;
          }

          const comment = data.comment || data.message || data.text || '';
          const score = parseVoteFromText(comment);

          if (score !== null && currentRound.isActive) {
            const avatar = extractAvatarUrl(data);
            const nickname = data.nickname || (data.userDetails && data.userDetails.nickname) || (data.user && data.user.nickname) || data.uniqueId || 'İzleyici';
            const username = data.uniqueId || (data.userDetails && data.userDetails.uniqueId) || (data.user && data.user.uniqueId) || data.userId || 'user';

            console.log(`[TIKFINITY OY GELDİ] @${username} (${nickname}): ${score} Puan | Avatar: ${avatar ? 'VAR' : 'YOK'}`);

            registerVote({
              userId: data.uniqueId || data.userId || username,
              username: username,
              nickname: nickname,
              avatar: avatar,
              score: score,
              createTime: createTime,
              msgId: msgId
            });
          }
        } else if (eventName === 'gift') {
          const avatar = extractAvatarUrl(data);
          const nickname = data.nickname || (data.userDetails && data.userDetails.nickname) || (data.user && data.user.nickname) || data.uniqueId || 'İzleyici';
          const username = data.uniqueId || (data.userDetails && data.userDetails.uniqueId) || (data.user && data.user.uniqueId) || data.userId || 'user';
          const diamonds = parseInt(data.diamondCount || data.diamonds || data.coins || 1, 10);
          const repeat = parseInt(data.repeatCount || data.count || data.combo || 1, 10);
          const points = (isNaN(diamonds) || diamonds <= 0 ? 1 : diamonds) * (isNaN(repeat) || repeat <= 0 ? 1 : repeat);

          console.log(`[TIKFINITY HEDİYE] @${username} (${nickname}) ${repeat}x Hediye gönderdi -> +${points}x Racon Puanı!`);
          addRaconPoints({ username, nickname, avatar, amount: points });
        }
      } catch (err) {
        console.warn('[TIKFINITY PARSE HATA]:', err.message);
      }
    };

    tikfinityWs.onerror = () => {
      isTikfinityConnected = false;
    };

    tikfinityWs.onclose = () => {
      if (isTikfinityConnected) {
        console.log('[TIKFINITY EVENT API] Bağlantı kapandı, 5 sn içinde tekrar denenecek...');
      }
      isTikfinityConnected = false;
      io.emit('tikfinity_status', { connected: false });
      
      clearTimeout(tikfinityReconnectTimer);
      tikfinityReconnectTimer = setTimeout(connectTikFinityEventAPI, 5000);
    };
  } catch (e) {
    clearTimeout(tikfinityReconnectTimer);
    tikfinityReconnectTimer = setTimeout(connectTikFinityEventAPI, 5000);
  }
}

// Start TikFinity Event API auto-connector
connectTikFinityEventAPI();

// ---------------- REST API & WEBHOOK ENDPOINTS ----------------

// Universal Webhook & Chat Event Processor (TikFinity, Streamlabs, Custom Bots, Direct HTTP)
function handleIncomingChatOrWebhook(req, res) {
  const payload = req.body || {};
  const query = req.query || {};
  
  // Merge payload and nested data (TikFinity often puts fields inside payload.data)
  const dataObj = (typeof payload.data === 'object' && payload.data !== null) ? payload.data : {};
  
  const action = String(payload.action || payload.event || payload.type || query.action || query.event || '').toLowerCase();
  
  console.log('[WEBHOOK / CHAT EVENT ALINDI]:', { body: payload, query });

  // 1. Action: Start Round
  if (action === 'start' || action === 'round_start') {
    startRound({
      duration: payload.duration || query.duration,
      title: payload.title || query.title,
      category: payload.category || query.category
    });
    return res.json({ success: true, message: 'Puanlama turu başlatıldı', round: currentRound });
  }

  // 2. Action: Stop Round
  if (action === 'stop' || action === 'round_stop') {
    finishRound();
    return res.json({ success: true, message: 'Tur tamamlandı', result: currentRound.finalResult });
  }

  // 3. Action: Reset
  if (action === 'reset' || action === 'round_reset') {
    stopRound();
    return res.json({ success: true, message: 'Tur sıfırlandı' });
  }

  // 4. Action: Racon Gift / Points
  if (action === 'gift' || action === 'racon_add' || action === 'racon') {
    const diamonds = parseInt(dataObj.diamondCount || dataObj.diamonds || payload.diamondCount || payload.diamonds || payload.amount || query.amount || 1, 10);
    const repeat = parseInt(dataObj.repeatCount || dataObj.repeat || payload.repeatCount || payload.repeat || payload.count || query.count || 1, 10);
    const points = (isNaN(diamonds) || diamonds <= 0 ? 1 : diamonds) * (isNaN(repeat) || repeat <= 0 ? 1 : repeat);
    const uname = dataObj.uniqueId || dataObj.username || payload.uniqueId || payload.username || query.username || 'user';
    const nick = dataObj.nickname || payload.nickname || query.nickname || uname;
    const av = extractAvatarUrl(dataObj) || extractAvatarUrl(payload) || query.avatar || '';
    const updatedList = addRaconPoints({ username: uname, nickname: nick, avatar: av, amount: points });
    return res.json({ success: true, message: `Racon puanı eklendi (+${points}x)`, leaderboard: updatedList });
  }

  // 4. Chat comment / vote processing
  const createTime = extractMessageTimestamp(dataObj) || extractMessageTimestamp(payload);
  const msgId = extractMessageId(dataObj) || extractMessageId(payload);

  if (!currentRound.isActive && action !== 'start' && action !== 'round_start') {
    markPreRoundMessage(msgId, createTime);
  }

  const rawText = String(
    dataObj.comment || dataObj.message || dataObj.text || dataObj.content || dataObj.msg ||
    payload.comment || payload.message || payload.text || payload.content || payload.msg ||
    query.comment || query.message || query.text || ''
  ).trim();

  let score = null;
  if (payload.score !== undefined && payload.score !== '') {
    score = parseInt(payload.score, 10);
  } else if (dataObj.score !== undefined && dataObj.score !== '') {
    score = parseInt(dataObj.score, 10);
  } else if (query.score !== undefined && query.score !== '') {
    score = parseInt(query.score, 10);
  } else if (rawText) {
    score = parseVoteFromText(rawText);
  }

  const username = dataObj.uniqueId || dataObj.username || dataObj.user ||
                   payload.uniqueId || payload.username || payload.user ||
                   query.username || query.user || 'izleyici_' + Math.floor(Math.random() * 1000);

  const nickname = dataObj.nickname || dataObj.name || dataObj.displayName ||
                   payload.nickname || payload.name || payload.displayName ||
                   query.nickname || query.name || username;

  const avatar = extractAvatarUrl(dataObj) || extractAvatarUrl(payload) || query.avatar || '';

  if (score !== null && !isNaN(score) && score >= 1 && score <= 10) {
    const success = registerVote({
      userId: username,
      username: username,
      nickname: nickname,
      avatar: avatar,
      score: score,
      createTime: createTime,
      msgId: msgId
    });
    return res.json({
      success: true,
      registered: success,
      message: success ? `Oy kaydedildi: ${score} (${nickname})` : 'Tur aktif değil veya geçersiz/mükerrer/eski oy',
      vote: { username, nickname, score }
    });
  }

  // If text received but no valid 1-10 vote
  if (rawText) {
    return res.json({
      success: true,
      registered: false,
      message: `Mesaj alındı ancak 1-10 puan içermiyor: "${rawText}"`
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Webhook bağlantısı aktif. Oy göndermek için { comment: "10", username: "..." } veya { score: 10 } gönderin.'
  });
}

app.all('/api/webhook', handleIncomingChatOrWebhook);
app.all('/api/chat', handleIncomingChatOrWebhook);
app.all('/api/vote', handleIncomingChatOrWebhook);
app.all('/api/webhook/vote', handleIncomingChatOrWebhook);
app.all('/api/webhook/chat', handleIncomingChatOrWebhook);

// Avatar Proxy Endpoint (Bypasses TikTok CDN referrer and CORS restrictions)
app.get('/api/avatar-proxy', (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl || typeof targetUrl !== 'string' || !targetUrl.startsWith('http')) {
    return res.status(400).send('Geçersiz URL');
  }

  try {
    const parsed = new URL(targetUrl);
    const client = parsed.protocol === 'https:' ? https : http;

    const request = client.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.tiktok.com/',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      },
      timeout: 8000
    }, (proxyRes) => {
      if ([301, 302, 307, 308].includes(proxyRes.statusCode) && proxyRes.headers.location) {
        return res.redirect(proxyRes.headers.location);
      }

      if (proxyRes.statusCode !== 200) {
        return res.status(proxyRes.statusCode).end();
      }

      res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Access-Control-Allow-Origin', '*');
      proxyRes.pipe(res);
    });

    request.on('error', () => {
      res.status(502).end();
    });

    request.setTimeout(8000, () => {
      request.destroy();
      res.status(504).end();
    });
  } catch (err) {
    res.status(500).end();
  }
});

app.all('/api/webhook/start', (req, res) => {
  const { duration, title, category } = Object.assign({}, req.query, req.body);
  startRound({ duration, title, category });
  res.json({ success: true, message: 'Puanlama turu başlatıldı', round: currentRound });
});

app.all('/api/webhook/stop', (req, res) => {
  finishRound();
  res.json({ success: true, message: 'Tur tamamlandı', result: currentRound.finalResult });
});

// Debounced Toggle Functions for Hotkeys & Webhooks
let lastRoundToggleTime = 0;
let lastRaffleToggleTime = 0;

function toggleRoundSafe(data = {}) {
  if (isChatMessagePayload(data)) {
    console.log('[ROUND TOGGLE ENGELLENDİ] Chat mesajı geldiği için tur durumu değiştirilmedi.');
    return { success: false, reason: 'chat_payload_ignored' };
  }

  const now = Date.now();
  if (now - lastRoundToggleTime < 700) {
    return { success: false, reason: 'debounced', round: currentRound };
  }
  lastRoundToggleTime = now;

  if (currentRound.isActive) {
    finishRound();
    console.log('[ROUND TOGGLE] Oylama (Başlat/Bitir) kısayolu ile oylama DURDURULDU / BİTİRİLDİ.');
    return { success: true, action: 'stopped', round: currentRound };
  } else {
    startRound(data);
    console.log('[ROUND TOGGLE] Oylama (Başlat/Bitir) kısayolu ile oylama BAŞLATILDI.');
    return { success: true, action: 'started', round: currentRound };
  }
}

function toggleRaffleSafe(data = {}) {
  if (isChatMessagePayload(data)) {
    console.log('[RAFFLE TOGGLE ENGELLENDİ] Chat mesajı geldiği için çekiliş tetiklenmedi.');
    return { success: false, reason: 'chat_payload_ignored' };
  }

  const now = Date.now();
  if (now - lastRaffleToggleTime < 700) {
    return { success: false, reason: 'debounced' };
  }
  lastRaffleToggleTime = now;

  const isRaffleRunning = (currentRound.status === 'raffle' || currentRound.isCandidateRound || !!currentRound.candidate);
  if (isRaffleRunning) {
    stopRaffle();
    console.log('[RAFFLE TOGGLE] Çekiliş (Başlat/Durdur) kısayolu ile çekiliş DURDURULDU.');
    return { success: true, action: 'stopped' };
  } else {
    const res = startRaffle(data || { autoStartCandidateRound: true });
    if (res && res.success) {
      console.log('[RAFFLE TOGGLE] Çekiliş (Başlat/Durdur) kısayolu ile çekiliş BAŞLATILDI.');
      return { success: true, action: 'started', winner: res.winner, participantCount: res.participantCount };
    } else {
      console.log('[RAFFLE TOGGLE] Çekiliş başlatılamadı:', (res && res.message) || 'Bilinmeyen hata');
      return res || { success: false, message: 'Çekiliş başlatılamadı' };
    }
  }
}

app.all(['/api/round/toggle', '/api/webhook/round/toggle', '/api/webhook/toggle'], (req, res) => {
  const payload = Object.assign({}, req.query, req.body);
  if (isChatMessagePayload(payload, req.query)) {
    return handleIncomingChatOrWebhook(req, res);
  }
  const result = toggleRoundSafe(payload);
  return res.json(result);
});

app.all(['/api/raffle/toggle', '/api/webhook/raffle/toggle'], (req, res) => {
  const payload = Object.assign({}, req.query, req.body);
  if (isChatMessagePayload(payload, req.query)) {
    return handleIncomingChatOrWebhook(req, res);
  }
  const result = toggleRaffleSafe(payload);
  return res.json(result);
});

// Title / Question Prompt Webhook (Updates the top banner & category live)
app.all(['/api/title', '/api/webhook/title', '/api/prompt'], (req, res) => {
  const { title, category } = Object.assign({}, req.query, req.body);
  if (title) currentRound.title = title;
  if (category) currentRound.category = category;
  io.emit('round_title_updated', {
    title: currentRound.title,
    category: currentRound.category
  });
  console.log(`[TITLE GÜNCELLENDİ]: "${currentRound.title}" (${currentRound.category})`);
  res.json({ success: true, message: 'Başlık güncellendi', title: currentRound.title, category: currentRound.category });
});

// Urgency Alert Trigger Webhook (Triggers the red "SON X SANİYE" box)
app.all(['/api/alert', '/api/webhook/alert', '/api/urgency'], (req, res) => {
  const { text, seconds } = Object.assign({}, req.query, req.body);
  const alertText = text || (seconds ? `SON ${seconds} SANİYE, ACELE!` : 'SON SANİYELER, ACELE!');
  io.emit('trigger_alert', { text: alertText });
  console.log(`[ALERT TETİKLENDİ]: "${alertText}"`);
  res.json({ success: true, message: 'Aciliyet uyarısı tetiklendi', text: alertText });
});

// Avatar Image Proxy Endpoint (Bypasses TikTok CDN Hotlink & Referrer blocks)
app.get('/api/avatar-proxy', (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl || typeof targetUrl !== 'string' || !targetUrl.startsWith('http')) {
    return res.status(400).send('Invalid url');
  }

  try {
    const isHttps = targetUrl.startsWith('https');
    const client = isHttps ? require('https') : require('http');

    client.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      }
    }, (proxyRes) => {
      if (proxyRes.statusCode !== 200) {
        return res.status(proxyRes.statusCode).send('Upstream error');
      }
      res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      proxyRes.pipe(res);
    }).on('error', (err) => {
      res.status(500).send(err.message);
    });
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// Round Endpoints (POST & GET for easy trigger via browser / streamdeck)
app.all('/api/round/start', (req, res) => {
  const { duration, title, category } = Object.assign({}, req.query, req.body);
  startRound({ duration, title, category });
  res.json({ success: true, round: currentRound });
});

app.all('/api/round/stop', (req, res) => {
  finishRound();
  res.json({ success: true, result: currentRound.finalResult });
});

app.all('/api/round/reset', (req, res) => {
  stopRound();
  res.json({ success: true });
});

// Toggle Round (F6: Start if idle, Stop if active)
app.all(['/api/round/toggle', '/api/webhook/toggle'], (req, res) => {
  if (currentRound.isActive) {
    finishRound();
    console.log('[TOGGLE] Oylama turu kısayol/istek ile bitirildi.');
    res.json({ success: true, action: 'stopped', message: 'Puanlama turu bitirildi', result: currentRound.finalResult });
  } else {
    const { duration, title, category } = Object.assign({}, req.query, req.body);
    startRound({ duration, title, category });
    console.log('[TOGGLE] Oylama turu kısayol/istek ile başlatıldı.');
    res.json({ success: true, action: 'started', message: 'Puanlama turu başlatıldı', round: currentRound });
  }
});

app.get('/api/round/status', (req, res) => {
  res.json({
    currentRound,
    tiktokStatus,
    config: {
      roundDuration: config.roundDuration,
      resultDisplayDuration: config.resultDisplayDuration,
      defaultTitle: config.defaultTitle,
      defaultCategory: config.defaultCategory,
      hotkey: config.hotkey,
      raffleHotkey: config.raffleHotkey
    }
  });
});

// TikTok Endpoints
app.post('/api/tiktok/connect', (req, res) => {
  const { username, sessionId } = req.body;
  if (!username) {
    return res.status(400).json({ success: false, message: 'Kullanıcı adı zorunludur' });
  }
  try {
    connectTikTok(username, sessionId);
    res.json({ success: true, message: `@${username} için bağlantı başlatıldı` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/tiktok/disconnect', (req, res) => {
  disconnectTikTok();
  res.json({ success: true, message: 'TikTok bağlantısı kapatıldı' });
});

app.get('/api/tiktok/status', (req, res) => {
  res.json(tiktokStatus);
});

// Test / Simulation Endpoints
app.post('/api/test/vote', (req, res) => {
  const { username, score, nickname } = req.body;
  const numScore = parseInt(score, 10);
  
  if (isNaN(numScore) || numScore < 1 || numScore > 10) {
    return res.status(400).json({ success: false, message: 'Puan 1 ile 10 arasında bir sayı olmalıdır' });
  }

  const success = registerVote({
    userId: username || `test_user_${Date.now()}`,
    username: username || `test_user_${Math.floor(Math.random() * 1000)}`,
    nickname: nickname || username || 'Test İzleyici',
    score: numScore
  });

  res.json({ success, stats: currentRound.stats });
});

app.all(['/api/test/simulate-round', '/api/simulate'], (req, res) => {
  const { duration = 15, title, category, bias = 'random' } = Object.assign({}, req.query, req.body);
  
  const biases = ['high', 'balanced', 'low', 'mid', 'random'];
  const activeBias = (bias === 'random' || !bias) ? biases[Math.floor(Math.random() * (biases.length - 1))] : bias;

  const numDuration = parseInt(duration, 10) || 15;
  const roundTitle = title || config.defaultTitle || "Chate 1-10 yazın, acımayın!";
  const roundCat = category || config.defaultCategory || "Chat konuşuyor";

  startRound({ duration: numDuration, title: roundTitle, category: roundCat });

  const sampleNames = [
    "Ahmet_TR", "Zeynep_K", "ErenGamer", "Ayse_06", "BarisStream", 
    "ElifYilmaz", "Can_Berk", "MertOnline", "Selin_34", "BurakKing",
    "Melis_A", "Tolga_07", "Derya_X", "Volkan_Pro", "Buseee", "Omer_Live",
    "Kaan_81", "Cemre_S", "Ege_Pro", "Gamze_T", "Emre_07", "Nazli_Star"
  ];

  let voteCount = 0;
  const targetVotes = 12 + Math.floor(Math.random() * 8);
  const voteIntervalMs = Math.max(280, Math.floor((numDuration * 650) / targetVotes));

  simulationInterval = setInterval(() => {
    if (!currentRound.isActive) {
      clearInterval(simulationInterval);
      return;
    }

    const name = sampleNames[Math.floor(Math.random() * sampleNames.length)] + (Math.floor(Math.random() * 90) + 10);
    let score;

    if (activeBias === 'high') {
      score = Math.floor(Math.random() * 3) + 8; // 8, 9, 10
    } else if (activeBias === 'low') {
      score = Math.floor(Math.random() * 3) + 1; // 1, 2, 3
    } else if (activeBias === 'mid') {
      score = Math.floor(Math.random() * 3) + 5; // 5, 6, 7
    } else if (activeBias === 'balanced') {
      score = Math.floor(Math.random() * 4) + 6; // 6, 7, 8, 9
    } else {
      score = Math.floor(Math.random() * 10) + 1; // 1 to 10
    }

    registerVote({
      userId: name,
      username: name,
      nickname: name,
      score: score
    });

    voteCount++;
    if (voteCount >= targetVotes) {
      clearInterval(simulationInterval);
    }
  }, voteIntervalMs);

  res.json({ success: true, message: 'Rastgele simülasyon turu başlatıldı', bias: activeBias });
});

// Config Endpoints
app.get('/api/config', (req, res) => {
  res.json(config);
});

app.post('/api/config', (req, res) => {
  try {
    const newConfig = req.body;
    if (newConfig.ratingTiers) config.ratingTiers = newConfig.ratingTiers;
    if (newConfig.roundDuration) config.roundDuration = parseInt(newConfig.roundDuration, 10);
    if (newConfig.resultDisplayDuration) config.resultDisplayDuration = parseFloat(newConfig.resultDisplayDuration);
    if (newConfig.defaultTitle) {
      config.defaultTitle = newConfig.defaultTitle;
      if (!currentRound.isActive) {
        currentRound.title = newConfig.defaultTitle;
      }
    }
    if (newConfig.defaultCategory) {
      config.defaultCategory = newConfig.defaultCategory;
      if (!currentRound.isActive) {
        currentRound.category = newConfig.defaultCategory;
      }
    }
    if (newConfig.allowVoteUpdate !== undefined) config.allowVoteUpdate = newConfig.allowVoteUpdate;
    if (newConfig.antiTrollProtection !== undefined) config.antiTrollProtection = newConfig.antiTrollProtection;
    if (newConfig.soundEnabled !== undefined) config.soundEnabled = newConfig.soundEnabled;
    if (newConfig.autoRaffleOnRoundEnd !== undefined) config.autoRaffleOnRoundEnd = newConfig.autoRaffleOnRoundEnd;
    if (newConfig.hotkey !== undefined) config.hotkey = newConfig.hotkey;
    if (newConfig.startHotkey !== undefined) config.hotkey = newConfig.startHotkey;
    if (newConfig.raffleHotkey !== undefined) config.raffleHotkey = newConfig.raffleHotkey;
    if (newConfig.tiktokSessionId !== undefined) config.tiktokSessionId = newConfig.tiktokSessionId;
    
    startNativeHotkeyService(config.hotkey, config.raffleHotkey);

    saveConfig();
    io.emit('config_updated', config);
    if (newConfig.defaultTitle || newConfig.defaultCategory) {
      io.emit('round_title_updated', {
        title: currentRound.title || config.defaultTitle,
        category: currentRound.category || config.defaultCategory
      });
    }
    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Reset Rating Tiers to Defaults
const DEFAULT_RATING_TIERS = [
  { min: 1.0, max: 2.9, emoji: "", title: "BERBAT BU", subtitle: "chat hiç acımadı!", color: "#ef4444", badge: "F-TIER" },
  { min: 3.0, max: 4.9, emoji: "", title: "KÖTÜ BU", subtitle: "chat pek beğenmedi...", color: "#f97316", badge: "D-TIER" },
  { min: 5.0, max: 6.9, emoji: "", title: "ORTALAMA BU", subtitle: "fena değil, idare eder.", color: "#eab308", badge: "C-TIER" },
  { min: 7.0, max: 8.4, emoji: "", title: "İYİ BU", subtitle: "chatın beğenisini kazandın!", color: "#38bdf8", badge: "B-TIER" },
  { min: 8.5, max: 9.4, emoji: "", title: "HARİKA BU", subtitle: "chat bayağı yükseldi!", color: "#4ade80", badge: "A-TIER" },
  { min: 9.5, max: 10.0, emoji: "", title: "EFSANE BU", subtitle: "rekor kırıldı galiba!", color: "#fbbf24", badge: "S-TIER / REKOR" }
];

app.post('/api/config/reset-tiers', (req, res) => {
  try {
    config.ratingTiers = JSON.parse(JSON.stringify(DEFAULT_RATING_TIERS));
    saveConfig();
    io.emit('config_updated', config);
    console.log('[CONFIG] Değerlendirme (Rating) metinleri varsayılan orijinal değerlere sıfırlandı.');
    res.json({ success: true, ratingTiers: config.ratingTiers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/hotkey', (req, res) => {
  const { hotkey, startHotkey, raffleHotkey } = req.body;
  if (hotkey !== undefined) config.hotkey = hotkey;
  if (startHotkey !== undefined) config.hotkey = startHotkey;
  if (raffleHotkey !== undefined) config.raffleHotkey = raffleHotkey;

  saveConfig();
  startNativeHotkeyService(config.hotkey, config.raffleHotkey);
  io.emit('config_updated', config);
  console.log(`[GLOBAL HOTKEY] Kısayollar kaydedildi: Oylama=[${config.hotkey || 'Yok'}] | Çekiliş=[${config.raffleHotkey || 'Yok'}]`);
  return res.json({ success: true, hotkey: config.hotkey, raffleHotkey: config.raffleHotkey });
});

// Voter Endpoints
app.get('/api/voters/top', (req, res) => {
  const topVoter = getRecentTopVoter(5);
  res.json({ success: true, topVoter, historyCount: recentRoundsHistory.length });
});

app.get('/api/voters/top3', (req, res) => {
  const top3 = getRecentTopVoters(3, 5);
  res.json({ success: true, top3, historyCount: recentRoundsHistory.length });
});

let top3SimTimeouts = [];

function startTop3Simulation() {
  // Clear any existing simulation timers
  top3SimTimeouts.forEach(t => clearTimeout(t));
  top3SimTimeouts = [];

  const candidates = {
    ahmet: {
      userKey: 'ahmet_zafer',
      username: 'ahmet_zafer',
      nickname: 'Ahmet Zafer',
      avatar: '',
      maxRounds: 5
    },
    zeynep: {
      userKey: 'zeynep_kaya',
      username: 'zeynep_kaya',
      nickname: 'Zeynep Kaya',
      avatar: '',
      maxRounds: 5
    },
    efe: {
      userKey: 'efe_can81',
      username: 'efe_can81',
      nickname: 'Efe Can',
      avatar: '',
      maxRounds: 5
    },
    caner: {
      userKey: 'caner_demir',
      username: 'caner_demir',
      nickname: 'Caner Demir',
      avatar: '',
      maxRounds: 5
    }
  };

  const steps = [
    // Adım 1 (0s): Başlangıç: Ahmet=3 (1.), Zeynep=2 (2.), Efe=2 (3.)
    {
      delay: 0,
      list: [
        { ...candidates.ahmet, rank: 1, voteCount: 3 },
        { ...candidates.zeynep, rank: 2, voteCount: 2 },
        { ...candidates.efe, rank: 3, voteCount: 2 }
      ]
    },
    // Adım 2 (+2.2s): Zeynep oy alır -> Zeynep=3 (Ahmet ile eşitlenir)
    {
      delay: 2200,
      list: [
        { ...candidates.ahmet, rank: 1, voteCount: 3 },
        { ...candidates.zeynep, rank: 2, voteCount: 3 },
        { ...candidates.efe, rank: 3, voteCount: 2 }
      ]
    },
    // Adım 3 (+4.4s): Zeynep bir oy daha alır -> Zeynep=4 -> AHMET'İ GEÇİP 1. SIRAYA YERLEŞİR! (Animasyonlu yer değiştirme)
    {
      delay: 4400,
      list: [
        { ...candidates.zeynep, rank: 1, voteCount: 4 },
        { ...candidates.ahmet, rank: 2, voteCount: 3 },
        { ...candidates.efe, rank: 3, voteCount: 2 }
      ]
    },
    // Adım 4 (+6.8s): Caner Demir 3 oy alarak 3. sıraya girer ve Efe'yi ilk 3'ün dışına iter!
    {
      delay: 6800,
      list: [
        { ...candidates.zeynep, rank: 1, voteCount: 4 },
        { ...candidates.ahmet, rank: 2, voteCount: 3 },
        { ...candidates.caner, rank: 3, voteCount: 3 }
      ]
    },
    // Adım 5 (+9.2s): Ahmet Zafer 2 oy birden alır -> Ahmet=5 -> ZEYNEP'İ GEÇİP 1. LİĞİ GERİ ALIR! (Altın Parlama & Kayma)
    {
      delay: 9200,
      list: [
        { ...candidates.ahmet, rank: 1, voteCount: 5 },
        { ...candidates.zeynep, rank: 2, voteCount: 4 },
        { ...candidates.caner, rank: 3, voteCount: 3 }
      ]
    },
    // Adım 6 (+11.5s): Efe Can 4 oyla 3. sıraya geri yükselir!
    {
      delay: 11500,
      list: [
        { ...candidates.ahmet, rank: 1, voteCount: 5 },
        { ...candidates.zeynep, rank: 2, voteCount: 4 },
        { ...candidates.efe, rank: 3, voteCount: 4 }
      ]
    }
  ];

  steps.forEach((step, idx) => {
    const t = setTimeout(() => {
      io.emit('top_voter_updated', {
        topVoter: step.list[0],
        top3Voters: step.list
      });
      console.log(`[TOP 3 SİMÜLASYON - Adım ${idx + 1}/${steps.length}] 1. ${step.list[0].nickname} (${step.list[0].voteCount} Oy) | 2. ${step.list[1].nickname} (${step.list[1].voteCount} Oy) | 3. ${step.list[2].nickname} (${step.list[2].voteCount} Oy)`);
    }, step.delay);
    top3SimTimeouts.push(t);
  });

  return steps[0].list;
}

app.all(['/api/voters/top3/test', '/api/test/top3'], (req, res) => {
  const initialList = startTop3Simulation();
  res.json({
    success: true,
    message: 'Top 3 dinamik sıralama ve geçiş simülasyonu başlatıldı (12 saniye boyunca oylar ve sıralama değişecek)',
    initialTop3: initialList
  });
});

app.all('/api/voters/reset', (req, res) => {
  recentRoundsHistory = [];
  saveVoterHistory();
  io.emit('top_voter_updated', { topVoter: null, top3Voters: [] });
  console.log('[LEADERBOARD] Son 5 el lider geçmişi sıfırlandı.');
  res.json({ success: true, message: 'Son 5 el lider geçmişi sıfırlandı' });
});

// Raffle & Case Opening Endpoints
app.all(['/api/raffle/start', '/api/webhook/raffle'], (req, res) => {
  const options = Object.assign({}, req.query, req.body);
  if (isChatMessagePayload(options, req.query)) {
    return handleIncomingChatOrWebhook(req, res);
  }
  const result = startRaffle(options);
  res.json(result);
});

app.all('/api/raffle/test', (req, res) => {
  const result = startRaffle({
    isTest: true,
    participants: [
      { userKey: 'ok_voter', username: 'O.K', nickname: 'O.K', avatar: '', score: 10 },
      { userKey: 'secel', username: 'Secel', nickname: 'Secel', avatar: '', score: 10 },
      { userKey: 'ultraslan81', username: 'ultraslan.81', nickname: 'ultraslan.81', avatar: '', score: 1 },
      { userKey: 'ahmetzafer', username: 'ahmetzafer', nickname: 'ahmetzafer', avatar: '', score: 6 },
      { userKey: 'can_berk', username: 'Can_Berk', nickname: 'Can Berk', avatar: '', score: 9 },
      { userKey: 'eren_g', username: 'ErenGamer', nickname: 'Eren', avatar: '', score: 8 }
    ],
    autoStartCandidateRound: true,
    simulateVotes: true
  });
  res.json(result);
});

app.all(['/api/raffle/stop', '/api/raffle/cancel', '/api/webhook/raffle/stop', '/api/webhook/raffle/cancel'], (req, res) => {
  const result = stopRaffle();
  res.json(result);
});

app.get('/api/raffle/pool', (req, res) => {
  const list = getEligibleRaffleParticipants();
  res.json({
    count: list.length,
    participants: list,
    lastWinner: lastRaffleResult ? lastRaffleResult.winner : null
  });
});

// ---------------- RACON KRALI ENDPOINTS ----------------
app.get('/api/racon/leaderboard', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 5;
  res.json({ success: true, leaderboard: getRaconLeaderboard(limit) });
});

app.all('/api/racon/add', (req, res) => {
  const { username, nickname, avatar, amount = 1 } = Object.assign({}, req.query, req.body);
  if (!username) {
    return res.status(400).json({ success: false, message: 'Kullanıcı adı gereklidir' });
  }
  const leaderboard = addRaconPoints({ username, nickname, avatar, amount: parseInt(amount, 10) || 1 });
  res.json({ success: true, message: 'Puan eklendi', leaderboard });
});

app.all('/api/racon/set', (req, res) => {
  const { username, nickname, avatar, score = 0 } = Object.assign({}, req.query, req.body);
  if (!username) {
    return res.status(400).json({ success: false, message: 'Kullanıcı adı gereklidir' });
  }
  const leaderboard = setRaconScore({ username, nickname, avatar, score: parseInt(score, 10) || 0 });
  res.json({ success: true, message: 'Puan güncellendi', leaderboard });
});

app.all('/api/racon/reset', (req, res) => {
  const leaderboard = resetRaconLeaderboard();
  res.json({ success: true, message: 'Racon Kralı sıralaması sıfırlandı', leaderboard });
});

app.all(['/api/racon/test', '/api/test/racon'], (req, res) => {
  const initialList = startRaconSimulation();
  res.json({
    success: true,
    message: 'Racon Kralı dinamik sıralama simülasyonu başlatıldı',
    initialLeaderboard: initialList
  });
});

// Socket.io Connection Handlers
io.on('connection', (socket) => {
  console.log(`[SOCKET] Yeni istemci bağlandı: ${socket.id}`);

  socket.emit('init_state', {
    currentRound,
    tiktokStatus,
    config,
    topVoter: getRecentTopVoter(5),
    top3Voters: getRecentTopVoters(3, 5),
    raconLeaderboard: getRaconLeaderboard(5),
    candidate: currentRound.candidate,
    isCandidateRound: currentRound.isCandidateRound,
    lastRaffleResult
  });

  socket.on('start_round', (data) => {
    startRound(data);
  });

  socket.on('stop_round', () => {
    finishRound();
  });

  socket.on('reset_round', () => {
    stopRound();
  });

  socket.on('toggle_round', (data) => {
    toggleRoundSafe(data || {});
  });

  socket.on('test_vote', (data) => {
    registerVote(data);
  });

  socket.on('start_raffle', (data) => {
    startRaffle(data || {});
  });

  socket.on('stop_raffle', () => {
    stopRaffle();
  });

  socket.on('toggle_raffle', (data) => {
    toggleRaffleSafe(data || { autoStartCandidateRound: true, simulateVotes: true });
  });

  socket.on('start_candidate_round', (data) => {
    if (data && data.candidate) {
      startCandidateRatingRound(data.candidate, data.duration);
    }
  });

  socket.on('racon_add', (data) => {
    if (data && data.username) {
      addRaconPoints(data);
    }
  });

  socket.on('racon_set', (data) => {
    if (data && data.username) {
      setRaconScore(data);
    }
  });

  socket.on('racon_reset', () => {
    resetRaconLeaderboard();
  });

  socket.on('racon_test', () => {
    startRaconSimulation();
  });
});

// Auto-connect to TikTok if username is in config
if (config.tiktokUsername) {
  setTimeout(() => {
    try {
      console.log(`[TIKTOK AUTO] Kayıtlı kullanıcı @${config.tiktokUsername} bağlanılıyor...`);
      connectTikTok(config.tiktokUsername);
    } catch (e) {
      console.error('[TIKTOK AUTO HATA]:', e.message);
    }
  }, 1500);
}

// Start Native Global Hotkey Service (Round toggle & Raffle toggle)
startNativeHotkeyService(config.hotkey || 'F6', config.raffleHotkey || 'F8');

// Graceful cleanup
process.on('exit', () => {
  if (hotkeyProcess) {
    try { hotkeyProcess.kill(); } catch (e) {}
  }
});

// Start HTTP Server
const PORT = process.env.PORT || config.port || 3000;
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 TikTok Live Rating & Leaderboard Sunucusu Hazır!`);
  console.log(`🎮 Yönetici / Kontrol Paneli: http://localhost:${PORT}/admin.html`);
  console.log(`📺 Overlay (OBS / TikTok Studio): http://localhost:${PORT}/overlay.html`);
  console.log(`⌨️  Global Kısayol Tuşları: [Oylama (Başlat/Bitir): ${config.hotkey || 'F6'} | Çekiliş (Başlat/Durdur): ${config.raffleHotkey || 'F8'}]`);
  console.log(`🔗 Webhook API: http://localhost:${PORT}/api/webhook`);
  console.log(`====================================================`);
});
