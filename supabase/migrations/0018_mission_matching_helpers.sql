-- Secure helper for company-side candidate ranking.
create or replace function public.company_mission_matches(p_mission_id uuid)
returns table (
  professional_id uuid,
  first_name text,
  last_name text,
  professional_type public.professional_type,
  specialty text,
  years_experience numeric,
  medical_transport_years numeric,
  air_ambulance_years numeric,
  score numeric,
  reasons jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.missions%rowtype;
  x record;
  result jsonb;
begin
  select * into m from public.missions where id=p_mission_id and company_id=auth.uid();
  if m.id is null then raise exception 'Mission not found or unavailable'; end if;
  for x in select p.*, pr.first_name, pr.last_name from public.professionals p join public.profiles pr on pr.id=p.id where p.verification_status='verified' and p.professional_type=m.professional_type loop
    result := public.match_professional_to_mission(m.id,x.id);
    if (result->>'eligible')::boolean then
      professional_id:=x.id; first_name:=x.first_name; last_name:=x.last_name; professional_type:=x.professional_type; specialty:=x.specialty; years_experience:=x.years_experience; medical_transport_years:=x.medical_transport_years; air_ambulance_years:=x.air_ambulance_years; score:=(result->>'score')::numeric; reasons:=result->'reasons'; return next;
    end if;
  end loop;
end;
$$;
revoke all on function public.company_mission_matches(uuid) from public;
grant execute on function public.company_mission_matches(uuid) to authenticated;
