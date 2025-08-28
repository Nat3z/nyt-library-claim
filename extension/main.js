async function getCookies() {
  const cookies = await chrome.cookies.get({"url": "https://www.nytimes.com", "name": "NYT-S"});
  return { name: cookies.name, value: cookies.value };
}

// receive message from message.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'send-claim') {
    const { claimURL, claimPassword } = message.data;
    chrome.storage.sync.set({ claimURL, claimPassword });
    console.log('Claim URL and password sent to storage:', { claimURL, claimPassword });
    main().then((success) => {
      sendResponse({ success });
    });
  }
  else if (message.type === 'get-claim') {
    chrome.storage.sync.get(['claimURL', 'claimPassword']).then(({ claimURL, claimPassword }) => {
      console.log('Claim URL and password fetched from storage:', { claimURL, claimPassword });
      sendResponse({ claimURL, claimPassword });
    });
  }

  return true;
});

async function main() {
  try {
    const nytCookie = await getCookies();
    console.log(nytCookie);
    const { claimURL, claimPassword } = await chrome.storage.sync.get(['claimURL', 'claimPassword'])
    if (!claimURL || !claimPassword) {
      console.log('No claim URL found');
      return;
    }
    console.log(claimURL, claimPassword);
    const url = new URL(claimURL);
    url.pathname = '/session'
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        token: nytCookie.value,
        serverToken: claimPassword
      })
    })
    console.log(response);
    if (response.status === 200) {
      console.log('Claim submitted');
      return true;
    } else {
      console.log('Claim failed');
      return false;
    } 
  } catch (e) {
    console.error(e);
    console.log('Claim failed');
    return false;
  }
  
}

main();


let lastMainRun = 0;
const ONE_HOUR = 60 * 60 * 1000;

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    changeInfo.status === 'complete' &&
    tab.url &&
    tab.url.includes('nytimes.com')
  ) {
    const now = Date.now();
    if (now - lastMainRun > ONE_HOUR) {
      lastMainRun = now;
      main();
    }
  }
});
