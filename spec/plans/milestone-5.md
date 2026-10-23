# Milestone 5 — חיבור ל־Vercel ופריסת Production

תוכנית בנייה ל־M5 לפי `MILESTONES.md`, `ARCHITECTURE.md` (§5, §7, §8, §9, §10, ADR-1, ADR-3, ADR-5) ו־`PRD.md` (דרישות האבטחה והפריסה). מבוססת על הקוד הקיים אחרי M4.

## מטרה

כתובת Production חיה ב־Vercel, שמתעדכנת אוטומטית מ־`main` ב־GitHub, עם המפתח בצד השרת בלבד, תקרת הוצאה חוסמת ב־OpenAI ואימות ZDR לפני שימוש של ילדים. בסיום — Smoke tests בכתובת החיה, בדיקת התקנה בטלפון ובדיקת Rollback.

## מה כבר קיים ולא משתנה

- `api/v1/questions.ts` — adapter ל־Vercel Function (Web standard `Request`/`Response`, ADR-2), המפעיל את `backend/questionsHandler.ts`.
- `loadServerEnv` מדלג על `backend/.env` כשמשתנה `VERCEL` מוגדר (ADR-5); ב־Vercel המפתח נקרא מ־`process.env.OPENAI_API_KEY`.
- תגובות ה־API כבר עם `Cache-Control: no-store`, בדיקת Origin מול Host (ADR-3), ומיצוי תקציב (`insufficient_quota`) כבר מתורגם להודעה „אי אפשר לקבל שאלות כרגע. נסו שוב מאוחר יותר.”
- ה־PWA (Manifest, Service Worker, Precache, API כ־NetworkOnly) מ־M4. ב־`dist/index.html` אין סקריפטים inline, כך שאפשר CSP מחמיר.
- ה־repo כבר מחובר ל־`origin` ב־GitHub (`sharoltastyle-web/brainstorm-junior`) ו־M1–M4 כבר נדחפו.

## הקשר הפריסה — פרויקט לימודי

הפרויקט הוא עבודת בית של תלמידה ואינו מפורסם או משותף עם ילדים. לכן:

1. **ZDR** — אין הסדר ZDR ולא מבקשים אותו. הכתובת החיה היא **גרסת בדיקה** עם תוכן סינתטי שמבוגר מקליד; הקישור לא משותף עם ילדים. `CHILD_USE_APPROVED` נשאר `false` (תזכורת בקוד בלבד, אינו חוסם דבר). לא מוסיפים מסך או הודעה חדשים בגלל זה.
   - סעיף ה־DoD „תנאי ZDR אומתו” — **הוחלט (23.10.2026): לא רלוונטי לפרויקט לימודי שאינו מפורסם** (שינוי היקף באישור המשתמשת, לפי כלל 5 ב־MILESTONES). בבנייה ההחלטה תתועד ב־ADR-6 ובהערה ליד הסעיף. ה־Milestone אינו מוצר מוכן לשימוש ילדים.
2. **תכנית Vercel** — Hobby (חינם, לשימוש אישי לא מסחרי) — מתאימה לפרויקט לימודי.
3. **מפתח ה־AI ותקרת ההוצאה — באחריות המורה** — המפתח התקבל מהמורה; לתלמידה אין חשבון OpenAI ואין לה גישה להגדרות החיוב, ולכן היא אינה מקימה פרויקט או תקרה בעצמה.
   - **התקבל אישור מהמורה** (23.10.2026, לפי דיווח התלמידה) להשתמש במפתח באתר החי ללא הגבלה. ניהול העלות ותקרת ההוצאה בחשבון OpenAI באחריות המורה.
   - סעיף ה־DoD „תקרת ההוצאה הוגדרה ונבדק שהיא חוסמת” לא ייבדק על ידינו (אין גישה לחשבון). הוא יסומן כ„הועבר לאחריות בעלת החשבון (המורה), שאישרה שימוש” ויתועד ב־ADR-6. ההודעה הידידותית למיצוי תקציב נבדקת ב־Vitest.
   - מגבלה שנמסרת: הכתובת ציבורית ואין הגבלת קצב, כך שכל מי שיודע אותה יכול לבקש שאלות על חשבון המורה. לכן לא מפיצים את הקישור מעבר למורה ולבדיקה.
   - בסיום הבדיקות אפשר למחוק את המפתח מ־Vercel (או שהמורה תבטל אותו) כדי למנוע הוצאה נוספת — לבחירתך.

