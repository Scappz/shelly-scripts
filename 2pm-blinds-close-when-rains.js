// Closes the blinds when it's going to rain within the next hour, using Open-Meteo

// EDIT latitude, longitude and timezone to your needs
var OPEN_METEO_URL =
  "https://api.open-meteo.com/v1/forecast" +
  "?latitude=39.458367" +
  "&longitude=-0.400232" +
  "&hourly=precipitation_probability,precipitation" +
  "&timezone=Europe%2FBerlin" +
  "&forecast_days=1";
  
// Config
var PRECIP_THRESHOLD_MM = 0.2;
var PROB_THRESHOLD_PCT = 50;
var DONT_CLOSE_IF_LOWER = 40;
var CLOSE_POSITION = 20;

// Formatea número a 2 dígitos (ej: 3 -> "03")
function twoDigits(n) {
  return (n < 10 ? "0" : "") + n;
}

function checkRainNextHour() {
  var now = new Date();

  // Próxima hora
  var next = new Date(now.getTime() + 60 * 60 * 1000);

  var y = next.getFullYear();
  var m = twoDigits(next.getMonth() + 1);
  var d = twoDigits(next.getDate());
  var h = twoDigits(next.getHours());

  var targetPrefix = y + "-" + m + "-" + d + "T" + h + ":"; // "2025-12-01T13:"

  Shelly.call(
    "HTTP.GET",
    { url: OPEN_METEO_URL },
    function (res, error_code, error_message) {
      // Manejo de errores HTTP del Shelly
      if (typeof error_code === "number" && error_code !== 0) {
        print("HTTP error:", error_code, error_message);
        return;
      }

      if (!res || res.code !== 200) {
        print("Error en llamada Open-Meteo, code:", res ? res.code : "sin respuesta");
        return;
      }

      var data;
      try {
        data = JSON.parse(res.body);
      } catch (e) {
        print("Error parseando JSON:", e.message);
        return;
      }

      if (!data.hourly ||
          !data.hourly.time ||
          !data.hourly.precipitation_probability ||
          !data.hourly.precipitation) {
        print("Formato inesperado de respuesta Open-Meteo");
        return;
      }

      var times = data.hourly.time;
      var probs = data.hourly.precipitation_probability;
      var precs = data.hourly.precipitation;

      if (times.length === 0) {
        print("Respuesta sin datos horarios");
        return;
      }

      // Buscar índice de la próxima hora en el array time
      var idx = -1;
      var i;
      for (i = 0; i < times.length; i++) {
        // Ejemplo de time: "2025-12-01T13:00"
        if (times[i].indexOf(targetPrefix) === 0) {
          idx = i;
          break;
        }
      }

      // Si no se encuentra exactamente, hacemos fallback al primer elemento
      if (idx === -1) {
        idx = 0;
        print("No se encontró la próxima hora exacta, usando índice 0 como fallback");
      }

      var timeStr = times[idx];
      var prob = probs[idx];
      var prec = precs[idx];

      // Siempre imprimimos la predicción de la próxima hora
      print(
        "Próxima hora:",
        timeStr,
        "- Probabilidad:",
        prob,
        "% - Precipitación:",
        prec,
        "mm"
      );

      // Condición de "Va a llover"
      if (prec > PRECIP_THRESHOLD_MM && prob > PROB_THRESHOLD_PCT) {
        print("Va a llover");
        
        const status = Shelly.getComponentStatus("cover:0");
        if (status.current_pos > DONT_CLOSE_IF_LOWER) {
          Shelly.call("Cover.GoToPosition", {'id': 0, 'pos': CLOSE_POSITION});
        }
      }
    }
  );
}

// Ejecutar ahora
checkRainNextHour();

// Ejecutar una vez por hora (3600000 ms)
Timer.set(3600000 /* ms */, true /* repetir */, function () {
  checkRainNextHour();
});
