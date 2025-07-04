// js/chart-handler.js

async function fetchThingSpeakData(channelId, apiKey, field, results = 60) {
  const url = `https://api.thingspeak.com/channels/${channelId}/fields/${field}.json?api_key=${apiKey}&results=${results}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data.feeds.map(feed => ({
      x: new Date(feed.created_at),
      y: parseFloat(feed[`field${field}`])
    })).filter(p => !isNaN(p.y));
  } catch (error) {
    console.error('Error fetching ThingSpeak data:', error);
    return [];
  }
}

function renderGraph(canvasId, label, data, borderColor = 'rgb(75, 192, 192)') {
  const ctx = document.getElementById(canvasId).getContext('2d');
  new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [{
        label: label,
        data: data,
        fill: false,
        borderColor: borderColor,
        tension: 0.1
      }]
    },
    options: {
      responsive: true,
      scales: {
        x: {
          type: 'time',
          time: {
            unit: 'hour',
            tooltipFormat: 'MMM D, HH:mm'
          },
          ticks: {
            maxTicksLimit: 8
          }
        },
        y: {
          beginAtZero: true
        }
      },
      plugins: {
        legend: {
          display: true,
          position: 'top'
        }
      }
    }
  });
}

// Example usage
(async () => {
  const temperatureData = await fetchThingSpeakData(2999714, '95YOHGB903ET32DX', 1);
  const humidityData = await fetchThingSpeakData(2999714, '95YOHGB903ET32DX', 2);
  const soilMoistureData = await fetchThingSpeakData(2999714, '95YOHGB903ET32DX', 3);

  renderGraph('temperatureChart', 'Temperatur (°C)', temperatureData, 'rgba(255, 99, 132, 1)');
  renderGraph('humidityChart', 'Luftfeuchtigkeit (%)', humidityData, 'rgba(54, 162, 235, 1)');
  renderGraph('soilChart', 'Bodenfeuchtigkeit (%)', soilMoistureData, 'rgba(75, 192, 192, 1)');
})();
