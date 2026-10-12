(() => {
  let identity = '';
  let instance = '';
  function snapshot() {
    if (document.visibilityState !== 'visible') return;
    const videos = [...document.querySelectorAll('video')].map(video => {
      const rect = video.getBoundingClientRect();
      const style = getComputedStyle(video);
      const area = Math.max(0, Math.min(rect.right, innerWidth) - Math.max(0, rect.left)) * Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(0, rect.top));
      return { video, area: style.display === 'none' || style.visibility === 'hidden' ? 0 : area };
    }).filter(item => item.area > 100 && item.video.readyState >= 2 && Number.isFinite(item.video.currentTime));
    videos.sort((a, b) => Number(a.video.paused) - Number(b.video.paused) || b.area - a.area);
    const video = videos[0]?.video;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
    const ad = document.querySelector('.ad-showing, .ad-interrupting');
    if (ad) { chrome.runtime.sendMessage({ type: 'video-unavailable', reason: 'advertisement' }).catch(() => {}); return; }
    const nextIdentity = `${location.href}|${video.currentSrc}`;
    if (identity !== nextIdentity) { identity = nextIdentity; instance = crypto.randomUUID(); }
    chrome.runtime.sendMessage({ type: 'video-time', seconds: video.currentTime, duration: video.duration,
      paused: video.paused, playbackRate: video.playbackRate, title: document.title.slice(0, 250),
      url: location.href, instance, focused: document.hasFocus(), measuredAt: Date.now(),
    }).catch(() => {});
  }
  setInterval(snapshot, 300);
  for (const event of ['timeupdate', 'seeked', 'pause', 'play', 'loadedmetadata']) document.addEventListener(event, snapshot, true);
  snapshot();
})();
