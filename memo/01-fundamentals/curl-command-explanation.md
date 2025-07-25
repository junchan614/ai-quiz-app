# curlコマンド解説

## curlとは？

**curl**は、コマンドラインでHTTPリクエストを送信するためのツールです。

### 身近な例で理解
**郵便システム**で例えると：
- **ブラウザ**: 手紙を書いて郵便局で送る（GUIで操作）
- **curl**: 電話で郵便局に送付を依頼（コマンドラインで操作）

## 基本的な使用方法

### 1. GET リクエスト（最もシンプル）
```bash
# 基本形：URLにGETリクエストを送信
curl http://localhost:3000

# レスポンスをファイルに保存
curl http://localhost:3000 -o response.html

# ヘッダー情報も表示
curl -i http://localhost:3000

# 詳細な情報を表示（デバッグ用）
curl -v http://localhost:3000
```

### 2. POST リクエスト
```bash
# JSON データを送信
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"password123"}' \
  http://localhost:3000/api/auth/login

# フォームデータを送信
curl -X POST \
  -d "username=test&password=password123" \
  http://localhost:3000/api/auth/login

# ファイルからデータを読み込んで送信
curl -X POST \
  -H "Content-Type: application/json" \
  -d @data.json \
  http://localhost:3000/api/auth/login
```

## よく使用するオプション

### 1. 出力制御オプション
```bash
# サイレントモード（進捗情報を非表示）
curl -s http://localhost:3000

# 失敗時のみエラーを表示
curl -sS http://localhost:3000

# レスポンスヘッダーのみ表示
curl -I http://localhost:3000

# レスポンスヘッダーとボディを表示
curl -i http://localhost:3000
```

### 2. HTTP メソッド指定
```bash
# GET（デフォルト）
curl http://localhost:3000

# POST
curl -X POST http://localhost:3000

# PUT
curl -X PUT http://localhost:3000

# DELETE
curl -X DELETE http://localhost:3000
```

### 3. ヘッダー設定
```bash
# Content-Type を設定
curl -H "Content-Type: application/json" http://localhost:3000

# 複数のヘッダーを設定
curl -H "Content-Type: application/json" \
     -H "Authorization: Bearer token123" \
     http://localhost:3000

# User-Agent を設定
curl -H "User-Agent: MyApp/1.0" http://localhost:3000
```

### 4. Cookie の処理
```bash
# Cookie を送信
curl -b "session=abc123" http://localhost:3000

# Cookie をファイルから読み込み
curl -b cookies.txt http://localhost:3000

# Cookie をファイルに保存
curl -c cookies.txt http://localhost:3000

# Cookie の送受信を同時に行う
curl -b cookies.txt -c cookies.txt http://localhost:3000
```

## API テストでの活用

### 1. 認証のテスト
```bash
# ユーザー登録
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"password123"}' \
  -c cookies.txt \
  http://localhost:3000/api/auth/register

# ログイン
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"password123"}' \
  -c cookies.txt \
  http://localhost:3000/api/auth/login

# 認証が必要なエンドポイントにアクセス
curl -b cookies.txt \
  http://localhost:3000/api/user/stats
```

### 2. レスポンスの検証
```bash
# ステータスコードのみ取得
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000

# レスポンス時間の測定
curl -s -o /dev/null -w "%{time_total}" http://localhost:3000

# 詳細な統計情報
curl -s -o /dev/null -w "時間: %{time_total}s\nステータス: %{http_code}\n" http://localhost:3000
```

### 3. エラーハンドリング
```bash
# エラー時に詳細を表示
curl -f http://localhost:3000/nonexistent || echo "リクエストが失敗しました"

# タイムアウト設定
curl --max-time 10 http://localhost:3000

# リトライ設定
curl --retry 3 --retry-delay 1 http://localhost:3000
```

## JSON レスポンスの整形

### 1. jq コマンドとの組み合わせ
```bash
# JSON を整形して表示
curl -s http://localhost:3000/api/quiz | jq .

# 特定のフィールドのみ抽出
curl -s http://localhost:3000/api/quiz | jq '.quizzes[0].question'

# 配列の要素数を取得
curl -s http://localhost:3000/api/quiz | jq '.quizzes | length'
```

