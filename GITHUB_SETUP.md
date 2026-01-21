# הוראות העלאה ל-GitHub והפריסה ל-Netlify

## שלב 1: צור Repository חדש ב-GitHub

1. **גש ל:** https://github.com/lemaanyilmedo
2. **לחץ על:** "Repositories" (בתפריט העליון)
3. **לחץ על:** הכפתור הירוק "New" (או "New repository")
4. **מלא את הפרטים:**
   - Repository name: `kinyan-horaah`
   - Description: `מערכת מבחנים אינטראקטיבית להלכות שבת ואיסור והיתר`
   - Public (מומלץ) או Private
   - **אל תסמן** "Add a README file"
   - **אל תסמן** "Add .gitignore"
   - **אל תסמן** "Choose a license"
5. **לחץ:** "Create repository"

## שלב 2: העלה את הקוד

לאחר יצירת ה-Repository, GitHub יציג לך הוראות. **התעלם מהן** והרץ את הפקודות הבאות:

### פתח Command Prompt (לא PowerShell):
```cmd
cd c:\Users\admin\CascadeProjects\audio-transcription\kinyan-horaah

git remote add origin https://github.com/lemaanyilmedo/kinyan-horaah.git

git push -u origin main
```

**אם מבקש התחברות:**
- Username: `lemaanyilmedo`
- Password: השתמש ב-**Personal Access Token** (לא סיסמה רגילה)

### אם אין לך Personal Access Token:
1. גש ל: https://github.com/settings/tokens
2. לחץ "Generate new token" → "Generate new token (classic)"
3. שם: `kinyan-horaah-deploy`
4. סמן: `repo` (כל ה-checkboxes תחתיו)
5. לחץ "Generate token"
6. **העתק את ה-Token** (לא תוכל לראות אותו שוב!)
7. השתמש בו במקום סיסמה

## שלב 3: פרוס ל-Netlify

### אפשרות A: דרך GitHub (מומלץ)
1. **גש ל:** https://app.netlify.com/
2. **התחבר** עם חשבון GitHub שלך
3. **לחץ:** "Add new site" → "Import an existing project"
4. **בחר:** "Deploy with GitHub"
5. **אשר** את הגישה ל-GitHub
6. **בחר:** `lemaanyilmedo/kinyan-horaah`
7. **הגדרות Build:**
   - Build command: (השאר ריק)
   - Publish directory: `.` (נקודה)
8. **לחץ:** "Deploy site"

**תוך 1-2 דקות תקבל קישור כמו:**
`https://kinyan-horaah.netlify.app`

### אפשרות B: Drag & Drop (פשוט יותר)
1. **גש ל:** https://app.netlify.com/drop
2. **גרור** את התיקייה `kinyan-horaah` לחלון
3. **קבל קישור מיידי!**

## שלב 4: התאמה אישית (אופציונלי)

### שנה את שם האתר:
1. ב-Netlify, לחץ "Site settings"
2. "Change site name"
3. הזן: `kinyan-horaah`
4. שמור

### הוסף דומיין משלך:
1. "Domain management"
2. "Add custom domain"
3. הזן את הדומיין שלך
4. עקוב אחרי ההוראות

## בעיות נפוצות

### "Permission denied" בעת Push
**פתרון:** השתמש ב-Personal Access Token במקום סיסמה

### "Repository not found"
**פתרון:** ודא שה-Repository נוצר ב-GitHub ושהשם נכון

### "Failed to push"
**פתרון:** 
```cmd
git pull origin main --allow-unrelated-histories
git push -u origin main
```

## עדכון האתר בעתיד

כשתרצה לעדכן את האתר:

```cmd
cd c:\Users\admin\CascadeProjects\audio-transcription\kinyan-horaah
git add .
git commit -m "Update: description of changes"
git push
```

**Netlify יעדכן אוטומטית!** (אם חיברת דרך GitHub)

---

## מוכן? בואו נתחיל!

1. ✅ Git repository נוצר
2. ⏳ צור repository ב-GitHub
3. ⏳ העלה את הקוד
4. ⏳ פרוס ל-Netlify

**אני מוכן לעזור בכל שלב!**
