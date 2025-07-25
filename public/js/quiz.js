// クイズ機能のメインJavaScript
// 認証チェックとページ初期化
document.addEventListener('DOMContentLoaded', async function() {
    // 非同期認証チェック
    const isAuth = await verifyAuthentication();
    if (!isAuth) {
        window.location.href = '/login.html';
        return;
    }

    initializeQuizPage();
});

// グローバル変数
let currentQuizzes = [];
let currentQuizIndex = 0;
let sessionStats = {
    totalQuestions: 0,
    correctAnswers: 0,
    currentStreak: 0,
    maxStreak: 0
};

// ページ初期化
function initializeQuizPage() {
    // DOM要素の取得
    const elements = {
        // 生成フォーム
        topicInput: document.getElementById('topic'),
        difficultySelect: document.getElementById('difficulty'),
        countSelect: document.getElementById('count'),
        generateBtn: document.getElementById('generateBtn'),
        
        // セクション
        quizGenerator: document.getElementById('quiz-generator'),
        loadingSection: document.getElementById('loading'),
        quizSection: document.getElementById('quiz-section'),
        resultSection: document.getElementById('result-section'),
        statsSection: document.getElementById('stats-section'),
        
        // クイズ表示
        quizTopic: document.getElementById('quiz-topic'),
        quizDifficulty: document.getElementById('quiz-difficulty'),
        quizProgress: document.getElementById('quiz-progress'),
        quizQuestion: document.getElementById('quiz-question'),
        quizOptions: document.getElementById('quiz-options'),
        
        // コントロール
        submitAnswer: document.getElementById('submitAnswer'),
        nextQuiz: document.getElementById('nextQuiz'),
        backToGenerator: document.getElementById('backToGenerator'),
        
        // 結果表示
        resultIcon: document.getElementById('result-icon'),
        resultTitle: document.getElementById('result-title'),
        resultExplanation: document.getElementById('result-explanation'),
        correctAnswer: document.getElementById('correct-answer'),
        userAnswer: document.getElementById('user-answer'),
        
        // 統計
        totalQuestions: document.getElementById('total-questions'),
        correctAnswersSpan: document.getElementById('correct-answers'),
        accuracyRate: document.getElementById('accuracy-rate'),
        currentStreak: document.getElementById('current-streak')
    };

    // イベントリスナーの設定
    setupEventListeners(elements);
    
    // 統計セクションを表示
    elements.statsSection.classList.remove('hidden');
    updateStatsDisplay(elements);
}

// イベントリスナーの設定
function setupEventListeners(elements) {
    // クイズ生成ボタン
    elements.generateBtn.addEventListener('click', () => {
        const topic = elements.topicInput.value.trim();
        const difficulty = parseInt(elements.difficultySelect.value);
        const count = parseInt(elements.countSelect.value);
        
        if (!topic) {
            showError('トピックを入力してください');
            return;
        }
        
        generateAIQuiz(topic, difficulty, count, elements);
    });


    // 選択肢クリック
    elements.quizOptions.addEventListener('click', (e) => {
        const optionBtn = e.target.closest('.option-btn');
        if (!optionBtn) return;
        
        selectOption(optionBtn, elements);
    });

    // 回答送信
    elements.submitAnswer.addEventListener('click', () => {
        submitQuizAnswer(elements);
    });

    // 次の問題
    elements.nextQuiz.addEventListener('click', () => {
        showNextQuiz(elements);
    });

    // 新しいクイズ生成に戻る
    elements.backToGenerator.addEventListener('click', () => {
        backToGenerator(elements);
    });

    // Enterキーでクイズ生成
    elements.topicInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            elements.generateBtn.click();
        }
    });

    // ログアウトボタン
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await logout();
        });
    }
}