## החלטות גישה

1. **`vercel.json` חדש בשורש** — הקובץ היחיד שמוסיפים לתצורת הפריסה:
   - `framework: "vite"`, `buildCommand: "npm run build"`, `outputDirectory: "dist"`.
   - **rewrites** למעטפת: כל נתיב שאינו `/api/...` ואינו קובץ קיים מוגש כ־`/index.html`, כדי שרענון ב־`/trivia` או `/about` לא יחזיר 404. כלל ה־rewrite מוחרג במפורש מ־`/api/`, כך שבקשת API לעולם לא מקבלת HTML (ARCHITECTURE §9).
   - **functions**: `api/v1/questions.ts` עם `maxDuration: 60` (ARCHITECTURE §9; ה־deadline בקוד נשאר 30 שניות).
   - **headers** לכל האתר:
     - `Content-Security-Policy`: `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'` (ARCHITECTURE §7). אם בבדיקה יתגלה שרכיב צריך `'unsafe-inline'` ל־style — מוסיפים רק ל־`style-src` ומתעדים.
     - `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` שחוסם מצלמה, מיקרופון ומיקום.
     - HTTPS ו־HSTS מסופקים אוטומטית על ידי Vercel; רק מאמתים.
   - **Cache headers ל־PWA**: `sw.js`, `registerSW.js`, `index.html` ו־`manifest.webmanifest` עם `Cache-Control: public, max-age=0, must-revalidate`, כדי שגרסה חדשה תגיע. קובצי `/assets/*` (עם hash בשם) — `max-age=31536000, immutable`.
2. **גרסת Node** — `engines.node` ב־`package.json` משתנה מ־`>=24` ל־`24.x`, כדי ש־Vercel יבחר Node.js 24 LTS במדויק (ARCHITECTURE §1, §9) ולא יתריע על טווח פתוח.
3. **יבוא עם סיומת `.ts` ב־Function** — הקוד ב־`api/` וב־`backend/` מייבא קבצים עם סיומת `.ts`. לפני ה־Push מוודאים שה־Function נבנית ורצה בסביבה הדומה ל־Vercel (הרצה של ה־adapter ישירות ב־Node 24 על בקשה מזויפת, ללא Vite). אם הפריסה הראשונה תיכשל בגלל זה — מתקנים את היבוא ב־`api/v1/questions.ts` בלבד ומתעדים ב־ADR. ה־Function נכללת אוטומטית מתיקיית `api/`; אין להכניס את `backend/.env` לחבילה (הוא מוחרג ב־Git ולכן לא מגיע ל־Vercel בכלל).
4. **משתנה סביבה יחיד** — `OPENAI_API_KEY` מוגדר ב־Vercel **ל־Production בלבד**, מסומן Sensitive. לא מגדירים אותו ל־Preview, כך שפריסות Preview לא יוציאו כסף (בהן תוצג הודעת שירות לא זמין — זה צפוי). את המפתח מזינה המשתמשת בעצמה בממשק Vercel; הוא לא נשלח בצ'אט ולא נכתב לשום קובץ.
5. **המפתח ל־Production** — המפתח שהמורה נתנה, באישורה (סעיף 3 של „הקשר הפריסה”).
6. **סדר הפריסה** — הבנייה המקומית (קבצים + בדיקות) נעשית קודם, בלי commit. אחר כך: הצגת הגרסה ותוצאות הבדיקות → **אישור מפורש שלך לפריסה** → commit + push ל־`main` → חיבור ה־repo ל־Vercel (או, אם תחברי קודם, ה־push עצמו יוצר את הפריסה). אישור של M4 אינו אישור לפריסה.
7. **Rollback** — בודקים שבלוח Vercel אפשר לבחור פריסה קודמת ו־„Promote to Production” / „Instant Rollback”, ושהכתובת חוזרת לגרסה הקודמת; אחר כך מחזירים לגרסה העדכנית. לצורך הבדיקה צריך לפחות שתי פריסות (למשל הפריסה הראשונה ופריסה אחרי Redeploy בעקבות הוספת המפתח).

