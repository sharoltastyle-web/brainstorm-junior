# תוכנית — Milestone 1: מעטפת מעוצבת ותחילת משחק

מבוסס על `MILESTONES.md` (M1), `ARCHITECTURE.md` (כולל ADR-1), `DESIGN.md`, `PRD.md` והתמונות ב־`spec/` וב־`images/`.

## מטרה

אפליקציה שרצה במחשב (`npm run dev`) עם שלושת המסכים — בית, טריוויה, אודות — מעוצבים לפי ה־Design, בחירת קבוצת גיל ושמירתה בזיכרון מעל המסכים, ניווט תחתוני RTL, ו־Backend מינימלי (endpoint אחד שמחזיר "לא זמין עדיין") שטוען את `OPENAI_API_KEY` מ־`backend/.env` בצד השרת בלבד.

**לא בשלב זה:** קריאה ל־OpenAI, הצגת שאלה ותשובות, משוב, מניעת חזרות, PWA/Service Worker, חיבור ל־Vercel, git commit.

## סביבה

- Node.js 24 (מותקן מקומית: v24.22.0), npm. lockfile: `package-lock.json`.
- פרויקט אחד בשורש (package.json יחיד), ללא monorepo.

## מבנה קבצים ליצירה

```
package.json               # scripts: dev, build, preview, typecheck, lint, test, check:bundle
tsconfig.json              # references ל־app ול־node
tsconfig.app.json          # strict, ל־src/
tsconfig.node.json         # strict, ל־vite.config.ts, backend/, api/, scripts/
vite.config.ts             # React plugin + middleware ל־/api/v1/questions (dev ו־preview)
eslint.config.js           # ESLint flat config + typescript-eslint + react-hooks
index.html                 # lang="he" dir="rtl", title "BrainStorm ג'וניור", viewport mobile
backend/
  .env.example             # OPENAI_API_KEY=   (ריק)
  .env                     # עותק חד־פעמי של ה־example; הערך ממולא בידי המשתמשת. לא נקרא בידי Claude.
  env.ts                   # loadServerEnv(): process.loadEnvFile('backend/.env') אם קיים (dev בלבד); hasOpenAiKey(): boolean
  questionsHandler.ts      # handler אחיד: (method, body) → {status, json}; כרגע 503 "not_available_yet"
  http.ts                  # טיפוסי Request/Response משותפים + מבנה שגיאה {error:{code,message,retryable,requestId}}
  questionsHandler.test.ts
  env.test.ts
api/
  v1/questions.ts          # Vercel Function adapter שמייבא את backend/questionsHandler (ייפרס רק ב־M5)
scripts/
  check-bundle.mjs         # סורק את dist/ ומוודא שאין OPENAI_API_KEY / "sk-" / ערך המפתח
public/
  images/                  # עותקים של התמונות בשמות נקיים (ראה "נכסים")
src/
  main.tsx                 # createRoot + BrowserRouter + GameProvider
  App.tsx                  # Layout: רקע, אזור תוכן נגלל, BottomNav; Routes
  styles/
    tokens.css             # CSS variables מה־Style Guide
    global.css             # reset, גופנים, body RTL, רקע Cloud + background.png
  state/
    GameContext.tsx        # ageGroup: '6-8' | '9-12' | null ; setAgeGroup ; topic ; setTopic
    GameContext.test.tsx
  components/
    BottomNav.tsx + .module.css   # בית / טריוויה / אודות, אייקוני SVG inline, פריט פעיל Cyan + קו תחתון
    Logo.tsx + .module.css        # <img> של logo.png עם alt "BrainStorm ג'וניור"
    PrimaryButton.tsx + .module.css
    AgeOption.tsx + .module.css   # radio מעוצב
  pages/
    HomePage.tsx + .module.css
    TriviaPage.tsx + .module.css
    AboutPage.tsx + .module.css
  pages/HomePage.test.tsx
  test/setup.ts            # jest-dom
```

## תלויות

