# G検定アプリ プレビュー

元アプリのPR #1（f92302fd0ec7754110c420e9fadb5c8dd434fb2b）を基にした、独立した確認用サイトです。

学習履歴は本番と別のキーに保存します。元リポジトリのmainとGitHub Pages設定は変更しません。

## 全問題品質監査（検証ブランチ）

`audit/question-quality-20261107` に安全な文面修正と監査記録を保存しています。
監査結果と一次資料の未照合事項は [監査報告書](audit/REPORT.md)、指摘の修正前後は [指摘一覧](audit/findings.csv)、全件のチェック状況は [全件表](audit/coverage.csv) を参照してください。

ローカルで `python -m http.server 8000 --bind 0.0.0.0` を実行し、`http://localhost:8000/audit/` で監査一覧、`http://localhost:8000/level3.html` で修正後アプリを確認できます。外部への公開操作は不要です。

再検証：`python scripts/check-questions.py`、サーバー起動中に `node scripts/check-browser.cjs`（PlaywrightとChromiumが必要。`CHROMIUM_PATH`、`AUDIT_URL` で変更可能）。集計を再作成する `scripts/build-audit.py` は記載した基準コミットの問題データから生成するため、後続の編集を行う場合は先に差分を保存してください。