// AIクイズ生成
async function generateAIQuiz(topic, difficulty, count, elements) {
    showLoading(elements);
    
    try {
        const endpoint = count === 1 ? '/api/quiz/generate' : '/api/quiz/generate-batch';
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ topic, difficulty, count })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'クイズの生成に失敗しました');
        }

        // レスポンス形式の統一
        if (count === 1) {
            currentQuizzes = [data.quiz];
        } else {
            currentQuizzes = data.quizzes || [];
        }

        if (currentQuizzes.length === 0) {
            throw new Error('クイズが生成されませんでした');
        }

        currentQuizIndex = 0;
        showSuccess(`${currentQuizzes.length}問のクイズを生成しました！`);
        displayQuiz(currentQuizzes[0], elements);

    } catch (error) {
        console.error('AIクイズ生成エラー:', error);
        showError(error.message);
        hideLoading(elements);
    }
}


// クイズ表示
function displayQuiz(quiz, elements) {
    hideLoading(elements);
    
    // クイズ情報の設定
    elements.quizTopic.textContent = `📚 ${quiz.topic}`;
    elements.quizDifficulty.textContent = `難易度: ${quiz.difficulty}`;
    elements.quizProgress.textContent = `問題 ${currentQuizIndex + 1}/${currentQuizzes.length}`;
    elements.quizQuestion.textContent = quiz.question;
    
    // 選択肢の設定
    const options = elements.quizOptions.querySelectorAll('.option-btn');
    options[0].querySelector('.option-text').textContent = quiz.option_a;
    options[1].querySelector('.option-text').textContent = quiz.option_b;
    options[2].querySelector('.option-text').textContent = quiz.option_c;
    options[3].querySelector('.option-text').textContent = quiz.option_d;
    
    // 選択状態をリセット
    options.forEach(btn => {
        btn.classList.remove('selected', 'correct', 'incorrect');
        btn.disabled = false;
    });
    
    // コントロールボタンの状態をリセット
    elements.submitAnswer.disabled = true;
    elements.submitAnswer.classList.remove('hidden'); // 隠されている場合は表示
    elements.nextQuiz.classList.add('hidden');
    elements.backToGenerator.classList.add('hidden');
    
    // セクション表示
    elements.quizGenerator.classList.add('hidden');
    elements.resultSection.classList.add('hidden');
    elements.quizSection.classList.remove('hidden');
}

