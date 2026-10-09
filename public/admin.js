// Admin / Streamer Dashboard Logic
const socket = io();

// DOM Elements
const connStatusPill = document.getElementById('conn-status-pill');
const connStatusText = document.getElementById('conn-status-text');
const tiktokUserInput = document.getElementById('tiktok-user-input');
const btnTiktokConnect = document.getElementById('btn-tiktok-connect');
const btnTiktokDisconnect = document.getElementById('btn-tiktok-disconnect');
const connHint = document.getElementById('conn-hint');

const roundStatusPill = document.getElementById('round-status-pill');
const roundStatusText = document.getElementById('round-status-text');
const roundTitleInput = document.getElementById('round-title-input');
const roundCategoryInput = document.getElementById('round-category-input');
const roundDurationInput = document.getElementById('round-duration-input');
const btnDurationPreview = document.getElementById('btn-duration-preview');
const btnStartRound = document.getElementById('btn-start-round');
const btnStopRound = document.getElementById('btn-stop-round');

const monAvg = document.getElementById('mon-avg');
const monTotal = document.getElementById('mon-total');
const monTime = document.getElementById('mon-time');
const monVotesList = document.getElementById('mon-votes-list');
const monResultBox = document.getElementById('mon-result-box');
const monResBadge = document.getElementById('mon-res-badge');
const monResTitle = document.getElementById('mon-res-title');
const monResSub = document.getElementById('mon-res-sub');
const monTopVoterName = document.getElementById('mon-top-voter-name');
const monTopVoterStat = document.getElementById('mon-top-voter-stat');
const btnResetVoters = document.getElementById('btn-reset-voters');

const tiersEditorContainer = document.getElementById('tiers-editor-container');
const btnSaveConfig = document.getElementById('btn-save-config');
const btnResetTiers = document.getElementById('btn-reset-tiers');
const toggleSound = document.getElementById('toggle-sound');
const toggleVoteUpdate = document.getElementById('toggle-vote-update');
const toggleAntiTroll = document.getElementById('toggle-anti-troll');
const btnCopyOverlay = document.getElementById('btn-copy-overlay');
const toastContainer = document.getElementById('toast-container');

// Raffle Elements
const btnStartRaffle = document.getElementById('btn-start-raffle');
const btnTestRaffle = document.getElementById('btn-test-raffle');
const btnStopRaffle = document.getElementById('btn-stop-raffle');
const rafflePoolCount = document.getElementById('raffle-pool-count');
const raffleLastWinner = document.getElementById('raffle-last-winner');
const checkAutoRaffle = document.getElementById('check-auto-raffle');
const raffleStatusPill = document.getElementById('raffle-status-pill');
const raffleStatusText = document.getElementById('raffle-status-text');

// Live Studio & Webhook card elements
const inputOverlayUrl = document.getElementById('input-overlay-url');
const inputVoteWebhookUrl = document.getElementById('input-vote-webhook-url');
const inputWebhookUrl = document.getElementById('input-webhook-url');

// Modular widget inputs & buttons
const inputLeaderboardWidgetUrl = document.getElementById('input-leaderboard-widget-url');
const btnCopyLeaderboardWidget = document.getElementById('btn-copy-leaderboard-widget');
const linkPreviewLeaderboard = document.getElementById('link-preview-leaderboard');

const inputTop3WidgetUrl = document.getElementById('input-top3-widget-url');
const btnCopyTop3Widget = document.getElementById('btn-copy-top3-widget');
const linkPreviewTop3 = document.getElementById('link-preview-top3');

const inputScoreWidgetUrl = document.getElementById('input-score-widget-url');
const btnCopyScoreWidget = document.getElementById('btn-copy-score-widget');
const linkPreviewScore = document.getElementById('link-preview-score');

const inputPromptWidgetUrl = document.getElementById('input-prompt-widget-url');
const btnCopyPromptWidget = document.getElementById('btn-copy-prompt-widget');
const linkPreviewPrompt = document.getElementById('link-preview-prompt');

const inputTopComboWidgetUrl = document.getElementById('input-top-combo-widget-url');
const btnCopyTopComboWidget = document.getElementById('btn-copy-top-combo-widget');
const linkPreviewTopCombo = document.getElementById('link-preview-top-combo');

const inputUrgencyWidgetUrl = document.getElementById('input-urgency-widget-url');
const btnCopyUrgencyWidget = document.getElementById('btn-copy-urgency-widget');
const linkPreviewUrgency = document.getElementById('link-preview-urgency');

const inputResultWidgetUrl = document.getElementById('input-result-widget-url');
const btnCopyResultWidget = document.getElementById('btn-copy-result-widget');
const linkPreviewResult = document.getElementById('link-preview-result');

const inputRaffleWidgetUrl = document.getElementById('input-raffle-widget-url');
const btnCopyRaffleWidget = document.getElementById('btn-copy-raffle-widget');
const linkPreviewRaffle = document.getElementById('link-preview-raffle');

const inputRaconWidgetUrl = document.getElementById('input-racon-widget-url');
const btnCopyRaconWidget = document.getElementById('btn-copy-racon-widget');
const linkPreviewRacon = document.getElementById('link-preview-racon');
const raconAdminTable = document.getElementById('racon-admin-table');
const btnRaconTest = document.getElementById('btn-racon-test');
const btnRaconReset = document.getElementById('btn-racon-reset');
const raconUserInput = document.getElementById('racon-user-input');
const raconAmountInput = document.getElementById('racon-amount-input');
const btnRaconAddPoints = document.getElementById('btn-racon-add-points');

const linkPreviewFullOverlay = document.getElementById('link-preview-full-overlay');

const btnCopyOverlayCard = document.getElementById('btn-copy-overlay-card');
const btnCopyVoteWebhook = document.getElementById('btn-copy-vote-webhook');
const btnCopyWebhookCard = document.getElementById('btn-copy-webhook-card');
const inputRaffleWebhookUrl = document.getElementById('input-raffle-webhook-url');
const btnCopyRaffleWebhook = document.getElementById('btn-copy-raffle-webhook');

const btnQuickWebhookTest = document.getElementById('btn-quick-webhook-test');
const webhookQuickHint = document.getElementById('webhook-quick-hint');

// State
let appConfig = null;
let currentRoundState = null;

// Toast Notification with Deduplication
let lastToastMessage = '';
let lastToastTime = 0;

