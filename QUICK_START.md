# התחלה מהירה - 3 דקות לפריסה

## הדרך הכי מהירה: Netlify Drop & Drag

### צעד 1: הכן את הקבצים (כבר מוכן!)
כל הקבצים נמצאים בתיקייה:
`c:\Users\admin\CascadeProjects\audio-transcription\kinyan-horaah`

### צעד 2: פרוס ב-3 קליקים
1. **גש ל:** https://app.netlify.com/drop
2. **גרור** את כל התיקייה `kinyan-horaah` לחלון הדפדפן
3. **המתן** 30 שניות

**זהו! תקבל קישור כמו:**
`https://random-name-123.netlify.app`

---

## אם אתה רוצה Firebase (עם Database)

### צעד 1: צור פרויקט
1. גש ל: https://console.firebase.google.com/
2. "Add project" → שם: `kinyan-horaah`
3. לחץ "Create project"

### צעד 2: הפעל Firestore
1. תפריט צד → "Firestore Database"
2. "Create database" → "Test mode"
3. מיקום: `europe-west1`

### צעד 3: קבל את פרטי החיבור
1. ⚙️ → "Project settings"
2. "Your apps" → `</>`
3. שם: `kinyan-horaah-web`
4. **העתק את firebaseConfig**

### צעד 4: עדכן את app.js
פתח `app.js` והחלף בשורות 1-7:
```javascript
let firebaseConfig = {
    apiKey: "הדבק-כאן",
    authDomain: "הדבק-כאן",
    projectId: "הדבק-כאן",
    storageBucket: "הדבק-כאן",
    messagingSenderId: "הדבק-כאן",
    appId: "הדבק-כאן"
};
```

### צעד 5: פרוס
**אפשרות A - דרך Console:**
1. Firebase Console → "Hosting"
2. "Get started" → דלג על CLI
3. Upload files: `index.html` + `app.js`

**אפשרות B - דרך CMD:**
```cmd
cd c:\Users\admin\CascadeProjects\audio-transcription\kinyan-horaah
npx firebase-tools login
npx firebase-tools init
npx firebase-tools deploy --only hosting
```

---

## בדיקה מהירה

לאחר הפריסה:
1. ✅ פתח את הקישור שקיבלת
2. ✅ לחץ "הלכות שבת - אתגר אותי"
3. ✅ ענה על שאלה ראשונה
4. ✅ בדוק שעובר לשאלה הבאה

**אם יש בעיה:**
- לחץ F12 → Console
- צלם מסך של השגיאות
- שלח לי

---

## המלצה שלי

**רק רוצה לראות איך זה נראה?**
→ השתמש ב-Netlify Drop (הכי מהיר)

**רוצה מערכת מלאה עם שמירת נתונים?**
→ Firebase (יותר הגדרות אבל שווה)

**רוצה לשתף קוד עם מפתחים?**
→ GitHub Pages

---

## עזרה נוספת

- מדריך מפורט: `MANUAL_DEPLOY.md`
- תיעוד מלא: `README.md`
- הגדרות Firebase: `SETUP_GUIDE.md`
