// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyC1g2vKVbO9hQReaNJ2R3CaLX_0Lc3HwCQ",
    authDomain: "kinyan-26210.firebaseapp.com",
    projectId: "kinyan-26210",
    storageBucket: "kinyan-26210.firebasestorage.app",
    messagingSenderId: "443697566818",
    appId: "1:443697566818:web:ed548251d67df16e6bed3b",
    measurementId: "G-HM09TZR0HW"
};

let db = null;
let firebaseEnabled = false;

// Initialize Firebase
try {
    if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        
        db.settings({
            experimentalForceLongPolling: true,
            experimentalAutoDetectLongPolling: true
        });
        
        firebaseEnabled = true;
        console.log('Firebase initialized successfully');
    } else {
        console.log('Firebase not configured - running in local mode');
    }
} catch (error) {
    console.log('Firebase initialization failed - running in local mode:', error);
    firebaseEnabled = false;
}

// Game State
let currentQuiz = null;
let currentQuestionIndex = 0;
let quizData = null;
let userAnswers = {};
let needReviewQuestions = [];
let currentAttemptId = null;
let playerId = null;
let playerName = null;
let questionTimer = null;
let timeRemaining = 10;
let questionStage = 1; // 1 = large question, 2 = question + answers
let selectedAnswerIndex = null;
let totalQuestionsPerGame = 24;

// Initialize Player Identity
function initializePlayer() {
    playerId = localStorage.getItem('kinyan_player_id');
    if (!playerId) {
        playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
        localStorage.setItem('kinyan_player_id', playerId);
    }
    
    playerName = localStorage.getItem('kinyan_player_name') || 'שחקן אורח';
    document.getElementById('player-name-display').textContent = playerName;
    
    updateScoreDisplay();
}

// Get Cumulative Score
function getCumulativeScore() {
    const scoreKey = `kinyan_total_score_${playerId}`;
    return parseInt(localStorage.getItem(scoreKey) || '0');
}

// Update Cumulative Score
function updateCumulativeScore(points) {
    const scoreKey = `kinyan_total_score_${playerId}`;
    const currentScore = getCumulativeScore();
    const newScore = currentScore + points;
    localStorage.setItem(scoreKey, newScore.toString());
    updateScoreDisplay();
}

// Update Score Display
function updateScoreDisplay() {
    const score = getCumulativeScore();
    const scoreElement = document.getElementById('score-value');
    const scoreStr = score.toString().padStart(4, '0');
    
    let html = '';
    for (let i = 0; i < scoreStr.length; i++) {
        const digit = scoreStr[i];
        const isZero = digit === '0' && i < scoreStr.length - 1 && scoreStr.substring(i).match(/^0+$/);
        html += `<span class="digit ${isZero ? 'zero' : ''}">${digit}</span>`;
    }
    
    scoreElement.innerHTML = html;
}

// Get Used Questions
function getUsedQuestions(quizType) {
    const key = `kinyan_used_questions_${quizType}`;
    const used = localStorage.getItem(key);
    return used ? JSON.parse(used) : [];
}

// Save Used Questions
function saveUsedQuestions(quizType, questionIds) {
    const key = `kinyan_used_questions_${quizType}`;
    localStorage.setItem(key, JSON.stringify(questionIds));
}

// Filter Unused Questions
function filterUnusedQuestions(questions, quizType) {
    const usedIds = getUsedQuestions(quizType);
    const unused = questions.filter((q, index) => !usedIds.includes(index));
    
    // If all questions used, reset
    if (unused.length < totalQuestionsPerGame) {
        console.log('Resetting used questions - all questions have been used');
        saveUsedQuestions(quizType, []);
        return questions;
    }
    
    return unused;
}

// Start Quiz
async function startQuiz(quizType) {
    currentQuiz = quizType;
    currentQuestionIndex = 0;
    userAnswers = {};
    needReviewQuestions = [];
    selectedAnswerIndex = null;
    
    // Check for duplicate game prevention
    const lastGameKey = `kinyan_last_game_${playerId}`;
    const lastGame = localStorage.getItem(lastGameKey);
    if (lastGame) {
        const lastGameData = JSON.parse(lastGame);
        const timeSinceLastGame = Date.now() - lastGameData.timestamp;
        const oneHour = 60 * 60 * 1000;
        
        if (timeSinceLastGame < oneHour && lastGameData.quiz === quizType && lastGameData.completed) {
            showFeedback('המתן בבקשה', 'ניתן לשחק משחק נוסף רק לאחר שעה מהמשחק הקודם');
            return;
        }
    }
    
    await loadQuizData(quizType);
    await createNewAttempt();
    
    showScreen('screen-question');
    showQuestion();
}

