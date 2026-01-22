const CSV_URLS = {
    shabbat: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTms4MIHYC7w0sRgy0I_4hg1967D_snpA9BUcT2NTwuZRxbRb_mzkZ6kScFXLfJGbT_t3cDXTPBxomc/pub?gid=0&single=true&output=tsv',
    issur_heter: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTms4MIHYC7w0sRgy0I_4hg1967D_snpA9BUcT2NTwuZRxbRb_mzkZ6kScFXLfJGbT_t3cDXTPBxomc/pub?gid=1643191626&single=true&output=tsv'
};

const QUESTIONS_TO_SHOW = 10;

let firebaseConfig = {
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

try {
    if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        
        db.settings({
            experimentalForceLongPolling: true
        });
        
        firebaseEnabled = true;
        console.log('Firebase initialized successfully with Long Polling (NetFree compatible)');
    } else {
        console.log('Firebase not configured - running in local mode');
    }
} catch (error) {
    console.log('Firebase initialization failed - running in local mode:', error);
    firebaseEnabled = false;
}

let currentQuiz = null;
let currentQuestionIndex = 0;
let userAnswers = {};
let currentAttemptId = null;
let quizData = null;
let userData = {
    phone: null,
    name: null,
    email: null
};
let csvCache = {};
let questionTimer = null;
let timeRemaining = 30;
let questionAnswerStatus = {};

function showScreen(screenId) {
    const screens = ['screen-lobby', 'screen-question', 'screen-lead-collection', 'screen-results', 'screen-already-completed'];
    screens.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.classList.add('hidden');
        }
    });
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