## קבצים ושינויים

| קובץ | שינוי |
| --- | --- |
| `vercel.json` (חדש) | Build, rewrites, functions, headers — לפי סעיף 1. |
| `package.json` | `engines.node`: `24.x`. סקריפט חדש `check:live` (בהמשך). |
| `scripts/check-live.mjs` (חדש) | בדיקת עשן אוטומטית מול כתובת חיה שמועברת כפרמטר (פירוט בבדיקות). לא קורא את `.env` ולא צריך מפתח. |
| `scripts/check-bundle.mjs` | ללא שינוי לוגי; מורץ שוב על ה־Build הסופי. |
| `backend/config.ts` | ללא שינוי (`CHILD_USE_APPROVED` נשאר `false`). |
| `CLAUDE.md` | בסעיף „פקודות הרצה”: כתובת ה־Production, `npm run check:live -- <url>`, והערה ש־Push ל־`main` מפרסם ל־Production. |
| `spec/ARCHITECTURE.md` | ADR-6: פרטי הפריסה — `vercel.json` (CSP, cache headers, rewrites), מפתח ל־Production בלבד ולא ל־Preview, `24.x`, פריסה כגרסת בדיקה של פרויקט לימודי ללא ZDR, ומפתח המורה באישורה (התקרה באחריותה). |
| `spec/MILESTONES.md` | 🟡 ליד כותרת M5 בסיום הבנייה; הערה ליד סעיף ה־ZDR: „לא רלוונטי — פרויקט לימודי שאינו מפורסם”. |

אין שינוי בקוד ה־Frontend, במסכים, ב־Backend (מלבד הדגל) או בעיצוב.

## צעדים — מה אני עושה ומה את עושה

**אצלי (מקומית, לפני כל פריסה):**
1. כתיבת `vercel.json`, עדכון `package.json`, כתיבת `check-live.mjs`.
2. `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run check:bundle`, `npm run check:pwa` — כולם חייבים לעבור.
3. הרצת ה־adapter של ה־Function ב־Node 24 ישירות (סעיף 3 בהחלטות), כדי לוודא שיבוא ה־`.ts` עובד מחוץ ל־Vite.
4. `git check-ignore backend/.env` ו־`git ls-files` — מוכיחים שה־.env לא ייכנס ל־commit.
5. הצגת הגרסה ותוצאות הבדיקות — ועצירה לאישור שלך לפריסה.

**אצלך, צעד אחר צעד בהדרכה שלי (אני לא נוגע בחשבונות):**
6. Vercel: הרשמה/כניסה עם GitHub, Import של ה־repo, אישור ההגדרות שזוהו מ־`vercel.json`, הוספת `OPENAI_API_KEY` ל־Production בלבד (Sensitive).

**ביחד:**
7. אחרי אישורך: commit + push ל־`main`. מעקב אחר ה־Build בלוח Vercel; אם המפתח נוסף אחרי הפריסה הראשונה — Redeploy.
8. Smoke tests בכתובת החיה (להלן), בדיקת טלפון, בדיקת Rollback.
9. מסירה: הכתובת, מזהה הגרסה (commit), סיכום הבדיקות והמגבלות הידועות. עצירה.

## בדיקות

