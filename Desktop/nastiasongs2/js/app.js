/**
 * Логика музыкального сайта Насти Луневой
 * - Воспроизведение треков, плейлист, прогресс, громкость
 * - Поиск по 95 песням в реальном времени
 * - Учет и сохранение статистики (прослушивания, скачивания) в localStorage
 * - Уведомления и адаптивная обработка файлов
 */

(function () {
  'use strict';

  // ==========================================
  // 1. ИНИЦИАЛИЗАЦИЯ И СОСТОЯНИЕ
  // ==========================================
  const STATS_STORAGE_KEY = 'nastiasongs_stats_v1';
  let stats = loadStats();

  let currentIndex = 0;
  let isPlaying = false;
  let isShuffle = false;
  let repeatMode = 'all'; // 'all', 'one', 'none'
  let audioFallbackTried = false;

  const audio = new Audio();
  audio.preload = 'metadata';

  // DOM Элементы
  const songsListEl = document.getElementById('songsList');
  const noResultsEl = document.getElementById('noResults');
  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');
  const searchCountBadge = document.getElementById('searchCountBadge');
  const totalSongsCount = document.getElementById('totalSongsCount');
  const totalPlaysHeader = document.getElementById('totalPlaysHeader');
  const totalDownloadsHeader = document.getElementById('totalDownloadsHeader');

  // Плеер
  const playerArt = document.getElementById('playerArt');
  const currentTitleEl = document.getElementById('currentTrackTitle');
  const currentArtistEl = document.getElementById('currentTrackArtist');
  const playPauseBtn = document.getElementById('playPauseBtn');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const shuffleBtn = document.getElementById('shuffleBtn');
  const repeatBtn = document.getElementById('repeatBtn');
  const progressTrack = document.getElementById('progressTrack');
  const progressFill = document.getElementById('progressFill');
  const currentTimeEl = document.getElementById('currentTime');
  const durationTimeEl = document.getElementById('durationTime');
  const volumeSlider = document.getElementById('volumeSlider');
  const volumeBtn = document.getElementById('volumeBtn');
  const qrImageEl = document.getElementById('qrImage');
  const toastContainer = document.getElementById('toastContainer');

  // ==========================================
  // 2. СТАТИСТИКА (localStorage)
  // ==========================================
  function loadStats() {
    try {
      const data = localStorage.getItem(STATS_STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      console.warn('Ошибка загрузки статистики:', e);
      return {};
    }
  }

  function saveStats() {
    try {
      localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
    } catch (e) {
      console.warn('Ошибка сохранения статистики:', e);
    }
  }

  function getSongStats(id) {
    if (!stats[id]) {
      stats[id] = { plays: 0, downloads: 0 };
    }
    return stats[id];
  }

  function incrementPlay(id) {
    const s = getSongStats(id);
    s.plays += 1;
    saveStats();
    updateSongRowStats(id);
    updateHeaderTotals();
  }

  function incrementDownload(id) {
    const s = getSongStats(id);
    s.downloads += 1;
    saveStats();
    updateSongRowStats(id);
    updateHeaderTotals();
  }

  function updateSongRowStats(id) {
    const s = getSongStats(id);
    const playsEl = document.getElementById(`plays-val-${id}`);
    const downloadsEl = document.getElementById(`downloads-val-${id}`);
    if (playsEl) playsEl.textContent = s.plays;
    if (downloadsEl) downloadsEl.textContent = s.downloads;
  }

  function updateHeaderTotals() {
    let totalPlays = 0;
    let totalDownloads = 0;
    Object.values(stats).forEach(s => {
      totalPlays += (s.plays || 0);
      totalDownloads += (s.downloads || 0);
    });
    if (totalPlaysHeader) totalPlaysHeader.textContent = totalPlays;
    if (totalDownloadsHeader) totalDownloadsHeader.textContent = totalDownloads;
  }

  // ==========================================
  // 3. ОТРИСОВКА СПИСКА ПЕСЕН
  // ==========================================
  function renderSongs(songsToRender) {
    songsListEl.innerHTML = '';

    if (songsToRender.length === 0) {
      noResultsEl.style.display = 'block';
      return;
    }
    noResultsEl.style.display = 'none';

    const fragment = document.createDocumentFragment();

    songsToRender.forEach((song) => {
      const s = getSongStats(song.id);
      const isCurrent = (song.id === SONGS_DATA[currentIndex].id);
      const row = document.createElement('div');
      row.className = `song-row ${isCurrent ? 'active' : ''} ${isCurrent && isPlaying ? 'playing' : ''}`;
      row.id = `song-row-${song.id}`;
      row.dataset.id = song.id;

      const padIndex = String(song.id).padStart(2, '0');

      row.innerHTML = `
        <div class="song-index">#${padIndex}</div>
        <button class="row-play-btn" aria-label="Воспроизвести ${song.title}" title="Воспроизвести">
          <svg class="row-play-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            ${isCurrent && isPlaying ? 
              '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>' : 
              '<path d="M8 5v14l11-7z"/>'}
          </svg>
          <div class="equalizer-anim">
            <span class="eq-bar"></span>
            <span class="eq-bar"></span>
            <span class="eq-bar"></span>
          </div>
        </button>
        <div class="song-details">
          <div class="song-name" title="${song.title}">${escapeHTML(song.title)}</div>
          <div class="song-author">${escapeHTML(song.artist)}</div>
        </div>
        <div class="song-stats">
          <div class="stat-pill plays" title="Количество прослушиваний">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
              <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
            </svg>
            <span class="stat-num" id="plays-val-${song.id}">${s.plays}</span>
          </div>
          <div class="stat-pill downloads" title="Количество скачиваний">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span class="stat-num" id="downloads-val-${song.id}">${s.downloads}</span>
          </div>
        </div>
        <div class="song-actions">
          <button class="btn-download" data-id="${song.id}" title="Скачать песню">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>Скачать</span>
          </button>
        </div>
      `;

      // Клик по всей строке или кнопке Play включает песню
      row.addEventListener('click', (e) => {
        // Если клик по кнопке скачать - не запускаем проигрывание
        if (e.target.closest('.btn-download')) return;

        const targetIndex = SONGS_DATA.findIndex(item => item.id === song.id);
        if (targetIndex !== -1) {
          if (currentIndex === targetIndex) {
            togglePlayPause();
          } else {
            loadSong(targetIndex, true);
          }
        }
      });

      // Клик по кнопке скачать
      const downloadBtn = row.querySelector('.btn-download');
      downloadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        downloadSong(song);
      });

      fragment.appendChild(row);
    });

    songsListEl.appendChild(fragment);
  }

  // ==========================================
  // 4. УПРАВЛЕНИЕ АУДИОПЛЕЕРОМ
  // ==========================================
  function loadSong(index, autoPlay = false) {
    if (index < 0 || index >= SONGS_DATA.length) return;

    currentIndex = index;
    const song = SONGS_DATA[currentIndex];
    audioFallbackTried = false;

    // Обновляем плеер
    currentTitleEl.textContent = song.title;
    currentArtistEl.textContent = song.artist;

    // Устанавливаем источник аудио
    audio.src = song.src;
    audio.load();

    // Обновляем визуальный активный статус
    updateActiveRowVisual();

    if (autoPlay) {
      startPlayback();
    } else {
      pausePlaybackVisual();
    }
  }

  function startPlayback() {
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          isPlaying = true;
          updatePlayPauseBtnVisual(true);
          updateActiveRowVisual();
          // Считаем прослушивание
          const song = SONGS_DATA[currentIndex];
          incrementPlay(song.id);
        })
        .catch(err => {
          console.log('Воспроизведение ожидает действия пользователя или файл еще не загружен:', err);
        });
    }
  }

  function pausePlayback() {
    audio.pause();
    isPlaying = false;
    pausePlaybackVisual();
  }

  function pausePlaybackVisual() {
    updatePlayPauseBtnVisual(false);
    updateActiveRowVisual();
  }

  function togglePlayPause() {
    if (isPlaying) {
      pausePlayback();
    } else {
      // Если источник еще не загружен
      if (!audio.src || audio.src === window.location.href) {
        loadSong(currentIndex, true);
      } else {
        startPlayback();
      }
    }
  }

  function playNext() {
    if (isShuffle) {
      let nextIdx = Math.floor(Math.random() * SONGS_DATA.length);
      if (nextIdx === currentIndex && SONGS_DATA.length > 1) {
        nextIdx = (nextIdx + 1) % SONGS_DATA.length;
      }
      loadSong(nextIdx, true);
    } else {
      let nextIdx = currentIndex + 1;
      if (nextIdx >= SONGS_DATA.length) {
        if (repeatMode === 'all') {
          nextIdx = 0;
        } else {
          pausePlayback();
          return;
        }
      }
      loadSong(nextIdx, true);
    }
  }

  function playPrev() {
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    let prevIdx = currentIndex - 1;
    if (prevIdx < 0) {
      prevIdx = SONGS_DATA.length - 1;
    }
    loadSong(prevIdx, true);
  }

  function updatePlayPauseBtnVisual(playing) {
    if (playing) {
      playPauseBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
        </svg>
      `;
      playerArt.classList.add('playing');
    } else {
      playPauseBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
          <path d="M8 5v14l11-7z"/>
        </svg>
      `;
      playerArt.classList.remove('playing');
    }
  }

  function updateActiveRowVisual() {
    const currentSong = SONGS_DATA[currentIndex];
    document.querySelectorAll('.song-row').forEach(row => {
      const isThisRow = (parseInt(row.dataset.id, 10) === currentSong.id);
      row.classList.toggle('active', isThisRow);
      row.classList.toggle('playing', isThisRow && isPlaying);

      const playIcon = row.querySelector('.row-play-icon');
      if (playIcon) {
        playIcon.innerHTML = (isThisRow && isPlaying) ? 
          '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>' : 
          '<path d="M8 5v14l11-7z"/>';
      }
    });
  }

  // Ошибка загрузки трека (например, если пользователь еще не положил mp3 в папку)
  audio.addEventListener('error', (e) => {
    const song = SONGS_DATA[currentIndex];
    
    // Пробуем альтернативное имя файла (без номера впереди)
    if (!audioFallbackTried) {
      audioFallbackTried = true;
      audio.src = song.altSrc;
      audio.load();
      if (isPlaying) {
        audio.play().catch(() => {});
      }
      return;
    }

    // Если оба варианта не найдены
    isPlaying = false;
    pausePlaybackVisual();
    showToast(`Файл песни «${song.title}» еще не добавлен в папку songs. Скопируйте аудиофайл в папку songs/`, 'info', 5000);
  });

  // События аудио для прогресса
  audio.addEventListener('timeupdate', () => {
    if (audio.duration) {
      const percent = (audio.currentTime / audio.duration) * 100;
      progressFill.style.width = `${percent}%`;
      currentTimeEl.textContent = formatTime(audio.currentTime);
    }
  });

  audio.addEventListener('loadedmetadata', () => {
    durationTimeEl.textContent = formatTime(audio.duration);
  });

  audio.addEventListener('ended', () => {
    if (repeatMode === 'one') {
      audio.currentTime = 0;
      audio.play();
    } else {
      playNext();
    }
  });

  // Перемотка кликом по полосе прогресса
  progressTrack.addEventListener('click', (e) => {
    const rect = progressTrack.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    if (audio.duration) {
      audio.currentTime = (clickX / width) * audio.duration;
    }
  });

  // Громкость
  volumeSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    audio.volume = val;
    audio.muted = (val === 0);
    updateVolumeIcon(val);
  });

  let lastVolume = 1;
  volumeBtn.addEventListener('click', () => {
    if (audio.muted || audio.volume === 0) {
      audio.muted = false;
      audio.volume = lastVolume || 0.8;
      volumeSlider.value = audio.volume;
    } else {
      lastVolume = audio.volume;
      audio.muted = true;
      audio.volume = 0;
      volumeSlider.value = 0;
    }
    updateVolumeIcon(audio.volume);
  });

  function updateVolumeIcon(val) {
    if (audio.muted || val === 0) {
      volumeBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="1" y1="1" x2="23" y2="23"></line>
          <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
          <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0a7 7 0 0 1-.11 1.23"></path>
          <line x1="12" y1="19" x2="12" y2="23"></line>
          <line x1="8" y1="23" x2="16" y2="23"></line>
        </svg>
      `;
    } else if (val < 0.5) {
      volumeBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
        </svg>
      `;
    } else {
      volumeBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
        </svg>
      `;
    }
  }

  // Shuffle & Repeat
  shuffleBtn.addEventListener('click', () => {
    isShuffle = !isShuffle;
    shuffleBtn.classList.toggle('active', isShuffle);
    showToast(isShuffle ? 'Случайный порядок включен' : 'Случайный порядок выключен', 'info', 2000);
  });

  repeatBtn.addEventListener('click', () => {
    if (repeatMode === 'all') {
      repeatMode = 'one';
      repeatBtn.classList.add('active');
      repeatBtn.title = 'Повтор одного трека';
      showToast('Повтор текущей песни', 'info', 2000);
    } else if (repeatMode === 'one') {
      repeatMode = 'none';
      repeatBtn.classList.remove('active');
      repeatBtn.title = 'Повтор выключен';
      showToast('Повтор выключен', 'info', 2000);
    } else {
      repeatMode = 'all';
      repeatBtn.classList.add('active');
      repeatBtn.title = 'Повтор всех треков';
      showToast('Повтор всего списка', 'info', 2000);
    }
  });

  playPauseBtn.addEventListener('click', togglePlayPause);
  prevBtn.addEventListener('click', playPrev);
  nextBtn.addEventListener('click', playNext);

  // ==========================================
  // 5. СКАЧИВАНИЕ ПЕСНИ
  // ==========================================
  function downloadSong(song) {
    // Увеличиваем счетчик скачиваний
    incrementDownload(song.id);

    // Создаем ссылку для скачивания
    const link = document.createElement('a');
    link.href = song.src;
    link.download = song.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(`Начато скачивание: «${song.title}»`, 'green', 3500);
  }

  // ==========================================
  // 6. ПОИСК ПО ПЕСНЯМ
  // ==========================================
  function handleSearch() {
    const query = searchInput.value.trim().toLowerCase();
    searchClear.style.display = query ? 'block' : 'none';

    if (!query) {
      renderSongs(SONGS_DATA);
      searchCountBadge.textContent = `${SONGS_DATA.length} песен`;
      return;
    }

    const filtered = SONGS_DATA.filter(song => 
      song.title.toLowerCase().includes(query) || 
      String(song.id).includes(query)
    );

    renderSongs(filtered);
    searchCountBadge.textContent = `Найдено: ${filtered.length}`;
  }

  searchInput.addEventListener('input', handleSearch);

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchInput.focus();
    handleSearch();
  });

  // ==========================================
  // 7. ОБРАБОТКА QR-КОДА ПРИВАТБАНКА
  // ==========================================
  function setupQrCode() {
    // Пробуем qr-privatbank.png -> qr-privatbank.jpg -> qr-placeholder.svg
    const candidates = [
      'images/qr-privatbank.png',
      'images/qr-privatbank.jpg',
      'images/qr-placeholder.svg'
    ];
    let candidateIndex = 0;

    function tryNextImage() {
      if (candidateIndex < candidates.length) {
        qrImageEl.src = candidates[candidateIndex++];
      }
    }

    qrImageEl.addEventListener('error', () => {
      tryNextImage();
    });

    tryNextImage();
  }

  // ==========================================
  // 8. УВЕДОМЛЕНИЯ (TOASTS)
  // ==========================================
  function showToast(message, type = 'info', duration = 3500) {
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'green' ? 'toast-green' : (type === 'blue' ? 'toast-blue' : '')}`;
    
    let icon = `
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>
    `;

    if (type === 'green') {
      icon = `
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#22c55e" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
      `;
    }

    toast.innerHTML = `
      <div style="flex-shrink:0;">${icon}</div>
      <div>${escapeHTML(message)}</div>
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => {
        if (toast.parentNode) {
          toastContainer.removeChild(toast);
        }
      }, 300);
    }, duration);
  }

  // ==========================================
  // 9. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
  // ==========================================
  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function escapeHTML(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ==========================================
  // 10. ЗАПУСК ПРИЛОЖЕНИЯ
  // ==========================================
  function init() {
    totalSongsCount.textContent = SONGS_DATA.length;
    searchCountBadge.textContent = `${SONGS_DATA.length} песен`;
    
    renderSongs(SONGS_DATA);
    loadSong(0, false);
    updateHeaderTotals();
    setupQrCode();

    // Горячие клавиши (Пробел - Пауза/Плей)
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        togglePlayPause();
      }
    });
  }

  // Запуск после загрузки DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
