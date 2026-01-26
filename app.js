// Version
const APP_VERSION = 'v25';
console.log(`🚀 Kinyan Horaah Quiz App ${APP_VERSION}`);

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
let utmData = {
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_term: null,
    utm_content: null,
    utm_id: null,
    gclid: null,
    fbclid: null
};

// Capture UTM parameters on page load
function captureUTMParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    
    utmData.utm_source = urlParams.get('utm_source') || '';
    utmData.utm_medium = urlParams.get('utm_medium') || '';
    utmData.utm_campaign = urlParams.get('utm_campaign') || '';
    utmData.utm_term = urlParams.get('utm_term') || '';
    utmData.utm_content = urlParams.get('utm_content') || '';
    utmData.utm_id = urlParams.get('utm_id') || '';
    utmData.gclid = urlParams.get('gclid') || '';
    utmData.fbclid = urlParams.get('fbclid') || '';
    
    console.log('UTM Parameters captured:', utmData);
}

// Call on page load
captureUTMParameters();

// Track quiz abandonment
let quizStartTime = null;
window.addEventListener('beforeunload', function(e) {
    if (currentQuiz && currentQuestionIndex < (quizData?.questions?.length || 0) && !userData.phone) {
        // User is leaving in the middle of quiz without completing
        trackEvent('quiz_abandoned', {
            quiz_type: currentQuiz,
            last_question: currentQuestionIndex + 1,
            total_questions: quizData?.questions?.length || 0,
            time_spent: quizStartTime ? Math.round((Date.now() - quizStartTime) / 1000) : 0,
            questions_answered: Object.keys(userAnswers).length
        });
    }
});

// Analytics tracking function - works in iframe and standalone
function trackEvent(eventName, eventParams = {}) {
    try {
        // Add UTM parameters to all events
        const enrichedParams = {
            ...eventParams,
            utm_source: utmData.utm_source || '',
            utm_medium: utmData.utm_medium || '',
            utm_campaign: utmData.utm_campaign || '',
            page_location: window.location.href,
            timestamp: new Date().toISOString()
        };
        
        // Method 1: Send to parent window's dataLayer (for iframe)
        if (window.parent && window.parent !== window) {
            if (window.parent.dataLayer) {
                window.parent.dataLayer.push({
                    event: eventName,
                    ...enrichedParams
                });
                console.log('📊 Analytics (parent):', eventName, enrichedParams);
            }
        }
        
        // Method 2: Send to current window's dataLayer (for standalone)
        if (window.dataLayer) {
            window.dataLayer.push({
                event: eventName,
                ...enrichedParams
            });
            console.log('📊 Analytics (local):', eventName, enrichedParams);
        }
        
        // Method 3: Send to gtag if available
        if (typeof gtag === 'function') {
            gtag('event', eventName, enrichedParams);
            console.log('📊 Analytics (gtag):', eventName, enrichedParams);
        }
        
        // Fallback: Log to console for debugging
        if (!window.dataLayer && !window.parent?.dataLayer && typeof gtag !== 'function') {
            console.log('📊 Analytics (console only):', eventName, enrichedParams);
        }
    } catch (error) {
        console.error('Analytics tracking error:', error);
    }
}

let csvCache = {};
let questionTimer = null;
let timeRemaining = 30;
let questionAnswerStatus = {};
let isAnswerLocked = false;
let questionTransitionTimeout = null;

function showLoading(text = 'טוען...') {
    const overlay = document.getElementById('loading-overlay');
    const loadingText = overlay.querySelector('.loading-text');
    if (loadingText) {
        loadingText.textContent = text;
    }
    overlay.classList.add('active');
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    overlay.classList.remove('active');
}

function showScreen(screenId) {
    const screens = ['screen-lobby', 'screen-instructions', 'screen-question', 'screen-lead-collection', 'screen-processing', 'screen-intermediate-results', 'screen-results', 'screen-already-completed'];
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
    // Show loading spinner
    showLoading('מכין את השאלות...');
    
    currentQuiz = quizType;
    currentQuestionIndex = 0;
    userAnswers = {};
    questionAnswerStatus = {};
    isAnswerLocked = false;
    
    // Clear cache to ensure fresh shuffle each time
    csvCache = {};
    
    // Set quiz start time for abandonment tracking
    quizStartTime = Date.now();
    
    // Analytics: Quiz Started
    trackEvent('quiz_started', {
        quiz_type: quizType === 'shabbat' ? 'הלכות שבת' : 'איסור והיתר',
        quiz_type_en: quizType
    });
    
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
        showScreen('screen-instructions');
    }
    
    // Hide loading spinner
    hideLoading();
}

