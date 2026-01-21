# מדריך פריסה ידנית ל-Firebase (ללא CLI)

מכיוון שיש בעיה טכנית עם Firebase CLI ב-PowerShell, הנה מדריך לפריסה ידנית דרך הקונסול של Firebase.

## אפשרות 1: פריסה דרך Firebase Console (הכי פשוט)

### שלב 1: יצירת פרויקט Firebase
1. היכנס ל-https://console.firebase.google.com/
2. לחץ "Add project" / "הוסף פרויקט"
3. שם הפרויקט: `kinyan-horaah` (או כל שם אחר)
4. השבת Google Analytics (אופציונלי)
5. לחץ "Create project"

### שלב 2: הפעלת Firestore
1. בתפריט הצד, לחץ "Firestore Database"
2. לחץ "Create database"
3. בחר "Start in test mode"
4. בחר מיקום: `europe-west1`
5. לחץ "Enable"

### שלב 3: קבלת פרטי התצורה
1. לחץ על ⚙️ (הגדרות) > "Project settings"
2. גלול ל-"Your apps"
3. לחץ על `</>` (Web app)
4. שם: `kinyan-horaah-web`
5. סמן "Also set up Firebase Hosting"
6. לחץ "Register app"
7. **העתק את כל קוד ה-firebaseConfig**

### שלב 4: עדכון הקוד
פתח את `app.js` ועדכן את השורות 1-7 עם הפרטים שקיבלת:

```javascript
let firebaseConfig = {
    apiKey: "AIza...",  // הדבק כאן
    authDomain: "kinyan-horaah.firebaseapp.com",
    projectId: "kinyan-horaah",
    storageBucket: "kinyan-horaah.appspot.com",
    messagingSenderId: "123...",
    appId: "1:123..."
};
```

### שלב 5: פריסה ידנית דרך Console
1. בקונסול Firebase, לך ל-"Hosting" בתפריט הצד
2. לחץ "Get started"
3. דלג על שלבי ה-CLI (לחץ "Next" עד הסוף)
4. לחץ על שלוש הנקודות ליד "Add custom domain"
5. בחר "Upload files manually"
6. גרור את הקבצים הבאים:
   - `index.html`
   - `app.js`
7. לחץ "Deploy"

**זהו! האתר שלך יהיה זמין ב:**
`https://kinyan-horaah.web.app`

---

## אפשרות 2: פריסה דרך GitHub Pages (חלופה)

### שלב 1: צור repository ב-GitHub
1. היכנס ל-https://github.com/
2. לחץ "New repository"
3. שם: `kinyan-horaah`
4. Public
5. לחץ "Create repository"

### שלב 2: העלה את הקבצים
```bash
cd c:\Users\admin\CascadeProjects\audio-transcription\kinyan-horaah
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/kinyan-horaah.git
git push -u origin main
```

### שלב 3: הפעל GitHub Pages
1. ב-repository, לך ל-"Settings"
2. לחץ "Pages" בתפריט הצד
3. Source: "Deploy from a branch"
4. Branch: `main` / `root`
5. לחץ "Save"

**האתר יהיה זמין ב:**
`https://YOUR_USERNAME.github.io/kinyan-horaah/`

---

## אפשרות 3: פריסה דרך Netlify (הכי מהיר)

### שלב 1: גש ל-Netlify
1. היכנס ל-https://www.netlify.com/
2. לחץ "Sign up" (אפשר עם GitHub)

### שלב 2: Deploy ידני
1. לחץ "Add new site" > "Deploy manually"
2. גרור את התיקייה `kinyan-horaah` לאזור ה-Drop
3. המתן לסיום ההעלאה

**זהו! תקבל URL כמו:**
`https://random-name-123.netlify.app`

### שלב 3 (אופציונלי): שנה את השם
1. לחץ "Site settings"
2. "Change site name"
3. הזן: `kinyan-horaah`
4. שמור

**ה-URL החדש:**
`https://kinyan-horaah.netlify.app`

---

## אפשרות 4: נסה שוב עם CLI (תיקון)

אם אתה רוצה לנסות שוב עם Firebase CLI, הנה הפתרון לבעיה:

### הבעיה
PowerShell מוסיף תו עברי "ב" לפני הפקודות.

### הפתרון
פתח **Command Prompt** (לא PowerShell):

1. לחץ Win+R
2. הקלד: `cmd`
3. Enter
4. הרץ:

```cmd
cd c:\Users\admin\CascadeProjects\audio-transcription\kinyan-horaah
npx firebase-tools login
npx firebase-tools init
npx firebase-tools deploy --only hosting
```

---

## המלצה שלי

**לפריסה מהירה:** השתמש ב-Netlify (אפשרות 3) - הכי פשוט וללא הגדרות.

**לפרויקט מלא עם Database:** השתמש ב-Firebase Console (אפשרות 1) - תקבל גם Firestore.

**לפיתוח ושיתוף קוד:** השתמש ב-GitHub Pages (אפשרות 2).

---

## בדיקה לאחר הפריסה

1. פתח את ה-URL שקיבלת
2. בדוק שהמסך הראשי נטען
3. לחץ על "הלכות שבת - אתגר אותי"
4. ודא שהשאלות מופיעות
5. נסה לענות על שאלה
6. בדוק שהמעבר לשאלה הבאה עובד

**אם יש שגיאות:**
- פתח את Developer Tools (F12)
- לך ל-Console
- בדוק אם יש שגיאות אדומות
- שלח לי את השגיאות ואני אתקן

---

## עדכון אחרי פריסה

כשתרצה לעדכן את האתר:

**Netlify:** גרור שוב את התיקייה
**GitHub Pages:** `git push`
**Firebase Console:** העלה מחדש את הקבצים

או השתמש ב-CLI אם תצליח לתקן את הבעיה.
