# Teknik Ofis — Claude Skill Kütüphanesi

İnşaat teknik ofisi için **242 skill + 2 hazır araç**: metraj, bütçe, hakediş, iş programı, sözleşme, ihale, doküman kontrol, BIM, İSG.

Kaynaklar GitHub'daki MIT lisanslı açık kaynak projelerden seçildi, güvenlik taramasından geçirildi ve kategorilere ayrıldı (bkz. [Kaynaklar ve lisans](#kaynaklar-ve-lisans)).

## Kurulum

### A) Claude Code (terminal / masaüstü / web) — önerilen

```
/plugin marketplace add begga1229/123
```

Sonra istediğin kategorileri kur:

```
/plugin install teknik-ofis-metraj@teknik-ofis
/plugin install teknik-ofis-butce@teknik-ofis
/plugin install teknik-ofis-planlama@teknik-ofis
/plugin install teknik-ofis-sozlesme@teknik-ofis
/plugin install teknik-ofis-ihale-satinalma@teknik-ofis
/plugin install teknik-ofis-dokuman@teknik-ofis
/plugin install teknik-ofis-saha-kalite-isg@teknik-ofis
/plugin install teknik-ofis-raporlama-risk@teknik-ofis
/plugin install teknik-ofis-bim@teknik-ofis
/plugin install teknik-ofis-surdurulebilirlik@teknik-ofis
/plugin install teknik-ofis-cwicr@teknik-ofis
/plugin install teknik-ofis-veri-otomasyon@teknik-ofis
/plugin install teknik-ofis-primavera-p6@teknik-ofis
/plugin install construction@teknik-ofis
```