function showToast(message, type = 'info') {
  if (!message || !toastContainer) return;
  const now = Date.now();
  if (lastToastMessage === message && (now - lastToastTime) < 1500) {
    return;
  }
  lastToastMessage = message;
  lastToastTime = now;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Initialize Dynamic Link Inputs
function initConnectionLinks() {
  const origin = window.location.origin;
  if (inputOverlayUrl) inputOverlayUrl.value = `${origin}/overlay.html`;
  if (linkPreviewFullOverlay) linkPreviewFullOverlay.href = `${origin}/overlay.html?preview=1`;
  if (inputVoteWebhookUrl) inputVoteWebhookUrl.value = `${origin}/api/vote`;
  if (inputWebhookUrl) inputWebhookUrl.value = `${origin}/api/webhook`;
  if (inputRaffleWebhookUrl) inputRaffleWebhookUrl.value = `${origin}/api/webhook/raffle/toggle`;

  if (inputLeaderboardWidgetUrl) {
    inputLeaderboardWidgetUrl.value = `${origin}/leaderboard.html`;
    if (linkPreviewLeaderboard) linkPreviewLeaderboard.href = `${origin}/leaderboard.html?preview=1`;
  }
  if (inputTop3WidgetUrl) {
    inputTop3WidgetUrl.value = `${origin}/top3.html`;
    if (linkPreviewTop3) linkPreviewTop3.href = `${origin}/top3.html?preview=1`;
  }
  if (inputRaconWidgetUrl) {
    inputRaconWidgetUrl.value = `${origin}/racon.html`;
    if (linkPreviewRacon) linkPreviewRacon.href = `${origin}/racon.html?preview=1`;
  }
  if (inputScoreWidgetUrl) {
    inputScoreWidgetUrl.value = `${origin}/score.html`;
    if (linkPreviewScore) linkPreviewScore.href = `${origin}/score.html?preview=1`;
  }
  if (inputPromptWidgetUrl) {
    inputPromptWidgetUrl.value = `${origin}/prompt.html`;
    if (linkPreviewPrompt) linkPreviewPrompt.href = `${origin}/prompt.html?preview=1`;
  }
  if (inputTopComboWidgetUrl) {
    inputTopComboWidgetUrl.value = `${origin}/top_prompt.html`;
    if (linkPreviewTopCombo) linkPreviewTopCombo.href = `${origin}/top_prompt.html?preview=1`;
  }
  if (inputUrgencyWidgetUrl) {
    inputUrgencyWidgetUrl.value = `${origin}/urgency.html`;
    if (linkPreviewUrgency) linkPreviewUrgency.href = `${origin}/urgency.html?preview=1`;
  }
  if (inputResultWidgetUrl) {
    inputResultWidgetUrl.value = `${origin}/result.html`;
    if (linkPreviewResult) linkPreviewResult.href = `${origin}/result.html?preview=1`;
  }
  if (inputRaffleWidgetUrl) {
    inputRaffleWidgetUrl.value = `${origin}/raffle.html`;
    if (linkPreviewRaffle) linkPreviewRaffle.href = `${origin}/raffle.html?preview=1`;
  }
}
initConnectionLinks();

// Load saved local settings on startup
function loadSavedLocalRoundSettings() {
  try {
    const savedTitle = localStorage.getItem('tikfel_round_title');
    const savedCat = localStorage.getItem('tikfel_round_category');
    const savedDur = localStorage.getItem('tikfel_round_duration');
    if (savedTitle && roundTitleInput) roundTitleInput.value = savedTitle;
    if (savedCat && roundCategoryInput) roundCategoryInput.value = savedCat;
    if (savedDur && roundDurationInput) {
      roundDurationInput.value = savedDur;
      if (btnDurationPreview) btnDurationPreview.textContent = savedDur;
    }
  } catch (e) {}
}
loadSavedLocalRoundSettings();

function copyTextWithToast(text, successMessage) {
  navigator.clipboard.writeText(text).then(() => {
    showToast(successMessage, 'success');
  }).catch(() => {
    prompt('Link:', text);
  });
}

// Copy Handlers
if (btnCopyOverlay) {
  btnCopyOverlay.addEventListener('click', () => {
    copyTextWithToast(`${window.location.origin}/overlay.html`, 'Tam Ekran Overlay URL panoya kopyalandı!');
  });
}

if (btnCopyOverlayCard) {
  btnCopyOverlayCard.addEventListener('click', () => {
    copyTextWithToast(`${window.location.origin}/overlay.html`, '1. Tam Ekran Overlay URL kopyalandı!');
  });
}

if (btnCopyWebhookCard) {
  btnCopyWebhookCard.addEventListener('click', () => {
    copyTextWithToast(`${window.location.origin}/api/webhook`, '2. Genel Canlı Chat Webhook URL kopyalandı!');
  });
}

if (btnCopyVoteWebhook) {
  btnCopyVoteWebhook.addEventListener('click', () => {
    copyTextWithToast(`${window.location.origin}/api/vote`, '3. Sol Oy Listesi Webhook URL kopyalandı!');
  });
}

// Modular Widget Copy Handlers
if (btnCopyLeaderboardWidget) {
  btnCopyLeaderboardWidget.addEventListener('click', () => {
    copyTextWithToast(`${window.location.origin}/leaderboard.html`, 'Sol Oy Akışı & Leaderboard Katman Linki kopyalandı!');
  });
}

if (btnCopyTop3Widget) {
  btnCopyTop3Widget.addEventListener('click', () => {
    copyTextWithToast(`${window.location.origin}/top3.html`, 'İlk 3 En Çok Oy Kullanan (Top 3) Katman Linki kopyalandı!');
  });
}

if (linkPreviewTop3) {
  linkPreviewTop3.addEventListener('click', () => {
    // Automatically trigger Top 3 test data when opening preview
    fetch('/api/voters/top3/test', { method: 'POST' }).catch(() => {});
  });
}

if (btnCopyScoreWidget) {
  btnCopyScoreWidget.addEventListener('click', () => {
    copyTextWithToast(`${window.location.origin}/score.html`, 'Sadece Canlı Puan Katman Linki kopyalandı!');
  });
}

if (btnCopyPromptWidget) {
  btnCopyPromptWidget.addEventListener('click', () => {
    copyTextWithToast(`${window.location.origin}/prompt.html`, 'Soru & Başlık Banner Katman Linki kopyalandı!');
  });
}

if (btnCopyTopComboWidget) {
  btnCopyTopComboWidget.addEventListener('click', () => {
    copyTextWithToast(`${window.location.origin}/top_prompt.html`, 'Skor + Soru Kombo Katman Linki kopyalandı!');
  });
}

if (btnCopyUrgencyWidget) {
  btnCopyUrgencyWidget.addEventListener('click', () => {
    copyTextWithToast(`${window.location.origin}/urgency.html`, 'Aciliyet Kutusu Katman Linki kopyalandı!');
  });
}

if (btnCopyResultWidget) {
  btnCopyResultWidget.addEventListener('click', () => {
    copyTextWithToast(`${window.location.origin}/result.html`, 'Tur Sonu Sonuç & Değerlendirme Katman Linki kopyalandı!');
  });
}

if (btnCopyRaffleWidget) {
  btnCopyRaffleWidget.addEventListener('click', () => {
    copyTextWithToast(`${window.location.origin}/raffle.html`, 'Çekiliş & Rulet Katman Linki kopyalandı!');
  });
}

if (linkPreviewRaffle) {
  linkPreviewRaffle.addEventListener('click', () => {
    // Automatically trigger Raffle test simulation when opening preview
    fetch('/api/raffle/test', { method: 'POST' }).catch(() => {});
  });
}

if (btnCopyRaconWidget) {
  btnCopyRaconWidget.addEventListener('click', () => {
    copyTextWithToast(`${window.location.origin}/racon.html`, 'Racon Kralı Sıralaması (Top 5) Katman Linki kopyalandı!');
  });
}

if (linkPreviewRacon) {
  linkPreviewRacon.addEventListener('click', () => {
    fetch('/api/racon/test', { method: 'POST' }).catch(() => {});
  });
}

if (btnCopyRaffleWebhook) {
  btnCopyRaffleWebhook.addEventListener('click', () => {
    copyTextWithToast(`${window.location.origin}/api/webhook/raffle/toggle`, 'Çekiliş Webhook URL kopyalandı!');
  });
}

if (btnQuickWebhookTest) {
  btnQuickWebhookTest.addEventListener('click', async () => {
    try {
      if (!currentRoundState || !currentRoundState.isActive) {
        await fetch('/api/round/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ duration: 20 })
        });
      }

      const sampleUser = 'Can_Berk' + Math.floor(Math.random() * 90 + 10);
      const testRes = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: sampleUser,
          nickname: sampleUser,
          score: 10,
          comment: '10'
        })
      });
      const data = await testRes.json();
      if (webhookQuickHint) {
        webhookQuickHint.textContent = `Test Başarılı! ${sampleUser} sol listeye 10 puan gönderdi.`;
        setTimeout(() => { webhookQuickHint.textContent = ''; }, 4500);
      }
      showToast(`Sol listeye oy gönderildi: ${sampleUser} (10 Puan)`, 'success');
    } catch (err) {
      showToast('Webhook test hatası: ' + err.message, 'error');
    }
  });
}

// Raffle & CS Case Opening Controller
function fetchRafflePool() {
  fetch('/api/raffle/pool')
    .then(r => r.json())
    .then(data => {
      if (rafflePoolCount) rafflePoolCount.textContent = `${data.count || 0} kişi`;
      if (raffleLastWinner && data.lastWinner) {
        raffleLastWinner.textContent = `@${data.lastWinner.username} (${data.lastWinner.nickname || ''})`;
      }
    })
    .catch(() => {});
}

if (btnStartRaffle) {
  btnStartRaffle.addEventListener('click', () => {
    btnStartRaffle.disabled = true;
    showToast('Çekiliş başlatılıyor (CS Kasa Ruleti)...', 'info');
    fetch('/api/raffle/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ autoStartCandidateRound: true })
    })
    .then(r => r.json())
    .then(res => {
      btnStartRaffle.disabled = false;
      if (res.success && res.winner) {
        showToast(`Çekiliş başladı! Kazanan aday: @${res.winner.username}`, 'success');
      } else {
        showToast(res.message || 'Çekiliş başlatılamadı', 'error');
      }
      fetchRafflePool();
    })
    .catch(err => {
      btnStartRaffle.disabled = false;
      showToast('Çekiliş hatası: ' + err.message, 'error');
    });
  });
}

if (btnTestRaffle) {
  btnTestRaffle.addEventListener('click', () => {
    btnTestRaffle.disabled = true;
    showToast('Örnek katılımcılarla test çekilişi başlatılıyor...', 'info');
    fetch('/api/raffle/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
    .then(r => r.json())
    .then(res => {
      btnTestRaffle.disabled = false;
      if (res.success && res.winner) {
        showToast(`Test Çekilişi Başladı! (@${res.winner.username}) Aday açılınca otomatik oy simülasyonu çalışacak.`, 'success');
      }
      fetchRafflePool();
    })
    .catch(err => {
      btnTestRaffle.disabled = false;
      showToast('Hata: ' + err.message, 'error');
    });
  });
}

if (btnStopRaffle) {
  btnStopRaffle.addEventListener('click', () => {
    btnStopRaffle.disabled = true;
    if (typeof socket !== 'undefined' && socket && socket.connected) {
      socket.emit('stop_raffle');
    } else {
      fetch('/api/raffle/stop', { method: 'POST' })
        .catch(err => {
          btnStopRaffle.disabled = false;
          showToast('Hata: ' + err.message, 'error');
        });
    }
  });
}

if (checkAutoRaffle) {
  checkAutoRaffle.addEventListener('change', () => {
    if (!appConfig) return;
    appConfig.autoRaffleOnRoundEnd = checkAutoRaffle.checked;
    fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ autoRaffleOnRoundEnd: checkAutoRaffle.checked })
    }).then(r => r.json()).then(() => {
      showToast(`Otomatik Çekiliş: ${checkAutoRaffle.checked ? 'AÇIK' : 'KAPALI'}`, 'info');
    }).catch(() => {});
  });
}

