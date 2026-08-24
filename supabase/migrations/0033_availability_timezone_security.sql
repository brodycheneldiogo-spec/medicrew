-- Availability timezone + privacy hardening.
alter table public.professional_availability add column if not exists timezone text not null default 'UTC';
create index if not exists availability_professional_starts_idx on public.professional_availability(professional_id,starts_at);

create or replace function public.upsert_my_availability_slot_v2(
  p_slot_id uuid default null,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_start_location text default null,
  p_max_notice_hours numeric default 3,
  p_international boolean default false,
  p_transport_types text[] default '{}',
  p_timezone text default 'UTC'
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_tz text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.professionals where id=auth.uid() and verification_status<>'suspended') then raise exception 'Professional account unavailable'; end if;
  if p_starts_at is null or p_ends_at is null or p_ends_at<=p_starts_at then raise exception 'Availability window is invalid'; end if;
  if p_starts_at<=now() then raise exception 'Availability must be in the future'; end if;
  if p_max_notice_hours is not null and p_max_notice_hours<0 then raise exception 'Notice cannot be negative'; end if;
  v_tz:=case when p_timezone is not null and length(trim(p_timezone))>0 then trim(p_timezone) else 'UTC' end;
  perform 1 from pg_timezone_names where name=v_tz;
  if not found then v_tz:='UTC'; end if;
  if p_slot_id is null then
    insert into public.professional_availability(professional_id,starts_at,ends_at,start_location,max_notice_hours,international,transport_types,timezone)
    values(auth.uid(),p_starts_at,p_ends_at,nullif(trim(p_start_location),''),greatest(coalesce(p_max_notice_hours,0),0),coalesce(p_international,false),coalesce(p_transport_types,'{}'),v_tz)
    returning id into v_id;
  else
    update public.professional_availability set starts_at=p_starts_at,ends_at=p_ends_at,start_location=nullif(trim(p_start_location),''),max_notice_hours=greatest(coalesce(p_max_notice_hours,0),0),international=coalesce(p_international,false),transport_types=coalesce(p_transport_types,'{}'),timezone=v_tz
    where id=p_slot_id and professional_id=auth.uid() returning id into v_id;
    if v_id is null then raise exception 'Availability slot not found'; end if;
  end if;
  return v_id;
end;
$$;
revoke all on function public.upsert_my_availability_slot_v2(uuid,timestamptz,timestamptz,text,numeric,boolean,text[],text) from public;
grant execute on function public.upsert_my_availability_slot_v2(uuid,timestamptz,timestamptz,text,numeric,boolean,text[],text) to authenticated;

create or replace function public.company_professional_month_availability(p_professional_ids uuid[],p_month_start date)
returns table(professional_id uuid,day date,start_time text,end_time text,start_location text,international boolean,transport_types text[])
language sql security definer set search_path=public
as $$
  select a.professional_id,
         (a.starts_at at time zone coalesce(nullif(a.timezone,''),'UTC'))::date,
         to_char(a.starts_at at time zone coalesce(nullif(a.timezone,''),'UTC'),'HH24:MI'),
         to_char(a.ends_at at time zone coalesce(nullif(a.timezone,''),'UTC'),'HH24:MI'),
         a.start_location,a.international,a.transport_types
  from public.professional_availability a
  join public.professionals p on p.id=a.professional_id
  where a.professional_id=any(p_professional_ids)
    and p.verification_status='verified'
    and exists(
      select 1 from public.mission_matches mm
      join public.missions m on m.id=mm.mission_id
      where mm.professional_id=a.professional_id and mm.eligible=true and m.company_id=auth.uid()
    )
    and (a.starts_at at time zone coalesce(nullif(a.timezone,''),'UTC'))::date >= p_month_start
    and (a.starts_at at time zone coalesce(nullif(a.timezone,''),'UTC'))::date < (p_month_start + interval '1 month')::date
  order by a.professional_id,a.starts_at;
$$;
revoke all on function public.company_professional_month_availability(uuid[],date) from public;
grant execute on function public.company_professional_month_availability(uuid[],date) to authenticated;

