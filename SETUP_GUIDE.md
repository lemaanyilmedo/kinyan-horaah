# מדריך התקנה והפעלה - מערכת קניין הוראה

## שלב 1: הכנת סביבת העבודה

### התקנת Node.js ו-Firebase CLI
```bash
# הורד והתקן Node.js מ-https://nodejs.org/

# התקן Firebase CLI
npm install -g firebase-tools

# בדוק שההתקנה הצליחה
firebase --version
```

## שלב 2: יצירת פרויקט Firebase

### 2.1 יצירת הפרויקט
1. היכנס ל-https://console.firebase.google.com/
2. לחץ על "Add project" / "הוסף פרויקט"
3. שם הפרויקט: `kinyan-horaah`
4. השבת Google Analytics (אופציונלי)
5. לחץ "Create project"

### 2.2 הפעלת Firestore Database
1. בתפריט הצד, לחץ על "Firestore Database"
2. לחץ "Create database"
3. בחר "Start in test mode" (נשנה מאוחר יותר)
4. בחר מיקום: `europe-west1` (אירופה)
5. לחץ "Enable"

### 2.3 הפעלת Firebase Hosting
1. בתפריט הצד, לחץ על "Hosting"
2. לחץ "Get started"
3. עבור את השלבים (נעשה זאת מה-CLI)

### 2.4 קבלת פרטי התצורה
1. לחץ על הגדרות הפרויקט (⚙️ בתפריט הצד)
2. גלול למטה ל-"Your apps"
3. לחץ על `</>` (Web app)
4. שם האפליקציה: `kinyan-horaah-web`
5. סמן "Also set up Firebase Hosting"
6. לחץ "Register app"
7. **העתק את קוד ה-firebaseConfig**

### 2.5 עדכון הקוד עם פרטי Firebase
פתח את הקובץ `app.js` ועדכן את השורות 1-7:

```javascript
let firebaseConfig = {
    apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    authDomain: "kinyan-horaah.firebaseapp.com",
    projectId: "kinyan-horaah",
    storageBucket: "kinyan-horaah.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef123456"
};
```

## שלב 3: אתחול הפרויקט

```bash
# נווט לתיקיית הפרויקט
cd c:\Users\admin\CascadeProjects\audio-transcription\kinyan-horaah

# התחבר ל-Firebase
firebase login

# אתחל את הפרויקט
firebase init
```

### בזמן האתחול, בחר:
- **Firestore**: Yes
- **Hosting**: Yes
- **Use an existing project**: kinyan-horaah
- **Firestore rules file**: firestore.rules (ברירת מחדל)
- **Firestore indexes file**: firestore.indexes.json (ברירת מחדל)
- **Public directory**: `.` (נקודה - תיקייה נוכחית)
- **Configure as single-page app**: Yes
- **Set up automatic builds**: No
- **Overwrite index.html**: No

## שלב 4: הוספת נתוני מבחן (אופציונלי)

הקוד כבר מכיל שאלות דיפולטיביות, אבל אם תרצה להוסיף שאלות ל-Firestore:

### 4.1 יצירת מסמך מבחן שבת
1. בקונסול Firebase, לך ל-Firestore Database
2. לחץ "Start collection"
3. Collection ID: `quizzes`
4. Document ID: `shabbat`
5. הוסף שדות:
   - `title` (string): "הלכות שבת"
   - `questions` (array): [לחץ "Add item" עבור כל שאלה]

### 4.2 מבנה שאלה
כל פריט במערך `questions`:
```json
{
  "question": "טקסט השאלה",
  "options": ["תשובה 1", "תשובה 2", "תשובה 3"],
  "correctIndex": 0,
  "explanation": "הסבר הלכתי מפורט"
}
```

### 4.3 אתחול מסמך סטטיסטיקה
1. צור collection חדש: `stats`
2. Document ID: `global_stats`
3. הוסף שדות:
```json
{
  "total_shabbat_takers": 0,
  "avg_score_shabbat": 0,
  "total_issur_heter_takers": 0,
  "avg_score_issur_heter": 0,
  "hard_question_errors": 0
}
```

## שלב 5: עדכון כללי אבטחה

