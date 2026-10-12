(function (root) {
  function parseScreenText(text) {
    const pair = String(text).match(/\b(\d{1,2}:\d{2}(?::\d{2})?)\s*\/\s*(\d{1,2}:\d{2}(?::\d{2})?)\b/);
    const seconds = value => value.split(':').reduce((total, part) => total * 60 + Number(part), 0);
    let position = null;
    if (pair && pair[1].split(':').slice(1).every(part => Number(part) < 60) && pair[2].split(':').slice(1).every(part => Number(part) < 60) && seconds(pair[1]) <= seconds(pair[2])) position = seconds(pair[1]);
    const seek = String(text).match(/(?:rewind|backward|뒤로|되감기)\s*(\d{1,3})\s*(?:seconds?|sec|초|s)(?=$|\s|[.,])/i);
    const handle = String(text).match(/@[\w.\-]{3,}/);
    const caption = handle ? String(text).slice(handle.index + handle[0].length).split('\n').slice(0, 3).find(line => /#[\w가-힣]{2,}/.test(line))?.trim().slice(0, 100) || '' : '';
    const paused = /(?:^|\n)\s*(?:paused|일시정지됨|재생 중지)\s*(?:$|\n)/im.test(text) ? true
      : /(?:^|\n)\s*(?:playing|재생 중)\s*(?:$|\n)/im.test(text) ? false : null;
    return { position, seekDelta: seek ? -Number(seek[1]) : null, seekToken: seek?.[0] || '', paused, identity: handle ? handle[0] + (caption ? ':' + caption : '') : '', text: String(text) };
  }
  class WatchTimeline {
    constructor() { this.reset(); }
    reset() { this.position = 0; this.lastAt = null; this.lastAnchor = null; this.reportedPosition=null; this.lastAuthority = -Infinity; this.paused = false; this.estimated = true; this.number = 1; this.key = 'watch-1'; this.title = ''; this.identified = false; this.pendingKey = ''; this.pendingCount = 0; this.seekSignal = ''; this.history = new Map(); }
    advance(at) { if (this.lastAt !== null && !this.paused) this.position += Math.min(2, Math.max(0, (at - this.lastAt) / 1000)); this.lastAt = at; if (!this.paused && this.lastAnchor !== null && at - this.lastAnchor > 1500) this.estimated = true; }
    observe(signal = {}, at = performance.now()) {
      this.advance(at);
      if (signal.authoritative) this.lastAuthority = at;
      if (!signal.authoritative && at - this.lastAuthority < 2500) signal = {};
      if (signal.identity && signal.identity !== this.key) {
        if (!this.identified) { this.key = signal.identity; this.identified = true; this.position = 0; }
        else {
          if (this.pendingKey === signal.identity) this.pendingCount++; else { this.pendingKey = signal.identity; this.pendingCount = 1; }
          if (signal.authoritative || this.pendingCount >= 3) {
            this.history.set(this.key, this.position); this.key = signal.identity; this.number++;
            this.position = this.history.get(this.key) || 0; this.paused = false; this.estimated = true;this.reportedPosition=null;this.lastAnchor=null;
            this.pendingCount = 0; this.pendingKey = '';
          }
        }
      } else if (signal.identity === this.key) { this.pendingKey = ''; this.pendingCount = 0; }
      if (signal.title) this.title = signal.title;
      if (typeof signal.paused === 'boolean') this.paused = signal.paused;
      if (Number.isFinite(signal.position) && signal.position >= 0) {
        // Repeated stale OS positions must not pin a visibly playing video.
        // Estimated seek-bar/OCR times are coarsely quantized; ignore small
        // corrections while playing so the displayed clock advances smoothly.
        const correction=signal.position-this.position;
        const noisyEstimate=Boolean(signal.estimated&&!this.paused&&this.lastAt!==null&&Math.abs(correction)<1.25);
        if(!noisyEstimate&&(this.paused||this.reportedPosition!==signal.position)){this.position = signal.position; this.estimated = Boolean(signal.estimated); this.lastAnchor = at;}
        this.reportedPosition=signal.position;
      }
      else if (Number.isFinite(signal.seekDelta) && signal.seekDelta !== 0 && this.seekSignal !== signal.seekToken) {
        this.position = Math.max(0, this.position + signal.seekDelta); this.estimated = true;
      }
      if ('seekDelta' in signal) this.seekSignal = Number.isFinite(signal.seekDelta) ? signal.seekToken : '';
      return this.snapshot();
    }
    snapshot() { return { available: true, seconds: this.position, videoKey: this.key, title: this.title || `영상 ${this.number}`, estimated: this.estimated, paused: this.paused }; }
  }
  const api = { WatchTimeline, parseScreenText };
  if (typeof module !== 'undefined') module.exports = api; else root.watchTime = api;
})(globalThis);
