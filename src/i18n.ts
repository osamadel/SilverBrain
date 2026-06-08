// i18n: translation dictionary + DOM-swap helpers.
// No third-party library — uses data-i18n / data-i18n-placeholder attributes.

export type Lang = 'en' | 'ar';

type Entry = { en: string; ar: string };
type TranslationMap = Record<string, Entry>;

export const translations: TranslationMap = {
  // ── Brand ──────────────────────────────────────────────────────────────────
  'brand-name':              { en: 'SilverBrain',               ar: 'فضي دماغك' },

  // ── Navigation ─────────────────────────────────────────────────────────────
  'tab-braindump':           { en: 'Brain Dump',                ar: 'فضي دماغك' },
  'tab-sort':                { en: 'Sort',                      ar: 'رتب' },
  'tab-todo':                { en: 'Tasks',                     ar: 'المهام' },
  'tab-focus':               { en: 'Focus',                     ar: 'تركيز' },
  'settings-btn-label':      { en: 'Settings',                  ar: 'الإعدادات' },
  'settings-btn-title':      { en: 'Settings',                  ar: 'الإعدادات' },
  'history-btn-title':       { en: 'Brain dump history',        ar: 'سجل التفريغات' },

  // ── Onboarding ─────────────────────────────────────────────────────────────
  'ob-title-0':      { en: 'Brain Dump',                        ar: 'فضي دماغك' },
  'ob-desc-0':       { en: "Start by typing everything on your mind — messy thoughts, tasks, half-formed ideas. Don't filter. Just write.", ar: 'اكتب كل اللي في دماغك — أفكار مبعثرة، مهام، أي حاجة. متفلترش، بس اكتب.' },
  'ob-title-1':      { en: 'Sort & Prioritize',                 ar: 'رتب وحدد الأولويات' },
  'ob-desc-1':       { en: 'The AI extracts your tasks. Drag them into the Eisenhower Matrix to sort by urgency and importance.', ar: 'الذكاء الاصطناعي بيستخرج مهامك. اسحبهم في مصفوفة أيزنهاور ترتبهم حسب الأولوية.' },
  'ob-title-2':      { en: 'Focus & Execute',                   ar: 'ركز ونفذ' },
  'ob-desc-2':       { en: 'Use the Pomodoro timer to work in focused sprints. Send tasks from the matrix straight to your focus queue.', ar: 'استخدم مؤقت البومودورو عشان تشتغل في جلسات تركيز. ابعت المهام من المصفوفة لقائمة التركيز مباشرة.' },
  'ob-skip':         { en: 'Skip',                              ar: 'تخطي' },
  'ob-next':         { en: 'Next',                              ar: 'التالي' },
  'ob-get-started':  { en: 'Get Started',                       ar: 'ابدأ' },

  // ── Settings Modal ─────────────────────────────────────────────────────────
  'settings-title':      { en: 'System Settings',               ar: 'الإعدادات' },
  'settings-desc':       { en: 'Connect an LLM provider to extract tasks from your brain dump. Your key is stored locally and never leaves this machine.', ar: 'وصّل مزود ذكاء اصطناعي عشان تستخرج المهام. مفتاحك مخزن محليًا ومش بيتبعت لأي حد.' },
  'section-llm':         { en: 'Language Model',                ar: 'نموذج الذكاء الاصطناعي' },
  'label-provider':      { en: 'Provider',                      ar: 'المزود' },
  'label-model':         { en: 'Model ID',                      ar: 'معرف النموذج' },
  'label-api-key':       { en: 'API Key',                       ar: 'مفتاح API' },
  'label-base-url':      { en: 'Base URL',                      ar: 'رابط الخادم' },
  'security-note':       { en: 'Stored locally · never transmitted to our servers', ar: 'مخزن محليًا · مش بيتبعت لأي سيرفر' },
  'section-pomodoro':    { en: 'Pomodoro Durations',            ar: 'مدد البومودورو' },
  'label-focus-min':     { en: 'Focus (min)',                   ar: 'تركيز (دقيقة)' },
  'label-short-break':   { en: 'Short break',                   ar: 'راحة قصيرة' },
  'label-long-break':    { en: 'Long break',                    ar: 'راحة طويلة' },
  'label-long-every':    { en: 'Long every',                    ar: 'طويلة كل' },
  'section-language':    { en: 'Language',                      ar: 'اللغة' },
  'label-language':      { en: 'App Language',                  ar: 'لغة التطبيق' },
  'coming-soon':         { en: 'Coming Soon',                   ar: 'قريبًا' },
  'btn-discard':         { en: 'Discard',                       ar: 'إلغاء' },
  'btn-save':            { en: 'Save Changes',                  ar: 'حفظ التغييرات' },
  'btn-close':           { en: 'Close',                         ar: 'إغلاق' },
  'btn-cancel':          { en: 'Cancel',                        ar: 'إلغاء' },
  'btn-delete':          { en: 'Delete',                        ar: 'حذف' },
  'delete-task-title':   { en: 'Delete task?',                  ar: 'حذف المهمة؟' },
  'delete-task-msg':     { en: 'Are you sure you want to delete “{text}”? This cannot be undone.', ar: 'متأكد إنك عايز تحذف “{text}”؟ مش هتقدر ترجّعها.' },
  'delete-done-title':   { en: 'Clear completed tasks?',        ar: 'مسح المهام المكتملة؟' },
  'delete-done-msg':     { en: 'Delete {count} completed tasks? This cannot be undone.', ar: 'حذف {count} مهمة مكتملة؟ مش هتقدر ترجّعها.' },
  'section-appearance':  { en: 'Appearance',                    ar: 'المظهر' },
  'label-theme':         { en: 'Theme',                         ar: 'السمة' },
  'theme-dark':          { en: 'Dark',                          ar: 'داكن' },
  'theme-light':         { en: 'Light',                         ar: 'فاتح' },
  'section-prompt':      { en: 'Task Extraction',               ar: 'استخراج المهام' },
  'label-prompt':        { en: 'Extraction prompt',             ar: 'موجّه الاستخراج' },
  'prompt-hint':         { en: 'Use {dump} for the brain dump and {memory} for learned Eisenhower preferences (optional).', ar: 'استخدم {dump} للتفريغ و{memory} لتفضيلات أيزنهاور المتعلّمة (اختياري).' },
  'btn-reset-prompt':    { en: 'Reset to default',              ar: 'استعادة الافتراضي' },
  'tab-about':           { en: 'About',                         ar: 'حول' },
  'tab-llm':             { en: 'Model',                         ar: 'النموذج' },
  'tab-prompt':          { en: 'Extraction',                    ar: 'الاستخراج' },
  'tab-pomodoro':        { en: 'Pomodoro',                      ar: 'بومودورو' },
  'about-desc':          { en: 'Dump your thoughts, extract tasks with AI, sort them on an Eisenhower matrix, and focus with Pomodoro.', ar: 'فضّي دماغك، استخرج المهام بالذكاء الاصطناعي، رتّبها في مصفوفة أيزنهاور، وركّز بالبومودورو.' },
  'about-version':       { en: 'Version',                       ar: 'الإصدار' },
  'about-platform':      { en: 'Platform',                      ar: 'المنصة' },
  'about-tauri':         { en: 'Tauri',                         ar: 'توري' },
  'section-tasks':       { en: 'Tasks',                         ar: 'المهام' },
  'label-completed-order': { en: 'Completed tasks',             ar: 'المهام المكتملة' },
  'opt-completed-bottom': { en: 'Move to bottom of quadrant',   ar: 'انقلها لآخر الربع' },
  'opt-completed-keep':  { en: 'Keep in place',                 ar: 'سيبها مكانها' },
  'completed-order-hint': { en: 'Where finished tasks sit within each Eisenhower quadrant on the Tasks page.', ar: 'مكان المهام المنتهية جوه كل ربع أيزنهاور في صفحة المهام.' },

  // ── Help / keyboard shortcuts ────────────────────────────────────────────────
  'help-title':          { en: 'Keyboard Shortcuts',            ar: 'اختصارات الكيبورد' },
  'help-desc':           { en: 'Work faster without leaving the keyboard.', ar: 'اشتغل أسرع من غير ما تسيب الكيبورد.' },
  'help-btn-label':      { en: 'Keyboard shortcuts',            ar: 'اختصارات الكيبورد' },
  'kb-group-general':    { en: 'General',                       ar: 'عام' },
  'kb-group-tasks':      { en: 'Tasks',                         ar: 'المهام' },
  'kb-group-focus':      { en: 'Focus',                         ar: 'التركيز' },
  'kb-open-task-picker': { en: 'Open task picker',              ar: 'فتح قائمة المهام' },
  'kb-nav-picker':       { en: 'Navigate task picker',          ar: 'التنقل في قائمة المهام' },
  'kb-select-task':      { en: 'Select task',                   ar: 'اختيار المهمة' },
  'quick-add-ph':        { en: 'What do you need to do?',       ar: 'إيه اللي محتاج تعمله؟' },
  'tab-permissions':     { en: 'Permissions',                   ar: 'الأذونات' },
  'perm-quick-add-title': { en: 'Allow double-Ctrl to add a task', ar: 'السماح بـ Control مرتين لإضافة مهمة' },
  'perm-accessibility-desc': {
    en: 'Double-Ctrl quick-add needs Accessibility access. Tap Allow — macOS will add "{appName}" to the list (or show a prompt). Enable it under Privacy & Security → Accessibility. If it is missing, click + and choose the SilverBrain app. The shortcut activates automatically once allowed.',
    ar: 'إضافة المهام السريعة بـ Control مرتين تحتاج إذن إمكانية الوصول. اضغط «سماح» — سيضيف macOS «{appName}» للقائمة. فعّله من الخصوصية والأمان ← إمكانية الوصول. إن لم يظهر، اضغط + واختر التطبيق. الاختصار يعمل تلقائيًا بعد السماح.',
  },
  'perm-allow':          { en: 'Allow',                         ar: 'سماح' },
  'perm-allowed':        { en: 'Allowed',                       ar: 'مسموح' },
  'kb-quick-add':        { en: 'Quick-add task (macOS overlay)', ar: 'إضافة مهمة سريعة (نافذة macOS)' },
  'kb-settings':         { en: 'Open settings',                 ar: 'فتح الإعدادات' },
  'kb-sidebar':          { en: 'Toggle sidebar',                ar: 'إظهار/إخفاء الشريط الجانبي' },
  'kb-history':          { en: 'Open dump history',             ar: 'فتح سجل التفريغ' },
  'kb-prev-page':        { en: 'Previous page · settings tab',  ar: 'الصفحة السابقة · تبويب الإعدادات' },
  'kb-next-page':        { en: 'Next page · settings tab',      ar: 'الصفحة التالية · تبويب الإعدادات' },
  'kb-help':             { en: 'Show shortcuts',                ar: 'عرض الاختصارات' },
  'kb-close':            { en: 'Close panel',                   ar: 'إغلاق اللوحة' },
  'kb-finish-sort':      { en: 'Finish sorting (Sort page)',    ar: 'إنهاء الترتيب (صفحة الترتيب)' },
  'kb-focus-highlighted': { en: 'Send highlighted task to Focus', ar: 'إرسال المهمة المحددة للتركيز' },
  'kb-cycle-tasks':      { en: 'Move task focus',               ar: 'تحريك التركيز بين المهام' },
  'kb-edit-task':        { en: 'Edit highlighted task',         ar: 'تعديل المهمة المحددة' },
  'kb-change-quadrant':  { en: 'Change quadrant · navigate picker', ar: 'تغيير الربع · التنقل في القائمة' },
  'kb-delete-task':      { en: 'Delete highlighted task',       ar: 'حذف المهمة المحددة' },
  'kb-toggle-done':      { en: 'Toggle task complete',          ar: 'تبديل اكتمال المهمة' },
  'kb-pomo-toggle':      { en: 'Start / pause timer',           ar: 'ابدأ / وقف المؤقت' },
  'kb-pomo-skip':        { en: 'Skip to next session',          ar: 'تخطي للجلسة التالية' },
  'kb-pomo-full-reset':  { en: 'Full reset (clear sessions)',   ar: 'إعادة كاملة (مسح الجلسات)' },
  'kb-complete-focus-task': { en: 'Complete task & return to Tasks', ar: 'إكمال المهمة والعودة للمهام' },

  // ── Brain Dump ─────────────────────────────────────────────────────────────
  'no-provider':         { en: 'No provider configured.',       ar: 'مفيش مزود متحدد.' },
  'open-settings-btn':   { en: 'Open settings',                 ar: 'افتح الإعدادات' },
  'btn-extract':         { en: 'Extract Tasks',                 ar: 'استخرج المهام' },
  'btn-reset':           { en: 'Reset',                         ar: 'إعادة' },
  'bd-info':             { en: 'Type freely, then extract tasks with ⌘/Ctrl + Enter.', ar: 'اكتب بحرية، وبعدين استخرج المهام بـ ⌘/Ctrl + Enter.' },

  // ── Sort page ──────────────────────────────────────────────────────────────
  'sort-heading':        { en: 'Organize your thoughts',        ar: 'رتّب أفكارك' },
  'sort-sub':            { en: 'Categorize your tasks using the Eisenhower Matrix to focus on what truly matters.', ar: 'صنّف مهامك باستخدام مصفوفة أيزنهاور للتركيز على المهم فعلًا.' },
  'drawer-title':        { en: 'Tasks',                         ar: 'المهام' },
  'drawer-empty':        { en: 'No unsorted tasks. Extract a brain dump or add one below.', ar: 'مفيش مهام غير مرتبة. استخرج تفريغ أو أضف مهمة تحت.' },
  'drawer-add-ph':       { en: 'Add a task…',                   ar: 'أضف مهمة…' },
  'btn-back':            { en: 'Back',                           ar: 'رجوع' },
  'btn-finish-sort':     { en: 'Finish Sorting',                ar: 'إنهاء الترتيب' },
  'status-learning-memory': { en: 'Learning your sort preferences…', ar: 'بنتعلّم تفضيلات الترتيب…' },
  'status-learned':       { en: 'Preferences saved',                ar: 'اتحفظت التفضيلات' },
  'status-learn-failed':  { en: 'Could not update memory — your sort was saved.', ar: 'تعذّر تحديث الذاكرة — ترتيبك محفوظ.' },
  'drop-here':           { en: 'Drop tasks here',               ar: 'اسحب هنا' },
  'q-do-first':          { en: 'Do First',                      ar: 'افعل أولًا' },
  'q-schedule':          { en: 'Schedule',                      ar: 'جدوِل' },
  'q-delegate':          { en: 'Delegate',                      ar: 'فوِّض' },
  'q-eliminate':         { en: 'Eliminate',                     ar: 'تخلص منه' },
  'q1-sub':              { en: 'Urgent · Important',            ar: 'عاجل · مهم' },
  'q2-sub':              { en: 'Not urgent · Important',        ar: 'مش عاجل · مهم' },
  'q3-sub':              { en: 'Urgent · Not important',        ar: 'عاجل · مش مهم' },
  'q4-sub':              { en: 'Not urgent · Not important',    ar: 'مش عاجل · مش مهم' },
  'axis-urgent':         { en: 'Urgent',                        ar: 'عاجل' },
  'axis-not-urgent':     { en: 'Not urgent',                    ar: 'مش عاجل' },
  'row-important':       { en: 'Important',                     ar: 'مهم' },
  'row-not-important':   { en: 'Not important',                 ar: 'مش مهم' },
  'placed-info':         { en: 'Place tasks in the matrix to enable export', ar: 'حط المهام في المصفوفة عشان تقدر تصدر' },
  'tasks-placed-label':  { en: 'tasks placed',                  ar: 'مهمة اتحطت' },
  'btn-export-md':       { en: 'Export',                        ar: 'تصدير' },
  'btn-copy':            { en: 'Copy',                          ar: 'نسخ' },
  'btn-copied':          { en: 'Copied!',                       ar: 'تم النسخ!' },

  // ── History dialog ─────────────────────────────────────────────────────────
  'history-title':       { en: 'Brain Dump History',           ar: 'سجل التفريغات' },
  'history-desc':        { en: 'Revisit a past brain dump to restore it and all its sorted tasks.', ar: 'ارجع لتفريغ سابق عشان تستعيده مع كل مهامه المرتبة.' },
  'history-empty':       { en: 'No saved brain dumps yet.',     ar: 'مفيش تفريغات محفوظة لسه.' },
  'history-tasks':       { en: '{count} tasks',                 ar: '{count} مهمة' },

  // ── Export dialog ──────────────────────────────────────────────────────────
  'export-title':        { en: 'Markdown Export',              ar: 'تصدير Markdown' },
  'export-desc':         { en: 'Copy the markdown below into your notes or editor.', ar: 'انسخ الـ Markdown تحت لملاحظاتك أو محررك.' },
  'toast-dismiss':       { en: 'Dismiss',                       ar: 'إغلاق' },
  'status-extract-error': { en: 'Extraction failed — check your provider settings.', ar: 'فشل الاستخراج — راجع إعدادات المزود.' },
  'status-write-first':  { en: 'Please write something first.', ar: 'اكتب حاجة الأول.' },
  'status-extracting':   { en: 'Extracting tasks…',             ar: 'بنستخرج المهام…' },
  'status-no-tasks':     { en: 'No tasks found — try adding more detail.', ar: 'ملقيناش مهام — حاول تكتب أكتر تفاصيل.' },
  'tasks-extracted':     { en: '{count} tasks extracted',       ar: 'اتستخرج {count} مهمة' },
  'task-extracted-one':  { en: '1 task extracted',              ar: 'اتستخرجت مهمة واحدة' },

  // ── Placeholders ───────────────────────────────────────────────────────────
  'ph-dump':             { en: 'Start writing…',                ar: 'ابدأ الكتابة…' },
  'bd-heading':        { en: "Type everything that's on your mind", ar: 'اكتب كل اللي في دماغك' },
  'bd-sub':            { en: "Messy thoughts, rough ideas, tasks, worries — don't filter, just write.", ar: 'أفكار مبعثرة، أفكار خشنة، مهام، قلق — متفلترش، بس اكتب.' },
  'bd-welcome':        { en: "Write freely — press ⌘/Ctrl + Enter when you're ready to extract tasks.", ar: 'اكتب بحرية — اضغط ⌘/Ctrl + Enter لما تكون جاهز تستخرج المهام.' },
  'ph-model':            { en: 'model name',                    ar: 'اسم النموذج' },
  'ph-todo-add':         { en: 'Add a task and press Enter…',   ar: 'أضف مهمة واضغط Enter…' },

  // ── Todo ───────────────────────────────────────────────────────────────────
  'todo-heading':        { en: 'Tasks',                         ar: 'المهام' },
  'todo-opt-none':       { en: 'No quadrant',                   ar: 'بدون ربع' },
  'todo-opt-q1':         { en: 'Do first',                      ar: 'افعل أولًا' },
  'todo-opt-q2':         { en: 'Schedule',                      ar: 'جدوِل' },
  'todo-opt-q3':         { en: 'Delegate',                      ar: 'فوِّض' },
  'todo-opt-q4':         { en: 'Eliminate',                     ar: 'تخلص منه' },
  'btn-add':             { en: 'Add',                           ar: 'أضف' },
  'btn-clear-done':      { en: 'Clear completed',               ar: 'امسح المكتمل' },
  'btn-show-done':       { en: 'Show completed',                ar: 'اعرض المكتمل' },
  'btn-hide-done':       { en: 'Hide completed',                ar: 'اخفِ المكتمل' },
  'todo-empty':          { en: 'No tasks yet. Add one above, or send tasks from the Brain Dump matrix.', ar: 'مفيش مهام لسه. أضف واحدة فوق، أو ابعت مهام من مصفوفة فضي دماغك.' },
  'todo-group-q1':       { en: 'Do First',                      ar: 'افعل أولًا' },
  'todo-group-q2':       { en: 'Schedule',                      ar: 'جدوِل' },
  'todo-group-q3':       { en: 'Delegate',                      ar: 'فوِّض' },
  'todo-group-q4':       { en: 'Eliminate',                     ar: 'تخلص منه' },
  'todo-group-unsorted': { en: 'Unsorted',                      ar: 'غير مرتب' },
  'todo-badge-q1':       { en: 'Do first',                      ar: 'افعل أولًا' },
  'todo-badge-q2':       { en: 'Schedule',                      ar: 'جدوِل' },
  'todo-badge-q3':       { en: 'Delegate',                      ar: 'فوِّض' },
  'todo-badge-q4':       { en: 'Eliminate',                     ar: 'تخلص منه' },
  'todo-change-quadrant': { en: 'Change quadrant',              ar: 'غيّر الربع' },
  'sort-toggle-done':    { en: 'Toggle complete',               ar: 'تبديل اكتمال المهمة' },
  'todo-stats':          { en: '{open} open · {total} total',   ar: '{open} مفتوحة · {total} إجمالي' },

  // ── Pomodoro ───────────────────────────────────────────────────────────────
  'pomo-focus-btn':      { en: 'Focus',                         ar: 'تركيز' },
  'pomo-short-btn':      { en: 'Short break',                   ar: 'راحة قصيرة' },
  'pomo-long-btn':       { en: 'Long break',                    ar: 'راحة طويلة' },
  'pomo-short-btn-tray': { en: 'Short',                         ar: 'قصيرة' },
  'pomo-long-btn-tray':  { en: 'Long',                          ar: 'طويلة' },
  'pomo-no-task':        { en: 'No task selected',              ar: 'مفيش مهمة متحددة' },
  'pomo-task-picker-empty': { en: 'No tasks in this session. Add tasks from Sort or Tasks.', ar: 'مفيش مهام في الجلسة دي. أضف مهام من الترتيب أو المهام.' },
  'pomo-focusing-on':    { en: 'Focusing on',                   ar: 'مركز على' },
  'btn-pomo-start':      { en: 'Start',                         ar: 'ابدأ' },
  'btn-pomo-pause':      { en: 'Pause',                         ar: 'وقف' },
  'pomo-mode-focus':     { en: 'FOCUS MODE',                    ar: 'وقت تركيز' },
  'pomo-mode-short':     { en: 'SHORT BREAK',                   ar: 'راحة قصيرة' },
  'pomo-mode-long':      { en: 'LONG BREAK',                    ar: 'راحة طويلة' },
  'pomo-sessions':       { en: '{count} focus sessions completed', ar: 'اتمت {count} جلسة تركيز' },
  'label-auto-start-short': { en: 'Auto-start short break',     ar: 'ابدأ الراحة القصيرة تلقائيًا' },
  'label-auto-start-long':  { en: 'Auto-start long break',      ar: 'ابدأ الراحة الطويلة تلقائيًا' },
  'section-pomo-sounds':    { en: 'Session end sounds',         ar: 'أصوات نهاية الجلسة' },
  'label-sound-focus':      { en: 'Focus end',                  ar: 'نهاية التركيز' },
  'label-sound-short':      { en: 'Short break end',            ar: 'نهاية الراحة القصيرة' },
  'label-sound-long':       { en: 'Long break end',             ar: 'نهاية الراحة الطويلة' },
  'sound-preview':          { en: 'Preview sound',                ar: 'معاينة الصوت' },
  'sound-chime':            { en: 'Chime',                      ar: 'رنين' },
  'sound-bell':             { en: 'Bell',                       ar: 'جرس' },
  'sound-digital':          { en: 'Digital',                    ar: 'رقمي' },
  'sound-pop':              { en: 'Pop',                        ar: 'فرقعة' },
  'sound-gentle':           { en: 'Gentle',                     ar: 'هادئ' },
  'tray-open-app':       { en: 'Open App',                      ar: 'افتح التطبيق' },
  'notify-title-focus-done': { en: 'Focus session complete',        ar: 'خلصت جلسة التركيز' },
  'notify-title-break-over': { en: 'Break over',                    ar: 'خلصت الراحة' },
  'notify-focus-long':   { en: 'Focus done — take a long break!',  ar: 'خلصت التركيز — خد راحة طويلة!' },
  'notify-focus-short':  { en: 'Focus done — take a short break!', ar: 'خلصت التركيز — خد راحة قصيرة!' },
  'notify-break-done':   { en: 'Break over — back to focus.',       ar: 'خلصت الراحة — ارجع للتركيز.' },
};

