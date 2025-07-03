"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const api = new index_1.YoutubeRssApi(true); // debugModeをtrueに
        const channelUrl = 'https://www.youtube.com/channel/UCue_c1nQyNwfZa2cLR4fo7g';
        const channelId = yield api.extractChannelId(channelUrl);
        console.log('ChannelId:', channelId);
        if (!channelId)
            return;
        // チャンネル名取得
        const channelName = yield api.getChannelName(channelId);
        console.log('ChannelName:', channelName);
        // チャンネル主画像取得
        const ownerImage = yield api.getChannelOwnerImage(channelId);
        console.log('OwnerImage:', ownerImage);
        // 最新動画リスト＋詳細情報を一括取得
        const details = yield api.getLatestVideosWithDetails(channelId);
        // details配列を直接分類
        const shorts = details.filter(v => v.type === index_1.YoutubeVideoType.Shorts);
        const normal = details.filter(v => v.type === index_1.YoutubeVideoType.Normal);
        const liveContents = details.filter(v => v.type === index_1.YoutubeVideoType.LiveContents);
        const isLive = details.filter(v => v.type === index_1.YoutubeVideoType.IsLive);
        // imageUrlプロパティを使って出力
        console.log('Shorts:', shorts.map(v => ({ id: v.videoId, title: v.title, type: v.type, liveStatus: v.liveStatus, imageUrl: v.imageUrl })));
        console.log('Normal:', normal.map(v => ({ id: v.videoId, title: v.title, type: v.type, liveStatus: v.liveStatus, imageUrl: v.imageUrl })));
        console.log('LiveContents:', liveContents.map(v => ({ id: v.videoId, title: v.title, type: v.type, liveStatus: v.liveStatus, imageUrl: v.imageUrl })));
        console.log('IsLive:', isLive.map(v => ({ id: v.videoId, title: v.title, type: v.type, liveStatus: v.liveStatus, imageUrl: v.imageUrl })));
        // APIバージョン表示
        console.log('API Version:', index_1.YoutubeRssApi.version);
    });
}
main().catch(console.error);
