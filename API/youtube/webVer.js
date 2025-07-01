/**
 * YouTube RSS/HTML APIユーティリティ（Webブラウザ用ESModule版）
 *
 * - CORS制限回避のため全リクエストをcorsproxy.io経由でfetch
 * - Node依存なし（fetch/DOMParserのみ使用）
 * - TypeScript/Python共通API設計・型・判定ロジックを踏襲
 * - YouTube動画の分類（Shorts/通常/ライブ/ライブアーカイブ）・ライブ状態判定
 * - サムネイル・チャンネルオーナー画像・バージョン情報も取得可能
 * - ブラウザでの利用・テストHTMLに最適化
 *
 * @module YoutubeRssApi (webVer.ts)
 * @see https://github.com/pexserver/pexserver.github.io/tree/main/API/youtube
 */
export var YoutubeLiveStatus;
(function (YoutubeLiveStatus) {
    YoutubeLiveStatus["None"] = "none";
    YoutubeLiveStatus["Upcoming"] = "upcoming";
    YoutubeLiveStatus["Live"] = "live";
    YoutubeLiveStatus["Ended"] = "ended";
})(YoutubeLiveStatus || (YoutubeLiveStatus = {}));
export var YoutubeVideoType;
(function (YoutubeVideoType) {
    YoutubeVideoType["Normal"] = "normal";
    YoutubeVideoType["Shorts"] = "shorts";
    YoutubeVideoType["LiveContents"] = "liveContents";
    YoutubeVideoType["IsLive"] = "isLive";
    YoutubeVideoType["Unknown"] = "unknown";
})(YoutubeVideoType || (YoutubeVideoType = {}));
function proxiedFetch(url, ...args) {
    const proxiedUrl = `https://script.google.com/macros/s/AKfycbzX-Cl7PlS23kE8SeUp2Ya3CwV-VS_-XyDOoj4vpIT38nolAb_8OXV-HD7NpThb3d1P0g/exec?url=${encodeURIComponent(url)}`;
    return fetch(proxiedUrl, ...args);
}
function getDirectChildText(entry, tag) {
    for (const node of Array.from(entry.childNodes)) {
        if (node.nodeType === 1 && node.tagName === tag) {
            const text = node.textContent || '';
            if (window.debugMode)
                console.log(`[DEBUG] getDirectChildText(${tag}):`, text);
            return text;
        }
    }
    return '';
}
// 名前空間対応の直下テキスト取得
function getDirectChildTextNS(entry, ns, tag) {
    for (const node of Array.from(entry.childNodes)) {
        if (node.nodeType === 1 && node.localName === tag && node.namespaceURI === ns) {
            const text = node.textContent || '';
            if (window.debugMode)
                console.log(`[DEBUG] getDirectChildTextNS(${tag}):`, text);
            return text;
        }
    }
    return '';
}
function parseYoutubeRssEntry(entry) {
    // title: entry直下の<title>
    let title = '';
    for (const node of Array.from(entry.childNodes)) {
        if (node.nodeType === 1 && node.tagName === 'title') {
            title = node.textContent || '';
            break;
        }
    }
    // author: entry直下の<author><name>
    let author = '';
    for (const node of Array.from(entry.childNodes)) {
        if (node.nodeType === 1 && node.tagName === 'author') {
            for (const n2 of Array.from(node.childNodes)) {
                if (n2.nodeType === 1 && n2.tagName === 'name') {
                    author = n2.textContent || '';
                    break;
                }
            }
            break;
        }
    }
    // published: entry直下の<published>
    let published = '';
    for (const node of Array.from(entry.childNodes)) {
        if (node.nodeType === 1 && node.tagName === 'published') {
            published = node.textContent || '';
            break;
        }
    }
    // videoId: <yt:videoId>または<videoId>
    let videoId = '';
    const videoIdElem = entry.getElementsByTagName('yt:videoId')[0] || entry.getElementsByTagName('videoId')[0];
    if (videoIdElem) {
        videoId = WebPaser.getDirectText(videoIdElem);
    }
    else {
        // Atomのidからyt:video:を除去
        const idElem = entry.getElementsByTagName('id')[0];
        if (idElem) {
            const idText = WebPaser.getDirectText(idElem);
            if (idText.startsWith('yt:video:'))
                videoId = idText.replace('yt:video:', '');
            else
                videoId = idText;
        }
    }
    // url: entry直下の<link rel="alternate" href="...">
    let url = '';
    for (const node of Array.from(entry.childNodes)) {
        if (node.nodeType === 1 && node.tagName === 'link') {
            const rel = node.getAttribute('rel');
            if (rel === 'alternate') {
                url = node.getAttribute('href') || '';
                break;
            }
        }
    }
    // type: urlに'/shorts/'が含まれていればShorts、そうでなければNormal
    let type = YoutubeVideoType.Unknown;
    if (url.includes('/shorts/'))
        type = YoutubeVideoType.Shorts;
    else
        type = YoutubeVideoType.Normal;
    if (window.debugMode) {
        console.log('[DEBUG] parseYoutubeRssEntry(index.ts compatible)', { videoId, title, author, published, url, type });
    }
    return {
        videoId,
        title,
        author,
        published,
        url,
        type,
    };
}
// --- WebPaserクラスを統合 ---
class WebPaser {
    constructor(xmlOrHtml, type = 'xml') {
        if (window.debugMode)
            console.log('[WebPaser] parse start', { type, xmlOrHtml });
        this.doc = new DOMParser().parseFromString(xmlOrHtml, type === 'xml' ? 'application/xml' : 'text/html');
        if (window.debugMode)
            console.log('[WebPaser] parse done', this.doc);
    }
    getFirstElement(tag) {
        const elem = this.doc.getElementsByTagName(tag)[0] || null;
        if (window.debugMode)
            console.log(`[WebPaser] getFirstElement(${tag}):`, elem);
        return elem;
    }
    getAllElements(tag) {
        const elems = Array.from(this.doc.getElementsByTagName(tag));
        if (window.debugMode)
            console.log(`[WebPaser] getAllElements(${tag}):`, elems);
        return elems;
    }
    static getDirectText(elem) {
        const text = Array.from(elem.childNodes)
            .filter(n => n.nodeType === 3)
            .map(n => n.textContent || '')
            .join('').trim();
        if (window.debugMode)
            console.log('[WebPaser] getDirectText:', text, elem);
        return text;
    }
    static getAttr(elem, attr) {
        const val = elem.getAttribute(attr);
        if (window.debugMode)
            console.log(`[WebPaser] getAttr(${attr}):`, val, elem);
        return val;
    }
    getRootElement() {
        if (window.debugMode)
            console.log('[WebPaser] getRootElement:', this.doc.documentElement);
        return this.doc.documentElement;
    }
}
export class YoutubeRssApi {
    constructor(debugMode = false) {
        this.debugMode = debugMode;
    }
    async extractChannelId(url) {
        const patterns = [
            /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/,
            /youtube\.com\/c\/([a-zA-Z0-9_-]+)/,
            /youtube\.com\/user\/([a-zA-Z0-9_-]+)/,
            /youtube\.com\/@([a-zA-Z0-9_-]+)/,
        ];
        for (const pattern of patterns) {
            const m = url.match(pattern);
            if (m) {
                if (m[1].startsWith('UC'))
                    return m[1];
                return await this.extractChannelIdFromHtml(url);
            }
        }
        return null;
    }
    async extractChannelIdFromHtml(url) {
        try {
            const res = await proxiedFetch(url);
            if (!res.ok)
                return null;
            const html = await res.text();
            const m1 = html.match(/"channelId":"(UC[^"]+)"/);
            if (m1)
                return m1[1];
            const m2 = html.match(/<meta property="og:url" content="https:\/\/www.youtube.com\/channel\/(UC[^"]+)">/);
            if (m2)
                return m2[1];
        }
        catch { }
        return null;
    }
    async getChannelName(channelId) {
        const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
        try {
            const res = await proxiedFetch(feedUrl);
            if (!res.ok)
                return null;
            const xml = await res.text();
            const parser = new WebPaser(xml, 'xml');
            const titleElem = parser.getFirstElement('title');
            return titleElem ? WebPaser.getDirectText(titleElem) : null;
        }
        catch {
            return null;
        }
    }
    async getLatestVideos(channelId) {
        const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
        try {
            const res = await proxiedFetch(feedUrl);
            if (!res.ok)
                return null;
            const xml = await res.text();
            if (window.debugMode)
                console.log('[DEBUG] RSS xml:', xml);
            const parser = new WebPaser(xml, 'xml');
            const entryElems = parser.getAllElements('entry');
            const videos = entryElems.map(entry => parseYoutubeRssEntry(entry));
            return videos;
        }
        catch {
            return null;
        }
    }
    async getLiveStatus(videoId) {
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        try {
            const res = await proxiedFetch(videoUrl);
            if (!res.ok)
                return YoutubeLiveStatus.None;
            const html = await res.text();
            if (html.includes('"isLive":true') || html.includes('"liveBroadcastContent":"live"'))
                return YoutubeLiveStatus.Live;
            if (html.includes('"liveBroadcastContent":"upcoming"') || html.includes('"isUpcoming":true'))
                return YoutubeLiveStatus.Upcoming;
            if (html.includes('"ended":true'))
                return YoutubeLiveStatus.Ended;
            return YoutubeLiveStatus.None;
        }
        catch {
            return YoutubeLiveStatus.None;
        }
    }
    async getVideoDetail(videoId) {
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        try {
            const res = await proxiedFetch(url);
            if (!res.ok)
                return null;
            const html = await res.text();
            const title = html.match(/<title>(.*?)<\/title>/)?.[1]?.replace(' - YouTube', '') || '';
            const author = html.match(/"author":"([^"]+)"/)?.[1] || '';
            const description = html.match(/"shortDescription":"([^"]+)"/)?.[1]?.replace(/\\n/g, '\n') || '';
            const thumbnailMatches = Array.from(html.matchAll(/"thumbnailUrl":"(https:\/\/i\.ytimg\.com[^"]+)"/g));
            const thumbnails = thumbnailMatches.map(m => m[1].replace(/\\\//g, '/'));
            const imageUrl = thumbnails.length > 0 ? thumbnails[0] : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
            // Shorts判定
            let isShorts = false;
            if (url.includes('/shorts/') || /"canonicalUrl":"https:\/\/www.youtube.com\/shorts\//.test(html)) {
                isShorts = true;
            }
            if (!isShorts && /"shortsUrl":"https:\/\/www.youtube.com\/shorts\//.test(html)) {
                isShorts = true;
            }
            // ライブ判定
            let isLiveContent = undefined;
            const isLiveContentMatch = html.match(/"isLiveContent"\s*:\s*(true|false)/);
            if (isLiveContentMatch) {
                isLiveContent = isLiveContentMatch[1] === 'true';
            }
            let liveBroadcastDetails = {};
            const liveBroadcastMatch = html.match(/"liveBroadcastDetails"\s*:\s*\{([^}]*)\}/);
            if (liveBroadcastMatch) {
                const fragment = `{${liveBroadcastMatch[1]}}`;
                try {
                    const isLiveNow = /"isLiveNow"\s*:\s*(true|false)/.exec(fragment)?.[1];
                    const startTimestamp = /"startTimestamp"\s*:\s*"([^"]+)"/.exec(fragment)?.[1];
                    const endTimestamp = /"endTimestamp"\s*:\s*"([^"]+)"/.exec(fragment)?.[1];
                    liveBroadcastDetails = {
                        isLiveNow: isLiveNow ? isLiveNow === 'true' : undefined,
                        startTimestamp,
                        endTimestamp,
                    };
                }
                catch { }
            }
            // type判定
            let type = YoutubeVideoType.Unknown;
            if (isShorts) {
                type = YoutubeVideoType.Shorts;
            }
            else if (isLiveContent === true) {
                if (liveBroadcastDetails.isLiveNow === true) {
                    type = YoutubeVideoType.IsLive;
                }
                else {
                    type = YoutubeVideoType.LiveContents;
                }
            }
            else if (isLiveContent === false) {
                type = YoutubeVideoType.Normal;
            }
            else if (liveBroadcastMatch) {
                if (liveBroadcastDetails.isLiveNow === true) {
                    type = YoutubeVideoType.IsLive;
                }
                else {
                    type = YoutubeVideoType.LiveContents;
                }
            }
            else {
                if ((title && /ライブ|配信|生放送|live/i.test(title)) || (description && /ライブ|配信|生放送|live/i.test(description))) {
                    type = YoutubeVideoType.LiveContents;
                }
                else {
                    type = YoutubeVideoType.Normal;
                }
            }
            let liveStatus = undefined;
            if (liveBroadcastDetails.isLiveNow === true) {
                liveStatus = YoutubeLiveStatus.Live;
            }
            else if (liveBroadcastDetails.isLiveNow === false) {
                if (liveBroadcastDetails.endTimestamp) {
                    liveStatus = YoutubeLiveStatus.Ended;
                }
                else {
                    liveStatus = YoutubeLiveStatus.Upcoming;
                }
            }
            else if (type === YoutubeVideoType.LiveContents) {
                liveStatus = YoutubeLiveStatus.Upcoming;
            }
            if (liveStatus === undefined) {
                liveStatus = YoutubeLiveStatus.None;
            }
            return {
                videoId,
                title,
                author,
                published: '',
                url,
                description,
                thumbnails,
                imageUrl,
                type,
                liveStatus,
            };
        }
        catch {
            return null;
        }
    }
    async getChannelOwnerImage(channelId) {
        const url = `https://www.youtube.com/channel/${channelId}`;
        try {
            const res = await proxiedFetch(url);
            if (!res.ok)
                return null;
            const html = await res.text();
            const m = html.match(/<meta property="og:image" content="([^"]+)"/);
            if (m)
                return m[1];
        }
        catch { }
        return null;
    }
    async getLatestVideosWithDetails(channelId, options) {
        const videos = await this.getLatestVideos(channelId);
        if (!videos)
            return [];
        const concurrency = options?.concurrency ?? 3;
        const results = [];
        for (let i = 0; i < videos.length; i += concurrency) {
            const chunk = videos.slice(i, i + concurrency);
            const details = await Promise.all(chunk.map(v => this.getVideoDetail(v.videoId)));
            for (const d of details) {
                if (d)
                    results.push(d);
            }
        }
        return results;
    }
}
YoutubeRssApi.version = '1.0.0';