```bash
# פרוס את כללי האבטחה
firebase deploy --only firestore:rules
```

## שלב 6: הרצה מקומית (לבדיקה)

### אפשרות 1: Live Server (מומלץ)
```bash
# התקן live-server גלובלית
npm install -g live-server

# הרץ את השרת
live-server
```

### אפשרות 2: Firebase Hosting Emulator
```bash
firebase serve
```

### אפשרות 3: Python Simple Server
```bash
python -m http.server 8000
```

פתח דפדפן וגש ל-`http://localhost:8080` (או הפורט המתאים)

## שלב 7: פריסה לענן (Production)

```bash
# פרוס את כל הפרויקט
firebase deploy

# או פרוס רק את ה-Hosting
firebase deploy --only hosting
```

לאחר הפריסה, תקבל URL כמו:
`https://kinyan-horaah.web.app`

## שלב 8: הגדרת Webhook ל-CRM (אופציונלי)

### 8.1 יצירת Webhook ב-Make (Integromat)
1. היכנס ל-https://www.make.com/
2. צור תרחיש (Scenario) חדש
3. הוסף "Webhooks" > "Custom webhook"
4. העתק את ה-URL של ה-webhook

### 8.2 עדכון הקוד
בקובץ `app.js`, שורה 462, עדכן:
```javascript
const webhookURL = 'https://hook.eu1.make.com/xxxxxxxxxxxxx';
```

### 8.3 הגדרת התרחיש ב-Make
המידע שיתקבל:
```json
{
  "name": "שם המשתמש",
  "phone": "050-1234567",
  "email": "email@example.com",
  "quiz_type": "shabbat",
  "score": 85,
  "selected_benefit": "shabbat_course_discount",
  "timestamp": "2026-01-21T12:00:00.000Z"
}
```

חבר ל:
- Google Sheets
- CRM (Salesforce, HubSpot, וכו')
- Email (Gmail, SendGrid)
- WhatsApp Business API

## שלב 9: בדיקות

### בדיקה 1: זרימה מלאה
1. בחר מבחן
2. ענה על כל השאלות
3. מלא פרטים
4. בדוק שהנתונים נשמרו ב-Firestore

### בדיקה 2: פיצ'ר "צריך עיון"
1. התחל מבחן
2. לחץ "צריך עיון"
3. מלא פרטים
4. העתק את הלינק
5. פתח בטאב חדש
6. ודא שהמבחן ממשיך מאותה נקודה

### בדיקה 3: Local Storage
1. התחל מבחן
2. סגור את הדפדפן באמצע
3. פתח שוב
4. ודא שהמצב נשמר

### בדיקה 4: נייד
1. פתח בטלפון נייד
2. בדוק תצוגה ותפעול
3. ודא שהכפתורים נגישים

## פתרון בעיות נפוצות

### בעיה: "Firebase is not defined"
**פתרון**: ודא שה-CDN של Firebase נטען לפני `app.js`

### בעיה: "Permission denied" ב-Firestore
**פתרון**: 
```bash
firebase deploy --only firestore:rules
```

### בעיה: הנתונים לא נשמרים
**פתרון**: בדוק את הקונסולה בדפדפן (F12) לשגיאות

### בעיה: הדף לא נטען אחרי Deploy
**פתרון**: נקה את ה-Cache של הדפדפן (Ctrl+Shift+R)

## תחזוקה שוטפת

### גיבוי נתונים
```bash
# ייצוא Firestore
gcloud firestore export gs://[BUCKET_NAME]
```

### ניטור שימוש
1. Firebase Console > Usage
2. בדוק מכסות Firestore
3. בדוק Hosting bandwidth

### עדכון שאלות
1. Firestore Console
2. עדכן את collection `quizzes`
3. השינויים יופיעו מיד

## קישורים שימושיים

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [TailwindCSS Docs](https://tailwindcss.com/docs)
- [Make.com Tutorials](https://www.make.com/en/help/tutorials)

## תמיכה

לשאלות ובעיות, פנה ל:
- תיעוד טכני: README.md
- Firebase Support: https://firebase.google.com/support

---

**בהצלחה! 🚀**
