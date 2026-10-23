# Milestone 4 — PWA ומעטפת Offline

תוכנית בנייה ל־M4 לפי `MILESTONES.md`, `PRD.md` (FR-09, Edge Cases „ניתוק לאחר קבלת שאלה” ו„פתיחת PWA ללא חיבור”), `ARCHITECTURE.md` (§1, §4, §10) ו־`DESIGN.md` (§2.4–§2.5). מבוססת על הקוד הקיים אחרי M3.

## מטרה

Build מקומי (`vite preview`) עם Manifest ו־Service Worker פעילים: הדפדפן מזהה את האתר כניתן להתקנה, ולאחר טעינה ראשונה אפשר לפתוח את שלושת המסכים גם ללא רשת. יצירת שאלה ממשיכה לדרוש חיבור, ואין שום תוכן משחק ב־Cache. בנוסף — מעבר בדיקה של המסכים ברוחבי מובייל ובתוכן ארוך, ותיקון מה שנמצא.

## מה כבר קיים (מ־M1–M3) ולא משתנה מהותית

- הודעת החיבור „כדי לקבל שאלה, צריך להתחבר לאינטרנט.” מוצגת כשמבקשים שאלה ללא רשת (`navigator.onLine` וכשל `fetch`), ושאלה שכבר מוצגת ניתנת למענה בלי רשת.
- הגופנים נטענים מקומית מ־`@fontsource` (ADR-2), כך שאפשר לכלול אותם ב־Precache.
- התמונות ב־`public/images/`, כולל `app-icon.png` בגודל 1024×1024.
- שרת ה־preview של Vite כבר מפעיל את ה־API המקומי (`configurePreviewServer` ב־`vite.config.ts`), כך שב־Build המקומי אפשר לקבל שאלות אמיתיות.
- `index.html` עם `lang="he"`, `dir="rtl"`, `theme-color` ו־`viewport-fit=cover`; הניווט התחתון כבר מתחשב ב־`safe-area-inset-bottom`.
- טווחי הגיל מוצגים ב־`<bdi dir="ltr">`; `overflow-wrap: anywhere` קיים בתשובות ובשאלה.

## החלטות גישה

1. **ספרייה** — `vite-plugin-pwa` (גרסה 2, תומכת ב־Vite 8) במצב `generateSW` עם Workbox, כפי שנקבע ב־ARCHITECTURE §1. אין Service Worker כתוב ידנית.
2. **Manifest** (נוצר על ידי התוסף כ־`manifest.webmanifest`):
   - `name`: „BrainStorm ג'וניור”, `short_name`: „BrainStorm”, `description` בעברית (משפט הפתיחה ממסך האודות).
   - `lang: "he"`, `dir: "rtl"`, `start_url: "/"`, `scope: "/"`, `display: "standalone"`.
   - `theme_color: "#22C7F2"` (Sky Blue, כמו ה־meta הקיים), `background_color: "#F3FAFF"` (Cloud).
   - אייקונים: 192×192 ו־512×512 (`purpose: "any"`), ו־512×512 `maskable`.
