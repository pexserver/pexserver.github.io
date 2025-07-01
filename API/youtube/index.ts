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

import Parser from 'rss-parser';
import fetch from 'node-fetch';

export enum YoutubeLiveStatus {
  None = 'none',
  Upcoming = 'upcoming',
  Live = 'live',
  Ended = 'ended',
}

export enum YoutubeVideoType {
  Normal = 'normal',
  Shorts = 'shorts',
  LiveContents = 'liveContents', // ライブアーカイブや配信予定
  IsLive = 'isLive', // 配信中
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
  imageUrl?: string; // サムネイルURL（常に取得可能）
  // 必要に応じて拡張
}

export interface YoutubeVideoListResult {
  videos: YoutubeVideoInfo[];
  page: number;
  pageSize: number;
  total: number;
}

// YouTube RSSフィード（Atom+Media+yt拡張）型定義
export interface YoutubeRssFeed {
  id: string;
  title: string;
  link: { rel: string; href: string }[];
  author: { name: string; uri: string };
  published: string;
  updated?: string;
  entries: YoutubeRssEntry[];
  channelId: string;
}

export interface YoutubeRssEntry {
  id: string;
  videoId: string;
  channelId: string;
  title: string;
  link: { rel: string; href: string };
  author: { name: string; uri: string };
  published: string;
  updated?: string;
  media: YoutubeRssMediaGroup;
}

export interface YoutubeRssMediaGroup {
  title: string;
  content: { url: string; type: string; width: number; height: number };
  thumbnail: { url: string; width: number; height: number };
  description: string;
  community: {
    starRating: { count: number; average: number; min: number; max: number };
    statistics: { views: number };
  };
}

export class YoutubeRssApi {
  static readonly version = '1.0.0'; // APIバージョン
  private parser: Parser;
  public debugMode: boolean;

  constructor(debugMode: boolean = false) {
    this.parser = new Parser();
    this.debugMode = debugMode;
  }

  /**
   * YouTubeチャンネルURLからチャンネルID（UC...）を抽出
   */
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
        // UCでなければHTMLから取得
        return await this.extractChannelIdFromHtml(url);
      }
    }
    return null;
  }

  /**
   * HTMLページからチャンネルIDを抽出
   */
  async extractChannelIdFromHtml(url: string): Promise<string | null> {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const html = await res.text();
      const m1 = html.match(/"channelId":"(UC[^"]+)"/);
      if (m1) return m1[1];
      const m2 = html.match(/<meta property="og:url" content="https:\/\/www.youtube.com\/channel\/(UC[^"]+)">/);
      if (m2) return m2[1];
    } catch {
      // ignore
    }
    return null;
  }

  /**
   * チャンネルIDからチャンネル名を取得
   */
  async getChannelName(channelId: string): Promise<string | null> {
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    try {
      const feed = await this.parser.parseURL(feedUrl);
      return feed.title || null;
    } catch {
      return null;
    }
  }

  /**
   * チャンネルIDから最新動画リストを取得
   */
  async getLatestVideos(channelId: string): Promise<YoutubeVideoInfo[] | null> {
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    try {
      const feed = await this.parser.parseURL(feedUrl);
      return (feed.items || []).map(item => {
        const videoId = item.id?.replace('yt:video:', '') || '';
        const url = item.link || '';
        let type = YoutubeVideoType.Unknown;
        if (url.includes('/shorts/')) type = YoutubeVideoType.Shorts;
        else type = YoutubeVideoType.Normal;
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
    } catch {
      return null;
    }
  }

  /**
   * 動画IDからライブ状態を取得（none, upcoming, live, ended）
   */
  async getLiveStatus(videoId: string): Promise<'none' | 'upcoming' | 'live' | 'ended'> {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    try {
      const res = await fetch(videoUrl);
      if (!res.ok) return 'none';
      const content = await res.text();
      if (content.includes('"isLive":true') || content.includes('"liveBroadcastContent":"live"')) return 'live';
      if (content.includes('"liveBroadcastContent":"upcoming"') || content.includes('"isUpcoming":true')) return 'upcoming';
      if (content.includes('"ended":true')) return 'ended';
      return 'none';
    } catch {
      return 'none';
    }
  }

  /**
   * チャンネルIDから最新動画＋ライブ状態を取得
   */
  async getLatestVideoInfo(channelId: string): Promise<YoutubeVideoInfo | null> {
    const videos = await this.getLatestVideos(channelId);
    if (!videos || videos.length === 0) return null;
    const latest = videos[0];
    const status = await this.getLiveStatus(latest.videoId);
    latest.liveStatus = status as YoutubeLiveStatus;
    return latest;
  }

  /**
   * ページネーション付きで動画リストを取得
   */
  async getVideosWithPaging(channelId: string, page: number = 1, pageSize: number = 10): Promise<YoutubeVideoListResult | null> {
    const videos = await this.getLatestVideos(channelId);
    if (!videos) return null;
    const total = videos.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return {
      videos: videos.slice(start, end),
      page,
      pageSize,
      total,
    };
  }

  /**
   * 動画IDから詳細情報を取得（サムネイルや説明文など＋type, liveStatusも補完）
   */
  async getVideoDetail(videoId: string): Promise<YoutubeVideoDetail | null> {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const html = await res.text();
      const title = html.match(/<title>(.*?)<\/title>/)?.[1]?.replace(' - YouTube', '') || '';
      const author = html.match(/"author":"([^"]+)"/)?.[1] || '';
      const description = html.match(/"shortDescription":"([^"]+)"/)?.[1]?.replace(/\\n/g, '\n') || '';
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
      let isLiveContent: boolean | undefined = undefined;
      const isLiveContentMatch = html.match(/"isLiveContent"\s*:\s*(true|false)/);
      if (isLiveContentMatch) {
        isLiveContent = isLiveContentMatch[1] === 'true';
      }
      if (this.debugMode) {
        console.log('[DEBUG] isLiveContent:', isLiveContent);
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
      if (this.debugMode) {
        console.log('[DEBUG] liveBroadcastDetails:', liveBroadcastDetails);
      }
      // type判定: shorts, isLive, liveContents, normal
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
      if (this.debugMode) {
        console.log('[DEBUG] type:', type);
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
    } catch (e) {
      if (this.debugMode) {
        console.error('[DEBUG] getVideoDetail error:', e);
      }
      return null;
    }
  }

  /**
   * チャンネル主の画像URLを取得
   */
  async getChannelOwnerImage(channelId: string): Promise<string | null> {
    const url = `https://www.youtube.com/channel/${channelId}`;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const html = await res.text();
      // og:image
      const m = html.match(/<meta property="og:image" content="([^"]+)"/);
      if (m) return m[1];
      // fallback: ytInitialData JSONから抽出も可
    } catch {}
    return null;
  }

  /**
   * チャンネルIDから最新動画リスト＋詳細情報をまとめて取得
   */
  async getLatestVideosWithDetails(
    channelId: string,
    options?: { concurrency?: number }
  ): Promise<YoutubeVideoDetail[]> {
    const videos = await this.getLatestVideos(channelId);
    if (!videos) return [];
    const concurrency = options?.concurrency ?? 3;
    const results: YoutubeVideoDetail[] = [];
    for (let i = 0; i < videos.length; i += concurrency) {
      const chunk = videos.slice(i, i + concurrency);
      const details = await Promise.all(chunk.map(v => this.getVideoDetail(v.videoId)));
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
  }
}
