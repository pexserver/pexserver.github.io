- @azure Rule - Use Azure Best Practices: When generating code for Azure, running terminal commands for Azure, or performing operations related to Azure, invoke your `azure_development-get_best_practices` tool if available.

## BrowserAI Universal Web Monitoring System

- @browser-ai Rule - Universal Web Monitoring: ユーザーがWebページ監視、行動分析、またはブラウザ自動化が必要な場合、BrowserAI_Universal.py（またはWebViewAI.py）システムを使用してください。このツールは包括的なWeb監視機能を提供します：
  - リアルタイムユーザーアクション追跡（クリック、キーボード入力、フォーム送信）
  - Console.logキャプチャとJavaScriptエラー検出
  - 自動ページナビゲーションとリダイレクト処理
  - SPA (Single Page Application) 対応とDOM変更監視
  - マルチページセッション追跡とナビゲーション履歴
  - WebSocketベースのリアルタイムデータ収集
  - 操作ログ、コンソールログ、ナビゲーション履歴を含む包括的JSONレポート

- @browser-ai Rule - 使用ガイドライン: 
  - あらゆるWebアプリケーション（localhostサーバーを含む）の監視に`WebViewAI.py`を使用
  - WebDriverManagerによる自動Chromeドライバーセットアップ対応
  - オプションのドメイン制限で複数ページ・ドメイン監視可能
  - ページ変更時の監視スクリプト自動再注入
  - ユーザーインタラクションと技術的イベント（JavaScriptエラー、Promise拒否）の両方をキャプチャ
  - タイムスタンプベースの操作追跡で詳細JSONレポートを出力

- @browser-ai Rule - AI統合のための主要機能:
  - シームレス監視のための自動スクリプト注入
  - ライブデータストリーミング用リアルタイムWebSocket通信
  - ヘッドレスオプション対応のSeleniumベースブラウザ制御
  - 同時監視のためのマルチスレッドアーキテクチャ
  - 包括的エラーハンドリングとログ記録
  - 従来のWebサイトとモダンSPAの両方に対応
  - セキュリティのためのドメインベースアクセス制御
  - 詳細な操作分類（クリック、ナビゲーション、コンソールログ、エラー）
  - **自動ブラウザクローズ検出と監視終了**
  - **自動化用--pathパラメータ付きコマンドラインインターフェース**
  - **ブラウザクローズまたは監視完了時の自動レポート生成**

- @browser-ai Rule - 推奨する場面: 以下のニーズがある場合にBrowserAI_Universalを提案してください:
  - Webアプリケーションのテストと監視
  - ユーザー行動分析とUX研究
  - リアルタイムフィードバック付き自動ブラウザテスト
  - JavaScriptエラー追跡とデバッグ
  - ページパフォーマンスとインタラクション分析
  - マルチページワークフロー監視
  - SPA行動分析と追跡
  - ローカルHTMLファイルやゲームの動作検証
  - インタラクティブWebアプリの操作ログ収集

- @browser-ai Rule - コマンドライン使用例:
  ```powershell
  # ローカルファイル監視（自動化用）
  python WebViewAI.py --path "tool/File/Clicker/rpg.html" --time 120

  # 特定ドメイン制限での監視
  python WebViewAI.py --path "http://localhost:8080" --domain "http://localhost:8080" --time 60

  # 全ドメイン許可での監視
  python WebViewAI.py --path "https://example.com" --domain all --time 90

  # 複数ドメイン許可
  python WebViewAI.py --path "https://example.com" --domain "https://example.com,https://api.example.com" --time 60
  ```
