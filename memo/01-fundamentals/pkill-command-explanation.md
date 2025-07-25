# pkillコマンド解説

## pkillとは？

**pkill**は、プロセス名やパターンに基づいてプロセスを終了させるLinux/Unix系OSのコマンドです。

### 身近な例で理解
**タスクマネージャー**で例えると：
- **GUI**: タスクマネージャーでアプリを選択して「終了」ボタンをクリック
- **pkill**: コマンドラインでアプリ名を指定して終了

## 基本的な使用方法

### 1. プロセス名で終了
```bash
# 基本形：プロセス名で終了
pkill firefox

# Node.jsプロセスをすべて終了
pkill node

# 特定のスクリプト名で終了
pkill -f "node server.js"
```

### 2. パターンマッチで終了
```bash
# パターンにマッチするプロセスを終了
pkill -f "python.*app.py"

# 部分マッチで終了
pkill -f "my-app"
```

## よく使用するオプション

### 1. -f オプション（フルコマンドラインマッチ）
```bash
# ❌ プロセス名のみでマッチ（うまくいかない場合が多い）
pkill node

# ✅ フルコマンドラインでマッチ（推奨）
pkill -f "node server.js"
```

**-f オプションの重要性**：
- プロセス名だけでなく、引数まで含めてマッチング
- より正確にターゲットプロセスを特定できる

### 2. シグナル指定
```bash
# TERM シグナル（デフォルト、穏やかな終了）
pkill node

# KILL シグナル（強制終了）
pkill -9 node
pkill -KILL node

# HUP シグナル（設定再読み込み）
pkill -HUP nginx
```

### 3. ユーザー指定
```bash
# 特定のユーザーのプロセスのみ終了
pkill -u username node

# 現在のユーザーのプロセスのみ終了
pkill -u $(whoami) node
```

### 4. 確認系オプション
```bash
# 実際には終了させず、マッチするプロセスを表示
pkill -f "node server.js" --dry-run

# プロセス終了時に詳細を表示
pkill -f "node server.js" -v
```

## 関連コマンドとの違い

### 1. kill vs pkill
```bash
# kill：プロセスID（PID）を指定して終了
kill 1234
kill -9 1234

# pkill：プロセス名やパターンを指定して終了
pkill node
pkill -f "node server.js"
```

### 2. killall vs pkill
```bash
# killall：完全なプロセス名で終了（Linux）
killall node

# pkill：パターンマッチで終了（より柔軟）
pkill node
pkill -f "node.*server"
```

### 3. pgrep（プロセス検索）
```bash
# pgrep：マッチするプロセスのPIDを表示（終了はしない）
pgrep -f "node server.js"

# pkill：マッチするプロセスを終了
pkill -f "node server.js"
```

## 実際の使用例

### 1. 開発サーバーの管理
```bash
# Node.jsサーバーを終了
pkill -f "node server.js"

# Pythonアプリを終了
pkill -f "python app.py"

# 複数のポートで動作するサーバーを一括終了
pkill -f "npm.*start"
```

### 2. 安全な終了の流れ
```bash
# 1. まず穏やかに終了を試行（TERM シグナル）
pkill -f "node server.js"

# 2. 少し待つ
sleep 3

# 3. まだ動作していれば強制終了（KILL シグナル）
pkill -9 -f "node server.js"
```

### 3. プロセス確認と終了
```bash
# 1. 対象プロセスを確認
pgrep -f "node server.js"

# 2. プロセスの詳細を確認
ps aux | grep "node server.js"

# 3. プロセスを終了
pkill -f "node server.js"

# 4. 終了を確認
pgrep -f "node server.js" || echo "プロセスは終了しました"
```

## シグナルの種類と用途

