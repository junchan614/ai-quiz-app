# データベース設計解説

## データベース設計とは？

**データベース設計**は、アプリケーションで使用するデータの構造と関係性を定義することです。

### 身近な例で理解
**図書館の管理システム**で例えると：
- **利用者情報**: 名前、住所、会員番号
- **書籍情報**: タイトル、著者、ISBN
- **貸出履歴**: 誰が、いつ、何の本を借りたか

これらの情報をどのように整理・保存するかがデータベース設計です。

## このプロジェクトのデータベース構造

### 3つのメインテーブル

#### 1. usersテーブル（ユーザー情報）
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,  -- ユーザーの一意識別子
    username TEXT UNIQUE NOT NULL,         -- ユーザー名（重複不可）
    email TEXT UNIQUE NOT NULL,            -- メールアドレス（重複不可）
    password_hash TEXT NOT NULL,           -- パスワードのハッシュ値
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,  -- 登録日時
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP   -- 更新日時
);
```

**役割**: ユーザーアカウント情報の管理

#### 2. quizzesテーブル（クイズ情報）
```sql
CREATE TABLE quizzes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,  -- クイズの一意識別子
    topic TEXT NOT NULL,                   -- クイズのトピック
    question TEXT NOT NULL,                -- 問題文
    option_a TEXT NOT NULL,                -- 選択肢A
    option_b TEXT NOT NULL,                -- 選択肢B
    option_c TEXT NOT NULL,                -- 選択肢C
    option_d TEXT NOT NULL,                -- 選択肢D
    correct_answer CHAR(1) NOT NULL,       -- 正解（A, B, C, Dのいずれか）
    difficulty INTEGER DEFAULT 1,          -- 難易度（1-5）
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP  -- 作成日時
);
```

**役割**: AIで生成されたクイズ問題の保存

#### 3. user_answersテーブル（回答履歴）
```sql
CREATE TABLE user_answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,  -- 回答記録の一意識別子
    user_id INTEGER NOT NULL,              -- 回答したユーザーのID
    quiz_id INTEGER NOT NULL,              -- 回答したクイズのID
    selected_answer CHAR(1) NOT NULL,      -- ユーザーが選択した回答
    is_correct BOOLEAN NOT NULL,           -- 正解かどうか
    answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,  -- 回答日時
    FOREIGN KEY (user_id) REFERENCES users (id),     -- usersテーブルとの関連
    FOREIGN KEY (quiz_id) REFERENCES quizzes (id)    -- quizzesテーブルとの関連
);
```

**役割**: ユーザーの回答履歴と統計データの元データ

## リレーション（テーブル間の関係）

### 1. users ← user_answers の関係
- **1対多の関係**: 1人のユーザーは複数の回答を持てる
- **外部キー**: `user_answers.user_id` → `users.id`

```
users テーブル
├── id: 1, username: "john"
├── id: 2, username: "alice"

user_answers テーブル
├── user_id: 1 (johnの回答)
├── user_id: 1 (johnの別の回答)
├── user_id: 2 (aliceの回答)
```

### 2. quizzes ← user_answers の関係
- **1対多の関係**: 1つのクイズは複数のユーザーに回答される
- **外部キー**: `user_answers.quiz_id` → `quizzes.id`

```
quizzes テーブル
├── id: 1, question: "JavaScriptとは？"
├── id: 2, question: "HTMLとは？"

user_answers テーブル
├── quiz_id: 1 (問題1への回答)
├── quiz_id: 1 (問題1への別ユーザーの回答)
├── quiz_id: 2 (問題2への回答)
```

## インデックス設計

### インデックスとは？
**インデックス**は、データの検索を高速化するための仕組みです。

**本の索引**と同じ概念：
- 索引なし：全ページを順番に探す（遅い）
- 索引あり：索引で該当ページを特定（速い）

### 作成したインデックス

#### ユーザーテーブル
```sql
CREATE INDEX idx_users_username ON users(username);  -- ユーザー名での検索
CREATE INDEX idx_users_email ON users(email);        -- メールアドレスでの検索
```

#### クイズテーブル
```sql
CREATE INDEX idx_quizzes_topic ON quizzes(topic);           -- トピック別検索
CREATE INDEX idx_quizzes_difficulty ON quizzes(difficulty); -- 難易度別検索
CREATE INDEX idx_quizzes_created_at ON quizzes(created_at);  -- 日付順ソート
```

#### 回答履歴テーブル
```sql
CREATE INDEX idx_user_answers_user_id ON user_answers(user_id);     -- ユーザー別検索
CREATE INDEX idx_user_answers_quiz_id ON user_answers(quiz_id);     -- クイズ別検索
CREATE INDEX idx_user_answers_answered_at ON user_answers(answered_at); -- 日付順ソート
CREATE INDEX idx_user_answers_user_quiz ON user_answers(user_id, quiz_id); -- 複合検索
```

## ビュー（View）の活用

### ビューとは？
**ビュー**は、複雑なクエリを簡単に再利用するための仮想的なテーブルです。

### 1. user_stats ビュー（ユーザー統計）
```sql
CREATE VIEW user_stats AS
SELECT 
    u.id as user_id,
    u.username,
    COUNT(ua.id) as total_answers,                    -- 総回答数
    SUM(CASE WHEN ua.is_correct = 1 THEN 1 ELSE 0 END) as correct_answers, -- 正解数
    ROUND((SUM(CASE WHEN ua.is_correct = 1 THEN 1 ELSE 0 END) * 100.0) / COUNT(ua.id), 2) as accuracy_percentage, -- 正答率
    MIN(ua.answered_at) as first_quiz_date,           -- 初回回答日
    MAX(ua.answered_at) as last_quiz_date             -- 最終回答日