// Auto-Save Round Settings (Title, Category, Duration)
let roundSettingsDebounceTimer = null;

function saveRoundSettingsAuto(options = {}) {
  const { immediate = false, toastMsg = null } = options;

  if (roundDurationInput && btnDurationPreview) {
    const durVal = parseInt(roundDurationInput.value, 10) || 20;
    btnDurationPreview.textContent = durVal;
  }

  const doSave = () => {
    const title = (roundTitleInput && roundTitleInput.value.trim()) ? roundTitleInput.value.trim() : "Chate 1-10 yazın, acımayın!";
    const category = (roundCategoryInput && roundCategoryInput.value.trim()) ? roundCategoryInput.value.trim() : "Chat konuşuyor";
    const duration = roundDurationInput ? (parseInt(roundDurationInput.value, 10) || 20) : 20;

    const payload = {
      defaultTitle: title,
      defaultCategory: category,
      roundDuration: duration
    };

    if (appConfig) {
      appConfig.defaultTitle = payload.defaultTitle;
      appConfig.defaultCategory = payload.defaultCategory;
      appConfig.roundDuration = payload.roundDuration;
    }

    try {
      localStorage.setItem('tikfel_round_title', payload.defaultTitle);
      localStorage.setItem('tikfel_round_category', payload.defaultCategory);
      localStorage.setItem('tikfel_round_duration', String(payload.roundDuration));
    } catch (e) {}

    fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(r => r.json())
    .then(res => {
      if (res && res.success && toastMsg) {
        showToast(toastMsg, 'info');
      }
    })
    .catch(() => {});
  };

  if (immediate) {
    if (roundSettingsDebounceTimer) clearTimeout(roundSettingsDebounceTimer);
    doSave();
  } else {
    if (roundSettingsDebounceTimer) clearTimeout(roundSettingsDebounceTimer);
    roundSettingsDebounceTimer = setTimeout(doSave, 350);
  }
}

if (roundTitleInput) {
  roundTitleInput.addEventListener('input', () => saveRoundSettingsAuto({ immediate: false }));
  roundTitleInput.addEventListener('change', () => saveRoundSettingsAuto({ immediate: true }));
  roundTitleInput.addEventListener('blur', () => saveRoundSettingsAuto({ immediate: true }));
}

if (roundCategoryInput) {
  roundCategoryInput.addEventListener('input', () => saveRoundSettingsAuto({ immediate: false }));
  roundCategoryInput.addEventListener('change', () => saveRoundSettingsAuto({ immediate: true }));
  roundCategoryInput.addEventListener('blur', () => saveRoundSettingsAuto({ immediate: true }));
}

if (roundDurationInput) {
  roundDurationInput.addEventListener('input', () => {
    const val = parseInt(roundDurationInput.value, 10) || 20;
    if (btnDurationPreview) btnDurationPreview.textContent = val;
    saveRoundSettingsAuto({ immediate: false });
  });
  roundDurationInput.addEventListener('change', () => {
    const val = parseInt(roundDurationInput.value, 10) || 20;
    if (btnDurationPreview) btnDurationPreview.textContent = val;
    saveRoundSettingsAuto({ immediate: true });
  });
}

// Quick Presets with Auto-Save & Instant Live Update
document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const title = btn.dataset.title || '';
    if (roundTitleInput) roundTitleInput.value = title;
    saveRoundSettingsAuto({ immediate: true, toastMsg: `Başlık seçildi ve kaydedildi: "${title}"` });
  });
});

// Auto-Save Rating Tiers
let tiersDebounceTimer = null;
function saveTiersAuto(immediate = false) {
  if (!appConfig || !appConfig.ratingTiers) return;
  const doSave = () => {
    const rows = tiersEditorContainer.querySelectorAll('.tier-row');
    rows.forEach((row, idx) => {
      const titleInput = row.querySelector('.tier-title-input');
      const subtitleInput = row.querySelector('.tier-sub-input');
      const badgeInput = row.querySelector('.tier-badge-input');
      if (appConfig.ratingTiers[idx]) {
        if (titleInput) appConfig.ratingTiers[idx].title = titleInput.value;
        if (subtitleInput) appConfig.ratingTiers[idx].subtitle = subtitleInput.value;
        if (badgeInput) appConfig.ratingTiers[idx].badge = badgeInput.value;
      }
    });

    fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ratingTiers: appConfig.ratingTiers })
    }).catch(() => {});
  };

  if (immediate) {
    if (tiersDebounceTimer) clearTimeout(tiersDebounceTimer);
    doSave();
  } else {
    if (tiersDebounceTimer) clearTimeout(tiersDebounceTimer);
    tiersDebounceTimer = setTimeout(doSave, 400);
  }
}

// Auto-save Toggles
if (toggleSound) {
  toggleSound.addEventListener('change', () => {
    if (!appConfig) return;
    appConfig.soundEnabled = toggleSound.checked;
    fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ soundEnabled: toggleSound.checked })
    }).then(() => {
      showToast(`Ses Efektleri: ${toggleSound.checked ? 'AÇIK' : 'KAPALI'}`, 'info');
    }).catch(() => {});
  });
}

if (toggleVoteUpdate) {
  toggleVoteUpdate.addEventListener('change', () => {
    if (!appConfig) return;
    appConfig.allowVoteUpdate = toggleVoteUpdate.checked;
    fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allowVoteUpdate: toggleVoteUpdate.checked })
    }).then(() => {
      showToast(`Oy Değiştirme: ${toggleVoteUpdate.checked ? 'AÇIK' : 'KAPALI'}`, 'info');
    }).catch(() => {});
  });
}

if (toggleAntiTroll) {
  toggleAntiTroll.addEventListener('change', () => {
    if (!appConfig) return;
    appConfig.antiTrollProtection = toggleAntiTroll.checked;
    fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ antiTrollProtection: toggleAntiTroll.checked })
    }).then(() => {
      showToast(`Anti-Troll Koruması: ${toggleAntiTroll.checked ? 'AÇIK' : 'KAPALI'}`, 'info');
    }).catch(() => {});
  });
}

// Render Tiers Editor
function renderTiersEditor(tiers) {
  if (!tiers || !Array.isArray(tiers)) return;
  tiersEditorContainer.innerHTML = '';

  tiers.forEach((tier, index) => {
    const row = document.createElement('div');
    row.className = 'tier-row';
    row.innerHTML = `
      <div class="tier-range-label">${tier.min.toFixed(1)} - ${tier.max.toFixed(1)}</div>
      <input type="text" class="tier-input tier-title-input" data-idx="${index}" value="${escapeHtml(tier.title)}" placeholder="Başlık" />
      <input type="text" class="tier-input tier-sub-input" data-idx="${index}" value="${escapeHtml(tier.subtitle)}" placeholder="Açıklama" />
      <input type="text" class="tier-input tier-badge-input" data-idx="${index}" value="${escapeHtml(tier.badge || '')}" placeholder="Rozet" />
    `;

    row.querySelectorAll('.tier-input').forEach(inp => {
      inp.addEventListener('input', () => saveTiersAuto(false));
      inp.addEventListener('change', () => saveTiersAuto(true));
      inp.addEventListener('blur', () => saveTiersAuto(true));
    });

    tiersEditorContainer.appendChild(row);
  });
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

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
  });
}

// Save Config
btnSaveConfig.addEventListener('click', () => {
  if (!appConfig || !appConfig.ratingTiers) return;

  const rows = tiersEditorContainer.querySelectorAll('.tier-row');
  rows.forEach((row, idx) => {
    const title = row.querySelector('.tier-title-input').value;
    const subtitle = row.querySelector('.tier-sub-input').value;
    const badge = row.querySelector('.tier-badge-input').value;

    if (appConfig.ratingTiers[idx]) {
      appConfig.ratingTiers[idx].title = title;
      appConfig.ratingTiers[idx].subtitle = subtitle;
      appConfig.ratingTiers[idx].badge = badge;
    }
  });

  appConfig.soundEnabled = toggleSound.checked;
  appConfig.allowVoteUpdate = toggleVoteUpdate.checked;
  if (toggleAntiTroll) appConfig.antiTrollProtection = toggleAntiTroll.checked;
  if (roundTitleInput) appConfig.defaultTitle = roundTitleInput.value.trim() || "Chate 1-10 yazın, acımayın!";
  if (roundCategoryInput) appConfig.defaultCategory = roundCategoryInput.value.trim() || "Chat konuşuyor";
  appConfig.roundDuration = parseInt(roundDurationInput.value, 10) || 20;

  fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(appConfig)
  }).then(res => res.json()).then(data => {
    if (data.success) {
      showToast('Ayarlar başarıyla kaydedildi!', 'success');
    }
  }).catch(err => {
    showToast('Ayar kaydetme hatası: ' + err.message, 'error');
  });
});

