document.addEventListener('DOMContentLoaded', () => {
    const CHANNEL_ID = 2999714;
    const READ_API_KEY = '95YOHGB903ET32DX';
    let tempChart, humidityChart, vpdChart;

    function calculateVPD(temp, humidity) {
        if (!temp || !humidity) return null;
        const svp = 0.61078 * Math.exp((17.27 * temp) / (temp + 237.3));
        const vp = svp * (humidity / 100);
        return (svp - vp).toFixed(2);
    }

    const getChartColors = () => {
        return {
            textColor: getComputedStyle(document.documentElement).getPropertyValue('--text-color'),
            gridColor: window.matchMedia('(prefers-color-scheme: dark)').matches ? 
                      'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            tempColor: '#FF6384',
            humidityColor: '#36A2EB',
            vpdColor: '#9C27B0'
        };
    };

    function initCharts() {
        const colors = getChartColors();
        tempChart = new Chart(
            document.getElementById('tempChart').getContext('2d'),
            getChartConfig('Temperatur', '°C', colors.tempColor, colors)
        );
        humidityChart = new Chart(
            document.getElementById('humidityChart').getContext('2d'),
            getChartConfig('Luftfeuchtigkeit', '%', colors.humidityColor, colors)
        );
        vpdChart = new Chart(
            document.getElementById('vpdChart').getContext('2d'),
            getChartConfig('VPD', 'kPa', colors.vpdColor, colors)
        );
    }

    function getChartConfig(label, unit, color, colors) {
        return {
            type: 'line',
            data: {
                datasets: [{
                    label: label,
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
                            unit: 'minute',
                            displayFormats: {
                                minute: 'HH:mm',
                                hour: 'HH:mm'
                            }
                        },
                        ticks: {
                            maxTicksLimit: 6,
                            color: colors.textColor
                        },
                        grid: { color: colors.gridColor }
                    },
                    y: {
                        title: {
                            display: true,
                            text: unit,
                            color: colors.textColor
                        },
                        ticks: { color: colors.textColor },
                        grid: { color: colors.gridColor }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: { mode: 'index', intersect: false }
                }
            }
        };
    }

    async function loadData(chart, hours) {
        try {
            const response = await fetch(
                `https://api.thingspeak.com/channels/${CHANNEL_ID}/feeds.json?api_key=${READ_API_KEY}&results=${hours * 6}`
            );
            const data = await response.json();
            const feeds = data.feeds.map(f => ({
                x: f.created_at,
                temp: parseFloat(f.field1),
                humidity: parseFloat(f.field2),
                vpd: calculateVPD(parseFloat(f.field1), parseFloat(f.field2))
            })).filter(f => !isNaN(f.temp) && !isNaN(f.humidity));

            if (chart === tempChart) {
                chart.data.datasets[0].data = feeds.map(f => ({ x: f.x, y: f.temp }));
            } else if (chart === humidityChart) {
                chart.data.datasets[0].data = feeds.map(f => ({ x: f.x, y: f.humidity }));
            } else if (chart === vpdChart) {
                chart.data.datasets[0].data = feeds.map(f => ({ x: f.x, y: f.vpd }));
                if (feeds.length > 0) {
                    const lastVpd = feeds[feeds.length - 1].vpd;
                    const vpdElement = document.getElementById('currentVpd');
                    vpdElement.textContent = `Aktueller VPD: ${lastVpd} kPa`;
                    if (lastVpd < 0.8) {
                        vpdElement.style.background = 'var(--vpd-low)';
                    } else if (lastVpd > 1.2) {
                        vpdElement.style.background = 'var(--vpd-high)';
                    } else {
                        vpdElement.style.background = 'var(--vpd-optimal)';
                    }
                }
            }
            chart.update();
        } catch (error) {
            console.error("Fehler beim Laden der Daten:", error);
        }
    }

    document.querySelectorAll('.main-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
            document.getElementById(this.dataset.main).classList.add('active');
        });
    });

    document.querySelectorAll('.guide-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.guide-section').forEach(s => s.classList.remove('active'));
            document.getElementById(this.dataset.guide).classList.add('active');
        });
    });

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.sub-module').forEach(m => m.classList.remove('active'));
            const moduleId = this.dataset.module;
            document.getElementById(`${moduleId}-module`).classList.add('active');
            loadData(
                moduleId === 'temp' ? tempChart : moduleId === 'humidity' ? humidityChart : vpdChart,
                parseInt(document.querySelector(`#${moduleId}-module .time-select`).value)
            );
        });
    });

    document.querySelectorAll('.time-select').forEach(select => {
        select.addEventListener('change', function () {
            const hours = parseInt(this.value);
            const chartId = this.closest('.card').querySelector('canvas').id;
            switch (chartId) {
                case 'tempChart':
                    loadData(tempChart, hours);
                    break;
                case 'humidityChart':
                    loadData(humidityChart, hours);
                    break;
                case 'vpdChart':
                    loadData(vpdChart, hours);
                    break;
            }
        });
    });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        const colors = getChartColors();
        [tempChart, humidityChart, vpdChart].forEach(chart => {
            chart.options.scales.x.ticks.color = colors.textColor;
            chart.options.scales.y.ticks.color = colors.textColor;
            chart.options.scales.y.title.color = colors.textColor;
            chart.options.scales.x.grid.color = colors.gridColor;
            chart.options.scales.y.grid.color = colors.gridColor;
            chart.update();
        });
    });

    initCharts();
    document.querySelector('.nav-btn[data-module="temp"]').click();
});
