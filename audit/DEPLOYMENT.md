# HTTPS監査プレビューの公開記録

2026年11月7日（日本時間）、iPhone Safariから確認できるHTTPSプレビューの作成依頼に基づき、監査専用のSitesプロジェクトへ限定公開した。

- URL： https://gkentei-question-audit-preview.waxennoodle1.chatgpt.site
- 閲覧範囲：所有者本人。必要に応じて同じChatGPTアカウントでログインする。
- 状態：Sites公開処理の `succeeded` を確認。
- プロジェクトID： `appgprj_6aef06ccc01c81919540c51f38a69d99`
- バージョンID： `appgprj_6aef06ccc01c81919540c51f38a69d99~appgver_5310947972d081919b117fa1c777de38`
- デプロイID： `appgdep_6aef071a215c81919984146d53d059e7`
- 公開したソース：Sites専用リポジトリの `f19c343217fd7e85f5cf66b6949627083900ec4b`
- 監査・修正のGitHubソース： `audit/question-quality-20261107`、`d1c3bd3c29ee00915cf3c679df211e99ddf4391d`

既存のGitHub Pagesはmainを公開元としていた。mainへの変更を避けるため、GitHub Pagesの設定は変更せず、別の監査専用ホスティングを使用した。GitHubのmainは `cc86fd5580b2bcfebc9fda3dc936d91ac253993b` のまま。正式版リポジトリと既存プレビューの公開設定は変更していない。

公開内容は明示的に列挙した静的ファイルのみ：監査画面、指摘CSV、確認状況CSV、監査報告書、テスト結果・集計、および確認用アプリのHTML/JS。ブラウザプロファイル、学習履歴のエクスポート、認証情報、作業用ディレクトリ、Gitメタデータは公開アーカイブに含めていない。監査画面はlocalStorageを使用しない。確認用アプリで回答した履歴はその閲覧端末内に保存され、ホスティングへ送信しない。

公開用にルートのindex.htmlを監査一覧へ変更し、アプリとCSVへの相対リンクが存在することを確認した。監査内容と操作コードは前回検証したものと同じ。共有ブラウザは `Browser runtime unavailable` のため、公開後の実iPhone Safariでの操作確認は未実施。Sitesから返された成功ステータスとHTTPS URLで公開完了を確認した。

REPORT.mdの「公開未実施」は前回監査終了時点の記録であり、今回承認された監査プレビューの公開は本ファイルに記録する。正式版へのマージ・公開は今回も行っていない。
