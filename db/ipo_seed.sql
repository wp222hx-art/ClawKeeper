-- =============================================================================
-- IPOPilot Seed Data
-- =============================================================================
-- Seeds the regulatory knowledge base scaffolding (titles + section structure
-- only; full text + embeddings will be populated in Phase 2 by the RAG
-- ingestion pipeline) and the public industry benchmarks for SaaS / BioPharma
-- / Clean Energy used by industry expert agents.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Regulation registry — placeholders for the documents the ingestion
-- pipeline must fetch in Phase 2. Section paths are pre-defined so agents
-- can already reference them by ID before bodies are loaded.
-- -----------------------------------------------------------------------------

-- SEC core
INSERT INTO ipo_regulations (jurisdiction, doc_type, title, section, source_url, language) VALUES
  ('SEC', 'Reg S-K',  'Regulation S-K — Standard Instructions for Filing Forms', 'Item 101 Description of Business',  'https://www.ecfr.gov/current/title-17/chapter-II/part-229', 'en'),
  ('SEC', 'Reg S-K',  'Regulation S-K — Standard Instructions for Filing Forms', 'Item 103 Legal Proceedings',         'https://www.ecfr.gov/current/title-17/chapter-II/part-229', 'en'),
  ('SEC', 'Reg S-K',  'Regulation S-K — Standard Instructions for Filing Forms', 'Item 105 Risk Factors',              'https://www.ecfr.gov/current/title-17/chapter-II/part-229', 'en'),
  ('SEC', 'Reg S-K',  'Regulation S-K — Standard Instructions for Filing Forms', 'Item 303 MD&A',                       'https://www.ecfr.gov/current/title-17/chapter-II/part-229', 'en'),
  ('SEC', 'Reg S-K',  'Regulation S-K — Standard Instructions for Filing Forms', 'Item 402 Executive Compensation',     'https://www.ecfr.gov/current/title-17/chapter-II/part-229', 'en'),
  ('SEC', 'Reg S-K',  'Regulation S-K — Standard Instructions for Filing Forms', 'Item 404 Related Party Transactions', 'https://www.ecfr.gov/current/title-17/chapter-II/part-229', 'en'),
  ('SEC', 'Reg S-X',  'Regulation S-X — Form & Content of Financial Statements', 'Article 3 General Instructions',       'https://www.ecfr.gov/current/title-17/chapter-II/part-210', 'en'),
  ('SEC', 'Reg S-X',  'Regulation S-X — Form & Content of Financial Statements', 'Article 11 Pro Forma Financial Info',  'https://www.ecfr.gov/current/title-17/chapter-II/part-210', 'en'),
  ('SEC', 'Form S-1', 'Form S-1 — Registration Statement under the Securities Act of 1933', 'General',                  'https://www.sec.gov/files/forms-1.pdf', 'en'),
  ('SEC', 'Form F-1', 'Form F-1 — Registration Statement for Foreign Private Issuers',      'General',                  'https://www.sec.gov/files/formf-1.pdf', 'en'),
  ('SEC', 'SOX',      'Sarbanes-Oxley Act',  'Section 302 Corporate Responsibility',     'https://www.sec.gov/about/laws/soa2002.pdf', 'en'),
  ('SEC', 'SOX',      'Sarbanes-Oxley Act',  'Section 404 Internal Control over Financial Reporting', 'https://www.sec.gov/about/laws/soa2002.pdf', 'en'),
  ('SEC', 'JOBS Act', 'Jumpstart Our Business Startups Act — EGC Provisions', 'Title I',                                'https://www.congress.gov/bill/112th-congress/house-bill/3606', 'en');

-- Nasdaq / NYSE listing standards
INSERT INTO ipo_regulations (jurisdiction, doc_type, title, section, source_url, language) VALUES
  ('NASDAQ', 'Listing Rules', 'Nasdaq Listing Rules', '5300 Series — Global Select Market',     'https://listingcenter.nasdaq.com/rulebook/nasdaq/rules', 'en'),
  ('NASDAQ', 'Listing Rules', 'Nasdaq Listing Rules', '5400 Series — Global Market',            'https://listingcenter.nasdaq.com/rulebook/nasdaq/rules', 'en'),
  ('NASDAQ', 'Listing Rules', 'Nasdaq Listing Rules', '5500 Series — Capital Market',           'https://listingcenter.nasdaq.com/rulebook/nasdaq/rules', 'en'),
  ('NASDAQ', 'Listing Rules', 'Nasdaq Listing Rules', '5600 Series — Corporate Governance',     'https://listingcenter.nasdaq.com/rulebook/nasdaq/rules', 'en'),
  ('NYSE',   'Listed Co Manual', 'NYSE Listed Company Manual', 'Section 102 Minimum Numerical Standards',  'https://nyseguide.srorules.com/listed-company-manual', 'en'),
  ('NYSE',   'Listed Co Manual', 'NYSE Listed Company Manual', 'Section 303A Corporate Governance',         'https://nyseguide.srorules.com/listed-company-manual', 'en');

