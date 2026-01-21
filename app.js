let firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

let db = null;
let firebaseEnabled = false;

try {
    if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        firebaseEnabled = true;
        console.log('Firebase initialized successfully');
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

function showScreen(screenId) {
    const screens = ['screen-lobby', 'screen-question', 'screen-lead-collection', 'screen-results'];
    screens.forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });
    document.getElementById(screenId).classList.remove('hidden');
    window.scrollTo(0, 0);
}

async function startQuiz(quizType) {
    currentQuiz = quizType;
    currentQuestionIndex = 0;
    userAnswers = {};
    
    const urlParams = new URLSearchParams(window.location.search);
    const resumeMode = urlParams.get('resume');
    const resumePhone = urlParams.get('phone');
    const resumeQuiz = urlParams.get('quiz');
    
    if (resumeMode && resumePhone && resumeQuiz === quizType) {
        await resumeQuizFromPause(resumePhone, quizType);
    } else {
        await loadQuizData(quizType);
        await createNewAttempt();
        saveToLocalStorage();
        showQuestion();
    }
}

async function loadQuizData(quizType) {
    if (firebaseEnabled && db) {
        try {
            const quizDoc = await db.collection('quizzes').doc(quizType).get();
            if (quizDoc.exists) {
                quizData = quizDoc.data();
            } else {
                quizData = getDefaultQuizData(quizType);
            }
        } catch (error) {
            console.error('Error loading quiz from Firebase:', error);
            quizData = getDefaultQuizData(quizType);
        }
    } else {
        quizData = getDefaultQuizData(quizType);
    }
    
    const topicName = quizType === 'shabbat' ? 'הלכות שבת' : 'איסור והיתר';
    document.getElementById('quiz-topic').textContent = `נושא: ${topicName}`;
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
            
            const docRef = await db.collection('attempts').add(attemptData);
            currentAttemptId = docRef.id;
        } catch (error) {
            console.error('Error creating attempt in Firebase:', error);
        }
    }
}

function showQuestion() {
    if (currentQuestionIndex >= quizData.questions.length) {
        showScreen('screen-lead-collection');
        return;
    }
    
    const question = quizData.questions[currentQuestionIndex];
    const totalQuestions = quizData.questions.length;
    
    document.getElementById('question-counter').textContent = 
        `שאלה ${currentQuestionIndex + 1} מתוך ${totalQuestions}`;
    
    const progress = ((currentQuestionIndex + 1) / totalQuestions) * 100;
    document.getElementById('progress-bar').style.width = `${progress}%`;
    
    document.getElementById('question-text').textContent = question.question;
    
    const answersContainer = document.getElementById('answers-container');
    answersContainer.innerHTML = '';
    
    question.options.forEach((option, index) => {
        const button = document.createElement('button');
        button.className = 'answer-option w-full text-right p-4 border-2 border-gray-300 rounded-lg font-medium text-gray-800';
        button.textContent = option;
        button.onclick = () => selectAnswer(index);
        
        if (userAnswers[`q${currentQuestionIndex}`] === index) {
            button.classList.add('selected');
        }
        
        answersContainer.appendChild(button);
    });
    
    showScreen('screen-question');
}

