let cropData = null; // Declare cropData in the global scope

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "arenaSnip",
        title: "Are.na Snip",
        contexts: ['all']
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'arenaSnip') {
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["js/snip.js"]
        });
    }
});

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.message === 'startCrop') {
        (async () => {
            const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 100 });
            cropData = { imgSrc: dataUrl, rect: req.rect, scale: req.scale };
            await chrome.action.openPopup();
        })();
        return true; 
    }
    if (req.message === 'getCropData') {
        sendResponse(cropData);
        cropData = null;
    }
});