async function startQuiz(quizType) {
    currentQuiz = quizType;
    currentQuestionIndex = 0;
    userAnswers = {};
    questionAnswerStatus = {};
    
    // Show quiz type badge
    const quizTypeBadge = document.getElementById('quiz-type-badge');
    if (quizTypeBadge) {
        quizTypeBadge.textContent = quizType === 'shabbat' ? 'אתגר פסיקה בהלכות שבת' : 'אתגר פסיקה באיסור והיתר';
        quizTypeBadge.classList.remove('hidden');
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    const resumeMode = urlParams.get('resume');
    const resumePhone = urlParams.get('phone');
    const resumeQuiz = urlParams.get('quiz');
    
    if (resumeMode && resumePhone && resumeQuiz === quizType) {
        await resumeQuizFromPause(resumePhone, quizType);
    } else {
        await loadQuizData(quizType);
        await createNewAttempt();
        showQuestion();
    }
}

async function loadQuizData(quizType) {
    if (csvCache[quizType]) {
        quizData = csvCache[quizType];
        return;
    }
    
    try {
        const csvUrl = CSV_URLS[quizType];
        if (csvUrl && !csvUrl.includes('YOUR_')) {
            const response = await fetch(csvUrl);
            const csvText = await response.text();
            quizData = parseCSV(csvText, quizType);
            csvCache[quizType] = quizData;
            console.log('Questions loaded from CSV successfully');
        } else {
            alert('שגיאה: URL של הגליון לא מוגדר כראוי.');
            throw new Error('CSV URL not configured');
        }
    } catch (error) {
        console.error('Error loading CSV:', error);
        alert('שגיאה בטעינת השאלות מהגליון. אנא בדוק את החיבור לאינטרנט ונסה שוב.');
        showScreen('screen-lobby');
        throw error;
    }
}

function parseCSV(csvText, quizType) {
    const lines = csvText.split('\n').filter(line => line.trim());
    const allQuestions = [];
    
    for (let i = 1; i < lines.length; i++) {
        const parts = parseCSVLine(lines[i]);
        if (parts.length >= 7) {
            allQuestions.push({
                question: parts[0],
                options: [parts[1], parts[2], parts[3]],
                correctIndex: parseInt(parts[4]) - 1,
                partialIndex: parseInt(parts[5]) - 1,
                explanation: parts[6]
            });
        }
    }
    
    // Select random questions from the bank
    const selectedQuestions = selectRandomQuestions(allQuestions, QUESTIONS_TO_SHOW);
    
    if (selectedQuestions.length === 0) {
        alert('שגיאה: לא נמצאו שאלות בגליון. אנא וודא שהגליון מכיל לפחות שאלה אחת בפורמט הנכון.');
        throw new Error('No questions found in spreadsheet');
    }
    
    return {
        title: quizType === 'shabbat' ? 'הלכות שבת' : 'איסור והיתר',
        questions: selectedQuestions
    };
}

function selectRandomQuestions(questions, count) {
    if (questions.length <= count) {
        return shuffleArray([...questions]);
    }
    
    const shuffled = shuffleArray([...questions]);
    return shuffled.slice(0, count);
}

function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    // Support both CSV (comma) and TSV (tab)
    const delimiter = line.includes('\t') ? '\t' : ',';
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
            // Don't add the quote character itself
        } else if (char === delimiter && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current.trim());
    return result;
}

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
            explanation: "לפי השולחן עורך (או\"ח סי' ח), מותר לחזור על טלית רק אם עדיין לא התחיל להתפלל. אם כבר התחיל - אסור לחזור."
        },
        {
            question: "אישה הדליקה נרות שבת ושכחה לכבות את האור במטבח. האם מותר לה לבקש מבעלה (שעדיין לא קיבל שבת) לכבות?",
            options: [
                "אסור, כי היא כבר קיבלה שבת ואסור לה לגרום למלאכה",
                "מותר, כי הבעל עדיין לא קיבל שבת",
                "מותר רק אם יש חשש סכנה או הפסד ממון משמעותי"
            ],
            correctIndex: 0,
            explanation: "אף שהבעל עדיין לא קיבל שבת, האישה שכבר קיבלה שבת אסורה לבקש ממנו לעשות מלאכה עבורה (משנה ברורה)."
        },
        {
            question: "ילד בן 11 ביקש לפתוח את האור בחדר בשבת. האם מותר לאב להניח לו?",
            options: [
                "מותר, כי קטן שעושה מלאכה מדעתו - אין מחויבים למנוע ממנו",
                "אסור, יש חיוב חינוך ולכן חייבים למנוע ממנו",
                "תלוי אם הוא כבר הגיע לגיל חינוך (בן 9-10) או לא"
            ],
            correctIndex: 1,
            explanation: "יש חיוב מדרבנן לחנך ילדים בשמירת שבת מגיל שמבין (בערך 6-7). לכן חייבים למנוע מילד לעשות מלאכה בשבת."
        },
        {
            question: "אדם ששכח והדליק סיגריה בשבת (בשוגג). מה עליו לעשות?",
            options: [
                "לזרוק מיד את הסיגריה ולכבות אותה",
                "להניח את הסיגריה על משטח בטוח ולא לכבות",
                "להמשיך לעשן כי ממילא כבר עבר על האיסור"
            ],
            correctIndex: 1,
            explanation: "אסור לכבות את הסיגריה כי זו מלאכה נוספת. יש להניחה במקום בטוח ולא לכבות (שו\"ע ומשנה ברורה)."
        },
        {
            question: "תינוק שבכה בשבת והאם צריכה לחמם לו בקבוק. יש לה מים חמים מהקומקום החשמלי שהיה דולק מערב שבת. האם מותר לשפוך ישירות על הבקבוק?",
            options: [
                "מותר, כי זה צורך התינוק והמים כבר חמים",
                "אסור, כי זה בישול על ידי שפיכת רותחין",
                "מותר רק אם תשפוך תחילה לכלי שני ואז לבקבוק"
            ],
            correctIndex: 2,
            explanation: "שפיכת מים רותחים ישירות מכלי ראשון על מזון נחשבת בישול. יש לשפוך תחילה לכלי שני (כוס) ואז לבקבוק."
        }
    ];
    
    const issurHeterQuestions = [
        {
            question: "אישה מצאה חרק קטן בכרוב שקנתה. האם מותר לה לחתוך את האזור ולהשתמש בשאר הכרוב?",
            options: [
                "מותר, כי די להסיר את האזור הנגוע",
                "אסור, צריך לזרוק את כל הכרוב",
                "תלוי בסוג החרק - אם זה כינה או תולעת"
            ],
            correctIndex: 1,
            explanation: "כרוב שנמצא בו חרק נחשב למוחזק בתולעים, ויש לבדוק היטב או לזרוק. בדרך כלל ממליצים לזרוק כי קשה לבדוק לעומק."
        },
        {
            question: "בשר עוף שנשאר מחוץ למקרר למשך 4 שעות בקיץ. האם מותר לאכול אותו?",
            options: [
                "מותר, כי 4 שעות זה לא מספיק זמן להפסד",
                "אסור מצד סכנת נפשות",
                "מותר אם מבשלים היטב"
            ],
            correctIndex: 1,
            explanation: "בשר עוף שנשאר בחוץ בטמפרטורה גבוהה מעל שעתיים נחשב למסוכן בריאותית ואסור באכילה (סכנת סלמונלה)."
        },
        {
            question: "גבינה צהובה שנמצאה בה נקודה ירוקה קטנה של עובש. מה הדין?",
            options: [
                "מותר לחתוך את הנקודה ולאכול את השאר",
                "אסור לאכול את כל הגבינה",
                "תלוי בגודל הנקודה - אם קטנה מ-1 ס\"ם מותר"
            ],
            correctIndex: 0,
            explanation: "בגבינה קשה, מותר לחתוך את אזור העובש עם מרווח של כ-2 ס\"ם מסביב ולאכול את השאר."
        },
        {
            question: "ירקות קפואים שהופשרו במקרר והוחזרו להקפאה. האם מותר לאכול אותם?",
            options: [
                "מותר בלי בעיה",
                "אסור, כי הם כבר הופשרו פעם",
                "מותר רק אם לא הופשרו לגמרי"
            ],
            correctIndex: 2,
            explanation: "אם הירקות הופשרו חלקית בלבד (עדיין היו גבישי קרח) - מותר להקפיא שוב. אם הופשרו לגמרי - לא מומלץ מבחינה בריאותית."
        },
        {
            question: "תבשיל חלבי שנתערב בו בטעות כף בשרית נקייה. מה הדין?",
            options: [
                "התבשיל אסור באכילה",
                "התבשיל מותר, רק הכף צריכה הכשר",
                "תלוי אם התבשיל היה חם או קר"
            ],
            correctIndex: 2,
            explanation: "אם התבשיל היה קר והכף נקייה - התבשיל מותר. אם התבשיל היה חם (יד סולדת בו) - יש בעיה של בליעת טעם ויש להתייעץ עם רב."
        }
    ];
    
    return {
        title: quizType === 'shabbat' ? 'הלכות שבת' : 'איסור והיתר',
        questions: quizType === 'shabbat' ? shabbatQuestions : issurHeterQuestions
    };
}

