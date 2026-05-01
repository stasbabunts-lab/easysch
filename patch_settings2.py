with open("/home/stas/apps/easysch/src/app/dashboard/settings/page.tsx", "r") as f:
    src = f.read()

# Fix 1: Telegram card - add bot mention when connected, fix "command" label
old_tg = '''        <CardContent className="space-y-3">
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
        </CardContent>'''

new_tg = '''        <CardContent className="space-y-3">
          {settings.telegramChatId ? (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
              <Check className="h-4 w-4 text-emerald-600 shrink-0" />
              <p className="text-sm text-emerald-700">Telegram прив&apos;язано. Ви отримуватимете сповіщення про заняття та оплати.</p>
            </div>
          ) : (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
              <p className="text-sm text-amber-700 font-medium mb-0.5">Telegram не підключено</p>
              <p className="text-xs text-amber-600">Відкрийте бот <a href="https://t.me/EasySchBot" target="_blank" className="underline font-medium">@EasySchBot</a> і надішліть команду нижче — ви будете отримувати нагадування про заняття та сповіщення про оплати.</p>
            </div>
          )}
          <div className="rounded-lg border border-border/50 bg-muted/30 px-4 py-3">
            <p className="text-xs text-muted-foreground mb-2">
              Надішліть команду боту <a href="https://t.me/EasySchBot" target="_blank" className="font-medium text-blue-500 hover:underline">@EasySchBot</a>:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm font-mono text-primary select-all">/start {code}</code>
              <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={copyCode} title="Скопіювати">
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        </CardContent>'''

src = src.replace(old_tg, new_tg)
print("Telegram card fixed:", old_tg in src == False)

# Fix 2: Replace broken alias input with proper input
old_alias = '''            <div className="flex gap-2">
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
            </div>'''

new_alias = '''            <div className="flex gap-2">
              <Input
                className="flex-1 font-mono"
                placeholder={code.toLowerCase()}
                value={alias}
                onChange={(e) => setAlias(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                maxLength={40}
              />
              <Button size="sm" variant="outline" disabled={savingAlias} onClick={async () => {
                setSavingAlias(true);
                const res = await fetch("/api/teachers", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ alias: alias.trim() || null }) });
                setSavingAlias(false);
                if (res.ok) toast.success("Аліас збережено");
                else { const d = await res.json(); toast.error(d.error ?? "Помилка"); }
              }}>
                {savingAlias ? "..." : "Зберегти"}
              </Button>
            </div>'''

src = src.replace(old_alias, new_alias)
print("Alias input fixed:", old_alias in src == False)

with open("/home/stas/apps/easysch/src/app/dashboard/settings/page.tsx", "w") as f:
    f.write(src)
print("done, len:", len(src))