### 主要なシグナル
```bash
# TERM (15)：穏やかな終了（デフォルト）
pkill -TERM node
pkill node  # 同じ

# KILL (9)：強制終了
pkill -KILL node
pkill -9 node  # 同じ

# HUP (1)：ハングアップ、設定再読み込み
pkill -HUP nginx

# INT (2)：割り込み（Ctrl+C と同じ）
pkill -INT node

# QUIT (3)：終了（コアダンプあり）
pkill -QUIT node
```

### シグナルの使い分け
```bash
# 1. まずは穏やかな終了を試す
pkill -TERM -f "node server.js"

# 2. 応答しない場合は強制終了
pkill -KILL -f "node server.js"
```

## 注意点とベストプラクティス

### 1. 誤った終了を防ぐ
```bash
# ❌ 危険：すべてのnodeプロセスが終了してしまう可能性
pkill node

# ✅ 安全：特定のスクリプトのみを対象
pkill -f "node server.js"

# ✅ より安全：事前に確認
echo "終了対象プロセス:"
pgrep -f "node server.js"
read -p "本当に終了しますか？ (y/N): " answer
if [ "$answer" = "y" ]; then
    pkill -f "node server.js"
fi
```

### 2. エラーハンドリング
```bash
# 終了の成否を確認
if pkill -f "node server.js"; then
    echo "サーバーを終了しました"
else
    echo "終了対象のプロセスが見つかりませんでした"
fi
```

### 3. ログ記録
```bash
# 終了前にプロセス情報をログに記録
echo "$(date): サーバー終了処理開始" >> server.log
ps aux | grep "node server.js" >> server.log
pkill -f "node server.js"
echo "$(date): サーバー終了処理完了" >> server.log
```

## トラブルシューティング

### よくある問題と対処法

#### 1. "No such process" エラー
```bash
pkill: No such process
```
**原因**: 対象プロセスが存在しない
**対処**: `pgrep` で事前確認

#### 2. 権限エラー
```bash
pkill: Permission denied
```
**原因**: 他のユーザーのプロセスを終了しようとしている
**対処**: `sudo` を使用するか、`-u` オプションで自分のプロセスのみ対象

#### 3. 意図しないプロセスの終了
**原因**: パターンが広すぎる
**対処**: より具体的なパターンを使用

## このプロジェクトでの使用例

### 開発サーバーの再起動
```bash
# 1. 現在のサーバーを終了
pkill -f "node server.js"

# 2. 少し待つ
sleep 2

# 3. 新しいサーバーを起動
npm start
```

### デバッグ用の確認コマンド
```bash
# 動作中のNode.jsプロセスを確認
echo "=== 動作中のNode.jsプロセス ==="
ps aux | grep node | grep -v grep

# 特定のサーバープロセスを確認
echo "=== server.js プロセス ==="
pgrep -f "node server.js" && echo "サーバーは動作中" || echo "サーバーは停止中"
```

### 安全な終了スクリプト
```bash
#!/bin/bash
# stop-server.sh

echo "サーバー停止処理を開始します..."

# 対象プロセスを確認
PIDS=$(pgrep -f "node server.js")

if [ -z "$PIDS" ]; then
    echo "停止対象のサーバーが見つかりません"
    exit 1
fi

echo "停止対象PID: $PIDS"

# 穏やかな終了を試行
echo "穏やかな終了を試行中..."
pkill -f "node server.js"

# 3秒待機
sleep 3

# まだ動作中なら強制終了
if pgrep -f "node server.js" > /dev/null; then
    echo "強制終了を実行中..."
    pkill -9 -f "node server.js"
    sleep 1
fi

# 結果確認
if pgrep -f "node server.js" > /dev/null; then
    echo "❌ サーバーの停止に失敗しました"
    exit 1
else
    echo "✅ サーバーを正常に停止しました"
fi
```

pkillは開発作業において、サーバーの再起動や不要なプロセスの整理に非常に便利なコマンドです。ただし、強力なコマンドでもあるため、実行前には対象プロセスを十分に確認することが重要です。