- **Runtime:** `react`, `react-dom`, `react-router-dom`, `@fontsource/rubik`, `@fontsource/nunito-sans` (גופנים מקומיים — בלי Google Fonts, כדי שיהיו זמינים ב־PWA ב־M4).
- **Dev:** `vite`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`, `@types/node`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `@vercel/node` (טיפוסים ל־adapter בלבד).
- Zod ו־OpenAI SDK **לא** מותקנים בשלב זה — נכנסים ב־M2.
- גרסאות Stable עדכניות; אין Docker.

## נכסים (תמונות)

התמונות המקוריות ב־`images/` נשארות במקומן (לא מוחקים ולא משנים שם). מעתיקים ל־`public/images/` בשמות נקיים:

| מקור | יעד | שימוש |
| --- | --- | --- |
| `images/logo.png` | `public/images/logo.png` | לוגו בבית ובאודות |
| `images/hero (1).png` | `public/images/hero.png` | תמונת Hero בבית |
| `images/about.png` | `public/images/about.png` | איור דקורטיבי בתחתית אודות (`alt=""`, aria-hidden) |
| `images/background.png` | `public/images/background.png` | רקע שמיים/עננים לכל האפליקציה |
| `images/app-icon (1).png` | `public/images/app-icon.png` | favicon כבר עכשיו; אייקוני PWA ייגזרו ממנו ב־M4 |

הערה: התמונות כבדות (0.4–1.5MB). ב־M1 משתמשים בהן כמו שהן; כיווץ/המרה ל־WebP ייבחן ב־M4 יחד עם ה־Precache (לא חוסם).

## Design tokens (`tokens.css`)

מה־Style Guide בלבד, בלי להמציא ערכים:

- צבעים: `--navy #102A68`, `--sky #22C7F2`, `--yellow #FFD447`, `--pink #F56B99`, `--violet #7938CF`, `--green #91D542`, `--cloud #F3FAFF`, `--white #FFFFFF`.
- גוונים בהירים שלא הוגדרו ב־HEX (תכלת בהיר לבחירת גיל, אפור של Disabled) — מותאמים חזותית ל־Mockup; לא מוגדרים כ־Tokens "רשמיים".
- טיפוגרפיה: Display 32/800, Heading 24/700, Subheading 20/600, Body 18/400, Label 16/600; line-height 1.5; מינימום 16px. `font-family: 'Rubik', 'Nunito Sans', sans-serif`.
- Radius 16/20/24; outline 2px; אייקונים 24px; צל `0 4px 0 #102A68`; spacing 8/16/24/32.
- כפתורים 52–56px גובה, touch target ≥ 48px; input 56px; focus ring 3px Cyan.

## Layout כללי (`App.tsx`)

- `body` ברקע `--cloud` עם `background.png` מכוסה (cover).
- עמודת תוכן אחת, Mobile-first, `max-width` כ־480px ממורכזת (במחשב נראית כמו טלפון; בלי לצייר מסגרת טלפון).
- אזור התוכן נגלל; `BottomNav` קבוע בתחתית ה־viewport עם קו הפרדה עליון ו־padding תחתון כך שאינו מסתיר תוכן (כולל `env(safe-area-inset-bottom)`).

## ניתוב ומצב

- `react-router-dom` עם נתיבים `/`, `/trivia`, `/about`. נתיב לא מוכר → הפניה ל־`/`.
- `GameContext` עוטף את כל ה־Routes, כך שמעבר לאודות וחזרה שומר את המצב. המצב ב־`useState` בלבד — **אין** localStorage/sessionStorage/cookies, ולכן רענון מאפס.
- `/trivia` כש־`ageGroup === null` → `<Navigate to="/" replace />` (גם כשלוחצים "טריוויה" בניווט לפני בחירת גיל).
- בבית: בחירת גיל מעדכנת מצב מקומי של הטופס; לחיצה על "מתחילים לשחק" שומרת ל־Context ומנווטת ל־`/trivia`. אם לא נבחר גיל — הכפתור לא מנווט ומוצגת הודעה קצרה "צריך לבחור קבוצת גיל" (role="alert"), לפי ה־Edge Case ב־PRD. כשחוזרים לבית, הבחירה הקודמת מסומנת ואפשר לשנות.

## מסכים

### בית (`/`) — לפי Mockup
1. `Logo` ממורכז.
2. Hero (`hero.png`) ברוחב אזור התוכן, פינות מעוגלות, `alt` תיאורי בעברית.
3. כותרת "בוחרים קבוצת גיל" (Subheading/Heading, ממורכזת).
4. `radiogroup` עם שתי אפשרויות בשורה: 6–8 מימין, 9–12 משמאל. radio מימין לתווית; טווח הגיל בתוך `<bdi dir="ltr">`. נבחר: מסגרת Cyan + רקע תכלת בהיר + עיגול מלא. מבוסס על `<input type="radio">` אמיתי (נגיש במקלדת).
5. `PrimaryButton` "מתחילים לשחק" — צהוב, טקסט ומסגרת Navy, צל תחתון.
6. `BottomNav` עם "בית" פעיל.

