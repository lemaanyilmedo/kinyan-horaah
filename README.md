# קניין הוראה - Kinyan Hora'ah Quiz App

אפליקציית בחנים אינטראקטיבית בהלכה עם אינטגרציה מלאה ל-Firebase Firestore.

## 🎯 תיאור הפרויקט

מערכת בחנים מתקדמת בנושאי הלכה (שבת ואיסור והיתר) עם:
- ✅ שאלות רב-ברירה אינטראקטיביות
- ✅ מעקב אחר ציונים והתקדמות
- ✅ שמירת נתונים ב-Firebase Firestore
- ✅ איסוף לידים (שם, טלפון, מייל)
- ✅ תמיכה ב-NetFree (Long Polling)

## 🛠️ טכנולוגיות

- **Frontend:** HTML5, Vanilla JavaScript, TailwindCSS
- **Backend:** Firebase Firestore (NoSQL)
- **Hosting:** GitHub Pages
- **תאימות:** NetFree compatible (Long Polling)

## 🚀 התקנה והרצה מקומית

### דרישות מקדימות
- Python 3.x או Node.js
- Git

### הרצה מקומית

**אפשרות 1: Python**
```bash
cd kinyan-horaah
python -m http.server 8080
```

**אפשרות 2: npx**
```bash
cd kinyan-horaah
npx http-server -p 8080
```

פתח בדפדפן: `http://localhost:8080`

## 🔥 הגדרת Firebase

### 1. יצירת פרויקט Firebase
1. גש ל-[Firebase Console](https://console.firebase.google.com/)
2. צור פרויקט חדש
3. הפעל Firestore Database

### 2. הגדרת Security Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /quizzes/{quizId} {
      allow read: if true;
      allow write: if false;
    }
    match /users/{phone} {
      allow read, write: if true;
    }
    match /attempts/{attemptId} {
      allow read, write: if true;
    }
    match /stats/{statsId} {
      allow read, write: if true;
    }
  }
}
```

### 3. עדכון הגדרות Firebase
עדכן את `app.js` עם פרטי הפרויקט שלך:
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

## 🌐 תאימות NetFree

הפרויקט כולל תמיכה ב-**Long Polling** לעקיפת חסימות NetFree:

```javascript
db.settings({
    experimentalForceLongPolling: true,
    experimentalAutoDetectLongPolling: true
});
```

זה מאפשר ל-Firebase לעבוד עם סינון NetFree ללא בעיות.

## 📊 מבנה הנתונים

### Collections ב-Firestore:

**quizzes/** - שאלות המבחן
```javascript
{
  questions: [
    {
      question: "שאלה...",
      options: ["תשובה 1", "תשובה 2", "תשובה 3"],
      correct: 0,
      explanation: "הסבר..."
    }
  ]
}
```

**users/** - פרטי משתמשים
```javascript
{
  name: "שם",
  phone: "טלפון",
  email: "מייל",
  createdAt: timestamp
}
```

**attempts/** - ניסיונות מבחן
```javascript
{
  userId: "phone",
  quizType: "shabbat/issur",
  score: 85,
  answers: [...],
  completedAt: timestamp
}
```

## 🎨 פיצ'רים

- ✅ שני נושאי בחינה: הלכות שבת ואיסור והיתר
- ✅ 10 שאלות לכל בחינה
- ✅ הסברים מפורטים לכל תשובה
- ✅ חישוב ציון אוטומטי
- ✅ שמירת התקדמות ב-Local Storage
- ✅ אפשרות להמשיך בחינה שהופסקה
- ✅ איסוף נתונים ושליחה ל-Firestore
- ✅ עיצוב רספונסיבי עם TailwindCSS

## 📝 שימוש

1. בחר נושא בחינה (שבת או איסור והיתר)
2. ענה על 10 שאלות
3. קבל ציון והסברים
4. הזן פרטים אישיים (שם, טלפון, מייל)
5. הנתונים נשמרים אוטומטית ב-Firestore

## 🔄 פריסה ל-GitHub Pages

```bash
git add .
git commit -m "Update"
git push origin main
```

האתר יתעדכן אוטומטית ב: `https://lemaanyilmedo.github.io/kinyan-horaah/`

## 🐛 פתרון בעיות

### Firebase לא מתחבר
- ודא שהגדרות Firebase נכונות ב-`app.js`
- בדוק שכללי האבטחה מעודכנים
- אם יש NetFree, ודא ש-Long Polling מופעל

### שגיאת CORS
- Long Polling אמור לפתור את זה
- ודא שהאתר רץ דרך HTTP server (לא `file://`)

## 📄 רישיון

MIT License

## 👨‍💻 מפתחים

פרויקט קניין הוראה - 2026