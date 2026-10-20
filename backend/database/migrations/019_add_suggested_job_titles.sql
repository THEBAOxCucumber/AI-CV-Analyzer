-- ตำแหน่งงานที่ AI แนะนำจาก Resume (prompt resume-analysis-v2.1.0 ขึ้นไป)
-- หน้าหางานใช้ค้นงานที่เหมาะกับผู้ใช้อัตโนมัติ — ผลเก่าเป็น NULL (แสดงเป็นรายการว่าง)
ALTER TABLE resume_analysis_runs
    ADD COLUMN suggested_job_titles JSON NULL
    AFTER recommendations;