### טריוויה (`/trivia`)
- כותרת "שאלות טריוויה" ומשטח תוכן לבן/בהיר.
- תווית "על איזה נושא נשחק?" + שדה טקסט (מימין) + כפתור "תנו לי שאלה" (משמאל, צהוב מעוגל).
- הנושא נשמר ב־Context (כך שמעבר לאודות וחזרה שומר את הטקסט). `maxLength=120`.
- לחיצה על "תנו לי שאלה" בשלב זה: נושא ריק/רווחים → "צריך להקליד נושא" (role="alert") בלי בקשה. נושא תקין → קריאה ל־`POST /api/v1/questions`, והצגת ההודעה הידידותית שחוזרת (503: "יצירת שאלות תהיה זמינה בקרוב."). זה מוכיח שה־Frontend מדבר עם ה־Backend; הצגת שאלה ותשובות — M2.
- תצוגת גיל נבחר אינה רכיב ב־Design, ולכן לא מוצגת; הגיל נשלח בבקשה (`ageGroup`) ונבדק בבדיקות.
- `BottomNav` עם "טריוויה" פעיל.

### אודות (`/about`)
- כותרת "אודות", `Logo`, פסקת פתיחה, כותרת משנה "איך משחקים?" וחמש ההוראות — נוסח מדויק מ־DESIGN.md §1.3, מיושר לימין.
- איור `about.png` בתחתית, דקורטיבי (`alt=""`), לא חופף לטקסט.
- אין פרטי יוצרת/קשר. `BottomNav` עם "אודות" פעיל.

### BottomNav
- `<nav aria-label="ניווט ראשי">` עם שלושה `NavLink`, מימין לשמאל: בית (אייקון בית), טריוויה (סימן שאלה), אודות (i). אייקונים כ־SVG inline 24px, בלי ספריית אייקונים.
- פעיל: Cyan לאייקון ולטקסט + קו תחתון Cyan, `aria-current="page"`. לא פעיל: Navy.

## Backend

### `backend/env.ts`
- `loadServerEnv()`: אם `NODE_ENV !== 'production'` והקובץ `backend/.env` קיים → `process.loadEnvFile(path)`. אם אינו קיים — לא נכשל.
- `hasOpenAiKey()`: מחזיר `true/false` לפי `process.env.OPENAI_API_KEY` לא ריק. **לעולם** לא מחזיר, מדפיס או מתעד את הערך.
- נקרא רק מ־`vite.config.ts` (צד Node) ומה־adapter ב־`api/`. אף קובץ תחת `src/` לא מייבא מ־`backend/`.

### `backend/questionsHandler.ts`
- חתימה ניטרלית לסביבה: `handleQuestions({ method, contentType, body }) → { status, headers, json }`.
- method שאינו POST → 405. Content-Type שאינו JSON → 415. JSON לא תקין → 400.
- מפתח חסר → 503 `{ error: { code: "not_configured", message: "שירות השאלות עדיין לא מוגדר.", retryable: false, requestId } }`, ובשרת נרשם רק `"OPENAI_API_KEY missing"` (בלי ערך).
- מפתח קיים → 503 `{ error: { code: "not_available_yet", message: "יצירת שאלות תהיה זמינה בקרוב.", retryable: false, requestId } }`.
- תמיד `Cache-Control: no-store`. `requestId` מוחזר מהבקשה אם נשלח.
- אימות Zod, Origin ו־Moderation — ב־M2.

### חיבור לשרת הפיתוח (`vite.config.ts`)
- Plugin קטן עם `configureServer` ו־`configurePreviewServer` שמוסיף middleware ל־`/api/v1/questions`: קורא את גוף הבקשה (עד 16KB), קורא ל־`handleQuestions`, ומחזיר JSON.
- `loadServerEnv()` נקרא בתוך ה־plugin (צד Node בלבד).
- לא נוגעים ב־`envDir` של Vite ולא מוגדר שום משתנה `VITE_` שמכיל סוד; אין `define` עם המפתח.

### `api/v1/questions.ts`
- adapter ל־Vercel Function שממיר `VercelRequest` ל־`handleQuestions` ומחזיר את התוצאה. נכתב ונבדק ב־type-check בלבד; ייפרס בפועל ב־M5.

### `.env`
- יצירת `backend/.env.example` עם `OPENAI_API_KEY=` ריק, והעתקתו **פעם אחת** ל־`backend/.env` (רק אם עוד לא קיים). Claude לא קורא את `backend/.env` אחרי ההעתקה.
- `.gitignore` הקיים כבר מכסה `.env` ו־`.env.*` ומתיר `.env.example` — לא משנים אותו (אולי מוסיפים שורות build אם יידרש).
- בסיום מבקשים מהמשתמשת להדביק את המפתח ב־`backend/.env` (רשות ב־M1 — האפליקציה עובדת גם בלעדיו).

