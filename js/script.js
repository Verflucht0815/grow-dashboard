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

    // Dynamische Einheit für x-Achse abhängig von Stunden
    function getTimeUnit(hours) {
        if (hours <= 1) return 'minute';
        if (hours <= 6) return 'hour';
        if (hours <= 168) return 'day';
        return 'week';
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

    function getChartConfig(label, unit, color, colors, timeUnit) {
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

    const colors = getChartColors();

    tempChart = new Chart(ctxTemp, getChartConfig('Temperatur', '°C', colors.tempColor, colors, 'hour'));
    humidityChart = new Chart(ctxHumidity, getChartConfig('Luftfeuchtigkeit', '%', colors.humidityColor, colors, 'hour'));
    vpdChart = new Chart(ctxVpd, getChartConfig('VPD', 'kPa', colors.vpdColor, colors, 'hour'));

    const currentVpdElem = document.getElementById('currentVpd');

    // Daten von ThingSpeak laden
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

    function updateCharts(data) {
        tempChart.data.datasets[0].data = data.tempData;
        humidityChart.data.datasets[0].data = data.humidityData;
        vpdChart.data.datasets[0].data = data.vpdData;

        tempChart.update();
        humidityChart.update();
        vpdChart.update();

        if (data.vpdData.length > 0) {
            const lastVpd = data.vpdData[data.vpdData.length - 1].y;
            currentVpdElem.textContent = `Aktueller VPD: ${lastVpd.toFixed(2)} kPa`;
        }
    }

    // Module / Submodule / Guide Steuerung
    const mainBtns = document.querySelectorAll('.main-btn[data-main]');
    const modules = document.querySelectorAll('.module');
    const navBtns = document.querySelectorAll('.nav-btn');
    const subModules = document.querySelectorAll('.sub-module');
    const guideContentDiv = document.getElementById('guideContent');
   
