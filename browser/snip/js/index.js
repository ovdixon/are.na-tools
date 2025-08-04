let auth;
let tableChannels;
let selectedChannels = new Set();
let block;


document.addEventListener('DOMContentLoaded', async function () {

    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
    block = { type: 'link', source: tab.url };

    chrome.runtime.sendMessage({ message: 'getCropData' }, async (response) => {
        if (response && response.imgSrc && response.rect && response.scale) {
            const croppedUrl = await cropImage(response.imgSrc, response.rect, response.scale);
            block = { type: 'image-crop', source: croppedUrl };
            document.getElementById("start-snip").style.display = "none";
            document.getElementById("image-preview").style.display = "block";
            document.getElementById('image-preview').src = croppedUrl;
        }
    });

    auth = await chrome.storage.local.get('token') || null;
    console.log(auth.token)
    document.getElementById('auth-container').style.display = !auth.token ? 'flex' : 'none';
    document.getElementById('snip-container').style.display = !auth.token ? 'none' : 'flex';

    await getUserDetails()
        .then(async (user) => {
            await getRecentChannels(user.id)
                .then((channels) => {
                    if (channels) {
                        tableChannels = channels;
                        populateChannelsTable(channels)
                    }
                })
        })


    document.getElementById('save-button').addEventListener('click', async () => {
        const selectedIds = Array.from(selectedChannels);
        try {
            document.getElementById('save-button').textContent = 'Saving...';
            await handleSelectedChannels(selectedIds);
        } catch (err) {
            document.getElementById('save-button').textContent = 'Error saving';
            setTimeout(() => {
                document.getElementById('save-button').textContent = 'Save to channels';
            }, 2000);
        } finally {
            document.getElementById('save-button').textContent = 'Saved!';
            setTimeout(() => {
                document.getElementById('save-button').textContent = 'Save to channels';
            }, 2000);
        }
    });

    document.getElementById('new-channel').addEventListener('click', async () => {
        const channelName = document.getElementById('search-input').value.trim();
        if (channelName) {
            await createChannel(channelName)
                .then(async (channel) => {
                    tableChannels.unshift(channel);
                    tableChannels.pop();
                    await populateChannelsTable(tableChannels);
                    document.getElementById('search-input').value = '';
                })
        }
    });

    document.getElementById('search-submit').addEventListener('click', async () => {
        const query = document.getElementById('search-input').value;
        selectedChannels.clear();
        updateSaveButton();
        const channels = await searchChannels(query);
        tableChannels = channels;
        await populateChannelsTable(channels);
    });

    document.getElementById('search-input').addEventListener('keydown', async (event) => {
        console.log(event)
        if (event.key === 'Enter') {
            const query = event.target.value;
            selectedChannels.clear();
            updateSaveButton();
            const channels = await searchChannels(query);
            tableChannels = channels;
            await populateChannelsTable(channels);
        }
    });

    updateSaveButton();

    const btn = document.getElementById('menu-button');
    const menu = document.getElementById('options-menu');

    const toggleMenu = (show) => {
        btn.setAttribute('aria-expanded', show);
        menu.classList.toggle('hidden', !show);
    };

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMenu(menu.classList.contains('hidden'));
    });

    window.addEventListener('click', () => toggleMenu(false));

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') toggleMenu(false);
    });

    document.getElementById('search-input').addEventListener('input', function () {
    document.getElementById('search-submit').disabled = !this.value;
});

document.getElementById('start-snip').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id) return;

    await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['js/snip.js']
    });
    window.close();
});

document.getElementById('logout').addEventListener('click', async () => {
    chrome.storage.local.remove('token')
        .then(() => {
            document.getElementById('auth-container').style.display = 'flex';
            document.getElementById('snip-container').style.display = 'none';
        });
    return false;
})

});

function cropImage(img, rect, scale) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.src = img;
        image.onload = function () {
            const canvas = document.createElement("canvas");
            console.log(rect, scale)
            canvas.width = rect.width * scale;
            canvas.height = rect.height * scale;
            const ctx = canvas.getContext("2d");

            ctx.drawImage(
                image,
                rect.left * scale,
                rect.top * scale,
                rect.width * scale,
                rect.height * scale,
                0,
                0,
                rect.width * scale,
                rect.height * scale
            );

            const croppedImage = canvas.toDataURL();
            resolve(croppedImage);
        };
        image.onerror = reject;
    });
}

function updateSaveButton() {
    const saveButton = document.getElementById('save-button');
    saveButton.disabled = selectedChannels.size === 0;
    saveButton.textContent = selectedChannels.size === 0 ? 'Select a channel' : `Save to ${selectedChannels.size} channels`;
}


function getSelfInfo() {
    return new Promise((resolve, reject) => {
        chrome.management.getSelf((extensionInfo) => {
            if (chrome.runtime.lastError) {
                return reject(chrome.runtime.lastError);
            }
            resolve(extensionInfo);
        });
    });
}

async function getLocalToken(code) {
    try {
        const self = await getSelfInfo();
        const url = `https://arena-mv3-auth.ovdixon.workers.dev/${self.installType === 'development' ? 'auth-dev' : 'auth'}`;

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code: code })
        });

        const data = await res.json();
        return data.access_token;
    } catch (err) {
        console.error(err);
        return null;
    }
}