**אוטומטיות — `npm run check:live -- https://<הכתובת>`** (ללא יצירת שאלה, כדי לא לחייב):
- `/`, `/trivia`, `/about` מחזירים 200 ו־HTML של המעטפת (rewrites עובדים, כולל רענון בנתיב פנימי).
- `/manifest.webmanifest`, `/sw.js` נטענים, ה־Manifest בעברית ו־RTL.
- כותרות: CSP עם `frame-ancestors 'none'`, `nosniff`, HSTS; `sw.js` עם `max-age=0`.
- `GET /api/v1/questions` מחזיר JSON (ולא HTML) עם `Cache-Control: no-store`.
- `POST` עם Content-Type שגוי או Origin זר נדחה ב־JSON מתאים.
- סריקת ה־JS וה־HTML שהוגשו: אין `OPENAI_API_KEY`, אין מחרוזת בסגנון `sk-...`, אין `VITE_`; `/backend/.env` ו־`/.env` מחזירים 404.

**ידניות בכתובת החיה (תוכן סינתטי, בידי מבוגר):**
- בחירת כל גיל → שאלה חיה → תשובה נכונה ותשובה שגויה (משוב, הסבר, פתרון מפורש בטעות) → עוד שאלה → שינוי נושא וחזרה לראשון → אודות וחזרה בלי איבוד מצב.
- DevTools: ב־Network אין מפתח בבקשות/תגובות; ב־Cache Storage רק קבצי מעטפת.
- Offline: אחרי טעינה ראשונה, ניתוק → המעטפת נפתחת ובקשת שאלה מציגה הודעת חיבור.
- **טלפון אמיתי**: פתיחה בכתובת HTTPS, „הוספה למסך הבית” (Android Chrome ו/או iPhone Safari), פתיחה מהאייקון במצב מסך מלא, שם ואייקון נכונים, משחק קצר, ופתיחה במצב טיסה.
- **תקרת הוצאה**: באחריות המורה (סעיף 3 של „הקשר הפריסה”). בדיקת ההודעה הידידותית למיצוי תקציב כבר מכוסה ב־Vitest; בדיקה חיה של מיצוי התקציב לא מתבצעת.
- **Rollback**: חזרה לפריסה קודמת ובחזרה לעדכנית.

## Definition of Done — איך כל סעיף ייבדק

| סעיף | הוכחה |
| --- | --- |
| אישור מפורש לפריסה | הצגת תוצאות הבדיקות המקומיות ועצירה עד „כן” ממך. |
| ZDR אומת בפועל | מסומן „לא רלוונטי — פרויקט לימודי שאינו מפורסם” (החלטת המשתמשת, ADR-6). אין בדיקות עם נתוני ילדים. |
| רק `OPENAI_API_KEY`, בשרת בלבד | רשימת המשתנים ב־Vercel; `check:bundle`, `check:live`, Network ו־Cache Storage. |
| Push יצר Build ופריסה מוצלחים | סטטוס Ready בלוח Vercel; ה־commit בפריסה תואם ל־commit שאושר. |
| Smoke tests | `check:live` + הרשימה הידנית לעיל, כולל טלפון. |
| תקרת הוצאה חוסמת | הועבר לאחריות המורה, שאישרה שימוש (מתועד ב־ADR-6) + בדיקת Vitest להודעה. |
| Rollback | ביצוע וחזרה. |
| מסירה ועצירה | הודעת סיכום עם כתובת, גרסה, בדיקות ומגבלות; אין התחלת הרחבות. |

## מגבלות ידועות שיימסרו

- אין הגבלת קצב (ADR-1): שימוש לרעה עלול למצות את התקציב ולעצור את יצירת השאלות עד החידוש. העלות נרשמת על חשבון המורה.
- בדיקת Origin אינה הזדהות; קריאה ישירה ל־API אפשרית.
- התשובה הנכונה מגיעה לדפדפן עם השאלה (ADR-1).
- כל Push ל־`main` מפרסם מיד ל־Production; אין CI שחוסם קוד שבור — לכן ממשיכים להריץ את הבדיקות המקומיות לפני כל Push.
- Vercel Hobby מיועד לשימוש אישי לא מסחרי בלבד.
- אין הסדר ZDR — האתר הוא גרסת בדיקה של פרויקט לימודי ואינו מוכן לשימוש ילדים.
