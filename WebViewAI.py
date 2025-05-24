"""
BrowserAI_Universal.py - 全Web認識対応ブラウザ操作監視ツール
ページ遷移、リダイレクト、SPA対応でWeb全体を継続監視
ブラウザクローズ自動検出・停止機能付き
コマンドライン引数対応版
"""

import asyncio
import json
import time
import threading
from datetime import datetime
import websockets
import logging
import os
import sys
import argparse
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, WebDriverException
from webdriver_manager.chrome import ChromeDriverManager
import traceback
from urllib.parse import urlparse, urljoin

class UniversalBrowserAI:
    """全Web認識対応ブラウザAI監視クラス"""
    
    def __init__(self, websocket_port: int = 8765):
        self.websocket_port = websocket_port
        self.operation_log = []
        self.console_log = []
        self.navigation_log = []
        self.connected_clients = set()
        self.is_monitoring = False
        self.driver = None
        self.current_url = None
        self.previous_url = None
        self.allowed_domains = set()
        self.monitoring_injected = False
        self.url_check_interval = 0.5  # URL変更チェック間隔（秒）
        self.browser_closed = False  # ブラウザクローズ状態フラグ
        self.auto_stop_enabled = True  # 自動停止機能の有効化
        
        # ログ設定
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)
        self.logger.info("Universal BrowserAI Monitor initialized")

    def add_allowed_domain(self, url: str):
        """監視対象ドメインを追加"""
        parsed = urlparse(url)
        domain = f"{parsed.scheme}://{parsed.netloc}"
        self.allowed_domains.add(domain)
        self.logger.info(f"Added allowed domain: {domain}")

    def is_url_allowed(self, url: str) -> bool:
        """URLが監視対象かチェック"""
        if not self.allowed_domains:
            return True  # ドメイン制限なしの場合は全て許可
        
        parsed = urlparse(url)
        domain = f"{parsed.scheme}://{parsed.netloc}"
        return domain in self.allowed_domains

    def is_browser_alive(self) -> bool:
        """ブラウザセッションが生きているかチェック"""
        try:
            if not self.driver:
                return False
            
            # 簡単なJavaScriptを実行してセッションをテスト
            self.driver.execute_script("return true;")
            return True
            
        except (WebDriverException, Exception):
            return False

    def setup_chrome_driver(self, headless: bool = False):
        """Chromeドライバーのセットアップ"""
        try:
            chrome_options = Options()
            if headless:
                chrome_options.add_argument("--headless")
            
            # ログレベルを設定してコンソールログを取得
            chrome_options.add_argument("--enable-logging")
            chrome_options.add_argument("--log-level=0")
            chrome_options.add_experimental_option('useAutomationExtension', False)
            chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
            
            # セキュリティ設定を緩和（開発用）
            chrome_options.add_argument("--disable-web-security")
            chrome_options.add_argument("--disable-features=VizDisplayCompositor")
            chrome_options.add_argument("--allow-running-insecure-content")
            
            # ログを有効にする
            chrome_options.set_capability('goog:loggingPrefs', {'browser': 'ALL'})
            
            # WebDriverManagerを使用してChromeDriverを自動取得
            service = Service(ChromeDriverManager().install())
            self.driver = webdriver.Chrome(service=service, options=chrome_options)
            
            self.logger.info("Chrome driver setup completed")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to setup Chrome driver: {e}")
            return False

    def inject_universal_monitoring_script(self):
        """ページにユニバーサルモニタリング用のJavaScriptを注入"""
        script = f"""
        (function() {{
            if (window.universalMonitoringInjected) return;
            window.universalMonitoringInjected = true;
            
            console.log('🔧 Universal Monitoring Script Injected');
            
            const ws = new WebSocket('ws://localhost:{self.websocket_port}');
            
            function sendOperation(operation) {{
                if (ws.readyState === WebSocket.OPEN) {{
                    ws.send(JSON.stringify(operation));
                }}
            }}
            
            // クリックイベント監視
            document.addEventListener('click', function(e) {{
                sendOperation({{
                    type: 'click',
                    timestamp: new Date().toISOString(),
                    element: e.target.tagName,
                    class: e.target.className,
                    id: e.target.id,
                    text: e.target.textContent ? e.target.textContent.substring(0, 100) : '',
                    url: window.location.href,
                    x: e.clientX,
                    y: e.clientY
                }});
            }});
            
            // キーボード入力監視
            document.addEventListener('keydown', function(e) {{
                sendOperation({{
                    type: 'keydown',
                    timestamp: new Date().toISOString(),
                    key: e.key,
                    element: e.target.tagName,
                    url: window.location.href
                }});
            }});
            
            // フォーム送信監視
            document.addEventListener('submit', function(e) {{
                sendOperation({{
                    type: 'form_submit',
                    timestamp: new Date().toISOString(),
                    form_action: e.target.action,
                    form_method: e.target.method,
                    url: window.location.href
                }});
            }});
            
            // ページ遷移監視（pushState/replaceState対応）
            const originalPushState = history.pushState;
            const originalReplaceState = history.replaceState;
            
            history.pushState = function() {{
                originalPushState.apply(history, arguments);
                setTimeout(() => {{
                    sendOperation({{
                        type: 'navigation',
                        timestamp: new Date().toISOString(),
                        from: document.referrer,
                        to: window.location.href,
                        method: 'pushState'
                    }});
                }}, 100);
            }};
            
            history.replaceState = function() {{
                originalReplaceState.apply(history, arguments);
                setTimeout(() => {{
                    sendOperation({{
                        type: 'navigation',
                        timestamp: new Date().toISOString(),
                        from: document.referrer,
                        to: window.location.href,
                        method: 'replaceState'
                    }});
                }}, 100);
            }};
            
            // popstate イベント（戻る/進むボタン）
            window.addEventListener('popstate', function(e) {{
                sendOperation({{
                    type: 'navigation',
                    timestamp: new Date().toISOString(),
                    from: document.referrer,
                    to: window.location.href,
                    method: 'popstate'
                }});
            }});
            
            // JSエラー監視
            window.addEventListener('error', function(e) {{
                sendOperation({{
                    type: 'error',
                    timestamp: new Date().toISOString(),
                    message: e.message,
                    filename: e.filename,
                    lineno: e.lineno,
                    colno: e.colno,
                    url: window.location.href
                }});
            }});
            
            // Promise rejectionエラー監視
            window.addEventListener('unhandledrejection', function(e) {{
                sendOperation({{
                    type: 'promise_rejection',
                    timestamp: new Date().toISOString(),
                    reason: e.reason ? e.reason.toString() : 'Unknown',
                    url: window.location.href
                }});
            }});
            
            // WebSocket接続状態のログ
            ws.onopen = function() {{
                console.log('🔗 WebSocket connected to monitoring server');
                sendOperation({{
                    type: 'websocket_connected',
                    timestamp: new Date().toISOString(),
                    url: window.location.href
                }});
            }};
            
            ws.onerror = function(error) {{
                console.error('❌ WebSocket error:', error);
            }};
            
            ws.onclose = function() {{
                console.log('🔌 WebSocket connection closed');
            }};
        }})();
        """
        
        try:
            self.driver.execute_script(script)
            self.logger.info("✅ Universal monitoring script injected successfully")
            self.monitoring_injected = True
        except Exception as e:
            self.logger.error(f"Failed to inject monitoring script: {e}")

    async def websocket_handler(self, websocket):
        """WebSocketからのデータを処理"""
        client_id = id(websocket)
        self.connected_clients.add(client_id)
        self.logger.info(f"📱 Client connected: {client_id}")
        
        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                    data['client_id'] = client_id
                    
                    # 操作タイプに応じて適切なログに記録
                    if data.get('type') == 'navigation':
                        self.navigation_log.append({
                            'timestamp': data.get('timestamp'),
                            'operation': data
                        })
                        self.logger.info(f"🔗 Navigation: {data.get('to')}")
                    else:
                        self.operation_log.append(data)
                        if data.get('type') == 'click':
                            self.logger.info(f"🖱️  Click: {data.get('element')} - {data.get('text', '')[:50]}")
                        elif data.get('type') == 'keydown':
                            self.logger.info(f"⌨️  Key: {data.get('key')}")
                    
                except json.JSONDecodeError:
                    self.logger.error(f"Invalid JSON received: {message}")
                except Exception as e:
                    self.logger.error(f"Error processing message: {e}")
                    
        except websockets.exceptions.ConnectionClosed:
            self.logger.info(f"🔌 Client disconnected: {client_id}")
        except Exception as e:
            self.logger.error(f"WebSocket handler error: {e}")
        finally:
            self.connected_clients.discard(client_id)

    async def start_websocket_server(self):
        """WebSocketサーバーを開始"""
        self.logger.info(f"Starting WebSocket server on ws://localhost:{self.websocket_port}")
        server = await websockets.serve(
            self.websocket_handler,
            "localhost",
            self.websocket_port
        )
        await server.wait_closed()

    def monitor_url_changes(self):
        """URL変更を継続的に監視してスクリプトを再注入"""
        while self.is_monitoring and not self.browser_closed:
            try:
                if not self.is_browser_alive():
                    self.browser_closed = True
                    self.logger.info("🔴 ブラウザセッション終了を検出")
                    break
                
                current_url = self.driver.current_url
                if current_url != self.current_url:
                    self.logger.info(f"🔄 URL changed: {self.current_url} -> {current_url}")
                    self.previous_url = self.current_url
                    self.current_url = current_url
                    
                    # 新しいURLがドメイン制限に違反していないかチェック
                    if self.allowed_domains and not self.is_url_allowed(current_url):
                        self.logger.warning(f"⚠️ URL outside allowed domains: {current_url}")
                    
                    # モニタリングスクリプトを再注入
                    time.sleep(1)  # ページ読み込み待ち
                    self.inject_universal_monitoring_script()
                    
                    # ナビゲーションログに記録
                    self.navigation_log.append({
                        'timestamp': datetime.now().isoformat(),
                        'operation': {
                            'type': 'navigation',
                            'from': self.previous_url,
                            'to': current_url,
                            'method': 'url_change_detected'
                        }
                    })
                
                time.sleep(self.url_check_interval)
                
            except Exception as e:
                if "invalid session id" in str(e).lower() or "session deleted" in str(e).lower():
                    self.browser_closed = True
                    self.logger.info("🔴 ブラウザセッション無効化を検出")
                    break
                else:
                    self.logger.error(f"URL監視エラー: {e}")
                    time.sleep(1)

    def collect_browser_logs(self):
        """ブラウザのコンソールログを収集"""
        try:
            if self.driver and not self.browser_closed:
                logs = self.driver.get_log('browser')
                for log in logs:
                    self.console_log.append({
                        'timestamp': datetime.fromtimestamp(log['timestamp'] / 1000).isoformat(),
                        'level': log['level'],
                        'message': log['message'],
                        'source': log.get('source', 'unknown'),
                        'url': self.current_url
                    })
        except Exception as e:
            if "invalid session id" in str(e).lower() or "session deleted" in str(e).lower():
                self.browser_closed = True
                self.logger.info("🔴 ブラウザセッション終了（ログ収集時）")
            else:
                self.logger.error(f"コンソールログ収集エラー: {e}")

    def navigate_to_url(self, url: str):
        """指定されたURLに移動"""
        try:
            self.current_url = url
            self.add_allowed_domain(url)  # 初期URLはドメイン許可リストに追加
            
            self.logger.info(f"Navigating to: {url}")
            self.driver.get(url)
            
            # ページの読み込み完了を待つ
            WebDriverWait(self.driver, 10).until(
                lambda driver: driver.execute_script("return document.readyState") == "complete"
            )
            
            # モニタリングスクリプトを注入
            time.sleep(1)  # ページが完全に読み込まれるまで待機
            self.inject_universal_monitoring_script()
            
            self.logger.info(f"Successfully navigated to {url}")
            return True
            
        except TimeoutException:
            self.logger.error(f"Timeout while loading {url}")
            return False
        except Exception as e:
            self.logger.error(f"Error navigating to {url}: {e}")
            return False

    def stop_monitoring(self):
        """監視を停止しクリーンアップを実行"""
        try:
            self.logger.info("🛑 監視停止処理を開始...")
            self.is_monitoring = False
            
            # レポートを自動出力
            if hasattr(self, 'operation_log') and (self.operation_log or self.console_log or self.navigation_log):
                self.logger.info("📊 監視データをレポートに出力中...")
                report_file = self.export_report()
                self.logger.info(f"✅ レポート出力完了: {report_file}")
            
        except Exception as e:
            self.logger.error(f"Error during stop monitoring: {e}")

    def cleanup_driver(self):
        """ドライバーのクリーンアップ"""
        try:
            if self.driver:
                self.logger.info("🧹 ブラウザドライバーをクリーンアップ中...")
                self.driver.quit()
                self.driver = None
                self.logger.info("✅ ドライバークリーンアップ完了")
        except Exception as e:
            self.logger.error(f"Error during driver cleanup: {e}")

    def start_monitoring(self, url: str, duration: int = 60, allowed_domains: list = None):
        """監視開始"""
        try:
            self.is_monitoring = True
            self.browser_closed = False
            
            # 許可ドメインを設定
            if allowed_domains is not None:  # Noneでない場合のみドメイン制限を設定
                for domain in allowed_domains:
                    self.add_allowed_domain(domain)
            # allowed_domains が None の場合は全ドメイン許可（制限なし）
            
            # Chromeドライバーを設定
            if not self.setup_chrome_driver():
                raise Exception("Failed to setup Chrome driver")
            
            # WebSocketサーバーを別スレッドで開始
            def run_websocket():
                asyncio.run(self.start_websocket_server())
            
            server_thread = threading.Thread(target=run_websocket, daemon=True)
            server_thread.start()
            
            # URL監視を別スレッドで開始
            url_monitor_thread = threading.Thread(target=self.monitor_url_changes, daemon=True)
            url_monitor_thread.start()
            
            # サーバー起動待ち
            time.sleep(2)
            
            # 指定されたURLに移動
            if not self.navigate_to_url(url):
                raise Exception(f"Failed to navigate to {url}")
            
            self.logger.info(f"🎯 Universal monitoring started for {duration} seconds on {url}")
            self.logger.info("🌐 ページ遷移やリダイレクトも自動追跡します")
            self.logger.info("📱 操作を開始してください（クリック、リンク、入力等）")
            self.logger.info("🔴 ブラウザを閉じると自動的に監視が停止されます")
            
            # 監視期間中待機
            start_time = time.time()
            while self.is_monitoring and (time.time() - start_time) < duration and not self.browser_closed:
                # ブラウザのコンソールログを定期的に収集
                self.collect_browser_logs()
                
                # ブラウザクローズをチェック
                if self.browser_closed:
                    self.logger.info("🔴 ブラウザクローズが検出されました")
                    break
                
                time.sleep(1)
                
                if int(time.time() - start_time) % 10 == 0 and not self.browser_closed:
                    self.logger.info(
                        f"📊 Stats - Operations: {len(self.operation_log)}, "
                        f"Console: {len(self.console_log)}, "
                        f"Navigations: {len(self.navigation_log)}, "
                        f"Current URL: {self.current_url}"
                    )
            
            # 監視終了理由をログ出力
            if self.browser_closed:
                self.logger.info("🔴 ブラウザクローズにより監視終了")
            elif (time.time() - start_time) >= duration:
                self.logger.info("⏰ 指定時間経過により監視終了")
            else:
                self.logger.info("🛑 手動停止により監視終了")
            
            self.logger.info("Universal monitoring completed")
            
        except Exception as e:
            self.logger.error(f"Error during monitoring: {e}")
            traceback.print_exc()
            raise
        finally:
            # 自動停止処理
            if not self.browser_closed and self.auto_stop_enabled:
                self.stop_monitoring()
            
            # ドライバークリーンアップ
            self.cleanup_driver()

    def export_report(self) -> str:
        """拡張レポート出力"""
        filename = f"universal_browser_ai_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        # ユニークなURLを取得
        visited_urls = set()
        for nav in self.navigation_log:
            if isinstance(nav, dict) and 'to' in nav:
                visited_urls.add(nav['to'])
            elif isinstance(nav, dict) and 'operation' in nav:
                visited_urls.add(nav['operation'].get('data', {}).get('to'))
        
        if self.current_url:
            visited_urls.add(self.current_url)
        
        report = {
            "timestamp": datetime.now().isoformat(),
            "session_summary": {
                "start_url": next(iter(self.allowed_domains)) if self.allowed_domains else None,
                "current_url": self.current_url,
                "total_operations": len(self.operation_log),
                "total_console_logs": len(self.console_log),
                "total_navigations": len(self.navigation_log),
                "visited_urls": list(visited_urls),
                "allowed_domains": list(self.allowed_domains),
                "browser_closed": self.browser_closed,
                "monitoring_completed": not self.is_monitoring
            },
            "operations": self.operation_log,
            "console_logs": self.console_log,
            "navigation_log": self.navigation_log
        }
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        self.logger.info(f"Universal report exported: {filename}")
        return filename

