const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// データベースファイルのパス
const dbPath = process.env.DATABASE_PATH || './database/quiz.db';

// データベース接続
let db;

function initializeDatabase() {
  return new Promise((resolve, reject) => {
    try {
      // データベースの作成・接続
      db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('データベース接続エラー:', err.message);
          reject(err);
          return;
        }
        
        console.log('データベース接続が確立されました:', dbPath);
        
        // 外部キー制約を有効化
        db.run('PRAGMA foreign_keys = ON', (err) => {
          if (err) {
            console.error('外部キー制約設定エラー:', err.message);
            reject(err);
            return;
          }
          
          // スキーマファイルの読み込みと実行
          const schemaPath = path.join(__dirname, 'schema.sql');
          const schema = fs.readFileSync(schemaPath, 'utf8');
          
          // スキーマを実行
          db.exec(schema, (err) => {
            if (err) {
              console.error('スキーマ実行エラー:', err.message);
              reject(err);
              return;
            }
            
            console.log('データベーススキーマが正常に初期化されました');
            resolve(db);
          });
        });
      });
    } catch (error) {
      console.error('データベース初期化エラー:', error);
      reject(error);
    }
  });
}

// データベース接続を取得
function getDatabase() {
  if (!db) {
    throw new Error('データベースが初期化されていません');
  }
  return db;
}

// アプリケーション終了時のクリーンアップ
function closeDatabase() {
  return new Promise((resolve) => {
    if (db) {
      db.close((err) => {
        if (err) {
          console.error('データベースクローズエラー:', err.message);
        } else {
          console.log('データベース接続が閉じられました');
        }
        resolve();
      });
    } else {
      resolve();
    }
  });
}

// プロセス終了時の処理
process.on('SIGINT', async () => {
  await closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeDatabase();
  process.exit(0);
});

module.exports = {
  initializeDatabase,
  getDatabase,
  closeDatabase
};