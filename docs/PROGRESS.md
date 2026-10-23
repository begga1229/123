# Formula Studio — Durum / Статус / Status

**23.10.2026 — Hafif plan tamamlandı.** Sözlük API'si yazıldı, kurallı motor düzeltildi, yapay zeka arayüzü ve Windows programı test edildi, iki ZIP üretildi (`dist/`).

| Paket | Sonuç |
|---|---|
| tests/run.js tr / ru / en | %99,2 / %99,6 / %100 (kalan 3 vaka: doğru formül ilk 5'te ama 1. sırada değil: tr-115, tr-122, ru-219) |
| Lehçe çevirisi | %100 (504/504) |
| tests/ai-test.js | 33/33 |
| tests/smoke.js | geçti |
| Electron (Linux kopyası, xvfb) | pencere, dosya yükleme, formül, yerel model erişimi geçti |

Yeniden üretim: `EFS_DEV_NODE_MODULES=<electron+packager> node tools/build-desktop.js` ve `sh tools/make-web-zip.sh`.

---

## Önceki durma noktası (22.10.2026, arşiv)


Son durum: 22.10.2026. Dal: `claude/excel-formula-generator-app-a93jy8`.

## Özet (TR)

Uygulama açılıyor ve çalışıyor: Excel yükleme, formül üretme, açıklama, dosyaya uygulama ve indirme tarayıcıda test edildi.
Yapay zeka modu (Claude, Ollama, LM Studio) yazıldı ve sahte sunucularla 33/33 testten geçti.
Windows programı ilk kez derlendi.
Kalan iş: kurallı motorun doğruluğunu yükseltmek, son kontroller ve ZIP dosyalarını kullanıcıya vermek.

## Sıradaki adımlar (yarın)

1. **Sözlüğü bitir** (`assets/js/nlp/lexicon.js`).
   - 231 kavramın verisi yazıldı; eksik 4 kavram: `HOW_TO EXAMPLE FORMULA FUNCTION_WORD`.
   - API yazılmadı: `lookup`, `matchPhrases`, `numberWord`, `ordinal`, `conceptsFor`. Dosyanın sonundaki `__API_PENDING__` bloğunu silip API'yi ekle.
   - Talimatlar: `docs/handoff/complete-lexicon.workflow.js` (eksik kavram listesini güncelle).
2. **Kurallı motoru düzelt** — 3 paralel ajan: `docs/handoff/fix-engine.workflow.js`.
   - Önce `node tests/run.js --json tests/output/after-lexicon.json` ile temel ölçümü al (betik bu dosyayı karşılaştırma için kullanıyor).
   - Hedef: tr / ru / en ≥ %92.
3. **Yapay zeka arayüzünü doğrula** (ai-ui ajanı durduruldu, bitip bitmediği kontrol edilmeli):
   - Ayarlar penceresi, kaynak rozeti, "Biçimlendir" düğmesi, iptal düğmesi, üç dilde ekran görüntüleri.
4. **Windows programını yeniden derle ve test et** (desktop ajanı durduruldu; derleme ara durumdan alındı):
   - `node tools/build-desktop.js`, sonra Linux derlemesini `xvfb-run` + Playwright `_electron` ile dene.
   - Kullanıcının `.xlsx` dosyasının pakete girmediğini kontrol et.
5. **Paketle ve gönder:**
   - `FormulaStudio-Windows-x64.zip` (program) ve `FormulaStudio-Web.zip` (`docs/handoff/make-zip.sh`, `dist/` altına).
   - SendUserFile ile kullanıcıya ver.

## Ölçümler (durma anı)

| Paket | Sonuç |
|---|---|
| tests/run.js tr | %63,4 (151/238) |
| tests/run.js ru | %54,2 (129/238) |
| tests/run.js en | %57,4 (54/94) |
| Lehçe çevirisi (EN↔TR↔RU) | %100 (504/504) |
| tests/ai-test.js | 33/33 |
| tests/smoke.js (tarayıcı) | 9/9 |

Bilinen hatalar (fix-engine betiğinde ayrıntılı): `İndirim` başlığı DISC fonksiyonu sanılıyor; yerel ad verilen fonksiyonlarda (ÇOKETOPLA, СУММЕСЛИ) şablon kazanıyor; "içeren" + toplam → SUMIF yerine ISNUMBER(SEARCH); Rusça arama formüllerinde yanlış anahtar/dönüş sütunu; SUMPRODUCT, COUNTA/COUNTBLANK, indirim/KDV sütunu seçimi.

## Ortamı yeniden kurma (yeni oturumda)

Geçici klasör silinir; test araçlarını yeniden kur:

```bash
S=<scratchpad>; mkdir -p $S/vendor && cd $S/vendor && npm init -y >/dev/null
npm i xlsx@0.18.5 exceljs@4.4.0 hot-formula-parser@4.0.0 playwright@1.49.1
mkdir -p $S/ai-core && cd $S/ai-core && npm init -y >/dev/null && npm i @anthropic-ai/sdk@1.1.0 esbuild@0.28.2
mkdir -p $S/desktop && cd $S/desktop && npm init -y >/dev/null && npm i electron@37.10.3 @electron/packager@20.3.0
```

Test komutları:

```bash
EFS_NODE_MODULES=$S/vendor/node_modules node tests/run.js --json tests/output/report.json
EFS_NODE_MODULES=$S/vendor/node_modules EFS_ANTHROPIC_SDK=$S/ai-core/node_modules/@anthropic-ai/sdk node tests/ai-test.js
EFS_NODE_MODULES=$S/vendor/node_modules node tests/smoke.js
EFS_DEV_NODE_MODULES=$S/desktop/node_modules node tools/build-desktop.js
```

Not: `tests/run.js` ve `tests/smoke.js` içindeki varsayılan `DEFAULT_VENDOR` yolu eski oturumun geçici klasörünü gösteriyor; her zaman `EFS_NODE_MODULES` ver.

## Kullanıcıya verilmiş sözler

- İki ZIP: Windows programı (`FormulaStudio.exe`) ve tarayıcı sürümü (`index.html`).
- Yapay zeka modu isteğe bağlı; kapalıyken tamamen çevrimdışı ve bağımsız çalışır.
- Claude modu için kullanıcının kendi Anthropic API anahtarı gerekir (ücretli); yerel model (Ollama/LM Studio) ücretsiz ve çevrimdışıdır.