async function selectAnswer(answerIndex) {
    userAnswers[`q${currentQuestionIndex}`] = answerIndex;
    
    const buttons = document.querySelectorAll('.answer-option');
    buttons.forEach((btn, idx) => {
        btn.classList.remove('selected');
        if (idx === answerIndex) {
            btn.classList.add('selected');
        }
    });
    
    saveToLocalStorage();
    
    await updateAttemptInDB();
    
    setTimeout(() => {
        currentQuestionIndex++;
        showQuestion();
    }, 500);
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

document.getElementById('lead-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    userData.name = document.getElementById('lead-name').value;
    userData.phone = document.getElementById('lead-phone').value;
    userData.email = document.getElementById('lead-email').value;
    
    await saveUserData();
    
    const score = calculateScore();
    
    if (firebaseEnabled && db && currentAttemptId && !currentAttemptId.startsWith('local_')) {
        try {
            await db.collection('attempts').doc(currentAttemptId).update({
                user_phone: userData.phone,
                status: 'completed',
                final_score: score,
                updated_at: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('Error completing attempt:', error);
        }
    }
    
    await updateGlobalStats(score);
    
    showResults(score);
});

function calculateScore() {
    let correct = 0;
    const totalQuestions = quizData.questions.length;
    
    for (let i = 0; i < totalQuestions; i++) {
        const userAnswer = userAnswers[`q${i}`];
        const correctAnswer = quizData.questions[i].correctIndex;
        
        if (userAnswer === correctAnswer) {
            correct++;
        }
    }
    
    return Math.round((correct / totalQuestions) * 100);
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
    
    if (score >= 80) {
        resultsHeader.innerHTML = `
            <h2 class="text-4xl font-bold text-indigo-900 mb-2">
                יש לך פוטנציאל להוראה! 🏆
            </h2>
        `;
        
        socialStats.innerHTML = `
            <p class="text-gray-700 mb-3">
                <strong>הגרף החברתי:</strong> הנתונים מראים שאתה נמצא ב-Top 10% של הנבחנים.
            </p>
            <p class="text-gray-700 mb-3">
                בעוד הרוב המוחלט (כ-70%) התקשו להכריע בשאלה המעשית, אתה ידעת לכוון לאמיתה של תורה.
                בציבור שלנו, ידע כזה הוא אחריות.
            </p>
            <p class="text-green-700 font-bold">
                ✅ סטטוס זכייה: נכנסת אוטומטית להגרלת הענק על שבת 'גולדיס' קומפלט!
            </p>
        `;
    } else {
        resultsHeader.innerHTML = `
            <h2 class="text-3xl font-bold text-indigo-900 mb-2">
                אתה בחברה טובה.
            </h2>
        `;
        
        socialStats.innerHTML = `
            <p class="text-gray-700 mb-3">
                <strong>הגרף החברתי:</strong> מהנתונים שלנו עולה כי 64% מהנבחנים התלבטו בדיוק באותן נקודות מעשיות כמוך.
            </p>
            <p class="text-gray-700 mb-3">
                זה לא מעיד על חוסר ידע, אלא על האתגר הגדול שבמעבר מ"לימוד התיאוריה" ל"פסיקה למעשה".
                בדיוק בגלל שהנתון הזה כואב לנו, הקמנו את "קניין הוראה" - לתת לך את השיטה והביטחון להכריע.
            </p>
            <p class="text-blue-700 font-bold">
                ✅ סטטוס זכייה: צברת ניקוד המזכה אותך בהשתתפות בהגרלת הניחומים על מלגות לימודים.
            </p>
        `;
    }
    
    showScreen('screen-results');
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
    
    document.getElementById('benefit-form').classList.add('hidden');
    document.getElementById('final-actions').classList.remove('hidden');
});

async function sendToCRM(benefit) {
    const webhookURL = 'https://hook.integromat.com/YOUR_WEBHOOK_URL';
    
    const score = calculateScore();
    
    const payload = {
        name: userData.name,
        phone: userData.phone,
        email: userData.email,
        quiz_type: currentQuiz,
        score: score,
        selected_benefit: benefit,
        timestamp: new Date().toISOString()
    };
    
    try {
        await fetch(webhookURL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
    } catch (error) {
        console.error('Error sending to CRM:', error);
    }
}

function downloadPDF() {
    alert('הורדת PDF תתבצע בקרוב. הקובץ יישלח גם למייל שהזנת.');
}

function restartQuiz() {
    const otherQuiz = currentQuiz === 'shabbat' ? 'issur_heter' : 'shabbat';
    currentQuiz = null;
    currentQuestionIndex = 0;
    userAnswers = {};
    currentAttemptId = null;
    
    showScreen('screen-lobby');
    
    setTimeout(() => {
        startQuiz(otherQuiz);
    }, 100);
}

function saveToLocalStorage() {
    const state = {
        currentQuiz,
        currentQuestionIndex,
        userAnswers,
        currentAttemptId,
        userData
    };
    localStorage.setItem('quizState', JSON.stringify(state));
}

function loadFromLocalStorage() {
    const saved = localStorage.getItem('quizState');
    if (saved) {
        try {
            const state = JSON.parse(saved);
            currentQuiz = state.currentQuiz;
            currentQuestionIndex = state.currentQuestionIndex;
            userAnswers = state.userAnswers || {};
            currentAttemptId = state.currentAttemptId;
            userData = state.userData || { phone: null, name: null, email: null };
        } catch (error) {
            console.error('Error loading from localStorage:', error);
        }
    }
}

window.addEventListener('load', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const resumeMode = urlParams.get('resume');
    
    if (resumeMode) {
        const phone = urlParams.get('phone');
        const quiz = urlParams.get('quiz');
        if (phone && quiz) {
            startQuiz(quiz);
        }
    } else {
        loadFromLocalStorage();
    }
});
