"use strict";
/**
 * YouTube RSS/HTML APIユーティリティ（Node.js用TypeScript版）
 *
 * - Node.js環境向け（rss-parser, node-fetch利用）
 * - TypeScript/Python共通API設計・型・判定ロジックを踏襲
 * - YouTube動画の分類（Shorts/通常/ライブ/ライブアーカイブ）・ライブ状態判定
 * - サムネイル・チャンネルオーナー画像・バージョン情報も取得可能
 * - 強力な型定義・拡張性・デバッグモード対応
 * - Web/ブラウザ用ESModule版（webVer.ts）とも仕様互換
 *
 * @module YoutubeRssApi (index.ts)
 * @see https://github.com/pexserver/pexserver.github.io/tree/main/API/youtube
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.YoutubeRssApi = exports.YoutubeVideoType = exports.YoutubeLiveStatus = void 0;
const rss_parser_1 = __importDefault(require("rss-parser"));
const node_fetch_1 = __importDefault(require("node-fetch"));
var YoutubeLiveStatus;
(function (YoutubeLiveStatus) {
    YoutubeLiveStatus["None"] = "none";
    YoutubeLiveStatus["Upcoming"] = "upcoming";
    YoutubeLiveStatus["Live"] = "live";
    YoutubeLiveStatus["Ended"] = "ended";
})(YoutubeLiveStatus || (exports.YoutubeLiveStatus = YoutubeLiveStatus = {}));
var YoutubeVideoType;
(function (YoutubeVideoType) {
    YoutubeVideoType["Normal"] = "normal";
    YoutubeVideoType["Shorts"] = "shorts";
    YoutubeVideoType["LiveContents"] = "liveContents";
    YoutubeVideoType["IsLive"] = "isLive";
    YoutubeVideoType["Unknown"] = "unknown";
})(YoutubeVideoType || (exports.YoutubeVideoType = YoutubeVideoType = {}));
class YoutubeRssApi {
    constructor(debugMode = false) {
        this.parser = new rss_parser_1.default();
        this.debugMode = debugMode;
    }
    /**
     * YouTubeチャンネルURLからチャンネルID（UC...）を抽出
     */
    extractChannelId(url) {
        return __awaiter(this, void 0, void 0, function* () {
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
                    // UCでなければHTMLから取得
                    return yield this.extractChannelIdFromHtml(url);
                }
            }
            return null;
        });
    }
    /**
     * HTMLページからチャンネルIDを抽出
     */
    extractChannelIdFromHtml(url) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const res = yield (0, node_fetch_1.default)(url);
                if (!res.ok)
                    return null;
                const html = yield res.text();
                const m1 = html.match(/"channelId":"(UC[^"]+)"/);
                if (m1)
                    return m1[1];
                const m2 = html.match(/<meta property="og:url" content="https:\/\/www.youtube.com\/channel\/(UC[^"]+)">/);
                if (m2)
                    return m2[1];
            }
            catch (_a) {
                // ignore
            }
            return null;
        });
    }
    /**
     * チャンネルIDからチャンネル名を取得
     */
    getChannelName(channelId) {
        return __awaiter(this, void 0, void 0, function* () {
            const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
            try {
                const feed = yield this.parser.parseURL(feedUrl);
                return feed.title || null;
            }
            catch (_a) {
                return null;
            }
        });
    }
    /**
     * チャンネルIDから最新動画リストを取得
     */
    getLatestVideos(channelId) {
        return __awaiter(this, void 0, void 0, function* () {
            const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
            try {
                const feed = yield this.parser.parseURL(feedUrl);
                return (feed.items || []).map(item => {
                    var _a;
                    const videoId = ((_a = item.id) === null || _a === void 0 ? void 0 : _a.replace('yt:video:', '')) || '';
                    const url = item.link || '';
                    let type = YoutubeVideoType.Unknown;
                    if (url.includes('/shorts/'))
                        type = YoutubeVideoType.Shorts;
                    else
                        type = YoutubeVideoType.Normal;
                    // ライブ判定は詳細取得で補完
                    return {
                        videoId,
                        title: item.title || '',
                        author: item.author || '',
                        published: item.pubDate || '',
                        url,
                        type,
                    };
                });
            }
            catch (_a) {
                return null;
            }
        });
    }
    /**
     * 動画IDからライブ状態を取得（none, upcoming, live, ended）
     */
    getLiveStatus(videoId) {
        return __awaiter(this, void 0, void 0, function* () {
            const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
            try {
                const res = yield (0, node_fetch_1.default)(videoUrl);
                if (!res.ok)
                    return 'none';
                const content = yield res.text();
                if (content.includes('"isLive":true') || content.includes('"liveBroadcastContent":"live"'))
                    return 'live';
                if (content.includes('"liveBroadcastContent":"upcoming"') || content.includes('"isUpcoming":true'))
                    return 'upcoming';
                if (content.includes('"ended":true'))
                    return 'ended';
                return 'none';
            }
            catch (_a) {
                return 'none';
            }
        });
    }
    /**
     * チャンネルIDから最新動画＋ライブ状態を取得
     */
    getLatestVideoInfo(channelId) {
        return __awaiter(this, void 0, void 0, function* () {
            const videos = yield this.getLatestVideos(channelId);
            if (!videos || videos.length === 0)
                return null;
            const latest = videos[0];
            const status = yield this.getLiveStatus(latest.videoId);
            latest.liveStatus = status;
            return latest;
        });
    }
    /**
     * ページネーション付きで動画リストを取得
     */
    getVideosWithPaging(channelId_1) {
        return __awaiter(this, arguments, void 0, function* (channelId, page = 1, pageSize = 10) {
            const videos = yield this.getLatestVideos(channelId);
            if (!videos)
                return null;
            const total = videos.length;
            const start = (page - 1) * pageSize;
            const end = start + pageSize;
            return {
                videos: videos.slice(start, end),
                page,
                pageSize,
                total,
            };
        });
    }
    /**
     * 動画IDから詳細情報を取得（サムネイルや説明文など＋type, liveStatusも補完）
     */
    getVideoDetail(videoId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            const url = `https://www.youtube.com/watch?v=${videoId}`;
            try {
                const res = yield (0, node_fetch_1.default)(url);
                if (!res.ok)
                    return null;
                const html = yield res.text();
                const title = ((_b = (_a = html.match(/<title>(.*?)<\/title>/)) === null || _a === void 0 ? void 0 : _a[1]) === null || _b === void 0 ? void 0 : _b.replace(' - YouTube', '')) || '';
                const author = ((_c = html.match(/"author":"([^"]+)"/)) === null || _c === void 0 ? void 0 : _c[1]) || '';
                const description = ((_e = (_d = html.match(/"shortDescription":"([^"]+)"/)) === null || _d === void 0 ? void 0 : _d[1]) === null || _e === void 0 ? void 0 : _e.replace(/\\n/g, '\n')) || '';
                const thumbnailMatches = Array.from(html.matchAll(/"thumbnailUrl":"(https:\/\/i\.ytimg\.com[^"]+)"/g));
                const thumbnails = thumbnailMatches.map(m => m[1].replace(/\\\//g, '/'));
                const imageUrl = thumbnails.length > 0 ? thumbnails[0] : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
                // --- Shorts判定強化 ---
                let isShorts = false;
                // 1. URLパターン
                if (url.includes('/shorts/') || /"canonicalUrl":"https:\/\/www.youtube.com\/shorts\//.test(html)) {
                    isShorts = true;
                }
                // 2. HTML内のshortsリンクや構造
                if (!isShorts && /"shortsUrl":"https:\/\/www.youtube.com\/shorts\//.test(html)) {
                    isShorts = true;
                }
                // --- ライブ判定ロジック強化 ---
                let isLiveContent = undefined;
                const isLiveContentMatch = html.match(/"isLiveContent"\s*:\s*(true|false)/);
                if (isLiveContentMatch) {
                    isLiveContent = isLiveContentMatch[1] === 'true';
                }
                if (this.debugMode) {
                    console.log('[DEBUG] isLiveContent:', isLiveContent);
                }
                let liveBroadcastDetails = {};
                const liveBroadcastMatch = html.match(/"liveBroadcastDetails"\s*:\s*\{([^}]*)\}/);
                if (liveBroadcastMatch) {
                    const fragment = `{${liveBroadcastMatch[1]}}`;
                    try {
                        const isLiveNow = (_f = /"isLiveNow"\s*:\s*(true|false)/.exec(fragment)) === null || _f === void 0 ? void 0 : _f[1];
                        const startTimestamp = (_g = /"startTimestamp"\s*:\s*"([^"]+)"/.exec(fragment)) === null || _g === void 0 ? void 0 : _g[1];
                        const endTimestamp = (_h = /"endTimestamp"\s*:\s*"([^"]+)"/.exec(fragment)) === null || _h === void 0 ? void 0 : _h[1];
                        liveBroadcastDetails = {
                            isLiveNow: isLiveNow ? isLiveNow === 'true' : undefined,
                            startTimestamp,
                            endTimestamp,
                        };
                    }
                    catch (_j) { }
                }
                if (this.debugMode) {
                    console.log('[DEBUG] liveBroadcastDetails:', liveBroadcastDetails);
                }
                // type判定: shorts, isLive, liveContents, normal
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
                    liveStatus = YoutubeLiveStatus.Upcoming;
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
            catch (e) {
                if (this.debugMode) {
                    console.error('[DEBUG] getVideoDetail error:', e);
                }
                return null;
            }
        });
    }
    /**
     * チャンネル主の画像URLを取得
     */
    getChannelOwnerImage(channelId) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = `https://www.youtube.com/channel/${channelId}`;
            try {
                const res = yield (0, node_fetch_1.default)(url);
                if (!res.ok)
                    return null;
                const html = yield res.text();
                // og:image
                const m = html.match(/<meta property="og:image" content="([^"]+)"/);
                if (m)
                    return m[1];
                // fallback: ytInitialData JSONから抽出も可
            }
            catch (_a) { }
            return null;
        });
    }
    /**
     * チャンネルIDから最新動画リスト＋詳細情報をまとめて取得
     */
    getLatestVideosWithDetails(channelId, options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const videos = yield this.getLatestVideos(channelId);
            if (!videos)
                return [];
            const concurrency = (_a = options === null || options === void 0 ? void 0 : options.concurrency) !== null && _a !== void 0 ? _a : 3;
            const results = [];
            for (let i = 0; i < videos.length; i += concurrency) {
                const chunk = videos.slice(i, i + concurrency);
                const details = yield Promise.all(chunk.map(v => this.getVideoDetail(v.videoId)));
                for (const d of details) {
                    if (d) {
                        results.push(d);
                        if (this.debugMode) {
                            console.log('[DETAIL]', d.videoId, d.title, d.type, d.liveStatus);
                        }
                    }
                }
            }
            return results;
        });
    }
}
exports.YoutubeRssApi = YoutubeRssApi;
YoutubeRssApi.version = '1.0.0'; // APIバージョン