// Load Quiz Data
async function loadQuizData(quizType) {
    const allQuestions = getDefaultQuizData(quizType);
    
    // Filter out used questions
    const availableQuestions = filterUnusedQuestions(allQuestions.questions, quizType);
    
    // Shuffle and take required number
    const shuffled = availableQuestions.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, totalQuestionsPerGame);
    
    quizData = {
        title: allQuestions.title,
        questions: selected
    };
    
    console.log(`Loaded ${selected.length} questions for ${quizType}`);
}

// Create New Attempt
async function createNewAttempt() {
    currentAttemptId = 'attempt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    
    if (firebaseEnabled && db) {
        try {
            await db.collection('attempts').doc(currentAttemptId).set({
                player_id: playerId,
                player_name: playerName,
                quiz_type: currentQuiz,
                started_at: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'in_progress',
                current_q_index: 0,
                answers: {},
                need_review: []
            });
        } catch (error) {
            console.error('Error creating attempt in Firebase:', error);
        }
    }
}

// Show Question
function showQuestion() {
    if (currentQuestionIndex >= quizData.questions.length) {
        endQuiz();
        return;
    }
    
    const question = quizData.questions[currentQuestionIndex];
    
    // Reset state
    questionStage = 1;
    selectedAnswerIndex = null;
    timeRemaining = 10;
    
    // Update UI
    document.getElementById('question-text').textContent = question.question;
    document.getElementById('question-text').className = 'question-text large';
    
    // Hide answers and action buttons
    document.getElementById('answers-grid').classList.remove('visible');
    document.getElementById('answers-grid').innerHTML = '';
    document.getElementById('action-buttons').classList.remove('visible');
    
    // Disable action buttons
    document.getElementById('btn-need-review').disabled = true;
    document.getElementById('btn-next-question').disabled = true;
    
    // Update progress
    updateProgress();
    
    // Start timer for stage 1
    startTimer();
}

// Start Timer
function startTimer() {
    updateTimerDisplay();
    
    if (questionTimer) {
        clearInterval(questionTimer);
    }
    
    questionTimer = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();
        
        if (timeRemaining <= 0) {
            clearInterval(questionTimer);
            
            if (questionStage === 1) {
                // Move to stage 2
                transitionToStage2();
            } else {
                // Timeout on stage 2
                handleTimeout();
            }
        }
    }, 1000);
}

// Update Timer Display
function updateTimerDisplay() {
    const timerNumber = document.getElementById('timer-number');
    const timerProgress = document.getElementById('timer-progress');
    
    timerNumber.textContent = timeRemaining;
    
    const maxTime = questionStage === 1 ? 10 : 30;
    const circumference = 2 * Math.PI * 42;
    const progress = (timeRemaining / maxTime) * circumference;
    timerProgress.style.strokeDasharray = `${progress} ${circumference}`;
    
    // Update color based on time
    timerProgress.classList.remove('normal', 'warning', 'danger');
    if (questionStage === 1) {
        timerProgress.classList.add('normal');
    } else {
        if (timeRemaining > 20) {
            timerProgress.classList.add('normal');
        } else if (timeRemaining > 10) {
            timerProgress.classList.add('warning');
        } else {
            timerProgress.classList.add('danger');
        }
    }
}

// Transition to Stage 2
function transitionToStage2() {
    questionStage = 2;
    timeRemaining = 30;
    
    const question = quizData.questions[currentQuestionIndex];
    
    // Shrink question
    const questionText = document.getElementById('question-text');
    questionText.classList.remove('large');
    questionText.classList.add('shrinking');
    
    // Show answers after animation
    setTimeout(() => {
        renderAnswers(question);
        document.getElementById('answers-grid').classList.add('visible');
    }, 300);
    
    // Restart timer for stage 2
    startTimer();
}

// Render Answers
function renderAnswers(question) {
    const answersGrid = document.getElementById('answers-grid');
    answersGrid.innerHTML = '';
    
    question.options.forEach((option, index) => {
        const button = document.createElement('button');
        button.className = 'answer-btn';
        button.textContent = option;
        button.onclick = () => selectAnswer(index);
        answersGrid.appendChild(button);
    });
}