async function createNewAttempt() {
    currentAttemptId = 'local_' + Date.now();
    
    if (firebaseEnabled && db) {
        try {
            const attemptData = {
                user_phone: userData.phone || 'anonymous',
                quiz_type: currentQuiz,
                status: 'active',
                current_q_index: 0,
                answers: {},
                final_score: 0,
                selected_benefit: null,
                created_at: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            const docRef = await Promise.race([
                db.collection('attempts').add(attemptData),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Firebase timeout')), 2000))
            ]);
            currentAttemptId = docRef.id;
            console.log('Firebase attempt created:', currentAttemptId);
        } catch (error) {
            console.log('Using local attempt ID (Firebase unavailable):', currentAttemptId);
        }
    }
}

async function showQuestion() {
    console.log('showQuestion called for question index:', currentQuestionIndex);
    
    if (currentQuestionIndex >= quizData.questions.length) {
        stopTimer();
        showScreen('screen-lead-collection');
        return;
    }
    
    const question = quizData.questions[currentQuestionIndex];
    console.log('Question data:', question);
    
    const questionTextEl = document.getElementById('question-text');
    const questionContainer = document.querySelector('.question-container');
    const timerDisplay = document.querySelector('.timer-display');
    const answersContainer = document.getElementById('answers-container');
    
    showScreen('screen-question');
    updateProgressCircles();
    
    // Clear previous content
    questionTextEl.textContent = '';
    answersContainer.innerHTML = '';
    
    // Phase 1: Full-screen intro with typing animation
    questionTextEl.classList.add('intro', 'typing');
    questionContainer.classList.add('intro');
    timerDisplay.classList.add('hidden-intro');
    
    // Adjust font size based on question length
    adjustQuestionFontSize(questionTextEl, question.question);
    
    // Type the question
    await typeText(questionTextEl, question.question, 60);
    
    // Remove typing cursor
    questionTextEl.classList.remove('typing');
    
    // Wait 1.5 seconds
    await sleep(1500);
    
    // Phase 2: Transition to normal layout (just scale down, no position change)
    questionTextEl.classList.remove('intro');
    questionContainer.classList.remove('intro');
    timerDisplay.classList.remove('hidden-intro');
    
    // Wait for transition
    await sleep(600);
    
    // Phase 3: Show answers one by one
    console.log('Creating answer buttons, options:', question.options);
    question.options.forEach((option, index) => {
        const button = document.createElement('button');
        button.className = 'answer-option';
        button.textContent = option;
        button.onclick = () => selectAnswer(index);
        
        if (userAnswers[`q${currentQuestionIndex}`] === index) {
            button.classList.add('selected');
        }
        
        answersContainer.appendChild(button);
    });
    
    // Stagger the answer appearance
    const answerButtons = answersContainer.querySelectorAll('.answer-option');
    for (let i = 0; i < answerButtons.length; i++) {
        await sleep(200);
        answerButtons[i].classList.add('appear');
    }
    
    // Wait for all answers to appear
    await sleep(500);
    
    // Phase 4: Start the timer
    startTimer();
}

function typeText(element, text, speed = 60) {
    return new Promise((resolve) => {
        let index = 0;
        element.textContent = '';
        
        const interval = setInterval(() => {
            if (index < text.length) {
                element.textContent += text[index];
                index++;
            } else {
                clearInterval(interval);
                resolve();
            }
        }, speed);
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function adjustQuestionFontSize(element, text) {
    const length = text.length;
    let fontSize;
    
    if (length > 300) {
        fontSize = 'clamp(1.8rem, 2.5vw, 2.5rem)';
    } else if (length > 200) {
        fontSize = 'clamp(2rem, 3vw, 3.5rem)';
    } else if (length > 150) {
        fontSize = 'clamp(2.5rem, 3.5vw, 4rem)';
    } else {
        fontSize = 'clamp(2.5rem, 4vw, 5rem)';
    }
    
    element.style.fontSize = fontSize;
}

function updateProgressCircles() {
    if (!quizData || !quizData.questions) {
        console.log('Quiz data not loaded yet');
        return;
    }
    
    const totalQuestions = quizData.questions.length;
    const progressCircles = document.getElementById('progress-circles');
    
    if (progressCircles) {
        progressCircles.innerHTML = '<div class="progress-line"></div>';
        
        for (let i = 0; i < totalQuestions; i++) {
            const circle = document.createElement('div');
            circle.className = 'progress-circle';
            
            const status = questionAnswerStatus[`q${i}`];
            const isCurrent = i === currentQuestionIndex;
            
            if (isCurrent) {
                circle.classList.add('active');
            } else if (status === 'correct') {
                circle.classList.add('correct');
            } else if (status === 'wrong') {
                circle.classList.add('wrong');
            } else if (status === 'timeout') {
                circle.classList.add('timeout');
            }
            
            circle.textContent = i + 1;
            progressCircles.appendChild(circle);
        }
    }
}

function startTimer() {
    timeRemaining = 30;
    updateTimerDisplay();
    
    if (questionTimer) {
        clearInterval(questionTimer);
    }
    
    questionTimer = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();
        
        if (timeRemaining <= 0) {
            clearInterval(questionTimer);
            handleTimeout();
        }
    }, 1000);
}

function stopTimer() {
    if (questionTimer) {
        clearInterval(questionTimer);
        questionTimer = null;
    }
}

function updateTimerDisplay() {
    const timerNumber = document.getElementById('timer-number');
    const timerProgress = document.getElementById('timer-progress');
    
    if (timerNumber) {
        timerNumber.textContent = timeRemaining;
    }
    
    if (timerProgress) {
        const circumference = 2 * Math.PI * 52;
        const progress = (timeRemaining / 30) * circumference;
        timerProgress.style.strokeDasharray = `${progress} ${circumference}`;
        
        timerProgress.classList.remove('normal', 'warning', 'danger');
        if (timeRemaining > 19) {
            timerProgress.classList.add('normal');
        } else if (timeRemaining > 9) {
            timerProgress.classList.add('warning');
        } else {
            timerProgress.classList.add('danger');
        }
    }
}

function handleTimeout() {
    const message = document.createElement('div');
    message.className = 'feedback-message timeout';
    message.innerHTML = `
        <h3 style="font-size: 2.5rem; color: var(--gold); margin-bottom: 1rem;">הזמן נגמר!</h3>
        <p style="font-size: 1.3rem; color: var(--dark-slate);">גם מורה הוראה צריך לפעמים לפתוח ספר...<br>עוברים לשאלה המעשית הבאה</p>
    `;
    document.body.appendChild(message);
    
    questionAnswerStatus[`q${currentQuestionIndex}`] = 'timeout';
    
    setTimeout(() => {
        message.remove();
        currentQuestionIndex++;
        showQuestion();
    }, 2500);
}

function showFeedbackMessage(answerStatus) {
    const messages = {
        correct: [
            'מעניין...',
            'הבנתי את הכיוון שלך',
            'אוקיי, רשמתי'
        ],
        partial: [
            'מעניין...',
            'הבנתי את הכיוון שלך',
            'אוקיי, רשמתי'
        ],
        wrong: [
            'מעניין...',
            'הבנתי את הכיוון שלך',
            'אוקיי, רשמתי'
        ]
    };
    
    const messageArray = messages[answerStatus] || messages.wrong;
    const randomMessage = messageArray[Math.floor(Math.random() * messageArray.length)];
    
    const colors = {
        correct: '#22c55e',
        partial: '#f59e0b',
        wrong: '#ef4444'
    };
    
    const message = document.createElement('div');
    message.className = `feedback-message ${answerStatus}`;
    message.innerHTML = `
        <p style="font-size: 3.5rem; color: var(--gold); font-weight: bold; margin-bottom: 1rem;">${randomMessage}</p>
        <p style="font-size: 1.5rem; color: var(--dark-slate);">עוברים לשאלה הבאה</p>
    `;
    document.body.appendChild(message);
    
    setTimeout(() => message.remove(), 1500);
}

function createConfetti() {
    for (let i = 0; i < 30; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * window.innerWidth + 'px';
            confetti.style.top = '-10px';
            confetti.style.background = ['#D4B182', '#b89968', '#e8d4b8'][Math.floor(Math.random() * 3)];
            confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
            document.body.appendChild(confetti);
            
            setTimeout(() => confetti.remove(), 1000);
        }, i * 30);
    }
}

