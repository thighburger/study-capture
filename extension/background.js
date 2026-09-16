// Use an explicit action invocation so opening the panel also grants activeTab.
// Do not await other work before open(): it must retain the user gesture.
chrome.action.onClicked.addListener(tab => {
  chrome.sidePanel.open({windowId: tab.windowId}).catch(console.error);
});
chrome.sidePanel.setPanelBehavior({openPanelOnActionClick: false}).catch(console.error);