// Reset Tiers Button
if (btnResetTiers) {
  btnResetTiers.addEventListener('click', () => {
    showCustomConfirm({
      title: 'Değerlendirme Metinlerini Sıfırla',
      message: 'Tüm puanlama kademesi başlıklarını ve açıklamalarını varsayılan orijinal değerlerine (F-Tier, D-Tier, C-Tier, B-Tier, A-Tier, S-Tier) döndürmek istediğinize emin misiniz?',
      confirmText: 'Evet, Sıfırla',
      cancelText: 'Vazgeç',
      icon: '⚙️',
      onConfirm: () => {
        fetch('/api/config/reset-tiers', { method: 'POST' })
          .then(res => res.json())
          .then(data => {
            if (data.success && data.ratingTiers) {
              if (appConfig) appConfig.ratingTiers = data.ratingTiers;
              renderTiersEditor(data.ratingTiers);
              showToast('Değerlendirme metinleri varsayılan değerlere sıfırlandı!', 'info');
            }
          })
          .catch(err => {
            showToast('Sıfırlama hatası: ' + err.message, 'error');
          });
      }
    });
  });
}

// TikTok Connect
btnTiktokConnect.addEventListener('click', () => {
  const username = tiktokUserInput.value.trim();

  if (!username) {
    showToast('Lütfen TikTok kullanıcı adı girin!', 'error');
    return;
  }

  btnTiktokConnect.disabled = true;
  btnTiktokConnect.textContent = 'Bağlanılıyor...';

  fetch('/api/tiktok/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username })
  }).then(res => res.json()).then(data => {
    btnTiktokConnect.disabled = false;
    btnTiktokConnect.textContent = 'Bağlan';
    if (!data.success) {
      showToast(data.message || 'Bağlantı başlatılamadı', 'error');
    }
  }).catch(err => {
    btnTiktokConnect.disabled = false;
    btnTiktokConnect.textContent = 'Bağlan';
    showToast(err.message, 'error');
  });
});

// TikTok Disconnect
btnTiktokDisconnect.addEventListener('click', () => {
  fetch('/api/tiktok/disconnect', { method: 'POST' })
    .then(res => res.json())
    .then(() => showToast('TikTok bağlantısı kesildi', 'info'));
});

// Update TikTok Status UI
function updateTikTokUI(status) {
  if (!status) return;

  if (status.connected) {
    connStatusPill.className = 'status-pill status-connected';
    connStatusText.textContent = `Yayında Bağlı (@${status.username})`;
    btnTiktokConnect.classList.add('hidden');
    btnTiktokDisconnect.classList.remove('hidden');
    connHint.textContent = `Bağlantı aktif! Oda ID: ${status.roomInfo ? status.roomInfo.roomId : 'Aktif'}. Canlı chat dinleniyor.`;
    connHint.style.color = '#34d399';
  } else {
    connStatusPill.className = 'status-pill status-disconnected';
    connStatusText.textContent = 'Bağlı Değil (Yayındayken Bağlanır)';
    btnTiktokConnect.classList.remove('hidden');
    btnTiktokDisconnect.classList.add('hidden');
    if (status.error) {
      connHint.textContent = status.error;
      connHint.style.color = '#f87171';
    } else {
      connHint.textContent = 'TikTok Live Studio\'da canlı yayındayken kullanıcı adınızı yazıp "Bağlan" butonuna basın.';
      connHint.style.color = 'var(--text-muted)';
    }
  }

  if (status.username && !tiktokUserInput.value) {
    tiktokUserInput.value = status.username;
  }
}

// Start Round Button
btnStartRound.addEventListener('click', () => {
  const title = roundTitleInput.value.trim() || "Chate 1-10 yazın, acımayın!";
  const category = roundCategoryInput.value.trim() || "Chat konuşuyor";
  const duration = parseInt(roundDurationInput.value, 10) || 20;

  socket.emit('start_round', { title, category, duration });
});

// Stop Round Button
btnStopRound.addEventListener('click', () => {
  socket.emit('stop_round');
});

// Simulation Buttons
document.querySelectorAll('.btn-sim').forEach(btn => {
  btn.addEventListener('click', () => {
    const bias = btn.dataset.bias;
    const duration = parseInt(roundDurationInput.value, 10) || 20;
    const title = roundTitleInput.value.trim() || "Chate 1-10 yazın, acımayın!";
    const category = roundCategoryInput.value.trim() || "Chat konuşuyor";

    fetch('/api/test/simulate-round', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bias, duration, title, category })
    }).then(res => res.json()).then(data => {
      if (data.success) {
        showToast(`${duration} saniyelik test simülasyonu başlatıldı (${bias})!`, 'success');
      }
    });
  });
});

// Manual Vote Buttons (1 to 10)
document.querySelectorAll('.num-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const num = parseInt(btn.dataset.num, 10);
    const names = ["TestAli", "TestZeynep", "TestMert", "TestElif", "TestBurak"];
    const username = names[Math.floor(Math.random() * names.length)] + Math.floor(Math.random() * 100);

    fetch('/api/test/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, score: num })
    }).then(res => res.json()).then(data => {
      if (data.success) {
        showToast(`Oy gönderildi: ${username} ➔ ${num}`, 'info');
      } else {
        showToast(data.message || 'Oy gönderilemedi (Tur aktif olmayabilir)', 'error');
      }
    });
  });
});

// Update Live Monitor UI
function updateMonitorStats(stats) {
  if (!stats) return;
  monAvg.textContent = Number(stats.average || 0).toFixed(1);
  monTotal.textContent = stats.totalVotes || 0;

  if (stats.recentVotes && stats.recentVotes.length > 0) {
    monVotesList.innerHTML = '';
    stats.recentVotes.slice(0, 8).forEach(vote => {
      const row = document.createElement('div');
      row.className = 'mon-vote-row';
      const scoreClass = getScoreClass(vote.score);
      const cleanNick = sanitizeNickname(vote.nickname || vote.username, vote.username);

      row.innerHTML = `
        <span class="mon-vote-user">${escapeHtml(cleanNick)}</span>
        <span class="mon-vote-badge ${scoreClass}">${vote.score}/10</span>
      `;
      monVotesList.appendChild(row);
    });
  }
}

function getScoreClass(score) {
  if (score >= 10) return 'score-perfect';
  if (score >= 8) return 'score-high';
  if (score >= 5) return 'score-mid';
  return 'score-low';
}

// Update Top Voter UI (Son 5 El Lideri)
function updateTopVoterUI(topVoter) {
  if (!monTopVoterName || !monTopVoterStat) return;
  if (!topVoter) {
    monTopVoterName.textContent = 'Henüz lider yok';
    monTopVoterStat.textContent = '-- / 5 el';
    return;
  }
  const cleanNick = sanitizeNickname(topVoter.nickname || topVoter.username, topVoter.username);
  monTopVoterName.textContent = cleanNick;
  monTopVoterStat.textContent = `${topVoter.voteCount || 1} / ${topVoter.maxRounds || 5} el`;
}

// Reusable Custom Confirmation Modal Dialog (Dark Glassmorphism)
function showCustomConfirm({ title, message, confirmText = 'Evet, Sıfırla', cancelText = 'Vazgeç', icon = '⚠️', onConfirm }) {
  const overlay = document.getElementById('confirm-modal-overlay');
  const titleEl = document.getElementById('confirm-modal-title');
  const msgEl = document.getElementById('confirm-modal-message');
  const iconEl = document.getElementById('confirm-modal-icon');
  const btnOk = document.getElementById('btn-confirm-ok');
  const btnCancel = document.getElementById('btn-confirm-cancel');

  if (!overlay || !titleEl || !msgEl || !btnOk || !btnCancel) {
    if (confirm(message || 'Sıfırlamak istediğinize emin misiniz?')) {
      if (typeof onConfirm === 'function') onConfirm();
    }
    return;
  }

  titleEl.textContent = title || 'Sıfırlama Onayı';
  msgEl.textContent = message || 'Bu işlemi gerçekleştirmek istediğinize emin misiniz?';
  if (iconEl) iconEl.textContent = icon;
  btnOk.textContent = confirmText;
  btnCancel.textContent = cancelText;

  overlay.classList.remove('hidden');

  function cleanup() {
    overlay.classList.add('hidden');
    btnOk.removeEventListener('click', handleOk);
    btnCancel.removeEventListener('click', handleCancel);
    overlay.removeEventListener('click', handleOverlayClick);
    window.removeEventListener('keydown', handleKeyDown);
  }

  function handleOk() {
    cleanup();
    if (typeof onConfirm === 'function') onConfirm();
  }

  function handleCancel() {
    cleanup();
  }

  function handleOverlayClick(e) {
    if (e.target === overlay) {
      cleanup();
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      cleanup();
    } else if (e.key === 'Enter') {
      handleOk();
    }
  }

  btnOk.addEventListener('click', handleOk);
  btnCancel.addEventListener('click', handleCancel);
  overlay.addEventListener('click', handleOverlayClick);
  window.addEventListener('keydown', handleKeyDown);
}

if (btnResetVoters) {
  btnResetVoters.addEventListener('click', () => {
    showCustomConfirm({
      title: 'Liderlik Geçmişini Sıfırla',
      message: 'Son 5 el liderlik ve oy geçmişini sıfırlamak istediğinize emin misiniz?',
      confirmText: 'Evet, Sıfırla',
      cancelText: 'Vazgeç',
      icon: '📊',
      onConfirm: () => {
        fetch('/api/voters/reset', { method: 'POST' })
          .then(res => res.json())
          .then(data => {
            updateTopVoterUI(null);
            showToast('Son 5 el liderlik geçmişi sıfırlandı!', 'info');
          })
          .catch(err => showToast('Sıfırlama hatası: ' + err.message, 'error'));
      }
    });
  });
}

