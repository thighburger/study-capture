export async function connectActiveTab(api) {
  const [tab] = await api.tabs.query({active: true, currentWindow: true});
  if (!tab || !Number.isInteger(tab.id)) {
    throw Error('현재 탭을 찾을 수 없습니다. 자료가 있는 탭을 선택한 뒤 다시 시도하세요.');
  }
  // Without activeTab permission Chrome omits url. Missing metadata is not
  // evidence that this is a chrome:// page: let executeScript check access.
  if (tab.url) {
    const url = new URL(tab.url);
    if (!['http:', 'https:'].includes(url.protocol) ||
        url.hostname === 'chromewebstore.google.com' ||
        (url.hostname === 'chrome.google.com' && url.pathname.startsWith('/webstore'))) {
      throw Error('이 페이지에서는 캡처 영역을 지정할 수 없습니다. Chrome 설정·새 탭·웹스토어 대신 자료가 있는 일반 웹페이지를 열어주세요.');
    }
  }
  try {
    await api.scripting.executeScript({target: {tabId: tab.id}, files: ['content.js']});
  } catch (error) {
    const detail = error?.message || String(error);
    if (/cannot access|permission|not allowed|extensions gallery/i.test(detail)) {
      throw Error('현재 탭에 접근 권한이 없습니다. 자료 탭을 선택하고, 크롬 오른쪽 위 퍼즐 아이콘 → 모아를 직접 누른 뒤 다시 영역을 지정하세요. 사이드 패널 안의 버튼만으로는 탭 권한이 부여되지 않습니다.');
    }
    throw Error('웹페이지 연결에 실패했습니다: ' + detail);
  }
  return tab;
}