FROM users u
LEFT JOIN user_answers ua ON u.id = ua.user_id
GROUP BY u.id, u.username;
```

**使用例**:
```sql
-- ユーザーの統計を簡単に取得
SELECT * FROM user_stats WHERE user_id = 1;
```

### 2. topic_stats ビュー（トピック別統計）
```sql
CREATE VIEW topic_stats AS
SELECT 
    q.topic,
    COUNT(DISTINCT q.id) as total_questions,          -- トピック内の問題数
    COUNT(ua.id) as total_attempts,                   -- 総回答試行数
    SUM(CASE WHEN ua.is_correct = 1 THEN 1 ELSE 0 END) as correct_attempts, -- 正解試行数
    ROUND((SUM(CASE WHEN ua.is_correct = 1 THEN 1 ELSE 0 END) * 100.0) / COUNT(ua.id), 2) as topic_accuracy -- トピック正答率
FROM quizzes q
LEFT JOIN user_answers ua ON q.id = ua.quiz_id
GROUP BY q.topic
HAVING COUNT(ua.id) > 0;
```

## データ制約（Constraint）

### 1. PRIMARY KEY制約
```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
```
- **役割**: 各レコードを一意に識別
- **AUTOINCREMENT**: 自動で連番を割り当て

### 2. UNIQUE制約
```sql
username TEXT UNIQUE NOT NULL,
email TEXT UNIQUE NOT NULL,
```
- **役割**: 重複を防ぐ（同じユーザー名・メールアドレスは登録不可）

### 3. NOT NULL制約
```sql
password_hash TEXT NOT NULL,
```
- **役割**: 必須項目の指定（空値を許可しない）

### 4. CHECK制約
```sql
correct_answer CHAR(1) NOT NULL CHECK (correct_answer IN ('A', 'B', 'C', 'D')),
difficulty INTEGER DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
```
- **役割**: 値の範囲や形式を制限

### 5. FOREIGN KEY制約
```sql
FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
```
- **役割**: テーブル間の整合性を保つ
- **ON DELETE CASCADE**: 親レコード削除時に子レコードも自動削除

## サンプルデータの意味

### テストユーザー
```sql
INSERT OR IGNORE INTO users (username, email, password_hash) VALUES 
('test_user', 'test@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3Fb9zVgQjK');
```
- **パスワード**: "password" をbcryptでハッシュ化した値
- **用途**: 開発・テスト時の動作確認

### サンプルクイズ
```sql
INSERT OR IGNORE INTO quizzes (topic, question, option_a, option_b, option_c, option_d, correct_answer, difficulty) VALUES 
('プログラミング基礎', 'JavaScriptで変数を宣言するキーワードはどれですか？', 'var', 'int', 'string', 'char', 'A', 1);
```
- **用途**: AIクイズ生成機能実装前の動作確認

## データベース操作の実例

### ユーザー登録
```sql
INSERT INTO users (username, email, password_hash) 
VALUES (?, ?, ?);
```

### クイズ取得
```sql
SELECT * FROM quizzes 
WHERE topic = ? 
ORDER BY created_at DESC 
LIMIT 10;
```

### 回答記録
```sql
INSERT INTO user_answers (user_id, quiz_id, selected_answer, is_correct) 
VALUES (?, ?, ?, ?);
```

### ユーザー統計取得
```sql
SELECT * FROM user_stats WHERE user_id = ?;
```

## セキュリティ考慮事項

### 1. SQLインジェクション対策
```javascript
// ❌ 危険：直接文字列結合
const query = `SELECT * FROM users WHERE username = '${username}'`;

// ✅ 安全：プレースホルダー使用
const query = 'SELECT * FROM users WHERE username = ?';
db.get(query, [username]);
```

### 2. パスワードハッシュ化
- 平文パスワードは絶対に保存しない
- bcryptを使用してハッシュ化

### 3. 外部キー制約
- データの整合性を自動的に保証
- 不正なデータの挿入を防止

## パフォーマンス最適化

### 1. 適切なインデックス設計
- よく検索される列にインデックスを作成
- ただし、過度なインデックスは更新性能を低下させる

### 2. ビューの活用
- 複雑な集計処理を事前に定義
- アプリケーション側のコードを簡略化

### 3. 適切なデータ型選択
- 必要最小限のサイズを選択
- 例：boolean より CHAR(1) が効率的な場合もある

## 拡張性の考慮

### 将来的な機能追加への備え

#### 1. クイズカテゴリの階層化
```sql
-- 将来的にはカテゴリテーブルを分離可能
CREATE TABLE categories (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id INTEGER,
    FOREIGN KEY (parent_id) REFERENCES categories (id)
);
```

#### 2. ユーザーレベル・バッジ機能
```sql
-- 将来的な拡張例
CREATE TABLE user_achievements (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    achievement_type TEXT,
    earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
);
```

このデータベース設計により、ユーザー認証、クイズ管理、統計分析の全機能を効率的に実現できます。