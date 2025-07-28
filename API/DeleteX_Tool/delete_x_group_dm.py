# X（旧Twitter）グループDMリクエスト自動削除ツール（Selenium+API版/Bearer自動取得）
# 必要パッケージ: selenium, webdriver_manager, requests
# 使い方:
# 1. ChromeでXにログイン（手動ログイン）
# 2. DMリクエストページで1件だけ手動で「会話から退出」操作を行う
# 3. Bearerトークンが自動取得されたら、以降APIで自動削除

import time
import random
import tempfile
import requests
import re
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# DMリクエストページへ移動
def go_to_dm_requests(driver):
    driver.get('https://x.com/messages/requests/additional')
    time.sleep(5)

# Seleniumで会話IDを抽出（リクエストタブ専用）
def get_conversation_ids(driver):
    # 「/messages/リクエスト」ページ専用: /messages/<数字>/participants 形式のhrefのみ抽出
    elems = driver.find_elements(By.XPATH, "//a[starts-with(@href, '/messages/') and contains(@href, '/participants')]")
    ids = set()
    for elem in elems:
        href = elem.get_attribute('href')
        if href:
            m = re.match(r'/messages/(\d+)/participants$', href)
            if m:
                ids.add(m.group(1))
    return list(ids)

# Seleniumでcookie/ct0取得
def get_auth_info(driver):
    cookies = driver.get_cookies()
    cookie_dict = {c['name']: c['value'] for c in cookies}
    cookie_str = '; '.join([f"{c['name']}={c['value']}" for c in cookies])
    csrf_token = cookie_dict.get('ct0', None)
    return cookie_str, csrf_token

# CDPでBearerトークンを自動取得
def get_bearer_token(driver):
    token = None
    for entry in driver.get_log('performance'):
        msg = entry['message']
        if 'authorization' in msg and 'Bearer ' in msg:
            m = re.search(r'Bearer ([a-zA-Z0-9%-._~+/=]+)', msg)
            if m:
                token = m.group(1)
                break
    return token

# APIでグループDM退出
# driver引数を追加し、User-Agentを動的取得
# 必要なヘッダーをすべて追加

def leave_group_dm_api(conversation_id, cookie_str, csrf_token, bearer_token, driver):
    url = f"https://x.com/i/api/1.1/dm/conversation/{conversation_id}/delete.json"
    user_agent = driver.execute_script("return navigator.userAgent;")
    headers = {
        "authorization": f"Bearer {bearer_token}",
        "x-csrf-token": csrf_token,
        "cookie": cookie_str,
        "content-type": "application/json",
        "user-agent": user_agent,
        "referer": "https://x.com/messages/requests/additional",
        "x-twitter-auth-type": "OAuth2Session",
        "x-twitter-active-user": "yes",
        "accept": "*/*",
        "accept-language": "ja,en-US;q=0.9,en;q=0.8",
        "origin": "https://x.com",
        "sec-fetch-site": "same-origin",
        "sec-fetch-mode": "cors",
        "sec-fetch-dest": "empty"
    }
    resp = requests.post(url, headers=headers)
    print(f"{conversation_id} 削除レスポンス: {resp.text}")
    return resp

# APIからグループDM会話ID一覧を取得
# driver, cookie_str, csrf_token, bearer_tokenを利用

def get_group_dm_ids_via_api(cookie_str, csrf_token, bearer_token, driver):
    url = "https://x.com/i/api/1.1/dm/inbox_initial_state.json?nsfw_filtering_enabled=false&filter_low_quality=true&include_quality=all&include_profile_interstitial_type=1&include_blocking=1&include_blocked_by=1&include_followed_by=1&include_want_retweets=1&include_mute_edge=1&include_can_dm=1&include_can_media_tag=1&include_ext_is_blue_verified=1&include_ext_verified_type=1&include_ext_profile_image_shape=1&skip_status=1&dm_secret_conversations_enabled=false&krs_registration_enabled=false&cards_platform=Web-12&include_cards=1&include_ext_alt_text=true&include_ext_limited_action_results=true&include_quote_count=true&include_reply_count=1&tweet_mode=extended&include_ext_views=true&dm_users=true&include_groups=true&include_inbox_timelines=true&include_ext_media_color=true&supports_reactions=true&supports_edit=true&include_ext_edit_control=true&include_ext_business_affiliations_label=true&include_ext_parody_commentary_fan_label=true&ext=mediaColor,altText,mediaStats,highlightedLabel,parodyCommentaryFanLabel,voiceInfo,birdwatchPivot,superFollowMetadata,unmentionInfo,editControl,article"
    user_agent = driver.execute_script("return navigator.userAgent;")
    headers = {
        "authorization": f"Bearer {bearer_token}",
        "x-csrf-token": csrf_token,
        "cookie": cookie_str,
        "user-agent": user_agent,
        "accept": "application/json, text/plain, */*",
        "referer": "https://x.com/messages/requests/additional",
        "x-twitter-auth-type": "OAuth2Session",
        "x-twitter-active-user": "yes",
        "accept-language": "ja,en-US;q=0.9,en;q=0.8",
        "origin": "https://x.com",
        "sec-fetch-site": "same-origin",
        "sec-fetch-mode": "cors",
        "sec-fetch-dest": "empty"
    }
    resp = requests.get(url, headers=headers)
    if resp.status_code != 200:
        print(f"DMリストAPI取得失敗: {resp.status_code} {resp.text}")
        return []
    try:
        data = resp.json()
        ids = []
        # inboxTimelines > entries > messageConversation > conversationType == 'Group'
        timelines = data.get('inboxTimelines', {})
        for timeline in timelines.values():
            for entry in timeline.get('entries', []):
                conv = entry.get('messageConversation', {})
                if conv.get('conversationType') == 'Group':
                    ids.append(conv.get('conversationId'))
        return ids
    except Exception as e:
        print(f"DMリストJSON解析エラー: {e}")
        return []

