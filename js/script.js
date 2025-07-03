document.addEventListener('DOMContentLoaded', () => {
    const CHANNEL_ID = 2999714;
    const READ_API_KEY = '95YOHGB903ET32DX';

    let tempChart, humidityChart, vpdChart, soilChart;

    function calculateVPD(temp, humidity) {
        if (!temp || !humidity) return null;
        const svp = 0.61078 * Math.exp((17.27 * temp) / (temp + 237.3));
        const vp = svp * (humidity / 100);
        return (svp - vp).toFixed(2);
    }

    function getTimeUnit(hours) {
        if (hours <= 1) return 'minute';
        if (hours <= 6) return 'hour';
        if (hours <= 168) return 'day';
        return 'week';
    }

    const colors = {
        textColor: getComputedStyle(document.documentElement).getPropertyValue('--text-color'),
        gridColor: window.matchMedia('(prefers-color-scheme: dark)').matches ?
            'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        tempColor: '#2f6b3e',
        humidityColor: '#3e8c4d',
        vpdColor: '#4caf50',
        soilColor: '#6a994e'
    };

    function getChartConfig(label, unit, color, timeUnit) {
        return {
            type: 'line',
            data: {
                datasets: [{
                    label,
                    borderColor: color,
                    backgroundColor: color + '20',
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.1,
                    data: []
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            tooltipFormat: 'DD.MM HH:mm',
                            unit: timeUnit,
                            stepSize: 1
                        },
                        grid: { color: colors.gridColor },
                        ticks: { color: colors.textColor }
                    },
                    y: {
                        title: { display: true, text: unit, color: colors.textColor },
                        grid: { color: colors.gridColor },
                        ticks: { color: colors.textColor }
                    }
                },
                plugins: {
                    legend: {
                        labels: { color: colors.textColor }
                    },
                    tooltip: {
                        mode: 'nearest',
                        intersect: false,
                        callbacks: {
                            label: ctx => `${ctx.parsed.y} ${unit}`
                        }
                    }
                }
            }
        };
    }

    // Charts initialisieren
    const ctxTemp = document.getElementById('tempChart').getContext('2d');
    const ctxHumidity = document.getElementById('humidityChart').getContext('2d');
    const ctxVpd = document.getElementById('vpdChart').getContext('2d');
    const ctxSoil = document.getElementById('soilChart').getContext('2d');

    tempChart = new Chart(ctxTemp, getChartConfig('Temperatur', '°C', colors.tempColor, 'hour'));
    humidityChart = new Chart(ctxHumidity, getChartConfig('Luftfeuchtigkeit', '%', colors.humidityColor, 'hour'));
    vpdChart = new Chart(ctxVpd, getChartConfig('VPD', 'kPa', colors.vpdColor, 'hour'));
    soilChart = new Chart(ctxSoil, getChartConfig('Bodenfeuchtigkeit', '%', colors.soilColor, 'hour'));

    const currentVpdElem = document.getElementById('currentVpd');

    async function fetchData(hours) {
        const endTime = Math.floor(Date.now() / 1000);
        const startTime = endTime - hours * 3600;

        const url = `https://api.thingspeak.com/channels/${CHANNEL_ID}/feeds.json?api_key=${READ_API_KEY}&start=${new Date(startTime * 1000).toISOString()}&end=${new Date(endTime * 1000).toISOString()}&results=1000`;

        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error('Netzwerkantwort war nicht ok');
            const json = await res.json();
            return json.feeds;
        } catch (e) {
            console.error('Fehler beim Laden der Daten:', e);
            return [];
        }
    }

    function processData(feeds) {
        const tempData = [];
        const humidityData = [];
        const vpdData = [];
        const soilData = [];

        feeds.forEach(f => {
            if (f.created_at) {
                const time = new Date(f.created_at);

                const temp = parseFloat(f.field1);
                const humidity = parseFloat(f.field2);
                const soilMoisture = parseFloat(f.field3); // Bodenfeuchtigkeit in field3 annehmen
                const vpd = calculateVPD(temp, humidity);

                if (!isNaN(temp)) tempData.push({ x: time, y: temp });
                if (!isNaN(humidity)) humidityData.push({ x: time, y: humidity });
                if (!isNaN(soilMoisture)) soilData.push({ x: time, y: soilMoisture });
                if (vpd !== null) vpdData.push({ x: time, y: parseFloat(vpd) });
            }
        });

        return { tempData, humidityData, vpdData, soilData };
    }

    function updateCharts(data) {
        tempChart.data.datasets[0].data = data.tempData;
        humidityChart.data.datasets[0].data = data.humidityData;
        vpdChart.data.datasets[0].data = data.vpdData;
        soilChart.data.datasets[0].data = data.soilData;

        tempChart.update();
        humidityChart.update();
        vpdChart.update();
        soilChart.update();

        if (data.vpdData.length > 0) {
            const lastVpd = data.vpdData[data.vpdData.length - 1].y;
            currentVpdElem.textContent = `Aktueller VPD: ${lastVpd.toFixed(2)} kPa`;
        }
    }

    // Module / Submodule Handling
    const mainBtns = document.querySelectorAll('.main-btn[data-main]');
    const modules = document.querySelectorAll('.module');
    const navBtns = document.querySelectorAll('.nav-btn');
    const subModules = document.querySelectorAll('.sub-module');

    function showModule(id) {
        modules.forEach(m => m.classList.remove('active'));
        document.getElementById(id).classList.add('active');
    }

    function showSubModule(id) {
        subModules.forEach(sm => sm.classList.remove('active'));
        document.getElementById(id).classList.add('active');
    }

    mainBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            showModule(btn.dataset.main);
            if (btn.dataset.main === 'climate') {
                // standard submodule beim Klima
                showSubModule('temp-module');
            }
            if (btn.dataset.main === 'guide') {
                loadGuideList();
            }
        });
    });

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.module + '-module';
            showSubModule(id);
            // Daten neu laden für den ausgewählten Zeitraum (Standard 24h)
            const select = document.querySelector(`#${id} select.time-select`);
            if (select) {
                updateChartData(select.value, id);
            }
        });
    });

    // Zeitfilter für Graphen
    document.querySelectorAll('select.time-select').forEach(sel => {
        sel.addEventListener('change', () => {
            const hours = parseInt(sel.value);
            const chartId = sel.dataset.chart;
            // Chart Objekt finden
            let chartObj;
            switch(chartId) {
                case 'tempChart': chartObj = tempChart; break;
                case 'humidityChart': chartObj = humidityChart; break;
                case 'vpdChart': chartObj = vpdChart; break;
                case 'soilChart': chartObj = soilChart; break;
            }
            if (!chartObj) return;
            // Einheit aktualisieren
            chartObj.options.scales.x.time.unit = getTimeUnit(hours);
            updateChartData(hours);
        });
    });

    // Daten laden & aktualisieren der Diagramme
    async function updateChartData(hours = 24, moduleId = null) {
        const feeds = await fetchData(hours);
        const processed = processData(feeds);

        updateCharts(processed);
    }

    // Steuerung - dimmer + watt Anzeige + Licht An/Aus (nur UI Platzhalter)
    const lightSwitch = document.getElementById('lightSwitch');
    const lightDimmer = document.getElementById('lightDimmer');
    const dimmerValue = document.getElementById('dimmerValue');
    const wattGauge = document.getElementById('wattGauge');

    // Initial Watt (z.B. bei 50% Dimmer 25W, linear als Beispiel)
    function updateWattDisplay() {
        const watt = Math.round((lightDimmer.value / 100) * 50); // max 50 Watt Beispiel
        wattGauge.textContent = watt + ' W';
    }

    lightSwitch.addEventListener('change', () => {
        if (!lightSwitch.checked) {
            wattGauge.textContent = '0 W';
        } else {
            updateWattDisplay();
        }
    });

    lightDimmer.addEventListener('input', () => {
        dimmerValue.textContent = lightDimmer.value + '%';
        if (lightSwitch.checked) {
            updateWattDisplay();
        }
    });

    // Startwerte setzen
    dimmerValue.textContent = lightDimmer.value + '%';
    updateWattDisplay();

    // Wasserpumpe und Luftbefeuchter Buttons
    document.getElementById('waterPumpBtn').addEventListener('click', e => {
        e.target.classList.toggle('active');
        e.target.textContent = e.target.classList.contains('active') ? '💧 Wasserpumpe Aus' : '💧 Wasserpumpe An';
    });
    document.getElementById('humidifierBtn').addEventListener('click', e => {
        e.target.classList.toggle('active');
        e.target.textContent = e.target.classList.contains('active') ? '🌫️ Luftbefeuchter Aus' : '🌫️ Luftbefeuchter An';
    });

    // Anleitung laden aus /guides/ Ordner per Fetch
    const guideNav = document.querySelector('.guide-nav');
    const guideContent = document.getElementById('guideContent');

    // Beispielhafte Anleitungsliste - je Datei auf GitHub / lokal
    const guideFiles = [
        { name: "Erde", file: "guides/erde.html" },
        { name: "Wasser", file: "guides/wasser.html" },
        { name: "Licht", file: "guides/licht.html" }
    ];

    function loadGuideList() {
        guideNav.innerHTML = '';
        guideFiles.forEach(g => {
            const btn = document.createElement('button');
            btn.textContent = g.name;
            btn.classList.add('main-btn');
            btn.style.marginRight = '10px';
            btn.addEventListener('click', () => loadGuideContent(g.file));
            guideNav.appendChild(btn);
        });
        // Automatisch ersten laden
        if (guideFiles.length > 0) loadGuideContent(guideFiles[0].file);
    }

    async function loadGuideContent(url) {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error("Fehler beim Laden der Anleitung");
            const html = await res.text();
            guideContent.innerHTML = html;
        } catch (e) {
            guideContent.innerHTML = `<p style="color:red;">Anleitung konnte nicht geladen werden.</p>`;
            console.error(e);
        }
    }

    // Initial alles auf Klima und Temperatur
    showModule('climate');
    showSubModule('temp-module');
    updateChartData();

});

