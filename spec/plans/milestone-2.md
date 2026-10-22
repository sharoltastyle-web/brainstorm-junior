# תוכנית — Milestone 2: שאלה ראשונה, תשובה אחת ומשוב

מבוסס על `MILESTONES.md` (M2), `ARCHITECTURE.md` (סעיפים 3–9, ADR-1, ADR-2), `PRD.md` (FR-02–FR-05, Edge Cases, טקסטי ממשק), `DESIGN.md` §1.2 ו־§2, התמונות ב־`spec/` והקוד הקיים מ־M1.

## מטרה

מסלול שלם במחשב: בחירת גיל ← הקלדת נושא ← "תנו לי שאלה" ← שאלה אמיתית שנוצרה ב־OpenAI עם ארבע תשובות ← בחירה אחת שננעלת ← משוב הצלחה/טעות והסבר קצר באותו מסך. כל מקרי הכשל מסתיימים בהודעה בעברית, בלי טעינה אינסופית ובלי תוכן חלקי.

**לא בשלב זה (M3 ואילך):** כפתור "עוד שאלה באותו נושא", רשימת Seen והשוואת כפילויות בדפדפן, שליחת השאלות הקודמות למודל, התעלמות מתגובה ישנה לפי requestId, ביטול שאלה בשינוי גיל, הודעת "אין חיבור", PWA, Vercel, commit.

## תנאים מוקדמים (לפני תחילת הבנייה)

1. **מפתח OpenAI** — `backend/.env` קיים. Claude לא קורא אותו; אם בדיקת הזמינות מראה שהמפתח חסר/לא תקין — עוצרים ומבקשים מהמשתמשת למלא אותו.
2. **זמינות המודל** — בתחילת הבנייה מריצים `npm run check:model` (ראו למטה). אם `gpt-5.4-mini-2026-03-17` אינו זמין בחשבון — עוצרים ושואלים את המשתמשת; לא מחליפים מודל על דעת עצמנו.
3. **ZDR** — כל עוד אין אישור ZDR בפועל, הבדיקות וההדגמה נעשות בנושאים סינתטיים בידי מבוגר בלבד (ראו "נתיב הילדים").
4. אין צורך בחשבונות או סודות נוספים.

## תלויות חדשות

| חבילה | סוג | למה |
| --- | --- | --- |
| `openai` | dependency (שרת בלבד) | SDK רשמי: Responses API, Structured Outputs, Moderation. |
| `zod` | dependency | אימות קלט ה־API ואימות פלט המודל. |

קוד ה־Frontend לא מייבא אף אחת מהן מצד השרת (`openai` לא נכנס ל־bundle; `check:bundle` מוודא).

## מבנה קבצים

```
backend/
  config.ts                # חדש: מודל, timeouts, גבולות, דגל ילדים — Configuration לא סודית
  questionSchema.ts        # חדש: Zod ל־request ול־פלט המודל + JSON Schema ל־Structured Outputs
  prompts.ts               # חדש: הוראות מערכת לפי גיל (6–8, 9–12) + בניית קלט המשתמש כנתונים
  openaiClient.ts          # חדש: AI Adapter — generate() ו־moderate() מעל ה־SDK, עם timeout; ממיר שגיאות ספק לקודים פנימיים
  triviaService.ts         # חדש: ה־Pipeline (נרמול → Moderation קלט → יצירה → Zod → Moderation פלט → ניסיון חלופי אחד → ערבוב)
  questionsHandler.ts      # שינוי: async, Origin, Zod לקלט, קריאה ל־triviaService, מיפוי שגיאות ל־HTTP, לוגים
  *.test.ts                # בדיקות חדשות/מעודכנות (ראו "בדיקות")
  fixtures/                # חדש: תוצרי מודל לדוגמה — תקין, חסר, תשובות כפולות, refusal וכו' (לבדיקות בלבד)
api/v1/questions.ts        # שינוי: await, מעביר Origin ו־Host
vite.config.ts             # שינוי: middleware מעביר Origin ו־Host ומחכה ל־handler האסינכרוני
scripts/check-model.mjs    # חדש: בודק שהמודל זמין למפתח, בלי להדפיס את המפתח
package.json               # שינוי: openai, zod, script "check:model"
src/
  api/questionsApi.ts      # חדש: fetch ל־/api/v1/questions עם timeout בצד הלקוח ופענוח תגובה/שגיאה
  state/GameContext.tsx    # שינוי: מצב המשחק — status, question, selectedOptionId, message
  pages/TriviaPage.tsx     # שינוי: שאלה, כרטיסי תשובה, משוב, מצבי טעינה ושגיאה
  pages/TriviaPage.module.css
  components/AnswerOptions.tsx (+ .module.css)   # חדש: ארבעה כרטיסי Radio, ננעלים לאחר בחירה
  components/FeedbackCard.tsx (+ .module.css)    # חדש: כרטיס משוב הצלחה/טעות עם סמל וטקסט
  App.test.tsx / TriviaPage.test.tsx             # עדכון ובדיקות חדשות
```