// 選択肢選択
function selectOption(optionBtn, elements) {
    // 既存の選択を解除
    elements.quizOptions.querySelectorAll('.option-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    // 新しい選択を設定
    optionBtn.classList.add('selected');
    elements.submitAnswer.disabled = false;
}

// 回答送信
async function submitQuizAnswer(elements) {
    const selectedBtn = elements.quizOptions.querySelector('.option-btn.selected');
    if (!selectedBtn) return;
    
    const selectedAnswer = selectedBtn.dataset.answer;
    const currentQuiz = currentQuizzes[currentQuizIndex];
    
    try {
        const response = await fetch(`/api/quiz/${currentQuiz.id}/answer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ selectedAnswer })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || '回答の送信に失敗しました');
        }

        // 回答結果の処理
        processAnswerResult(data, selectedAnswer, elements);

    } catch (error) {
        console.error('回答送信エラー:', error);
        showError(error.message);
    }
}

// 回答結果の処理
function processAnswerResult(result, selectedAnswer, elements) {
    const isCorrect = result.correct;
    
    // 統計更新
    sessionStats.totalQuestions++;
    if (isCorrect) {
        sessionStats.correctAnswers++;
        sessionStats.currentStreak++;
        sessionStats.maxStreak = Math.max(sessionStats.maxStreak, sessionStats.currentStreak);
    } else {
        sessionStats.currentStreak = 0;
    }
    
    // 選択肢の視覚的フィードバック
    const options = elements.quizOptions.querySelectorAll('.option-btn');
    options.forEach(btn => {
        btn.disabled = true;
        if (btn.dataset.answer === result.correctAnswer) {
            btn.classList.add('correct');
        } else if (btn.dataset.answer === selectedAnswer && !isCorrect) {
            btn.classList.add('incorrect');
        }
    });
    
    // 結果表示
    elements.resultIcon.textContent = isCorrect ? '✅' : '❌';
    elements.resultTitle.textContent = isCorrect ? '正解！' : '不正解';
    elements.resultExplanation.textContent = result.explanation || '解説はありません';
    elements.correctAnswer.textContent = result.correctAnswer;
    elements.userAnswer.textContent = selectedAnswer;
    
    // コントロールボタンの更新
    elements.submitAnswer.classList.add('hidden');
    
    if (currentQuizIndex < currentQuizzes.length - 1) {
        elements.nextQuiz.classList.remove('hidden');
    } else {
        elements.backToGenerator.classList.remove('hidden');
    }
    
    // 結果セクション表示
    elements.resultSection.classList.remove('hidden');
    
    // 統計更新
    updateStatsDisplay(elements);
    
    // 成功/失敗メッセージ
    if (isCorrect) {
        showSuccess('正解です！');
    } else {
        showError('不正解でした。次も頑張りましょう！');
    }
}

// 次のクイズ表示
function showNextQuiz(elements) {
    currentQuizIndex++;
    if (currentQuizIndex < currentQuizzes.length) {
        displayQuiz(currentQuizzes[currentQuizIndex], elements);
    }
}

// 生成画面に戻る
function backToGenerator(elements) {
    elements.quizSection.classList.add('hidden');
    elements.resultSection.classList.add('hidden');
    elements.quizGenerator.classList.remove('hidden');
    
    // フォームをリセット
    document.getElementById('topic').value = '';
    document.getElementById('difficulty').selectedIndex = 1; // 初中級
    document.getElementById('count').selectedIndex = 0; // 1問
    
    // データをリセット
    currentQuizzes = [];
    currentQuizIndex = 0;
}

// 統計表示更新
function updateStatsDisplay(elements) {
    elements.totalQuestions.textContent = sessionStats.totalQuestions;
    elements.correctAnswersSpan.textContent = sessionStats.correctAnswers;
    
    const accuracy = sessionStats.totalQuestions > 0 
        ? Math.round((sessionStats.correctAnswers / sessionStats.totalQuestions) * 100)
        : 0;
    elements.accuracyRate.textContent = `${accuracy}%`;
    elements.currentStreak.textContent = sessionStats.currentStreak;
}

// ローディング表示
function showLoading(elements) {
    elements.quizGenerator.classList.add('hidden');
    elements.quizSection.classList.add('hidden');
    elements.resultSection.classList.add('hidden');
    elements.loadingSection.classList.remove('hidden');
}

// ローディング非表示
function hideLoading(elements) {
    elements.loadingSection.classList.add('hidden');
}

// エラーメッセージ表示
function showError(message) {
    const errorDiv = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');
    
    errorText.textContent = message;
    errorDiv.classList.remove('hidden');
    
    // 5秒後に自動で非表示
    setTimeout(() => {
        errorDiv.classList.add('hidden');
    }, 5000);
}

// 成功メッセージ表示
function showSuccess(message) {
    const successDiv = document.getElementById('success-message');
    const successText = document.getElementById('success-text');
    
    successText.textContent = message;
    successDiv.classList.remove('hidden');
    
    // 3秒後に自動で非表示
    setTimeout(() => {
        successDiv.classList.add('hidden');
    }, 3000);
}

// メッセージクローズボタンのイベントリスナー
document.addEventListener('DOMContentLoaded', function() {
    // エラーメッセージクローズ
    const closeErrorBtn = document.getElementById('close-error');
    if (closeErrorBtn) {
        closeErrorBtn.addEventListener('click', () => {
            document.getElementById('error-message').classList.add('hidden');
        });
    }
    
    // 成功メッセージクローズ
    const closeSuccessBtn = document.getElementById('close-success');
    if (closeSuccessBtn) {
        closeSuccessBtn.addEventListener('click', () => {
            document.getElementById('success-message').classList.add('hidden');
        });
    }
});