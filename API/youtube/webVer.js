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
    // Google Apps Scriptプロキシ（メイン）
    const proxiedUrl = `https://script.google.com/macros/s/AKfycbzX-Cl7PlS23kE8SeUp2Ya3CwV-VS_-XyDOoj4vpIT38nolAb_8OXV-HD7NpThb3d1P0g/exec?url=${encodeURIComponent(url)}`;
    if (window.debugMode) {
        console.log('[DEBUG] Using proxy for URL:', url);
        console.log('[DEBUG] Proxied URL:', proxiedUrl);
    }
    return fetch(proxiedUrl, {
        method: 'GET',
        cache: 'no-cache',
        ...args
    }).then(async (response) => {
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const text = await response.text();
        if (window.debugMode) {
            console.log(`[DEBUG] Proxy response for ${url} - length:`, text.length);
            // YouTubeページでライブ関連キーワードの存在をチェック
            if (url.includes('youtube.com/watch')) {
                const liveKeywords = [
                    'isLiveContent',
                    'liveBroadcastDetails',
                    'isLiveNow',
                    'liveBroadcastContent',
                    '"style":"LIVE"',
                    '"iconType":"LIVE"',
                    '人が視聴中',
                    'ライブ配信開始'
                ];
                liveKeywords.forEach(keyword => {
                    const found = text.includes(keyword);
                    console.log(`[DEBUG] Proxy response contains "${keyword}":`, found);
                });
            }
        }
        return {
            ok: true,
            text: () => Promise.resolve(text),
            json: () => Promise.resolve(JSON.parse(text))
        };
    }).catch(async (error) => {
        if (window.debugMode) {
            console.log('[DEBUG] Primary proxy failed, trying fallback...', error);
        }
        try {
            // フォールバック1: allorigins.win
            const fallbackUrl1 = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
            const fallbackRes1 = await fetch(fallbackUrl1, ...args);
            if (fallbackRes1.ok) {
                const data = await fallbackRes1.json();
                return {
                    ok: true,
                    text: () => Promise.resolve(data.contents),
                    json: () => Promise.resolve(JSON.parse(data.contents))
                };
            }
        }
        catch (fallbackError1) {
            if (window.debugMode) {
                console.log('[DEBUG] Fallback 1 failed:', fallbackError1);
            }
        }
        try {
            // フォールバック2: corsproxy.io
            const fallbackUrl2 = `https://corsproxy.io/?${encodeURIComponent(url)}`;
            const fallbackRes2 = await fetch(fallbackUrl2, ...args);
            if (fallbackRes2.ok) {
                const text = await fallbackRes2.text();
                return {
                    ok: true,
                    text: () => Promise.resolve(text),
                    json: () => Promise.resolve(JSON.parse(text))
                };
            }
        }
        catch (fallbackError2) {
            if (window.debugMode) {
                console.log('[DEBUG] Fallback 2 failed:', fallbackError2);
            }
        }
        throw error;
    });
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
            title = node.textContent?.trim() || '';
            break;
        }
    }
    // author: entry直下の<author><name>
    let author = '';
    for (const node of Array.from(entry.childNodes)) {
        if (node.nodeType === 1 && node.tagName === 'author') {
            for (const n2 of Array.from(node.childNodes)) {
                if (n2.nodeType === 1 && n2.tagName === 'name') {
                    author = n2.textContent?.trim() || '';
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
            published = node.textContent?.trim() || '';
            break;
        }
    }
    // videoId: <yt:videoId>
    let videoId = '';
    const videoIdElem = entry.getElementsByTagName('yt:videoId')[0];
    if (videoIdElem) {
        videoId = videoIdElem.textContent?.trim() || '';
    }
    else {
        // フォールバック: <id>からyt:video:を除去
        const idElem = entry.getElementsByTagName('id')[0];
        if (idElem) {
            const idText = idElem.textContent?.trim() || '';
            if (idText.startsWith('yt:video:')) {
                videoId = idText.replace('yt:video:', '');
            }
            else {
                videoId = idText;
            }
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
        const text = (elem.textContent || '').trim();
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
            // より詳細なライブ配信検知パターン
            const liveIndicators = [
                // 基本的なライブ配信ステータス
                '"isLive":true',
                '"liveBroadcastContent":"live"',
                '"isLiveNow":true',
                // ライブ配信UI要素
                '"style":"LIVE"',
                '"iconType":"LIVE"',
                // 同時視聴者数の表示
                '人が視聴中',
                // ライブ配信の開始時刻表示
                'ライブ配信開始',
                'にライブ配信開始',
            ];
            const upcomingIndicators = [
                '"liveBroadcastContent":"upcoming"',
                '"isUpcoming":true',
                '配信予定',
                'ライブ予定',
                '生放送予定',
                'プレミア公開',
                'premiere'
            ];
            const endedIndicators = [
                '"ended":true',
                '"liveBroadcastContent":"none"',
                '配信済み',
                'に配信済み'
            ];
            // ライブ配信中の判定
            if (liveIndicators.some(indicator => html.includes(indicator))) {
                if (this.debugMode) {
                    console.log(`[DEBUG] Live status detected for ${videoId}`);
                }
                return YoutubeLiveStatus.Live;
            }
            // 配信予定の判定
            if (upcomingIndicators.some(indicator => html.includes(indicator))) {
                if (this.debugMode) {
                    console.log(`[DEBUG] Upcoming status detected for ${videoId}`);
                }
                return YoutubeLiveStatus.Upcoming;
            }
            // 配信終了の判定
            if (endedIndicators.some(indicator => html.includes(indicator))) {
                if (this.debugMode) {
                    console.log(`[DEBUG] Ended status detected for ${videoId}`);
                }
                return YoutubeLiveStatus.Ended;
            }
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
            if (this.debugMode) {
                console.log(`[DEBUG] getVideoDetail for ${videoId} - HTML length:`, html.length);
                // ライブ関連のキーワードをチェック
                const liveKeywords = [
                    'isLiveContent',
                    'liveBroadcastDetails',
                    'isLiveNow',
                    'liveBroadcastContent',
                    '"style":"LIVE"',
                    '"iconType":"LIVE"',
                    '人が視聴中',
                    'ライブ配信開始',
                    '配信済み'
                ];
                for (const keyword of liveKeywords) {
                    const found = html.includes(keyword);
                    console.log(`[DEBUG] HTML contains "${keyword}":`, found);
                    if (found) {
                        // キーワード周辺のコンテキストを表示
                        const index = html.indexOf(keyword);
                        const context = html.substring(Math.max(0, index - 50), index + 150);
                        console.log(`[DEBUG] Context for "${keyword}":`, context);
                    }
                }
            }
            const title = html.match(/<title>(.*?)<\/title>/)?.[1]?.replace(' - YouTube', '') || '';
            const author = html.match(/"author":"([^"]+)"/)?.[1] || '';
            const description = html.match(/"shortDescription":"([^"]+)"/)?.[1]?.replace(/\\n/g, '\n') || '';
            const thumbnailMatches = Array.from(html.matchAll(/"thumbnailUrl":"(https:\/\/i\.ytimg\.com[^"]+)"/g));
            const thumbnails = thumbnailMatches.map((m) => m[1].replace(/\\\//g, '/'));
            const imageUrl = thumbnails.length > 0 ? thumbnails[0] : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
            // --- Shorts判定強化（index.tsと同じロジック） ---
            let isShorts = false;
            // 1. URLパターン
            if (url.includes('/shorts/') || /"canonicalUrl":"https:\/\/www.youtube.com\/shorts\//.test(html)) {
                isShorts = true;
            }
            // 2. HTML内のshortsリンクや構造
            if (!isShorts && /"shortsUrl":"https:\/\/www.youtube.com\/shorts\//.test(html)) {
                isShorts = true;
            }
            // --- ライブ判定ロジック強化（index.tsと同じロジック） ---
            let isLiveContent = undefined;
            const isLiveContentMatch = html.match(/"isLiveContent"\s*:\s*(true|false)/);
            if (isLiveContentMatch) {
                isLiveContent = isLiveContentMatch[1] === 'true';
            }
            // プロキシ経由でライブ情報が取得できない場合の代替判定
            if (isLiveContent === undefined) {
                // より詳細なライブ情報の検索パターンを追加
                const liveContentPatterns = [
                    /"isLiveContent"\s*:\s*true/i,
                    /"liveBroadcastContent"\s*:\s*"live"/i,
                    /"liveBroadcastContent"\s*:\s*"upcoming"/i,
                    /"isLive"\s*:\s*true/i,
                    /"isUpcoming"\s*:\s*true/i,
                    /"ended"\s*:\s*true/i,
                    // 新しいライブ配信検知パターン
                    /"style"\s*:\s*"LIVE"/i,
                    /"iconType"\s*:\s*"LIVE"/i,
                ];
                const hasLiveIndicators = liveContentPatterns.some(pattern => pattern.test(html));
                // UI要素からのライブ配信検知
                const liveUIPatterns = [
                    /人が視聴中/,
                    /ライブ配信開始/,
                    /にライブ配信開始/,
                    /配信済み/,
                    /に配信済み/,
                ];
                const hasLiveUI = liveUIPatterns.some(pattern => pattern.test(html));
                // タイトルや説明文からライブ判定を行う
                const livePatterns = [
                    /【?ライブ配信?】?/i,
                    /【?生放送?】?/i,
                    /【?LIVE】?/i,
                    /\[LIVE\]/i,
                    /配信中/i,
                    /生配信/i,
                    /ライブ中/i,
                    /配信予定/i,
                    /ライブ予定/i,
                    /生放送予定/i,
                    /プレミア公開/i,
                    /premiere/i
                ];
                const isLikelyLive = livePatterns.some(pattern => pattern.test(title) || pattern.test(description));
                if (hasLiveIndicators || hasLiveUI || isLikelyLive) {
                    isLiveContent = true;
                    if (this.debugMode) {
                        console.log('[DEBUG] Live content detected from patterns:', {
                            hasLiveIndicators,
                            hasLiveUI,
                            isLikelyLive,
                            title,
                            description: description.substring(0, 100)
                        });
                    }
                }
            }
            if (this.debugMode) {
                console.log('[DEBUG] isLiveContent:', isLiveContent);
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
            if (this.debugMode) {
                console.log('[DEBUG] liveBroadcastDetails:', liveBroadcastDetails);
            }
            // type判定: shorts, isLive, liveContents, normal（index.tsと同じロジック）
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
            if (this.debugMode) {
                console.log('[DEBUG] type:', type);
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
                // LiveContentsの場合、より詳細にステータスを判定
                // ライブ配信中の判定（新しいパターンを追加）
                const isCurrentlyLive = [
                    '"style":"LIVE"',
                    '"iconType":"LIVE"',
                    '人が視聴中',
                    'ライブ配信開始',
                    'にライブ配信開始'
                ].some(pattern => html.includes(pattern));
                if (isCurrentlyLive) {
                    liveStatus = YoutubeLiveStatus.Live;
                }
                else if (html.includes('"ended":true') ||
                    liveBroadcastDetails.endTimestamp ||
                    html.includes('配信済み') ||
                    html.includes('に配信済み')) {
                    liveStatus = YoutubeLiveStatus.Ended;
                }
                else if (html.includes('"isUpcoming":true') ||
                    html.includes('"liveBroadcastContent":"upcoming"') ||
                    html.includes('配信予定') ||
                    html.includes('ライブ予定')) {
                    liveStatus = YoutubeLiveStatus.Upcoming;
                }
                else {
                    liveStatus = YoutubeLiveStatus.Upcoming; // デフォルト
                }
            }
            // ライブでない場合はnoneをセット
            if (liveStatus === undefined) {
                liveStatus = YoutubeLiveStatus.None;
            }
            if (this.debugMode) {
                console.log('[DEBUG] liveStatus:', liveStatus);
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
            for (let j = 0; j < details.length; j++) {
                const d = details[j];
                if (d) {
                    const rssVideo = chunk[j];
                    // HTMLから詳細なtype判定を取得し、RSSのtype情報と組み合わせ（index.tsと同じ動作）
                    let finalType = d.type; // HTMLからの詳細判定を優先
                    if (rssVideo.type === YoutubeVideoType.Shorts) {
                        // RSSでShortsと判定された場合は確実にShorts
                        finalType = YoutubeVideoType.Shorts;
                    }
                    const mergedVideo = {
                        videoId: rssVideo.videoId,
                        title: rssVideo.title,
                        author: rssVideo.author,
                        published: rssVideo.published,
                        url: rssVideo.url,
                        type: finalType, // より正確なtype判定を使用
                        liveStatus: d.liveStatus, // HTMLからライブ状態を取得
                        description: d.description, // HTMLからの補完情報
                        thumbnails: d.thumbnails,
                        imageUrl: d.imageUrl,
                    };
                    results.push(mergedVideo);
                    if (this.debugMode) {
                        console.log('[DETAIL]', mergedVideo.videoId, mergedVideo.title, mergedVideo.type, mergedVideo.liveStatus);
                    }
                }
            }
        }
        return results;
    }
}
YoutubeRssApi.version = '1.0.0';