## Backend

### `config.ts`

- `MODEL = 'gpt-5.4-mini-2026-03-17'`, `MODERATION_MODEL = 'omni-moderation-latest'`.
- `MAX_TOPIC_LENGTH = 120`, `MAX_BODY_BYTES = 16 KB` (קיים), `MAX_OUTPUT_TOKENS` (התחלה: 1200; כולל reasoning — מכיילים בבנייה), reasoning effort נמוך כדי לקצר המתנה.
- `TOTAL_DEADLINE_MS = 30_000`, `MODEL_CALL_TIMEOUT_MS = 20_000` (ותמיד לא יותר מהזמן שנותר עד ה־deadline).
- `CHILD_USE_APPROVED = false` — ראו "נתיב הילדים".

### API — `POST /api/v1/questions`

**קלט (Zod, strict):** `ageGroup: '6-8' | '9-12'`, `topic: string` (אחרי trim ו־NFC, 1–120 תווים), `requestId: string` (עד 100 תווים). השדה `previousQuestions` מתוכנן ל־M3; ב־M2 הסכמה מקבלת אותו כאופציונלי (מערך עד 20 מחרוזות) ומתעלמת ממנו, כדי לא לשבור את M3.

**סדר הבדיקות ב־handler:** method POST ← Content-Type JSON ← Origin ← גודל ← JSON ← Zod ← מפתח קיים ← Pipeline.

**Origin:** אם יש כותרת `Origin` והמארח שלה שונה מכותרת `Host` של הבקשה — 403. (אותו Origin בפיתוח, ב־preview וב־Vercel, בלי רשימת כתובות קבועה.) זו לא הזדהות — רק הגנה בסיסית, כמתואר ב־Architecture.

**פלט הצלחה (200):**
```json
{ "requestId": "...", "questionId": "uuid", "prompt": "...",
  "options": [{"id":"a","text":"..."}, ... 4], "correctOptionId": "c", "explanation": "..." }
```

**שגיאות** — המבנה הקיים `error: {code, message, retryable, requestId}`, תמיד `Cache-Control: no-store`, בלי הודעות ספק גולמיות:

| מצב | HTTP | code | message (עברית) | retryable |
| --- | --- | --- | --- | --- |
| קלט שגוי / גיל לא תקין | 400 | `invalid_request` | „משהו השתבש בבקשה. נסו שוב.” | false |
| נושא ריק | 400 | `empty_topic` | „צריך להקליד נושא כדי לקבל שאלה.” | false |
| נושא/בקשה ארוכים מדי | 413 / 400 | `topic_too_long` | „הנושא ארוך מדי. נסו לקצר אותו.” | false |
| Origin זר | 403 | `forbidden_origin` | „הבקשה אינה נתמכת.” | false |
| נושא לא מובן | 422 | `unclear_topic` | „בואו נבחר נושא אחר וננסה שוב.” | false |
| נושא לא מתאים / נפסל ב־Moderation קלט | 422 | `unsuitable_topic` | „בואו נבחר נושא אחר וננסה שוב.” | false |
| refusal / פלט חסר או פסול / פלט נפסל ב־Moderation — אחרי הניסיון החלופי | 503 | `no_valid_question` | „לא הצלחנו להכין שאלה כרגע. נסו שוב או בחרו נושא אחר.” | true |
| timeout / deadline | 503 | `timeout` | „לקח יותר מדי זמן. נסו שוב בעוד רגע.” | true |
| הגבלת קצב מהספק | 429 | `rate_limited` | „יש עומס כרגע. נסו שוב בעוד רגע.” | true |
| מיצוי תקציב (`insufficient_quota`) | 503 | `budget_exhausted` | „אי אפשר לקבל שאלות כרגע. נסו שוב מאוחר יותר.” | false |
| מפתח חסר | 503 | `not_configured` | קיים | false |
| כל כשל ספק אחר | 503 | `provider_error` | „משהו השתבש. נסו שוב.” | true |

### Pipeline — `triviaService.ts`

