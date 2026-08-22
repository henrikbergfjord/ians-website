(() => {
  const q = s => document.querySelector(s);

  function isoWeek(date){
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  function weatherText(code, lang){
    const en = lang === 'en';
    if(code === 0) return en ? 'Clear sky' : 'Klart';
    if([1,2].includes(code)) return en ? 'Partly cloudy' : 'Delvis skyet';
    if(code === 3) return en ? 'Cloudy' : 'Skyet';
    if([45,48].includes(code)) return en ? 'Fog' : 'Tåke';
    if([51,53,55,56,57].includes(code)) return en ? 'Drizzle' : 'Yr';
    if([61,63,65,66,67,80,81,82].includes(code)) return en ? 'Rain' : 'Regn';
    if([71,73,75,77,85,86].includes(code)) return en ? 'Snow' : 'Snø';
    if([95,96,99].includes(code)) return en ? 'Thunder' : 'Torden';
    return en ? 'Weather' : 'Vær';
  }

  function weatherIcon(code){
    if(code === 0) return '☀️';
    if([1,2].includes(code)) return '🌤️';
    if(code === 3) return '☁️';
    if([45,48].includes(code)) return '🌫️';
    if([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code)) return '🌧️';
    if([71,73,75,77,85,86].includes(code)) return '❄️';
    if([95,96,99].includes(code)) return '⛈️';
    return '🌡️';
  }

  function updateClock(){
    const now = new Date();
    const lang = window.MoneyI18n?.lang() === 'en' ? 'en' : 'no';
    const locale = lang === 'en' ? 'en-GB' : 'nb-NO';
    const dateText = new Intl.DateTimeFormat(locale,{weekday:'long',day:'2-digit',month:'short',year:'numeric'}).format(now);
    const timeText = new Intl.DateTimeFormat(locale,{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(now);
    if(q('#topDate')) q('#topDate').textContent = dateText;
    if(q('#topTime')) q('#topTime').textContent = timeText;
    if(q('#topWeek')) q('#topWeek').textContent = (lang === 'en' ? 'Week ' : 'Uke ') + isoWeek(now);
  }

  function setWeatherLoading(){
    const lang = window.MoneyI18n?.lang() === 'en' ? 'en' : 'no';
    if(q('#topWeatherText')) q('#topWeatherText').textContent = lang === 'en' ? 'Enable weather' : 'Aktiver vær';
    if(q('#topWeatherTemp')) q('#topWeatherTemp').textContent = '—';
    if(q('#topWeatherIcon')) q('#topWeatherIcon').textContent = '🌤️';
  }

  async function fetchWeather(lat, lon){
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current=temperature_2m,weather_code&timezone=auto`;
    const r = await fetch(url);
    if(!r.ok) throw new Error('Weather request failed');
    const d = await r.json();
    const temp = Math.round(d.current?.temperature_2m ?? 0);
    const code = Number(d.current?.weather_code ?? -1);
    const lang = window.MoneyI18n?.lang() === 'en' ? 'en' : 'no';
    if(q('#topWeatherTemp')) q('#topWeatherTemp').textContent = `${temp}°C`;
    if(q('#topWeatherText')) q('#topWeatherText').textContent = weatherText(code, lang);
    if(q('#topWeatherIcon')) q('#topWeatherIcon').textContent = weatherIcon(code);
  }

  function requestWeather(){
    if(!navigator.geolocation){
      setWeatherLoading(); return;
    }
    const lang = window.MoneyI18n?.lang() === 'en' ? 'en' : 'no';
    if(q('#topWeatherText')) q('#topWeatherText').textContent = lang === 'en' ? 'Finding location…' : 'Finner posisjon…';
    navigator.geolocation.getCurrentPosition(
      p => fetchWeather(p.coords.latitude,p.coords.longitude).catch(setWeatherLoading),
      setWeatherLoading,
      {enableHighAccuracy:false,timeout:8000,maximumAge:900000}
    );
  }

  window.addEventListener('DOMContentLoaded',()=>{
    updateClock();
    setInterval(updateClock,1000);
    q('#weatherWidget')?.addEventListener('click',requestWeather);
    setWeatherLoading();
  });

  window.addEventListener('moneyplanner:language',()=>{
    updateClock();
    const hasTemp = q('#topWeatherTemp')?.textContent && q('#topWeatherTemp').textContent !== '—';
    if(!hasTemp) setWeatherLoading();
  });
})();