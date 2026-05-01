with open("/home/stas/apps/easysch/src/app/dashboard/settings/page.tsx", "r") as f:
    src = f.read()

# 1. Remove entire Teacher code card
marker_start = "      {/* Teacher code */}"
marker_end = "      </Card>\n\n      {/* Display name */"
idx_start = src.find(marker_start)
idx_end = src.find(marker_end)
if idx_start >= 0 and idx_end >= 0:
    src = src[:idx_start] + "      {/* Display name */" + src[idx_end + len(marker_end):]
    print("Removed code card OK")
else:
    print("WARNING: code card not found", idx_start, idx_end)

# 2. Fix copyCode to copy full /start command
src = src.replace(
    "    navigator.clipboard.writeText(code);",
    "    navigator.clipboard.writeText(`/start ${code}`);"
)
print("Fixed copyCode")

# 3. Replace Telegram card
tg_start = "      {/* Telegram */}"
tg_end_marker = "\n      {/* Contacts */"
idx_tg = src.find(tg_start)
idx_tg_end = src.find(tg_end_marker, idx_tg)
if idx_tg >= 0 and idx_tg_end >= 0:
    new_tg = '''      {/* Telegram */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-blue-500" />
            Telegram
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {settings.telegramChatId ? (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
              <Check className="h-4 w-4 text-emerald-600 shrink-0" />
              <p className="text-sm text-emerald-700">Telegram прив&apos;язано. Ви отримуватимете сповіщення про заняття та оплати.</p>
            </div>
          ) : (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
              <p className="text-sm text-amber-700 font-medium mb-0.5">Telegram не підключено</p>
              <p className="text-xs text-amber-600">Відкрийте <a href="https://t.me/EasySchBot" target="_blank" className="underline font-medium">@EasySchBot</a> і надішліть команду нижче — ви будете отримувати нагадування про заняття та сповіщення про оплати.</p>
            </div>
          )}
          <div className="rounded-lg border border-border/50 bg-muted/30 px-4 py-3">
            <p className="text-xs text-muted-foreground mb-2">Команда для підключення:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm font-mono text-primary select-all">/start {code}</code>
              <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={copyCode} title="Скопіювати">
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Public page */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ExternalLink className="h-4 w-4" />
            Публічна сторінка розкладу
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm font-medium mb-1">Аліас</p>
            <p className="text-xs text-muted-foreground mb-2">Коротке посилання для клієнтів. Тільки латинські літери, цифри та дефіс. Якщо не вказано — використовується ваш код.</p>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center bg-muted rounded-md px-3 text-xs text-muted-foreground gap-1 h-9 min-w-0">
                <span className="shrink-0 hidden sm:inline">{typeof window !== "undefined" ? window.location.origin : ""}/</span>
                <Input
                  className="border-0 bg-transparent p-0 h-auto text-xs font-mono text-foreground focus-visible:ring-0 min-w-0"
                  placeholder={code.toLowerCase()}
                  value={alias}
                  onChange={(e) => setAlias(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  maxLength={40}
                />
              </div>
              <Button size="sm" variant="outline" disabled={savingAlias} onClick={async () => {
                setSavingAlias(true);
                const res = await fetch("/api/teachers", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ alias: alias.trim() || null }) });
                setSavingAlias(false);
                if (res.ok) toast.success("Аліас збережено");
                else { const d = await res.json(); toast.error(d.error ?? "Помилка"); }
              }}>
                {savingAlias ? "..." : "Зберегти"}
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-muted rounded-md px-3 py-2 text-muted-foreground truncate">{publicUrl}</code>
            <Button size="icon" variant="ghost" onClick={copyUrl}><Copy className="h-4 w-4" /></Button>
            <a href={publicUrl} target="_blank" rel="noopener noreferrer">
              <Button size="icon" variant="ghost"><ExternalLink className="h-4 w-4" /></Button>
            </a>
          </div>
        </CardContent>
      </Card>'''
    src = src[:idx_tg] + new_tg + tg_end_marker + src[idx_tg_end + len(tg_end_marker):]
    print("Replaced Telegram card OK")
else:
    print("WARNING: telegram card not found", idx_tg, idx_tg_end)

with open("/home/stas/apps/easysch/src/app/dashboard/settings/page.tsx", "w") as f:
    f.write(src)
print("done, len:", len(src))
