let auth;
let tableChannels;
let selectedChannels = new Set();


document.addEventListener('DOMContentLoaded', async function () {

    auth = await chrome.storage.local.get('token') || null;
    document.getElementById('auth-container').style.display = !auth.token ? 'flex' : 'none';
    document.getElementById('logout').style.display = auth.token ? 'block' : 'none';
    document.getElementById('footer-separator').style.display = auth.token ? 'block' : 'none';

    await getUserDetails()
        .then(async (user) => {
            await getBlock(user.id, 'my');
            await getFollowing(user.id).then((following) => {
                const followingId = following.user_id || following.id
                getBlock(followingId, 'following')
            })

        })

    document.getElementById('logout').addEventListener('click', async () => {
        chrome.storage.local.remove('token')
            .then(() => {
                document.getElementById('auth-container').style.display = 'flex';
                document.getElementById('blocks-wrapper').style.display = 'none';
            });
        return false;
    })


});

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
        const url = `https://arena-mv3-auth.ovdixon.workers.dev/${self.installType === 'development' ? 'auth-tab-dev' : 'auth-tab'}`;

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code: code })
        });

        const data = await res.json();
        console.log(data)
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

function getRandom(items) {
    if (!items || items.length === 0) {
        return null;
    }
    const randomIndex = Math.floor(Math.random() * items.length);
    return items[randomIndex];
}

async function getRandomBlock(blocks) {
    if (!blocks || blocks.length === 0) {
        return null;
    }
    const randomIndex = Math.floor(Math.random() * blocks.length);
    const id = blocks[randomIndex].id;

    try {
        const response = await fetch(`https://api.are.na/v2/blocks/${id}`, {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${auth.token}`
            },
        });
        return await response.json();
    } catch (err) {
        console.error('Error fetching block:', err);
        return null;
    }
}


function handleBlock(block, type) {
    const blocksWrapper = document.getElementById('blocks-wrapper');
    if (!blocksWrapper) return;

    const wrapper = document.createElement('div');
    wrapper.className = "flex flex-col items-center";

    let blockContentElement;

    if (block.class === 'Text') {
        blockContentElement = document.createElement('div');
        blockContentElement.className = "block w-96 h-96 rounded-lg border border-gray-300 cursor-pointer p-6 overflow-y-auto bg-white";
        blockContentElement.innerHTML = block.content_html;
    } else if (block.image && block.image.large) {
        blockContentElement = document.createElement('img');
        blockContentElement.className = "object-cover block w-96 h-96 rounded-lg border border-gray-300 cursor-pointer";
        blockContentElement.src = block.image.large.url || block.image.small.url || block.image.thumb.url;
        blockContentElement.alt = block.title || 'Are.na Block';
    } else {
        blockContentElement = document.createElement('div');
        blockContentElement.className = "flex items-center justify-center text-gray-500 block w-96 h-96 rounded-lg border border-gray-300 cursor-pointer p-6 bg-gray-100";
        blockContentElement.textContent = "Unsupported block type";
    }

    blockContentElement.addEventListener('click', () => {
        chrome.tabs.create({ url: `https://are.na/block/${block.id}` });
    });

    const infoLink = document.createElement('a');
    infoLink.href = `https://are.na/block/${block.id}`;
    infoLink.rel = 'noopener noreferrer';
    infoLink.className = "block w-full mt-2 text-center text-xs text-gray-500 hover:text-gray-700 hover:underline";

    const title = block.title || block.generated_title || '';
    const truncatedTitle = title.length > 40 ? title.substring(0, 40) + '...' : title;
    infoLink.innerHTML = `${truncatedTitle}<br>${block.user.full_name}`;

    wrapper.appendChild(blockContentElement);
    wrapper.appendChild(infoLink);

    blocksWrapper.appendChild(wrapper);
}

async function getFollowing(userId) {
    try {
        const response = await fetch(`https://api.are.na/v2/users/${userId}/following`, {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${auth.token}`
            },
        });
        const data = await response.json();
        if (data.following && data.following.length > 0) {
            const randomFollowing = getRandom(data.following);
            return randomFollowing;
        }
    } catch (err) {
        throw new Error('Fetching following channels.')
    }
}

async function getBlock(userId, type) {
    try {
        const response = await fetch(`https://api.are.na/v2/users/${userId}/channels`, {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${auth.token}`
            },
        });
        const data = await response.json();
        if (data.channels && data.channels.length > 0) {
            const randomChannel = getRandom(data.channels);
            if (randomChannel) {
                const randomBlock = await getRandomBlock(randomChannel.contents);
                if (randomBlock) handleBlock(randomBlock, type);
            }
        }
    } catch (err) {
        throw new Error('Fetching recent channels.')
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
        if (token) chrome.storage.local.set({ token: token })
            .then(async () => {
                document.getElementById('auth-container').style.display = 'none';
                document.getElementById('blocks-wrapper').style.display = 'flex';
                await getUserDetails()
                    .then(async (user) => {
                        await getBlock(user.id, 'my');
                        await getFollowing(user.id).then((following) => {
                            const followingId = following.user_id || following.id
                            getBlock(followingId, 'following')
                        })

                    })
            });
        return false;
    });
})


