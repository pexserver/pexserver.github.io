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

export enum YoutubeLiveStatus {
  None = 'none',
  Upcoming = 'upcoming',
  Live = 'live',
  Ended = 'ended',
}

export enum YoutubeVideoType {
  Normal = 'normal',
  Shorts = 'shorts',
  LiveContents = 'liveContents',
  IsLive = 'isLive',
  Unknown = 'unknown',
}

export interface YoutubeVideoInfo {
  videoId: string;
  title: string;
  author: string;
  published: string;
  url: string;
  liveStatus?: YoutubeLiveStatus;
  type?: YoutubeVideoType;
}

export interface YoutubeVideoDetail extends YoutubeVideoInfo {
  description?: string;
  thumbnails?: string[];
  imageUrl?: string;
}

function proxiedFetch(url: string, ...args: any[]) {
  const proxiedUrl = `https://thingproxy.freeboard.io/fetch/${encodeURIComponent(url)}`;
  return fetch(proxiedUrl, ...args);
}

function getDirectChildText(entry: Element, tag: string): string {
  for (const node of Array.from(entry.childNodes)) {
    if (node.nodeType === 1 && (node as Element).tagName === tag) {
      const text = (node as Element).textContent || '';
      if ((window as any).debugMode) console.log(`[DEBUG] getDirectChildText(${tag}):`, text);
      return text;
    }
  }
  return '';
}