> `teknik-ofis-primavera-p6` için bilgisayarda [uv](https://docs.astral.sh/uv/) kurulu olmalı (`uvx` komutu). `construction` plugin'i ilk çalıştırmada kendi Python ortamını kurar (Python 3.10+).

### B) claude.ai (web / masaüstü / mobil uygulama)

1. Bu repodaki [`claude-ai-zip/`](claude-ai-zip) klasöründen istediğin skill'in `.zip` dosyasını indir.
2. claude.ai → **Ayarlar → Capabilities → Skills → Upload skill** ile yükle.
3. Her zip tek bir skill'dir; ihtiyacın olanları tek tek yükle. Başlangıç için aşağıdaki **⭐ Önerilen başlangıç seti**ni kullan.

Primavera P6 aracı claude.ai'de: **Ayarlar → Connectors → Add custom connector** → `https://pyp6xer-mcp.fly.dev/mcp`. Dikkat: bu adres üçüncü bir kişinin sunucusudur, yüklediğin XER dosyası oraya gider. Gizli projelerde Claude Code'daki yerel (uvx) kurulumu kullan.

### ⭐ Önerilen başlangıç seti (claude.ai için)

[`budget-variance-analyzer`](claude-ai-zip/teknik-ofis-butce/budget-variance-analyzer.zip) · [`cash-flow-forecaster`](claude-ai-zip/teknik-ofis-butce/cash-flow-forecaster.zip) · [`payment-application-generator`](claude-ai-zip/teknik-ofis-butce/payment-application-generator.zip) · [`estimate-builder`](claude-ai-zip/teknik-ofis-butce/estimate-builder.zip) · [`act-processor`](claude-ai-zip/teknik-ofis-butce/act-processor.zip) · [`critical-path-analyzer`](claude-ai-zip/teknik-ofis-planlama/critical-path-analyzer.zip) · [`schedule-delay-analyzer`](claude-ai-zip/teknik-ofis-planlama/schedule-delay-analyzer.zip) · [`look-ahead-scheduler`](claude-ai-zip/teknik-ofis-planlama/look-ahead-scheduler.zip) · [`gantt-chart`](claude-ai-zip/teknik-ofis-planlama/gantt-chart.zip) · [`contract-clause-analyzer`](claude-ai-zip/teknik-ofis-sozlesme/contract-clause-analyzer.zip) · [`change-order-manager`](claude-ai-zip/teknik-ofis-sozlesme/change-order-manager.zip) · [`claims-documentation`](claude-ai-zip/teknik-ofis-sozlesme/claims-documentation.zip) · [`letter-generator`](claude-ai-zip/teknik-ofis-sozlesme/letter-generator.zip) · [`bid-analysis-comparator`](claude-ai-zip/teknik-ofis-ihale-satinalma/bid-analysis-comparator.zip) · [`subcontractor-prequalification`](claude-ai-zip/teknik-ofis-ihale-satinalma/subcontractor-prequalification.zip) · [`qto-report`](claude-ai-zip/teknik-ofis-metraj/qto-report.zip) · [`dwg-to-excel`](claude-ai-zip/teknik-ofis-metraj/dwg-to-excel.zip) · [`ifc-qto-extraction`](claude-ai-zip/teknik-ofis-metraj/ifc-qto-extraction.zip) · [`rfi-management`](claude-ai-zip/teknik-ofis-dokuman/rfi-management.zip) · [`submittal-tracker`](claude-ai-zip/teknik-ofis-dokuman/submittal-tracker.zip) · [`meeting-minutes-generator`](claude-ai-zip/teknik-ofis-dokuman/meeting-minutes-generator.zip) · [`daily-report-generator`](claude-ai-zip/teknik-ofis-dokuman/daily-report-generator.zip) · [`project-kpi-dashboard`](claude-ai-zip/teknik-ofis-raporlama-risk/project-kpi-dashboard.zip) · [`risk-analyzer`](claude-ai-zip/teknik-ofis-raporlama-risk/risk-analyzer.zip)

## Kategoriler

| Plugin | Konu | Skill |
|---|---|---|
| [`teknik-ofis-metraj`](#teknik-ofis-metraj) | **Metraj / Keşif (QTO, BOQ)** — Çizim, PDF, DWG, RVT ve IFC'den metraj çıkarma, birim dönüşümü, fire hesabı, Excel'e aktarım. | 19 |
| [`teknik-ofis-butce`](#teknik-ofis-butce) | **Bütçe, Maliyet ve Hakediş** — Yaklaşık maliyet, birim fiyat, bütçe-gerçekleşen sapması, nakit akışı, hakediş, teminat kesintisi, КС-2/КС-3. | 22 |
| [`teknik-ofis-planlama`](#teknik-ofis-planlama) | **İş Programı ve Planlama** — Kritik yol, gecikme analizi, look-ahead, kaynak dengeleme, 4D/5D, Gantt, ilerleme takibi, hava etkisi. | 29 |
| [`teknik-ofis-sozlesme`](#teknik-ofis-sozlesme) | **Sözleşme ve Hak Talepleri** — Sözleşme madde analizi, değişiklik emirleri (change order), hak talebi (claim) dosyası, yazışma, izin ve uyum takibi. | 11 |
| [`teknik-ofis-ihale-satinalma`](#teknik-ofis-ihale-satinalma) | **İhale ve Satınalma** — Teklif karşılaştırma, taşeron ön yeterlilik, malzeme tedarik ve sevkiyat takibi, ihale. | 9 |
| [`teknik-ofis-dokuman`](#teknik-ofis-dokuman) | **Doküman Kontrol ve Raporlar** — RFI, submittal, toplantı tutanağı, günlük rapor, as-built, garanti, kapanış; Word/Excel/PDF/PPT üretimi. | 17 |
| [`teknik-ofis-saha-kalite-isg`](#teknik-ofis-saha-kalite-isg) | **Saha, Kalite ve İSG** — Punch list, kalite kontrol, iş güvenliği denetimi, olay raporu, ilerleme fotoğrafı analizi, saha raporları. | 18 |
| [`teknik-ofis-raporlama-risk`](#teknik-ofis-raporlama-risk) | **Yönetim Raporu ve Risk** — KPI panoları, yönetici özeti, portföy, senaryo analizi, risk değerlendirme. | 12 |
| [`teknik-ofis-bim`](#teknik-ofis-bim) | **BIM Koordinasyon** — Clash detection, BIM doğrulama, IDS kontrolü, sınıflandırma, dijital ikiz. | 16 |
| [`teknik-ofis-surdurulebilirlik`](#teknik-ofis-surdurulebilirlik) | **Karbon ve Sürdürülebilirlik** — CO2 / gömülü karbon, yaşam döngüsü karbon hesabı, ESG. | 5 |
| [`teknik-ofis-cwicr`](#teknik-ofis-cwicr) | **CWICR Birim Fiyat Veritabanı Araçları** — DDC CWICR açık maliyet veritabanı ile maliyet hesabı, kaynak analizi, fiyat güncelleme, eskalasyon. Veritabanı CC BY-NC 4.0: ticari kullanım için DDC lisansı gerekir. | 31 |
| [`teknik-ofis-veri-otomasyon`](#teknik-ofis-veri-otomasyon) | **Veri, Otomasyon ve Yapay Zekâ** — İnşaat verisi için ETL, Excel/CSV/SQL işleme, n8n/Airflow otomasyonları, ML tahmin modelleri, RAG. | 53 |
| `teknik-ofis-primavera-p6` | **Primavera P6** — XER analizi, kritik yol, EVM | MCP |
| `construction` | **Proje Mühendisi** — çizim/şartname, submittal, RFI, teklif, taşeron sözleşmesi ([dleerdefi](https://github.com/dleerdefi/claude-code-construction)) | 14 |

## Skill kataloğu

### teknik-ofis-metraj

**Metraj / Keşif (QTO, BOQ)** — Çizim, PDF, DWG, RVT ve IFC'den metraj çıkarma, birim dönüşümü, fire hesabı, Excel'e aktarım.

<details><summary>Skill listesi</summary>

| Skill | Kaynak | Açıklama |
|---|---|---|
| [`auto-estimate-generator`](plugins/teknik-ofis-metraj/skills/auto-estimate-generator/SKILL.md) | DDC | Automatically generate estimates from QTO data. Apply pricing rules to BIM quantities for cost estimates. |
| [`batch-cad-converter`](plugins/teknik-ofis-metraj/skills/batch-cad-converter/SKILL.md) | DDC | Batch convert multiple CAD/BIM files (Revit, IFC, DWG, DGN) with progress tracking, error handling, and consolidated reporting. |
| [`bim-qto`](plugins/teknik-ofis-metraj/skills/bim-qto/SKILL.md) | DDC | Extract quantities from BIM/CAD data for cost estimation. Group by type, level, zone. Generate QTO reports. |
| [`cad-to-data`](plugins/teknik-ofis-metraj/skills/cad-to-data/SKILL.md) | DDC | Convert CAD/BIM files to structured data. Extract element data from Revit, IFC, DWG, DGN files. |
| [`dgn-to-excel`](plugins/teknik-ofis-metraj/skills/dgn-to-excel/SKILL.md) | DDC | Convert DGN files (v7-v8) to Excel databases. Extract elements, levels, and properties from infrastructure CAD files. |
| [`drawing-analyzer`](plugins/teknik-ofis-metraj/skills/drawing-analyzer/SKILL.md) | DDC | Analyze construction drawings to extract dimensions, annotations, symbols, and metadata. Support quantity takeoff and design review automation. |
| [`dwg-to-excel`](plugins/teknik-ofis-metraj/skills/dwg-to-excel/SKILL.md) | DDC | Convert AutoCAD DWG files (1983-2026) to Excel databases using DwgExporter CLI. Extract layers, blocks, attributes, and geometry data without Autodesk licenses. |
| [`excel-to-bim`](plugins/teknik-ofis-metraj/skills/excel-to-bim/SKILL.md) | DDC | Push Excel data back to BIM models. Update parameters, properties, and attributes from structured spreadsheets. |
| [`excel-to-rvt`](plugins/teknik-ofis-metraj/skills/excel-to-rvt/SKILL.md) | DDC | Import Excel data into RVT projects. Update element parameters, create schedules, and sync external data sources. |
| [`ifc-data-extraction`](plugins/teknik-ofis-metraj/skills/ifc-data-extraction/SKILL.md) | DDC | Extract structured data from IFC (Industry Foundation Classes) files using IfcOpenShell. Parse BIM models, extract quantities, properties, spatial relationships, and export to various formats. |
| [`ifc-qto-extraction`](plugins/teknik-ofis-metraj/skills/ifc-qto-extraction/SKILL.md) | DDC | Extract quantities from IFC/Revit models for quantity takeoff. Uses DDC converters to get element counts, areas, volumes, lengths with grouping and reporting. |
| [`ifc-to-excel`](plugins/teknik-ofis-metraj/skills/ifc-to-excel/SKILL.md) | DDC | Convert IFC files (2x3, 4x1, 4x3) to Excel databases using IfcExporter CLI. Extract BIM data, properties, and geometry without proprietary software. |
| [`image-to-data`](plugins/teknik-ofis-metraj/skills/image-to-data/SKILL.md) | DDC | Extract data from construction images using AI Vision. Analyze site photos, scanned documents, drawings. |
| [`oce-bim-takeoff`](plugins/teknik-ofis-metraj/skills/oce-bim-takeoff/SKILL.md) | DDC | CAD/BIM takeoff in OpenConstructionERP: upload Revit/IFC/DWG/DGN models, browse elements, bulk-link them to BOQ lines, measure DWG drawings and PDF plans, and push quantities into the estimate. Use for any model-based quantification workflow. |
| [`pdf-to-structured`](plugins/teknik-ofis-metraj/skills/pdf-to-structured/SKILL.md) | DDC | Extract structured data from construction PDFs. Convert specifications, BOMs, schedules, and reports from PDF to Excel/CSV/JSON. Use OCR for scanned documents and pdfplumber for native PDFs. |
| [`qto-report`](plugins/teknik-ofis-metraj/skills/qto-report/SKILL.md) | DDC | Generate Quantity Take-Off (QTO) reports from BIM/CAD data. Extract volumes, areas, counts by category. Group elements, apply calculation rules, and create cost estimates automatically. |
| [`rvt-to-excel`](plugins/teknik-ofis-metraj/skills/rvt-to-excel/SKILL.md) | DDC | Convert RVT/RFA files to Excel databases. Extract BIM element data, properties, and quantities. |
| [`rvt-to-ifc`](plugins/teknik-ofis-metraj/skills/rvt-to-ifc/SKILL.md) | DDC | Convert RVT files to IFC format. Support IFC2x3, IFC4, IFC4.3 with customizable export settings. |
| [`specification-extractor`](plugins/teknik-ofis-metraj/skills/specification-extractor/SKILL.md) | DDC | Extract structured data from construction specifications. Parse CSI sections, requirements, submittals, and product data from spec documents. |

</details>

### teknik-ofis-butce

**Bütçe, Maliyet ve Hakediş** — Yaklaşık maliyet, birim fiyat, bütçe-gerçekleşen sapması, nakit akışı, hakediş, teminat kesintisi, КС-2/КС-3.

<details><summary>Skill listesi</summary>

| Skill | Kaynak | Açıklama |
|---|---|---|
| [`act-processor`](plugins/teknik-ofis-butce/skills/act-processor/SKILL.md) | AI-PMO | Обработка и генерация актов КС-2, КС-3 и других закрывающих документов. Используй когда пользователь говорит "обработай акт", "сформируй КС-2", "закрывающие документы", "акт выполненных работ", "справка о стоимости". |
| [`bim-cost-estimation-cwicr`](plugins/teknik-ofis-butce/skills/bim-cost-estimation-cwicr/SKILL.md) | DDC | Automated cost estimation from BIM models using DDC CWICR database (8 national bases, 78,228 positions). AI classification + vector search for accurate pricing. |
| [`budget-variance-analyzer`](plugins/teknik-ofis-butce/skills/budget-variance-analyzer/SKILL.md) | DDC | Analyze construction budget variances. Compare estimated vs actual costs, identify trends, forecast final costs, and generate variance reports for cost control. |
| [`cash-flow-forecaster`](plugins/teknik-ofis-butce/skills/cash-flow-forecaster/SKILL.md) | DDC | Forecast project cash flow based on schedule and cost data. Generate S-curves and payment projections. |
| [`cashflow-forecaster`](plugins/teknik-ofis-butce/skills/cashflow-forecaster/SKILL.md) | DDC | Forecast construction project cash flow. Project income and expenses, identify funding gaps, and optimize payment timing for improved financial management. |
| [`cost-estimation-resource`](plugins/teknik-ofis-butce/skills/cost-estimation-resource/SKILL.md) | DDC | Calculate construction costs using resource-based method. Estimate project costs from work items, physical resource norms, and current prices. |
| [`cost-prediction`](plugins/teknik-ofis-butce/skills/cost-prediction/SKILL.md) | DDC | Predict construction project costs using Machine Learning. Use Linear Regression, K-Nearest Neighbors, and Random Forest models on historical project data. Train, evaluate, and deploy cost prediction models. |
| [`estimate-builder`](plugins/teknik-ofis-butce/skills/estimate-builder/SKILL.md) | DDC | Build construction project estimates. Generate detailed cost breakdowns with labor, materials, equipment, and overhead. |
| [`forecast-engine`](plugins/teknik-ofis-butce/skills/forecast-engine/SKILL.md) | AI-PMO | Прогнозирование сроков завершения и итоговой стоимости проекта. Используй когда пользователь говорит "когда закончим", "прогноз", "EAC", "ETC", "прогноз бюджета", "прогноз сроков", "сценарный анализ". |
| [`historical-cost-analyzer`](plugins/teknik-ofis-butce/skills/historical-cost-analyzer/SKILL.md) | DDC | Analyze historical construction costs for benchmarking, trend analysis, and estimating calibration. Compare projects, track escalation, identify patterns. |
| [`labor-rate`](plugins/teknik-ofis-butce/skills/labor-rate/SKILL.md) | DDC | Calculate construction labor rates with overhead, benefits, and productivity factors. Regional rate databases and crew composition. |
| [`multi-agent-estimation`](plugins/teknik-ofis-butce/skills/multi-agent-estimation/SKILL.md) | DDC | Build multi-agent AI systems for construction estimation. Use CrewAI/LangGraph to orchestrate specialized agents: QTO agent, pricing agent, validation agent. Automate complex estimation workflows. |
| [`oce-cost-browser`](plugins/teknik-ofis-butce/skills/oce-cost-browser/SKILL.md) | DDC | Browse and search the OpenConstructionERP cost database: classification tree, SQL and semantic search, autocomplete, certainty badges, and the resource catalog. Use when a user wants to explore cost data without building a BOQ yet. |
| [`oce-estimate-boq`](plugins/teknik-ofis-butce/skills/oce-estimate-boq/SKILL.md) | DDC | Create bills of quantities and estimates in OpenConstructionERP: search cost items, build BOQ sections, link BIM elements in bulk, validate the BOQ, and export GAEB/XLSX/JSON. Use for any estimating workflow on the platform. |
| [`oce-load-cost-bases`](plugins/teknik-ofis-butce/skills/oce-load-cost-bases/SKILL.md) | DDC | Load national and market cost bases into OpenConstructionERP: the 8 national bases (Turkey Birim Fiyat, China Dinge, Brazil SINAPI, Spain BCCA, Italy Prezzario Toscana, Greece GGDE, Vietnam Dinh Muc, Indonesia AHSP), the 30 global markets, and 48 PPP market catalogs per base. Use when importing a cost database, repricing into a market, or troubleshooting a load. |
| [`open-construction-estimate`](plugins/teknik-ofis-butce/skills/open-construction-estimate/SKILL.md) | DDC | Access and utilize open construction pricing databases. Match BIM elements to standardized work items, calculate costs using public unit price databases with 55,000+ work items. |
| [`payment-application-generator`](plugins/teknik-ofis-butce/skills/payment-application-generator/SKILL.md) | DDC | Generate AIA-style payment applications. Track schedule of values, calculate retention, and produce payment documentation. |
| [`payment-application-processor`](plugins/teknik-ofis-butce/skills/payment-application-processor/SKILL.md) | DDC | Process construction payment applications. Validate schedule of values, calculate retainage, track billing status, and generate G702/G703 forms. |
| [`price-api`](plugins/teknik-ofis-butce/skills/price-api/SKILL.md) | DDC | Fetch construction material prices from open APIs. Track price trends, regional variations, and update cost databases. |
| [`retention-tracker`](plugins/teknik-ofis-butce/skills/retention-tracker/SKILL.md) | DDC | Track construction retainage/retention amounts. Monitor held amounts by subcontractor, track release conditions, and manage retainage billing. |
| [`subcontractor-payment-tracker`](plugins/teknik-ofis-butce/skills/subcontractor-payment-tracker/SKILL.md) | DDC | Track subcontractor payments, lien waivers, and compliance. Manage payment schedules and documentation. |
| [`unit-price-database-manager`](plugins/teknik-ofis-butce/skills/unit-price-database-manager/SKILL.md) | DDC | Manage construction unit price databases: update prices, track vendors, apply location factors, maintain historical records. Essential for accurate estimating. |

</details>

### teknik-ofis-planlama

**İş Programı ve Planlama** — Kritik yol, gecikme analizi, look-ahead, kaynak dengeleme, 4D/5D, Gantt, ilerleme takibi, hava etkisi.

<details><summary>Skill listesi</summary>

| Skill | Kaynak | Açıklama |
|---|---|---|
| [`4d-simulation`](plugins/teknik-ofis-planlama/skills/4d-simulation/SKILL.md) | DDC | Create 4D construction simulations by linking BIM elements to project schedules. Generate time-based visualizations, sequence analysis, and construction phasing with Gantt integration. |
| [`bim-to-schedule-4d`](plugins/teknik-ofis-planlama/skills/bim-to-schedule-4d/SKILL.md) | DDC | Link BIM elements to schedule activities for 4D simulation. Visualize construction sequence over time. |
| [`capacity-planning`](plugins/teknik-ofis-planlama/skills/capacity-planning/SKILL.md) | DDC | Plan organizational capacity for construction projects. Forecast resource needs, identify capacity gaps, and support strategic planning for project pursuit and staffing. |
| [`critical-path-analyzer`](plugins/teknik-ofis-planlama/skills/critical-path-analyzer/SKILL.md) | DDC | Analyze project critical path from schedule data. Identify critical activities, calculate float, and assess schedule risk. |
| [`delay-analysis`](plugins/teknik-ofis-planlama/skills/delay-analysis/SKILL.md) | DDC | Analyze construction schedule delays for claims and recovery. Perform time impact analysis, identify delay causes, calculate damages, and document for disputes. |
| [`deviation-alert`](plugins/teknik-ofis-planlama/skills/deviation-alert/SKILL.md) | AI-PMO | Автоматические уведомления об отклонениях и критических событиях. Используй когда пользователь говорит "настрой уведомления", "алерты", "триггеры оповещений", "кого уведомлять", "эскалация". |
| [`duration-prediction`](plugins/teknik-ofis-planlama/skills/duration-prediction/SKILL.md) | DDC | Predict project duration using k-NN and regression. Estimate timeline based on similar historical projects. |
| [`equipment-fleet-manager`](plugins/teknik-ofis-planlama/skills/equipment-fleet-manager/SKILL.md) | DDC | Manage construction equipment fleet. Track utilization, maintenance, and assignments. |
| [`gantt-chart`](plugins/teknik-ofis-planlama/skills/gantt-chart/SKILL.md) | DDC | Generate Gantt charts for construction scheduling. Create visual project timelines with dependencies and progress tracking. |
| [`gantt-planner`](plugins/teknik-ofis-planlama/skills/gantt-planner/SKILL.md) | AI-PMO | Создание и обновление графиков Ганта в Excel для строительных проектов. Используй когда пользователь говорит "построй график", "обнови Ганта", "спланируй работы", "КП", "календарный план", "график производства работ", "ППР", "вехи проекта". |
| [`labor-allocation`](plugins/teknik-ofis-planlama/skills/labor-allocation/SKILL.md) | DDC | Allocate and track labor resources across project activities. Balance workload, track attendance, and optimize crew assignments. |
| [`labor-productivity-analytics`](plugins/teknik-ofis-planlama/skills/labor-productivity-analytics/SKILL.md) | DDC | Analyze construction labor productivity using data analytics. Track worker performance, identify inefficiencies, predict resource needs, and optimize crew allocation for maximum efficiency. |
| [`labor-productivity-analyzer`](plugins/teknik-ofis-planlama/skills/labor-productivity-analyzer/SKILL.md) | DDC | Analyze labor productivity by trade, activity, and location. Track efficiency and identify improvement opportunities. |
| [`look-ahead-scheduler`](plugins/teknik-ofis-planlama/skills/look-ahead-scheduler/SKILL.md) | DDC | Generate rolling look-ahead schedules for construction. Create 2-week, 3-week, or 6-week look-aheads with constraint analysis and crew coordination. |
| [`oce-scheduling-4d5d`](plugins/teknik-ofis-planlama/skills/oce-scheduling-4d5d/SKILL.md) | DDC | 4D scheduling and 5D cost modelling in OpenConstructionERP: build task schedules, link tasks to BIM elements and BOQ lines, roll up the cost model over time, and export Gantt/sequence views. Use for schedule-cost integration workflows. |
| [`prefab-optimization`](plugins/teknik-ofis-planlama/skills/prefab-optimization/SKILL.md) | DDC | Optimize prefabrication and modular construction workflows. Plan module sequencing, factory scheduling, transportation logistics, and on-site assembly for maximum efficiency. |
| [`productivity-analyzer`](plugins/teknik-ofis-planlama/skills/productivity-analyzer/SKILL.md) | DDC | Analyze labor productivity from site data. Compare planned vs actual, identify trends, benchmark against industry standards. |
| [`progress-tracker`](plugins/teknik-ofis-planlama/skills/progress-tracker/SKILL.md) | AI-PMO | Сопоставление план/факт, расчёт отклонений и индексов выполнения проекта. Используй когда пользователь говорит "как идут работы", "отклонения", "план-факт", "процент выполнения", "SPI", "CPI", "освоенный объём", "EVM". |
| [`resource-allocation-optimizer`](plugins/teknik-ofis-planlama/skills/resource-allocation-optimizer/SKILL.md) | DDC | Optimize construction resource allocation across activities. Level resources, resolve over-allocations, and balance workload while minimizing schedule impact. |
| [`resource-allocator`](plugins/teknik-ofis-planlama/skills/resource-allocator/SKILL.md) | AI-PMO | Распределение и оптимизация ресурсов по проектам. Используй когда пользователь говорит "распредели ресурсы", "кто свободен", "какая техника доступна", "загрузка бригад", "оптимизация ресурсов", "конфликт ресурсов". |
| [`resource-leveler`](plugins/teknik-ofis-planlama/skills/resource-leveler/SKILL.md) | DDC | Level and optimize construction resource allocation across project schedule. Balance labor, equipment usage, and avoid overallocation while maintaining critical path. |
| [`resource-pool-optimizer`](plugins/teknik-ofis-planlama/skills/resource-pool-optimizer/SKILL.md) | DDC | Optimize shared resource pools across multiple construction projects. Balance resource allocation, minimize conflicts, and maximize utilization across the portfolio. |
| [`schedule-compression`](plugins/teknik-ofis-planlama/skills/schedule-compression/SKILL.md) | DDC | Compress construction schedules using crashing and fast-tracking techniques. Analyze cost-time tradeoffs and find optimal acceleration strategies. |
| [`schedule-cost-link`](plugins/teknik-ofis-planlama/skills/schedule-cost-link/SKILL.md) | DDC | Link schedule activities to cost items. Create cost-loaded schedules, generate cash flow curves, and track earned value. |
| [`schedule-delay-analyzer`](plugins/teknik-ofis-planlama/skills/schedule-delay-analyzer/SKILL.md) | DDC | Analyze schedule delays, identify causes, and calculate time impacts using delay analysis methods. |
| [`schedule-forecaster`](plugins/teknik-ofis-planlama/skills/schedule-forecaster/SKILL.md) | DDC | Predict project completion dates using ML models. Forecast schedule delays based on current progress, historical patterns, and risk factors. |
| [`site-logistics-optimization`](plugins/teknik-ofis-planlama/skills/site-logistics-optimization/SKILL.md) | DDC | Optimize construction site logistics including material delivery scheduling, crane positioning, storage area allocation, and traffic flow using operations research and simulation. |
| [`weather-impact-analysis`](plugins/teknik-ofis-planlama/skills/weather-impact-analysis/SKILL.md) | DDC | Analyze weather data impact on construction schedules. Predict weather delays, optimize work scheduling based on forecasts, and calculate weather-related risk factors for project planning. |
| [`weather-impact-scheduler`](plugins/teknik-ofis-planlama/skills/weather-impact-scheduler/SKILL.md) | DDC | Analyze weather impact on construction schedule. Predict delays and adjust activities based on forecast. |

</details>

### teknik-ofis-sozlesme

**Sözleşme ve Hak Talepleri** — Sözleşme madde analizi, değişiklik emirleri (change order), hak talebi (claim) dosyası, yazışma, izin ve uyum takibi.

<details><summary>Skill listesi</summary>

| Skill | Kaynak | Açıklama |
|---|---|---|
| [`change-order-analysis`](plugins/teknik-ofis-sozlesme/skills/change-order-analysis/SKILL.md) | DDC | Analyze and predict construction change orders using ML. Classify change order types, predict costs and schedule impacts, identify patterns, and optimize approval workflows. |
| [`change-order-manager`](plugins/teknik-ofis-sozlesme/skills/change-order-manager/SKILL.md) | DDC | Manage construction change orders from request to approval. Track costs, schedule impacts, and maintain audit trail for dispute prevention. |
| [`change-order-processor`](plugins/teknik-ofis-sozlesme/skills/change-order-processor/SKILL.md) | DDC | Process and manage construction change orders. Track costs, approvals, and impact on schedule and budget. |
| [`claims-documentation`](plugins/teknik-ofis-sozlesme/skills/claims-documentation/SKILL.md) | DDC | Document construction claims for disputes and recovery. Compile evidence, calculate damages, track notice requirements, and prepare claim packages. |
| [`compliance-tracker`](plugins/teknik-ofis-sozlesme/skills/compliance-tracker/SKILL.md) | DDC | Track regulatory compliance for construction projects. Monitor permits, certifications, inspections, and regulatory requirements with automated alerts and reporting. |
| [`contract-analyzer`](plugins/teknik-ofis-sozlesme/skills/contract-analyzer/SKILL.md) | AI-PMO | Анализ договоров и контрактов, выявление рисков и ключевых условий. Используй когда пользователь говорит "проанализируй договор", "что по контракту", "условия оплаты", "штрафы по договору", "сроки по договору", "обязательства". |
| [`contract-clause-analyzer`](plugins/teknik-ofis-sozlesme/skills/contract-clause-analyzer/SKILL.md) | DDC | Analyze construction contract clauses. Identify risks, obligations, and key terms using NLP. |
| [`contract-clause-extractor`](plugins/teknik-ofis-sozlesme/skills/contract-clause-extractor/SKILL.md) | DDC | Extract and analyze key clauses from construction contracts. Identify payment terms, change order procedures, dispute resolution, warranties, and risk allocation provisions. |
| [`letter-generator`](plugins/teknik-ofis-sozlesme/skills/letter-generator/SKILL.md) | AI-PMO | Генерация официальных писем заказчику и контрагентам. Используй когда пользователь говорит "напиши письмо", "уведоми заказчика", "претензия", "запрос продления", "исходящее письмо", "уведомление о рисках", "письмо подрядчику". |
| [`lien-waiver-tracker`](plugins/teknik-ofis-sozlesme/skills/lien-waiver-tracker/SKILL.md) | DDC | Track and manage construction lien waivers. Monitor conditional and unconditional waivers, ensure compliance before payments, and prevent lien exposure. |
| [`permit-tracking-automation`](plugins/teknik-ofis-sozlesme/skills/permit-tracking-automation/SKILL.md) | DDC | Automate construction permit tracking and management. Monitor application status, track renewal deadlines, manage document requirements, and integrate with municipal systems. |

</details>

### teknik-ofis-ihale-satinalma

**İhale ve Satınalma** — Teklif karşılaştırma, taşeron ön yeterlilik, malzeme tedarik ve sevkiyat takibi, ihale.

<details><summary>Skill listesi</summary>

| Skill | Kaynak | Açıklama |
|---|---|---|
| [`bid-analysis-comparator`](plugins/teknik-ofis-ihale-satinalma/skills/bid-analysis-comparator/SKILL.md) | DDC | Compare and analyze contractor bids. Score proposals, identify scope gaps, and recommend selections. |
| [`contractor-matching-ai`](plugins/teknik-ofis-ihale-satinalma/skills/contractor-matching-ai/SKILL.md) | DDC | AI-powered contractor matching and selection for construction projects. Analyze contractor capabilities, past performance, certifications, and project requirements to recommend optimal matches. |
| [`material-delivery-tracker`](plugins/teknik-ofis-ihale-satinalma/skills/material-delivery-tracker/SKILL.md) | DDC | Track material deliveries, manage inventory, and coordinate logistics. Monitor delivery schedules and site storage. |
| [`material-passports-circular`](plugins/teknik-ofis-ihale-satinalma/skills/material-passports-circular/SKILL.md) | DDC | Material passports and circular construction: generate per-element material inventories from BOQ/BIM, mark reuse potential and recycled content, and prepare deconstruction data. Use for circular-economy and EU Taxonomy-aligned projects. |
| [`material-procurement-tracker`](plugins/teknik-ofis-ihale-satinalma/skills/material-procurement-tracker/SKILL.md) | DDC | Track material procurement from requisition to delivery. Monitor lead times, vendors, and costs. |
| [`material-tracker`](plugins/teknik-ofis-ihale-satinalma/skills/material-tracker/SKILL.md) | DDC | Track material orders, deliveries, and inventory on construction sites. Monitor lead times, delivery status, and stock levels. |
| [`material-tracking-iot`](plugins/teknik-ofis-ihale-satinalma/skills/material-tracking-iot/SKILL.md) | DDC | IoT-based material tracking for construction sites. Monitor material delivery, storage conditions, usage, and inventory with sensors, RFID, GPS, and real-time dashboards. |
| [`oce-tendering`](plugins/teknik-ofis-ihale-satinalma/skills/oce-tendering/SKILL.md) | DDC | Tendering and reporting in OpenConstructionERP: prepare tender BOQs, compare bids, manage risks, and generate reports (weekly, monthly, closeout). Use when a project goes to tender or needs reporting. |
| [`subcontractor-prequalification`](plugins/teknik-ofis-ihale-satinalma/skills/subcontractor-prequalification/SKILL.md) | DDC | Prequalify subcontractors based on safety, financial, and performance criteria. |

</details>

### teknik-ofis-dokuman

**Doküman Kontrol ve Raporlar** — RFI, submittal, toplantı tutanağı, günlük rapor, as-built, garanti, kapanış; Word/Excel/PDF/PPT üretimi.

<details><summary>Skill listesi</summary>

| Skill | Kaynak | Açıklama |
|---|---|---|
| [`as-built-documentation`](plugins/teknik-ofis-dokuman/skills/as-built-documentation/SKILL.md) | DDC | Manage as-built documentation for project closeout. Track drawing markups, coordinate updates, and verify completeness. |
| [`as-built-tracker`](plugins/teknik-ofis-dokuman/skills/as-built-tracker/SKILL.md) | DDC | Track as-built documentation and record drawings. Monitor submission status, manage revisions, and ensure completeness for handover. |
| [`daily-progress-report`](plugins/teknik-ofis-dokuman/skills/daily-progress-report/SKILL.md) | DDC | Generate automated daily progress reports from site data. Track work completed, labor hours, equipment usage, and weather conditions. |
| [`daily-report-generator`](plugins/teknik-ofis-dokuman/skills/daily-report-generator/SKILL.md) | DDC | Automatically generate daily construction reports from field data, worker inputs, weather, and progress photos. Creates professional PDF reports. |
| [`document-classification-nlp`](plugins/teknik-ofis-dokuman/skills/document-classification-nlp/SKILL.md) | DDC | Automatically classify and extract information from construction documents using NLP. Categorize RFIs, submittals, change orders, specifications, and contracts. |
| [`docx-construction`](plugins/teknik-ofis-dokuman/skills/docx-construction/SKILL.md) | DDC | Word document generation for construction: contracts, proposals, reports, specifications, transmittals. Template-based with dynamic content insertion. |
| [`email-construction`](plugins/teknik-ofis-dokuman/skills/email-construction/SKILL.md) | DDC | Email generation for construction workflows: RFI responses, submittal transmittals, meeting notices, change order notifications. Professional templates with context-aware content. |
| [`llm-document-extraction`](plugins/teknik-ofis-dokuman/skills/llm-document-extraction/SKILL.md) | DDC | Extract structured data from construction documents using LLMs. Process RFIs, submittals, contracts, specifications. Convert unstructured PDFs to structured JSON/Excel. |
| [`meeting-minutes-generator`](plugins/teknik-ofis-dokuman/skills/meeting-minutes-generator/SKILL.md) | DDC | Generate structured construction meeting minutes. Track action items, decisions, and attendees. |
| [`pdf-construction`](plugins/teknik-ofis-dokuman/skills/pdf-construction/SKILL.md) | DDC | PDF processing for construction documents: RFIs, submittals, specifications, drawing packages. Extract data, merge packages, fill forms. |
| [`pdf-report-generator`](plugins/teknik-ofis-dokuman/skills/pdf-report-generator/SKILL.md) | DDC | Automatically generate PDF reports from construction data. Create formatted project reports with charts and tables. |
| [`pptx-construction`](plugins/teknik-ofis-dokuman/skills/pptx-construction/SKILL.md) | DDC | PowerPoint generation for construction: project updates, stakeholder presentations, progress reports, bid presentations. Automated slide creation with charts and data. |
| [`project-closeout-checklist`](plugins/teknik-ofis-dokuman/skills/project-closeout-checklist/SKILL.md) | DDC | Manage project closeout activities. Track completion of documentation, warranties, and final inspections. |
| [`rfi-management`](plugins/teknik-ofis-dokuman/skills/rfi-management/SKILL.md) | DDC | Complete RFI (Request for Information) management system. Create, track, route, and analyze RFIs with automatic notifications and response deadline tracking. |
| [`submittal-tracker`](plugins/teknik-ofis-dokuman/skills/submittal-tracker/SKILL.md) | DDC | Track construction submittals through the review process. Manage approvals, revisions, and compliance. |
| [`warranty-tracker`](plugins/teknik-ofis-dokuman/skills/warranty-tracker/SKILL.md) | DDC | Track and manage construction warranties. Monitor expiration dates, claims, and manufacturer documentation. |
| [`xlsx-construction`](plugins/teknik-ofis-dokuman/skills/xlsx-construction/SKILL.md) | DDC | Excel/spreadsheet processing for construction: estimates, schedules, tracking logs, quantity takeoffs. Formulas, formatting, analysis. |

</details>

### teknik-ofis-saha-kalite-isg

**Saha, Kalite ve İSG** — Punch list, kalite kontrol, iş güvenliği denetimi, olay raporu, ilerleme fotoğrafı analizi, saha raporları.

<details><summary>Skill listesi</summary>

| Skill | Kaynak | Açıklama |
|---|---|---|
| [`defect-detection-ai`](plugins/teknik-ofis-saha-kalite-isg/skills/defect-detection-ai/SKILL.md) | DDC | AI-powered construction defect detection using computer vision. Identify cracks, spalling, corrosion, and other defects in concrete, steel, and building components from images and video. |
| [`drone-site-survey`](plugins/teknik-ofis-saha-kalite-isg/skills/drone-site-survey/SKILL.md) | DDC | Process drone survey data for construction sites. Generate orthomosaics, DEMs, point clouds, calculate volumes, track progress, and integrate with BIM models for comparison. |
| [`environmental-monitoring`](plugins/teknik-ofis-saha-kalite-isg/skills/environmental-monitoring/SKILL.md) | DDC | Monitor environmental conditions on construction sites. Track air quality, noise levels, vibration, dust, and weather to ensure compliance and worker safety. |
| [`equipment-telematics`](plugins/teknik-ofis-saha-kalite-isg/skills/equipment-telematics/SKILL.md) | DDC | Integrate and analyze telematics data from heavy construction equipment. Track location, utilization, fuel consumption, maintenance needs, and operator behavior. |
| [`incident-reporting`](plugins/teknik-ofis-saha-kalite-isg/skills/incident-reporting/SKILL.md) | DDC | Construction safety incident reporting and analysis. Capture incidents, conduct investigations, track corrective actions, and analyze trends for prevention. |
| [`oce-field-ops`](plugins/teknik-ofis-saha-kalite-isg/skills/oce-field-ops/SKILL.md) | DDC | Field operations in OpenConstructionERP: punch list, daily diary, HSE observations and task tracking on site. Use when automating construction site workflows (deficiencies, diaries, safety, site tasks). |
| [`progress-monitoring-cv`](plugins/teknik-ofis-saha-kalite-isg/skills/progress-monitoring-cv/SKILL.md) | DDC | Monitor construction progress using computer vision. Analyze site photos and drone imagery to track work completion, detect safety issues, and compare against BIM models. |
| [`progress-photo-analyzer`](plugins/teknik-ofis-saha-kalite-isg/skills/progress-photo-analyzer/SKILL.md) | DDC | Analyze construction site photos to track progress, detect safety issues, and compare against BIM models using computer vision. |
| [`punch-list-manager`](plugins/teknik-ofis-saha-kalite-isg/skills/punch-list-manager/SKILL.md) | DDC | Digital punch list management for construction project closeout. Track deficiencies, assign corrections, photo documentation, and completion verification. |
| [`quality-control-workflow`](plugins/teknik-ofis-saha-kalite-isg/skills/quality-control-workflow/SKILL.md) | DDC | Construction quality control workflow automation. Manage QC inspections, track defects, generate NCRs, and ensure specification compliance throughout the project. |
| [`safety-compliance-checker`](plugins/teknik-ofis-saha-kalite-isg/skills/safety-compliance-checker/SKILL.md) | DDC | Automated safety compliance verification for construction sites. Check PPE usage, zone access, working at heights regulations, and generate compliance reports using rule-based and ML approaches. |
| [`safety-inspection`](plugins/teknik-ofis-saha-kalite-isg/skills/safety-inspection/SKILL.md) | DDC | Digital safety inspection system for construction sites. Checklists, hazard tracking, incident reporting, and compliance documentation. |
| [`safety-inspection-checklist`](plugins/teknik-ofis-saha-kalite-isg/skills/safety-inspection-checklist/SKILL.md) | DDC | Digital safety inspection checklists for construction sites. Generate, conduct, and track safety inspections with automated reporting and compliance monitoring. |
| [`sensor-data-aggregator`](plugins/teknik-ofis-saha-kalite-isg/skills/sensor-data-aggregator/SKILL.md) | DDC | Aggregate and analyze IoT sensor data from construction sites. Collect data from multiple sensor types, detect anomalies, and trigger alerts for safety and quality monitoring. |
| [`telegram-field-bot`](plugins/teknik-ofis-saha-kalite-isg/skills/telegram-field-bot/SKILL.md) | DDC | Build Telegram bots for construction field workers. Real-time reporting, photo uploads, task assignments, progress tracking. Integrate with n8n for automated workflows. |
| [`telegram-worklog`](plugins/teknik-ofis-saha-kalite-isg/skills/telegram-worklog/SKILL.md) | AI-PMO | Сбор данных о выполненных работах с участков через Telegram-бот. Используй когда пользователь говорит "журнал производства работ", "ежедневный отчёт", "данные с участка", "отчёт прораба", "телеграм журнал", "сбор данных с участков", "электронный журнал работ". |
| [`toolbox-talk-generator`](plugins/teknik-ofis-saha-kalite-isg/skills/toolbox-talk-generator/SKILL.md) | DDC | Generate safety toolbox talks for construction crews. Create contextual safety briefings based on weather, work activities, and recent incidents. Support multiple languages. |
| [`voice-to-report`](plugins/teknik-ofis-saha-kalite-isg/skills/voice-to-report/SKILL.md) | DDC | Convert voice recordings to structured construction reports. Field workers speak, AI transcribes and formats. Supports daily reports, safety observations, progress updates. |

</details>

### teknik-ofis-raporlama-risk

**Yönetim Raporu ve Risk** — KPI panoları, yönetici özeti, portföy, senaryo analizi, risk değerlendirme.

<details><summary>Skill listesi</summary>

| Skill | Kaynak | Açıklama |
|---|---|---|
| [`5000-projects-analysis`](plugins/teknik-ofis-raporlama-risk/skills/5000-projects-analysis/SKILL.md) | DDC | Analyze 5000+ IFC and Revit projects at scale for patterns, benchmarks, and insights. Big data analysis for construction. |
| [`data-visualization`](plugins/teknik-ofis-raporlama-risk/skills/data-visualization/SKILL.md) | DDC | Create visualizations for construction data. Generate charts, graphs, heatmaps, and interactive dashboards using Matplotlib, Seaborn, and Plotly for project analysis and reporting. |
| [`decision-support`](plugins/teknik-ofis-raporlama-risk/skills/decision-support/SKILL.md) | DDC | Provide data-driven decision support for construction. Analyze multiple factors and recommend optimal project decisions. |
| [`enterprise-risk-aggregator`](plugins/teknik-ofis-raporlama-risk/skills/enterprise-risk-aggregator/SKILL.md) | DDC | Aggregate and analyze risks across construction project portfolio. Identify correlated risks, systemic exposures, and portfolio-level risk mitigation strategies. |
| [`executive-dashboard`](plugins/teknik-ofis-raporlama-risk/skills/executive-dashboard/SKILL.md) | AI-PMO | Еженедельные дашборды и отчёты для генерального директора и топ-менеджмента. Используй когда пользователь говорит "отчёт для ГД", "недельная сводка", "дашборд руководству", "статус портфеля", "executive summary", "отчёт директору". |
| [`kpi-dashboard`](plugins/teknik-ofis-raporlama-risk/skills/kpi-dashboard/SKILL.md) | DDC | Build KPI dashboards for construction projects. Track CPI, SPI, quality, safety metrics in real-time. |
| [`portfolio-dashboard`](plugins/teknik-ofis-raporlama-risk/skills/portfolio-dashboard/SKILL.md) | DDC | Multi-project portfolio analytics dashboard. Aggregate KPIs across projects, track portfolio health, compare performance, and support executive decision-making. |
| [`predictive-analytics-construction`](plugins/teknik-ofis-raporlama-risk/skills/predictive-analytics-construction/SKILL.md) | DDC | Forecast project outcomes using historical data: cost overruns, schedule delays, risk probabilities. Machine learning models for construction prediction. |
| [`project-kpi-dashboard`](plugins/teknik-ofis-raporlama-risk/skills/project-kpi-dashboard/SKILL.md) | DDC | Create interactive KPI dashboards for construction projects. Track schedule, cost, quality, and safety metrics in real-time. |
| [`risk-analyzer`](plugins/teknik-ofis-raporlama-risk/skills/risk-analyzer/SKILL.md) | AI-PMO | Идентификация, оценка и анализ рисков проекта. Используй когда пользователь говорит "оцени риски", "что может сорваться", "риск-анализ", "матрица рисков", "угрозы проекту", "митигация", "реестр рисков". |
| [`risk-assessment-ml`](plugins/teknik-ofis-raporlama-risk/skills/risk-assessment-ml/SKILL.md) | DDC | Apply machine learning for construction project risk assessment. Predict schedule delays, cost overruns, and safety incidents using historical data and project characteristics. |
| [`scenario-planner`](plugins/teknik-ofis-raporlama-risk/skills/scenario-planner/SKILL.md) | DDC | What-if analysis for construction projects: model different scenarios and their cost/schedule/resource impacts. Compare alternatives and optimize decisions. |

</details>

### teknik-ofis-bim

**BIM Koordinasyon** — Clash detection, BIM doğrulama, IDS kontrolü, sınıflandırma, dijital ikiz.

<details><summary>Skill listesi</summary>

| Skill | Kaynak | Açıklama |
|---|---|---|
| [`bim-clash-detection`](plugins/teknik-ofis-bim/skills/bim-clash-detection/SKILL.md) | DDC | Detect and analyze geometric clashes in BIM models. Identify MEP, structural, and architectural conflicts before construction. |
| [`bim-classification-ai`](plugins/teknik-ofis-bim/skills/bim-classification-ai/SKILL.md) | DDC | Classify BIM elements using AI and standard classification systems. Map elements to UniFormat, MasterFormat, OmniClass, and CWICR codes. |
| [`bim-consistency-checker`](plugins/teknik-ofis-bim/skills/bim-consistency-checker/SKILL.md) | DDC | Check BIM model consistency: naming conventions, parameter completeness, spatial relationships, and data integrity across model elements. |
| [`bim-validation-pipeline`](plugins/teknik-ofis-bim/skills/bim-validation-pipeline/SKILL.md) | DDC | Build automated BIM validation pipelines for IFC/Revit data. Continuous validation against IDS, LOD requirements, COBie, and project-specific BEP standards. |
| [`bim-validation-report`](plugins/teknik-ofis-bim/skills/bim-validation-report/SKILL.md) | DDC | Generate comprehensive BIM model validation reports. Check data quality, completeness, and compliance with standards. |
| [`bim-visual-programming-automation`](plugins/teknik-ofis-bim/skills/bim-visual-programming-automation/SKILL.md) | DDC | Automate BIM workflows using visual programming and Python. Create parametric schedules, export data, batch modify elements, and integrate with external data sources. |
| [`clash-detection-analysis`](plugins/teknik-ofis-bim/skills/clash-detection-analysis/SKILL.md) | DDC | Detect and analyze geometric clashes between BIM elements. Identify hard clashes, soft clashes, and workflow conflicts using spatial analysis and rule-based detection. |
| [`clash-resolution-analyzer`](plugins/teknik-ofis-bim/skills/clash-resolution-analyzer/SKILL.md) | DDC | Analyze BIM clash detection results and suggest resolutions. Prioritize clashes, identify patterns, assign responsibility, and track resolution status. |
| [`digital-twin-sync`](plugins/teknik-ofis-bim/skills/digital-twin-sync/SKILL.md) | DDC | Synchronize construction digital twins with real-time data. Connect BIM models with IoT sensors, progress updates, and field data for live project visualization and monitoring. |
| [`energy-simulation`](plugins/teknik-ofis-bim/skills/energy-simulation/SKILL.md) | DDC | Building energy simulation and analysis for construction. Calculate heating/cooling loads, evaluate envelope performance, optimize HVAC sizing, and ensure energy code compliance. |
| [`generative-ai-design`](plugins/teknik-ofis-bim/skills/generative-ai-design/SKILL.md) | DDC | Generative design for construction: text-to-BIM concepts, option generation, and AI-assisted design iteration with cost and carbon feedback. Use when exploring early design options with AI. |
| [`ids-checker`](plugins/teknik-ofis-bim/skills/ids-checker/SKILL.md) | DDC | Check BIM data against IDS (Information Delivery Specification). Validate model information requirements and compliance. |
| [`interoperability-analyzer`](plugins/teknik-ofis-bim/skills/interoperability-analyzer/SKILL.md) | DDC | Analyze data interoperability issues in construction projects. Identify format incompatibilities and data loss points. |
| [`nobim-image-generator`](plugins/teknik-ofis-bim/skills/nobim-image-generator/SKILL.md) | DDC | Generate images and visualizations from Revit/IFC files without BIM software. Python-based noBIM tool for batch processing. |
| [`oce-geo-coordination`](plugins/teknik-ofis-bim/skills/oce-geo-coordination/SKILL.md) | DDC | Portfolio mapping and model coordination in OpenConstructionERP: the 3D geo hub (Cesium), the coordination hub with clash AI, and geo-anchored projects. Use for multi-project portfolio views and BIM clash workflows. |
| [`oce-validation-engine`](plugins/teknik-ofis-bim/skills/oce-validation-engine/SKILL.md) | DDC | Use the OpenConstructionERP validation engine: rule packs (BOQ quality, DIN 276, NRM, GAEB, MasterFormat, DPGF) that check estimates at import time and on demand. Use when verifying BOQ correctness or writing custom validation rules. |

</details>

### teknik-ofis-surdurulebilirlik

**Karbon ve Sürdürülebilirlik** — CO2 / gömülü karbon, yaşam döngüsü karbon hesabı, ESG.

<details><summary>Skill listesi</summary>

| Skill | Kaynak | Açıklama |
|---|---|---|
| [`carbon-calculator`](plugins/teknik-ofis-surdurulebilirlik/skills/carbon-calculator/SKILL.md) | DDC | Calculate embodied carbon in construction materials. Track CO2 emissions, compare alternatives, and generate sustainability reports. |
| [`co2-carbon-footprint`](plugins/teknik-ofis-surdurulebilirlik/skills/co2-carbon-footprint/SKILL.md) | DDC | Calculate CO2 emissions and carbon footprint from BIM model data. Analyze embodied carbon by material, element, and building system. |
| [`co2-estimation`](plugins/teknik-ofis-surdurulebilirlik/skills/co2-estimation/SKILL.md) | DDC | Calculate carbon footprint of construction projects. Estimate CO2 emissions from materials, transportation, and construction processes using emission factors databases. |
| [`embodied-carbon-esg`](plugins/teknik-ofis-surdurulebilirlik/skills/embodied-carbon-esg/SKILL.md) | DDC | Estimate embodied carbon and produce ESG/climate reporting for construction: LCA per work item, material-based carbon factors, EU taxonomy and CSRD alignment. Use when a project needs carbon estimates or sustainability reporting. |
| [`lifecycle-carbon-calculator`](plugins/teknik-ofis-surdurulebilirlik/skills/lifecycle-carbon-calculator/SKILL.md) | DDC | Calculate embodied carbon and lifecycle emissions for construction materials and projects. Support sustainable design decisions with carbon data. |

</details>

### teknik-ofis-cwicr

**CWICR Birim Fiyat Veritabanı Araçları** — DDC CWICR açık maliyet veritabanı ile maliyet hesabı, kaynak analizi, fiyat güncelleme, eskalasyon. Veritabanı CC BY-NC 4.0: ticari kullanım için DDC lisansı gerekir.

> ⚠️ CWICR veritabanı CC BY-NC 4.0 lisanslıdır. Skill'ler serbest (MIT), ancak veritabanını **ticari projede** kullanmak için DDC'den lisans gerekir.

<details><summary>Skill listesi</summary>

| Skill | Kaynak | Açıklama |
|---|---|---|
| [`cwicr-assembly-builder`](plugins/teknik-ofis-cwicr/skills/cwicr-assembly-builder/SKILL.md) | DDC | Build cost assemblies from CWICR work items. Combine multiple items into reusable templates for common construction elements. |
| [`cwicr-bid-analyzer`](plugins/teknik-ofis-cwicr/skills/cwicr-bid-analyzer/SKILL.md) | DDC | Analyze contractor bids against CWICR benchmarks. Identify pricing anomalies, compare bid components, and support bid evaluation decisions. |
| [`cwicr-change-order`](plugins/teknik-ofis-cwicr/skills/cwicr-change-order/SKILL.md) | DDC | Process construction change orders using CWICR data. Calculate cost impact, compare to original estimate, and generate change order documentation. |
| [`cwicr-comparison-tool`](plugins/teknik-ofis-cwicr/skills/cwicr-comparison-tool/SKILL.md) | DDC | Compare cost estimates across projects, versions, and scenarios. Identify variances, benchmark against standards, and generate comparison reports. |
| [`cwicr-cost-calculator`](plugins/teknik-ofis-cwicr/skills/cwicr-cost-calculator/SKILL.md) | DDC | Calculate construction costs using DDC CWICR resource-based methodology. Break down costs into labor, materials, equipment with transparent pricing. |
| [`cwicr-crew-optimizer`](plugins/teknik-ofis-cwicr/skills/cwicr-crew-optimizer/SKILL.md) | DDC | Optimize crew composition using CWICR labor norms. Balance productivity, cost, and skill requirements for construction crews. |
| [`cwicr-data-loader`](plugins/teknik-ofis-cwicr/skills/cwicr-data-loader/SKILL.md) | DDC | Load and parse DDC CWICR construction cost database from multiple formats: Parquet, Excel, CSV, Qdrant snapshots. Foundation for all CWICR operations. |
| [`cwicr-data-validator`](plugins/teknik-ofis-cwicr/skills/cwicr-data-validator/SKILL.md) | DDC | Validate CWICR data quality and estimate inputs. Check for errors, inconsistencies, outliers, and missing data. |
| [`cwicr-equipment-planner`](plugins/teknik-ofis-cwicr/skills/cwicr-equipment-planner/SKILL.md) | DDC | Plan equipment requirements using CWICR norms. Calculate equipment hours, scheduling, utilization rates, and rental vs purchase analysis. |
| [`cwicr-escalation`](plugins/teknik-ofis-cwicr/skills/cwicr-escalation/SKILL.md) | DDC | Apply price escalation to CWICR estimates over time. Calculate inflation adjustments, material price indices, and labor rate increases. |
| [`cwicr-historical-cost`](plugins/teknik-ofis-cwicr/skills/cwicr-historical-cost/SKILL.md) | DDC | Track and analyze historical cost data using CWICR. Compare actual vs estimated costs, build project cost database, and improve future estimates. |
| [`cwicr-labor-scheduler`](plugins/teknik-ofis-cwicr/skills/cwicr-labor-scheduler/SKILL.md) | DDC | Schedule labor crews based on CWICR norms and project timeline. Calculate crew sizes, shifts, and labor loading curves. |
| [`cwicr-location-factor`](plugins/teknik-ofis-cwicr/skills/cwicr-location-factor/SKILL.md) | DDC | Apply geographic location factors to CWICR estimates. Adjust costs for regional labor rates, material prices, and market conditions. |
| [`cwicr-material-procurement`](plugins/teknik-ofis-cwicr/skills/cwicr-material-procurement/SKILL.md) | DDC | Generate material procurement lists from CWICR data. Calculate quantities with waste factors, group by supplier categories, and create purchase orders. |
| [`cwicr-material-substitution`](plugins/teknik-ofis-cwicr/skills/cwicr-material-substitution/SKILL.md) | DDC | Find substitute materials using CWICR data. Identify equivalent alternatives based on function, cost, and availability. |
| [`cwicr-multilingual`](plugins/teknik-ofis-cwicr/skills/cwicr-multilingual/SKILL.md) | DDC | Work with CWICR database across 26 languages. Cross-language matching, translation, and regional pricing. |
| [`cwicr-overhead-markup`](plugins/teknik-ofis-cwicr/skills/cwicr-overhead-markup/SKILL.md) | DDC | Apply overhead, profit, and markup to CWICR estimates. Calculate indirect costs, general conditions, and contractor margins. |
| [`cwicr-productivity-tracker`](plugins/teknik-ofis-cwicr/skills/cwicr-productivity-tracker/SKILL.md) | DDC | Track actual vs planned productivity using CWICR norms. Calculate productivity rates, identify variances, and generate performance reports. |
| [`cwicr-quantity-matcher`](plugins/teknik-ofis-cwicr/skills/cwicr-quantity-matcher/SKILL.md) | DDC | Match BIM quantities to CWICR work items. Map element categories to cost codes, validate quantities, and generate cost-linked QTOs. |
| [`cwicr-rate-updater`](plugins/teknik-ofis-cwicr/skills/cwicr-rate-updater/SKILL.md) | DDC | Update CWICR resource rates with current market prices. Integrate external price data, apply inflation adjustments, and maintain rate history. |
| [`cwicr-report-generator`](plugins/teknik-ofis-cwicr/skills/cwicr-report-generator/SKILL.md) | DDC | Generate professional cost estimation reports from CWICR calculations. HTML, PDF, Excel outputs with charts and breakdowns. |
| [`cwicr-resource-analyzer`](plugins/teknik-ofis-cwicr/skills/cwicr-resource-analyzer/SKILL.md) | DDC | Analyze construction resources (labor, materials, equipment) from DDC CWICR database. Calculate resource requirements, productivity metrics, and optimization recommendations. |
| [`cwicr-risk-calculator`](plugins/teknik-ofis-cwicr/skills/cwicr-risk-calculator/SKILL.md) | DDC | Calculate risk-adjusted cost estimates using CWICR data. Apply contingencies, Monte Carlo simulation, and probability distributions to cost estimates. |
| [`cwicr-schedule-integrator`](plugins/teknik-ofis-cwicr/skills/cwicr-schedule-integrator/SKILL.md) | DDC | Integrate CWICR cost data with project schedules. Link work items to schedule activities, generate cost-loaded schedules, and cash flow projections. |
| [`cwicr-subcontractor`](plugins/teknik-ofis-cwicr/skills/cwicr-subcontractor/SKILL.md) | DDC | Analyze and compare subcontractor bids against CWICR benchmarks. Evaluate pricing, identify outliers, and support negotiation. |
| [`cwicr-takeoff-helper`](plugins/teknik-ofis-cwicr/skills/cwicr-takeoff-helper/SKILL.md) | DDC | Assist with quantity takeoff using CWICR data. Calculate quantities from dimensions, apply waste factors, and suggest related work items. |
| [`cwicr-unit-converter`](plugins/teknik-ofis-cwicr/skills/cwicr-unit-converter/SKILL.md) | DDC | Convert between construction measurement units. Handle metric/imperial conversion, area/volume calculations, and unit normalization for CWICR data. |
| [`cwicr-value-engineering`](plugins/teknik-ofis-cwicr/skills/cwicr-value-engineering/SKILL.md) | DDC | Perform value engineering analysis using CWICR data. Identify cost-saving alternatives while maintaining function and quality. |
| [`cwicr-waste-calculator`](plugins/teknik-ofis-cwicr/skills/cwicr-waste-calculator/SKILL.md) | DDC | Calculate material waste factors and losses using CWICR norms. Apply waste percentages, cutting losses, and spillage factors to material quantities. |
| [`cwicr-work-breakdown`](plugins/teknik-ofis-cwicr/skills/cwicr-work-breakdown/SKILL.md) | DDC | Break down CWICR work items into component resources. Decompose aggregate items, analyze resource composition, and generate detailed bills of resources. |
| [`semantic-search-cwicr`](plugins/teknik-ofis-cwicr/skills/semantic-search-cwicr/SKILL.md) | DDC | Semantic search in the DDC CWICR construction cost database using vector embeddings (BGE-M3, 1024-dim, per-language Qdrant collections). Find similar work items and resources for cost estimation across 8 national bases and 30 markets in 26 languages. |

</details>

### teknik-ofis-veri-otomasyon

**Veri, Otomasyon ve Yapay Zekâ** — İnşaat verisi için ETL, Excel/CSV/SQL işleme, n8n/Airflow otomasyonları, ML tahmin modelleri, RAG.

<details><summary>Skill listesi</summary>

| Skill | Kaynak | Açıklama |
|---|---|---|
| [`ai-act-compliance`](plugins/teknik-ofis-veri-otomasyon/skills/ai-act-compliance/SKILL.md) | DDC | Check construction AI systems against the EU AI Act (Regulation 2024/1689): classify risk of estimation, scheduling, CV and agent tools, document transparency, keep human oversight. Use when deploying or auditing AI in construction. |
| [`ai-agent-orchestration`](plugins/teknik-ofis-veri-otomasyon/skills/ai-agent-orchestration/SKILL.md) | DDC | Orchestrate multiple AI agents for construction workflows: estimator, scheduler, document, QA and safety agents coordinated by a supervisor agent, with human checkpoints. Use when automating end-to-end project processes with agentic AI. |
| [`airflow-dag`](plugins/teknik-ofis-veri-otomasyon/skills/airflow-dag/SKILL.md) | DDC | Create Apache Airflow DAGs for construction data pipelines. Orchestrate ETL, validation, and reporting workflows. |
| [`big-data-analysis`](plugins/teknik-ofis-veri-otomasyon/skills/big-data-analysis/SKILL.md) | DDC | Analyze large-scale construction datasets. Process thousands of projects for patterns, benchmarks, and predictive insights. |
| [`continuous-learning-construction`](plugins/teknik-ofis-veri-otomasyon/skills/continuous-learning-construction/SKILL.md) | DDC | Automatically extract patterns, best practices, and reusable knowledge from construction automation sessions to improve future performance. |
| [`csv-handler`](plugins/teknik-ofis-veri-otomasyon/skills/csv-handler/SKILL.md) | DDC | Handle CSV files from construction software exports. Auto-detect delimiters, encodings, and clean messy data. |
| [`data-anomaly-detector`](plugins/teknik-ofis-veri-otomasyon/skills/data-anomaly-detector/SKILL.md) | DDC | Detect anomalies and outliers in construction data: unusual costs, schedule variances, productivity spikes. Statistical and ML-based detection methods. |
| [`data-evolution-analysis`](plugins/teknik-ofis-veri-otomasyon/skills/data-evolution-analysis/SKILL.md) | DDC | Analyze data evolution patterns in construction organizations. Assess digital maturity and data strategy for construction companies |
| [`data-lineage-tracker`](plugins/teknik-ofis-veri-otomasyon/skills/data-lineage-tracker/SKILL.md) | DDC | Track data origin, transformations, and flow through construction systems. Essential for audit trails, compliance, and debugging data issues. |
| [`data-model-designer`](plugins/teknik-ofis-veri-otomasyon/skills/data-model-designer/SKILL.md) | DDC | Design data models for construction projects. Create entity-relationship diagrams, define schemas, and generate database structures. |
| [`data-profiler`](plugins/teknik-ofis-veri-otomasyon/skills/data-profiler/SKILL.md) | DDC | Profile construction data to understand characteristics, distributions, quality metrics, and patterns. Essential for data quality assessment and ETL planning. |
| [`data-quality-check`](plugins/teknik-ofis-veri-otomasyon/skills/data-quality-check/SKILL.md) | DDC | Assess construction data quality using completeness, accuracy, consistency, timeliness, and validity metrics. Automated validation with regex patterns, thresholds, and reporting. |
| [`data-silo-detection`](plugins/teknik-ofis-veri-otomasyon/skills/data-silo-detection/SKILL.md) | DDC | Detect and map data silos in construction organizations. Identify disconnected data sources and integration opportunities |
| [`data-source-audit`](plugins/teknik-ofis-veri-otomasyon/skills/data-source-audit/SKILL.md) | DDC | Comprehensive audit of all construction data sources and systems. Map data flows, identify silos, assess quality, and create integration roadmap. |
| [`data-type-classifier`](plugins/teknik-ofis-veri-otomasyon/skills/data-type-classifier/SKILL.md) | DDC | Classify construction data by type (structured, unstructured, semi-structured). Analyze data sources and recommend appropriate storage/processing methods |
| [`df-merger`](plugins/teknik-ofis-veri-otomasyon/skills/df-merger/SKILL.md) | DDC | Merge pandas DataFrames from multiple construction sources. Handle different schemas, keys, and data quality issues. |
| [`digital-maturity-assessment`](plugins/teknik-ofis-veri-otomasyon/skills/digital-maturity-assessment/SKILL.md) | DDC | Assess organization's digital transformation readiness. Evaluate data culture, technology adoption, and process maturity. |
| [`erp-data-extractor`](plugins/teknik-ofis-veri-otomasyon/skills/erp-data-extractor/SKILL.md) | DDC | Extract and analyze data from construction ERP systems. Pull project data for analytics, reporting, and integration. |
| [`erp-integration-analysis`](plugins/teknik-ofis-veri-otomasyon/skills/erp-integration-analysis/SKILL.md) | DDC | Analyze ERP system integration for construction data flows. Map and optimize data flows between ERP modules |
| [`etl-pipeline`](plugins/teknik-ofis-veri-otomasyon/skills/etl-pipeline/SKILL.md) | DDC | Build automated ETL (Extract-Transform-Load) pipelines for construction data. Process PDFs, Excel, BIM exports. Generate reports, dashboards, and integrate with other systems. Orchestrate with Airflow or n8n. |
| [`few-shot-examples`](plugins/teknik-ofis-veri-otomasyon/skills/few-shot-examples/SKILL.md) | DDC | Curated few-shot examples for construction AI tasks: classification, extraction, analysis. Domain-specific examples for improved LLM performance. |
| [`historical-data-manager`](plugins/teknik-ofis-veri-otomasyon/skills/historical-data-manager/SKILL.md) | DDC | Extract, clean, and organize legacy construction data from archives. Migrate historical project data, cost records, and schedules into modern formats. |
| [`input-validation`](plugins/teknik-ofis-veri-otomasyon/skills/input-validation/SKILL.md) | DDC | Validate construction data inputs before processing: cost estimates, schedules, BIM data, field reports. Catch errors early with domain-specific rules. |
| [`json-parser`](plugins/teknik-ofis-veri-otomasyon/skills/json-parser/SKILL.md) | DDC | Parse and validate JSON data from construction APIs, IoT sensors, and BIM exports. Transform nested JSON to flat DataFrames. |
| [`llm-data-automation`](plugins/teknik-ofis-veri-otomasyon/skills/llm-data-automation/SKILL.md) | DDC | Automate construction data processing using LLM (ChatGPT, Claude, LLaMA). Generate Python/Pandas scripts, extract data from documents, and create automated pipelines without deep programming knowledge. |
| [`ml-model-builder`](plugins/teknik-ofis-veri-otomasyon/skills/ml-model-builder/SKILL.md) | DDC | Build ML models for construction predictions. Train and evaluate custom models for cost, duration, and risk prediction. |
| [`ml-model-retrainer`](plugins/teknik-ofis-veri-otomasyon/skills/ml-model-retrainer/SKILL.md) | DDC | Automated pipeline for retraining ML models with new construction data. Monitor model drift, trigger retraining, and validate model performance. |
| [`n8n-cost-estimation`](plugins/teknik-ofis-veri-otomasyon/skills/n8n-cost-estimation/SKILL.md) | DDC | Build n8n pipeline for automated cost estimation from Revit/IFC using DDC CWICR database and LLM classification. |
| [`n8n-daily-report`](plugins/teknik-ofis-veri-otomasyon/skills/n8n-daily-report/SKILL.md) | DDC | Automate daily construction report generation using n8n workflow automation. |
| [`n8n-photo-report`](plugins/teknik-ofis-veri-otomasyon/skills/n8n-photo-report/SKILL.md) | DDC | Automate construction photo report generation using n8n with AI-powered image analysis. |
| [`n8n-project-management`](plugins/teknik-ofis-veri-otomasyon/skills/n8n-project-management/SKILL.md) | DDC | Build a complete project management system with Telegram bot, task distribution, and photo reports using n8n. Based on DDC Project Management repository. |
| [`n8n-pto-pipeline`](plugins/teknik-ofis-veri-otomasyon/skills/n8n-pto-pipeline/SKILL.md) | DDC | Create n8n workflow for daily task assignment from PTO engineer to foreman via Telegram bot with status reporting. |
| [`n8n-workflow-automation`](plugins/teknik-ofis-veri-otomasyon/skills/n8n-workflow-automation/SKILL.md) | DDC | Build no-code/low-code automation workflows for construction using n8n. Automate data extraction, cost estimation, report generation, and system integrations without writing code. |
| [`oce-mcp-integration`](plugins/teknik-ofis-veri-otomasyon/skills/oce-mcp-integration/SKILL.md) | DDC | Connect OpenConstructionERP to AI coding assistants via MCP (Model Context Protocol): expose costs, BOQ, BIM and catalog endpoints as MCP tools so Claude Code / Antigravity / OpenCode can drive the platform. Use when wiring an assistant to the ERP. |
| [`oce-platform-overview`](plugins/teknik-ofis-veri-otomasyon/skills/oce-platform-overview/SKILL.md) | DDC | Guide to OpenConstructionERP: architecture, modules, API surface and quick start. Use when starting any OpenConstructionERP work, onboarding a user to the platform, or deciding which module/endpoint to use. |
| [`oce-property-dev`](plugins/teknik-ofis-veri-otomasyon/skills/oce-property-dev/SKILL.md) | DDC | Property development lifecycle in OpenConstructionERP: lead to SPA to handover — feasibility, budgeting from cost bases, sales tracking and construction handover. Use for residential/commercial development projects. |
| [`ontology-mapper`](plugins/teknik-ofis-veri-otomasyon/skills/ontology-mapper/SKILL.md) | DDC | Map construction data to standard ontologies. Create semantic mappings between different data schemas |
| [`open-data-integrator`](plugins/teknik-ofis-veri-otomasyon/skills/open-data-integrator/SKILL.md) | DDC | Integrate open construction datasets. Combine open data sources for enhanced analysis |
| [`pandas-construction-analysis`](plugins/teknik-ofis-veri-otomasyon/skills/pandas-construction-analysis/SKILL.md) | DDC | Comprehensive Pandas toolkit for construction data analysis. Filter, group, aggregate BIM elements, calculate quantities, merge datasets, and generate reports from structured construction data. |
| [`parquet-converter`](plugins/teknik-ofis-veri-otomasyon/skills/parquet-converter/SKILL.md) | DDC | Convert construction data to/from Parquet format. Optimize storage, enable fast queries, and integrate with data lakehouses. |
| [`prompt-templates`](plugins/teknik-ofis-veri-otomasyon/skills/prompt-templates/SKILL.md) | DDC | Reusable prompt templates for construction AI tasks: cost estimation, schedule analysis, document processing, BIM queries. Structured prompts for consistent results. |
| [`rag-construction`](plugins/teknik-ofis-veri-otomasyon/skills/rag-construction/SKILL.md) | DDC | Build RAG systems for construction knowledge bases. Create searchable AI-powered construction document systems |
| [`schema-validation`](plugins/teknik-ofis-veri-otomasyon/skills/schema-validation/SKILL.md) | DDC | JSON/data schema validation for construction data exchange: API payloads, file imports, BIM exports. Ensure data structure compliance before processing. |
| [`security-review-construction`](plugins/teknik-ofis-veri-otomasyon/skills/security-review-construction/SKILL.md) | DDC | Security review checklist for construction software systems. Use when building integrations, APIs, data pipelines, or dashboards for construction projects. |
| [`sql-query-builder`](plugins/teknik-ofis-veri-otomasyon/skills/sql-query-builder/SKILL.md) | DDC | Build SQL queries for construction databases. Generate optimized SQL queries for construction data retrieval |
| [`standards-compliance-checker`](plugins/teknik-ofis-veri-otomasyon/skills/standards-compliance-checker/SKILL.md) | DDC | Check data compliance with construction standards. Validate data against ISO 19650, IFC, COBie, UniFormat standards. |
| [`uberization-readiness`](plugins/teknik-ofis-veri-otomasyon/skills/uberization-readiness/SKILL.md) | DDC | Assess company readiness for construction industry uberization. Analyze data transparency, process automation, and competitive positioning against open data platforms. |
| [`validation-rules-builder`](plugins/teknik-ofis-veri-otomasyon/skills/validation-rules-builder/SKILL.md) | DDC | Build validation rules for construction data. Create RegEx and logic-based validation for BIM elements, cost codes, and schedule data. |
| [`vector-search`](plugins/teknik-ofis-veri-otomasyon/skills/vector-search/SKILL.md) | DDC | Implement semantic vector search for construction data. Build AI-powered search using embeddings and vector databases (Qdrant, ChromaDB) for intelligent querying of specifications, standards, and project documents. |
| [`verification-loop-construction`](plugins/teknik-ofis-veri-otomasyon/skills/verification-loop-construction/SKILL.md) | DDC | Comprehensive verification system for construction automation deliverables. Use after completing estimates, schedules, reports, or data processing tasks to ensure quality. |
| [`weather-api`](plugins/teknik-ofis-veri-otomasyon/skills/weather-api/SKILL.md) | DDC | Fetch weather data for construction scheduling. Historical data, forecasts, and risk assessment for outdoor work. |
| [`workflow-automation`](plugins/teknik-ofis-veri-otomasyon/skills/workflow-automation/SKILL.md) | DDC | Automate construction data workflows. Build ETL pipelines and DAG workflows for recurring tasks. |
| [`xml-reader`](plugins/teknik-ofis-veri-otomasyon/skills/xml-reader/SKILL.md) | DDC | Read and parse XML from construction systems - P6 schedules, BSDD exports, IFC-XML, COBie-XML. Convert to pandas DataFrames. |

</details>

## Kullanım örnekleri

- "Bu bütçe ve gerçekleşen Excel'ini karşılaştır, sapması %5'i geçen kalemleri ve tamamlanma tahminini (EAC) çıkar."
- "Bu XER dosyasının kritik yolunu göster, baseline'a göre kayan aktiviteleri listele."
- "Bu sözleşmedeki ceza, teminat, süre uzatımı ve fiyat farkı maddelerini tablo halinde çıkar, riskleri işaretle."
- "Bu 3 taşeron teklifini eşitle ve karşılaştırma tablosu hazırla."
- "Bu DWG/IFC'den beton ve kalıp metrajını Excel'e çıkar."
- "Bu ayın hakediş icmalini hazırla." / "Сформируй КС-2 по этим объёмам."

## Kaynaklar ve lisans

| Kaynak | Lisans | Ne alındı |
|---|---|---|
| [datadrivenconstruction/DDC_Skills_for_AI_Agents_in_Construction](https://github.com/datadrivenconstruction/DDC_Skills_for_AI_Agents_in_Construction) | MIT ([LICENSES/DDC-MIT.txt](LICENSES/DDC-MIT.txt), [NOTICE](LICENSES/DDC-NOTICE.md)) | Skill dosyaları (kitap PDF'leri ve veritabanı alınmadı) |
| [alexgrebeshok-coder/ai-pmo-skills](https://github.com/alexgrebeshok-coder/ai-pmo-skills) | MIT ([LICENSES/ai-pmo-skills-MIT.txt](LICENSES/ai-pmo-skills-MIT.txt)) | 11 PMO skill'i (КС-2/КС-3, sözleşme, Gantt, risk...) |
| [paulieb89/pyp6xer-mcp](https://github.com/paulieb89/pyp6xer-mcp) | MIT ([LICENSES/pyp6xer-mcp-MIT.txt](LICENSES/pyp6xer-mcp-MIT.txt)) | Yalnızca referans: incelenen commit'e (`5a88c0c`) sabitlenmiş halde GitHub'dan `uvx` ile çalıştırılır |
| [dleerdefi/claude-code-construction](https://github.com/dleerdefi/claude-code-construction) | MIT | Yalnızca referans: doğrudan kendi reposundan kurulur |

Bilerek **dahil edilmeyenler**: `Construction-Gamma/construction-gamma-skills` (ücretli, yeniden dağıtımı yasak) ve `hamzaabduljabbar/autoConst-*` (kaynak-erişilebilir lisans, kopyalanması kısıtlı). Bunları kullanmak istersen kendi repolarından, kendi lisans şartlarıyla kur.

Skill'ler genel amaçlı şablonlardır; çıktıları (metraj, maliyet, sözleşme yorumu) her zaman teknik ofis tarafından kontrol edilmelidir. Türk mevzuatı (4734/4735, Yapım İşleri Genel Şartnamesi, Çevre ve Şehircilik birim fiyatları) için özel bir skill yoktur.
