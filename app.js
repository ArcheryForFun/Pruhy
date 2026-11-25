(() => {
  // --- Stav ---
  let isRunning = false;
  let currentLane = null; // 'left' | 'right' | null
  let watchId = null;

  let leftDistance = 0;   // metry
  let rightDistance = 0;
  let leftTimeMs = 0;
  let rightTimeMs = 0;

  let lastPosition = null;
  let lastTimestamp = null;
  let tickInterval = null;

  // --- Elementy ---
  const el = {
    statusText: document.getElementById('statusText'),
    currentLane: document.getElementById('currentLane'),
    speed: document.getElementById('speed'),
    accuracy: document.getElementById('accuracy'),
    leftDistance: document.getElementById('leftDistance'),
    rightDistance: document.getElementById('rightDistance'),
    leftTime: document.getElementById('leftTime'),
    rightTime: document.getElementById('rightTime'),
    totalDistance: document.getElementById('totalDistance'),
    totalTime: document.getElementById('totalTime'),
    btnLeft: document.getElementById('btnLeft'),
    btnRight: document.getElementById('btnRight'),
    btnStartStop: document.getElementById('btnStartStop'),
    btnReset: document.getElementById('btnReset'),
    cardLeft: document.querySelector('.stat-card.left'),
    cardRight: document.querySelector('.stat-card.right'),
  };

  // --- Pomocné funkce ---
  function formatKm(meters) {
    return (meters / 1000).toFixed(2).replace('.', ',') + ' km';
  }

  function formatTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
  }

  function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000; // metry
    const toRad = deg => deg * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function updateUI() {
    el.leftDistance.textContent = formatKm(leftDistance);
    el.rightDistance.textContent = formatKm(rightDistance);
    el.leftTime.textContent = formatTime(leftTimeMs);
    el.rightTime.textContent = formatTime(rightTimeMs);

    const totalDist = leftDistance + rightDistance;
    const totalTime = leftTimeMs + rightTimeMs;
    el.totalDistance.textContent = formatKm(totalDist);
    el.totalTime.textContent = formatTime(totalTime);

    if (!isRunning) {
      el.statusText.textContent = 'Zastaveno';
      el.statusText.className = 'value paused';
      el.currentLane.textContent = '—';
    } else {
      el.statusText.textContent = 'Běží';
      el.statusText.className = 'value running';
      el.currentLane.textContent =
        currentLane === 'left' ? 'Levý' :
        currentLane === 'right' ? 'Pravý' : '— (vyber pruh)';
    }

    // Aktivní tlačítka a karty
    el.btnLeft.classList.toggle('active', currentLane === 'left');
    el.btnRight.classList.toggle('active', currentLane === 'right');
    el.cardLeft.classList.toggle('active', currentLane === 'left' && isRunning);
    el.cardRight.classList.toggle('active', currentLane === 'right' && isRunning);

    el.btnLeft.disabled = !isRunning;
    el.btnRight.disabled = !isRunning;

    el.btnStartStop.textContent = isRunning ? 'STOP' : 'START';
    el.btnStartStop.classList.toggle('running', isRunning);
  }

  // --- GPS ---
  function onPosition(pos) {
    const { latitude, longitude, accuracy, speed } = pos.coords;
    const now = pos.timestamp || Date.now();

    el.accuracy.textContent = accuracy != null
      ? `±${Math.round(accuracy)} m`
      : '—';

    if (speed != null && !isNaN(speed)) {
      el.speed.textContent = `${Math.round(speed * 3.6)} km/h`;
    }

    if (isRunning && currentLane && lastPosition) {
      const dist = haversine(
        lastPosition.lat,
        lastPosition.lon,
        latitude,
        longitude
      );

      // Filtrujeme šum GPS (příliš malé skoky a velké chyby)
      if (dist > 2 && dist < 200 && accuracy < 50) {
        if (currentLane === 'left') leftDistance += dist;
        else if (currentLane === 'right') rightDistance += dist;
      }
    }

    lastPosition = { lat: latitude, lon: longitude };
    updateUI();
  }

  function onError(err) {
    console.warn('GPS error:', err.message);
    el.accuracy.textContent = 'Chyba GPS';
  }

  function startGps() {
    if (!navigator.geolocation) {
      alert('Tento prohlížeč nepodporuje GPS.');
      return false;
    }

    watchId = navigator.geolocation.watchPosition(onPosition, onError, {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 10000,
    });
    return true;
  }

  function stopGps() {
    if (watchId != null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
  }

  // --- Časovač (pro přesný čas v pruhu) ---
  function startTicker() {
    lastTimestamp = Date.now();
    tickInterval = setInterval(() => {
      if (!isRunning || !currentLane) return;
      const now = Date.now();
      const delta = now - lastTimestamp;
      lastTimestamp = now;

      if (currentLane === 'left') leftTimeMs += delta;
      else if (currentLane === 'right') rightTimeMs += delta;

      updateUI();
    }, 500);
  }

  function stopTicker() {
    if (tickInterval) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
  }

  // --- Ovládání ---
  function start() {
    if (!startGps()) return;

    isRunning = true;
    // Pokud ještě není vybraný pruh, necháme uživatele vybrat
    startTicker();
    updateUI();
  }

  function stop() {
    isRunning = false;
    stopTicker();
    // GPS necháme běžet, ať se rychlost/přesnost stále ukazují
    // stopGps(); // odkomentuj, pokud chceš GPS úplně vypnout
    updateUI();
  }

  el.btnStartStop.addEventListener('click', () => {
    if (isRunning) stop();
    else start();
  });

  el.btnLeft.addEventListener('click', () => {
    if (!isRunning) return;
    currentLane = 'left';
    lastTimestamp = Date.now(); // aby se čas nepřeskakoval
    updateUI();
  });

  el.btnRight.addEventListener('click', () => {
    if (!isRunning) return;
    currentLane = 'right';
    lastTimestamp = Date.now();
    updateUI();
  });

  el.btnReset.addEventListener('click', () => {
    if (!confirm('Opravdu chceš vynulovat všechna měření?')) return;

    stop();
    leftDistance = 0;
    rightDistance = 0;
    leftTimeMs = 0;
    rightTimeMs = 0;
    currentLane = null;
    lastPosition = null;
    el.speed.textContent = '0 km/h';
    updateUI();
  });

  // Inicializace
  updateUI();

  // Požádej o GPS hned na začátku (lepší UX)
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      () => {},
      () => {},
      { enableHighAccuracy: true }
    );
  }
})();