// ================= RACON KRALI ADMIN CONTROLS =================
function renderAdminRaconTable(list) {
  if (!raconAdminTable) return;
  const items = Array.isArray(list) && list.length > 0 ? list : [];
  if (items.length === 0) {
    raconAdminTable.innerHTML = '<div style="padding: 10px; font-size: 0.8rem; color: #94a3b8; text-align: center;">Henüz sıralamada kimse yok.</div>';
    return;
  }

  raconAdminTable.innerHTML = '';
  items.slice(0, 5).forEach((item, idx) => {
    const rank = idx + 1;
    const cleanUser = String(item.username || item.userKey || `Kullanıcı ${rank}`).replace(/^@/, '');
    const displayName = sanitizeNickname(item.nickname || cleanUser, cleanUser);
    const scoreVal = item.score !== undefined ? item.score : 0;
    const badgeText = item.badgeTitle || (rank <= 3 ? 'SAĞ KOL' : 'RACON KESEN');
    const badgeColor = rank <= 3 ? '#c084fc' : '#eab308';
    const badgeIconSvg = rank <= 3 
      ? `<svg width="7" height="7" viewBox="0 0 7 7" fill="${badgeColor}" style="display:inline-block; vertical-align:middle; shape-rendering:crispEdges; margin-right:4px;"><rect x="3" y="0" width="1" height="1"/><rect x="2" y="1" width="3" height="1"/><rect x="1" y="2" width="5" height="1"/><rect x="0" y="3" width="7" height="1"/><rect x="1" y="4" width="5" height="1"/><rect x="2" y="5" width="3" height="1"/><rect x="3" y="6" width="1" height="1"/></svg>`
      : `<svg width="5" height="5" viewBox="0 0 5 5" fill="${badgeColor}" style="display:inline-block; vertical-align:middle; shape-rendering:crispEdges; margin-right:4px;"><rect width="5" height="5"/></svg>`;
    const rankColor = rank === 1 ? '#fbee38' : (rank === 2 ? '#ffffff' : (rank === 3 ? '#cd7f32' : '#94a3b8'));
    const borderStyle = rank === 1 ? '1.5px solid rgba(168, 85, 247, 0.6)' : '1px solid rgba(255, 255, 255, 0.08)';
    const rowBg = rank === 1 ? 'rgba(112, 0, 255, 0.14)' : 'rgba(15, 23, 42, 0.6)';

    const row = document.createElement('div');
    row.style.cssText = `display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 10px; background: ${rowBg}; border: ${borderStyle}; border-radius: 8px;`;

    row.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;">
        <span style="font-family: var(--font-mono); font-weight: 900; font-size: 0.9rem; color: ${rankColor}; width: 16px; text-align: center;">${rank}</span>
        <span style="font-weight: 700; font-size: 0.85rem; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(displayName)}</span>
        <span style="display: inline-flex; align-items: center; font-size: 0.68rem; font-weight: 700; color: ${badgeColor}; text-transform: uppercase;">
          ${badgeIconSvg} ${escapeHtml(badgeText)}
        </span>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-family: var(--font-mono); font-weight: 900; font-size: 0.92rem; color: #d8b4fe;">${scoreVal}x</span>
        <button class="btn btn-sm btn-secondary quick-user-add" data-user="${escapeHtml(cleanUser)}" style="padding: 2px 7px; font-size: 0.7rem;" title="+50x Puan Ver">+50x</button>
      </div>
    `;

    const quickBtn = row.querySelector('.quick-user-add');
    if (quickBtn) {
      quickBtn.addEventListener('click', () => {
        fetch('/api/racon/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: cleanUser, nickname: displayName, amount: 50 })
        }).then(r => r.json()).then(res => {
          showToast(`@${cleanUser} kullanıcısına +50x Racon puanı verildi!`, 'success');
        }).catch(err => {
          showToast('Puan ekleme hatası: ' + err.message, 'error');
        });
      });
    }

    raconAdminTable.appendChild(row);
  });
}

if (btnRaconTest) {
  btnRaconTest.addEventListener('click', () => {
    fetch('/api/racon/test', { method: 'POST' })
      .then(r => r.json())
      .then(res => {
        showToast('Racon Kralı canlı sıralama simülasyonu başlatıldı!', 'success');
      })
      .catch(err => {
        showToast('Simülasyon hatası: ' + err.message, 'error');
      });
  });
}

if (btnRaconReset) {
  btnRaconReset.addEventListener('click', () => {
    showCustomConfirm({
      title: 'Racon Kralı Sıfırlama Onayı',
      message: 'Racon Kralı liderlik sıralamasını ve puan geçmişini sıfırlamak istediğinize emin misiniz? Tüm skorlar başlangıç durumuna dönecektir.',
      confirmText: 'Evet, Sıfırla',
      cancelText: 'Vazgeç',
      icon: '⚠️',
      onConfirm: () => {
        fetch('/api/racon/reset', { method: 'POST' })
          .then(r => r.json())
          .then(res => {
            showToast('Racon Kralı sıralaması sıfırlandı.', 'info');
          })
          .catch(err => {
            showToast('Sıfırlama hatası: ' + err.message, 'error');
          });
      }
    });
  });
}

if (btnRaconAddPoints) {
  btnRaconAddPoints.addEventListener('click', () => {
    const user = (raconUserInput ? raconUserInput.value : '').trim();
    const amount = parseInt((raconAmountInput ? raconAmountInput.value : 50), 10) || 50;
    if (!user) {
      showToast('Lütfen bir kullanıcı adı girin!', 'warning');
      return;
    }
    fetch('/api/racon/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user, nickname: user, amount })
    }).then(r => r.json()).then(res => {
      showToast(`@${user} kullanıcısına +${amount}x Racon puanı eklendi!`, 'success');
      if (raconUserInput) raconUserInput.value = '';
    }).catch(err => {
      showToast('Puan ekleme hatası: ' + err.message, 'error');
    });
  });
}

document.querySelectorAll('.quick-racon-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const pts = parseInt(btn.dataset.pts, 10) || 50;
    const user = (raconUserInput && raconUserInput.value.trim()) ? raconUserInput.value.trim() : 'Bayram';
    fetch('/api/racon/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user, nickname: user, amount: pts })
    }).then(r => r.json()).then(res => {
      showToast(`@${user} kullanıcısına +${pts}x Racon puanı eklendi!`, 'success');
    });
  });
});

// Initial fetch for Racon table
fetch('/api/racon/leaderboard')
  .then(r => r.json())
  .then(res => {
    if (res && res.leaderboard) renderAdminRaconTable(res.leaderboard);
  })
  .catch(() => {});

// Socket Handlers
socket.on('init_state', (data) => {
  if (data.config) {
    appConfig = data.config;
    renderTiersEditor(appConfig.ratingTiers);
    if (toggleSound) toggleSound.checked = appConfig.soundEnabled !== false;
    if (toggleVoteUpdate) toggleVoteUpdate.checked = appConfig.allowVoteUpdate === true;
    if (toggleAntiTroll) toggleAntiTroll.checked = appConfig.antiTrollProtection === true;

    if (appConfig.defaultTitle && roundTitleInput && document.activeElement !== roundTitleInput) {
      roundTitleInput.value = appConfig.defaultTitle;
    }
    if (appConfig.defaultCategory && roundCategoryInput && document.activeElement !== roundCategoryInput) {
      roundCategoryInput.value = appConfig.defaultCategory;
    }
    if (appConfig.roundDuration && roundDurationInput && document.activeElement !== roundDurationInput) {
      roundDurationInput.value = appConfig.roundDuration;
      if (btnDurationPreview) btnDurationPreview.textContent = appConfig.roundDuration;
    }
    if (appConfig.hotkey) {
      assignedStartHotkey = appConfig.hotkey;
    }
    if (appConfig.raffleHotkey) {
      assignedRaffleHotkey = appConfig.raffleHotkey;
    }
    updateHotkeysUI();
    if (checkAutoRaffle && appConfig.autoRaffleOnRoundEnd !== undefined) {
      checkAutoRaffle.checked = !!appConfig.autoRaffleOnRoundEnd;
    }
    fetchRafflePool();
  }

  if (data.tiktokStatus) {
    updateTikTokUI(data.tiktokStatus);
  }

  if (data.topVoter !== undefined) {
    updateTopVoterUI(data.topVoter);
  }

  if (data.raconLeaderboard) {
    renderAdminRaconTable(data.raconLeaderboard);
  }

  if (data.currentRound) {
    currentRoundState = data.currentRound;
    if (data.currentRound.isActive) {
      handleRoundStartedUI(data.currentRound);
    } else {
      handleRoundIdleUI();
    }
  }
});

socket.on('config_updated', (cfg) => {
  if (!cfg) return;
  appConfig = { ...(appConfig || {}), ...cfg };
  if (cfg.defaultTitle && roundTitleInput && document.activeElement !== roundTitleInput) {
    roundTitleInput.value = cfg.defaultTitle;
  }
  if (cfg.defaultCategory && roundCategoryInput && document.activeElement !== roundCategoryInput) {
    roundCategoryInput.value = cfg.defaultCategory;
  }
  if (cfg.roundDuration && roundDurationInput && document.activeElement !== roundDurationInput) {
    roundDurationInput.value = cfg.roundDuration;
    if (btnDurationPreview) btnDurationPreview.textContent = cfg.roundDuration;
  }
  if (cfg.ratingTiers && tiersEditorContainer && !tiersEditorContainer.contains(document.activeElement)) {
    renderTiersEditor(cfg.ratingTiers);
  }
  if (cfg.soundEnabled !== undefined && toggleSound) {
    toggleSound.checked = cfg.soundEnabled !== false;
  }
  if (cfg.allowVoteUpdate !== undefined && toggleVoteUpdate) {
    toggleVoteUpdate.checked = cfg.allowVoteUpdate === true;
  }
  if (cfg.antiTrollProtection !== undefined && toggleAntiTroll) {
    toggleAntiTroll.checked = cfg.antiTrollProtection === true;
  }
  if (cfg.autoRaffleOnRoundEnd !== undefined && checkAutoRaffle) {
    checkAutoRaffle.checked = !!cfg.autoRaffleOnRoundEnd;
  }
});

socket.on('racon_updated', (data) => {
  if (data && data.leaderboard) {
    renderAdminRaconTable(data.leaderboard);
  }
});

socket.on('raffle_started', (data) => {
  if (raffleStatusPill && raffleStatusText) {
    raffleStatusPill.className = 'status-pill status-active';
    raffleStatusText.textContent = 'Kasa Açılıyor...';
  }
  if (data && data.winner && raffleLastWinner) {
    raffleLastWinner.textContent = `@${data.winner.username} (${data.winner.nickname || ''})`;
  }
  setTimeout(() => {
    if (raffleStatusPill && raffleStatusText) {
      raffleStatusPill.className = 'status-pill status-idle';
      raffleStatusText.textContent = 'Hazır';
    }
  }, (data.duration || 6000) + 2000);
});

socket.on('raffle_stopped', () => {
  if (raffleStatusPill && raffleStatusText) {
    raffleStatusPill.className = 'status-pill status-idle';
    raffleStatusText.textContent = 'Hazır';
  }
  if (btnTestRaffle) btnTestRaffle.disabled = false;
  if (btnStartRaffle) btnStartRaffle.disabled = false;
  if (btnStopRaffle) btnStopRaffle.disabled = false;
  showToast('Çekiliş / simülasyon durduruldu.', 'info');
});

socket.on('tiktok_status', (status) => {
  updateTikTokUI(status);
});

socket.on('round_started', (data) => {
  if (data.topVoter !== undefined) {
    updateTopVoterUI(data.topVoter);
  }
  handleRoundStartedUI(data);
  showToast(`Puanlama turu başladı: "${data.title}"`, 'success');
});

function handleRoundStartedUI(data) {
  roundStatusPill.className = 'status-pill status-active';
  roundStatusText.textContent = 'Oylama Aktif!';
  btnStartRound.disabled = true;
  btnStopRound.disabled = false;
  monResultBox.classList.add('hidden');
  monTime.textContent = `${data.timeLeft || data.duration || 10}s`;
  updateMonitorStats(data.stats);
}

socket.on('round_tick', (data) => {
  monTime.textContent = `${data.timeLeft}s`;
  updateMonitorStats(data.stats);
});

socket.on('vote_received', (data) => {
  if (data.topVoter !== undefined) {
    updateTopVoterUI(data.topVoter);
  }
  updateMonitorStats(data.stats);
});

socket.on('top_voter_updated', (data) => {
  updateTopVoterUI(data ? data.topVoter : null);
});

socket.on('round_finished', (result) => {
  handleRoundIdleUI();
  monTime.textContent = 'Bitti';
  
  if (result) {
    if (result.topVoter !== undefined) {
      updateTopVoterUI(result.topVoter);
    }
    updateMonitorStats(result);
    monResultBox.classList.remove('hidden');
    const verdict = result.verdict || {};
    monResBadge.textContent = verdict.badge || 'SONUÇ';
    if (verdict.color) monResBadge.style.background = verdict.color;
    monResTitle.textContent = `${verdict.title || ''} (${Number(result.average).toFixed(1)} / 10)`;
    monResSub.textContent = `${verdict.subtitle || ''} • Toplam ${result.totalVotes || 0} Oy`;

    addRoundToSessionHistory(result);

    fetchRafflePool();

    showToast(`Tur tamamlandı! Ortalama: ${Number(result.average).toFixed(1)} - ${verdict.title}`, 'success');
  }
});

socket.on('round_reset', () => {
  const wasVoting = btnStopRound && !btnStopRound.disabled;
  handleRoundIdleUI();
  monResultBox.classList.add('hidden');
  monVotesList.innerHTML = '<div class="table-empty">Henüz oy yok.</div>';
  monAvg.textContent = '0.0';
  monTotal.textContent = '0';
  monTime.textContent = '--';
  if (wasVoting) {
    showToast('Tur sıfırlandı.', 'info');
  }
});

function handleRoundIdleUI() {
  roundStatusPill.className = 'status-pill status-idle';
  roundStatusText.textContent = 'Beklemede';
  btnStartRound.disabled = false;
  btnStopRound.disabled = true;
}

// Interactive Webhook Buttons
const btnTestWebhookStart = document.getElementById('btn-test-webhook-start');
const btnTestWebhookVote = document.getElementById('btn-test-webhook-vote');
const webhookTestResult = document.getElementById('webhook-test-result');

if (btnTestWebhookStart) {
  btnTestWebhookStart.addEventListener('click', () => {
    webhookTestResult.textContent = 'Webhook isteği gönderiliyor... (POST /api/webhook)';
    fetch('/api/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'start',
        duration: 10,
        title: 'Webhook Test Puanlaması (1-10)',
        category: 'Webhook Test'
      })
    })
    .then(res => res.json())
    .then(data => {
      webhookTestResult.textContent = `✅ Webhook Yanıtı (200 OK): ${JSON.stringify(data.message)}`;
      showToast('Webhook ile tur başlatıldı!', 'success');
    })
    .catch(err => {
      webhookTestResult.textContent = `❌ Webhook Hatası: ${err.message}`;
      showToast('Webhook hatası: ' + err.message, 'error');
    });
  });
}

if (btnTestWebhookVote) {
  btnTestWebhookVote.addEventListener('click', () => {
    webhookTestResult.textContent = 'Webhook ile oy gönderiliyor...';
    fetch('/api/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'WebhookBot_' + Math.floor(Math.random() * 100),
        score: Math.floor(Math.random() * 10) + 1
      })
    })
    .then(res => res.json())
    .then(data => {
      webhookTestResult.textContent = `Webhook Oy Yanıtı: ${JSON.stringify(data.message)}`;
      showToast('Webhook oyu başarıyla işlendi!', 'success');
    })
    .catch(err => {
      webhookTestResult.textContent = `Webhook Hatası: ${err.message}`;
    });
  });
}

// ==========================================
// DUAL TOGGLE HOTKEYS (KEYBOARD & MOUSE BUTTONS SUPPORT)
// ==========================================
const btnAssignStartHotkey = document.getElementById('btn-assign-start-hotkey');
const currentStartHotkeyLabel = document.getElementById('current-start-hotkey-label');
const btnClearStartHotkey = document.getElementById('btn-clear-start-hotkey');

const btnAssignRaffleHotkey = document.getElementById('btn-assign-raffle-hotkey');
const currentRaffleHotkeyLabel = document.getElementById('current-raffle-hotkey-label');
const btnClearRaffleHotkey = document.getElementById('btn-clear-raffle-hotkey');

const hotkeyStatusHint = document.getElementById('hotkey-status-hint');

let assignedStartHotkey = localStorage.getItem('tiktok_round_start_hotkey') || localStorage.getItem('tiktok_round_hotkey') || 'F6';
let assignedRaffleHotkey = localStorage.getItem('tiktok_round_raffle_hotkey') || 'F8';
let activeHotkeyRecording = null; // 'start' | 'raffle' | null
let recordingStartTime = 0;

function formatHotkeyName(code) {
  if (!code) return 'Atanmadı';
  const c = String(code).trim();
  const up = c.toUpperCase();

  // Mouse buttons & Side Macro Buttons (Fare & Yan Makro Tuşları)
  if (up === 'MOUSE4' || up === 'XBUTTON1' || up === 'BUTTON4' || up === 'M4') return 'Mouse 4 (Yan Makro 1)';
  if (up === 'MOUSE5' || up === 'XBUTTON2' || up === 'BUTTON5' || up === 'M5') return 'Mouse 5 (Yan Makro 2)';
  if (up === 'MOUSEMIDDLE' || up === 'MOUSE3' || up === 'MBUTTON') return 'Mouse Orta Tuş (Tekerlek)';
  if (up === 'MOUSERIGHT' || up === 'MOUSE2' || up === 'RBUTTON') return 'Mouse Sağ Tık';
  if (up.startsWith('MOUSE')) {
    const num = up.replace('MOUSE', '');
    return `Mouse ${num} (Makro Tuş)`;
  }

  // Common Keyboard Keys
  if (up === 'SPACE' || c === ' ') return 'Space (Boşluk)';
  if (up === 'ENTER' || up === 'RETURN') return 'Enter';
  if (up === 'ESCAPE' || up === 'ESC') return 'Esc';
  if (up === 'ARROWUP' || up === 'UP') return 'Yukarı Ok ↑';
  if (up === 'ARROWDOWN' || up === 'DOWN') return 'Aşağı Ok ↓';
  if (up === 'ARROWLEFT' || up === 'LEFT') return 'Sol Ok ←';
  if (up === 'ARROWRIGHT' || up === 'RIGHT') return 'Sağ Ok →';
  if (up === 'TAB') return 'Tab';
  if (up === 'BACKSPACE') return 'Backspace';
  if (up === 'DELETE' || up === 'DEL') return 'Delete';
  if (up === 'INSERT') return 'Insert';
  if (up === 'HOME') return 'Home';
  if (up === 'END') return 'End';
  if (up === 'PAGEUP') return 'Page Up';
  if (up === 'PAGEDOWN') return 'Page Down';
  if (c.startsWith('Key')) return c.replace('Key', '');
  if (c.startsWith('Digit')) return c.replace('Digit', '');
  if (c.startsWith('Numpad')) return 'Num ' + c.replace('Numpad', '');
  return c;
}

function updateHotkeysUI() {
  if (currentStartHotkeyLabel) {
    currentStartHotkeyLabel.textContent = formatHotkeyName(assignedStartHotkey);
  }
  if (currentRaffleHotkeyLabel) {
    currentRaffleHotkeyLabel.textContent = formatHotkeyName(assignedRaffleHotkey);
  }
}
updateHotkeysUI();

function syncHotkeysWithBackend() {
  fetch('/api/hotkey', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      startHotkey: assignedStartHotkey,
      raffleHotkey: assignedRaffleHotkey
    })
  }).catch(console.error);
}

function startHotkeyRecording(type) {
  activeHotkeyRecording = type;
  recordingStartTime = Date.now();

  if (type === 'start') {
    if (btnAssignStartHotkey) {
      btnAssignStartHotkey.style.borderColor = '#c084fc';
      btnAssignStartHotkey.style.background = 'rgba(112, 0, 255, 0.25)';
    }
    if (currentStartHotkeyLabel) currentStartHotkeyLabel.textContent = 'Bir tuşa basın...';
    if (hotkeyStatusHint) {
      hotkeyStatusHint.textContent = 'Oylama için klavye tuşuna veya mouse yan makro tuşuna basın. İptal için ESC.';
      hotkeyStatusHint.style.color = '#c084fc';
    }
  } else if (type === 'raffle') {
    if (btnAssignRaffleHotkey) {
      btnAssignRaffleHotkey.style.borderColor = '#38bdf8';
      btnAssignRaffleHotkey.style.background = 'rgba(56, 189, 248, 0.25)';
    }
    if (currentRaffleHotkeyLabel) currentRaffleHotkeyLabel.textContent = 'Bir tuşa basın...';
    if (hotkeyStatusHint) {
      hotkeyStatusHint.textContent = 'Çekiliş için klavye tuşuna veya mouse yan makro tuşuna basın. İptal için ESC.';
      hotkeyStatusHint.style.color = '#38bdf8';
    }
  }
}

function saveAssignedHotkey(assignedKey) {
  if (activeHotkeyRecording === 'start') {
    assignedStartHotkey = assignedKey;
    localStorage.setItem('tiktok_round_start_hotkey', assignedStartHotkey);
    if (btnAssignStartHotkey) { btnAssignStartHotkey.style.borderColor = ''; btnAssignStartHotkey.style.background = ''; }
    showToast(`Oylama (Başlat/Bitir) kısayolu "${formatHotkeyName(assignedStartHotkey)}" olarak ayarlandı!`, 'success');
  } else if (activeHotkeyRecording === 'raffle') {
    assignedRaffleHotkey = assignedKey;
    localStorage.setItem('tiktok_round_raffle_hotkey', assignedRaffleHotkey);
    if (btnAssignRaffleHotkey) { btnAssignRaffleHotkey.style.borderColor = ''; btnAssignRaffleHotkey.style.background = ''; }
    showToast(`Çekiliş (Başlat/Durdur) kısayolu "${formatHotkeyName(assignedRaffleHotkey)}" olarak ayarlandı!`, 'success');
  }

  activeHotkeyRecording = null;
  updateHotkeysUI();
  syncHotkeysWithBackend();

  if (hotkeyStatusHint) {
    hotkeyStatusHint.textContent = `Kısayollar aktif: [Oylama: ${formatHotkeyName(assignedStartHotkey)}] | [Çekiliş: ${formatHotkeyName(assignedRaffleHotkey)}]. Sekme alttayken veya oyundayken de çalışır.`;
    hotkeyStatusHint.style.color = '#34d399';
  }
}

// Assign Start / Stop (Round Toggle) Hotkey
if (btnAssignStartHotkey) {
  btnAssignStartHotkey.addEventListener('click', (e) => {
    e.stopPropagation();
    startHotkeyRecording('start');
  });
}

if (btnClearStartHotkey) {
  btnClearStartHotkey.addEventListener('click', (e) => {
    e.stopPropagation();
    assignedStartHotkey = '';
    localStorage.removeItem('tiktok_round_start_hotkey');
    localStorage.removeItem('tiktok_round_hotkey');
    updateHotkeysUI();
    syncHotkeysWithBackend();
    showToast('Oylama kısayol tuşu kaldırıldı.', 'info');
  });
}

// Assign Raffle (Raffle Toggle) Hotkey
if (btnAssignRaffleHotkey) {
  btnAssignRaffleHotkey.addEventListener('click', (e) => {
    e.stopPropagation();
    startHotkeyRecording('raffle');
  });
}

if (btnClearRaffleHotkey) {
  btnClearRaffleHotkey.addEventListener('click', (e) => {
    e.stopPropagation();
    assignedRaffleHotkey = '';
    localStorage.removeItem('tiktok_round_raffle_hotkey');
    updateHotkeysUI();
    syncHotkeysWithBackend();
    showToast('Çekiliş kısayol tuşu kaldırıldı.', 'info');
  });
}

// Prevent browser navigation on mouse side buttons anywhere
window.addEventListener('auxclick', (e) => {
  if (e.button === 3 || e.button === 4) {
    e.preventDefault();
  }
}, { capture: true, passive: false });

// Mouse Button Capture for Recording Mode (Supports Side Macro Buttons: Mouse4, Mouse5, etc.)
function handleMouseRecordEvent(e) {
  if (!activeHotkeyRecording) return;

  // Do not assign normal left click (button 0) as a hotkey
  if (e.button === 0) {
    if (Date.now() - recordingStartTime > 350) {
      activeHotkeyRecording = null;
      if (btnAssignStartHotkey) { btnAssignStartHotkey.style.borderColor = ''; btnAssignStartHotkey.style.background = ''; }
      if (btnAssignRaffleHotkey) { btnAssignRaffleHotkey.style.borderColor = ''; btnAssignRaffleHotkey.style.background = ''; }
      updateHotkeysUI();
    }
    return;
  }

  e.preventDefault();
  e.stopPropagation();

  let mouseKey = '';
  if (e.button === 1) mouseKey = 'MouseMiddle';
  else if (e.button === 2) mouseKey = 'MouseRight';
  else if (e.button === 3) mouseKey = 'Mouse4';
  else if (e.button === 4) mouseKey = 'Mouse5';
  else mouseKey = `Mouse${e.button + 1}`;

  saveAssignedHotkey(mouseKey);
}

window.addEventListener('pointerdown', handleMouseRecordEvent, { capture: true, passive: false });
window.addEventListener('mousedown', handleMouseRecordEvent, { capture: true, passive: false });
window.addEventListener('auxclick', handleMouseRecordEvent, { capture: true, passive: false });
window.addEventListener('contextmenu', (e) => {
  if (activeHotkeyRecording) {
    e.preventDefault();
    e.stopPropagation();
    saveAssignedHotkey('MouseRight');
  }
}, true);

// Universal Key & Mouse Matching Helpers
function isKeyMatch(assigned, event) {
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

function isMouseMatch(assigned, event) {
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

let lastAdminRoundToggle = 0;
let lastAdminRaffleToggle = 0;

function triggerRoundToggleFromHotkey() {
  const now = Date.now();
  if (now - lastAdminRoundToggle < 600) return;
  lastAdminRoundToggle = now;

  const title = roundTitleInput ? (roundTitleInput.value.trim() || "Chate 1-10 yazın, acımayın!") : "Chate 1-10 yazın, acımayın!";
  const category = roundCategoryInput ? (roundCategoryInput.value.trim() || "Chat konuşuyor") : "Chat konuşuyor";
  const duration = roundDurationInput ? (parseInt(roundDurationInput.value, 10) || 20) : 20;

  socket.emit('toggle_round', { title, category, duration });
}

function triggerRaffleToggleFromHotkey() {
  const now = Date.now();
  if (now - lastAdminRaffleToggle < 600) return;
  lastAdminRaffleToggle = now;

  socket.emit('toggle_raffle', { autoStartCandidateRound: true });
}

// Global Keyboard Listener with Toggle Behavior
window.addEventListener('keydown', (e) => {
  // 1. Hotkey Kayıt Modu
  if (activeHotkeyRecording) {
    e.preventDefault();
    e.stopPropagation();

    if (e.key === 'Escape') {
      activeHotkeyRecording = null;
      if (btnAssignStartHotkey) { btnAssignStartHotkey.style.borderColor = ''; btnAssignStartHotkey.style.background = ''; }
      if (btnAssignRaffleHotkey) { btnAssignRaffleHotkey.style.borderColor = ''; btnAssignRaffleHotkey.style.background = ''; }
      updateHotkeysUI();
      if (hotkeyStatusHint) {
        hotkeyStatusHint.textContent = 'Tuş atama iptal edildi.';
        hotkeyStatusHint.style.color = 'var(--text-muted)';
      }
      return;
    }

    let rawKey = e.code || e.key;
    if (rawKey === 'Space') rawKey = 'SPACE';
    saveAssignedHotkey(rawKey);
    return;
  }

  // 2. Normal mod: Yazı yazılıyorsa kısayolları tetikleme
  const activeEl = document.activeElement;
  if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
    return;
  }

  // 3. Oylama Toggle
  if (isKeyMatch(assignedStartHotkey, e)) {
    e.preventDefault();
    triggerRoundToggleFromHotkey();
    return;
  }

  // 4. Çekiliş Toggle
  if (isKeyMatch(assignedRaffleHotkey, e)) {
    e.preventDefault();
    triggerRaffleToggleFromHotkey();
    return;
  }
});

// Normal Mode: Mouse Buttons Trigger (Side Macro Buttons, Middle Click, Right Click)
function handleMouseTrigger(e) {
  if (activeHotkeyRecording) return;
  const activeEl = document.activeElement;
  if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;

  if (isMouseMatch(assignedStartHotkey, e)) {
    e.preventDefault();
    e.stopPropagation();
    triggerRoundToggleFromHotkey();
  } else if (isMouseMatch(assignedRaffleHotkey, e)) {
    e.preventDefault();
    e.stopPropagation();
    triggerRaffleToggleFromHotkey();
  }
}

window.addEventListener('pointerdown', handleMouseTrigger, { capture: true, passive: false });

// ---------------- 6. SESSION HISTORY & SOUNDBOARD ----------------
let sessionHistory = [];
const statHistoryRounds = document.getElementById('stat-history-rounds');
const statHistoryBest = document.getElementById('stat-history-best');
const statHistoryVotes = document.getElementById('stat-history-votes');
const historyRoundsList = document.getElementById('history-rounds-list');
const btnClearHistory = document.getElementById('btn-clear-history');

function addRoundToSessionHistory(result) {
  if (!result) return;
  const avg = parseFloat(result.average || 0);
  const total = parseInt(result.totalVotes || 0, 10);
  const title = result.title || 'Puanlama Turu';
  const verdict = result.verdict || {};
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  sessionHistory.unshift({
    title,
    average: avg,
    totalVotes: total,
    badge: verdict.badge || 'SONUÇ',
    color: verdict.color || '#38bdf8',
    time: timeStr
  });

  renderSessionHistoryUI();
}

function renderSessionHistoryUI() {
  if (!statHistoryRounds || !historyRoundsList) return;

  const totalRounds = sessionHistory.length;
  let totalVotes = 0;
  let bestScore = 0;

  sessionHistory.forEach(item => {
    totalVotes += item.totalVotes;
    if (item.average > bestScore) bestScore = item.average;
  });

  statHistoryRounds.textContent = totalRounds;
  statHistoryBest.textContent = totalRounds > 0 ? bestScore.toFixed(1) : '0.0';
  statHistoryVotes.textContent = totalVotes;

  if (sessionHistory.length === 0) {
    historyRoundsList.innerHTML = `
      <div class="table-empty" style="padding: 12px 0; font-size: 0.78rem; text-align: center; color: var(--text-muted);">
        Henüz tamamlanmış bir puanlama turu yok.
      </div>
    `;
    return;
  }

  historyRoundsList.innerHTML = '';
  sessionHistory.forEach((item, idx) => {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.justifyContent = 'space-between';
    row.style.padding = '6px 10px';
    row.style.background = 'rgba(255, 255, 255, 0.03)';
    row.style.border = '1px solid rgba(255, 255, 255, 0.06)';
    row.style.borderRadius = '8px';
    row.style.fontSize = '0.78rem';

    row.innerHTML = `
      <div style="display: flex; flex-direction: column; overflow: hidden; max-width: 65%;">
        <span style="font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          #${totalRounds - idx}: ${escapeHtml(item.title)}
        </span>
        <span style="font-size: 0.7rem; color: var(--text-muted);">${item.time} • ${item.totalVotes} Oy</span>
      </div>
      <div style="display: flex; align-items: center; gap: 6px;">
        <span style="font-size: 0.68rem; font-weight: 800; padding: 2px 6px; border-radius: 4px; background: ${item.color}22; color: ${item.color}; border: 1px solid ${item.color}44;">
          ${escapeHtml(item.badge)}
        </span>
        <span style="font-family: var(--font-mono); font-weight: 800; font-size: 0.88rem; color: #fbee38;">
          ${item.average.toFixed(1)}
        </span>
      </div>
    `;
    historyRoundsList.appendChild(row);
  });
}

if (btnClearHistory) {
  btnClearHistory.addEventListener('click', () => {
    showCustomConfirm({
      title: 'Oturum Geçmişini Sıfırla',
      message: 'Tamamlanan tüm puanlama turlarının ve istatistiklerinin geçmişini sıfırlamak istediğinize emin misiniz?',
      confirmText: 'Evet, Sıfırla',
      cancelText: 'Vazgeç',
      icon: '🗑️',
      onConfirm: () => {
        sessionHistory = [];
        renderSessionHistoryUI();
        showToast('Oturum geçmişi sıfırlandı.', 'info');
      }
    });
  });
}

// Retro Web Audio Synthesizer for Admin Panel Testing
let adminAudioCtx = null;
function getAdminAudioContext() {
  if (!adminAudioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) adminAudioCtx = new AudioContextClass();
  }
  if (adminAudioCtx && adminAudioCtx.state === 'suspended') {
    adminAudioCtx.resume();
  }
  return adminAudioCtx;
}

let activeAdminSpinTimer = null;

function playAdminRaffleTick(vol = 0.38, delaySec = 0) {
  try {
    const ctx = getAdminAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime + (delaySec || 0);

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

function playAdminRaffleSpin() {
  if (activeAdminSpinTimer) clearTimeout(activeAdminSpinTimer);
  const totalDuration = 3400; // 3.4 seconds spin simulation
  const startTime = Date.now();
  let nextTickDelay = 35;

  function tick() {
    const elapsed = Date.now() - startTime;
    if (elapsed >= totalDuration) {
      playAdminSound('raffle_win');
      return;
    }
    playAdminRaffleTick(0.40);
    const progress = elapsed / totalDuration;
    nextTickDelay = 35 + Math.pow(progress, 2.7) * 420;
    activeAdminSpinTimer = setTimeout(tick, nextTickDelay);
  }
  tick();
}

function playAdminSound(type) {
  try {
    const ctx = getAdminAudioContext();
    if (!ctx) return;

    if (type === 'coin') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(987.77, ctx.currentTime);
      osc.frequency.setValueAtTime(1318.51, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === 'alert') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === 'victory') {
      const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = ctx.currentTime + idx * 0.08;
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.18, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.3);
      });
    } else if (type === 'fail') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(80, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } else if (type === 'raffle_tick') {
      playAdminRaffleTick(0.42);
    } else if (type === 'raffle_spin') {
      playAdminRaffleSpin();
    } else if (type === 'raffle_win') {
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
    } else if (type === 'racon') {
      const notes = [659.25, 880.00, 1318.51]; // E5, A5, E6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = ctx.currentTime + idx * 0.07;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.22, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.35);
      });
    }
  } catch (e) {}
}

const btnSoundCoin = document.getElementById('btn-sound-coin');
const btnSoundAlert = document.getElementById('btn-sound-alert');
const btnSoundVictory = document.getElementById('btn-sound-victory');
const btnSoundFail = document.getElementById('btn-sound-fail');
const btnSoundRaffleTick = document.getElementById('btn-sound-raffle-tick');
const btnSoundRaffleSpin = document.getElementById('btn-sound-raffle-spin');
const btnSoundRaffleWin = document.getElementById('btn-sound-raffle-win');
const btnSoundRacon = document.getElementById('btn-sound-racon');

if (btnSoundCoin) btnSoundCoin.addEventListener('click', () => playAdminSound('coin'));
if (btnSoundAlert) btnSoundAlert.addEventListener('click', () => playAdminSound('alert'));
if (btnSoundVictory) btnSoundVictory.addEventListener('click', () => playAdminSound('victory'));
if (btnSoundFail) btnSoundFail.addEventListener('click', () => playAdminSound('fail'));
if (btnSoundRaffleTick) btnSoundRaffleTick.addEventListener('click', () => playAdminSound('raffle_tick'));
if (btnSoundRaffleSpin) btnSoundRaffleSpin.addEventListener('click', () => playAdminSound('raffle_spin'));
if (btnSoundRaffleWin) btnSoundRaffleWin.addEventListener('click', () => playAdminSound('raffle_win'));
if (btnSoundRacon) btnSoundRacon.addEventListener('click', () => playAdminSound('racon'));