-- HKEX core (Main Board + GEM)
INSERT INTO ipo_regulations (jurisdiction, doc_type, title, section, source_url, language) VALUES
  ('HKEX', 'Main Board Listing Rules', 'HKEX Main Board Listing Rules', 'Chapter 8 Qualifications for Listing',     'https://en-rules.hkex.com.hk/rulebook/chapter-8', 'en'),
  ('HKEX', 'Main Board Listing Rules', 'HKEX Main Board Listing Rules', 'Chapter 9 Application Procedures',         'https://en-rules.hkex.com.hk/rulebook/chapter-9', 'en'),
  ('HKEX', 'Main Board Listing Rules', 'HKEX Main Board Listing Rules', 'Chapter 11 Contents of Listing Documents', 'https://en-rules.hkex.com.hk/rulebook/chapter-11', 'en'),
  ('HKEX', 'Main Board Listing Rules', 'HKEX Main Board Listing Rules', 'Chapter 14 Notifiable Transactions',       'https://en-rules.hkex.com.hk/rulebook/chapter-14', 'en'),
  ('HKEX', 'Main Board Listing Rules', 'HKEX Main Board Listing Rules', 'Chapter 14A Connected Transactions',       'https://en-rules.hkex.com.hk/rulebook/chapter-14a', 'en'),
  ('HKEX', 'Main Board Listing Rules', 'HKEX Main Board Listing Rules', 'Chapter 18A Biotech Companies',            'https://en-rules.hkex.com.hk/rulebook/chapter-18a', 'en'),
  ('HKEX', 'Main Board Listing Rules', 'HKEX Main Board Listing Rules', 'Chapter 18C Specialist Technology',        'https://en-rules.hkex.com.hk/rulebook/chapter-18c', 'en'),
  ('HKEX', 'Main Board Listing Rules', 'HKEX Main Board Listing Rules', 'Chapter 19A PRC Issuers',                  'https://en-rules.hkex.com.hk/rulebook/chapter-19a', 'en'),
  ('HKEX', 'Main Board Listing Rules', 'HKEX Main Board Listing Rules', 'Appendix 27 ESG Reporting Guide',          'https://en-rules.hkex.com.hk/rulebook/appendix-27', 'en'),
  ('HKEX', 'GEM Listing Rules',        'HKEX GEM Listing Rules',        'Chapter 11 Qualifications for Listing',    'https://en-rules.hkex.com.hk/rulebook/chapter-11-0', 'en'),
  ('HKEX', 'Guidance Letter',          'HKEX Guidance Letter HKEX-GL68-13', 'Pre-IPO Investments',                  'https://en-rules.hkex.com.hk/rulebook/hkex-gl68-13', 'en'),
  ('HKEX', 'Guidance Letter',          'HKEX Guidance Letter HKEX-GL86-16', 'Suitability for Listing',              'https://en-rules.hkex.com.hk/rulebook/hkex-gl86-16', 'en');

-- Accounting standards
INSERT INTO ipo_regulations (jurisdiction, doc_type, title, section, source_url, language) VALUES
  ('FASB', 'US GAAP', 'ASC 606 Revenue from Contracts with Customers',  'Five-Step Revenue Recognition Model',     'https://asc.fasb.org/topic&trid=49130', 'en'),
  ('FASB', 'US GAAP', 'ASC 842 Leases',                                  'Lessee Accounting',                       'https://asc.fasb.org/topic&trid=77888517', 'en'),
  ('FASB', 'US GAAP', 'ASC 718 Stock Compensation',                      'Equity-Classified Awards',                'https://asc.fasb.org/topic&trid=2127130', 'en'),
  ('IASB', 'IFRS',    'IFRS 15 Revenue from Contracts with Customers',  'Five-Step Model',                          'https://www.ifrs.org/issued-standards/list-of-standards/ifrs-15/', 'en'),
  ('IASB', 'IFRS',    'IFRS 16 Leases',                                  'Recognition & Measurement',                'https://www.ifrs.org/issued-standards/list-of-standards/ifrs-16/', 'en'),
  ('PCAOB','Auditing Standard', 'AS 2201 Audit of ICFR Integrated with Financial Statement Audit', 'Full Standard', 'https://pcaobus.org/oversight/standards/auditing-standards/details/AS2201', 'en'),
  ('PCAOB','Auditing Standard', 'AS 1105 Audit Evidence',                'Full Standard',                            'https://pcaobus.org/oversight/standards/auditing-standards/details/AS1105', 'en');