### 2. python との組み合わせ
```bash
# JSON を整形して表示
curl -s http://localhost:3000/api/quiz | python -m json.tool

# 特定の処理を行う
curl -s http://localhost:3000/api/quiz | python -c "
import sys, json
data = json.load(sys.stdin)
print(f'クイズ数: {len(data[\"quizzes\"])}')
"
```

## 実践的な使用例

### 1. API の動作確認
```bash
# サーバーが起動しているか確認
curl -s http://localhost:3000 > /dev/null && echo "サーバー起動中" || echo "サーバー停止中"

# API エンドポイントの一覧確認
echo "=== API エンドポイント確認 ==="
echo "1. トピック一覧:"
curl -s http://localhost:3000/api/quiz/topics/list | head -3

echo "2. クイズ一覧:"
curl -s http://localhost:3000/api/quiz | head -3

echo "3. 認証確認:"
curl -s http://localhost:3000/api/auth/me | head -3
```

### 2. 負荷テスト（簡易版）
```bash
# 10回連続でリクエスト
for i in {1..10}; do
  echo "リクエスト $i:"
  curl -s -w "時間: %{time_total}s ステータス: %{http_code}\n" \
    -o /dev/null http://localhost:3000
done
```

### 3. ヘルスチェック
```bash
# サーバーの健康状態を確認
check_health() {
  local url=$1
  local status=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  local time=$(curl -s -o /dev/null -w "%{time_total}" "$url")
  
  if [ "$status" = "200" ]; then
    echo "✅ $url - OK (${time}s)"
  else
    echo "❌ $url - ERROR (Status: $status)"
  fi
}

echo "=== ヘルスチェック ==="
check_health "http://localhost:3000"
check_health "http://localhost:3000/api/quiz"
check_health "http://localhost:3000/api/quiz/topics/list"
```

## このプロジェクトでのテストコマンド

### 1. 基本的な動作確認
```bash
# ホームページの確認
curl -s http://localhost:3000

# トピック一覧の確認
curl -s http://localhost:3000/api/quiz/topics/list

# クイズ一覧の確認
curl -s http://localhost:3000/api/quiz
```

### 2. 認証機能のテスト
```bash
# 1. ユーザー登録
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"password123"}' \
  -c cookies.txt \
  -s http://localhost:3000/api/auth/register

# 2. ログイン
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"password123"}' \
  -c cookies.txt \
  -s http://localhost:3000/api/auth/login

# 3. 認証状態確認
curl -b cookies.txt \
  -s http://localhost:3000/api/auth/me

# 4. ユーザー統計取得
curl -b cookies.txt \
  -s http://localhost:3000/api/user/stats
```

### 3. エラーケースのテスト
```bash
# 存在しないエンドポイント
curl -s http://localhost:3000/api/nonexistent

# 不正なログイン
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"invalid","password":"wrong"}' \
  -s http://localhost:3000/api/auth/login

# 認証なしで保護されたエンドポイントにアクセス
curl -s http://localhost:3000/api/user/stats
```

## トラブルシューティング

### よくあるエラーと対処法

#### 1. "Connection refused"
```bash
curl: (7) Failed to connect to localhost port 3000: Connection refused
```
**原因**: サーバーが起動していない
**対処**: `npm start` でサーバーを起動

#### 2. "Empty reply from server"
```bash
curl: (52) Empty reply from server
```
**原因**: サーバーがクラッシュした可能性
**対処**: サーバーのログを確認してデバッグ

#### 3. "Timeout"
```bash
curl: (28) Operation timed out
```
**原因**: サーバーの応答が遅い
**対処**: `--max-time` オプションで調整

## curlの出力について

### レスポンスの構成
```bash
# ヘッダーとボディを分けて表示
curl -i http://localhost:3000/api/quiz/topics/list

# 出力例:
# HTTP/1.1 200 OK              ← ステータスライン
# Content-Type: application/json ← レスポンスヘッダー
# 
# {"topics":[...]}              ← レスポンスボディ
```

### JSON レスポンスの読み方
```json
{
  "topics": [
    {
      "topic": "プログラミング基礎",
      "count": 2
    },
    {
      "topic": "数学", 
      "count": 1
    }
  ]
}
```

curlは、Webアプリケーション開発において、APIの動作確認やデバッグに欠かせないツールです。GUIのブラウザでは確認しづらい詳細な情報を取得でき、自動化されたテストにも活用できます。