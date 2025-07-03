document.addEventListener('DOMContentLoaded', () => {
    const CHANNEL_ID = 2999714;
    const READ_API_KEY = '95YOHGB903ET32DX';

    let tempChart, humidityChart, vpdChart;

    // VPD Berechnung (kPa)
    function calculateVPD(temp, humidity) {
        if (!temp || !humidity) return null;
        const svp = 0.61078 * Math.exp((17.27 * temp) / (temp + 237.3));
        const vp = svp * (humidity / 100);
        return (svp - vp).toFixed(2);
    }

    // Farben je nach Modus
    const getChartColors = () => {
        return {
            textColor: getComputedStyle(document.documentElement).getPropertyValue('--text-color'),
            gridColor: window.matchMedia('(prefers-color-scheme: dark)').matches ?
                'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            tempColor: '#2f6b3e',
            humidityColor: '#3e8c4d',
            vpdColor: '#4caf50'
        };
    };

    function getChartConfig(label, unit, color, colors) {
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
                            unit: 'hour',
                            stepSize: 1 // Weniger Markierungen für 1h Ansicht
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

    const colors = getChartColors();

    tempChart = new Chart(ctxTemp, getChartConfig('Temperatur', '°C', colors.tempColor, colors));
    humidityChart = new Chart(ctxHumidity, getChartConfig('Luftfeuchtigkeit', '%', colors.humidityColor, colors));
    vpdChart = new Chart(ctxVpd, getChartConfig('VPD', 'kPa', colors.vpdColor, colors));

    // Aktuelles VPD anzeigen
    const currentVpdElem = document.getElementById('currentVpd');

    // Daten von ThingSpeak laden
    async function fetchData(hours) {
        // Hole UNIX Zeit (jetzt) minus Stunden in Sekunden
        const endTime = Math.floor(Date.now() / 1000);
        const startTime = endTime - hours * 3600;

        // ThingSpeak JSON Feed URL mit Zeitfilter (timesince)
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

    // Daten aufbereiten
    function processData(feeds) {
        const tempData = [];
        const humidityData = [];
        const vpdData = [];

        feeds.forEach(f => {
            if (f.created_at) {
                const time = new Date(f.created_at);

                const temp = parseFloat(f.field1);
                const humidity = parseFloat(f.field2);
                const vpd = calculateVPD(temp, humidity);

                if (!isNaN(temp)) tempData.push({ x: time, y: temp });
                if (!isNaN(humidity)) humidityData.push({ x: time, y: humidity });
                if (vpd !== null) vpdData.push({ x: time, y: parseFloat(vpd) });
            }
        });

        return { tempData, humidityData, vpdData };
    }

    // Charts aktualisieren
    function updateCharts(data) {
        tempChart.data.datasets[0].data = data.tempData;
        humidityChart.data.datasets[0].data = data.humidityData;
        vpdChart.data.datasets[0].data = data.vpdData;

        tempChart.update();
        humidityChart.update();
        vpdChart.update();

        // Aktueller VPD Wert (letzter Wert)
        if (data.vpdData.length > 0) {
            const lastVpd = data.vpdData[data.vpdData.length - 1].y;
            currentVpdElem.textContent = `Aktueller VPD: ${lastVpd.toFixed(2)} kPa`;
        }
    }

    // Modul- und Untermodul-Steuerung
    const mainBtns = document.querySelectorAll('.main-btn');
    const modules = document.querySelectorAll('.module');
    const navBtns = document.querySelectorAll('.nav-btn');
    const subModules = document.querySelectorAll('.sub-module');
    const guideBtns = document.querySelectorAll('.guide-btn');
    const guideSections = document.querySelectorAll('.guide-section');

    function activateModule(id) {
        modules.forEach(m => m.classList.remove('active'));
        const module = document.getElementById(id);
        if (module) module.classList.add('active');
    }

    function activateSubModule(id) {
        subModules.forEach(s => s.classList.remove('active'));
        const subModule = document.getElementById(id);
        if (subModule) subModule.classList.add('active');
    }

    function activateGuide(id) {
        guideSections.forEach(s => s.classList.remove('active'));
        const section = document.getElementById(id);
        if (section) section.classList.add('active');
    }

    mainBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            activateModule(btn.dataset.main);

            // Wenn Klima, dann Temp Modul als Standard aktivieren
            if (btn.dataset.main === 'climate') {
                activateSubModule('temp-module');
            }
        });
    });

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const modId = btn.dataset.module + '-module';
            activateSubModule(modId);
        });
    });

    guideBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            activateGuide(btn.dataset.guide);
        });
    });

    // Info Dropdown auf/zu
    document.querySelectorAll('.info-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.classList.toggle('active');
            const content = btn.nextElementSibling;
            if (content.style.display === 'block') {
                content.style.display = 'none';
            } else {
                content.style.display = 'block';
            }
        });
    });

    // Zeit-Select bei jedem Chart
    document.querySelectorAll('.time-select').forEach(select => {
        select.addEventListener('change', async (e) => {
            const hours = parseInt(e.target.value);
            const data = await fetchData(hours);
            const processed = processData(data);
            updateCharts(processed);
        });
    });

    // Starte mit Klima und Temperatur aktiv
    activateModule('climate');
    activateSubModule('temp-module');

    // Initiale Daten laden für 24 Stunden
    (async () => {
        const data = await fetchData(24);
        const processed = processData(data);
        updateCharts(processed);
    })();
});