1. **נרמול:** trim, `normalize('NFC')`, צמצום רווחים כפולים. ריק → `empty_topic`.
2. **Moderation לקלט** (הנושא בלבד). מסומן → `unsuitable_topic`.
3. **יצירה** — קריאה אחת ל־Responses API עם `store: false`, `max_output_tokens`, timeout, ו־Structured Outputs (JSON Schema strict):
   `{ status: 'ok' | 'unsuitable_topic' | 'unclear_topic', question, options: [4 strings], correctIndex: 0–3, explanation }`.
   - ההוראות (system/developer) לפי גיל, ב־`prompts.ts`. הנושא נשלח כהודעת user מתוחמת, עם הנחיה מפורשת שהוא נתון בלבד ולא הוראה.
   - 6–8: שאלה קצרה ופשוטה (משפט אחד), מילים מוכרות, תשובות של מילה–שתיים, הסבר של משפט–שניים בשפה של ילד.
   - 9–12: שאלה עובדתית בקושי מתאים, הסבר של עד שני משפטים עם עובדה מעניינת.
   - לשניהם: עברית תקנית בלי ניקוד, שאלה עובדתית וחד־משמעית, תשובה נכונה אחת בלבד, שלוש מסיחות סבירות ושונות, הסבר שתואם את התשובה הנכונה, תוכן מתאים לילדים. נושא לא מתאים לגיל או שמכיל פרטים אישיים (שם מלא, כתובת, טלפון וכו') → `unsuitable_topic`; ג'יבריש/לא מובן → `unclear_topic`.
   - `status` ≠ `ok` → מוחזר 422 מתאים מיד, בלי ניסיון חלופי.
4. **אימות Zod** של מועמד `ok`: שאלה לא ריקה, בדיוק 4 תשובות לא ריקות ושונות זו מזו (אחרי נרמול), `correctIndex` בטווח, הסבר לא ריק, גבולות אורך סבירים. refusal או פלט שלא נפרס → מועמד פסול.
5. **Moderation לפלט** — שאלה, ארבע התשובות וההסבר בקריאה אחת. מסומן → מועמד פסול.
6. **ניסיון חלופי:** מועמד פסול בשלבים 3–5 (refusal/פלט פסול/Moderation) מקבל ניסיון יצירה אחד נוסף בלבד, בתוך ה־deadline הכולל. כשל שני → `no_valid_question`. (השוואה לשאלות קודמות — M3.)
7. **ערבוב** סדר התשובות בשרת (Fisher–Yates), הקצאת מזהים `a`–`d`, `questionId = crypto.randomUUID()`, חישוב `correctOptionId`.

### AI Adapter — `openaiClient.ts`

- יוצר `OpenAI` client עם `process.env.OPENAI_API_KEY` רק בזמן קריאה (לא ב־import), `maxRetries: 0` (הניסיון החלופי מנוהל אצלנו).
- `generate(ageGroup, topic, signal)` ו־`moderate(texts, signal)`; כל קריאה עם `AbortSignal.timeout` לפי הזמן שנותר.
- ממפה שגיאות SDK לקודים פנימיים: timeout/abort, 429 rate limit, 429 `insufficient_quota`, refusal, אחר.
- מוגדר כממשק (`AiClient`), כך שהבדיקות מזריקות מימוש מזויף עם Fixtures — בלי רשת ובלי מפתח.
- **אם ה־helper של ה־SDK ל־Zod אינו תואם לגרסת zod המותקנת** — מעבירים JSON Schema ידני ל־`text.format` ומאמתים עם Zod בנפרד (תיעוד ב־ADR אם נדרש).

### לוגים

שורה אחת לכל בקשה: `[questions] code=<ok|error code> ms=<duration> attempts=<n> tokens=<usage>`. בלי נושא, שאלה, תשובות, הסבר, מפתח או הודעות ספק גולמיות.

### `scripts/check-model.mjs` (`npm run check:model`)

טוען את `backend/.env` דרך `loadServerEnv`, קורא `models.retrieve(MODEL)` ומדפיס רק „model available” או קוד שגיאה (למשל מפתח חסר/לא תקין/מודל לא זמין). לעולם לא מדפיס את המפתח.

### נתיב הילדים (ZDR)

`CHILD_USE_APPROVED = false` ב־`config.ts`, עם הערה שהדגל אינו ראיה לאישור ושאסור להפכו ל־`true` לפני אימות ZDR בפועל (M5). ב־M2 אין פריסה ציבורית — האפליקציה רצה רק מקומית במחשב — ולכן "חסום" פירושו: אין פריסה ואין שימוש של ילדים; הבדיקות וההדגמה נעשות בידי מבוגר עם נושאים סינתטיים. הדגל ייאכף בפועל (חסימת יצירה ב־Production) כשיהיה רלוונטי ב־M5.

## Frontend

### מצב המשחק (`GameContext`)

נוסף מעל המסכים, כך שמעבר לאודות וחזרה שומר את השאלה ואת המשוב; רענון מאפס:
- `status: 'idle' | 'loading' | 'awaiting_answer' | 'answered' | 'error'`
- `question: Question | null` (כולל `correctOptionId` ו־`explanation` — בזיכרון בלבד)
- `selectedOptionId: string | null`
- `message: string | null` (הודעת שגיאה/הנחיה)
- פעולות: `requestQuestion()`, `selectAnswer(optionId)`.

`selectAnswer` פועל רק כש־`status === 'awaiting_answer'`; הוא קובע את הבחירה ועובר ל־`answered` באותו עדכון — לחיצה נוספת לא משנה דבר. בדיקת הנכונות: השוואה ל־`correctOptionId`, בלי קריאת רשת.

### `questionsApi.ts`

- `fetch` עם `AbortController` ו־timeout של 35 שניות (מעט מעל ה־deadline בשרת), כדי שלא תהיה טעינה אינסופית גם אם השרת לא עונה.
- תגובה 200 נבדקת במבנה בסיסי (4 תשובות, `correctOptionId` קיים ביניהן); תגובה פגומה → הודעה כללית, לא מוצגת.
- שגיאה עם `error.message` → מוצגת ההודעה; כשל רשת/timeout/JSON לא תקין → „משהו השתבש. נסו שוב.” (הודעת "אין חיבור" ייעודית — M3).
- `requestId = crypto.randomUUID()` נשלח עם כל בקשה (ההתעלמות מתגובה ישנה — M3).

### מסך הטריוויה — לפי ה־Mockup ו־DESIGN §1.2

מלמעלה למטה, בתוך משטח התוכן הקיים:
1. שורת הנושא והכפתור (קיימת). הכפתור מושבת בזמן טעינה.
2. **טעינה:** „מכינים לך שאלה...” עם `role="status"`; השאלה הקודמת (אם הייתה) מוסתרת — כל שאלה חדשה מחליפה את הקודמת.
3. **שגיאה/הנחיה:** טקסט עם `role="alert"`; הכפתור „תנו לי שאלה” משמש לניסיון חוזר או לנושא אחר.
4. **השאלה:** טקסט מודגש, מיושר לימין (`h2`).
5. **ארבע תשובות** (`AnswerOptions`): `fieldset` עם `legend` מוסתר ויזואלית (טקסט השאלה), ארבעה כרטיסים מעוגלים ברוחב מלא, Radio וטקסט מימין, יעד מגע ≥ 48px, Focus ring Cyan. לאחר בחירה כל הכרטיסים `disabled`.
   - נבחר ושגוי: רקע ורוד בהיר, מסגרת ורודה, Radio מלא (כמו ב־Mockup).
   - נבחר ונכון: רקע ירוק בהיר, מסגרת ירוקה, Radio מלא (לפי משוב ההצלחה ב־Style Guide).
6. **משוב** (`FeedbackCard`, `role="status"`), מופיע רק אחרי הבחירה:
   - נכון: סמל ✓ + „כל הכבוד! תשובה נכונה!” (מודגש) + ההסבר (משקל רגיל). רקע ירוק בהיר.
   - שגוי: סמל ✗ + „הפעם לא הצלחת.” + „התשובה הנכונה היא: <טקסט>” (מודגשים) + ההסבר. רקע ורוד בהיר.
   - הסמל והטקסט — כדי שהמשוב לא יסתמך על צבע בלבד.
7. הפתרון וההסבר אינם ב־DOM לפני הבחירה (לא רק מוסתרים ב־CSS).
8. טקסט AI מוצג כטקסט React רגיל, בלי HTML גולמי.

גוני הירוק/ורוד הבהירים לא מוגדרים ב־HEX ב־Style Guide — מתאימים חזותית לדוגמאות הרכיבים בתמונה, בלי להוסיף אותם כ־Tokens "רשמיים".

## בדיקות

### אוטומטיות (Vitest) — בלי רשת ובלי מפתח אמיתי

**Backend (`triviaService.test.ts`, `questionsHandler.test.ts`, `questionSchema.test.ts`) עם AiClient מזויף ו־Fixtures:**
- תוצר תקין → 200, בדיוק 4 תשובות, `correctOptionId` מצביע על התשובה הנכונה גם אחרי ערבוב.
- תוצר חסר (בלי הסבר / 3 תשובות / `correctIndex` מחוץ לטווח), תשובות כפולות (גם בהבדלי רווחים), refusal, Moderation פלט מסומן → ניסיון חלופי אחד; שני כשלים → 503 `no_valid_question`, בלי תוכן בתגובה. ניסיון חלופי מוצלח → 200. מוודאים שמספר קריאות היצירה לא עולה על 2.
- `unclear_topic` / `unsuitable_topic` מהמודל → 422 בלי ניסיון חלופי. Moderation קלט מסומן → 422 בלי קריאת יצירה.
- timeout (Adapter שלא חוזר) → 503 `timeout` בתוך ה־deadline. 429, `insufficient_quota`, שגיאה כללית → הקודים בטבלה.
- קלט: נושא ריק/ארוך מדי, גיל לא תקין, שדות חסרים, Origin זר → קודים מתאימים; Origin תואם או חסר → מתקבל.
- המפתח המזויף לא מופיע בתגובה ולא בלוגים; הלוג לא מכיל את הנושא או את השאלה.
- `Cache-Control: no-store` בכל התגובות (קיים — מעודכן).

**Frontend (`TriviaPage.test.tsx`, עם `fetch` מזויף):**
- מצב טעינה מוצג והכפתור מושבת; לחיצה כפולה בזמן טעינה שולחת בקשה אחת.
- שאלה מוצגת עם 4 תשובות; הטקסט של ההסבר ו„התשובה הנכונה היא” אינם במסמך לפני בחירה.
- מענה נכון → הודעת הצלחה + הסבר. מענה שגוי → הודעת טעות + התשובה הנכונה במפורש + הסבר.
- אחרי הקליק הראשון לחיצה על תשובה אחרת לא משנה את הבחירה ולא את המשוב.
- שגיאת שרת (422/503) → הודעה, בלי שאלה, הטעינה נגמרת. fetch שלא חוזר → timeout בלקוח מסיים בהודעה (fake timers).
- מעבר לאודות וחזרה שומר את השאלה ואת המשוב.
- הבדיקות הקיימות מ־M1 ממשיכות לעבור (הבדיקה של "not_available_yet" מוחלפת בבדיקות החדשות).

### ידניות בבנייה (Claude, על `npm run dev`)

- `npm run check:model` — המודל זמין.
- שאלות חיות בשתי קבוצות הגיל, בכמה נושאים סינתטיים (למשל חלל, דינוזאורים, ים); מענה נכון ושגוי; נושא ג'יבריש ונושא לא מתאים.
- בכלי הפיתוח (Network): הבקשה והתגובה לא מכילות מפתח; אין קריאה ישירה ל־OpenAI מהדפדפן.
- `npm run build` + `npm run check:bundle` — המפתח ושם החבילה `openai` לא ב־bundle.
- איסוף 3 דוגמאות לכל גיל (שאלה, תשובות, הסבר) והצגתן למשתמשת בסיכום לסקירה של מבוגר.
- השוואה חזותית למסך הטריוויה ב־Mockup, ברוחב מובייל.

### פקודות שחייבות לעבור

`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run check:bundle`.

## Definition of Done — איך כל סעיף ייבדק

| סעיף | בדיקה |
| --- | --- |
| מסלול חי בשני הגילים, לא רק Fixtures | שאלות חיות מ־OpenAI ב־dev, 6–8 ו־9–12, כולל מענה. |
| תוצר חסר / תשובות לא שונות / תוכן שנפסל לא מוצגים; refusal ו־timeout מסתיימים בהודעה | בדיקות Backend עם Fixtures + בדיקת timeout בלקוח. |
| מענה נכון ושגוי עם הסבר; בטעות פתרון מפורש; נעילה אחרי קליק ראשון; פתרון/הסבר לא במסך לפני מענה | בדיקות Frontend + בדיקה ידנית. |
| המפתח לא מגיע לדפדפן | Network + `check:bundle`. |
| Vitest ו־Build עוברים; דוגמאות לשני הגילים נסקרו בידי מבוגר; ללא ZDR — סינתטי בלבד | הרצת הפקודות; דוגמאות בסיכום; סקירת המשתמשת בשלב "הרץ כדי שאבדוק". |

## ADR צפוי

ADR-3 ב־`ARCHITECTURE.md` לפרטי מימוש שה־Architecture לא קבע: Origin מול Host במקום רשימת Origins, ערכי `max_output_tokens`/reasoning, timeout הלקוח (35 שניות), מבנה ה־AiClient הניתן להזרקה, ואם יידרש — JSON Schema ידני במקום ה־helper של ה־SDK.

## סימון בסיום הבנייה

🟡 ליד הכותרת של M2 ב־`MILESTONES.md`; עדכון "פקודות הרצה" ב־`CLAUDE.md` אם נוספה פקודה (`check:model`). בלי commit.
