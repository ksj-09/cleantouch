(() => {
  const api = window.cleanTouch;
  let state = { status: 'idle' };
  const containers = [...document.querySelectorAll('[data-updates]')];
  const labels = {
    idle: '업데이트 확인', checking: '새 버전 확인 중…', current: '최신 버전입니다.',
    unsupported: '자동 업데이트는 Windows 설치형에서 지원합니다.',
    error: '업데이트를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.',
    installing: '업데이트 설치를 시작합니다…',
  };
  function render(next) {
    state = next;
    for (const container of containers) {
      container.hidden = container.classList.contains('update-widget') && !['available', 'downloading', 'downloaded', 'installing'].includes(state.status);
      container.replaceChildren();
      const text = document.createElement('p');
      text.setAttribute('role', 'status');
      text.textContent = state.queued ? '캡처·분석이 끝나면 업데이트합니다.'
        : state.status === 'available' ? `새 버전 ${state.version}이 있습니다.`
        : state.status === 'downloading' ? `업데이트 다운로드 ${state.percent}%`
        : state.status === 'downloaded' ? `${state.version} 설치 준비 완료 · 설치하면 앱이 재시작됩니다.`
        : labels[state.status] || '';
      container.append(text);
      const button = (label, action) => {
        const node = document.createElement('button'); node.className = 'secondary'; node.textContent = label;
        node.onclick = async () => { node.disabled = true; try { render(await action()); } catch { render({ ...state, status: 'error' }); } };
        container.append(node);
      };
      if (['idle', 'current', 'error'].includes(state.status)) button('새 버전 확인', api.checkUpdate);
      if (state.status === 'available') button('다운로드', api.downloadUpdate);
      if (state.status === 'downloaded' && !state.queued) button(state.busy ? '사용 종료 후 설치' : '설치하고 재시작', api.installUpdate);
      if (state.queued) button('나중에 설치', api.deferUpdate);
    }
  }
  api.onUpdate(render);
  api.getUpdate().then(render).catch(() => render({ status: 'error' }));
})();