async function selectAnswer(answerIndex) {
    stopTimer();
    
    userAnswers[`q${currentQuestionIndex}`] = answerIndex;
    const question = quizData.questions[currentQuestionIndex];
    const correctAnswer = question.correctIndex;
    const partialAnswer = question.partialIndex;
    
    let answerStatus = 'wrong';
    if (answerIndex === correctAnswer) {
        answerStatus = 'correct';
    } else if (partialAnswer >= 0 && answerIndex === partialAnswer) {
        answerStatus = 'partial';
    }
    
    questionAnswerStatus[`q${currentQuestionIndex}`] = answerStatus;
    
    const buttons = document.querySelectorAll('.answer-option');
    buttons.forEach((btn, idx) => {
        btn.classList.remove('selected');
        if (idx === answerIndex) {
            btn.classList.add('selected');
        }
    });
    
    showFeedbackMessage(answerStatus);
    
    await updateAttemptInDB();
    updateProgressCircles();
    
    setTimeout(() => {
        currentQuestionIndex++;
        showQuestion();
    }, 1600);
}

async function updateAttemptInDB() {
    if (!firebaseEnabled || !db || !currentAttemptId || currentAttemptId.startsWith('local_')) return;
    
    try {
        await db.collection('attempts').doc(currentAttemptId).update({
            current_q_index: currentQuestionIndex,
            answers: userAnswers,
            updated_at: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Error updating attempt:', error);
    }
}

function showNeedReview() {
    document.getElementById('screen-need-review').classList.remove('hidden');
}

function closeNeedReview() {
    document.getElementById('screen-need-review').classList.add('hidden');
}

function nextQuestion() {
    stopTimer();
    currentQuestionIndex++;
    showQuestion();
}

document.getElementById('pause-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('pause-name').value;
    const contact = document.getElementById('pause-contact').value;
    
    userData.name = name;
    userData.phone = contact;
    
    await saveUserData();
    
    if (firebaseEnabled && db && currentAttemptId && !currentAttemptId.startsWith('local_')) {
        try {
            await db.collection('attempts').doc(currentAttemptId).update({
                user_phone: contact,
                status: 'paused',
                updated_at: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('Error pausing attempt:', error);
        }
    }
    
    const resumeLink = `${window.location.origin}${window.location.pathname}?resume=true&phone=${encodeURIComponent(contact)}&quiz=${currentQuiz}`;
    
    alert(`הקישור נשמר!\n\nהקישור שלך להמשך המבחן:\n${resumeLink}\n\nהקישור נשלח גם למייל/וואטסאפ שהזנת.`);
    
    closeNeedReview();
});

async function saveUserData() {
    if (!userData.phone || !firebaseEnabled || !db) return;
    
    try {
        await db.collection('users').doc(userData.phone).set({
            full_name: userData.name,
            email: userData.email || '',
            phone: userData.phone,
            created_at: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    } catch (error) {
        console.error('Error saving user:', error);
    }
}

async function resumeQuizFromPause(phone, quizType) {
    if (!firebaseEnabled || !db) {
        await loadQuizData(quizType);
        await createNewAttempt();
        showQuestion();
        return;
    }
    
    try {
        const attemptsQuery = await db.collection('attempts')
            .where('user_phone', '==', phone)
            .where('quiz_type', '==', quizType)
            .where('status', '==', 'paused')
            .orderBy('created_at', 'desc')
            .limit(1)
            .get();
        
        if (!attemptsQuery.empty) {
            const attemptDoc = attemptsQuery.docs[0];
            const attemptData = attemptDoc.data();
            
            currentAttemptId = attemptDoc.id;
            currentQuestionIndex = attemptData.current_q_index;
            userAnswers = attemptData.answers || {};
            
            await loadQuizData(quizType);
            
            if (firebaseEnabled && db) {
                await db.collection('attempts').doc(currentAttemptId).update({
                    status: 'active',
                    updated_at: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
            
            showQuestion();
        } else {
            await loadQuizData(quizType);
            await createNewAttempt();
            showQuestion();
        }
    } catch (error) {
        console.error('Error resuming quiz:', error);
        await loadQuizData(quizType);
        await createNewAttempt();
        showQuestion();
    }
}

async function checkIfUserAlreadyCompleted(phone, quizType) {
    if (!firebaseEnabled || !db) return false;
    
    try {
        const phoneQuery = await db.collection('attempts')
            .where('user_phone', '==', phone)
            .where('quiz_type', '==', quizType)
            .where('status', '==', 'completed')
            .limit(1)
            .get();
        
        if (!phoneQuery.empty) {
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('Error checking duplicate:', error);
        return false;
    }
}

document.getElementById('lead-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    userData.name = document.getElementById('lead-name').value;
    userData.phone = document.getElementById('lead-phone').value;
    userData.email = document.getElementById('lead-email').value;
    
    // Check if this phone number already completed this quiz
    const alreadyCompleted = await checkIfUserAlreadyCompleted(userData.phone, currentQuiz);
    
    if (alreadyCompleted) {
        showScreen('screen-already-completed');
        return;
    }
    
    await saveUserData();
    
    const score = calculateScore();
    
    if (firebaseEnabled && db && currentAttemptId && !currentAttemptId.startsWith('local_')) {
        try {
            await db.collection('attempts').doc(currentAttemptId).update({
                user_phone: userData.phone,
                user_email: userData.email,
                user_name: userData.name,
                status: 'completed',
                final_score: score,
                updated_at: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('Error completing attempt:', error);
        }
    }
    
    await updateGlobalStats(score);
    
    // Send to CRM webhook with user data
    await sendToCRM('quiz_completed');
    
    showResults(score);
});

function calculateScore() {
    let totalPoints = 0;
    const totalQuestions = quizData.questions.length;
    
    for (let i = 0; i < totalQuestions; i++) {
        const userAnswer = userAnswers[`q${i}`];
        const question = quizData.questions[i];
        const correctAnswer = question.correctIndex;
        const partialAnswer = question.partialIndex;
        
        if (userAnswer === correctAnswer) {
            totalPoints += 1.0; // Full credit
        } else if (partialAnswer >= 0 && userAnswer === partialAnswer) {
            totalPoints += 0.5; // Half credit
        }
        // else: 0 points
    }
    
    return Math.round((totalPoints / totalQuestions) * 100);
}

async function updateGlobalStats(score) {
    if (!firebaseEnabled || !db) return;
    
    try {
        const statsRef = db.collection('stats').doc('global_stats');
        const fieldName = currentQuiz === 'shabbat' ? 'total_shabbat_takers' : 'total_issur_heter_takers';
        const avgFieldName = currentQuiz === 'shabbat' ? 'avg_score_shabbat' : 'avg_score_issur_heter';
        
        await db.runTransaction(async (transaction) => {
            const statsDoc = await transaction.get(statsRef);
            
            if (!statsDoc.exists) {
                transaction.set(statsRef, {
                    [fieldName]: 1,
                    [avgFieldName]: score,
                    hard_question_errors: 0
                });
            } else {
                const data = statsDoc.data();
                const currentTotal = data[fieldName] || 0;
                const currentAvg = data[avgFieldName] || 0;
                
                const newTotal = currentTotal + 1;
                const newAvg = ((currentAvg * currentTotal) + score) / newTotal;
                
                transaction.update(statsRef, {
                    [fieldName]: newTotal,
                    [avgFieldName]: Math.round(newAvg)
                });
            }
        });
    } catch (error) {
        console.error('Error updating stats:', error);
    }
}

async function showResults(score) {
    document.getElementById('final-score').textContent = `${score}%`;
    
    const resultsHeader = document.getElementById('results-header');
    const socialStats = document.getElementById('social-stats');
    
    // Calculate percentages for chart
    let strugglePercent, successPercent;
    if (score >= 80) {
        // Top performers: 15% succeeded, 85% struggled
        strugglePercent = 85;
        successPercent = 15;
    } else {
        // Lower scores: 64% struggled, 36% succeeded
        strugglePercent = 64;
        successPercent = 36;
    }
    
    // Update chart
    updateDonutChart(strugglePercent, successPercent);
    
    if (score >= 80) {
        resultsHeader.innerHTML = `
            <h2 style="font-size: clamp(2rem, 3vw, 3rem); font-weight: bold; margin-bottom: 0.5rem; color: var(--gold); line-height: 1.2;">
                מעולה! פסקת כמו מורה הוראה! 🏆
            </h2>
        `;
        
        socialStats.innerHTML = `
            <p style="margin-bottom: 0.8rem; color: white; font-size: clamp(1.1rem, 1.4vw, 1.4rem); line-height: 1.4;">
                <strong style="color: var(--gold);">📊 הנתונים:</strong> עד כה השתתפו 247 מורי הוראה | הציון הממוצע: 73%
            </p>
            <p style="margin-bottom: 0.8rem; color: white; font-size: clamp(1.1rem, 1.4vw, 1.4rem); line-height: 1.4;">
                🎯 <strong>אתה בטופ 15% הפוסקים!</strong> בעוד 85% מהנבחנים התקשו להכריע בשאלות המעשיות, אתה ידעת לכוון לאמיתה של תורה.
            </p>
            <p style="font-weight: bold; color: #86efac; font-size: clamp(1.1rem, 1.4vw, 1.4rem);">
                ✅ נכנסת אוטומטית להגרלת הענק על שבת 'גולדיס' קומפלט!
            </p>
        `;
    } else {
        resultsHeader.innerHTML = `
            <h2 style="font-size: clamp(2rem, 3vw, 3rem); font-weight: bold; margin-bottom: 0.5rem; color: var(--gold); line-height: 1.2;">
                יש מה לשפר - אבל אתה לא לבד
            </h2>
        `;
        
        socialStats.innerHTML = `
            <p style="margin-bottom: 0.8rem; color: white; font-size: clamp(1.1rem, 1.4vw, 1.4rem); line-height: 1.4;">
                <strong style="color: var(--gold);">📊 הנתונים:</strong> 64% מהנבחנים התלבטו בדיוק באותן נקודות מעשיות כמוך.
            </p>
            <p style="margin-bottom: 0.8rem; color: white; font-size: clamp(1.1rem, 1.4vw, 1.4rem); line-height: 1.4;">
                זה לא מעיד על חוסר ידע, אלא על האתגר הגדול שבמעבר מ"לימוד התיאוריה" ל"פסיקה למעשה". בדיוק בגלל זה הוקמה קניין הוראה - שמחוללת מהפך אצל מאות תלמידים שכבר יודעים להכריע!
            </p>
            ${score > 0 ? `<p style="font-weight: bold; color: #93c5fd; font-size: clamp(1.1rem, 1.4vw, 1.4rem);">
                ✅ צברת ניקוד המזכה אותך בהשתתפות בהגרלה על מלגות לימודים!
            </p>` : ''}
        `;
    }
    
    showScreen('screen-results');
}

function updateDonutChart(strugglePercent, successPercent) {
    const chartPercentageEl = document.getElementById('chart-percentage');
    const chartStruggle = document.getElementById('chart-struggle');
    const chartSuccess = document.getElementById('chart-success');
    
    // Update center percentage
    chartPercentageEl.textContent = `${strugglePercent}%`;
    
    // Calculate stroke-dasharray for donut chart
    // Circle circumference = 2 * π * r = 2 * π * 70 = 439.8
    const circumference = 2 * Math.PI * 70;
    
    // Struggle segment (yellow)
    const struggleLength = (strugglePercent / 100) * circumference;
    chartStruggle.setAttribute('stroke-dasharray', `${struggleLength} ${circumference}`);
    
    // Success segment (green) - starts after struggle segment
    const successLength = (successPercent / 100) * circumference;
    const successOffset = struggleLength;
    chartSuccess.setAttribute('stroke-dasharray', `${successLength} ${circumference}`);
    chartSuccess.setAttribute('stroke-dashoffset', `-${successOffset}`);
}

document.getElementById('benefit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const selectedBenefit = document.querySelector('input[name="benefit"]:checked').value;
    
    if (firebaseEnabled && db && currentAttemptId && !currentAttemptId.startsWith('local_')) {
        try {
            await db.collection('attempts').doc(currentAttemptId).update({
                selected_benefit: selectedBenefit,
                updated_at: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('Error saving benefit:', error);
        }
    }
    
    await sendToCRM(selectedBenefit);
    await downloadPDF();
    
    document.getElementById('benefit-form').classList.add('hidden');
    document.getElementById('final-actions').classList.remove('hidden');
});

async function downloadPDF() {
    try {
        const score = calculateScore();
        const quizTitle = currentQuiz === 'shabbat' ? 'הלכות שבת' : 'איסור והיתר';
        
        let questionsHTML = '';
        quizData.questions.forEach((q, index) => {
            const userAnswer = userAnswers[`q${index}`];
            const isCorrect = userAnswer === q.correctIndex;
            const isPartial = q.partialIndex >= 0 && userAnswer === q.partialIndex;
            const statusIcon = isCorrect ? '✓' : (isPartial ? '◐' : '✗');
            const statusColor = isCorrect ? '#22c55e' : (isPartial ? '#f59e0b' : '#ef4444');
            const statusText = isCorrect ? 'נכון' : (isPartial ? 'חלקי' : 'שגוי');
            
            questionsHTML += `
                <div style="margin-bottom: 25px; padding: 20px; background: #fdfbf8; border-right: 5px solid ${statusColor}; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                    <div style="display: flex; align-items: center; margin-bottom: 12px;">
                        <span style="font-size: 28px; color: ${statusColor}; margin-left: 10px;">${statusIcon}</span>
                        <h4 style="color: #32373c; font-size: 20px; margin: 0; font-weight: 700;">שאלה ${index + 1} - ${statusText}</h4>
                    </div>
                    <p style="color: #32373c; font-size: 17px; line-height: 1.7; margin-bottom: 18px; font-weight: 500;">${q.question}</p>
                    
                    <div style="background: white; padding: 15px; border-radius: 8px; margin-bottom: 10px;">
                        <p style="color: #32373c; margin: 0 0 8px 0; font-size: 16px;"><strong style="color: #D4B182;">התשובה שלך:</strong> ${q.options[userAnswer] || 'לא נענתה'}</p>
                        <p style="color: #22c55e; margin: 0; font-size: 16px;"><strong style="color: #D4B182;">התשובה הנכונה:</strong> ${q.options[q.correctIndex]}</p>
                        ${isPartial ? `<p style="color: #f59e0b; margin: 8px 0 0 0; font-size: 16px;"><strong style="color: #D4B182;">תשובה חלקית:</strong> ${q.options[q.partialIndex]}</p>` : ''}
                    </div>
                    
                    <div style="margin-top: 15px; padding: 18px; background: linear-gradient(135deg, rgba(212, 177, 130, 0.08), rgba(212, 177, 130, 0.15)); border-radius: 8px; border: 1px solid rgba(212, 177, 130, 0.3);">
                        <p style="color: #32373c; font-size: 15px; line-height: 1.6; margin: 0;"><strong style="color: #b89968;">💡 הסבר:</strong> ${q.explanation}</p>
                    </div>
                </div>
            `;
        });
        
        const htmlEmail = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>תוצאות אתגר הפסיקה - קניין הוראה</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #fdfbf8 0%, #f5f0e8 100%); direction: rtl;">
    <div style="max-width: 650px; margin: 0 auto; padding: 30px 20px;">
        <div style="background: linear-gradient(135deg, #b89968, #D4B182, #e8d4b8); padding: 40px 30px; border-radius: 20px 20px 0 0; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
            <h1 style="color: white; font-size: 42px; margin: 0 0 10px 0; font-weight: 800; text-shadow: 2px 2px 4px rgba(0,0,0,0.2);">קניין הוראה</h1>
            <p style="color: white; font-size: 22px; margin: 0; font-weight: 600; opacity: 0.95;">תוצאות אתגר הפסיקה שלך</p>
        </div>
        
        <div style="background: white; padding: 35px 30px; border-radius: 0 0 20px 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
            <div style="border-bottom: 3px solid #D4B182; padding-bottom: 20px; margin-bottom: 25px;">
                <p style="font-size: 19px; color: #32373c; margin: 8px 0;"><strong style="color: #b89968;">שם:</strong> ${userData.name}</p>
                <p style="font-size: 19px; color: #32373c; margin: 8px 0;"><strong style="color: #b89968;">טלפון:</strong> ${userData.phone}</p>
                <p style="font-size: 19px; color: #32373c; margin: 8px 0;"><strong style="color: #b89968;">מייל:</strong> ${userData.email}</p>
                <p style="font-size: 19px; color: #32373c; margin: 8px 0;"><strong style="color: #b89968;">נושא:</strong> ${quizTitle}</p>
            </div>
            
            <div style="background: linear-gradient(135deg, #b89968, #D4B182); padding: 35px; border-radius: 15px; text-align: center; margin-bottom: 30px; box-shadow: 0 6px 20px rgba(212, 177, 130, 0.4);">
                <div style="color: white; font-size: 64px; font-weight: 800; margin: 0 0 8px 0; text-shadow: 2px 2px 4px rgba(0,0,0,0.2);">${score}%</div>
                <p style="color: white; font-size: 24px; margin: 0; font-weight: 600; opacity: 0.95;">הציון שלך</p>
            </div>
            
            <div style="margin-bottom: 25px; text-align: center;">
                <h2 style="color: #D4B182; font-size: 32px; margin: 0 0 10px 0; font-weight: 700;">📚 שאלות ותשובות</h2>
                <p style="color: #32373c; font-size: 17px; margin: 0; opacity: 0.8;">סקירה מפורטת של הפסיקות שלך</p>
            </div>
            
            ${questionsHTML}
            
            <div style="margin-top: 35px; padding-top: 25px; border-top: 2px solid #e8d4b8; text-align: center;">
                <p style="color: #b89968; font-size: 18px; margin: 0 0 15px 0; font-weight: 600;">🌟 מעוניין להעמיק בלימוד הוראה?</p>
                <p style="color: #32373c; font-size: 16px; line-height: 1.6; margin: 0;">צור קשר עם נציגינו למימוש ההטבה שבחרת והצטרפות למסלולי ההכשרה שלנו.</p>
            </div>
        </div>
        
        <div style="text-align: center; margin-top: 25px; padding: 20px;">
            <p style="color: #b89968; font-size: 15px; margin: 0; opacity: 0.8;">© קניין הוראה - הפוסק שבך</p>
        </div>
    </div>
</body>
</html>
        `;
        
        const emailWebhookURL = 'https://hook.eu2.make.com/5hpmbhxrti8kzmjw29zp39a6dp9kacje';
        
        const payload = {
            "to": userData.email,
            "subject": `תוצאות אתגר הפסיקה שלך - ${quizTitle} - קניין הוראה`,
            "html": htmlEmail
        };
        
        console.log('📤 Sending HTML email to webhook...');
        console.log('Webhook URL:', emailWebhookURL);
        console.log('Recipient:', userData.email);
        console.log('Subject:', payload.subject);
        
        await fetch(emailWebhookURL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        })
        .then(response => {
            console.log('📬 Webhook response status:', response.status);
            console.log('📬 Webhook response OK:', response.ok);
            return response.text();
        })
        .then(data => {
            console.log('✅ Webhook response data:', data);
            console.log('✅ HTML email sent successfully!');
        })
        .catch(error => {
            console.error('❌ Error sending email:', error);
            console.error('Error details:', error.message);
        });
        
    } catch (error) {
        console.error('Error in downloadPDF:', error);
    }
}

async function sendToCRM(benefit) {
    const webhookURL = 'https://hook.eu2.make.com/xlel1ekv0qh3q3hgcwhvyv45jbwen7jy';
    
    const score = calculateScore();
    
    // Format date and time in Hebrew
    const now = new Date();
    const hebrewMonths = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
    const dateStr = `${hebrewMonths[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
    const timeStr = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: true });
    
    // Map benefit to Hebrew course name
    const benefitMapping = {
        'shabbat_course_discount': 'הלכות שבת',
        'issur_heter_course_discount': 'איסור והיתר',
        'niddah_course_discount': 'הלכות נידה/טהרה',
        'mamonot_special': 'ממונות (חושן משפט)',
        'quiz_completed': 'השלים מבחן - טרם בחר הטבה'
    };
    const courseName = benefitMapping[benefit] || benefit;
    
    // Create note with quiz details
    const quizNote = benefit === 'quiz_completed' 
        ? `ליד מאתגר הפסיקה. ציון: ${score}%. השלים מבחן - טרם בחר הטבה`
        : `ליד מאתגר הפסיקה. ציון: ${score}%. התעניין בהטבה: ${benefit}`;
    
    const payload = [{
        form: {
            id: "b61ca57",
            name: "New Form"
        },
        fields: {
            name: {
                id: "name",
                type: "text",
                title: "Name",
                value: userData.name || "",
                raw_value: userData.name || "",
                required: "1"
            },
            email: {
                id: "email",
                type: "email",
                title: "Email",
                value: userData.email || "",
                raw_value: userData.email || "",
                required: "1"
            },
            field_6f8642e: {
                id: "field_6f8642e",
                type: "tel",
                title: "טלפון",
                value: userData.phone || "",
                raw_value: userData.phone || "",
                required: "1"
            },
            field_fb4ae08: {
                id: "field_fb4ae08",
                type: "select",
                title: "בחר מסלול",
                value: courseName,
                raw_value: courseName,
                required: "1"
            },
            field_b1e584d: {
                id: "field_b1e584d",
                type: "textarea",
                title: "תוכן ההודעה",
                value: quizNote,
                raw_value: quizNote,
                required: "0"
            },
            field_32565c1: {
                id: "field_32565c1",
                type: "acceptance",
                title: "מאשר תוכן",
                value: "on",
                raw_value: "on",
                required: "1"
            },
            utm_source: {
                id: "utm_source",
                type: "hidden",
                title: "מקור",
                value: "",
                raw_value: "",
                required: "0"
            },
            field_aab9d21: {
                id: "field_aab9d21",
                type: "hidden",
                title: "UTM",
                value: "",
                raw_value: "",
                required: "0"
            },
            field_4c63868: {
                id: "field_4c63868",
                type: "hidden",
                title: "מוצר משווק",
                value: "",
                raw_value: "",
                required: "0"
            }
        },
        meta: {
            date: {
                title: "תאריך",
                value: dateStr
            },
            time: {
                title: "זמן",
                value: timeStr
            },
            page_url: {
                title: "קישור לעמוד",
                value: window.location.href
            },
            user_agent: {
                title: "פרטי משתמש",
                value: navigator.userAgent
            },
            remote_ip: {
                title: "IP השולח",
                value: ""
            },
            credit: {
                title: "מופעל באמצעות",
                value: "קניין הוראה - אתגר פסיקה"
            }
        }
    }];
    
    try {
        await fetch(webhookURL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
        console.log('Data sent to CRM successfully');
    } catch (error) {
        console.error('Error sending to CRM:', error);
    }
}

function restartQuiz() {
    const otherQuiz = currentQuiz === 'shabbat' ? 'issur_heter' : 'shabbat';
    currentQuiz = null;
    currentQuestionIndex = 0;
    userAnswers = {};
    questionAnswerStatus = {};
    currentAttemptId = null;
    
    showScreen('screen-lobby');
}
