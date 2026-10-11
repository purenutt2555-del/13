
create extension if not exists pgcrypto;

create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  trainee_name text not null,
  trainee_code text,
  unit_name text,
  evaluator_name text not null,
  evaluation_date date not null,
  course text not null,
  scores jsonb not null,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.evaluations enable row level security;

-- ตารางนี้ยังไม่เปิดสิทธิ์ให้ผู้ใช้งานทั่วไป
-- ต้องตั้งค่าการยืนยันตัวตนและสิทธิ์ RLS ก่อนใช้ฐานข้อมูลร่วมกัน
-- อย่าเปิดสิทธิ์อ่าน/เขียน/ลบให้ anon ทุกคน หากมีข้อมูลจริง
