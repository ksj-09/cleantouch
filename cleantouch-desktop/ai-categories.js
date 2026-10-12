(function (root) {
  const categories = [
    ['handbag', '가방', 'a handbag or shoulder bag'], ['backpack', '백팩', 'a backpack'],
    ['suitcase', '여행 가방', 'a travel suitcase'], ['tie', '넥타이', 'a necktie'],
    ['shirt', '셔츠', 'a shirt'], ['tshirt', '티셔츠', 'a t-shirt'], ['jacket', '재킷', 'a jacket'],
    ['coat', '코트', 'a coat'], ['hoodie', '후드티', 'a hoodie'], ['sweater', '니트', 'a sweater'],
    ['pants', '바지', 'a pair of pants'], ['jeans', '청바지', 'a pair of jeans'],
    ['shorts', '반바지', 'a pair of shorts'], ['skirt', '치마', 'a skirt'], ['dress', '원피스', 'a dress'],
    ['sneakers', '운동화', 'a pair of sneakers'], ['boots', '부츠', 'boots'], ['sandals', '샌들', 'sandals'],
    ['hat', '모자', 'a hat'], ['glasses', '안경', 'eyeglasses'], ['watch', '손목시계', 'a wristwatch'],
    ['purple-lightsaber', '보라색 광선검', 'a purple toy lightsaber'],
    ['red-lightsaber', '빨간색 광선검', 'a red toy lightsaber'],
    ['blue-lightsaber', '파란색 광선검', 'a blue toy lightsaber'],
    ['green-lightsaber', '초록색 광선검', 'a green toy lightsaber'],
    ['lightsaber', '광선검', 'a toy lightsaber'], ['toy-sword', '장난감 검', 'a toy sword'],
    ['led-sign', 'LED 조명판', 'an LED light sign or light panel'], ['lamp', '조명', 'a lamp'],
    ['umbrella', '우산', 'an umbrella'], ['bottle', '병', 'a bottle'], ['cup', '컵', 'a cup'],
    ['wine-glass', '와인잔', 'a wine glass'], ['bowl', '그릇', 'a bowl'], ['chair', '의자', 'a chair'],
    ['sofa', '소파', 'a sofa'], ['bed', '침대', 'a bed'], ['table', '테이블', 'a table'],
    ['tv', 'TV', 'a television'], ['laptop', '노트북', 'a laptop'], ['mouse', '마우스', 'a computer mouse'],
    ['remote', '리모컨', 'a remote control'], ['keyboard', '키보드', 'a keyboard'],
    ['phone', '휴대폰', 'a cell phone'], ['book', '책', 'a book'], ['clock', '시계', 'a clock'],
    ['vase', '꽃병', 'a vase'], ['scissors', '가위', 'scissors'], ['teddy', '인형', 'a teddy bear or stuffed toy'],
    ['ball', '공', 'a sports ball'], ['bat', '야구 방망이', 'a baseball bat'],
    ['racket', '테니스 라켓', 'a tennis racket'], ['skateboard', '스케이트보드', 'a skateboard'],
    ['surfboard', '서핑보드', 'a surfboard'], ['bicycle', '자전거', 'a bicycle'],
    ['motorcycle', '오토바이', 'a motorcycle'], ['car', '자동차', 'a car'], ['knife', '칼', 'a kitchen knife'],
    ['fork', '포크', 'a fork'], ['spoon', '숟가락', 'a spoon'], ['plant', '화분', 'a potted plant'],
    ['toothbrush', '칫솔', 'a toothbrush'], ['dryer', '헤어드라이어', 'a hair dryer'],
    ['background', '상품 후보', 'a person, body part, wall, background, or an unrecognizable object'],
    ['background', '배경', 'text, subtitles, a logo, or letters on a screen'],
    ['background', '배경', 'a bright wall, window frame, door edge, or reflection'],
    ['background', '배경', 'a blurry small crop without an identifiable product'],
    ['background', '배경', 'a close-up of a face, skin, hand, arm, or leg'],
  ];
  function cosine(a, b) {
    if (!a || !b || a.length !== b.length || !a.length) return -1;
    let dot = 0, aa = 0, bb = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; aa += a[i] ** 2; bb += b[i] ** 2; }
    return dot / Math.sqrt(aa * bb || 1);
  }
  function selectLabel(scores) {
    const ranked = scores.map((score, index) => ({ score, category: categories[index] })).filter(item => Number.isFinite(item.score)).sort((a, b) => b.score - a.score);
    const products = ranked.filter(item => item.category[0] !== 'background');
    const best = products[0], background = ranked.find(item => item.category[0] === 'background');
    // CLIP similarities are not probabilities. Close related names should keep
    // their useful noun rather than all being replaced with "product candidate".
    const recognizable = best && best.score >= .18 && (!background || best.score-background.score>.005);
    if (!recognizable) return { label: '종류 미확인', category: 'unknown', uncertain: true, alternatives: [] };
    const family = id => id.includes('lightsaber') ? 'lightsaber' : ['pants', 'jeans'].includes(id) ? 'pants' : ['handbag', 'backpack'].includes(id) ? 'bag' : id;
    const rival = products.find(item => family(item.category[0]) !== family(best.category[0]));
    const certain = best.score >= .22 && (!rival || best.score - rival.score >= .02) && (!background || best.score-background.score>=.015);
    let [category, label] = best.category;
    if (category.includes('lightsaber')) {
      const otherColor = products.find(item => item.category[0] !== category && item.category[0].includes('-lightsaber'));
      if (!category.includes('-') || (otherColor && best.score - otherColor.score < .012)) { category = 'lightsaber'; label = '광선검'; }
    }
    return { label, category, uncertain: !certain, alternatives: products.slice(0, 3).map(item => item.category[1]) };
  }
  const api = { categories, cosine, selectLabel };
  if (typeof module !== 'undefined') module.exports = api; else root.productAI = api;
})(globalThis);