async function getUserDetails() {
    try {
        const response = await fetch("https://api.are.na/v2/me", {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${auth.token}`
            },
        });

        const data = await response.json();
        return data;
    } catch (err) {
        throw new Error('Fetching Are.na user profile.')
    }

}

async function getRecentChannels(userId) {
    try {
        const response = await fetch(`https://api.are.na/v2/users/${userId}/channels?per=3`, {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${auth.token}`
            },
        });
        const data = await response.json();
        return data.channels;
    } catch (err) {
        throw new Error('Fetching recent channels.')
    }
}

async function searchChannels(query) {
    const response = await fetch(`https://api.are.na/v2/search/channels/?q=${query}&per=3`, {
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${auth.token}`
        },
    });
    const data = await response.json();
    return data.channels;

}

async function createChannel(name) {
    const response = await fetch('https://api.are.na/v2/channels', {
        method: 'POST',
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${auth.token}`
        },
        body: JSON.stringify({
            title: name,
            status: 'private'
        })
    });
    const data = await response.json();
    return data;
}

function getStatusDotClass(status) {
    switch ((status ?? '').toLowerCase()) {
        case 'public': return 'fill-green-500';
        case 'private': return 'fill-red-500';
        case 'closed': return 'fill-gray-400';
    }
}

async function populateChannelsTable(channels) {
    const channelsTable = document.getElementById('channels-table');
    channelsTable.innerHTML = '';
    channels.forEach(channel => {
        console.log(channel)
        const tr = document.createElement('tr');
        if (selectedChannels.has(channel.id)) tr.classList.add('selected');
        tr.dataset.channelId = channel.id;
        const dotClass = getStatusDotClass(channel.status);

        tr.innerHTML = `
        <td
            class="px-2 py-2 text-xs text-gray-500 max-w-[128px] truncate"
            title="${channel.user.full_name} / ${channel.title}"
        >
            ${channel.user.full_name} / ${channel.title}
        </td>

        <td class="px-2 py-2 text-xs whitespace-nowrap">
            <svg class="size-1.5 ${dotClass}" viewBox="0 0 6 6" aria-hidden="true">
            <circle cx="3" cy="3" r="3" />
            </svg>
        </td>
        `;
        tr.addEventListener('click', () => {
            tr.classList.toggle('bg-gray-100');

            if (tr.classList.contains('bg-gray-100')) {
                console.log(`Selected channel: ${channel.id}`);
                selectedChannels.add(channel.id);
            } else {
                selectedChannels.delete(channel.id);
            }
            updateSaveButton();

        });
        channelsTable.append(tr);

    });
}

async function getUploadUrl() {
    const response = await fetch('https://arena-mv3-auth.ovdixon.workers.dev/upload-url', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${auth.token}`
        },
    })
    const data = await response.json()
    const url = data.url;
    const key = data.filename;
    console.log(url, key)
    return { url, key };
}

async function getFetchUrl(key) {
    const response = await fetch(`https://arena-mv3-auth.ovdixon.workers.dev/fetch-url?file=${key}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${auth.token}`
        },
    })
    const data = await response.json()
    return data.url


}

async function uploadFile(file, presignedUrl) {
    const blobResponse = await fetch(file);
    const blob = await blobResponse.blob();
    const response = await fetch(presignedUrl, {
        method: 'PUT',
        headers: {
            'Content-Type': 'image/png',
            'Content-Encoding': 'base64',
        },
        body: blob
    })
    return response;
}

async function handleSelectedChannels(channels) {
    let source = null
    let content = null
    try {
        if (block.type === 'image-crop') {
            const { url, key } = await getUploadUrl();
            await uploadFile(block.source, url);
            source = await getFetchUrl(key);
        } else if (block.type === 'link' || block.type === 'image') {
            source = block.source
        } else {
            content = block.source
        }

        channels.forEach(async (channelId) => {
            const response = await fetch(`https://api.are.na/v2/channels/${channelId}/blocks`, {
                method: 'POST',
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${auth.token}`
                },
                body: JSON.stringify({
                    "source": source,
                    "content": content,
                })
            });
            console.log(response)
        }
        )

    } catch (err) {
        console.log(err)
        throw new Error('Saving to selected channels.')
    }
}


document.getElementById('login').addEventListener('click', async () => {
    const clientId = 'xGd8YeYsshg6UtisCIpJr3JT_ieOAADuJbACtluzhMw'
    const redirectUri = encodeURIComponent(chrome.identity.getRedirectURL());
    const authUrl = `https://dev.are.na/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code`;
    chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true
    }, async function (redirectUrl) {
        if (chrome.runtime.lastError || !redirectUrl) {
            console.error(chrome.runtime.lastError ? chrome.runtime.lastError.message : 'No redirect URL');
            return;
        }
        const url = new URL(redirectUrl);
        const code = url.searchParams.get('code');
        const token = await getLocalToken(code);
        auth = { token: token };
        console.log({ token: token })
        if (token) chrome.storage.local.set({ token: token })
            .then(async () => {
                document.getElementById('auth-container').style.display = 'none';
                document.getElementById('snip-container').style.display = 'flex';
                await getUserDetails()
                    .then(async (user) => {
                        await getRecentChannels(user.id)
                            .then((channels) => {
                                if (channels) {
                                    tableChannels = channels;
                                    populateChannelsTable(channels)
                                }
                            })
                    })
            });
        return false;
    });
})