// Select Answer
function selectAnswer(answerIndex) {
    if (selectedAnswerIndex !== null) return; // Already answered
    
    selectedAnswerIndex = answerIndex;
    userAnswers[`q${currentQuestionIndex}`] = answerIndex;
    
    // Stop timer
    if (questionTimer) {
        clearInterval(questionTimer);
    }
    
    // Visual feedback - subtle
    const buttons = document.querySelectorAll('.answer-btn');
    buttons.forEach((btn, idx) => {
        if (idx === answerIndex) {
            btn.classList.add('selected');
        }
        btn.disabled = true;
    });
    
    // Show action buttons
    document.getElementById('action-buttons').classList.add('visible');
    document.getElementById('btn-need-review').disabled = false;
    document.getElementById('btn-next-question').disabled = false;
    
    // Save to Firebase
    updateAttemptInDB();
    
    // Show subtle feedback
    showFeedback('התשובה נרשמה', 'בחר האם לעבור לשאלה הבאה או לסמן לעיון');
}

// Mark Need Review
function markNeedReview() {
    needReviewQuestions.push(currentQuestionIndex);
    
    // Save to Firebase
    if (firebaseEnabled && db && currentAttemptId) {
        db.collection('attempts').doc(currentAttemptId).update({
            need_review: needReviewQuestions
        }).catch(err => console.error('Error saving need review:', err));
    }
    
    showFeedback('סומן לעיון', 'השאלה נשמרה לעיון נוסף');
    
    setTimeout(() => {
        goToNextQuestion();
    }, 1000);
}

// Go to Next Question
function goToNextQuestion() {
    currentQuestionIndex++;
    showQuestion();
}

// Handle Timeout
function handleTimeout() {
    showFeedback('הזמן נגמר', 'עוברים לשאלה הבאה');
    
    setTimeout(() => {
        currentQuestionIndex++;
        showQuestion();
    }, 2000);
}

// Update Progress
function updateProgress() {
    const progress = ((currentQuestionIndex) / quizData.questions.length) * 100;
    document.getElementById('progress-bar').style.width = progress + '%';
    document.getElementById('progress-text').textContent = `${currentQuestionIndex} / ${quizData.questions.length}`;
}