function parseYoutubeRssEntry(entry: Element): YoutubeVideoInfo {
  // videoId取得（yt:videoId, videoId両対応）
  const videoId = entry.getElementsByTagName('yt:videoId')[0]?.textContent
    || entry.getElementsByTagName('videoId')[0]?.textContent
    || '';
  const title = getDirectChildText(entry, 'title');
  const author = entry.getElementsByTagName('author')[0]?.getElementsByTagName('name')[0]?.textContent || '';
  const published = getDirectChildText(entry, 'published');
  const linkElem = Array.from(entry.childNodes).find(
    n => n.nodeType === 1 && (n as Element).tagName === 'link'
  ) as Element | undefined;
  const url = linkElem?.getAttribute('href') || '';
  // type判定（現状通り）
  let type = YoutubeVideoType.Unknown;
  if (url.includes('/shorts/')) {
    type = YoutubeVideoType.Shorts;
  } else {
    // media:groupのdescriptionやtitleも参照
    const mediaGroup = entry.getElementsByTagName('media:group')[0] || entry.getElementsByTagName('group')[0];
    const mediaTitle = mediaGroup?.getElementsByTagName('media:title')[0]?.textContent
      || mediaGroup?.getElementsByTagName('title')[0]?.textContent || '';
    const mediaDescription = mediaGroup?.getElementsByTagName('media:description')[0]?.textContent
      || mediaGroup?.getElementsByTagName('description')[0]?.textContent || '';
    if (/ライブ|配信|生放送|live/i.test(title) || /ライブ|配信|生放送|live/i.test(mediaTitle) || /ライブ|配信|生放送|live/i.test(mediaDescription)) {
      type = YoutubeVideoType.LiveContents;
    } else {
      type = YoutubeVideoType.Normal;
    }
  }
  if ((window as any).debugMode) {
    console.log('[DEBUG] parseYoutubeRssEntry', { videoId, title, author, published, url, type });
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

export class YoutubeRssApi {
  static readonly version = '1.0.0';
  public debugMode: boolean;

  constructor(debugMode: boolean = false) {
    this.debugMode = debugMode;
  }

  async extractChannelId(url: string): Promise<string | null> {
    const patterns = [
      /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/,
      /youtube\.com\/c\/([a-zA-Z0-9_-]+)/,
      /youtube\.com\/user\/([a-zA-Z0-9_-]+)/,
      /youtube\.com\/@([a-zA-Z0-9_-]+)/,
    ];
    for (const pattern of patterns) {
      const m = url.match(pattern);
      if (m) {
        if (m[1].startsWith('UC')) return m[1];
        return await this.extractChannelIdFromHtml(url);
      }
    }
    return null;
  }

  async extractChannelIdFromHtml(url: string): Promise<string | null> {
    try {
      const res = await proxiedFetch(url);
      if (!res.ok) return null;
      const html = await res.text();
      const m1 = html.match(/"channelId":"(UC[^"]+)"/);
      if (m1) return m1[1];
      const m2 = html.match(/<meta property="og:url" content="https:\/\/www.youtube.com\/channel\/(UC[^"]+)">/);
      if (m2) return m2[1];
    } catch {}
    return null;
  }

  async getChannelName(channelId: string): Promise<string | null> {
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    try {
      const res = await proxiedFetch(feedUrl);
      if (!res.ok) return null;
      const xml = await res.text();
      const doc = new DOMParser().parseFromString(xml, 'application/xml');
      const title = doc.querySelector('feed > title');
      return title ? title.textContent : null;
    } catch {
      return null;
    }
  }

  async getLatestVideos(channelId: string): Promise<YoutubeVideoInfo[] | null> {
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    try {
      const res = await proxiedFetch(feedUrl);
      if (!res.ok) return null;
      const xml = await res.text();
      const doc = new DOMParser().parseFromString(xml, 'application/xml');
      const entries = Array.from(doc.querySelectorAll('entry'));
      // index.ts同等のtype判定を行う独自関数で解析
      return entries.map(entry => parseYoutubeRssEntry(entry));
    } catch {
      return null;
    }
  }

  async getLiveStatus(videoId: string): Promise<YoutubeLiveStatus> {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    try {
      const res = await proxiedFetch(videoUrl);
      if (!res.ok) return YoutubeLiveStatus.None;
      const html = await res.text();
      if (html.includes('"isLive":true') || html.includes('"liveBroadcastContent":"live"')) return YoutubeLiveStatus.Live;
      if (html.includes('"liveBroadcastContent":"upcoming"') || html.includes('"isUpcoming":true')) return YoutubeLiveStatus.Upcoming;
      if (html.includes('"ended":true')) return YoutubeLiveStatus.Ended;
      return YoutubeLiveStatus.None;
    } catch {
      return YoutubeLiveStatus.None;
    }
  }

  async getVideoDetail(videoId: string): Promise<YoutubeVideoDetail | null> {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    try {
      const res = await proxiedFetch(url);
      if (!res.ok) return null;
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
      let isLiveContent: boolean | undefined = undefined;
      const isLiveContentMatch = html.match(/"isLiveContent"\s*:\s*(true|false)/);
      if (isLiveContentMatch) {
        isLiveContent = isLiveContentMatch[1] === 'true';
      }
      let liveBroadcastDetails: { isLiveNow?: boolean; startTimestamp?: string; endTimestamp?: string } = {};
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
        } catch {}
      }
      // type判定
      let type = YoutubeVideoType.Unknown;
      if (isShorts) {
        type = YoutubeVideoType.Shorts;
      } else if (isLiveContent === true) {
        if (liveBroadcastDetails.isLiveNow === true) {
          type = YoutubeVideoType.IsLive;
        } else {
          type = YoutubeVideoType.LiveContents;
        }
      } else if (isLiveContent === false) {
        type = YoutubeVideoType.Normal;
      } else if (liveBroadcastMatch) {
        if (liveBroadcastDetails.isLiveNow === true) {
          type = YoutubeVideoType.IsLive;
        } else {
          type = YoutubeVideoType.LiveContents;
        }
      } else {
        if ((title && /ライブ|配信|生放送|live/i.test(title)) || (description && /ライブ|配信|生放送|live/i.test(description))) {
          type = YoutubeVideoType.LiveContents;
        } else {
          type = YoutubeVideoType.Normal;
        }
      }
      let liveStatus: YoutubeLiveStatus | undefined = undefined;
      if (liveBroadcastDetails.isLiveNow === true) {
        liveStatus = YoutubeLiveStatus.Live;
      } else if (liveBroadcastDetails.isLiveNow === false) {
        if (liveBroadcastDetails.endTimestamp) {
          liveStatus = YoutubeLiveStatus.Ended;
        } else {
          liveStatus = YoutubeLiveStatus.Upcoming;
        }
      } else if (type === YoutubeVideoType.LiveContents) {
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
    } catch {
      return null;
    }
  }

  async getChannelOwnerImage(channelId: string): Promise<string | null> {
    const url = `https://www.youtube.com/channel/${channelId}`;
    try {
      const res = await proxiedFetch(url);
      if (!res.ok) return null;
      const html = await res.text();
      const m = html.match(/<meta property="og:image" content="([^"]+)"/);
      if (m) return m[1];
    } catch {}
    return null;
  }

  async getLatestVideosWithDetails(channelId: string, options?: { concurrency?: number }): Promise<YoutubeVideoDetail[]> {
    const videos = await this.getLatestVideos(channelId);
    if (!videos) return [];
    const concurrency = options?.concurrency ?? 3;
    const results: YoutubeVideoDetail[] = [];
    for (let i = 0; i < videos.length; i += concurrency) {
      const chunk = videos.slice(i, i + concurrency);
      const details = await Promise.all(chunk.map(v => this.getVideoDetail(v.videoId)));
      for (const d of details) {
        if (d) results.push(d);
      }
    }
    return results;
  }
}