-- -----------------------------------------------------------------------------
-- 2. Industry benchmarks — public-domain reference data
-- -----------------------------------------------------------------------------

-- SaaS benchmarks (sources: SaaS Capital, ChartMogul, OpenView typical ranges)
INSERT INTO ipo_industry_benchmarks
    (industry, sub_industry, region, metric_key, metric_label, metric_unit,
     p10, p25, p50, p75, p90, mean, sample_size, as_of_date, source) VALUES
  ('SAAS','SMB_SAAS','GLOBAL',  'ARR_GROWTH_YOY',     'ARR Growth YoY',                     '%',  10, 18, 28, 45, 70, 32, 1500, '2024-12-31', 'IPOPilot Reference Set 2024'),
  ('SAAS','SMB_SAAS','GLOBAL',  'NET_REVENUE_RETENTION','Net Revenue Retention',            '%',  85, 92, 102, 115, 130, 104, 1200, '2024-12-31', 'IPOPilot Reference Set 2024'),
  ('SAAS','SMB_SAAS','GLOBAL',  'GROSS_REVENUE_RETENTION','Gross Revenue Retention',        '%',  78, 85, 90, 94, 97, 89, 1200, '2024-12-31', 'IPOPilot Reference Set 2024'),
  ('SAAS','SMB_SAAS','GLOBAL',  'GROSS_MARGIN',       'Gross Margin',                       '%',  60, 68, 74, 80, 85, 73, 1500, '2024-12-31', 'IPOPilot Reference Set 2024'),
  ('SAAS','SMB_SAAS','GLOBAL',  'CAC_PAYBACK_MONTHS', 'CAC Payback Period',                 'months', 8, 14, 22, 32, 48, 24, 900, '2024-12-31', 'IPOPilot Reference Set 2024'),
  ('SAAS','SMB_SAAS','GLOBAL',  'MAGIC_NUMBER',       'Magic Number',                       'x',  0.3, 0.6, 0.9, 1.3, 1.8, 1.0, 800, '2024-12-31', 'IPOPilot Reference Set 2024'),
  ('SAAS','SMB_SAAS','GLOBAL',  'RULE_OF_40',         'Rule of 40',                         '%',  -10, 10, 28, 50, 75, 28, 1500, '2024-12-31', 'IPOPilot Reference Set 2024'),
  ('SAAS','SMB_SAAS','GLOBAL',  'EV_REVENUE_NTM',     'EV / NTM Revenue',                   'x',  3.5, 5.5, 8.0, 12.0, 18.0, 9.2, 200, '2024-12-31', 'Public SaaS Comp Set'),
  ('SAAS','ENTERPRISE_SAAS','GLOBAL', 'ARR_GROWTH_YOY','ARR Growth YoY',                    '%',   8, 15, 22, 32, 48, 24, 700, '2024-12-31', 'IPOPilot Reference Set 2024'),
  ('SAAS','ENTERPRISE_SAAS','GLOBAL', 'NET_REVENUE_RETENTION','Net Revenue Retention',     '%',  98, 108, 118, 128, 140, 119, 600, '2024-12-31', 'IPOPilot Reference Set 2024'),
  ('SAAS','ENTERPRISE_SAAS','GLOBAL', 'GROSS_MARGIN', 'Gross Margin',                       '%',  68, 74, 79, 84, 88, 78, 700, '2024-12-31', 'IPOPilot Reference Set 2024'),
  ('SAAS','ENTERPRISE_SAAS','GLOBAL', 'EV_REVENUE_NTM','EV / NTM Revenue',                 'x',   4.5, 7.0, 10.5, 16.0, 24.0, 12.5, 100, '2024-12-31', 'Public SaaS Comp Set');

