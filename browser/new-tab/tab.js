let auth;
let tableChannels;
let selectedChannels = new Set();


document.addEventListener('DOMContentLoaded', async function () {

    auth = await chrome.storage.local.get('token') || null;
    document.getElementById('auth-container').style.display = !auth.token ? 'flex' : 'none';
    document.getElementById('snip-container').style.display = !auth.token ? 'none' : 'flex';

    // document.getElementById('logout').addEventListener('click', async () => {
    //     chrome.storage.local.remove('token')
    //         .then(() => {
    //             document.getElementById('auth-container').style.display = 'flex';
    //             document.getElementById('snip-container').style.display = 'none';
    //         });
    //     return false;
    // })

    await getUserDetails()
        .then(async (user) => {
            await getMyBlock(user.id)
                .then((channels) => {
                    if (channels) {
                        const randomChannel = channels[Math.floor(Math.random() * channels.length)];
                        
                        
                    }
                })
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

function getRandomChannel(channels) {
    if (!channels || channels.length === 0) {
        return null;
    }
    const randomIndex = Math.floor(Math.random() * channels.length);
    const channel = channels[randomIndex];
    return channel;
}

function handleBlock(block) {
    
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

async function getMyBlock(userId) {
    try {
        const response = await fetch(`https://api.are.na/v2/users/${userId}/channels`, {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${auth.token}`
            },
        });
        const data = await response.json();
        if (data.channels && data.channels.length > 0) {
            const randomChannel = getRandomChannel(data.channels);
            if (randomChannel) {
                const randomBlock = await getRandomBlock(randomChannel.contents);
                if (randomBlock) {
                    const img = document.getElementById('my-block');
                    img.src = randomBlock.image.large.url || randomBlock.image.small.url || randomBlock.image.thumb.url;
                    img.alt = randomBlock.title || 'Are.na Block';
                    img.addEventListener('click', () => {
                        chrome.tabs.create({ url: `https://are.na/block/${randomBlock.id}` });
                    });
                    img.classList.add('cursor-pointer');
                    
                    img.classList.remove('hidden');
                }
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
        console.log({ code: code })
        const token = await getLocalToken(code);
        auth = { token: token };
        console.log({ token: token })
        if (token) chrome.storage.local.set({ token: token })
            .then(async () => {
                document.getElementById('auth-container').style.display = 'none';
                document.getElementById('snip-container').style.display = 'flex';
                await getUserDetails()
                    .then(async (user) => {
                        await getMyBlock(user.id)
                            .then((channels) => {
                                if (channels) {
                                    console.log(channels);
                                }
                            })
                    })
            });
        return false;
    });
})