## בדיקות (Vitest)

- `GameContext.test.tsx`: מצב התחלתי `null`; בחירת גיל נשמרת; מעבר בין נתיבים שומר; mount מחדש (סימולציית רענון) מאפס.
- `HomePage.test.tsx`: לחיצה על "מתחילים לשחק" בלי בחירה → הודעה ואין ניווט; בחירת 6–8 / 9–12 → ניווט ל־`/trivia` עם הגיל הנכון ב־Context; כניסה ישירה ל־`/trivia` בלי גיל → חזרה לבית.
- `questionsHandler.test.ts`: 405/415/400; מפתח חסר → `not_configured`; מפתח קיים (ערך דמה בבדיקה) → `not_available_yet`; התגובה ולוג ה־console לא מכילים את ערך המפתח; `Cache-Control: no-store`.
- `env.test.ts`: קובץ חסר לא מפיל; `hasOpenAiKey` מחזיר boolean בלבד.
- שיטת מדידה: אף קובץ ב־`src/` לא מייבא מ־`backend/` (בדיקה פשוטה שסורקת imports).

## סקריפטים ב־`package.json`

- `dev` — `vite`
- `build` — `tsc -b && vite build`
- `preview` — `vite preview`
- `typecheck` — `tsc -b --noEmit` (או מקבילה)
- `lint` — `eslint .`
- `test` — `vitest run`
- `check:bundle` — `node scripts/check-bundle.mjs` (רץ אחרי build): נכשל אם ב־`dist/` מופיעים `OPENAI_API_KEY`, `sk-`, או ערך המפתח הנוכחי (הסקריפט טוען את `backend/.env` בעצמו להשוואה, בלי להדפיס).
- בסיום ממלאים ב־`CLAUDE.md` את "פקודות הרצה": dev = `npm run dev`, test = `npm test`.

## אימות ידני ע"י Claude (לפני סימון 🟡)

1. `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run check:bundle` — כולם עוברים.
2. `git check-ignore -v backend/.env` מחזיר התאמה ל־`.gitignore`; `git ls-files backend/.env` ריק; `backend/.env.example` מכיל `OPENAI_API_KEY=` בלבד.
3. הרצת `npm run dev` ובדיקה בדפדפן המובנה ברוחב מובייל (375px) ובמחשב: שלושת המסכים מול ה־Mockup, RTL, גיל 6–8 ו־9–12 ב־LTR, ניווט, הודעת "צריך לבחור", מעבר לאודות וחזרה שומר, רענון מאפס, קריאה ל־API מחזירה את ההודעה הצפויה ו־Network לא חושף מפתח.
4. בדיקה בשרת שהמשתנה נטען בלי להדפיסו: endpoint מחזיר `not_available_yet` כשיש מפתח ו־`not_configured` כשאין (נבדק גם ביחידה עם ערך דמה).
5. סגירת השרת בסיום.

## ZDR (משימה לא־טכנית במקביל)

בסיכום הבנייה — הדרכה קצרה בשפה פשוטה: איך לפנות ל־OpenAI ולבקש Zero Data Retention לפרויקט. לא מציגים את ZDR כמאושר. עד לאישור — בדיקות עם תוכן סינתטי של מבוגרים בלבד.

## ADR

אם במהלך הבנייה תתקבל החלטה טכנית משמעותית שאינה כתובה ב־Architecture (למשל react-router-dom, גופנים מקומיים דרך @fontsource, העתקת התמונות ל־`public/images` בשמות נקיים) — תתועד כ־ADR-2 ב־`ARCHITECTURE.md`.

## מיפוי ל־Definition of Done

| תנאי DoD | איך מוכח |
| --- | --- |
| בחירת גיל → טריוויה עם הגיל הנכון; בלי בחירה לא מתחילים; אודות וחזרה שומר; רענון מאפס | בדיקות HomePage/GameContext + בדיקה ידנית |
| בית ואודות תואמים לעיצוב, תמונות, ניווט RTL, אין מסך/הרשמה נוספים | בדיקה ידנית מול mockups.png ו־wireframes.png |
| `backend/.env` מוחרג ולא tracked; example ריק | `git check-ignore`, `git ls-files`, קריאת ה־example |
| טעינת המשתנה בשרת בלי הדפסה; אין בבאנדל; אין VITE_ סודי; מפתח חסר מטופל | questionsHandler/env tests + `check:bundle` + חיפוש `VITE_` |
| type-check, lint, בדיקות ו־Build עוברים | הרצת הסקריפטים |
