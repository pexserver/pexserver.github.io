import { YoutubeRssApi, YoutubeVideoType } from './index';

async function main() {
  const api = new YoutubeRssApi(false); // debugModeをtrueに
  const channelUrl = 'https://www.youtube.com/channel/UCue_c1nQyNwfZa2cLR4fo7g';
  const channelId = await api.extractChannelId(channelUrl);
  console.log('ChannelId:', channelId);

  if (!channelId) return;

  // チャンネル名取得
  const channelName = await api.getChannelName(channelId);
  console.log('ChannelName:', channelName);

  // チャンネル主画像取得
  const ownerImage = await api.getChannelOwnerImage(channelId);
  console.log('OwnerImage:', ownerImage);

  // 最新動画リスト＋詳細情報を一括取得
  const details = await api.getLatestVideosWithDetails(channelId);

  // details配列を直接分類
  const shorts = details.filter(v => v.type === YoutubeVideoType.Shorts);
  const normal = details.filter(v => v.type === YoutubeVideoType.Normal);
  const liveContents = details.filter(v => v.type === YoutubeVideoType.LiveContents);
  const isLive = details.filter(v => v.type === YoutubeVideoType.IsLive);

  // imageUrlプロパティを使って出力
  console.log('Shorts:', shorts.map(v => ({ id: v.videoId, title: v.title, type: v.type, liveStatus: v.liveStatus, imageUrl: v.imageUrl })));
  console.log('Normal:', normal.map(v => ({ id: v.videoId, title: v.title, type: v.type, liveStatus: v.liveStatus, imageUrl: v.imageUrl })));
  console.log('LiveContents:', liveContents.map(v => ({ id: v.videoId, title: v.title, type: v.type, liveStatus: v.liveStatus, imageUrl: v.imageUrl })));
  console.log('IsLive:', isLive.map(v => ({ id: v.videoId, title: v.title, type: v.type, liveStatus: v.liveStatus, imageUrl: v.imageUrl })));
  
  // APIバージョン表示
  console.log('API Version:', YoutubeRssApi.version);
}

main().catch(console.error);
