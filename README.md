# מערכת מבחנים "קניין הוראה"

## תיאור הפרויקט
מערכת מבחנים אינטראקטיבית להלכות שבת ואיסור והיתר, בנויה כ-SPA (Single Page Application) עם Firebase.

## טכנולוגיות
- HTML5
- TailwindCSS
- Vanilla JavaScript
- Firebase (Firestore + Hosting)

## מבנה הפרויקט
```
kinyan-horaah/
├── index.html          # קובץ HTML ראשי עם כל המסכים
├── app.js             # לוגיקה ראשית ואינטגרציה עם Firebase
├── firebase.json      # הגדרות Firebase Hosting
├── firestore.rules    # כללי אבטחה ל-Firestore
└── README.md          # תיעוד
```

## הגדרת Firebase

### שלב 1: יצירת פרויקט Firebase
1. היכנס ל-[Firebase Console](https://console.firebase.google.com/)
2. צור פרויקט חדש בשם "kinyan-horaah"
3. הפעל את Firestore Database
4. הפעל את Firebase Hosting

### שלב 2: קבלת פרטי התצורה
1. בקונסול Firebase, לחץ על הגדרות הפרויקט (גלגל השיניים)
2. גלול ל-"Your apps" ולחץ על "Add app" > "Web"
3. העתק את פרטי ה-`firebaseConfig`
4. החלף את הפרטים בקובץ `app.js` בשורות 1-7:

```javascript
let firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

### שלב 3: הגדרת Firestore
1. צור את האוספים הבאים ב-Firestore:
   - `quizzes` - תוכן המבחנים
   - `users` - משתמשים
   - `attempts` - ניסיונות מבחן
   - `stats` - סטטיסטיקות

2. העלה נתוני מבחן לדוגמה (אופציונלי - הקוד כבר מכיל שאלות דיפולטיביות)

### שלב 4: פריסה (Deployment)
```bash
# התקן Firebase CLI
npm install -g firebase-tools

# התחבר ל-Firebase
firebase login

# אתחל את הפרויקט
firebase init

# בחר:
# - Firestore
# - Hosting
# - השתמש בפרויקט הקיים
# - Public directory: . (נקודה)
# - Single-page app: Yes

# פרוס לענן
firebase deploy
```

## מבנה הנתונים (Database Schema)

### אוסף `quizzes`
```javascript
{
  doc_id: "shabbat" | "issur_heter",
  title: "הלכות שבת",
  questions: [
    {
      question: "טקסט השאלה",
      options: ["תשובה 1", "תשובה 2", "תשובה 3"],
      correctIndex: 0,
      explanation: "הסבר הלכתי"
    }
  ]
}
```

### אוסף `users`
```javascript
{
  phone: "050-1234567",  // Primary Key
  full_name: "שם מלא",
  email: "email@example.com",
  created_at: Timestamp
}
```

### אוסף `attempts`
```javascript
{
  attempt_id: "auto-generated",
  user_phone: "050-1234567",
  quiz_type: "shabbat",
  status: "active" | "paused" | "completed",
  current_q_index: 3,
  answers: { "q1": 2, "q2": 1 },
  final_score: 85,
  selected_benefit: "shabbat_course_discount",
  created_at: Timestamp,
  updated_at: Timestamp
}
```

### אוסף `stats`
```javascript
{
  doc_id: "global_stats",
  total_shabbat_takers: 150,
  avg_score_shabbat: 72,
  total_issur_heter_takers: 120,
  avg_score_issur_heter: 68,
  hard_question_errors: 95
}
```

## פיצ'רים מיוחדים

### 1. "צריך עיון" - שמירה וחזרה
- המשתמש יכול להשהות את המבחן
- המערכת שומרת את המיקום והתשובות
- נוצר לינק אישי להמשך: `?resume=true&phone=XXX&quiz=shabbat`

### 2. סטטיסטיקה בזמן אמת
- עדכון אוטומטי של מסמך `stats` בכל סיום מבחן
- הצגה מהירה של נתונים השוואתיים

### 3. אינטגרציה CRM
- שליחת webhook ל-Make/Integromat בסיום מבחן
- יש לעדכן את ה-URL בקובץ `app.js` בשורה 462:
```javascript
const webhookURL = 'https://hook.integromat.com/YOUR_WEBHOOK_URL';
```

## הרצה מקומית (לפיתוח)

```bash
# פתח את index.html בדפדפן
# או השתמש ב-Live Server
npx live-server
```

## אבטחה
- כללי Firestore מוגדרים ב-`firestore.rules`
- משתמש יכול לקרוא/לכתוב רק את המידע שלו
- שאלות המבחן הן read-only

## תמיכה ניידים
- העיצוב מותאם ל-Mobile First
- תומך בכל הדפדפנים המודרניים
- אופטימיזציה למסכים קטנים

## טיפים לשימוש
1. בדוק את קונסולת הדפדפן לשגיאות
2. Local Storage שומר את המצב גם אם הדפדפן נסגר
3. ניתן להריץ מבחנים מרובים עם אותו טלפון
4. הנתונים נשמרים גם אם אין חיבור לאינטרנט (יסתנכרנו מאוחר יותר)

## רישיון
© 2026 קניין הוראה - כל הזכויות שמורות