let _lang: Lang = 'en';

export function getLang(): Lang {
  return _lang;
}

/**
 * Translate a key with optional variable interpolation.
 * Falls back to English if the key is missing or the language has no entry.
 */
export function t(key: string, vars?: Record<string, string | number>): string {
  const entry = translations[key];
  if (!entry) {
    console.warn(`[i18n] Missing key: "${key}"`);
    return key;
  }
  let str = entry[_lang] ?? entry.en;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      // Use split/join to avoid regex metacharacter issues with key names.
      str = str.split(`{${k}}`).join(String(v));
    }
  }
  return str;
}

/**
 * Apply a language change to the DOM.
 * - Swaps textContent for every [data-i18n] element.
 * - Swaps placeholder for every [data-i18n-placeholder] element.
 * - Sets dir="rtl" / lang attribute on <html>.
 * - Updates document.title.
 *
 * Safe to call multiple times (idempotent).
 */
const VALID_LANGS: readonly Lang[] = ['en', 'ar'];

export function applyLanguage(lang: Lang): void {
  // Guard: fall back to 'en' if persisted data holds an unrecognised value.
  _lang = VALID_LANGS.includes(lang) ? lang : 'en';

  const html = document.documentElement;

  if (lang === 'ar') {
    html.setAttribute('dir', 'rtl');
    html.setAttribute('lang', 'ar');
    html.classList.add('rtl');
  } else {
    html.removeAttribute('dir');
    html.setAttribute('lang', 'en');
    html.classList.remove('rtl');
  }

  // Swap static text — only safe on leaf-level elements (no child nodes).
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n!);
  });

  // Swap input / textarea placeholders.
  document.querySelectorAll<HTMLElement>('[data-i18n-placeholder]').forEach((el) => {
    (el as HTMLInputElement).placeholder = t(el.dataset.i18nPlaceholder!);
  });

  // Page title.
  document.title = lang === 'ar' ? 'فضي دماغك' : 'SilverBrain';
}
