"use strict";
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
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.YoutubeRssApi = exports.YoutubeVideoType = exports.YoutubeLiveStatus = void 0;
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
function proxiedFetch(url) {
    var _this = this;
    var args = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        args[_i - 1] = arguments[_i];
    }
    // Google Apps Scriptプロキシ（メイン）
    var proxiedUrl = "https://script.google.com/macros/s/AKfycbzX-Cl7PlS23kE8SeUp2Ya3CwV-VS_-XyDOoj4vpIT38nolAb_8OXV-HD7NpThb3d1P0g/exec?url=".concat(encodeURIComponent(url));
    if (window.debugMode) {
        console.log('[DEBUG] Using proxy for URL:', url);
        console.log('[DEBUG] Proxied URL:', proxiedUrl);
    }
    return fetch(proxiedUrl, __assign({ method: 'GET', cache: 'no-cache' }, args)).then(function (response) { return __awaiter(_this, void 0, void 0, function () {
        var text, liveKeywords;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!response.ok) {
                        throw new Error("HTTP ".concat(response.status, ": ").concat(response.statusText));
                    }
                    return [4 /*yield*/, response.text()];
                case 1:
                    text = _a.sent();
                    if (window.debugMode) {
                        console.log("[DEBUG] Proxy response for ".concat(url, " - length:"), text.length);
                        // YouTubeページでライブ関連キーワードの存在をチェック
                        if (url.includes('youtube.com/watch')) {
                            liveKeywords = [
                                'isLiveContent',
                                'liveBroadcastDetails',
                                'isLiveNow',
                                'liveBroadcastContent',
                                '"style":"LIVE"',
                                '"iconType":"LIVE"',
                                '人が視聴中',
                                'ライブ配信開始'
                            ];
                            liveKeywords.forEach(function (keyword) {
                                var found = text.includes(keyword);
                                console.log("[DEBUG] Proxy response contains \"".concat(keyword, "\":"), found);
                            });
                        }
                    }
                    return [2 /*return*/, {
                            ok: true,
                            text: function () { return Promise.resolve(text); },
                            json: function () { return Promise.resolve(JSON.parse(text)); }
                        }];
            }
        });
    }); }).catch(function (error) { return __awaiter(_this, void 0, void 0, function () {
        var fallbackUrl1, fallbackRes1, data_1, fallbackError1_1, fallbackUrl2, fallbackRes2, text_1, fallbackError2_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (window.debugMode) {
                        console.log('[DEBUG] Primary proxy failed, trying fallback...', error);
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 5, , 6]);
                    fallbackUrl1 = "https://api.allorigins.win/get?url=".concat(encodeURIComponent(url));
                    return [4 /*yield*/, fetch.apply(void 0, __spreadArray([fallbackUrl1], args, false))];
                case 2:
                    fallbackRes1 = _a.sent();
                    if (!fallbackRes1.ok) return [3 /*break*/, 4];
                    return [4 /*yield*/, fallbackRes1.json()];
                case 3:
                    data_1 = _a.sent();
                    return [2 /*return*/, {
                            ok: true,
                            text: function () { return Promise.resolve(data_1.contents); },
                            json: function () { return Promise.resolve(JSON.parse(data_1.contents)); }
                        }];
                case 4: return [3 /*break*/, 6];
                case 5:
                    fallbackError1_1 = _a.sent();
                    if (window.debugMode) {
                        console.log('[DEBUG] Fallback 1 failed:', fallbackError1_1);
                    }
                    return [3 /*break*/, 6];
                case 6:
                    _a.trys.push([6, 10, , 11]);
                    fallbackUrl2 = "https://corsproxy.io/?".concat(encodeURIComponent(url));
                    return [4 /*yield*/, fetch.apply(void 0, __spreadArray([fallbackUrl2], args, false))];
                case 7:
                    fallbackRes2 = _a.sent();
                    if (!fallbackRes2.ok) return [3 /*break*/, 9];
                    return [4 /*yield*/, fallbackRes2.text()];
                case 8:
                    text_1 = _a.sent();
                    return [2 /*return*/, {
                            ok: true,
                            text: function () { return Promise.resolve(text_1); },
                            json: function () { return Promise.resolve(JSON.parse(text_1)); }
                        }];
                case 9: return [3 /*break*/, 11];
                case 10:
                    fallbackError2_1 = _a.sent();
                    if (window.debugMode) {
                        console.log('[DEBUG] Fallback 2 failed:', fallbackError2_1);
                    }
                    return [3 /*break*/, 11];
                case 11: throw error;
            }
        });
    }); });
}
function getDirectChildText(entry, tag) {
    for (var _i = 0, _a = Array.from(entry.childNodes); _i < _a.length; _i++) {
        var node = _a[_i];
        if (node.nodeType === 1 && node.tagName === tag) {
            var text = node.textContent || '';
            if (window.debugMode)
                console.log("[DEBUG] getDirectChildText(".concat(tag, "):"), text);
            return text;
        }
    }
    return '';
}
// 名前空間対応の直下テキスト取得
function getDirectChildTextNS(entry, ns, tag) {
    for (var _i = 0, _a = Array.from(entry.childNodes); _i < _a.length; _i++) {
        var node = _a[_i];
        if (node.nodeType === 1 && node.localName === tag && node.namespaceURI === ns) {
            var text = node.textContent || '';
            if (window.debugMode)
                console.log("[DEBUG] getDirectChildTextNS(".concat(tag, "):"), text);
            return text;
        }
    }
    return '';
}
function parseYoutubeRssEntry(entry) {
    var _a, _b, _c, _d, _e;
    // title: entry直下の<title>
    var title = '';
    for (var _i = 0, _f = Array.from(entry.childNodes); _i < _f.length; _i++) {
        var node = _f[_i];
        if (node.nodeType === 1 && node.tagName === 'title') {
            title = ((_a = node.textContent) === null || _a === void 0 ? void 0 : _a.trim()) || '';
            break;
        }
    }
    // author: entry直下の<author><name>
    var author = '';
    for (var _g = 0, _h = Array.from(entry.childNodes); _g < _h.length; _g++) {
        var node = _h[_g];
        if (node.nodeType === 1 && node.tagName === 'author') {
            for (var _j = 0, _k = Array.from(node.childNodes); _j < _k.length; _j++) {
                var n2 = _k[_j];
                if (n2.nodeType === 1 && n2.tagName === 'name') {
                    author = ((_b = n2.textContent) === null || _b === void 0 ? void 0 : _b.trim()) || '';
                    break;
                }
            }
            break;
        }
    }
    // published: entry直下の<published>
    var published = '';
    for (var _l = 0, _m = Array.from(entry.childNodes); _l < _m.length; _l++) {
        var node = _m[_l];
        if (node.nodeType === 1 && node.tagName === 'published') {
            published = ((_c = node.textContent) === null || _c === void 0 ? void 0 : _c.trim()) || '';
            break;
        }
    }
    // videoId: <yt:videoId>
    var videoId = '';
    var videoIdElem = entry.getElementsByTagName('yt:videoId')[0];
    if (videoIdElem) {
        videoId = ((_d = videoIdElem.textContent) === null || _d === void 0 ? void 0 : _d.trim()) || '';
    }
    else {
        // フォールバック: <id>からyt:video:を除去
        var idElem = entry.getElementsByTagName('id')[0];
        if (idElem) {
            var idText = ((_e = idElem.textContent) === null || _e === void 0 ? void 0 : _e.trim()) || '';
            if (idText.startsWith('yt:video:')) {
                videoId = idText.replace('yt:video:', '');
            }
            else {
                videoId = idText;
            }
        }
    }
    // url: entry直下の<link rel="alternate" href="...">
    var url = '';
    for (var _o = 0, _p = Array.from(entry.childNodes); _o < _p.length; _o++) {
        var node = _p[_o];
        if (node.nodeType === 1 && node.tagName === 'link') {
            var rel = node.getAttribute('rel');
            if (rel === 'alternate') {
                url = node.getAttribute('href') || '';
                break;
            }
        }
    }
    // type: urlに'/shorts/'が含まれていればShorts、そうでなければNormal
    var type = YoutubeVideoType.Unknown;
    if (url.includes('/shorts/'))
        type = YoutubeVideoType.Shorts;
    else
        type = YoutubeVideoType.Normal;
    if (window.debugMode) {
        console.log('[DEBUG] parseYoutubeRssEntry(index.ts compatible)', { videoId: videoId, title: title, author: author, published: published, url: url, type: type });
    }
    return {
        videoId: videoId,
        title: title,
        author: author,
        published: published,
        url: url,
        type: type,
    };
}
// --- WebPaserクラスを統合 ---
var WebPaser = /** @class */ (function () {
    function WebPaser(xmlOrHtml, type) {
        if (type === void 0) { type = 'xml'; }
        if (window.debugMode)
            console.log('[WebPaser] parse start', { type: type, xmlOrHtml: xmlOrHtml });
        this.doc = new DOMParser().parseFromString(xmlOrHtml, type === 'xml' ? 'application/xml' : 'text/html');
        if (window.debugMode)
            console.log('[WebPaser] parse done', this.doc);
    }
    WebPaser.prototype.getFirstElement = function (tag) {
        var elem = this.doc.getElementsByTagName(tag)[0] || null;
        if (window.debugMode)
            console.log("[WebPaser] getFirstElement(".concat(tag, "):"), elem);
        return elem;
    };
    WebPaser.prototype.getAllElements = function (tag) {
        var elems = Array.from(this.doc.getElementsByTagName(tag));
        if (window.debugMode)
            console.log("[WebPaser] getAllElements(".concat(tag, "):"), elems);
        return elems;
    };
    WebPaser.getDirectText = function (elem) {
        var text = (elem.textContent || '').trim();
        if (window.debugMode)
            console.log('[WebPaser] getDirectText:', text, elem);
        return text;
    };
    WebPaser.getAttr = function (elem, attr) {
        var val = elem.getAttribute(attr);
        if (window.debugMode)
            console.log("[WebPaser] getAttr(".concat(attr, "):"), val, elem);
        return val;
    };
    WebPaser.prototype.getRootElement = function () {
        if (window.debugMode)
            console.log('[WebPaser] getRootElement:', this.doc.documentElement);
        return this.doc.documentElement;
    };
    return WebPaser;
}());
var YoutubeRssApi = /** @class */ (function () {
    function YoutubeRssApi(debugMode) {
        if (debugMode === void 0) { debugMode = false; }
        this.debugMode = debugMode;
    }
    YoutubeRssApi.prototype.extractChannelId = function (url) {
        return __awaiter(this, void 0, void 0, function () {
            var patterns, _i, patterns_1, pattern, m;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        patterns = [
                            /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/,
                            /youtube\.com\/c\/([a-zA-Z0-9_-]+)/,
                            /youtube\.com\/user\/([a-zA-Z0-9_-]+)/,
                            /youtube\.com\/@([a-zA-Z0-9_-]+)/,
                        ];
                        _i = 0, patterns_1 = patterns;
                        _a.label = 1;
                    case 1:
                        if (!(_i < patterns_1.length)) return [3 /*break*/, 4];
                        pattern = patterns_1[_i];
                        m = url.match(pattern);
                        if (!m) return [3 /*break*/, 3];
                        if (m[1].startsWith('UC'))
                            return [2 /*return*/, m[1]];
                        return [4 /*yield*/, this.extractChannelIdFromHtml(url)];
                    case 2: return [2 /*return*/, _a.sent()];
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/, null];
                }
            });
        });
    };
    YoutubeRssApi.prototype.extractChannelIdFromHtml = function (url) {
        return __awaiter(this, void 0, void 0, function () {
            var res, html, m1, m2, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, proxiedFetch(url)];
                    case 1:
                        res = _b.sent();
                        if (!res.ok)
                            return [2 /*return*/, null];
                        return [4 /*yield*/, res.text()];
                    case 2:
                        html = _b.sent();
                        m1 = html.match(/"channelId":"(UC[^"]+)"/);
                        if (m1)
                            return [2 /*return*/, m1[1]];
                        m2 = html.match(/<meta property="og:url" content="https:\/\/www.youtube.com\/channel\/(UC[^"]+)">/);
                        if (m2)
                            return [2 /*return*/, m2[1]];
                        return [3 /*break*/, 4];
                    case 3:
                        _a = _b.sent();
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/, null];
                }
            });
        });
    };
    YoutubeRssApi.prototype.getChannelName = function (channelId) {
        return __awaiter(this, void 0, void 0, function () {
            var feedUrl, res, xml, parser, titleElem, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        feedUrl = "https://www.youtube.com/feeds/videos.xml?channel_id=".concat(channelId);
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, proxiedFetch(feedUrl)];
                    case 2:
                        res = _b.sent();
                        if (!res.ok)
                            return [2 /*return*/, null];
                        return [4 /*yield*/, res.text()];
                    case 3:
                        xml = _b.sent();
                        parser = new WebPaser(xml, 'xml');
                        titleElem = parser.getFirstElement('title');
                        return [2 /*return*/, titleElem ? WebPaser.getDirectText(titleElem) : null];
                    case 4:
                        _a = _b.sent();
                        return [2 /*return*/, null];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    YoutubeRssApi.prototype.getLatestVideos = function (channelId) {
        return __awaiter(this, void 0, void 0, function () {
            var feedUrl, res, xml, parser, entryElems, videos, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        feedUrl = "https://www.youtube.com/feeds/videos.xml?channel_id=".concat(channelId);
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, proxiedFetch(feedUrl)];
                    case 2:
                        res = _b.sent();
                        if (!res.ok)
                            return [2 /*return*/, null];
                        return [4 /*yield*/, res.text()];
                    case 3:
                        xml = _b.sent();
                        if (window.debugMode)
                            console.log('[DEBUG] RSS xml:', xml);
                        parser = new WebPaser(xml, 'xml');
                        entryElems = parser.getAllElements('entry');
                        videos = entryElems.map(function (entry) { return parseYoutubeRssEntry(entry); });
                        return [2 /*return*/, videos];
                    case 4:
                        _a = _b.sent();
                        return [2 /*return*/, null];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    YoutubeRssApi.prototype.getLiveStatus = function (videoId) {
        return __awaiter(this, void 0, void 0, function () {
            var videoUrl, res, html_1, liveIndicators, upcomingIndicators, endedIndicators, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        videoUrl = "https://www.youtube.com/watch?v=".concat(videoId);
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, proxiedFetch(videoUrl)];
                    case 2:
                        res = _b.sent();
                        if (!res.ok)
                            return [2 /*return*/, YoutubeLiveStatus.None];
                        return [4 /*yield*/, res.text()];
                    case 3:
                        html_1 = _b.sent();
                        liveIndicators = [
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
                        upcomingIndicators = [
                            '"liveBroadcastContent":"upcoming"',
                            '"isUpcoming":true',
                            '配信予定',
                            'ライブ予定',
                            '生放送予定',
                            'プレミア公開',
                            'premiere'
                        ];
                        endedIndicators = [
                            '"ended":true',
                            '"liveBroadcastContent":"none"',
                            '配信済み',
                            'に配信済み'
                        ];
                        // ライブ配信中の判定
                        if (liveIndicators.some(function (indicator) { return html_1.includes(indicator); })) {
                            if (this.debugMode) {
                                console.log("[DEBUG] Live status detected for ".concat(videoId));
                            }
                            return [2 /*return*/, YoutubeLiveStatus.Live];
                        }
                        // 配信予定の判定
                        if (upcomingIndicators.some(function (indicator) { return html_1.includes(indicator); })) {
                            if (this.debugMode) {
                                console.log("[DEBUG] Upcoming status detected for ".concat(videoId));
                            }
                            return [2 /*return*/, YoutubeLiveStatus.Upcoming];
                        }
                        // 配信終了の判定
                        if (endedIndicators.some(function (indicator) { return html_1.includes(indicator); })) {
                            if (this.debugMode) {
                                console.log("[DEBUG] Ended status detected for ".concat(videoId));
                            }
                            return [2 /*return*/, YoutubeLiveStatus.Ended];
                        }
                        return [2 /*return*/, YoutubeLiveStatus.None];
                    case 4:
                        _a = _b.sent();
                        return [2 /*return*/, YoutubeLiveStatus.None];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    YoutubeRssApi.prototype.getVideoDetail = function (videoId) {
        return __awaiter(this, void 0, void 0, function () {
            var url, res, html_2, liveKeywords, _i, liveKeywords_1, keyword, found, index, context, title_1, author, description_1, thumbnailMatches, thumbnails, imageUrl, isShorts, isLiveContent, isLiveContentMatch, liveContentPatterns, hasLiveIndicators, liveUIPatterns, hasLiveUI, livePatterns, isLikelyLive, liveBroadcastDetails, liveBroadcastMatch, fragment, isLiveNow, startTimestamp, endTimestamp, type, liveStatus, isCurrentlyLive, _a;
            var _b, _c, _d, _e, _f, _g, _h, _j;
            return __generator(this, function (_k) {
                switch (_k.label) {
                    case 0:
                        url = "https://www.youtube.com/watch?v=".concat(videoId);
                        _k.label = 1;
                    case 1:
                        _k.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, proxiedFetch(url)];
                    case 2:
                        res = _k.sent();
                        if (!res.ok)
                            return [2 /*return*/, null];
                        return [4 /*yield*/, res.text()];
                    case 3:
                        html_2 = _k.sent();
                        if (this.debugMode) {
                            console.log("[DEBUG] getVideoDetail for ".concat(videoId, " - HTML length:"), html_2.length);
                            liveKeywords = [
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
                            for (_i = 0, liveKeywords_1 = liveKeywords; _i < liveKeywords_1.length; _i++) {
                                keyword = liveKeywords_1[_i];
                                found = html_2.includes(keyword);
                                console.log("[DEBUG] HTML contains \"".concat(keyword, "\":"), found);
                                if (found) {
                                    index = html_2.indexOf(keyword);
                                    context = html_2.substring(Math.max(0, index - 50), index + 150);
                                    console.log("[DEBUG] Context for \"".concat(keyword, "\":"), context);
                                }
                            }
                        }
                        title_1 = ((_c = (_b = html_2.match(/<title>(.*?)<\/title>/)) === null || _b === void 0 ? void 0 : _b[1]) === null || _c === void 0 ? void 0 : _c.replace(' - YouTube', '')) || '';
                        author = ((_d = html_2.match(/"author":"([^"]+)"/)) === null || _d === void 0 ? void 0 : _d[1]) || '';
                        description_1 = ((_f = (_e = html_2.match(/"shortDescription":"([^"]+)"/)) === null || _e === void 0 ? void 0 : _e[1]) === null || _f === void 0 ? void 0 : _f.replace(/\\n/g, '\n')) || '';
                        thumbnailMatches = Array.from(html_2.matchAll(/"thumbnailUrl":"(https:\/\/i\.ytimg\.com[^"]+)"/g));
                        thumbnails = thumbnailMatches.map(function (m) { return m[1].replace(/\\\//g, '/'); });
                        imageUrl = thumbnails.length > 0 ? thumbnails[0] : "https://i.ytimg.com/vi/".concat(videoId, "/hqdefault.jpg");
                        isShorts = false;
                        // 1. URLパターン
                        if (url.includes('/shorts/') || /"canonicalUrl":"https:\/\/www.youtube.com\/shorts\//.test(html_2)) {
                            isShorts = true;
                        }
                        // 2. HTML内のshortsリンクや構造
                        if (!isShorts && /"shortsUrl":"https:\/\/www.youtube.com\/shorts\//.test(html_2)) {
                            isShorts = true;
                        }
                        isLiveContent = undefined;
                        isLiveContentMatch = html_2.match(/"isLiveContent"\s*:\s*(true|false)/);
                        if (isLiveContentMatch) {
                            isLiveContent = isLiveContentMatch[1] === 'true';
                        }
                        // プロキシ経由でライブ情報が取得できない場合の代替判定
                        if (isLiveContent === undefined) {
                            liveContentPatterns = [
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
                            hasLiveIndicators = liveContentPatterns.some(function (pattern) { return pattern.test(html_2); });
                            liveUIPatterns = [
                                /人が視聴中/,
                                /ライブ配信開始/,
                                /にライブ配信開始/,
                                /配信済み/,
                                /に配信済み/,
                            ];
                            hasLiveUI = liveUIPatterns.some(function (pattern) { return pattern.test(html_2); });
                            livePatterns = [
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
                            isLikelyLive = livePatterns.some(function (pattern) {
                                return pattern.test(title_1) || pattern.test(description_1);
                            });
                            if (hasLiveIndicators || hasLiveUI || isLikelyLive) {
                                isLiveContent = true;
                                if (this.debugMode) {
                                    console.log('[DEBUG] Live content detected from patterns:', {
                                        hasLiveIndicators: hasLiveIndicators,
                                        hasLiveUI: hasLiveUI,
                                        isLikelyLive: isLikelyLive,
                                        title: title_1,
                                        description: description_1.substring(0, 100)
                                    });
                                }
                            }
                        }
                        if (this.debugMode) {
                            console.log('[DEBUG] isLiveContent:', isLiveContent);
                        }
                        liveBroadcastDetails = {};
                        liveBroadcastMatch = html_2.match(/"liveBroadcastDetails"\s*:\s*\{([^}]*)\}/);
                        if (liveBroadcastMatch) {
                            fragment = "{".concat(liveBroadcastMatch[1], "}");
                            try {
                                isLiveNow = (_g = /"isLiveNow"\s*:\s*(true|false)/.exec(fragment)) === null || _g === void 0 ? void 0 : _g[1];
                                startTimestamp = (_h = /"startTimestamp"\s*:\s*"([^"]+)"/.exec(fragment)) === null || _h === void 0 ? void 0 : _h[1];
                                endTimestamp = (_j = /"endTimestamp"\s*:\s*"([^"]+)"/.exec(fragment)) === null || _j === void 0 ? void 0 : _j[1];
                                liveBroadcastDetails = {
                                    isLiveNow: isLiveNow ? isLiveNow === 'true' : undefined,
                                    startTimestamp: startTimestamp,
                                    endTimestamp: endTimestamp,
                                };
                            }
                            catch (_l) { }
                        }
                        if (this.debugMode) {
                            console.log('[DEBUG] liveBroadcastDetails:', liveBroadcastDetails);
                        }
                        type = YoutubeVideoType.Unknown;
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
                            if ((title_1 && /ライブ|配信|生放送|live/i.test(title_1)) || (description_1 && /ライブ|配信|生放送|live/i.test(description_1))) {
                                type = YoutubeVideoType.LiveContents;
                            }
                            else {
                                type = YoutubeVideoType.Normal;
                            }
                        }
                        if (this.debugMode) {
                            console.log('[DEBUG] type:', type);
                        }
                        liveStatus = undefined;
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
                            isCurrentlyLive = [
                                '"style":"LIVE"',
                                '"iconType":"LIVE"',
                                '人が視聴中',
                                'ライブ配信開始',
                                'にライブ配信開始'
                            ].some(function (pattern) { return html_2.includes(pattern); });
                            if (isCurrentlyLive) {
                                liveStatus = YoutubeLiveStatus.Live;
                            }
                            else if (html_2.includes('"ended":true') ||
                                liveBroadcastDetails.endTimestamp ||
                                html_2.includes('配信済み') ||
                                html_2.includes('に配信済み')) {
                                liveStatus = YoutubeLiveStatus.Ended;
                            }
                            else if (html_2.includes('"isUpcoming":true') ||
                                html_2.includes('"liveBroadcastContent":"upcoming"') ||
                                html_2.includes('配信予定') ||
                                html_2.includes('ライブ予定')) {
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
                        return [2 /*return*/, {
                                videoId: videoId,
                                title: title_1,
                                author: author,
                                published: '',
                                url: url,
                                description: description_1,
                                thumbnails: thumbnails,
                                imageUrl: imageUrl,
                                type: type,
                                liveStatus: liveStatus,
                            }];
                    case 4:
                        _a = _k.sent();
                        return [2 /*return*/, null];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    YoutubeRssApi.prototype.getChannelOwnerImage = function (channelId) {
        return __awaiter(this, void 0, void 0, function () {
            var url, res, html, m, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        url = "https://www.youtube.com/channel/".concat(channelId);
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, proxiedFetch(url)];
                    case 2:
                        res = _b.sent();
                        if (!res.ok)
                            return [2 /*return*/, null];
                        return [4 /*yield*/, res.text()];
                    case 3:
                        html = _b.sent();
                        m = html.match(/<meta property="og:image" content="([^"]+)"/);
                        if (m)
                            return [2 /*return*/, m[1]];
                        return [3 /*break*/, 5];
                    case 4:
                        _a = _b.sent();
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/, null];
                }
            });
        });
    };
    YoutubeRssApi.prototype.getLatestVideosWithDetails = function (channelId, options) {
        return __awaiter(this, void 0, void 0, function () {
            var videos, concurrency, results, i, chunk, details, j, d, rssVideo, finalType, mergedVideo;
            var _this = this;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.getLatestVideos(channelId)];
                    case 1:
                        videos = _b.sent();
                        if (!videos)
                            return [2 /*return*/, []];
                        concurrency = (_a = options === null || options === void 0 ? void 0 : options.concurrency) !== null && _a !== void 0 ? _a : 3;
                        results = [];
                        i = 0;
                        _b.label = 2;
                    case 2:
                        if (!(i < videos.length)) return [3 /*break*/, 5];
                        chunk = videos.slice(i, i + concurrency);
                        return [4 /*yield*/, Promise.all(chunk.map(function (v) { return _this.getVideoDetail(v.videoId); }))];
                    case 3:
                        details = _b.sent();
                        for (j = 0; j < details.length; j++) {
                            d = details[j];
                            if (d) {
                                rssVideo = chunk[j];
                                finalType = d.type;
                                if (rssVideo.type === YoutubeVideoType.Shorts) {
                                    // RSSでShortsと判定された場合は確実にShorts
                                    finalType = YoutubeVideoType.Shorts;
                                }
                                mergedVideo = {
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
                        _b.label = 4;
                    case 4:
                        i += concurrency;
                        return [3 /*break*/, 2];
                    case 5: return [2 /*return*/, results];
                }
            });
        });
    };
    YoutubeRssApi.version = '1.0.0';
    return YoutubeRssApi;
}());
exports.YoutubeRssApi = YoutubeRssApi;
