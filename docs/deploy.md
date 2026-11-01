# 既存EC2への配置（Amazon Linux 2023 / Apache）

既に `https://llm-jp.com/llmjp` と `/llmjp/` のAPI中継が稼働している環境用です。証明書・API・DBの新設は不要です。医療データのDB保存は実装していません。

## 初回

新リポジトリを作成しコード配置後、EC2で実行します。

```bash
git clone https://github.com/higenobu/blood-test-review.git ~/blood-test-review
cd ~/blood-test-review
sudo sh scripts/install-static.sh
sudo install -m 644 deploy/apache-blood-test.inc /etc/httpd/llmjp/apache-blood-test.inc
```

`/etc/httpd/conf.d/llmjp-web-https.conf` の **llm-jp.comの443番VirtualHost内**に、次の行を1回だけ追加します。既存のApacheルーティングincludeは残します。

```apache
Include /etc/httpd/llmjp/apache-blood-test.inc
```

```bash
sudo httpd -t
sudo httpd -S
```

Syntax OKとVirtualHostの対応を確認してから反映します。

```bash
sudo systemctl reload httpd
curl --fail --show-error https://llm-jp.com/blood-test/
curl --fail --show-error https://llm-jp.com/llmjp/health
```

https://llm-jp.com/blood-test/ を開き、架空データで表示・CSV・PDF・AI補助の確認をします。既存LLM-JP・Flaskサイトも確認します。実サーバーへの配置とApache構文チェックは、この開発環境からは未実施です。

## 更新

```bash
cd ~/blood-test-review
git pull --ff-only origin main
sudo sh scripts/install-static.sh
```

画面ファイルだけならApache再起動とDockerビルドは不要です。Ctrl+Shift+Rでブラウザを更新してください。

## API運用

AI補助で使うAPIエンドポイントは、既存の `/llmjp/auth/login` と `/llmjp/generate` です。新しいPythonエンドポイントは不要です。共有APIのユーザー制限・生成上限・ログ方針を確認します。AIには数値や項目名を送信しませんが、比較区分も健康に関する情報なので、送信・保存方針を確認してください。
