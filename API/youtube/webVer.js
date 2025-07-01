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
            const res = await fetch(url);
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
            const res = await fetch(feedUrl);
            if (!res.ok)
                return null;
            const xml = await res.text();
            const doc = new DOMParser().parseFromString(xml, 'application/xml');
            const title = doc.querySelector('feed > title');
            return title ? title.textContent : null;
        }
        catch {
            return null;
        }
    }
    async getLatestVideos(channelId) {
        const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
        try {
            const res = await fetch(feedUrl);
            if (!res.ok)
                return null;
            const xml = await res.text();
            const doc = new DOMParser().parseFromString(xml, 'application/xml');
            const entries = Array.from(doc.querySelectorAll('entry'));
            return entries.map(entry => {
                const videoId = entry.querySelector('yt\\:videoId, videoId')?.textContent || '';
                const url = entry.querySelector('link')?.getAttribute('href') || '';
                let type = YoutubeVideoType.Unknown;
                if (url.includes('/shorts/'))
                    type = YoutubeVideoType.Shorts;
                else
                    type = YoutubeVideoType.Normal;
                return {
                    videoId,
                    title: entry.querySelector('title')?.textContent || '',
                    author: entry.querySelector('author > name')?.textContent || '',
                    published: entry.querySelector('published')?.textContent || '',
                    url,
                    type,
                };
            });
        }
        catch {
            return null;
        }
    }
    async getLiveStatus(videoId) {
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        try {
            const res = await fetch(videoUrl);
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
            const res = await fetch(url);
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
            const res = await fetch(url);
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