function startQuestions() {
    showQuestion();
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
            const correctIdx = parseInt(parts[4]);
            const partialIdx = parseInt(parts[5]);
            
            // Validate that we have valid data
            if (!parts[0] || !parts[1] || !parts[2] || !parts[3]) {
                console.warn(`Skipping line ${i}: Missing question or options`);
                continue;
            }
            
            if (isNaN(correctIdx) || correctIdx < 1 || correctIdx > 3) {
                console.warn(`Skipping line ${i}: Invalid correctIndex: ${parts[4]}`);
                continue;
            }
            
            allQuestions.push({
                question: parts[0],
                options: [parts[1], parts[2], parts[3]],
                correctIndex: correctIdx - 1,
                partialIndex: isNaN(partialIdx) ? -1 : partialIdx - 1,
                explanation: parts[6] || ''
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
            question: "הגעתי לבית הכנסת בשבת והבחנתי ששכחתי את הטלית בבית. הבית נמצא במרחק של 5 דקות הליכה בתוך העירוב. מה עלי לעשות?",
            options: [
                "אסור לחזור, כי אין חוזרים על טלית בשבת",
                "מותר לחזור, אבל רק אם עדיין לא התחילה התפילה",
                "מותר לחזור בכל מקרה, כי זה בתוך העירוב ולצורך מצווה"
            ],
            correctIndex: 1,
            explanation: "לפי השולחן עורך (או\"ח סי' ח), מותר לחזור על טלית רק אם עדיין לא התחיל להתפלל. אם כבר התחיל - אסור לחזור."
        },
        {
            question: "הדלקתי נרות שבת ושכחתי לכבות את האור במטבח. האם מותר לי לבקש מבעלי (שעדיין לא קיבל שבת) לכבות?",
            options: [
                "אסור, כי היא כבר קיבלה שבת ואסור לה לגרום למלאכה",
                "מותר, כי הבעל עדיין לא קיבל שבת",
                "מותר רק אם יש חשש סכנה או הפסד ממון משמעותי"
            ],
            correctIndex: 0,
            explanation: "אף שהבעל עדיין לא קיבל שבת, האישה שכבר קיבלה שבת אסורה לבקש ממנו לעשות מלאכה עבורה (משנה ברורה)."
        },
        {
            question: "הילד שלי בן 11 ביקש לפתוח את האור בחדר בשבת. האם מותר לי להניח לו?",
            options: [
                "מותר, כי קטן שעושה מלאכה מדעתו - אין מחויבים למנוע ממנו",
                "אסור, יש חיוב חינוך ולכן חייבים למנוע ממנו",
                "תלוי אם הוא כבר הגיע לגיל חינוך (בן 9-10) או לא"
            ],
            correctIndex: 1,
            explanation: "יש חיוב מדרבנן לחנך ילדים בשמירת שבת מגיל שמבין (בערך 6-7). לכן חייבים למנוע מילד לעשות מלאכה בשבת."
        },
        {
            question: "שכחתי והדלקתי סיגריה בשבת (בשוגג). מה עלי לעשות?",
            options: [
                "לזרוק מיד את הסיגריה ולכבות אותה",
                "להניח את הסיגריה על משטח בטוח ולא לכבות",
                "להמשיך לעשן כי ממילא כבר עבר על האיסור"
            ],
            correctIndex: 1,
            explanation: "אסור לכבות את הסיגריה כי זו מלאכה נוספת. יש להניחה במקום בטוח ולא לכבות (שו\"ע ומשנה ברורה)."
        },
        {
            question: "התינוק שלי בכה בשבת ואני צריכה לחמם לו בקבוק. יש לי מים חמים מהקומקום החשמלי שהיה דולק מערב שבת. האם מותר לשפוך ישירות על הבקבוק?",
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
            question: "מצאתי חרק קטן בכרוב שקניתי. האם מותר לי לחתוך את האזור ולהשתמש בשאר הכרוב?",
            options: [
                "מותר, כי די להסיר את האזור הנגוע",
                "אסור, צריך לזרוק את כל הכרוב",
                "תלוי בסוג החרק - אם זה כינה או תולעת"
            ],
            correctIndex: 1,
            explanation: "כרוב שנמצא בו חרק נחשב למוחזק בתולעים, ויש לבדוק היטב או לזרוק. בדרך כלל ממליצים לזרוק כי קשה לבדוק לעומק."
        },
        {
            question: "יש לי בשר עוף שנשאר מחוץ למקרר למשך 4 שעות בקיץ. האם מותר לאכול אותו?",
            options: [
                "מותר, כי 4 שעות זה לא מספיק זמן להפסד",
                "אסור מצד סכנת נפשות",
                "מותר אם מבשלים היטב"
            ],
            correctIndex: 1,
            explanation: "בשר עוף שנשאר בחוץ בטמפרטורה גבוהה מעל שעתיים נחשב למסוכן בריאותית ואסור באכילה (סכנת סלמונלה)."
        },
        {
            question: "יש לי גבינה צהובה שנמצאה בה נקודה ירוקה קטנה של עובש. מה הדין?",
            options: [
                "מותר לחתוך את הנקודה ולאכול את השאר",
                "אסור לאכול את כל הגבינה",
                "תלוי בגודל הנקודה - אם קטנה מ-1 ס\"ם מותר"
            ],
            correctIndex: 0,
            explanation: "בגבינה קשה, מותר לחתוך את אזור העובש עם מרווח של כ-2 ס\"ם מסביב ולאכול את השאר."
        },
        {
            question: "יש לי ירקות קפואים שהופשרו במקרר והוחזרו להקפאה. האם מותר לאכול אותם?",
            options: [
                "מותר בלי בעיה",
                "אסור, כי הם כבר הופשרו פעם",
                "מותר רק אם לא הופשרו לגמרי"
            ],
            correctIndex: 2,
            explanation: "אם הירקות הופשרו חלקית בלבד (עדיין היו גבישי קרח) - מותר להקפיא שוב. אם הופשרו לגמרי - לא מומלץ מבחינה בריאותית."
        },
        {
            question: "יש לי תבשיל חלבי שנתערבה בו בטעות כף בשרית נקייה. מה הדין?",
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
    
    // Prevent multiple simultaneous calls
    if (isAnswerLocked) {
        console.log('Question transition already in progress, aborting');
        return;
    }
    
    // Lock immediately to prevent race conditions
    isAnswerLocked = true;
    
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
    
    // Clear previous content and event listeners
    questionTextEl.textContent = '';
    
    // Remove old buttons and their event listeners
    const oldButtons = answersContainer.querySelectorAll('.answer-option');
    oldButtons.forEach(btn => {
        btn.onclick = null;
        btn.remove();
    });
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
    
    // Phase 3: Add "כיצד היית מכריע?" header before answers
    const decisionHeader = document.createElement('div');
    decisionHeader.style.cssText = 'text-align: center; color: white; font-size: clamp(1.3rem, 1.8vw, 1.8rem); font-weight: 600; margin: 1.5rem 0 1rem 0; text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);';
    decisionHeader.textContent = 'כיצד היית מכריע?';
    answersContainer.appendChild(decisionHeader);
    
    // Phase 4: Show answers one by one
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
    
    // Unlock answers for interaction
    isAnswerLocked = false;
    
    // Phase 5: Start the timer
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
            
            // Add SVG donut ring for answered questions
            if (status && !isCurrent) {
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                const progressCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                
                // Background circle
                bgCircle.setAttribute('class', 'circle-bg');
                bgCircle.setAttribute('cx', '34');
                bgCircle.setAttribute('cy', '34');
                bgCircle.setAttribute('r', '30');
                
                // Progress circle (full ring for completed questions)
                progressCircle.setAttribute('class', 'circle-progress');
                progressCircle.setAttribute('cx', '34');
                progressCircle.setAttribute('cy', '34');
                progressCircle.setAttribute('r', '30');
                
                // Calculate circumference and set full ring
                const circumference = 2 * Math.PI * 30;
                progressCircle.setAttribute('stroke-dasharray', `${circumference} ${circumference}`);
                progressCircle.setAttribute('stroke-dashoffset', '0');
                
                svg.appendChild(bgCircle);
                svg.appendChild(progressCircle);
                circle.appendChild(svg);
            }
            
            // Add number text
            const numberSpan = document.createElement('span');
            numberSpan.textContent = i + 1;
            numberSpan.style.position = 'relative';
            numberSpan.style.zIndex = '2';
            circle.appendChild(numberSpan);
            
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
    // Lock to prevent clicks during timeout
    isAnswerLocked = true;
    
    const message = document.createElement('div');
    message.className = 'feedback-message timeout';
    message.innerHTML = `
        <h3 style="font-size: 2.5rem; color: var(--gold); margin-bottom: 1rem;">הזמן נגמר!</h3>
        <p style="font-size: 1.3rem; color: var(--dark-slate);">גם מורה הוראה צריך לפעמים לפתוח ספר...<br>עוברים לשאלה המעשית הבאה</p>
    `;
    document.body.appendChild(message);
    
    questionAnswerStatus[`q${currentQuestionIndex}`] = 'timeout';
    updateProgressCircles();
    
    // Analytics: Question Timeout
    trackEvent('question_answered', {
        question_number: currentQuestionIndex + 1,
        answer_result: 'timeout',
        time_remaining: 0,
        time_taken: 30,
        quiz_type: currentQuiz
    });
    
    setTimeout(() => {
        message.remove();
        isAnswerLocked = false; // Unlock before moving to next question
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
    // Prevent multiple selections
    if (isAnswerLocked) {
        console.log('Answer already locked, ignoring click');
        return;
    }
    
    // Lock immediately to prevent double-clicks
    isAnswerLocked = true;
    
    // Clear any existing transition timeout
    if (questionTransitionTimeout) {
        clearTimeout(questionTransitionTimeout);
        questionTransitionTimeout = null;
    }
    
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
    
    // Analytics: Question Answered
    trackEvent('question_answered', {
        question_number: currentQuestionIndex + 1,
        answer_result: answerStatus,
        time_remaining: timeRemaining,
        time_taken: 30 - timeRemaining,
        quiz_type: currentQuiz
    });
    
    const buttons = document.querySelectorAll('.answer-option');
    buttons.forEach((btn, idx) => {
        btn.classList.remove('selected');
        btn.disabled = true; // Disable all buttons
        btn.style.cursor = 'not-allowed';
        btn.style.opacity = '0.7';
        
        if (idx === answerIndex) {
            btn.classList.add('selected');
        }
    });
    
    showFeedbackMessage(answerStatus);
    
    await updateAttemptInDB();
    updateProgressCircles();
    
    // Store timeout reference to prevent race conditions
    questionTransitionTimeout = setTimeout(() => {
        questionTransitionTimeout = null;
        isAnswerLocked = false; // Unlock before moving to next question
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
    isAnswerLocked = false; // Unlock before moving to next question
    currentQuestionIndex++;
    showQuestion();
}

document.getElementById('pause-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const firstName = document.getElementById('pause-first-name').value;
    const lastName = document.getElementById('pause-last-name').value;
    const phone = document.getElementById('pause-phone').value;
    const email = document.getElementById('pause-email').value;
    
    userData.name = `${firstName} ${lastName}`;
    userData.phone = phone;
    userData.email = email;
    
    await saveUserData();
    
    if (firebaseEnabled && db && currentAttemptId && !currentAttemptId.startsWith('local_')) {
        try {
            await db.collection('attempts').doc(currentAttemptId).update({
                user_phone: phone,
                user_email: email,
                user_name: userData.name,
                status: 'paused',
                updated_at: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('Error pausing attempt:', error);
        }
    }
    
    const resumeLink = `${window.location.origin}${window.location.pathname}?resume=true&phone=${encodeURIComponent(phone)}&quiz=${currentQuiz}`;
    
    alert(`הקישור נשמר!\n\nהקישור שלך להמשך המבחן:\n${resumeLink}\n\nהקישור נשלח גם למייל שהזנת.`);
    
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
    
    // Show loading spinner
    showLoading('מעבד את הנתונים...');
    
    userData.name = document.getElementById('lead-name').value;
    userData.phone = document.getElementById('lead-phone').value;
    userData.email = document.getElementById('lead-email').value;
    
    // Get consent checkboxes
    const publishNameConsent = document.getElementById('publish-name-consent').checked;
    const marketingConsent = document.getElementById('marketing-consent').checked;
    
    // Check if this phone number already completed this quiz
    const alreadyCompleted = await checkIfUserAlreadyCompleted(userData.phone, currentQuiz);
    
    if (alreadyCompleted) {
        hideLoading();
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
                publish_name: publishNameConsent,
                marketing_consent: marketingConsent,
                updated_at: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('Error completing attempt:', error);
        }
    }
    
    await updateGlobalStats(score);
    
    // Analytics: Lead Submitted
    trackEvent('lead_submitted', {
        has_email: !!userData.email,
        has_phone: !!userData.phone,
        marketing_consent: marketingConsent,
        publish_name_consent: publishNameConsent,
        quiz_type: currentQuiz,
        score: score
    });
    
    // Send complete data to Google Sheets (ALWAYS - regardless of consent)
    await sendToGoogleSheets(score, publishNameConsent, marketingConsent);
    
    // Send to CRM webhook with user data (always send, even without marketing consent)
    await sendToCRM('quiz_completed', { marketing_consent: marketingConsent });
    
    // If no marketing consent, don't proceed to results - just thank and stop
    if (!marketingConsent) {
        hideLoading();
        alert('תודה על השתתפותך! הנתונים שלך נשמרו במערכת.\n\nשים לב: ללא אישור דיוור, לא נוכל לשלוח לך את הדוח המפורט.\n\nאתה רשום כמי שביצע את המבחן ולא תוכל להיבחן שוב באותו תחום.');
        showScreen('screen-lobby');
        return;
    }
    
    // Hide loading spinner before showing processing screen
    hideLoading();
    
    // Show processing animation
    showScreen('screen-processing');
    
    // Wait 2.5 seconds then show intermediate results
    setTimeout(() => {
        showIntermediateResults(score);
    }, 2500);
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
        const highScorersField = currentQuiz === 'shabbat' ? 'high_scorers_shabbat' : 'high_scorers_issur_heter';
        const questionErrorsField = currentQuiz === 'shabbat' ? 'question_errors_shabbat' : 'question_errors_issur_heter';
        
        // Calculate which questions user got wrong
        const wrongQuestions = {};
        for (let i = 0; i < quizData.questions.length; i++) {
            const userAnswer = userAnswers[`q${i}`];
            const question = quizData.questions[i];
            const correctAnswer = question.correctIndex;
            
            if (userAnswer !== correctAnswer) {
                wrongQuestions[`q${i}`] = true;
            }
        }
        
        await db.runTransaction(async (transaction) => {
            const statsDoc = await transaction.get(statsRef);
            
            if (!statsDoc.exists) {
                const initialData = {
                    [fieldName]: 1,
                    [avgFieldName]: score,
                    [highScorersField]: score >= 80 ? 1 : 0,
                    [questionErrorsField]: {}
                };
                
                // Initialize question errors
                Object.keys(wrongQuestions).forEach(qKey => {
                    initialData[questionErrorsField][qKey] = 1;
                });
                
                transaction.set(statsRef, initialData);
            } else {
                const data = statsDoc.data();
                const currentTotal = data[fieldName] || 0;
                const currentAvg = data[avgFieldName] || 0;
                const currentHighScorers = data[highScorersField] || 0;
                const currentQuestionErrors = data[questionErrorsField] || {};
                
                const newTotal = currentTotal + 1;
                const newAvg = ((currentAvg * currentTotal) + score) / newTotal;
                const newHighScorers = score >= 80 ? currentHighScorers + 1 : currentHighScorers;
                
                // Update question errors
                const updatedQuestionErrors = { ...currentQuestionErrors };
                Object.keys(wrongQuestions).forEach(qKey => {
                    updatedQuestionErrors[qKey] = (updatedQuestionErrors[qKey] || 0) + 1;
                });
                
                transaction.update(statsRef, {
                    [fieldName]: newTotal,
                    [avgFieldName]: Math.round(newAvg),
                    [highScorersField]: newHighScorers,
                    [questionErrorsField]: updatedQuestionErrors
                });
            }
        });
    } catch (error) {
        console.error('Error updating stats:', error);
    }
}

async function showResults(score) {
    // Analytics: Quiz Completed
    const totalQuestions = quizData.questions.length;
    const correctAnswers = Object.keys(questionAnswerStatus).filter(k => questionAnswerStatus[k] === 'correct').length;
    const wrongAnswers = Object.keys(questionAnswerStatus).filter(k => questionAnswerStatus[k] === 'wrong').length;
    const timeoutAnswers = Object.keys(questionAnswerStatus).filter(k => questionAnswerStatus[k] === 'timeout').length;
    
    trackEvent('quiz_completed', {
        quiz_type: currentQuiz,
        score: score,
        total_questions: totalQuestions,
        correct_answers: correctAnswers,
        wrong_answers: wrongAnswers,
        timeout_answers: timeoutAnswers,
        is_high_scorer: score >= 80
    });
    
    document.getElementById('final-score').textContent = `${score}%`;
    
    const resultsHeader = document.getElementById('results-header');
    const socialStats = document.getElementById('social-stats');
    
    // Fetch real stats from Firebase
    let totalTakers = 0;
    let avgScore = 0;
    let highScorersPercent = 15;
    let overlapPercent = 64;
    
    if (firebaseEnabled && db) {
        try {
            const statsRef = db.collection('stats').doc('global_stats');
            const statsDoc = await statsRef.get();
            
            if (statsDoc.exists) {
                const data = statsDoc.data();
                const fieldName = currentQuiz === 'shabbat' ? 'total_shabbat_takers' : 'total_issur_heter_takers';
                const avgFieldName = currentQuiz === 'shabbat' ? 'avg_score_shabbat' : 'avg_score_issur_heter';
                const highScorersField = currentQuiz === 'shabbat' ? 'high_scorers_shabbat' : 'high_scorers_issur_heter';
                const questionErrorsField = currentQuiz === 'shabbat' ? 'question_errors_shabbat' : 'question_errors_issur_heter';
                
                totalTakers = data[fieldName] || 0;
                avgScore = data[avgFieldName] || 0;
                const highScorers = data[highScorersField] || 0;
                const questionErrors = data[questionErrorsField] || {};
                
                // Calculate high scorers percentage
                if (totalTakers > 0) {
                    highScorersPercent = Math.round((highScorers / totalTakers) * 100);
                }
                
                // Calculate overlap percentage - how many struggled with same questions
                if (totalTakers > 10) { // Only if we have enough data
                    const userWrongQuestions = [];
                    for (let i = 0; i < quizData.questions.length; i++) {
                        const userAnswer = userAnswers[`q${i}`];
                        const question = quizData.questions[i];
                        const correctAnswer = question.correctIndex;
                        
                        if (userAnswer !== correctAnswer) {
                            userWrongQuestions.push(`q${i}`);
                        }
                    }
                    
                    // Calculate average overlap for questions user got wrong
                    if (userWrongQuestions.length > 0) {
                        let totalOverlap = 0;
                        userWrongQuestions.forEach(qKey => {
                            const errorCount = questionErrors[qKey] || 0;
                            const overlapForQuestion = (errorCount / totalTakers) * 100;
                            totalOverlap += overlapForQuestion;
                        });
                        overlapPercent = Math.round(totalOverlap / userWrongQuestions.length);
                    } else {
                        // User got everything right, show low overlap
                        overlapPercent = 10;
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching stats:', error);
            // Fall back to default values
        }
    }
    
    // Calculate percentages for chart
    let strugglePercent, successPercent;
    if (score >= 80) {
        strugglePercent = 100 - highScorersPercent;
        successPercent = highScorersPercent;
    } else {
        strugglePercent = overlapPercent;
        successPercent = 100 - overlapPercent;
    }
    
    // Update chart
    updateDonutChart(strugglePercent, successPercent);
    
    if (score >= 80) {
        resultsHeader.innerHTML = `
            <h2 style="font-size: clamp(2rem, 3vw, 3rem); font-weight: bold; margin-bottom: 0.5rem; color: var(--gold); line-height: 1.2;">
                מעולה! פסקת כמו מורה הוראה! 🏆
            </h2>
        `;
        
        const statsText = totalTakers > 0 
            ? `הציון הממוצע של כלל המשיבים עד לרגע זה הוא ${avgScore}%`
            : 'עדיין אוספים נתונים...';
        
        socialStats.innerHTML = `
            <p style="margin-bottom: 1.2rem; color: white; font-size: clamp(1.3rem, 1.7vw, 1.7rem); line-height: 1.6;">
                <strong style="color: var(--gold); font-size: clamp(1.4rem, 1.8vw, 1.8rem);">הנתונים:</strong><br>
                ${statsText}
            </p>
            <p style="margin-bottom: 1.2rem; color: white; font-size: clamp(1.3rem, 1.7vw, 1.7rem); line-height: 1.6;">
                <strong style="color: var(--gold);">אתה בטופ ${highScorersPercent}% הפוסקים!</strong><br>
                בעוד ${100 - highScorersPercent}% מהנבחנים התקשו להכריע בשאלות המעשיות, אתה ידעת לכוון לאמיתה של תורה.
            </p>
            <p style="font-weight: bold; color: #86efac; font-size: clamp(1.4rem, 1.8vw, 1.8rem); margin-top: 1.5rem;">
                ✅ נכנסת אוטומטית להגרלת הענק על שבת 'גולדיס' קומפלט!
            </p>
        `;
    } else {
        resultsHeader.innerHTML = `
            <h2 style="font-size: clamp(2rem, 3vw, 3rem); font-weight: bold; margin-bottom: 0.5rem; color: var(--gold); line-height: 1.2;">
                יש מה לשפר - אבל אתה לא לבד
            </h2>
        `;
        
        const statsText = totalTakers > 0 
            ? `הציון הממוצע של כלל המשיבים עד לרגע זה הוא ${avgScore}%`
            : 'עדיין אוספים נתונים...';
        
        socialStats.innerHTML = `
            <p style="margin-bottom: 1.2rem; color: white; font-size: clamp(1.3rem, 1.7vw, 1.7rem); line-height: 1.6;">
                <strong style="color: var(--gold); font-size: clamp(1.4rem, 1.8vw, 1.8rem);">הנתונים:</strong><br>
                ${statsText}
            </p>
            <p style="margin-bottom: 1.2rem; color: white; font-size: clamp(1.3rem, 1.7vw, 1.7rem); line-height: 1.6;">
                ${overlapPercent}% מהנבחנים התלבטו בדיוק באותן נקודות מעשיות כמוך.
            </p>
            <p style="margin-bottom: 1.2rem; color: white; font-size: clamp(1.3rem, 1.7vw, 1.7rem); line-height: 1.7;">
                זה לא מעיד על חוסר ידע, אלא על <strong style="color: var(--gold);">האתגר הגדול שבמעבר מ"לימוד התיאוריה" ל"פסיקה למעשה"</strong>. בדיוק בגלל זה הוקמה קניין הוראה - שמחוללת מהפך אצל מאות תלמידים שכבר יודעים להכריע!
            </p>
            ${score > 0 ? `<p style="font-weight: bold; color: #93c5fd; font-size: clamp(1.4rem, 1.8vw, 1.8rem); margin-top: 1.5rem;">
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
    // Circle circumference = 2 * π * r = 2 * π * 80 = 502.4
    const circumference = 2 * Math.PI * 80;
    
    // Struggle segment (yellow)
    const struggleLength = (strugglePercent / 100) * circumference;
    chartStruggle.setAttribute('stroke-dasharray', `${struggleLength} ${circumference}`);
    
    // Success segment (green) - starts after struggle segment
    const successLength = (successPercent / 100) * circumference;
    const successOffset = struggleLength;
    chartSuccess.setAttribute('stroke-dasharray', `${successLength} ${circumference}`);
    chartSuccess.setAttribute('stroke-dashoffset', `-${successOffset}`);
}

// Benefit form removed - selection now happens in intermediate-results screen via revealFullReport()

async function downloadPDF() {
    try {
        const score = calculateScore();
        const quizTitle = currentQuiz === 'shabbat' ? 'הלכות שבת' : 'איסור והיתר';
        
        // Fetch distribution data from Firebase
        let questionErrors = {};
        let totalTakers = 1;
        
        if (firebaseEnabled && db) {
            try {
                const statsRef = db.collection('stats').doc('global_stats');
                const statsDoc = await statsRef.get();
                
                if (statsDoc.exists) {
                    const data = statsDoc.data();
                    const fieldName = currentQuiz === 'shabbat' ? 'total_shabbat_takers' : 'total_issur_heter_takers';
                    const questionErrorsField = currentQuiz === 'shabbat' ? 'question_errors_shabbat' : 'question_errors_issur_heter';
                    
                    totalTakers = data[fieldName] || 1;
                    questionErrors = data[questionErrorsField] || {};
                }
            } catch (error) {
                console.error('Error fetching distribution data:', error);
            }
        }
        
        let questionsHTML = '';
        quizData.questions.forEach((q, index) => {
            const userAnswer = userAnswers[`q${index}`];
            const isCorrect = userAnswer === q.correctIndex;
            const isPartial = q.partialIndex >= 0 && userAnswer === q.partialIndex;
            const statusIcon = isCorrect ? '✓' : (isPartial ? '◐' : '✗');
            const statusColor = isCorrect ? '#22c55e' : (isPartial ? '#f59e0b' : '#ef4444');
            const statusText = isCorrect ? 'נכון' : (isPartial ? 'חלקי' : 'שגוי');
            
            // Calculate distribution percentages
            const errorCount = questionErrors[`q${index}`] || 0;
            const wrongPercent = Math.round((errorCount / totalTakers) * 100);
            const correctPercent = 100 - wrongPercent;
            
            // For questions with partial answers, calculate 3-way distribution
            let distributionHTML = '';
            if (q.partialIndex >= 0) {
                // Estimate distribution (in real scenario, would track each answer separately)
                const partialPercent = Math.round(wrongPercent * 0.4); // Assume 40% of wrong answers are partial
                const actualWrongPercent = wrongPercent - partialPercent;
                const actualCorrectPercent = 100 - wrongPercent;
                
                distributionHTML = `
                    <div style="background: rgba(212, 177, 130, 0.1); padding: 15px; border-radius: 8px; margin-top: 15px; border: 1px solid rgba(212, 177, 130, 0.3);">
                        <h5 style="color: #b89968; font-size: 16px; font-weight: bold; margin: 0 0 12px 0;">📊 התפלגות תשובות המשיבים:</h5>
                        
                        <div style="margin-bottom: 8px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                <span style="font-size: 14px; font-weight: 600; color: #22c55e;">✓ תשובה נכונה</span>
                                <span style="font-size: 14px; font-weight: bold; color: #22c55e;">${actualCorrectPercent}%</span>
                            </div>
                            <div style="background: #e5e7eb; height: 20px; border-radius: 10px; overflow: hidden;">
                                <div style="background: linear-gradient(90deg, #22c55e, #86efac); height: 100%; width: ${actualCorrectPercent}%; transition: width 0.8s ease;"></div>
                            </div>
                        </div>
                        
                        <div style="margin-bottom: 8px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                <span style="font-size: 14px; font-weight: 600; color: #f59e0b;">◐ תשובה חלקית</span>
                                <span style="font-size: 14px; font-weight: bold; color: #f59e0b;">${partialPercent}%</span>
                            </div>
                            <div style="background: #e5e7eb; height: 20px; border-radius: 10px; overflow: hidden;">
                                <div style="background: linear-gradient(90deg, #f59e0b, #fbbf24); height: 100%; width: ${partialPercent}%; transition: width 0.8s ease;"></div>
                            </div>
                        </div>
                        
                        <div>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                <span style="font-size: 14px; font-weight: 600; color: #ef4444;">✗ תשובה שגויה</span>
                                <span style="font-size: 14px; font-weight: bold; color: #ef4444;">${actualWrongPercent}%</span>
                            </div>
                            <div style="background: #e5e7eb; height: 20px; border-radius: 10px; overflow: hidden;">
                                <div style="background: linear-gradient(90deg, #ef4444, #f87171); height: 100%; width: ${actualWrongPercent}%; transition: width 0.8s ease;"></div>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                // Simple 2-way distribution
                distributionHTML = `
                    <div style="background: rgba(212, 177, 130, 0.1); padding: 15px; border-radius: 8px; margin-top: 15px; border: 1px solid rgba(212, 177, 130, 0.3);">
                        <h5 style="color: #b89968; font-size: 16px; font-weight: bold; margin: 0 0 12px 0;">📊 התפלגות תשובות המשיבים:</h5>
                        
                        <div style="margin-bottom: 8px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                <span style="font-size: 14px; font-weight: 600; color: #22c55e;">✓ תשובה נכונה</span>
                                <span style="font-size: 14px; font-weight: bold; color: #22c55e;">${correctPercent}%</span>
                            </div>
                            <div style="background: #e5e7eb; height: 20px; border-radius: 10px; overflow: hidden;">
                                <div style="background: linear-gradient(90deg, #22c55e, #86efac); height: 100%; width: ${correctPercent}%; transition: width 0.8s ease;"></div>
                            </div>
                        </div>
                        
                        <div>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                <span style="font-size: 14px; font-weight: 600; color: #ef4444;">✗ תשובה שגויה</span>
                                <span style="font-size: 14px; font-weight: bold; color: #ef4444;">${wrongPercent}%</span>
                            </div>
                            <div style="background: #e5e7eb; height: 20px; border-radius: 10px; overflow: hidden;">
                                <div style="background: linear-gradient(90deg, #ef4444, #f87171); height: 100%; width: ${wrongPercent}%; transition: width 0.8s ease;"></div>
                            </div>
                        </div>
                    </div>
                `;
            }
            
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
                    
                    <div style="margin-top: 15px; padding: 18px; background: linear-gradient(135deg, rgba(212, 177, 130, 0.08), rgba(212, 177, 130, 0.15)); border-radius: 8px; border: 1px solid rgba(212, 177, 130, 0.3); margin-bottom: 15px;">
                        <p style="color: #32373c; font-size: 15px; line-height: 1.6; margin: 0;"><strong style="color: #b89968;">💡 הסבר:</strong> ${q.explanation}</p>
                    </div>
                    
                    ${distributionHTML}
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
        
        // If user provided email, send via email
        if (userData.email && userData.email.trim() !== '') {
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
        } else {
            // No email provided - display report directly on screen
            console.log('📄 No email provided - displaying report directly on screen');
            
            // Create a modal to display the report
            const reportModal = document.createElement('div');
            reportModal.id = 'report-modal';
            reportModal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 10000; overflow-y: auto; padding: 20px;';
            reportModal.innerHTML = `
                <div style="max-width: 800px; margin: 0 auto; position: relative;">
                    <button onclick="document.getElementById('report-modal').remove()" style="position: sticky; top: 10px; left: 100%; background: var(--gold); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 18px; font-weight: bold; margin-bottom: 20px; z-index: 10001;">
                        ✕ סגור
                    </button>
                    ${htmlEmail}
                </div>
            `;
            document.body.appendChild(reportModal);
        }
        
    } catch (error) {
        console.error('Error in downloadPDF:', error);
    }
}

async function sendToGoogleSheets(score, publishNameConsent, marketingConsent) {
    const googleSheetsWebhookURL = 'https://script.google.com/macros/s/AKfycbxY39evtrE-qKzqHqeAHfPOXO55Pq5XMdY9-VqyG7FywTaVWBqzSccEX8srju5AcEEv/exec';
    
    // Format date and time
    const now = new Date();
    const dateStr = now.toLocaleDateString('he-IL');
    const timeStr = now.toLocaleTimeString('he-IL');
    const timestamp = now.toISOString();
    
    // Check if this is a repeat attempt
    let attemptNumber = 1;
    let isRepeatUser = false;
    
    if (firebaseEnabled && db && userData.phone) {
        try {
            const previousAttempts = await db.collection('attempts')
                .where('user_phone', '==', userData.phone)
                .where('quiz_type', '==', currentQuiz)
                .where('status', '==', 'completed')
                .get();
            
            attemptNumber = previousAttempts.size + 1;
            isRepeatUser = previousAttempts.size > 0;
        } catch (error) {
            console.error('Error checking previous attempts:', error);
        }
    }
    
    // Prepare detailed answers breakdown
    const answersBreakdown = [];
    for (let i = 0; i < quizData.questions.length; i++) {
        const userAnswer = userAnswers[`q${i}`];
        const question = quizData.questions[i];
        const correctAnswer = question.correctIndex;
        const partialAnswer = question.partialIndex;
        
        let result = 'wrong';
        if (userAnswer === correctAnswer) {
            result = 'correct';
        } else if (partialAnswer >= 0 && userAnswer === partialAnswer) {
            result = 'partial';
        } else if (userAnswer === undefined) {
            result = 'timeout';
        }
        
        answersBreakdown.push({
            question_number: i + 1,
            question_text: question.question,
            user_answer: userAnswer !== undefined ? question.options[userAnswer] : 'לא נענתה',
            correct_answer: question.options[correctAnswer],
            result: result
        });
    }
    
    // Prepare comprehensive payload for Google Sheets
    const payload = {
        // Timestamp
        timestamp: timestamp,
        date: dateStr,
        time: timeStr,
        
        // User Information
        name: userData.name || '',
        phone: userData.phone || '',
        email: userData.email || '',
        
        // Quiz Information
        quiz_type: currentQuiz === 'shabbat' ? 'הלכות שבת' : 'איסור והיתר',
        score: score,
        total_questions: quizData.questions.length,
        correct_answers: answersBreakdown.filter(a => a.result === 'correct').length,
        partial_answers: answersBreakdown.filter(a => a.result === 'partial').length,
        wrong_answers: answersBreakdown.filter(a => a.result === 'wrong').length,
        timeout_answers: answersBreakdown.filter(a => a.result === 'timeout').length,
        
        // Attempt Information
        attempt_number: attemptNumber,
        is_repeat_user: isRepeatUser ? 'כן' : 'לא',
        
        // Consent Information
        publish_name_consent: publishNameConsent ? 'כן' : 'לא',
        marketing_consent: marketingConsent ? 'כן' : 'לא',
        
        // UTM Parameters
        utm_source: utmData.utm_source || '',
        utm_medium: utmData.utm_medium || '',
        utm_campaign: utmData.utm_campaign || '',
        utm_term: utmData.utm_term || '',
        utm_content: utmData.utm_content || '',
        utm_id: utmData.utm_id || '',
        gclid: utmData.gclid || '',
        fbclid: utmData.fbclid || '',
        
        // Technical Information
        page_url: window.location.href,
        user_agent: navigator.userAgent,
        
        // Detailed Answers
        answers_json: JSON.stringify(answersBreakdown),
        
        // Firebase Attempt ID
        attempt_id: currentAttemptId || ''
    };
    
    try {
        console.log('📊 Sending complete data to Google Sheets...');
        console.log('Payload:', payload);
        
        const response = await fetch(googleSheetsWebhookURL, {
            method: 'POST',
            mode: 'no-cors', // Google Apps Script requires no-cors
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
        
        console.log('✅ Data sent to Google Sheets successfully!');
    } catch (error) {
        console.error('❌ Error sending to Google Sheets:', error);
        console.error('Error details:', error.message);
        // Don't throw - we don't want to block the user flow if Google Sheets fails
    }
}

async function sendToCRM(benefit, options = {}) {
    const webhookURL = 'https://hook.eu2.make.com/xlel1ekv0qh3q3hgcwhvyv45jbwen7jy';
    
    const score = calculateScore();
    const marketingConsent = options.marketing_consent !== undefined ? options.marketing_consent : true;
    
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
    
    // Create note with quiz details including marketing consent status
    const consentNote = marketingConsent ? '' : ' [לא אישר דיוור]';
    const quizNote = benefit === 'quiz_completed' 
        ? `ליד מאתגר הפסיקה. ציון: ${score}%. השלים מבחן - טרם בחר הטבה${consentNote}`
        : `ליד מאתגר הפסיקה. ציון: ${score}%. התעניין בהטבה: ${benefit}${consentNote}`;
    
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
                value: utmData.utm_source || "",
                raw_value: utmData.utm_source || "",
                required: "0"
            },
            field_aab9d21: {
                id: "field_aab9d21",
                type: "hidden",
                title: "UTM",
                value: JSON.stringify(utmData),
                raw_value: JSON.stringify(utmData),
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

async function showIntermediateResults(score) {
    showScreen('screen-intermediate-results');
    
    // Fetch stats for comparison
    let totalTakers = 0;
    let avgScore = 0;
    
    if (firebaseEnabled && db) {
        try {
            const statsRef = db.collection('stats').doc('global_stats');
            const statsDoc = await statsRef.get();
            
            if (statsDoc.exists) {
                const data = statsDoc.data();
                const fieldName = currentQuiz === 'shabbat' ? 'total_shabbat_takers' : 'total_issur_heter_takers';
                const avgFieldName = currentQuiz === 'shabbat' ? 'avg_score_shabbat' : 'avg_score_issur_heter';
                
                totalTakers = data[fieldName] || 0;
                avgScore = data[avgFieldName] || 0;
            }
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    }
    
    // Calculate average answer time
    const totalQuestions = quizData.questions.length;
    const avgTimePerQuestion = 30; // Default, could be calculated from actual data
    
    // Populate intermediate parameters
    const paramsContainer = document.getElementById('intermediate-params');
    paramsContainer.innerHTML = `
        <!-- Parameter 1: Score vs Average -->
        <div class="param-card">
            <div class="donut-chart">
                <svg width="180" height="180">
                    <circle cx="90" cy="90" r="70" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="20"/>
                    <circle cx="90" cy="90" r="70" fill="none" stroke="${score >= avgScore ? '#86efac' : '#fbbf24'}" stroke-width="20" 
                            stroke-dasharray="${(score / 100) * 439.8} 439.8" stroke-linecap="round" 
                            transform="rotate(-90 90 90)"/>
                </svg>
                <div class="donut-chart-center">
                    <div class="donut-chart-percentage">${score}%</div>
                    <div class="donut-chart-label">הציון שלך</div>
                </div>
            </div>
            <div class="param-text">
                <h4>הציון שלך מול הממוצע</h4>
                <p>הציון הממוצע של כלל המשיבים עד לרגע זה הוא ${avgScore}%</p>
                <p>${score >= avgScore ? 'אתה מעל הממוצע! 🎯' : 'יש מקום לשיפור, אבל רבים נמצאים באותו מקום 💪'}</p>
            </div>
        </div>
        
        <!-- Parameter 2: Confidence Level -->
        <div class="param-card">
            <div class="donut-chart">
                <svg width="180" height="180">
                    <circle cx="90" cy="90" r="70" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="20"/>
                    <circle cx="90" cy="90" r="70" fill="none" stroke="#D4B182" stroke-width="20" 
                            stroke-dasharray="${(Object.keys(userAnswers).length / totalQuestions) * 439.8} 439.8" stroke-linecap="round" 
                            transform="rotate(-90 90 90)"/>
                </svg>
                <div class="donut-chart-center">
                    <div class="donut-chart-percentage">${Math.round((Object.keys(userAnswers).length / totalQuestions) * 100)}%</div>
                    <div class="donut-chart-label">השלמת</div>
                </div>
            </div>
            <div class="param-text">
                <h4>רמת השלמת המבחן</h4>
                <p>ענית על ${Object.keys(userAnswers).length} מתוך ${totalQuestions} שאלות</p>
                <p>רוב המשיבים משלימים את כל השאלות 📝</p>
            </div>
        </div>
        
        <!-- Parameter 3: Category Performance -->
        <div class="param-card">
            <div class="donut-chart">
                <svg width="180" height="180">
                    <circle cx="90" cy="90" r="70" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="20"/>
                    <circle cx="90" cy="90" r="70" fill="none" stroke="#f59e0b" stroke-width="20" 
                            stroke-dasharray="${(score / 100) * 439.8} 439.8" stroke-linecap="round" 
                            transform="rotate(-90 90 90)"/>
                </svg>
                <div class="donut-chart-center">
                    <div class="donut-chart-percentage">${score}%</div>
                    <div class="donut-chart-label">ביצועים</div>
                </div>
            </div>
            <div class="param-text">
                <h4>ביצועים בתחום ${currentQuiz === 'shabbat' ? 'הלכות שבת' : 'איסור והיתר'}</h4>
                <p>תחום זה מאתגר רבים מהנבחנים</p>
                <p>${score >= 70 ? 'הצלחת להתמודד היטב! 🌟' : 'זה תחום שדורש התעמקות נוספת '}</p>
            </div>
        </div>
    `;
}

async function updateGoogleSheetsWithBenefit(benefit) {
    const googleSheetsWebhookURL = 'https://script.google.com/macros/s/AKfycbxY39evtrE-qKzqHqeAHfPOXO55Pq5XMdY9-VqyG7FywTaVWBqzSccEX8srju5AcEEv/exec';
    
    // Map benefit to Hebrew course name
    const benefitMapping = {
        'shabbat_course_discount': 'הלכות שבת',
        'issur_heter_course_discount': 'איסור והיתר',
        'niddah_course_discount': 'הלכות נידה/טהרה',
        'mamonot_special': 'ממונות (חושן משפט)'
    };
    const benefitName = benefitMapping[benefit] || benefit;
    
    const payload = {
        update_type: 'benefit_selection',
        phone: userData.phone || '',
        email: userData.email || '',
        attempt_id: currentAttemptId || '',
        selected_benefit: benefitName,
        timestamp: new Date().toISOString()
    };
    
    try {
        console.log('📊 Updating Google Sheets with benefit selection...');
        await fetch(googleSheetsWebhookURL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
        console.log('✅ Benefit selection sent to Google Sheets!');
    } catch (error) {
        console.error('❌ Error updating Google Sheets with benefit:', error);
    }
}

async function revealFullReport() {
    const selectedBenefit = document.querySelector('input[name="lottery-benefit"]:checked');
    
    if (!selectedBenefit) {
        alert('אנא בחר הטבה להגרלה');
        return;
    }
    
    // Save selected benefit
    if (firebaseEnabled && db && currentAttemptId && !currentAttemptId.startsWith('local_')) {
        try {
            await db.collection('attempts').doc(currentAttemptId).update({
                selected_benefit: selectedBenefit.value,
                updated_at: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('Error saving benefit:', error);
        }
    }
    
    // Analytics: Benefit Selected
    trackEvent('benefit_selected', {
        benefit_type: selectedBenefit.value,
        quiz_type: currentQuiz,
        score: calculateScore()
    });
    
    // Send benefit selection to CRM
    await sendToCRM(selectedBenefit.value);
    
    // Update Google Sheets with selected benefit
    await updateGoogleSheetsWithBenefit(selectedBenefit.value);
    
    // Calculate score
    const score = calculateScore();
    
    // Show results screen
    await showResults(score);
    
    // Generate and send detailed report
    await downloadPDF();
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

// Leaderboard Functions
let currentLeaderboardQuiz = 'shabbat';

window.openLeaderboard = function() {
    showScreen('screen-leaderboard');
    showLeaderboard('shabbat');
}

// Handle consent checkboxes - only if elements exist
const publishNameCheckbox = document.getElementById('publish-name-consent');
if (publishNameCheckbox) {
    publishNameCheckbox.addEventListener('change', function() {
        const anonymousNotice = document.getElementById('anonymous-notice');
        if (!this.checked) {
            anonymousNotice.classList.remove('hidden');
        } else {
            anonymousNotice.classList.add('hidden');
        }
    });
}

const marketingCheckbox = document.getElementById('marketing-consent');
if (marketingCheckbox) {
    marketingCheckbox.addEventListener('change', function() {
        const noMarketingNotice = document.getElementById('no-marketing-notice');
        const submitBtn = document.getElementById('submit-lead-btn');
        
        if (!this.checked) {
            noMarketingNotice.classList.remove('hidden');
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.5';
            submitBtn.style.cursor = 'not-allowed';
        } else {
            noMarketingNotice.classList.add('hidden');
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
            submitBtn.style.cursor = 'pointer';
        }
    });
}

window.showLeaderboard = async function(quizType = 'shabbat') {
    currentLeaderboardQuiz = 'shabbat'; // Always use shabbat
    
    // Show loading state
    document.getElementById('leaderboard-loading').classList.remove('hidden');
    document.getElementById('leaderboard-list').classList.add('hidden');
    document.getElementById('leaderboard-empty').classList.add('hidden');
    
    // Fetch leaderboard data - always shabbat
    await fetchLeaderboard('shabbat');
}

async function fetchLeaderboard(quizType) {
    if (!firebaseEnabled || !db) {
        // Show empty state if Firebase is not available
        document.getElementById('leaderboard-loading').classList.add('hidden');
        document.getElementById('leaderboard-empty').classList.remove('hidden');
        return;
    }
    
    try {
        // Simple query without composite index - just filter by quiz_type and status
        const leaderboardQuery = await db.collection('attempts')
            .where('quiz_type', '==', quizType)
            .where('status', '==', 'completed')
            .get();
        
        if (leaderboardQuery.empty) {
            document.getElementById('leaderboard-loading').classList.add('hidden');
            document.getElementById('leaderboard-empty').classList.remove('hidden');
            return;
        }
        
        // Process results and sort in JavaScript
        const leaderboardData = [];
        leaderboardQuery.forEach(doc => {
            const data = doc.data();
            const publishName = data.publish_name !== false; // Default true if not set
            leaderboardData.push({
                name: publishName ? (data.user_name || 'משתמש אנונימי') : 'משתמש אנונימי',
                score: data.final_score || 0,
                phone: data.user_phone || ''
            });
        });
        
        // Sort by score descending and take top 10
        leaderboardData.sort((a, b) => b.score - a.score);
        const top10 = leaderboardData.slice(0, 10);
        
        displayLeaderboard(top10);
        
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        document.getElementById('leaderboard-loading').classList.add('hidden');
        document.getElementById('leaderboard-empty').classList.remove('hidden');
    }
}

function displayLeaderboard(data) {
    const listContainer = document.getElementById('leaderboard-list');
    listContainer.innerHTML = '';
    
    if (data.length === 0) {
        document.getElementById('leaderboard-loading').classList.add('hidden');
        document.getElementById('leaderboard-empty').classList.remove('hidden');
        return;
    }
    
    // SVG Icon - Torah Crown (Keter Torah) - Minimalist gold design for all top 3
    const torahCrownSVG = (size = 'medium') => {
        const scale = size === 'large' ? 1.15 : size === 'small' ? 0.9 : 1;
        return `
        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style="transform: scale(${scale})">
            <!-- Crown base -->
            <path d="M16 42 L20 28 L24 42 L28 28 L32 42 L36 28 L40 42 L44 28 L48 42 Z" 
                  fill="none" stroke="#D4B182" stroke-width="2" stroke-linejoin="round"/>
            <!-- Crown top band -->
            <rect x="14" y="42" width="36" height="6" rx="1" fill="#D4B182" opacity="0.3" stroke="#D4B182" stroke-width="1.5"/>
            <!-- Crown bottom band -->
            <rect x="12" y="48" width="40" height="4" rx="2" fill="#D4B182" stroke="#b89968" stroke-width="1.5"/>
            <!-- Center ornament -->
            <circle cx="32" cy="35" r="3" fill="#D4B182" opacity="0.5"/>
        </svg>
    `;
    };
    
    data.forEach((entry, index) => {
        const rank = index + 1;
        const entryDiv = document.createElement('div');
        entryDiv.className = 'leaderboard-entry';
        
        // Add special class for top 3
        if (rank === 1) {
            entryDiv.classList.add('top-1');
        } else if (rank === 2) {
            entryDiv.classList.add('top-2');
        } else if (rank === 3) {
            entryDiv.classList.add('top-3');
        }
        
        // Rank display with Torah Crown for top 3, numbers for rest
        let rankDisplay;
        if (rank === 1) {
            rankDisplay = torahCrownSVG('large');
        } else if (rank === 2) {
            rankDisplay = torahCrownSVG('medium');
        } else if (rank === 3) {
            rankDisplay = torahCrownSVG('small');
        } else {
            rankDisplay = `<span style="font-size: 1.6rem; font-weight: 600; color: rgba(212, 177, 130, 0.7);">${rank}</span>`;
        }
        
        // Format name with הרב and שליט"א if not anonymous
        const displayName = entry.name === 'משתמש אנונימי' 
            ? entry.name 
            : `הרב ${entry.name} שליט"א`;
        
        entryDiv.innerHTML = `
            <div class="leaderboard-rank">${rankDisplay}</div>
            <div class="leaderboard-name">${displayName}</div>
            <div class="leaderboard-score">${entry.score}%</div>
        `;
        
        listContainer.appendChild(entryDiv);
    });
    
    document.getElementById('leaderboard-loading').classList.add('hidden');
    document.getElementById('leaderboard-list').classList.remove('hidden');
}