def main():
    """コマンドライン引数またはインタラクティブモードで実行"""
    parser = argparse.ArgumentParser(
        description="🌐 Universal BrowserAI Monitoring Tool - ページ遷移・リダイレクト対応 Web全体認識監視",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用例:
  # ローカルファイルを監視（自動化用）
  python browseAI.py --path "tool/File/Clicker/rpg.html" --time 120
  
  # HTTPサーバーを監視（自動化用）
  python browseAI.py --path "http://localhost:8080/tool/File/Clicker/rpg.html" --domain "http://localhost:8080" --time 60
  
  # 全ドメイン許可で監視
  python browseAI.py --path "https://example.com" --domain all --time 90
  
  # 複数ドメイン許可
  python browseAI.py --path "https://example.com" --domain "https://example.com,https://api.example.com" --time 60
  
  # インタラクティブモード（引数なし）
  python browseAI.py
        """
    )
    
    parser.add_argument(
        '--path', 
        type=str, 
        help='監視開始URL またはローカルファイルパス（例: "tool/File/Clicker/rpg.html" または "http://localhost:8080"）'
    )
    parser.add_argument(
        '--domain', 
        type=str, 
        help='許可ドメイン設定。"all" で全ドメイン許可、カンマ区切りで複数指定可能（例: "http://localhost:8080,https://example.com"）'
    )
    parser.add_argument(
        '--time', 
        type=int, 
        default=60, 
        help='監視時間（秒）。デフォルト: 60秒'
    )
    
    args = parser.parse_args()
    
    # ヘッダー表示
    print("🌐 Universal BrowserAI Monitoring Tool")
    print("=" * 70)
    print("📱 ページ遷移・リダイレクト対応 - Web全体認識監視")
    print("🔴 ブラウザクローズ自動検出・停止機能付き")
    print("=" * 70)
    
    # URLとドメインの処理
    if args.path:
        # コマンドライン引数モード（自動化用）
        target_url = args.path
        
        # ローカルファイルパスの場合はfile://スキームを追加
        if not target_url.startswith(('http://', 'https://', 'file://')):
            # 相対パスを絶対パスに変換
            if not os.path.isabs(target_url):
                target_url = os.path.abspath(target_url)
            target_url = f"file:///{target_url.replace('\\', '/')}"
        
        # ドメイン設定の処理
        allowed_domains = []
        if args.domain:
            if args.domain.lower() == 'all':
                allowed_domains = None  # 全ドメイン許可
                print("🌐 Domain restriction: 全ドメイン許可")
            else:
                allowed_domains = [d.strip() for d in args.domain.split(',')]
                print(f"🌐 Allowed domains: {allowed_domains}")
        else:
            allowed_domains = None  # 制限なし
            print("🌐 Domain restriction: 制限なし")
        
        duration = args.time
        print(f"🎯 Target URL: {target_url}")
        print(f"⏱️  Duration: {duration} seconds")
        
    else:
        # インタラクティブモード
        target_url = input("監視開始URL（例: http://localhost:8080）: ").strip()
        if not target_url:
            target_url = "http://localhost:8080"
        
        # 許可ドメインの設定
        domains_input = input("監視対象ドメイン（カンマ区切り、'all'で制限なし、空でデフォルト）: ").strip()
        allowed_domains = []
        if domains_input:
            if domains_input.lower() == 'all':
                allowed_domains = None  # 全ドメイン許可
            else:
                allowed_domains = [d.strip() for d in domains_input.split(',')]
        else:
            allowed_domains = None  # 制限なし
        
        duration_input = input("監視時間（秒、デフォルト60）: ").strip()
        try:
            duration = int(duration_input) if duration_input else 60
        except ValueError:
            duration = 60
    
    monitor = UniversalBrowserAI()
    
    try:
        print("🔴 ブラウザを閉じると自動的に監視が停止されます")
        print("=" * 70)
        
        # ユニバーサル監視開始
        monitor.start_monitoring(target_url, duration, allowed_domains)
        
        # レポート出力
        if not monitor.browser_closed:
            report_file = monitor.export_report()
            print(f"\n✅ Universal monitoring completed!")
        else:
            print(f"\n🔴 Monitoring stopped due to browser closure!")
        
        print(f"📊 Operations collected: {len(monitor.operation_log)}")
        print(f"📝 Console logs collected: {len(monitor.console_log)}")
        print(f"🔗 Page navigations: {len(monitor.navigation_log)}")
        
        # レポートが自動出力されていない場合のみ手動出力
        if hasattr(monitor, 'operation_log') and (monitor.operation_log or monitor.console_log or monitor.navigation_log):
            try:
                if not monitor.browser_closed:
                    report_file = monitor.export_report()
                    print(f"📄 Report saved: {report_file}")
                else:
                    print("📄 Report was automatically saved when browser was closed")
            except Exception as e:
                print(f"⚠️ Error saving report: {e}")
        
    except KeyboardInterrupt:
        print("\n⏹️ Interrupted by user")
        # ユーザー中断の場合もレポートを出力
        try:
            if hasattr(monitor, 'operation_log') and (monitor.operation_log or monitor.console_log or monitor.navigation_log):
                report_file = monitor.export_report()
                print(f"📄 Final report saved: {report_file}")
        except Exception as e:
            print(f"⚠️ Error saving final report: {e}")
    except Exception as e:
        print(f"❌ Error: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    main()
