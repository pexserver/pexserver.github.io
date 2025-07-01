"""
YouTube RSS API Utility テストスクリプト (Python)
TypeScript test.tsと同等の分類・出力・デバッグ例
"""

from index import YoutubeRssApi, YoutubeVideoType

CHANNEL_URL = "https://www.youtube.com/@PEXkoukunn"


def main():
    api = YoutubeRssApi(debug_mode=False)
    channel_id = api.extract_channel_id(CHANNEL_URL)
    print("Channel ID:", channel_id)
    if not channel_id:
        print("チャンネルID抽出失敗")
        return
    print("Channel Name:", api.get_channel_name(channel_id))
    videos = api.get_latest_videos(channel_id)
    if not videos:
        print("動画取得失敗")
        return
    print(f"動画数: {len(videos)}")
    details = api.get_latest_videos_with_details(channel_id)
    # 分類
    shorts = [d for d in details if d.type == YoutubeVideoType.SHORTS]
    normal = [d for d in details if d.type == YoutubeVideoType.NORMAL]
    live = [d for d in details if d.type == YoutubeVideoType.ISLIVE]
    live_contents = [d for d in details if d.type == YoutubeVideoType.LIVECONTENTS]
    print(f"SHORTS: {len(shorts)}")
    print(f"NORMAL: {len(normal)}")
    print(f"LIVE: {len(live)}")
    print(f"LIVE CONTENTS: {len(live_contents)}")
    # サムネイル・owner image
    for d in details:
        print(f"{d.video_id} | {d.title} | {d.type} | {d.live_status} | {d.image_url}")
    owner_img = api.get_channel_owner_image(channel_id)
    print("Owner Image:", owner_img)
    print("API Version:", api.version)


if __name__ == "__main__":
    main()
