(function (root) {
  function identityKey(label) {
    let text = String(label).normalize('NFKC').toLowerCase()
      .replace(/라이트\s*세이버|lightsaber/g, '광선검')
      .replace(/퍼플|보라색/g, '보라').replace(/레드|빨간색|빨간|빨강색/g, '빨강')
      .replace(/블루|파란색|파란/g, '파랑').replace(/그린|초록색|녹색|초록빛/g, '초록')
      .replace(/화이트|흰색|하얀색/g, '하양').replace(/블랙|검정색/g, '검정')
      .replace(/옐로우|노란색|노란/g,'노랑').replace(/핑크|분홍색/g,'분홍').replace(/오렌지|주황색/g,'주황');
    // These words do not distinguish the same lightsaber seen again in another shot.
    if (text.includes('광선검')) text = text.replace(/\bled\b|장난감|완구|플라스틱|발광|빛나는/g, ' ');
    return text.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean).sort().join(' ');
  }
  function shoppingMatches(matches, label) {
    return matches.map(match => {
      let url;
      try { url = new URL(match.url); } catch { return match; }
      if ((url.hostname === 'www.google.com' || url.hostname === 'google.com') && url.pathname === '/search') {
        url.searchParams.set('q', label);
      } else if (url.hostname === 'search.shopping.naver.com' && url.pathname === '/search/all') {
        url.searchParams.set('query', label);
      } else return match;
      return { ...match, url: url.href, title: `${label} 검색`, matchKind: 'search_link' };
    });
  }
  const api = { identityKey, shoppingMatches };
  if (typeof module !== 'undefined') module.exports = api;
  else root.productIdentity = api;
})(globalThis);