-- BioPharma benchmarks
INSERT INTO ipo_industry_benchmarks
    (industry, sub_industry, region, metric_key, metric_label, metric_unit,
     p10, p25, p50, p75, p90, mean, sample_size, as_of_date, source) VALUES
  ('BIOPHARMA','CLINICAL_STAGE','US',   'CASH_RUNWAY_MONTHS',  'Cash Runway',                        'months', 8, 14, 22, 32, 48, 24, 250, '2024-12-31', 'BioPharma Catalyst 2024'),
  ('BIOPHARMA','CLINICAL_STAGE','US',   'PHASE3_SUCCESS_RATE', 'Phase 3 Approval Rate',              '%',  35, 45, 58, 68, 78, 56, 500, '2024-06-30', 'BIO Industry Analysis 2024'),
  ('BIOPHARMA','CLINICAL_STAGE','US',   'PHASE2_SUCCESS_RATE', 'Phase 2 to Phase 3 Advance Rate',    '%',  18, 28, 38, 48, 60, 38, 1200, '2024-06-30', 'BIO Industry Analysis 2024'),
  ('BIOPHARMA','CLINICAL_STAGE','US',   'IPO_PROCEEDS_USD_M',  'IPO Proceeds',                       'USD_M', 50, 80, 130, 200, 350, 165, 180, '2024-12-31', 'Renaissance Capital 2024'),
  ('BIOPHARMA','CLINICAL_STAGE','HK',   'CASH_RUNWAY_MONTHS',  'Cash Runway',                        'months', 6, 12, 20, 30, 42, 22, 80, '2024-12-31', 'HKEX Ch. 18A Filings'),
  ('BIOPHARMA','CLINICAL_STAGE','HK',   'IPO_PROCEEDS_USD_M',  'IPO Proceeds',                       'USD_M', 60, 100, 180, 320, 600, 230, 80, '2024-12-31', 'HKEX Ch. 18A Filings'),
  ('BIOPHARMA','COMMERCIAL_STAGE','GLOBAL', 'GROSS_MARGIN',    'Gross Margin',                       '%',  55, 68, 78, 85, 90, 76, 200, '2024-12-31', 'IPOPilot Reference Set 2024'),
  ('BIOPHARMA','COMMERCIAL_STAGE','GLOBAL', 'RD_TO_REVENUE',   'R&D Intensity',                      '%',   8, 14, 22, 35, 55, 26, 200, '2024-12-31', 'IPOPilot Reference Set 2024');

-- Clean Energy benchmarks
INSERT INTO ipo_industry_benchmarks
    (industry, sub_industry, region, metric_key, metric_label, metric_unit,
     p10, p25, p50, p75, p90, mean, sample_size, as_of_date, source) VALUES
  ('CLEAN_ENERGY','SOLAR_MFG','GLOBAL',     'GROSS_MARGIN',          'Gross Margin',                  '%',   8, 14, 20, 26, 32, 20, 60, '2024-12-31', 'BloombergNEF 2024'),
  ('CLEAN_ENERGY','SOLAR_MFG','GLOBAL',     'CAPEX_TO_REVENUE',      'Capex Intensity',               '%',  10, 18, 28, 42, 60, 31, 60, '2024-12-31', 'BloombergNEF 2024'),
  ('CLEAN_ENERGY','EV_BATTERY','GLOBAL',    'GROSS_MARGIN',          'Gross Margin',                  '%',  10, 16, 22, 28, 34, 22, 40, '2024-12-31', 'BloombergNEF 2024'),
  ('CLEAN_ENERGY','EV_BATTERY','GLOBAL',    'CAPEX_TO_REVENUE',      'Capex Intensity',               '%',  20, 32, 48, 65, 90, 51, 40, '2024-12-31', 'BloombergNEF 2024'),
  ('CLEAN_ENERGY','EV_BATTERY','GLOBAL',    'EV_REVENUE_NTM',        'EV / NTM Revenue',              'x',  0.8, 1.5, 2.5, 4.0, 6.5, 3.1, 50, '2024-12-31', 'Public Comp Set'),
  ('CLEAN_ENERGY','HYDROGEN','GLOBAL',      'GROSS_MARGIN',          'Gross Margin',                  '%',  -10, 0, 12, 22, 32, 11, 25, '2024-12-31', 'BloombergNEF 2024'),
  ('CLEAN_ENERGY','HYDROGEN','GLOBAL',      'CASH_BURN_USD_M_YEAR',  'Annual Cash Burn',              'USD_M', 20, 40, 80, 150, 280, 110, 25, '2024-12-31', 'IPOPilot Reference Set 2024'),
  ('CLEAN_ENERGY','WIND','GLOBAL',          'GROSS_MARGIN',          'Gross Margin',                  '%',  12, 18, 24, 30, 36, 24, 35, '2024-12-31', 'BloombergNEF 2024');
