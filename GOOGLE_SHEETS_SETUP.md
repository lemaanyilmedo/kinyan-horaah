# Google Sheets Integration Setup Guide
## מדריך הגדרת אינטגרציה לגוגל שיטס

---

## 📋 סקירה כללית

המערכת כעת שולחת **את כל המידע** מכל מבחן שמושלם לגוגל שיטס, כולל:

### ✅ מידע שנשלח:
- פרטי משתמש: שם, טלפון, אימייל
- נתוני מבחן: סוג מבחן, ציון, תשובות מפורטות
- מידע על ניסיונות: ניסיון ראשון או שני
- הסכמות: פרסום שם, שיווק
- **פרמטרי UTM מלאים**: source, medium, campaign, term, content, id, gclid, fbclid
- מידע טכני: URL, User Agent
- תשובות מפורטות בפורמט JSON

### 🎯 מצבים מטופלים:
- ✅ משתמש ראשון עם/בלי אימייל
- ✅ משתמש חוזר (ניסיון שני)
- ✅ עם/בלי הסכמה לשיווק
- ✅ **שום מבחן לא יאבד!**

---

## 🚀 שלבי התקנה

### שלב 1: פתח Google Apps Script
1. פתח את הגוגל שיטס:
   https://docs.google.com/spreadsheets/d/1aJs1wUXdaP80yicIiZ2SbupPqr64bVZm4yy028lc_0A/edit
2. Extensions > Apps Script
3. מחק קוד קיים

### שלב 2: העתק סקריפט
1. פתח `google-sheets-script.gs`
2. העתק הכל
3. הדבק ב-Apps Script
4. שמור (Ctrl+S)

### שלב 3: פרוס Web App
1. Deploy > New deployment
2. Select type > Web app
3. הגדרות:
   - Execute as: Me
   - Who has access: Anyone
4. Deploy
5. העתק את ה-URL

### שלב 4: עדכן app.js
החלף את ה-URL בשתי מיקומות:
- שורה 1465 (sendToGoogleSheets)
- שורה 1839 (updateGoogleSheetsWithBenefit)

### שלב 5: העלה לאתר
```bash
firebase deploy
```

---

## 📊 מבנה הגיליון

הסקריפט יוצר 4 גיליונות:

1. **Quiz Completions** - כל המידע המלא
2. **הלכות שבת** - מסונן
3. **איסור והיתר** - מסונן
4. **Summary Stats** - סטטיסטיקות

---

## ✅ בדיקה

1. פתח את ה-URL בדפדפן - אמור לראות JSON
2. השלם מבחן ובדוק Console (F12)
3. בדוק שהנתונים הגיעו לגיליון