def main():
    import os
    options = webdriver.ChromeOptions()
    tmp_profile = tempfile.mkdtemp()
    options.add_argument(f'--user-data-dir={tmp_profile}')
    options.add_argument('--profile-directory=Default')
    options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')
    options.add_argument('--disable-blink-features=AutomationControlled')
    options.add_argument('--log-level=3')  # エラーレベルのみ
    options.add_argument('--disable-logging')
    # performanceログ有効化
    options.set_capability('goog:loggingPrefs', {'performance': 'ALL'})
    driver = None
    try:
        # ChromeDriverのログも捨てる
        driver = webdriver.Chrome(
            service=Service(ChromeDriverManager().install(), log_path=os.devnull),
            options=options
        )
        driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
            "source": """
                Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
            """
        })
        driver.switch_to.window(driver.window_handles[0])
        driver.get('https://x.com/')
        print('''\nChromeが起動しました。\n''')
        print('【操作手順】')
        print('1. X（旧Twitter）に手動でログインしてください。')
        print('2. 画面上部の「メッセージ」→「リクエスト」タブに移動してください。')
        print('3. グループDMの「オプション」メニューから「会話から退出」を1件だけ手動で実行してください。')
        print('   （この操作で認証トークンが取得できます）')
        input('上記の手動操作が完了したらEnterを押してください...')
        # Bearerトークン自動取得
        bearer_token = get_bearer_token(driver)
        if not bearer_token:
            print('\n【エラー】Bearerトークンが取得できませんでした。')
            print('手動操作が正しく行われたか、またはNetworkタブから取得できるかご確認ください。')
            return
        print(f'\n【成功】Bearerトークンを取得しました。自動処理を開始します。')
        go_to_dm_requests(driver)
        # グループDMリンクが現れるまで最大15秒待機
        try:
            WebDriverWait(driver, 15).until(
                EC.presence_of_element_located((By.XPATH, "//a[starts-with(@href, '/messages/') and contains(@href, '/participants')]"))
            )
        except Exception:
            print('グループDMリンクの出現を待ちましたが見つかりません。追加で5秒待機します。')
            time.sleep(5)
        # 取得リトライ
        conversation_ids = get_conversation_ids(driver)
        if not conversation_ids:
            print('再度5秒待機してリトライします...')
            time.sleep(5)
            conversation_ids = get_conversation_ids(driver)
        print(f"取得した会話ID: {conversation_ids}")
        if not conversation_ids:
            print('グループDMが見つかりませんでした。')
            return
        # cookie/ct0取得
        cookie_str, csrf_token = get_auth_info(driver)
        # APIからグループDM会話IDを取得
        conversation_ids = get_group_dm_ids_via_api(cookie_str, csrf_token, bearer_token, driver)
        print(f"APIから取得したグループDM会話ID: {conversation_ids}")
        if not conversation_ids:
            print('グループDMが見つかりませんでした。')
            return
        for cid in conversation_ids:
            leave_group_dm_api(cid, cookie_str, csrf_token, bearer_token, driver)
            time.sleep(3)  # レート制限対策（3秒間隔）
        print('全てのグループDMを退出しました。')
    except Exception as e:
        print('Chrome起動エラー:', e)
        print('Chromeの全ウィンドウを閉じてから再度実行してください。')
        print('プロファイルパスやプロファイル名が正しいかもご確認ください。')
    finally:
        if driver:
            driver.quit()

if __name__ == '__main__':
    main()