// Update Attempt in DB
async function updateAttemptInDB() {
    if (!firebaseEnabled || !db || !currentAttemptId) return;
    
    try {
        await db.collection('attempts').doc(currentAttemptId).update({
            current_q_index: currentQuestionIndex,
            answers: userAnswers,
            need_review: needReviewQuestions,
            updated_at: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Error updating attempt:', error);
    }
}

// End Quiz
async function endQuiz() {
    // Calculate results
    let correctCount = 0;
    quizData.questions.forEach((question, index) => {
        const userAnswer = userAnswers[`q${index}`];
        if (userAnswer !== undefined && userAnswer === question.correctIndex) {
            correctCount++;
        }
    });
    
    const pointsEarned = correctCount * 10;
    
    // Update cumulative score
    updateCumulativeScore(pointsEarned);
    
    // Mark used questions
    const usedIds = quizData.questions.map((q, idx) => {
        const allQuestions = getDefaultQuizData(currentQuiz).questions;
        return allQuestions.findIndex(aq => aq.question === q.question);
    });
    const previousUsed = getUsedQuestions(currentQuiz);
    saveUsedQuestions(currentQuiz, [...previousUsed, ...usedIds]);
    
    // Save last game data
    const lastGameKey = `kinyan_last_game_${playerId}`;
    localStorage.setItem(lastGameKey, JSON.stringify({
        quiz: currentQuiz,
        timestamp: Date.now(),
        completed: true
    }));
    
    // Update Firebase
    if (firebaseEnabled && db && currentAttemptId) {
        try {
            await db.collection('attempts').doc(currentAttemptId).update({
                status: 'completed',
                completed_at: firebase.firestore.FieldValue.serverTimestamp(),
                correct_count: correctCount,
                total_questions: quizData.questions.length,
                points_earned: pointsEarned,
                need_review: needReviewQuestions
            });
        } catch (error) {
            console.error('Error completing attempt:', error);
        }
    }
    
    // Show results
    document.getElementById('final-score').textContent = pointsEarned;
    document.getElementById('correct-count').textContent = correctCount;
    document.getElementById('total-score-display').textContent = getCumulativeScore();
    document.getElementById('review-count').textContent = needReviewQuestions.length;
    
    showScreen('screen-results');
}

// Submit Lead Form
async function submitLeadForm(event) {
    event.preventDefault();
    
    const name = document.getElementById('lead-name').value;
    const phone = document.getElementById('lead-phone').value;
    const email = document.getElementById('lead-email').value;
    const marketingConsent = document.getElementById('marketing-consent').checked;
    
    // Save player name
    playerName = name;
    localStorage.setItem('kinyan_player_name', name);
    
    // Save to Firebase
    if (firebaseEnabled && db) {
        try {
            await db.collection('leads').add({
                player_id: playerId,
                name: name,
                phone: phone,
                email: email,
                marketing_consent: marketingConsent,
                quiz_type: currentQuiz,
                attempt_id: currentAttemptId,
                created_at: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Update attempt with contact info
            if (currentAttemptId) {
                await db.collection('attempts').doc(currentAttemptId).update({
                    player_name: name,
                    player_phone: phone,
                    player_email: email
                });
            }
            
            showFeedback('תודה רבה!', 'הפרטים נשמרו בהצלחה. נחזור אליך בקרוב!');
        } catch (error) {
            console.error('Error saving lead:', error);
            showFeedback('שגיאה', 'אירעה שגיאה בשמירת הפרטים. נסה שוב.');
        }
    } else {
        showFeedback('תודה רבה!', 'הפרטים נשמרו בהצלחה (מצב מקומי)');
    }
    
    setTimeout(() => {
        showScreen('screen-lobby');
    }, 3000);
}

// Show Screen
function showScreen(screenId) {
    const screens = ['screen-lobby', 'screen-question', 'screen-results'];
    screens.forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });
    document.getElementById(screenId).classList.remove('hidden');
}

// Show Feedback
function showFeedback(title, text) {
    const overlay = document.getElementById('feedback-overlay');
    document.getElementById('feedback-title').textContent = title;
    document.getElementById('feedback-text').textContent = text;
    
    overlay.classList.remove('hidden');
    
    setTimeout(() => {
        overlay.classList.add('hidden');
    }, 2000);
}

// Default Quiz Data
function getDefaultQuizData(quizType) {
    const shabbatQuestions = [
        {
            question: "אדם שהגיע לבית הכנסת בשבת והבחין שהוא שכח את הטלית בבית. הבית נמצא במרחק של 5 דקות הליכה בתוך העירוב. מה עליו לעשות?",
            options: [
                "אסור לחזור, כי אין חוזרים על טלית בשבת",
                "מותר לחזור, אבל רק אם עדיין לא התחילה התפילה",
                "מותר לחזור בכל מקרה, כי זה בתוך העירוב ולצורך מצווה"
            ],
            correctIndex: 1,
            explanation: "לפי השולחן עורך (או\"ח סי' ח), מותר לחזור על טלית רק אם עדיין לא התחיל להתפלל."
        },
        {
            question: "אישה הדליקה נרות שבת ושכחה לכבות את האור במטבח. האם מותר לה לבקש מבעלה (שעדיין לא קיבל שבת) לכבות?",
            options: [
                "אסור, כי היא כבר קיבלה שבת ואסור לה לגרום למלאכה",
                "מותר, כי הבעל עדיין לא קיבל שבת",
                "מותר רק אם יש חשש סכנה או הפסד ממון משמעותי"
            ],
            correctIndex: 0,
            explanation: "אף שהבעל עדיין לא קיבל שבת, האישה שכבר קיבלה שבת אסורה לבקש ממנו לעשות מלאכה עבורה."
        },
        {
            question: "ילד בן 11 ביקש לפתוח את האור בחדר בשבת. האם מותר לאב להניח לו?",
            options: [
                "מותר, כי קטן שעושה מלאכה מדעתו - אין מחויבים למנוע ממנו",
                "אסור, יש חיוב חינוך ולכן חייבים למנוע ממנו",
                "תלוי אם הוא כבר הגיע לגיל חינוך (בן 9-10) או לא"
            ],
            correctIndex: 1,
            explanation: "יש חיוב מדרבנן לחנך ילדים בשמירת שבת מגיל שמבין (בערך 6-7)."
        },
        {
            question: "אדם ששכח והדליק סיגריה בשבת (בשוגג). מה עליו לעשות?",
            options: [
                "לזרוק מיד את הסיגריה ולכבות אותה",
                "להניח את הסיגריה על משטח בטוח ולא לכבות",
                "להמשיך לעשן כי ממילא כבר עבר על האיסור"
            ],
            correctIndex: 1,
            explanation: "אסור לכבות את הסיגריה כי זו מלאכה נוספת. יש להניחה במקום בטוח."
        },
        {
            question: "משפחה שהלכה לטיול בשבת ושכחה את הבית פתוח. האם מותר לחזור לנעול?",
            options: [
                "מותר לחזור לנעול בגלל חשש גניבה",
                "אסור לחזור, אלא אם יש חשש סכנת נפשות",
                "מותר רק אם יש בבית חפצים יקרי ערך"
            ],
            correctIndex: 0,
            explanation: "מותר לחזור לנעול את הבית בשבת בגלל חשש גניבה (הפסד ממון)."
        },
        {
            question: "אדם שנזכר בשבת שלא הפריש תרומות ומעשרות מהפירות. האם מותר לו לאכול?",
            options: [
                "אסור לאכול עד מוצאי שבת",
                "מותר לאכול אם מפריש בלי ברכה",
                "מותר לאכול כי בזמן הזה אין חיוב תרומות ומעשרות מדאורייתא"
            ],
            correctIndex: 1,
            explanation: "מותר להפריש תרומות ומעשרות בשבת בלי ברכה, ואז מותר לאכול."
        },
        {
            question: "ילד שנפל ונחבל בשבת. האם מותר לחבוש את הפצע?",
            options: [
                "אסור, כי זו רפואה בשבת",
                "מותר רק אם יש סכנה",
                "מותר לחבוש אם יש דימום או כאב"
            ],
            correctIndex: 2,
            explanation: "מותר לחבוש פצע בשבת אם יש דימום או כאב, כי זה נחשב לצורך רפואי מותר."
        },
        {
            question: "אדם שהתחיל לאכול סעודה לפני שבת ונכנסה שבת. מה עליו לעשות?",
            options: [
                "להפסיק מיד לאכול",
                "מותר להמשיך לאכול עד סוף הסעודה",
                "מותר להמשיך רק אם כבר בירך המוציא"
            ],
            correctIndex: 1,
            explanation: "מי שהתחיל סעודה לפני שבת - מותר לו להמשיך עד סוף הסעודה."
        },
        {
            question: "אישה ששכחה להדליק נרות שבת. האם מותר לה להדליק אחרי כניסת השבת?",
            options: [
                "אסור בכל מקרה",
                "מותר להדליק בלי ברכה",
                "מותר להדליק עם ברכה אם עדיין לא התפללה"
            ],
            correctIndex: 0,
            explanation: "אסור להדליק נרות שבת אחרי כניסת השבת, גם בלי ברכה."
        },
        {
            question: "אדם שצריך לקחת תרופה בשבת. האם מותר?",
            options: [
                "אסור, אלא אם יש סכנה",
                "מותר לקחת תרופה לכל מחלה",
                "מותר רק למחלה שיש בה חולי כל הגוף"
            ],
            correctIndex: 2,
            explanation: "מותר לקחת תרופה בשבת רק למחלה שיש בה חולי כל הגוף (מוטל על מיטתו)."
        },
        {
            question: "משפחה שהגיעה לבית הכנסת ושכחה את התינוק בבית. האם מותר לחזור?",
            options: [
                "מותר לחזור מיד",
                "אסור לחזור, צריך לבקש ממישהו אחר",
                "מותר רק אם התינוק בוכה"
            ],
            correctIndex: 0,
            explanation: "מותר לחזור לתינוק בשבת כי זה צורך התינוק ואין בזה איסור."
        },
        {
            question: "אדם שנזכר שלא עירב תבשילין. האם מותר לו לבשל ביום טוב למחר?",
            options: [
                "אסור לבשל בלי עירוב תבשילין",
                "מותר לבשל אם יש צורך גדול",
                "מותר לבשל כי עירוב תבשילין הוא רק מנהג"
            ],
            correctIndex: 0,
            explanation: "אסור לבשל ביום טוב לשבת בלי עירוב תבשילין."
        },
        {
            question: "ילד שמצא כסף בשבת. האם מותר לו להרים?",
            options: [
                "אסור להרים כסף בשבת",
                "מותר להרים אם יש חשש שיגנבו",
                "מותר להרים בכל מקרה"
            ],
            correctIndex: 0,
            explanation: "אסור להרים כסף בשבת כי זה מוקצה."
        },
        {
            question: "אדם שצריך לצאת מהבית בשבת ויש גשם. האם מותר לפתוח מטריה?",
            options: [
                "אסור לפתוח מטריה בשבת",
                "מותר לפתוח אם יש גשם חזק",
                "מותר לפתוח מטריה שכבר הייתה פתוחה לפני שבת"
            ],
            correctIndex: 0,
            explanation: "אסור לפתוח מטריה בשבת כי זה בונה אהל."
        },
        {
            question: "משפחה שהכינה אוכל לשבת ונשאר אוכל רב. האם מותר לתת לשכנים?",
            options: [
                "מותר לתת בתוך העירוב",
                "אסור לתת כי זה הוצאה",
                "מותר רק אם השכנים צריכים"
            ],
            correctIndex: 0,
            explanation: "מותר לתת אוכל לשכנים בשבת בתוך העירוב."
        },
        {
            question: "אדם שנזכר שלא הדליק נר נשמה. האם מותר להדליק בשבת?",
            options: [
                "אסור להדליק בשבת",
                "מותר להדליק בלי ברכה",
                "מותר להדליק עם ברכה"
            ],
            correctIndex: 0,
            explanation: "אסור להדליק נר נשמה בשבת."
        },
        {
            question: "ילד שרוצה לשחק בכדור בשבת. האם מותר?",
            options: [
                "מותר לשחק בכדור בשבת",
                "אסור כי זה מוקצה",
                "מותר רק בחצר פרטית"
            ],
            correctIndex: 0,
            explanation: "מותר לשחק בכדור בשבת (לדעת רוב הפוסקים)."
        },
        {
            question: "אדם שצריך לקרוא ספר לימוד בשבת. האם מותר?",
            options: [
                "מותר לקרוא ספרי קודש בלבד",
                "מותר לקרוא כל ספר",
                "אסור לקרוא ספרי חול בשבת"
            ],
            correctIndex: 2,
            explanation: "אסור לקרוא ספרי חול בשבת (לדעת רוב הפוסקים)."
        },
        {
            question: "משפחה שהגיעה לבית ושכחה את המפתח בחוץ. האם מותר להיכנס דרך החלון?",
            options: [
                "מותר להיכנס דרך החלון",
                "אסור כי זה סכנה",
                "מותר רק אם אין ברירה אחרת"
            ],
            correctIndex: 0,
            explanation: "מותר להיכנס דרך החלון בשבת אם שכח את המפתח."
        },
        {
            question: "אדם שנזכר שלא בדק חמץ. האם מותר לבדוק בשבת?",
            options: [
                "מותר לבדוק בלי ברכה",
                "אסור לבדוק בשבת",
                "מותר לבדוק עם ברכה"
            ],
            correctIndex: 1,
            explanation: "אסור לבדוק חמץ בשבת."
        },
        {
            question: "ילד שרוצה לצייר בשבת. האם מותר?",
            options: [
                "מותר לצייר בשבת",
                "אסור לצייר בשבת",
                "מותר רק בצבעי מים"
            ],
            correctIndex: 1,
            explanation: "אסור לצייר בשבת כי זה כותב."
        },
        {
            question: "אדם שצריך להתקלח בשבת. האם מותר?",
            options: [
                "מותר להתקלח במים פושרים",
                "אסור להתקלח בשבת",
                "מותר להתקלח במים קרים בלבד"
            ],
            correctIndex: 0,
            explanation: "מותר להתקלח בשבת במים פושרים (שהוחמו לפני שבת)."
        },
        {
            question: "משפחה שהכינה סלט לשבת. האם מותר לחתוך ירקות נוספים?",
            options: [
                "מותר לחתוך לצורך הסעודה",
                "אסור לחתוך ירקות בשבת",
                "מותר רק אם חותכים בשינוי"
            ],
            correctIndex: 0,
            explanation: "מותר לחתוך ירקות בשבת לצורך הסעודה."
        },
        {
            question: "אדם שנזכר שלא הפריש חלה. האם מותר להפריש בשבת?",
            options: [
                "מותר להפריש בלי ברכה",
                "אסור להפריש בשבת",
                "מותר להפריש עם ברכה"
            ],
            correctIndex: 0,
            explanation: "מותר להפריש חלה בשבת בלי ברכה."
        }
    ];
    
    const issurHeterQuestions = [
        {
            question: "בשר שנמצא בשוק ואין עליו חותמת כשרות. האם מותר לאכול?",
            options: [
                "אסור לאכול בכל מקרה",
                "מותר אם רוב הבשר בשוק כשר",
                "מותר אם יש עדים שהבשר כשר"
            ],
            correctIndex: 0,
            explanation: "אסור לאכול בשר ללא חותמת כשרות, גם אם רוב הבשר בשוק כשר."
        },
        {
            question: "חלב שנמצא בבית ואין יודעים אם הוא חלבי או פרווה. מה הדין?",
            options: [
                "אסור לאכול עד שיבררו",
                "מותר לאכול כפרווה",
                "תלוי ברוב - אם רוב החלב בבית חלבי, זה חלבי"
            ],
            correctIndex: 2,
            explanation: "הולכים אחר הרוב - אם רוב החלב בבית חלבי, זה נחשב חלבי."
        },
        {
            question: "ביצה שנמצא בה טיפת דם. האם מותר לאכול?",
            options: [
                "אסור לאכול את הביצה",
                "מותר לאכול אחרי שמוציאים את הדם",
                "תלוי בגודל הדם"
            ],
            correctIndex: 1,
            explanation: "מותר לאכול את הביצה אחרי שמוציאים את טיפת הדם."
        },
        {
            question: "סכין בשרי שנפל לתוך סיר חלבי רותח. מה הדין?",
            options: [
                "הסיר והסכין אסורים",
                "הסיר מותר והסכין אסור",
                "תלוי בשיעור - אם יש פי 60, הכל מותר"
            ],
            correctIndex: 2,
            explanation: "אם יש בסיר פי 60 מהסכין, הכל מותר. אם לא - הסיר והסכין אסורים."
        },
        {
            question: "גבינה שיש עליה עובש. האם מותר לאכול?",
            options: [
                "אסור לאכול",
                "מותר לאכול אחרי שמסירים את העובש",
                "תלוי בסוג העובש"
            ],
            correctIndex: 1,
            explanation: "מותר לאכול גבינה עם עובש אחרי שמסירים את העובש והאזור מסביבו."
        },
        {
            question: "בשר שנשאר מחוץ למקרר כל הלילה. האם מותר לאכול?",
            options: [
                "אסור לאכול",
                "מותר לאכול אם מבשלים היטב",
                "תלוי בטמפרטורה"
            ],
            correctIndex: 2,
            explanation: "תלוי בטמפרטורה - אם היה קר, מותר. אם היה חם, אסור."
        },
        {
            question: "ירקות שנמצאו בהם חרקים. מה לעשות?",
            options: [
                "לזרוק את הירקות",
                "לשטוף היטב ולבדוק",
                "מותר לאכול אם מבשלים"
            ],
            correctIndex: 1,
            explanation: "צריך לשטוף היטב ולבדוק את הירקות. אם אי אפשר לבדוק - לא לאכול."
        },
        {
            question: "דג שאין לו סנפירים וקשקשים. האם מותר לאכול?",
            options: [
                "אסור לאכול",
                "מותר אם יש עדות שהוא כשר",
                "תלוי בסוג הדג"
            ],
            correctIndex: 0,
            explanation: "אסור לאכול דג ללא סנפירים וקשקשים."
        },
        {
            question: "חלב שהתערב עם מעט מים. האם מותר לשתות?",
            options: [
                "מותר לשתות",
                "אסור לשתות",
                "תלוי בשיעור המים"
            ],
            correctIndex: 0,
            explanation: "מותר לשתות חלב שהתערב עם מים."
        },
        {
            question: "בשר שנפל על הרצפה. האם מותר לאכול?",
            options: [
                "אסור לאכול",
                "מותר לאכול אחרי שטיפה",
                "תלוי בסוג הרצפה"
            ],
            correctIndex: 1,
            explanation: "מותר לאכול בשר שנפל על הרצפה אחרי שטיפה טובה."
        },
        {
            question: "גבינה שנעשתה ללא השגחה. האם מותר לאכול?",
            options: [
                "אסור לאכול",
                "מותר אם זו גבינה קשה",
                "מותר בכל מקרה"
            ],
            correctIndex: 0,
            explanation: "אסור לאכול גבינה ללא השגחה (גבינת עכו\"ם)."
        },
        {
            question: "יין שנגע בו גוי. מה הדין?",
            options: [
                "אסור לשתות",
                "מותר לשתות",
                "תלוי אם הגוי נגע בכוונה"
            ],
            correctIndex: 0,
            explanation: "אסור לשתות יין שנגע בו גוי (יין נסך)."
        },
        {
            question: "פירות שלא הופרשו תרומות ומעשרות. האם מותר לאכול?",
            options: [
                "אסור לאכול",
                "מותר לאכול אם מפריש בלי ברכה",
                "מותר בכל מקרה"
            ],
            correctIndex: 1,
            explanation: "מותר לאכול אחרי הפרשת תרומות ומעשרות (בלי ברכה בזמן הזה)."
        },
        {
            question: "בשר שנמלח יותר מ-72 שעות. מה הדין?",
            options: [
                "אסור לאכול",
                "מותר לאכול",
                "תלוי אם היה במקרר"
            ],
            correctIndex: 0,
            explanation: "אסור לאכול בשר שנמלח יותר מ-72 שעות ולא נשטף."
        },
        {
            question: "ביצים שנמצאו בתרנגולת שחוטה. האם מותר לאכול?",
            options: [
                "מותר לאכול",
                "אסור לאכול",
                "תלוי בגודל הביצים"
            ],
            correctIndex: 0,
            explanation: "מותר לאכול ביצים שנמצאו בתרנגולת שחוטה כשרה."
        },
        {
            question: "חלב שהתבשל עם בשר. מה הדין?",
            options: [
                "אסור לאכול",
                "מותר אם יש פי 60",
                "מותר בכל מקרה"
            ],
            correctIndex: 0,
            explanation: "אסור לאכול חלב שהתבשל עם בשר (בשר בחלב)."
        },
        {
            question: "דגים שנתפסו ברשת עם דגים לא כשרים. מה הדין?",
            options: [
                "אסור לאכול",
                "מותר אם רוב הדגים כשרים",
                "מותר בכל מקרה"
            ],
            correctIndex: 1,
            explanation: "מותר לאכול אם רוב הדגים ברשת כשרים (הולכים אחר הרוב)."
        },
        {
            question: "בשר שנשחט בסכין פגומה. מה הדין?",
            options: [
                "אסור לאכול",
                "מותר אם הפגם קטן",
                "תלוי בסוג הפגם"
            ],
            correctIndex: 2,
            explanation: "תלוי בסוג הפגם - יש לבדוק עם רב מומחה."
        },
        {
            question: "גבינה שנעשתה מחלב פרה שנחלבה בשבת. מה הדין?",
            options: [
                "אסור לאכול",
                "מותר לאכול",
                "תלוי מי חלב"
            ],
            correctIndex: 2,
            explanation: "תלוי מי חלב - אם גוי חלב בשבת, מותר לאכול אחר השבת."
        },
        {
            question: "פירות שגדלו בשביעית. האם מותר לאכול?",
            options: [
                "מותר לאכול עם קדושת שביעית",
                "אסור לאכול",
                "מותר בכל מקרה"
            ],
            correctIndex: 0,
            explanation: "מותר לאכול פירות שביעית, אבל יש להם קדושת שביעית."
        },
        {
            question: "בשר שנמצא בו גיד הנשה. מה הדין?",
            options: [
                "אסור לאכול את כל הבשר",
                "מותר לאכול אחרי הוצאת הגיד",
                "תלוי בגודל הגיד"
            ],
            correctIndex: 1,
            explanation: "מותר לאכול את הבשר אחרי הוצאת גיד הנשה על ידי מומחה."
        },
        {
            question: "חלב שנחלב ללא השגחה. מה הדין?",
            options: [
                "אסור לשתות",
                "מותר אם אין פרות לא כשרות באזור",
                "מותר בכל מקרה"
            ],
            correctIndex: 0,
            explanation: "אסור לשתות חלב ללא השגחה (חלב עכו\"ם)."
        },
        {
            question: "ביצים שנמצאו בהן אפרוח מתפתח. מה הדין?",
            options: [
                "אסור לאכול",
                "מותר לאכול אם האפרוח קטן",
                "מותר בכל מקרה"
            ],
            correctIndex: 0,
            explanation: "אסור לאכול ביצה שיש בה אפרוח מתפתח."
        },
        {
            question: "בשר שנמצא בו חלב. מה הדין?",
            options: [
                "אסור לאכול",
                "מותר אם יש פי 60",
                "מותר בכל מקרה"
            ],
            correctIndex: 1,
            explanation: "אם יש בבשר פי 60 מהחלב, מותר לאכול. אם לא - אסור."
        }
    ];
    
    if (quizType === 'shabbat') {
        return {
            title: 'הלכות שבת',
            questions: shabbatQuestions
        };
    } else {
        return {
            title: 'איסור והיתר',
            questions: issurHeterQuestions
        };
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializePlayer();
});
