if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(r => r.update())
      .catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!sessionStorage.getItem('sw-r')) { sessionStorage.setItem('sw-r','1'); location.reload(); }
    });
  });