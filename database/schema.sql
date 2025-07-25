-- AIクイズ生成アプリ データベーススキーマ

-- ユーザーテーブル
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ユーザーテーブルのインデックス
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- クイズテーブル
CREATE TABLE IF NOT EXISTS quizzes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic TEXT NOT NULL,
    question TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_answer CHAR(1) NOT NULL CHECK (correct_answer IN ('A', 'B', 'C', 'D')),
    difficulty INTEGER DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
    explanation TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- クイズテーブルのインデックス
CREATE INDEX IF NOT EXISTS idx_quizzes_topic ON quizzes(topic);
CREATE INDEX IF NOT EXISTS idx_quizzes_difficulty ON quizzes(difficulty);
CREATE INDEX IF NOT EXISTS idx_quizzes_created_at ON quizzes(created_at);

-- ユーザー回答履歴テーブル
CREATE TABLE IF NOT EXISTS user_answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    quiz_id INTEGER NOT NULL,
    selected_answer CHAR(1) NOT NULL CHECK (selected_answer IN ('A', 'B', 'C', 'D')),
    is_correct BOOLEAN NOT NULL,
    answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (quiz_id) REFERENCES quizzes (id) ON DELETE CASCADE
);

-- ユーザー回答履歴テーブルのインデックス
CREATE INDEX IF NOT EXISTS idx_user_answers_user_id ON user_answers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_answers_quiz_id ON user_answers(quiz_id);
CREATE INDEX IF NOT EXISTS idx_user_answers_answered_at ON user_answers(answered_at);
CREATE INDEX IF NOT EXISTS idx_user_answers_user_quiz ON user_answers(user_id, quiz_id);

-- ユーザー統計ビュー（正答率計算用）
CREATE VIEW IF NOT EXISTS user_stats AS
SELECT 
    u.id as user_id,
    u.username,
    COUNT(ua.id) as total_answers,
    SUM(CASE WHEN ua.is_correct = 1 THEN 1 ELSE 0 END) as correct_answers,
    ROUND(
        (SUM(CASE WHEN ua.is_correct = 1 THEN 1 ELSE 0 END) * 100.0) / COUNT(ua.id), 
        2
    ) as accuracy_percentage,
    MIN(ua.answered_at) as first_quiz_date,
    MAX(ua.answered_at) as last_quiz_date
FROM users u
LEFT JOIN user_answers ua ON u.id = ua.user_id
GROUP BY u.id, u.username;

-- トピック別統計ビュー
CREATE VIEW IF NOT EXISTS topic_stats AS
SELECT 
    q.topic,
    COUNT(DISTINCT q.id) as total_questions,
    COUNT(ua.id) as total_attempts,
    SUM(CASE WHEN ua.is_correct = 1 THEN 1 ELSE 0 END) as correct_attempts,
    ROUND(
        (SUM(CASE WHEN ua.is_correct = 1 THEN 1 ELSE 0 END) * 100.0) / COUNT(ua.id), 
        2
    ) as topic_accuracy
FROM quizzes q
LEFT JOIN user_answers ua ON q.id = ua.quiz_id
GROUP BY q.topic
HAVING COUNT(ua.id) > 0;

-- 初期データの挿入（テスト用）
INSERT OR IGNORE INTO users (username, email, password_hash) VALUES 
('test_user', 'test@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3Fb9zVgQjK');

-- サンプルクイズデータ
INSERT OR IGNORE INTO quizzes (topic, question, option_a, option_b, option_c, option_d, correct_answer, difficulty) VALUES 
('プログラミング基礎', 'JavaScriptで変数を宣言するキーワードはどれですか？', 'var', 'int', 'string', 'char', 'A', 1),
('プログラミング基礎', 'HTMLの略称は何ですか？', 'HyperText Markup Language', 'Home Tool Markup Language', 'Hyperlinks and Text Markup Language', 'High-level Text Markup Language', 'A', 1),
('数学', '2の3乗はいくつですか？', '6', '8', '9', '12', 'B', 1),
('歴史', '日本で最初の元号は何ですか？', '大化', '白雉', '朱鳥', '大宝', 'A', 2);