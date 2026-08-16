-- Persist professional profile and availability through guarded RPCs.
create or replace function public.update_my_professional_profile(
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_date_of_birth date,
  p_address text,
  p_nationality text,
  p_specialty text,
  p_rpps_number text,
  p_years_experience integer,
  p_medical_transport_years numeric,
  p_air_ambulance_years numeric,
  p_repatriation_years numeric,
  p_emergency_years numeric,
  p_icu_years numeric,
  p_international_available boolean,
  p_available_now boolean
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.professionals where id=auth.uid()) then raise exception 'Professional profile not found'; end if;
  if p_years_experience < 0 or p_medical_transport_years < 0 or p_air_ambulance_years < 0 or p_repatriation_years < 0 or p_emergency_years < 0 or p_icu_years < 0 then raise exception 'Experience values cannot be negative'; end if;
  update public.profiles set first_name=nullif(trim(p_first_name),''), last_name=nullif(trim(p_last_name),''), phone=nullif(trim(p_phone),'') where id=auth.uid();
  update public.professionals set date_of_birth=p_date_of_birth,address=nullif(trim(p_address),''),nationality=nullif(trim(p_nationality),''),specialty=nullif(trim(p_specialty),''),rpps_number=nullif(trim(p_rpps_number),''),years_experience=p_years_experience,medical_transport_years=p_medical_transport_years,air_ambulance_years=p_air_ambulance_years,repatriation_years=p_repatriation_years,emergency_years=p_emergency_years,icu_years=p_icu_years,international_available=coalesce(p_international_available,false),available_now=coalesce(p_available_now,false) where id=auth.uid();
end;
$$;
grant execute on function public.update_my_professional_profile(text,text,text,date,text,text,text,text,integer,numeric,numeric,numeric,numeric,numeric,boolean,boolean) to authenticated;

create or replace function public.replace_my_availability(
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_start_location text,
  p_max_notice_hours numeric,
  p_international boolean,
  p_transport_types text[]
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.professionals where id=auth.uid() and verification_status <> 'suspended') then raise exception 'Professional account unavailable'; end if;
  if p_ends_at <= p_starts_at then raise exception 'End time must be after start time'; end if;
  if p_max_notice_hours is not null and p_max_notice_hours < 0 then raise exception 'Notice cannot be negative'; end if;
  delete from public.professional_availability where professional_id=auth.uid() and starts_at=p_starts_at and ends_at=p_ends_at;
  insert into public.professional_availability(professional_id,starts_at,ends_at,start_location,max_notice_hours,international,transport_types)
  values(auth.uid(),p_starts_at,p_ends_at,nullif(trim(p_start_location),''),p_max_notice_hours,coalesce(p_international,false),coalesce(p_transport_types,'{}')) returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.replace_my_availability(timestamptz,timestamptz,text,numeric,boolean,text[]) to authenticated;

create or replace function public.get_my_professional_profile()
returns jsonb
language sql security definer set search_path = public
as $$
  select jsonb_build_object('profile',to_jsonb(p),'professional',to_jsonb(pr))
  from public.profiles p join public.professionals pr on pr.id=p.id where p.id=auth.uid();
$$;
grant execute on function public.get_my_professional_profile() to authenticated;