3. **אייקונים** — נגזרים פעם אחת מ־`images/app-icon.png` באמצעות `@vite-pwa/assets-generator` (devDependency, תצורה ב־`pwa-assets.config.ts`) לתוך `public/icons/`: `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png` (עם שוליים ורקע Cloud כדי שהאייקון לא ייחתך בעיגול), `apple-touch-icon-180x180.png` ו־`favicon.ico`. הקבצים שנוצרו נשמרים ב־Git; סקריפט `npm run icons` מאפשר ליצור אותם מחדש אם המקור יוחלף. ה־favicon ב־`index.html` עובר לאייקון קטן במקום ה־PNG בגודל 900 KB.
4. **Precache — מעטפת בלבד**: `globPatterns: ['**/*.{js,css,html,png,ico,woff2,webmanifest}']` מתוך `dist/`. זה כולל את קוד שלושת המסכים, התמונות, האייקונים וקובצי הגופנים בפורמט woff2 (קובצי `.woff` הישנים לא נכללים — כל דפדפן תומך PWA משתמש ב־woff2). `maximumFileSizeToCacheInBytes` מוגדל ל־3 MB כדי לכלול את `background.png` (כ־1.5 MB) גם אם ישתנה מעט. אין `runtimeCaching` לשום דבר מלבד ה־API (סעיף 5).
5. **API — NetworkOnly ולא fallback**: `navigateFallback: '/index.html'` עם `navigateFallbackDenylist: [/^\/api\//]`, ובנוסף כלל `runtimeCaching` מפורש ל־`/api/` מסוג `NetworkOnly` (לכל המתודות), כך שבקשת API לעולם לא מקבלת HTML של המעטפת ולא נשמרת. בקשת שאלה ללא רשת נכשלת כרגיל, והקוד הקיים מציג את הודעת החיבור.
6. **עדכון ללא reload כפוי**: `registerType: 'prompt'` עם `injectRegister: 'auto'` ובלי `skipWaiting`/`clientsClaim`. גרסה חדשה של ה־Service Worker מותקנת ברקע ונשארת „ממתינה” עד שכל לשוניות האפליקציה נסגרות; הפתיחה הבאה מגיעה בגרסה החדשה. **אין הודעת „יש עדכון” ואין כפתור רענון** — אלה רכיבי ממשק שאינם במקורות; זו גם הדרך הפשוטה ביותר. המחיר: משתמש שמשאיר את האפליקציה פתוחה ימים יראה את הגרסה החדשה רק אחרי סגירה ופתיחה.
7. **פיתוח מול Build** — ה־Service Worker **כבוי ב־`npm run dev`** (ברירת המחדל של התוסף), כדי שלא יפריע לפיתוח. הוא נבדק רק ב־`npm run build` + `npm run preview` (http://localhost:4173). מוסיפים ל־`.claude/launch.json` תצורה בשם `preview` לשם כך.
8. **הודעת חיבור בפתיחה ללא רשת** — לא מוסיפים באנר קבוע. בפתיחה ללא רשת המעטפת עולה כרגיל, ובניסיון לבקש שאלה מוצגת הודעת החיבור הקיימת — כפי שמנוסח ב־DoD („מוצגת הודעת חיבור במקום יצירת שאלה”). אם תרצי שההודעה תופיע כבר בכניסה למסך הטריוויה ללא רשת — זה שינוי קטן, אבל הוא מוסיף התנהגות שלא מוגדרת במפורש, ולכן לא נכלל בלי אישורך.
9. **תוכן מותר ב־Cache Storage** — רק קבצים מ־`dist/` (Precache של Workbox). אין Cache של נושאים, שאלות, תשובות או בקשות, ואין Offline queue, Push או Background Sync. אין שינוי ב־`GameContext` — המשחק נשאר בזיכרון בלבד.

## קבצים ושינויים

| קובץ | שינוי |
| --- | --- |
| `package.json` / `package-lock.json` | devDependencies: `vite-plugin-pwa`, `@vite-pwa/assets-generator` (ו־`workbox-window` אם התוסף דורש אותו כ־peer). סקריפטים חדשים: `icons` (יצירת האייקונים), `check:pwa` (סעיף בדיקות). |
| `pwa-assets.config.ts` (חדש) | תצורת יצירת האייקונים מ־`public/images/app-icon.png` (העתק זהה של `images/app-icon.png`) לתוך `public/icons/`. |
| `public/icons/*` (חדש, נוצר) | האייקונים מסעיף 3. |
| `vite.config.ts` | הוספת `VitePWA({...})` לפי סעיפים 2, 4, 5, 6 — ליד `react()` ו־`localApi()` הקיימים. |
| `index.html` | `link rel="icon"` ל־favicon הקטן, `link rel="apple-touch-icon"`, `meta name="apple-mobile-web-app-capable"` ו־`apple-mobile-web-app-title` (ל־iPhone). קישור ה־Manifest וסקריפט הרישום נוספים אוטומטית על ידי התוסף ב־Build. |
| `tsconfig.node.json` | הכללת `pwa-assets.config.ts` אם נדרש ל־type-check. |
| `scripts/check-pwa.mjs` (חדש) | בדיקה אוטומטית של `dist/` אחרי Build (פירוט בבדיקות). |
| `scripts/check-bundle.mjs` | לוודא שגם `sw.js`, `workbox-*.js` ו־`manifest.webmanifest` נסרקים (הם כבר בסיומות הנסרקות; רק אימות). |
| `.claude/launch.json` | תצורה נוספת `preview` (`npm run preview`, פורט 4173). |
| קובצי CSS של המסכים/רכיבים | תיקונים נקודתיים בלבד, אם יימצאו בבדיקת המובייל (סעיף להלן). אין שינוי בעיצוב, בצבעים או במבנה. |
| `CLAUDE.md` | בסעיף „פקודות הרצה”: הוספת `npm run build && npm run preview` (http://localhost:4173) לבדיקת ה־PWA, ו־`npm run check:pwa`. |
| `spec/ARCHITECTURE.md` | ADR-5 בסוף הקובץ: אסטרטגיית העדכון בלי הודעה (`prompt` ללא UI), יצירת האייקונים, אילו קבצים ב־Precache (woff2 בלבד, מגבלת גודל), SW כבוי ב־dev. |
| `spec/MILESTONES.md` | 🟡 ליד כותרת M4 בסיום הבנייה. |

אין שינוי ב־Backend, ב־API, ב־`GameContext`, בנתיבים או במסכים עצמם (מלבד תיקוני CSS אם יידרשו).

## בדיקת מובייל ותוכן ארוך

בדיקה בדפדפן (Build מקומי), ברוחבים 320, 360, 375 ו־414 פיקסלים, ובגובה נמוך (למשל 640):

- **תוכן ארוך שנכפה בבדיקה** (בעזרת תגובת API מזויפת ב־Vitest, ובדפדפן באמצעות נושא באורך 120 תווים): נושא ארוך בשדה, שאלה של שלוש־ארבע שורות, תשובה ארוכה ומילה ארוכה בלי רווחים, הסבר ארוך והודעת שגיאה. מצופה: אין טקסט חתוך, אין גלילה אופקית, הכל נגלל מעל הניווט התחתון וכפתור „עוד שאלה באותו נושא” נגיש עד הסוף.
- **שורת הנושא**: השדה והכפתור „תנו לי שאלה” נשארים בשורה אחת ב־320 בלי שהכפתור נדחק החוצה (אם לא — הקטנת ריפוד הכפתור בלבד, בלי הקטנת טקסט).
- **שורת הגיל**: שתי האפשרויות נכנסות ב־320; „6–8” ו־„9–12” מוצגים ב־LTR, ה־Radio מימין, 6–8 מימין.
- **לוגו ו־BrainStorm** ב־LTR; „ג'וניור” מתחתיו.
- **ניווט**: סדר בית/טריוויה/אודות מימין לשמאל, גובה המגע לפחות 48 px, לא מסתיר תוכן גם במצב standalone (safe area בתחתית).
- **Focus**: מעבר במקלדת (Tab) על כל הרכיבים מציג טבעת Cyan בעובי 3 px; הטבעת לא נחתכת.
- **מגע**: כפתורים וכרטיסי תשובה בגובה 48 px לפחות; טקסט לא קטן מ־16 px.
- **גלילה**: במסך נמוך כל התוכן נגיש בגלילה; רקע `background-attachment: fixed` לא שובר את הגלילה (ב־iOS הוא מתעלם ממנו — זה תקין).

כל ממצא מתוקן ב־CSS ונבדק שוב. ממצא שדורש שינוי עיצוב (ולא תיקון נקודתי) — עוצרים ושואלים.

## בדיקות

### אוטומטיות

- **`npm run check:pwa`** (סקריפט חדש, רץ אחרי `npm run build`), בודק את `dist/`:
  - `manifest.webmanifest` קיים, עם `lang: he`, `dir: rtl`, `display: standalone`, `start_url` ו־`scope` = `/`, אייקון 192, אייקון 512 ואייקון `maskable`, וכל קובצי האייקונים קיימים ב־`dist/`.
  - `index.html` מקשר ל־Manifest ולסקריפט רישום ה־Service Worker.
  - `sw.js` קיים; רשימת ה־Precache שבו כוללת `index.html`, קובצי JS/CSS, את חמש התמונות, האייקונים ולפחות קובץ woff2 אחד של Rubik ו־Nunito Sans.
  - רשימת ה־Precache **אינה** כוללת שום נתיב תחת `/api/`, קובצי `.env` או `backend/`.
  - `sw.js` מכיל את ה־denylist ל־`/api/` ואת כלל ה־NetworkOnly, ואינו מכיל `skipWaiting`.
- **`npm run check:bundle`** — ממשיך לעבור, כולל `sw.js` ו־`manifest.webmanifest`.
- **Vitest** — כל הבדיקות הקיימות (M1–M3) ממשיכות לעבור. בדיקת תוכן ארוך חדשה ב־`TriviaPage.test.tsx`: שאלה, תשובות והסבר ארוכים מוצגים במלואם (בלי קיצור טקסט), וכפתור ההמשך קיים. (את הפריסה בפועל בודקים בדפדפן — jsdom אינו מחשב פריסה.)
- type-check, lint ו־build עוברים.

### ידניות (בבנייה, ב־Build מקומי עם תוכן סינתטי של מבוגר)

1. `npm run build` ואז `npm run preview` → פתיחת http://localhost:4173. ב־DevTools → Application: ה־Manifest נטען בלי שגיאות או אזהרות, האייקונים מוצגים, ה־Service Worker פעיל, ואפשרות ההתקנה זמינה (סמל ההתקנה בשורת הכתובת / „Install”).
2. טעינה ראשונה, ואז ב־DevTools → Network: Offline. רענון: הבית נפתח עם הלוגו, האיורים והגופנים; מעבר לאודות ולטריוויה עובד. בקשת שאלה → הודעת חיבור, ובקשת `/api` נכשלת ולא מחזירה HTML.
3. חזרה Online: בחירת גיל, קבלת שאלה; Offline שוב → מענה ומשוב עובדים; „עוד שאלה באותו נושא” → הודעת חיבור.
4. Application → Cache Storage: יש רק Cache של Workbox עם קובצי מעטפת; אין רשומות `/api`, נושאים, שאלות או תשובות. אין localStorage/sessionStorage/IndexedDB/Cookies של המשחק.
5. **עדכון**: בזמן ש־preview רץ ושאלה מוצגת במסך — שינוי טקסט זמני קטן (למשל במסך האודות), `npm run build` שוב, ובדפדפן ניווט בין מסכים: הדף לא נטען מחדש, השאלה נשארת, וב־Application מופיע Service Worker חדש במצב „waiting”. סגירת הלשונית ופתיחה מחדש → הגרסה החדשה. השינוי הזמני מוחזר לאחר הבדיקה.
6. בדיקת המובייל ותוכן ארוך לפי הסעיף לעיל.
7. type-check, lint, test, build, `check:bundle`, `check:pwa` — כולם עוברים. ההרצה נסגרת בסיום.

## מיפוי ל־Definition of Done

| סעיף DoD | איך נבדק |
| --- | --- |
| Manifest ו־Service Worker נטענים בלי שגיאות; האתר ניתן להתקנה | `check:pwa`, בדיקה ידנית 1 |
| אחרי טעינה ראשונה ובלי רשת — מעטפת ונכסים זמינים; הודעת חיבור במקום שאלה | בדיקות ידניות 2–3, בדיקות Offline הקיימות ב־Vitest |
| Cache Storage בלי מפתח/נושאים/שאלות/תשובות; API לא מקבל HTML של מעטפת | `check:pwa` (Precache ו־denylist), `check:bundle`, בדיקה ידנית 2 ו־4 |
| עדכון מ־Build קודם בלי reload כפוי בזמן שאלה | בדיקה ידנית 5, `check:pwa` (אין `skipWaiting`) |
| שלושת המסכים ברוחבי מובייל ובתוכן ארוך; כיווניות וניווט RTL | סעיף בדיקת המובייל, בדיקת התוכן הארוך ב־Vitest |
| בדיקות M2–M3 ו־Build עוברים; לא רק Vite dev | `npm test`, `npm run build`, כל הבדיקה הידנית מתבצעת על `vite preview` |

## מחוץ לטווח של M4

התקנה בטלפון אמיתי ובדיקה ב־HTTPS (M5); headers, CSP ו־rewrites של Vercel (M5); הודעת „יש גרסה חדשה”; Push, Background Sync או Offline queue; Cache של שאלות; פריסה.
